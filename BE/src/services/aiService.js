let aiClient = null;

/**
 * Create and reuse Gemini client.
 *
 * We use dynamic import because many Node/Express projects use CommonJS require(),
 * while @google/genai is easier to load with import().
 */
async function getAiClient() {
  if (aiClient) {
    return aiClient;
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in .env file.");
  }

  const { GoogleGenAI } = await import("@google/genai");

  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  return aiClient;
}

/**
 * Extract JSON from Gemini output.
 * Sometimes AI wraps JSON in ```json ... ```, so this function cleans it.
 */
function extractJson(text) {
  const raw = String(text || "").trim();

  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const cleaned = codeBlockMatch ? codeBlockMatch[1].trim() : raw;

  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");

  let start = -1;
  let end = -1;

  if (arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart)) {
    start = arrayStart;
    end = cleaned.lastIndexOf("]");
  } else {
    start = objectStart;
    end = cleaned.lastIndexOf("}");
  }

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI did not return valid JSON.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * General text generation using Gemini.
 */
async function generateText(prompt) {
  const ai = await getAiClient();
  const configuredFallbackModels = String(
    process.env.GEMINI_TEXT_FALLBACK_MODELS ||
      "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash-lite",
  )
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const modelCandidates = [
    process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
    ...configuredFallbackModels,
  ].filter((model, index, models) => models.indexOf(model) === index);
  const modelErrors = [];

  for (const model of modelCandidates) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      return response.text || "";
    } catch (error) {
      modelErrors.push(error);
      const statusCode = Number(error?.status);
      const canTryFallback = [404, 429, 503].includes(statusCode);
      const hasAnotherModel = model !== modelCandidates.at(-1);

      if (!canTryFallback || !hasAnotherModel) {
        throw error;
      }

      console.warn(
        `[Gemini] Model ${model} is unavailable (${error.status}); trying a fallback model.`,
      );

      // Nếu gặp lỗi 429 (Rate limit / Quota), tạm hoãn 1 giây trước khi chuyển model
      if (statusCode === 429) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  // Preserve the actionable service error instead of blindly throwing the
  // final fallback error. For example, an exhausted model (429) followed by a
  // retired fallback (404) must still be reported as quota exhaustion.
  const actionableError =
    modelErrors.find((error) => Number(error?.status) === 429) ||
    modelErrors.find((error) => Number(error?.status) === 503) ||
    modelErrors.at(-1);

  throw actionableError || new Error("No Gemini text model is available.");
}

/**
 * AI moderation for uploaded documents.
 *
 * Result:
 * {
 *   status: "APPROVED" or "REJECTED",
 *   reason: "...",
 *   suspicious_text: [...]
 * }
 */
async function moderateDocument(text) {
  const prompt = `
You are an AI document moderator for a university learning platform called AI StudyHub.

Decide whether this uploaded document is valid for academic study.

Accept:
- university study materials
- lecture notes
- programming documents
- code documents
- game programming documents if they are about learning programming

Reject:
- entertainment gaming content not related to study
- inappropriate sexual content
- irrelevant TikTok/adult links
- spam or non-study material

Return JSON only in this exact format:
{
  "status": "APPROVED" or "REJECTED",
  "reason": "short reason",
  "suspicious_text": ["text segment 1", "text segment 2"]
}

Document text:
${String(text || "").slice(0, 12000)}
`;

  const resultText = await generateText(prompt);
  const result = extractJson(resultText);

  return {
    status: result.status === "REJECTED" ? "REJECTED" : "APPROVED",
    reason: result.reason || "",
    suspicious_text: Array.isArray(result.suspicious_text)
      ? result.suspicious_text
      : [],
  };
}

/**
 * Create vector embedding for document chunks or user questions.
 *
 * Supabase pgvector column is VECTOR(768), so outputDimensionality = 768.
 */
