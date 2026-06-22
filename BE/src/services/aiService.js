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

exports.generateTagsAndName = async (extractedText, originalName) => {
  // Chỉ lấy khoảng 1000 ký tự đầu tiên để tiết kiệm token
  const sampleText = extractedText.substring(0, 1000);

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

  // Giả mã gọi API OpenAI/Gemini (Cần thay bằng hàm gọi API thực tế của dự án)
  // const response = await llmClient.generateText(prompt);
  // const parsedJSON = JSON.parse(response);
  
  // Trả về mock data cho ví dụ
  return {
    tags: ["#university", "#software"],
    suggestedName: "", 
    message: ""
  };
};


module.exports = {
  moderateDocument,
  createEmbedding,
  toVectorLiteral,
  answerWithContext,
  generateFlashcardsFromChunks,
};

