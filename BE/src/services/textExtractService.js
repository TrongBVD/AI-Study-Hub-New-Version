const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const MAX_DOCUMENT_CHUNKS = 500;
/**
 * Extract readable text from an uploaded file.
 *
 * This function expects Multer memoryStorage,
 * meaning uploaded file must have file.buffer.
 */
async function extractTextFromFile(file) {
  if (!file) {
    throw new Error("Missing uploaded file.");
  }

  if (!file.buffer) {
    throw new Error(
      "Missing file buffer. Please make sure multer is using memoryStorage."
    );
  }

  const mimeType = file.mimetype;
  const originalName = file.originalname || "";

  // PDF
  if (
    mimeType === "application/pdf" ||
    originalName.toLowerCase().endsWith(".pdf")
  ) {
    const result = await pdfParse(file.buffer);
    return cleanExtractedText(result.text || "");
  }

  // DOCX
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    originalName.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({
      buffer: file.buffer,
    });

    return cleanExtractedText(result.value || "");
  }

  // TXT
  if (
    mimeType === "text/plain" ||
    originalName.toLowerCase().endsWith(".txt")
  ) {
    return cleanExtractedText(file.buffer.toString("utf-8"));
  }

  throw new Error(
    "Unsupported file type for text extraction. Only PDF, DOCX, and TXT are supported."
  );
}

/**
 * Clean extracted text by normalizing whitespace.
 * This helps improve text quality for AI processing.
 */
function cleanExtractedText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")       // strip null bytes – PostgreSQL rejects \u0000 (error 22P05)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Split text into chunks with overlap.
 */
function splitTextIntoChunks(text, chunkSize = 1200, overlap = 150) {
  const cleanText = cleanExtractedText(text).replace(/\s+/g, " ");

  if (!cleanText) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (
    start < cleanText.length &&
    chunks.length < MAX_DOCUMENT_CHUNKS
  ) {
    const end = Math.min(start + chunkSize, cleanText.length);
    const chunk = cleanText.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start += chunkSize - overlap;
  }

  return chunks;
}

module.exports = {
  extractTextFromFile,
  splitTextIntoChunks,
};