async function createEmbedding(text, mode = "document") {
  const ai = await getAiClient();

  const prefix =
    mode === "query"
      ? "Represent this question for retrieving relevant study document chunks: "
      : "Represent this study document chunk for retrieval: ";

  const response = await ai.models.embedContent({
    model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
    contents: prefix + String(text || "").slice(0, 7000),
    config: {
      outputDimensionality: 768,
    },
  });

  const values = response.embeddings?.[0]?.values;

  if (!values || !Array.isArray(values)) {
    throw new Error("Could not create embedding from Gemini.");
  }

  return values;
}

/**
 * Convert embedding array to pgvector string format.
 *
 * Example:
 * [0.1, 0.2, 0.3]
 *
 * Supabase/PostgREST usually handles pgvector better as a string literal.
 */
function toVectorLiteral(values) {
  if (!Array.isArray(values)) {
    throw new Error("Embedding values must be an array.");
  }

  return `[${values.join(",")}]`;
}

/**
 * Answer a question using retrieved document chunks.
 */
async function answerWithContext(question, chunks) {
  const context = chunks
    .map((chunk, index) => {
      return `[Chunk ${index + 1}, database chunk_index: ${chunk.chunk_index}, similarity: ${chunk.similarity}]
${chunk.content}`;
    })
    .join("\n\n");

  const prompt = `
You are StudyHub Assistant.

Answer the student's question using ONLY the document context below.

Rules:
- If the answer is not in the context, say: "I cannot find this in the uploaded document."
- Give a clear student-friendly answer.
- Mention which chunk numbers support the answer.
- Do not invent facts outside the document.

Question:
${question}

Document context:
${context}
`;

  return generateText(prompt);
}

/**
 * Generate flashcards from document chunks.
 */
async function generateFlashcardsFromChunks(chunks) {
  const content = chunks
    .map((chunk) => chunk.content)
    .join("\n\n")
    .slice(0, 12000);

  const prompt = `
Create study flashcards from the document content.

Return JSON array only in this exact format:
[
  {
    "question": "short question",
    "answer": "short answer"
  }
]

Rules:
- Make 5 to 10 flashcards.
- Keep answers short.
- Use only the document content.
- Do not invent information.

Document content:
${content}
`;

  const resultText = await generateText(prompt);
  const cards = extractJson(resultText);

  if (!Array.isArray(cards)) {
    throw new Error("AI flashcard result must be a JSON array.");
  }

  return cards
    .filter((card) => card.question && card.answer)
    .map((card) => ({
      question: String(card.question).trim(),
      answer: String(card.answer).trim(),
    }));
}

// src/services/aiService.js

async function generateTagsAndName(extractedText, originalName) {
  // Only take the first ~1000 characters to save tokens
  const sampleText = String(extractedText || "").substring(0, 1000);

  const prompt = `You are a document classification system. 
  Original filename: "${originalName}"
  Extracted content: "${sampleText}"
  
  Tasks:
  1. Suggest 1-3 tags describing the content (nouns, e.g. #math, #grade12).
  2. Check if the original filename has spelling errors or incorrect subject naming. If incorrect, suggest a new name and a short notice message. If correct, leave empty.
  
  MUST return strictly in the following JSON format, with no extra text:
  {
    "tags": ["#tag1", "#tag2"],
    "suggestedName": "Standard name (if change needed)",
    "message": "Notice message (e.g., The file is about math but named physics, would you like to rename it to math.pdf?)"
  }`;

  try {
    const resultText = await generateText(prompt);
    const result = extractJson(resultText);
    return {
      tags: Array.isArray(result.tags) ? result.tags : [],
      suggestedName: result.suggestedName || "",
      message: result.message || ""
    };
  } catch (error) {
    console.error("Error in generateTagsAndName with Gemini:", error);
    return {
      tags: [],
      suggestedName: "",
      message: ""
    };
  }
}

function isWholeWordPresent(text, word) {
  const esc = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const boundaryChars = "a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";
  const regex = new RegExp(`(?<=^|[^${boundaryChars}])${esc}(?=$|[^${boundaryChars}])`, "i");
  return regex.test(text);
}

