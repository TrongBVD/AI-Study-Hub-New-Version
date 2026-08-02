const supabase = require("../../config/supabase");
const { canAccessDocument } = require("../../services/documentAccessService");
const {
  extractTextFromFile,
  splitTextIntoChunks,
} = require("../../services/textExtractService");
const {
  createBatchEmbeddings,
  toVectorLiteral,
} = require("../../services/aiService");

async function ensureDocumentChunks(document) {
  try {
    const { data: existingChunks, error: selectError } = await supabase
      .from("document_chunks")
      .select("chunk_index, content")
      .eq("document_id", document.id)
      .order("chunk_index", { ascending: true });

    if (!selectError && existingChunks && existingChunks.length > 0) {
      return existingChunks;
    }

    if (!document || !document.file_url) {
      return [];
    }

    const bucket = document.status === "FLAGGED" ? "document_waiting_admin" : "documents";
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(document.file_url);

    if (downloadError || !fileBlob) {
      console.error("Auto-repair chunks download error:", downloadError);
      return [];
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const extractedText = await extractTextFromFile({
      buffer,
      originalname: document.title,
      mimetype: document.title?.endsWith(".pdf")
        ? "application/pdf"
        : document.title?.endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "text/plain",
    });

    const chunks = splitTextIntoChunks(extractedText);
    if (chunks.length === 0) {
      return [];
    }

    const embeddings = await createBatchEmbeddings(chunks, "document");
    const chunkRows = chunks.map((chunk, index) => ({
      document_id: document.id,
      chunk_index: index,
      content: chunk,
      embedding: toVectorLiteral(embeddings[index]),
    }));

    await supabase.from("document_chunks").delete().eq("document_id", document.id);
    const { error: insertError } = await supabase.from("document_chunks").insert(chunkRows);

    if (insertError) {
      console.error("Auto-repair insert chunks error:", insertError);
      return [];
    }

    return chunkRows.map((r) => ({ chunk_index: r.chunk_index, content: r.content }));
  } catch (err) {
    console.error("ensureDocumentChunks error:", err);
    return [];
  }
}

function getVietnamDayRange() {
  const now = new Date();
  const vietnamNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const startUtcMs =
    Date.UTC(
      vietnamNow.getUTCFullYear(),
      vietnamNow.getUTCMonth(),
      vietnamNow.getUTCDate(),
    ) -
    7 * 60 * 60 * 1000;

  return {
    start: new Date(startUtcMs).toISOString(),
    end: new Date(startUtcMs + 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function getFlashcardsCreatedToday(userId) {
  const { start, end } = getVietnamDayRange();
  const { data, error } = await supabase
    .from("activity_logs")
    .select("new_data")
    .eq("user_id", userId)
    .eq("action_type", "FLASHCARDS_GENERATED")
    .gte("created_at", start)
    .lt("created_at", end);

  if (error) throw error;

  return (data || []).reduce(
    (total, item) => total + Math.max(0, Number(item.new_data?.cardCount || 0)),
    0,
  );
}

async function getAllowedDocument(documentId, userId) {
  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!document) return null;

  if (!(await canAccessDocument(document, userId))) {
    return "FORBIDDEN";
  }

  return document;
}

async function increaseChatUsage(userId) {
  if (userId === "guest") {
    return;
  }
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing, error: selectError } = await supabase
    .from("ai_usage_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing && existing.chat_count >= 20) {
    const error = new Error("Daily AI chatbot quota exceeded.");
    error.statusCode = 429;
    throw error;
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from("ai_usage_logs")
      .update({ chat_count: existing.chat_count + 1 })
      .eq("id", existing.id);

    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase.from("ai_usage_logs").insert({
    user_id: userId,
    usage_date: today,
    chat_count: 1,
    tokens_consumed: 0,
  });

  if (insertError) throw insertError;
}

function isGuestUser(user) {
  return user?.id === "guest" || user?.id === "00000000-0000-0000-0000-000000000000" || user?.role === "GUEST";
}

async function saveChatHistory({ userId, documentId, question, answer }) {
  const { data: conversation, error: conversationError } = await supabase
    .from("chat_conversations")
    .insert({
      user_id: userId,
      document_id: documentId,
      title: question.trim().slice(0, 120),
    })
    .select("id, document_id, title, created_at")
    .single();

  if (conversationError) throw conversationError;

  const { data: messages, error: messagesError } = await supabase
    .from("chat_messages")
    .insert([
      { conversation_id: conversation.id, role: "user", content: question.trim() },
      { conversation_id: conversation.id, role: "ai", content: answer },
    ])
    .select("id, role, content, created_at");

  if (messagesError) {
    await supabase.from("chat_conversations").delete().eq("id", conversation.id);
    throw messagesError;
  }

  return {
    conversationId: conversation.id,
    documentId: conversation.document_id,
    title: conversation.title,
    messages: messages || [],
  };
}

module.exports = {
  ensureDocumentChunks,
  getVietnamDayRange,
  getFlashcardsCreatedToday,
  getAllowedDocument,
  increaseChatUsage,
  isGuestUser,
  saveChatHistory,
};
