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

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "";
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

async function validateTagsAndContent(extractedText, fileName, userTags) {
  // Chỉ lấy khoảng 3000 ký tự đầu tiên để tiết kiệm token
  const sampleText = String(extractedText || "").substring(0, 3000);

  const prompt = `Bạn là hệ thống phân loại và kiểm định tài liệu học tập của AI StudyHub.
  Tên file: "${fileName}"
  Nội dung trích xuất: "${sampleText}"
  
  Hashtags người dùng muốn gán cho tài liệu: ${JSON.stringify(userTags)}
  
  Nhiệm vụ:
  1. Gợi ý 1-3 tags phù hợp cho tài liệu này (định dạng dạng hashtag danh từ bắt đầu bằng dấu #, chữ thường, không khoảng trắng, ví dụ: #grade12, #school, #university, #math, #programming).
  2. Kiểm định từng hashtag do người dùng gán:
     - Đánh giá xem hashtag đó có mô tả chính xác nội dung tài liệu không. Ví dụ: tài liệu về Toán (Math) nhưng người dùng đặt là #physic thì là sai/không chính xác.
     - Đánh giá xem độ phức tạp có hợp lý không. Ví dụ: bài tập toán tiểu học đơn giản (phép cộng, nhân) nhưng người dùng đặt tag là #university thì là không hợp lý (nên là #elementary hoặc #grade1).
     - Với mỗi hashtag của người dùng, xác định xem có hợp lệ (isValid: true) hay không (isValid: false). Nếu không hợp lệ (isValid: false), hãy đề xuất hashtag thay thế phù hợp và viết lý do giải thích ngắn gọn bằng tiếng Việt.
  
  BẮT BUỘC trả về ĐÚNG định dạng JSON sau, không chứa bất kỳ text nào khác:
  {
    "isValid": true,
    "aiRecommendedTags": ["#math", "#grade12"],
    "tagValidations": [
      {
        "tag": "#user_tag_1",
        "isValid": true,
        "recommendedReplacement": "#correct_tag",
        "reason": "Lý do tại sao sai và giải thích ngắn gọn bằng tiếng Việt"
      }
    ]
  }`;

  const responseText = await generateText(prompt);
  return extractJson(responseText);
}

function checkSensitiveContent(text) {
  const lower = String(text || "").toLowerCase();
  
  // Severe words (immediate deletion)
  const severePhrases = ["địt mẹ", "địt cụ", "hãm lồn", "motherfucker"];
  const severeWords = ["fuck", "địt", "đéo", "cặc", "lồn", "bitch", "asshole"];
  
  // Mild words (flagged for admin review)
  const mildPhrases = ["ngu ngốc", "đồ ngu"];
  const mildWords = ["stupid", "noob", "dốt"];
  
  // 1. Check severe phrases
  for (const phrase of severePhrases) {
    if (lower.includes(phrase)) {
      return { classification: "SEVERE", word: phrase };
    }
  }
  
  // 2. Check mild phrases
  for (const phrase of mildPhrases) {
    if (lower.includes(phrase)) {
      return { classification: "MILD", word: phrase };
    }
  }
  
  // 3. Check exact words for singles (avoiding false positives like "nguyên" or "nguồn")
  const words = lower.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, " ").split(/\s+/);
  const wordSet = new Set(words);
  
  for (const word of severeWords) {
    if (wordSet.has(word)) {
      return { classification: "SEVERE", word };
    }
  }
  
  for (const word of mildWords) {
    if (wordSet.has(word)) {
      return { classification: "MILD", word };
    }
  }
  
  if (wordSet.has("ngu")) {
    return { classification: "MILD", word: "ngu" };
  }
  
  return { classification: "CLEAN" };
}

module.exports = {
  moderateDocument,
  createEmbedding,
  toVectorLiteral,
  answerWithContext,
  generateFlashcardsFromChunks,
  validateTagsAndContent,
  checkSensitiveContent,
};