async function checkSensitiveContent(text) {
  const sampleText = String(text || "").substring(0, 8000);

  const prompt = `You are an automated content moderation system for an academic learning environment. 
Read the document text below and list EXACTLY the profane or violating words/phrases (e.g. 'stupid' or 'stupid, damn').

Document text:
"${sampleText}"

MUST return strictly in the following JSON format, with no explanation outside the JSON:
{
  "classification": "SEVERE" (if extremely profane, sexually explicit, or severely offensive) or "MILD" (if mild profanity or mild slang) or "NONE" (if clean/normal document),
  "word": "list only the violating words separated by commas (e.g., 'stupid'). IF NO PROFANITY, RETURN NULL",
  "suspicious_text": "write exact violating words only (e.g., 'stupid'), ABSOLUTELY DO NOT WRITE FULL SENTENCES"
}`;

  try {
    const resultText = await generateText(prompt);
    const result = extractJson(resultText);
    const extractedWords = result.word || result.suspicious_text || null;
    return {
      classification: ["SEVERE", "MILD", "NONE"].includes(result.classification) ? result.classification : "NONE",
      word: extractedWords,
      suspicious_text: extractedWords
    };
  } catch (error) {
    console.error("AI checkSensitiveContent error:", error);
    return { classification: "NONE", word: null, suspicious_text: null };
  }
}

async function validateTagsAndContent(
  extractedText,
  originalName,
  userTags,
  options = {},
) {
  const sampleText = String(extractedText || "").substring(0, 5000);

  const prompt = `You are a content moderation and hashtag suggestion system for student study materials.
Original filename: "${originalName}"
Document content (first 5000 chars):
"${sampleText}"

User input hashtags: ${JSON.stringify(userTags)}

Your tasks:
1. For EACH hashtag in the user list, check:
   - Does it have spelling errors? Note: Since it is a hashtag, users may write without spaces or use CamelCase (e.g., "SoftwareTesting", "softwaretesting"). This is standard hashtag format and should not be marked invalid. Analyze constituent words to check for actual misspellings.
   - Does it accurately reflect the content/topic of the document?
   - Format: Starts with # and no spaces (e.g. #SoftwareTesting). If user entered without #, consider it valid (isValid = true) if spelling/topic are correct, but format it with # in "recommendedReplacement".
   - Language: Prefer English for hashtags for consistency.
   
2. Suggest 3-5 additional relevant hashtags based on the document content (always starting with #, no spaces, written in English).

IMPORTANT: Every value in the "reason" field MUST be written entirely in English. Do not return Vietnamese text in "reason".

MUST return strictly in the following JSON format, with no extra explanation outside JSON:
{
  "tagValidations": [
    {
      "tag": "tag_name_being_checked",
      "isValid": true or false,
      "recommendedReplacement": "#suggested_replacement_tag",
      "reason": "An English explanation of why the tag should be replaced; otherwise leave this empty"
    }
  ],
  "aiRecommendedTags": ["#recommendation1", "#recommendation2", "#recommendation3"]
}
`;

  try {
    const responseText = await generateText(prompt);
    const result = extractJson(responseText);

    const tagValidations = (result.tagValidations || []).map(v => ({
      tag: v.tag || "",
      isValid: typeof v.isValid === "boolean" ? v.isValid : true,
      recommendedReplacement: v.recommendedReplacement || v.tag || "",
      reason: v.reason || ""
    }));

    const isValid = tagValidations.every(v => v.isValid === true);

    const aiRecommendedTags = Array.isArray(result.aiRecommendedTags) 
      ? result.aiRecommendedTags 
      : [];

    return {
      isValid,
      tagValidations,
      aiRecommendedTags
    };
  } catch (error) {
    console.error("Error in validateTagsAndContent with Gemini:", error);
    if (options.throwOnError) {
      throw error;
    }

    return {
      isValid: true,
      tagValidations: userTags.map(t => ({
        tag: t,
        isValid: true,
        recommendedReplacement: t,
        reason: ""
      })),
      aiRecommendedTags: []
    };
  }
}

module.exports = {
  moderateDocument,
  createEmbedding,
  toVectorLiteral,
  answerWithContext,
  generateFlashcardsFromChunks,
  generateTagsAndName,
  checkSensitiveContent,
  validateTagsAndContent,
};

