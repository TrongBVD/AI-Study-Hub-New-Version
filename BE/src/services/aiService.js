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
      "gemini-2.0-flash-lite,gemini-1.5-flash,gemini-1.5-pro",
  )
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const modelCandidates = [
    process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
    ...configuredFallbackModels,
  ].filter((model, index, models) => models.indexOf(model) === index);
  let lastError;

  for (const model of modelCandidates) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      return response.text || "";
    } catch (error) {
      lastError = error;
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

  throw lastError || new Error("No Gemini text model is available.");
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
  // Chỉ lấy khoảng 1000 ký tự đầu tiên để tiết kiệm token
  const sampleText = String(extractedText || "").substring(0, 1000);

  const prompt = `Bạn là hệ thống phân loại tài liệu. 
  Tên file gốc: "${originalName}"
  Nội dung trích xuất: "${sampleText}"
  
  Nhiệm vụ:
  1. Gợi ý 1-3 tags mô tả nội dung (dạng danh từ, ví dụ: #math, #grade12).
  2. Kiểm tra tên file gốc có sai chính tả hoặc sai nội dung không. Nếu sai, hãy gợi ý tên mới và viết 1 câu thông báo ngắn. Nếu đúng, để rỗng.
  
  BẮT BUỘC trả về ĐÚNG định dạng JSON sau, không có text nào khác:
  {
    "tags": ["#tag1", "#tag2"],
    "suggestedName": "Tên chuẩn (nếu cần đổi)",
    "message": "Thông báo (ví dụ: File về toán học nhưng đặt tên physic, bạn có muốn đổi thành math.pdf không?)"
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
    console.error("Lỗi khi generateTagsAndName với Gemini:", error);
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

  const prompt = `Bạn là hệ thống kiểm duyệt nội dung tự động cho môi trường học tập. 
Hãy đọc đoạn văn bản tài liệu dưới đây và chỉ liệt kê CHÍNH XÁC các từ hoặc cụm từ tục tĩu/vi phạm (ví dụ: 'stupid' hoặc 'stupid, damn').

Văn bản tài liệu:
"${sampleText}"

BẮT BUỘC trả về ĐÚNG định dạng JSON sau, không kèm bất kỳ giải thích nào khác ngoài JSON:
{
  "classification": "SEVERE" (nếu cực kỳ thô tục, dâm ô, xúc phạm nặng) hoặc "MILD" (nếu có từ chửi tục nhẹ hoặc từ lóng không phù hợp nhẹ) hoặc "NONE" (nếu tài liệu sạch sẽ, bình thường),
  "word": "chỉ liệt kê từ hoặc các từ vi phạm phân cách bằng dấu phẩy (ví dụ: 'stupid'). NẾU KHÔNG CÓ TỪ TỤC THÌ ĐỂ NULL",
  "suspicious_text": "chỉ ghi đúng từ vi phạm (ví dụ: 'stupid'), TUỆT ĐỐI KHÔNG GHI CẢ CÂU VĂN"
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
    console.error("Lỗi AI checkSensitiveContent:", error);
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

  const prompt = `Bạn là hệ thống kiểm duyệt và gợi ý hashtag cho tài liệu học tập của sinh viên.
Tên file gốc: "${originalName}"
Nội dung trích xuất của file (mẫu 5000 ký tự đầu):
"${sampleText}"

Danh sách hashtags người dùng nhập vào: ${JSON.stringify(userTags)}

Nhiệm vụ của bạn:
1. Đối với MỖI hashtag trong danh sách trên, hãy kiểm tra:
   - Nó có sai chính tả tiếng Việt hoặc tiếng Anh không? Lưu ý quan trọng: Vì là hashtag nên người dùng có thể viết liền không dấu hoặc viết hoa chữ cái đầu từ (ví dụ: "SoftwareTesting", "softwaretesting", "onthihocky"). Đây là định dạng bình thường của hashtag, không được báo là sai chính tả. Hãy phân tích các từ đơn cấu thành để kiểm tra xem có sai chính tả thực tế không.
   - Nó có phản ánh đúng và chính xác nội dung/chủ đề của tài liệu không?
   - Định dạng của hashtag: Bắt đầu bằng dấu # và viết liền (không có khoảng trắng, ví dụ: #SoftwareTesting). Nếu người dùng nhập không có dấu # (ví dụ: "Software Testing" hoặc "SoftwareTesting"), hãy xem xét nó vẫn là hợp lệ (isValid = true) nếu đúng chính tả và chủ đề, nhưng trong phần "recommendedReplacement" bạn hãy định dạng lại nó thành chuẩn hashtag có dấu # và viết liền (ví dụ: "#SoftwareTesting").
   - Ngôn ngữ của hashtag: Ưu tiên sử dụng tiếng Anh cho các hashtag để đồng bộ hệ thống. Nếu người dùng nhập hashtag bằng tiếng Việt (ví dụ: "lichsu", "toanhoc"), bạn VẪN coi là hợp lệ (isValid = true, KHÔNG được đánh dấu false để chặn upload), nhưng trong phần "recommendedReplacement" bạn hãy dịch và gợi ý tag tương đương bằng tiếng Anh (ví dụ: "#history", "#mathematics") và ghi chú vào phần "reason" khuyên họ nên đổi sang tiếng Anh (ví dụ: "Bạn nên dùng tiếng Anh cho hashtag (#history) thay vì tiếng Việt (#lichsu) để đồng bộ.").
   
2. Gợi ý thêm 3-5 hashtags liên quan nhất dựa trên nội dung tài liệu (luôn bắt đầu bằng dấu #, viết liền và viết bằng tiếng Anh).

IMPORTANT: Every value in the "reason" field MUST be written entirely in English. Do not return Vietnamese text in "reason".

BẮT BUỘC trả về ĐÚNG định dạng JSON sau, không kèm bất kỳ đoạn văn bản giải thích nào khác ngoài JSON:
{
  "tagValidations": [
    {
      "tag": "tên_tag_đang_kiểm_tra",
      "isValid": true hoặc false,
      "recommendedReplacement": "#tag_gợi_ý_thay_thế_nếu_sai_hoặc_không_phù_hợp_hoặc_cần_thêm_dấu_thăng_và_viết_liền_hoặc_dịch_sang_tiếng_anh",
      "reason": "An English explanation of why the tag should be replaced; otherwise leave this empty"
    }
  ],
  "aiRecommendedTags": ["#goiy1", "#goiy2", "#goiy3"]
}

Ví dụ: Nếu người dùng nhập ["Software Testing", "lichsu12"] mà file nói về lịch sử Việt Nam lớp 12:
- "Software Testing" sẽ có isValid = false, recommendedReplacement = "#vietnamhistory", reason = "This software-related hashtag is not relevant to the document about Vietnamese history."
- "lichsu12" sẽ có isValid = true, recommendedReplacement = "#lichsu12", reason = ""
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
    console.error("Lỗi khi validateTagsAndContent với Gemini:", error);
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

