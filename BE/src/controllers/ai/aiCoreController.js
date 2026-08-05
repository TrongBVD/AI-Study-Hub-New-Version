const crypto = require("crypto");
const supabase = require("../../config/supabase");
const { createActivityLog } = require("../../services/activityLogService");
const { canAccessDocument } = require("../../services/documentAccessService");
const { mapWithConcurrency } = require("../../utils/asyncUtils");
const {
  extractTextFromFile,
  splitTextIntoChunks,
} = require("../../services/textExtractService");

const DAILY_AI_REQUEST_LIMIT = 30;
const MAX_CHAT_QUESTION_LENGTH = 2000;
const MAX_CHAT_HISTORY_TITLE_LENGTH = 120;
const MAX_SELECTED_CHAT_DOCUMENTS = 25;
const MAX_LIBRARY_RAG_DOCUMENTS = 100;
const RAG_RETRIEVAL_CONCURRENCY = 4;
const MAX_RAG_CONTEXT_CHUNKS = 120;
const MAX_FLASHCARD_SOURCE_CHUNKS = 120;
const MAX_GENERATED_FLASHCARDS = 20;
const MAX_FLASHCARD_DOCUMENTS = 5;
const USER_LIBRARY_STORAGE_LIMIT_BYTES = 50 * 1024 * 1024;
const MAX_METADATA_DOCUMENT_DETAILS = 500;

const {
  createEmbedding,
  createBatchEmbeddings,
  toVectorLiteral,
  answerWithContext,
  answerGeneralQuestion,
  classifyChatQuestion,
  answerMetadataWithContext,
  generateFlashcardsFromChunks,
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

    const chunkRows = chunks.map((chunk, index) => ({
      document_id: document.id,
      chunk_index: index,
      content: chunk,
      embedding: null,
    }));

    await supabase.from("document_chunks").delete().eq("document_id", document.id);
    const { error: insertError } = await supabase.from("document_chunks").insert(chunkRows);

    if (insertError) {
      console.error("Auto-repair insert chunks error:", insertError);
      return [];
    }

    const embeddings = await createBatchEmbeddings(chunks, "document");
    const embeddingUpdates = embeddings
      .map((embedding, index) => ({ embedding, index }))
      .filter(({ embedding }) => Array.isArray(embedding));

    await mapWithConcurrency(
      embeddingUpdates,
      RAG_RETRIEVAL_CONCURRENCY,
      async ({ embedding, index }) => {
        const { error: updateError } = await supabase
          .from("document_chunks")
          .update({ embedding: toVectorLiteral(embedding) })
          .eq("document_id", document.id)
          .eq("chunk_index", index);
        if (updateError) {
          console.warn(
            `Auto-repair embedding update failed for document ${document.id}, chunk ${index}:`,
            updateError.message,
          );
        }
      },
    );

    return chunkRows.map((r) => ({ chunk_index: r.chunk_index, content: r.content }));
  } catch (err) {
    console.error("ensureDocumentChunks error:", err);
    return [];
  }
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

function normalizeChatScope(body = {}) {
  const requestedScope = String(body.scope || "").trim().toUpperCase();
  if (["SELECTED", "LIBRARY"].includes(requestedScope)) {
    return requestedScope;
  }
  return "SELECTED";
}

function uniqueDocumentIds(documentIds) {
  return [...new Set(
    (documentIds || [])
      .filter((id) => id !== null && id !== undefined)
      .map(String)
      .map((id) => id.trim())
      .filter(Boolean),
  )];
}

async function getAccessibleLibraryDocuments(libraryId, userId) {
  const { data: documents, error } = await supabase
    .from("documents")
    .select("*")
    .eq("library_id", libraryId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const accessResults = await mapWithConcurrency(
    documents || [],
    RAG_RETRIEVAL_CONCURRENCY,
    async (document) => ((await canAccessDocument(document, userId)) ? document : null),
  );
  return accessResults.filter(Boolean);
}

async function getAccessibleLibraryMetadata(libraryId, userId) {
  const { data: library, error } = await supabase
    .from("libraries")
    .select("id, user_id, name, created_at, is_public")
    .eq("id", libraryId)
    .maybeSingle();
  if (error) throw error;
  const canAccessLibrary =
    library &&
    (String(library.user_id) === String(userId) || library.is_public === true);

  if (!canAccessLibrary) {
    const notFoundError = new Error("Current library was not found or is unavailable to this account.");
    notFoundError.statusCode = 404;
    throw notFoundError;
  }
  return library;
}

async function getOwnedAccountMetadata(userId) {
  if (
    userId === "guest" ||
    userId === "00000000-0000-0000-0000-000000000000"
  ) {
    return { libraries: [], documents: [] };
  }

  const { data: libraries, error: librariesError } = await supabase
    .from("libraries")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (librariesError) throw librariesError;

  const libraryIds = (libraries || []).map((library) => library.id).filter(Boolean);
  if (libraryIds.length === 0) {
    return { libraries: libraries || [], documents: [] };
  }

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("*")
    .in("library_id", libraryIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (documentsError) throw documentsError;

  return {
    libraries: libraries || [],
    documents: documents || [],
  };
}

async function getLibrariesForDocuments(documents) {
  const libraryIds = [...new Set(
    (documents || [])
      .map((document) => document.library_id)
      .filter(Boolean)
      .map(String),
  )];
  if (libraryIds.length === 0) return [];

  const { data, error } = await supabase
    .from("libraries")
    .select("id, name, created_at")
    .in("id", libraryIds);
  if (error) throw error;

  const librariesById = new Map(
    (data || []).map((library) => [String(library.id), library]),
  );
  return libraryIds.map(
    (libraryId) =>
      librariesById.get(libraryId) || {
        id: libraryId,
        name: "Unknown library",
        created_at: null,
      },
  );
}

async function resolveChatDocuments(body, userId) {
  const scope = normalizeChatScope(body);

  if (scope === "LIBRARY") {
    if (!body.libraryId) {
      const error = new Error("libraryId is required for library chat.");
      error.statusCode = 400;
      throw error;
    }
    const documents = await getAccessibleLibraryDocuments(body.libraryId, userId);
    if (documents.length === 0) {
      const error = new Error("Library not found, empty, or unavailable to this account.");
      error.statusCode = 404;
      throw error;
    }
    return { scope, documents, libraryId: body.libraryId };
  }

  const documentIds = uniqueDocumentIds(body.documentIds);

  if (documentIds.length === 0) {
    const error = new Error("Select at least one document.");
    error.statusCode = 400;
    throw error;
  }
  if (documentIds.length > MAX_SELECTED_CHAT_DOCUMENTS) {
    const error = new Error(`You can select up to ${MAX_SELECTED_CHAT_DOCUMENTS} documents per question.`);
    error.statusCode = 400;
    throw error;
  }

  const documents = await mapWithConcurrency(
    documentIds,
    RAG_RETRIEVAL_CONCURRENCY,
    (documentId) => getAllowedDocument(documentId, userId),
  );
  if (documents.some((document) => !document)) {
    const error = new Error("One or more documents were not found.");
    error.statusCode = 404;
    throw error;
  }
  if (documents.some((document) => document === "FORBIDDEN")) {
    const error = new Error("You do not have permission to access one or more selected documents.");
    error.statusCode = 403;
    throw error;
  }

  return { scope, documents, libraryId: documents[0]?.library_id || null };
}

function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** unitIndex)).toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function getDocumentType(title) {
  const match = String(title || "").match(/\.([a-z0-9]+)$/i);
  return (match?.[1] || "unknown").toLowerCase();
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = String(getKey(item) || "unknown");
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function toDocumentMetadata(document, libraryName) {
  const sizeBytes = Math.max(0, Number(document.file_size_bytes) || 0);
  return {
    title: document.title || "Untitled document",
    libraryName: libraryName || "Unknown library",
    fileType: getDocumentType(document.title),
    sizeBytes,
    size: formatBytes(sizeBytes),
    status: document.status || "UNKNOWN",
    uploadedAt: document.created_at || null,
  };
}

function buildMetadataSnapshot(scope, libraries, documents) {
  const safeLibraries = Array.isArray(libraries) ? libraries : [];
  const safeDocuments = Array.isArray(documents) ? documents : [];
  const libraryById = new Map(
    safeLibraries.map((library) => [String(library.id), library]),
  );
  const documentMetadata = safeDocuments.map((document) =>
    toDocumentMetadata(
      document,
      libraryById.get(String(document.library_id))?.name,
    ),
  );
  const totalBytes = documentMetadata.reduce(
    (total, document) => total + document.sizeBytes,
    0,
  );
  const documentsBySize = [...documentMetadata].sort(
    (left, right) => right.sizeBytes - left.sizeBytes,
  );
  const documentsByDate = [...documentMetadata].sort(
    (left, right) =>
      new Date(right.uploadedAt || 0).getTime() -
      new Date(left.uploadedAt || 0).getTime(),
  );

  const libraryMetadata = safeLibraries.map((library) => {
    const libraryDocuments = safeDocuments.filter(
      (document) => String(document.library_id) === String(library.id),
    );
    const libraryBytes = libraryDocuments.reduce(
      (total, document) =>
        total + Math.max(0, Number(document.file_size_bytes) || 0),
      0,
    );
    return {
      name: library.name || "Untitled library",
      createdAt: library.created_at || null,
      documentCount: libraryDocuments.length,
      totalBytes: libraryBytes,
      totalSize: formatBytes(libraryBytes),
      fileTypeCounts: countBy(libraryDocuments, (document) =>
        getDocumentType(document.title),
      ),
    };
  });

  return {
    scope,
    generatedAt: new Date().toISOString(),
    summary: {
      libraryCount: safeLibraries.length,
      documentCount: safeDocuments.length,
      totalBytes,
      totalSize: formatBytes(totalBytes),
      fileTypeCounts: countBy(documentMetadata, (document) => document.fileType),
      statusCounts: countBy(documentMetadata, (document) => document.status),
      largestDocument: documentsBySize[0] || null,
      smallestDocument: documentsBySize.at(-1) || null,
      newestDocument: documentsByDate[0] || null,
      oldestDocument: documentsByDate.at(-1) || null,
      ...(scope === "ACCOUNT"
        ? {
            storageLimitBytes: USER_LIBRARY_STORAGE_LIMIT_BYTES,
            storageLimit: formatBytes(USER_LIBRARY_STORAGE_LIMIT_BYTES),
            remainingStorageBytes: Math.max(
              0,
              USER_LIBRARY_STORAGE_LIMIT_BYTES - totalBytes,
            ),
            remainingStorage: formatBytes(
              Math.max(0, USER_LIBRARY_STORAGE_LIMIT_BYTES - totalBytes),
            ),
          }
        : {}),
    },
    libraries: libraryMetadata,
    documents: documentMetadata.slice(0, MAX_METADATA_DOCUMENT_DETAILS),
    documentDetailsTruncated:
      documentMetadata.length > MAX_METADATA_DOCUMENT_DETAILS,
  };
}

function selectRepresentativeChunks(chunks, limit) {
  const safeChunks = Array.isArray(chunks) ? chunks : [];
  if (safeChunks.length <= limit) return safeChunks;
  if (limit <= 1) return safeChunks.slice(0, 1);

  const selectedIndexes = new Set();
  for (let index = 0; index < limit; index += 1) {
    selectedIndexes.add(
      Math.round((index * (safeChunks.length - 1)) / (limit - 1)),
    );
  }
  return [...selectedIndexes].map((index) => safeChunks[index]);
}

async function retrieveChatChunks(question, documents, contentMode = "SEARCH") {
  if (contentMode === "OVERVIEW") {
    const perDocumentLimit = Math.max(
      1,
      Math.floor(MAX_RAG_CONTEXT_CHUNKS / Math.max(1, documents.length)),
    );
    const overviewChunks = await mapWithConcurrency(
      documents,
      RAG_RETRIEVAL_CONCURRENCY,
      async (document) =>
        selectRepresentativeChunks(
          await ensureDocumentChunks(document),
          perDocumentLimit,
        ).map((chunk) => ({
          ...chunk,
          similarity: 1,
          document_id: document.id,
          document_title: document.title || "Untitled document",
        })),
    );

    return overviewChunks.flat().slice(0, MAX_RAG_CONTEXT_CHUNKS);
  }

  let vectorLiteral = null;
  try {
    const questionEmbedding = await createEmbedding(question, "query");
    vectorLiteral = toVectorLiteral(questionEmbedding);
  } catch (embErr) {
    console.warn("[Chat RAG] Question embedding skipped/fallback:", embErr.message);
  }

  const chunksByDocument = await mapWithConcurrency(
    documents,
    RAG_RETRIEVAL_CONCURRENCY,
    async (document) => {
      let chunks = [];
      if (vectorLiteral) {
        try {
          const { data, error } = await supabase.rpc("match_document_chunks", {
            match_document_id: document.id,
            query_embedding: vectorLiteral,
            match_count: documents.length === 1 ? 20 : 10,
          });
          if (error) throw error;
          chunks = Array.isArray(data) ? data : [];
        } catch (error) {
          console.warn(`Could not retrieve vector chunks for document ${document.id}:`, error.message);
        }
      }

      if (chunks.length === 0) {
        chunks = (await ensureDocumentChunks(document)).slice(0, documents.length === 1 ? 20 : 10);
      }

      return chunks.map((chunk) => ({
        ...chunk,
        document_id: document.id,
        document_title: document.title || "Untitled document",
      }));
    },
  );

  return chunksByDocument
    .flat()
    .sort((left, right) => Number(right.similarity || 0) - Number(left.similarity || 0))
    .slice(0, MAX_RAG_CONTEXT_CHUNKS);
}

async function increaseChatUsage(userId) {
  if (
    userId === "guest" ||
    userId === "00000000-0000-0000-0000-000000000000"
  ) {
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

  if (existing && existing.chat_count >= DAILY_AI_REQUEST_LIMIT) {
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

async function ensureChatQuotaAvailable(userId) {
  if (
    userId === "guest" ||
    userId === "00000000-0000-0000-0000-000000000000"
  ) return;
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing, error } = await supabase
    .from("ai_usage_logs")
    .select("chat_count")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();

  if (error) throw error;
  if (Number(existing?.chat_count || 0) >= DAILY_AI_REQUEST_LIMIT) {
    const quotaError = new Error("Daily AI chatbot quota exceeded.");
    quotaError.statusCode = 429;
    throw quotaError;
  }
}

function isGuestUser(user) {
  return user?.id === "guest" || user?.id === "00000000-0000-0000-0000-000000000000" || user?.role === "GUEST";
}

function backendUsesPublishableSupabaseKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").startsWith(
    "sb_publishable_",
  );
}

async function saveChatHistory({
  userId,
  documentId,
  conversationId,
  question,
  answer,
}) {
  let conversation = null;
  let createdConversation = false;

  if (conversationId) {
    const { data, error } = await supabase
      .from("chat_conversations")
      .select("id, document_id, title, created_at")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    conversation = data || null;
  }

  if (!conversation) {
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({
        ...(conversationId ? { id: conversationId } : {}),
        user_id: userId,
        document_id: documentId,
        title: question.trim().slice(0, MAX_CHAT_HISTORY_TITLE_LENGTH),
      })
      .select("id, document_id, title, created_at")
      .single();

    if (error) throw error;
    conversation = data;
    createdConversation = true;
  }

  const now = Date.now();
  const userTime = new Date(now).toISOString();
  const aiTime = new Date(now + 10).toISOString();

  const { data: messages, error: messagesError } = await supabase
    .from("chat_messages")
    .insert([
      { conversation_id: conversation.id, role: "user", content: question.trim(), created_at: userTime },
      { conversation_id: conversation.id, role: "ai", content: answer, created_at: aiTime },
    ])
    .select("id, role, content, created_at");

  if (messagesError) {
    if (createdConversation) {
      await supabase.from("chat_conversations").delete().eq("id", conversation.id);
    }
    throw messagesError;
  }

  if (!createdConversation) {
    const { error: updateError } = await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id)
      .eq("user_id", userId);
    if (updateError) throw updateError;
  }

  return {
    conversationId: conversation.id,
    documentId: conversation.document_id,
    title: conversation.title,
    createdAt: conversation.created_at,
    messages: messages || [],
  };
}

exports.getChatHistory = async (req, res) => {
  try {
    if (isGuestUser(req.user)) {
      return res.status(200).json({ status: "success", data: [] });
    }

    const { data: conversations, error: conversationsError } = await supabase
      .from("chat_conversations")
      .select("id, document_id, title, created_at, updated_at")
      .eq("user_id", req.user.id)
      .order("updated_at", { ascending: false });
    if (conversationsError) throw conversationsError;

    const conversationIds = (conversations || []).map((conversation) => conversation.id);
    if (conversationIds.length === 0) {
      return res.status(200).json({ status: "success", data: [] });
    }

    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id, conversation_id, role, content, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true });
    if (messagesError) throw messagesError;

    const messagesByConversation = (messages || []).reduce((result, message) => {
      (result[message.conversation_id] ||= []).push({
        id: message.id,
        conversationId: message.conversation_id,
        role: message.role,
        text: message.content,
        createdAt: message.created_at,
      });
      return result;
    }, {});

    return res.status(200).json({
      status: "success",
      data: (conversations || []).map((conversation) => ({
        id: conversation.id,
        documentId: conversation.document_id,
        title: conversation.title,
        createdAt: conversation.created_at,
        messages: messagesByConversation[conversation.id] || [],
      })),
    });
  } catch (error) {
    console.error("getChatHistory error:", error);
    return res.status(500).json({ status: "error", message: "Could not load chat history." });
  }
};

exports.deleteChatHistoryItem = async (req, res) => {
  try {
    if (isGuestUser(req.user)) return res.status(204).send();

    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("id", req.params.conversationId)
      .eq("user_id", req.user.id);
    if (error) throw error;
    return res.status(204).send();
  } catch (error) {
    console.error("deleteChatHistoryItem error:", error);
    return res.status(500).json({ status: "error", message: "Could not delete chat history." });
  }
};

exports.clearChatHistory = async (req, res) => {
  try {
    if (isGuestUser(req.user)) return res.status(204).send();

    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("user_id", req.user.id);
    if (error) throw error;
    return res.status(204).send();
  } catch (error) {
    console.error("clearChatHistory error:", error);
    return res.status(500).json({ status: "error", message: "Could not clear chat history." });
  }
};

exports.getAiSummary = async (req, res) => {
  try {
    const chatLimit = DAILY_AI_REQUEST_LIMIT;

    if (req.user.id === "guest" || req.user.id === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(200).json({
        status: "success",
        data: {
          chatLimit,
          chatsUsed: 0,
          chatsRemaining: chatLimit,
          tokensConsumed: 0,
        },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: usage, error } = await supabase
      .from("ai_usage_logs")
      .select("chat_count, tokens_consumed")
      .eq("user_id", req.user.id)
      .eq("usage_date", today)
      .maybeSingle();

    if (error) throw error;

    const chatsUsed = Math.max(0, Number(usage?.chat_count || 0));
    return res.status(200).json({
      status: "success",
      data: {
        chatLimit: DAILY_AI_REQUEST_LIMIT,
        chatsUsed,
        chatsRemaining: Math.max(0, DAILY_AI_REQUEST_LIMIT - chatsUsed),
        tokensConsumed: Math.max(0, Number(usage?.tokens_consumed || 0)),
      },
    });
  } catch (error) {
    console.error("getAiSummary error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load AI usage summary.",
    });
  }
};

exports.chatWithDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { question } = req.body;
    // Keep older clients working while the UI migrates from one documentId to
    // the multi-document documentIds payload.
    const chatBody = {
      ...req.body,
      documentIds:
        uniqueDocumentIds(req.body.documentIds).length > 0
          ? req.body.documentIds
          : req.body.documentId
            ? [req.body.documentId]
            : [],
    };

    if (!question || !String(question).trim()) {
      return res.status(400).json({
        status: "error",
        message: "question is required.",
      });
    }
    if (String(question).trim().length > MAX_CHAT_QUESTION_LENGTH) {
      return res.status(400).json({
        status: "error",
        message: `Question must be ${MAX_CHAT_QUESTION_LENGTH.toLocaleString("en-US")} characters or fewer.`,
      });
    }

    const requestedMetadataScope = String(req.body.metadataScope || "").toUpperCase();
    const metadataWithoutDocumentsCandidate =
      normalizeChatScope(chatBody) === "SELECTED" &&
      uniqueDocumentIds(chatBody.documentIds).length === 0;
    let resolvedScope;
    let intentRoute;

    if (metadataWithoutDocumentsCandidate) {
      await ensureChatQuotaAvailable(userId);
      intentRoute = await classifyChatQuestion(question);
      resolvedScope = { scope: "SELECTED", documents: [], libraryId: null };
    } else {
      resolvedScope = await resolveChatDocuments(chatBody, userId);
      await ensureChatQuotaAvailable(userId);
      intentRoute = await classifyChatQuestion(question);
    }

    if (
      resolvedScope.documents.length === 0 &&
      ["CONTENT", "MIXED"].includes(intentRoute.intent)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Select at least one document for a content question.",
      });
    }

    const { scope, documents, libraryId } = resolvedScope;
    if (intentRoute.intent === "FLASHCARD") {
      const approvedDocuments = documents.filter(
        (document) => document.status === "APPROVED",
      );
      const canAutoGenerate =
        documents.length > 0 &&
        documents.length <= MAX_FLASHCARD_DOCUMENTS &&
        approvedDocuments.length === documents.length;

      return res.status(200).json({
        status: "success",
        data: {
          action: "OPEN_FLASHCARDS",
          intent: "FLASHCARD",
          question,
          documentId: canAutoGenerate ? documents[0].id : null,
          documentIds: documents.map((document) => document.id),
          libraryId,
          scope,
          autoGenerate: canAutoGenerate,
          usedAi: true,
          sources: [],
          chatHistory: null,
        },
      });
    }

    const isGeneralQuestion = intentRoute.intent === "GENERAL";
    const requiresDocumentContent = ["CONTENT", "MIXED"].includes(
      intentRoute.intent,
    );
    const unavailableDocuments = requiresDocumentContent
      ? documents.filter(
          (document) =>
            String(document.status || "").toUpperCase() !== "APPROVED",
        )
      : [];

    if (unavailableDocuments.length > 0) {
      return res.status(409).json({
        status: "error",
        code: "DOCUMENT_NOT_READY",
        message:
          "One or more selected documents are still being processed and cannot be used for AI Chat yet.",
      });
    }
    const shouldUseDetectedMetadataScope =
      requestedMetadataScope === "AUTO" ||
      !requestedMetadataScope;
    const effectiveMetadataScope = shouldUseDetectedMetadataScope
      ? intentRoute.metadataScope || "ACCOUNT"
      : requestedMetadataScope;
    let metadataDocuments = documents;
    let metadataLibraries = [];
    let metadataAnswerScope = "SELECTED";
    let accountMetadata = null;
    let currentLibraryMetadata = null;
    const needsMetadata = ["METADATA", "MIXED"].includes(intentRoute.intent);
    const wantsAccountMetadata =
      needsMetadata && effectiveMetadataScope === "ACCOUNT";
    const wantsLibraryMetadata =
      needsMetadata &&
      effectiveMetadataScope === "LIBRARY" &&
      !wantsAccountMetadata;

    if (wantsAccountMetadata) {
      accountMetadata = await getOwnedAccountMetadata(userId);
      metadataDocuments = accountMetadata.documents;
      metadataLibraries = accountMetadata.libraries;
      metadataAnswerScope = "ACCOUNT";
    } else if (wantsLibraryMetadata) {
      const documentLibraryIds = new Set(
        documents.map((document) => document.library_id).filter(Boolean).map(String),
      );
      const metadataLibraryId = req.body.currentLibraryId ||
        (documentLibraryIds.size === 1 ? libraryId : null);
      if (!metadataLibraryId) {
        return res.status(400).json({
          status: "error",
          message: "Select a library before asking about the current library.",
        });
      }
      currentLibraryMetadata = await getAccessibleLibraryMetadata(metadataLibraryId, userId);
      metadataDocuments = await getAccessibleLibraryDocuments(metadataLibraryId, userId);
      metadataLibraries = [currentLibraryMetadata];
      metadataAnswerScope = "LIBRARY";
    } else if (needsMetadata) {
      metadataLibraries = await getLibrariesForDocuments(metadataDocuments);
    }

    const isMetadataOnly = intentRoute.intent === "METADATA";
    const metadataSnapshot = needsMetadata
      ? buildMetadataSnapshot(
          metadataAnswerScope,
          metadataLibraries,
          metadataDocuments,
        )
      : null;
    const currentLibraryId = req.body.currentLibraryId || libraryId;
    const currentLibraryName = metadataLibraries.find(
      (library) => String(library.id) === String(currentLibraryId || ""),
    )?.name;
    if (metadataSnapshot) {
      metadataSnapshot.uiContext = {
        currentLibraryName: currentLibraryName || null,
        selectedDocumentCount: documents.length,
        selectedDocumentTitles: documents.map(
          (document) => document.title || "Untitled document",
        ),
      };
    }
    const ragDocuments = documents.filter((document) => document.status === "APPROVED");

    if (!isMetadataOnly && !isGeneralQuestion && ragDocuments.length > MAX_LIBRARY_RAG_DOCUMENTS) {
      return res.status(400).json({
        status: "error",
        message: `This library has too many documents for one content question. Select up to ${MAX_SELECTED_CHAT_DOCUMENTS} documents instead.`,
      });
    }

    const matchedChunks = isMetadataOnly || isGeneralQuestion || ragDocuments.length === 0
      ? []
      : await retrieveChatChunks(
          question,
          ragDocuments,
          intentRoute.contentMode,
        );

    if (
      requiresDocumentContent &&
      documents.length > 0 &&
      matchedChunks.length === 0
    ) {
      return res.status(409).json({
        status: "error",
        code: "DOCUMENT_NOT_READY",
        message:
          "The selected documents do not have readable AI content yet. Retry processing before asking a content question.",
      });
    }
    const groundedChunks = metadataSnapshot
      ? [
          {
            document_id: null,
            document_title: "StudyHub database metadata",
            chunk_index: -1,
            similarity: 1,
            content: `StudyHub metadata JSON:\n${JSON.stringify(metadataSnapshot)}`,
          },
          ...matchedChunks,
        ]
      : matchedChunks;
    const answer = isGeneralQuestion
      ? await answerGeneralQuestion(question)
      : isMetadataOnly
        ? await answerMetadataWithContext(question, metadataSnapshot)
        : await answerWithContext(question, groundedChunks);

    // The user may stop the response while the AI provider is still working.
    // Do not charge usage or persist a reply after the client disconnects.
    if (req.aborted || res.destroyed) return;

    await increaseChatUsage(userId);
    let chatHistory = null;
    const primaryDocumentId = documents[0]?.id || null;
    if (!isGuestUser(req.user)) {
      try {
        chatHistory = await saveChatHistory({
          userId,
          documentId: primaryDocumentId,
          conversationId: req.body.conversationId,
          question,
          answer,
        });
      } catch (historyError) {
        // Do not hide a valid AI answer if history persistence is temporarily unavailable.
        // The frontend retains a per-user cache so the user does not lose the answer.
        console.error("Could not save chat history:", historyError);
      }
    }

    return res.status(200).json({
      status: "success",
      data: {
        documentId: primaryDocumentId,
        documentIds: documents.map((document) => document.id),
        libraryId,
        scope,
        metadataScope: metadataSnapshot ? metadataAnswerScope : null,
        intent: intentRoute.intent,
        question,
        answer,
        usedAi: true,
        sources: matchedChunks.map((chunk) => ({
          document_id: chunk.document_id,
          document_title: chunk.document_title,
          chunk_index: chunk.chunk_index,
          similarity: chunk.similarity || 1,
        })),
        chatHistory,
      },
    });
  } catch (error) {
    console.error("chatWithDocument error:", error);

    return res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message || "Could not chat with document.",
    });
  }
};

exports.generateFlashcards = async (req, res) => {
  try {
    const userId = req.user.id;
    const legacyDocumentId = req.params.documentId;
    const requestedDocumentIds = uniqueDocumentIds([
      ...(Array.isArray(req.body?.documentIds) ? req.body.documentIds : []),
      ...(legacyDocumentId ? [legacyDocumentId] : []),
    ]);

    if (requestedDocumentIds.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Select at least one document for flashcard generation.",
      });
    }
    if (requestedDocumentIds.length > MAX_FLASHCARD_DOCUMENTS) {
      return res.status(400).json({
        status: "error",
        message: `Select up to ${MAX_FLASHCARD_DOCUMENTS} documents per flashcard set.`,
      });
    }

    const documents = [];
    for (const documentId of requestedDocumentIds) {
      const document = await getAllowedDocument(documentId, userId);
      if (!document) {
        return res.status(404).json({
          status: "error",
          message: "One of the selected documents was not found.",
        });
      }
      if (document === "FORBIDDEN") {
        return res.status(403).json({
          status: "error",
          message: "You do not have permission to access one of the selected documents.",
        });
      }
      if (document.status !== "APPROVED") {
        return res.status(400).json({
          status: "error",
          message: `"${document.title || "A selected document"}" is not approved or ready for flashcard generation.`,
        });
      }
      documents.push(document);
    }

    if (backendUsesPublishableSupabaseKey()) {
      return res.status(503).json({
        status: "error",
        code: "SUPABASE_SERVICE_ROLE_REQUIRED",
        message:
          "Flashcard storage is unavailable because the backend Supabase service-role key is not configured.",
      });
    }

    await ensureChatQuotaAvailable(userId);

    const chunksPerDocument = Math.max(
      1,
      Math.floor(MAX_FLASHCARD_SOURCE_CHUNKS / documents.length),
    );
    const chunkGroups = [];
    for (const document of documents) {
      let documentChunks = (await ensureDocumentChunks(document)) || [];
      if (!Array.isArray(documentChunks)) documentChunks = [];
      documentChunks = documentChunks.slice(0, chunksPerDocument);
      if (documentChunks.length === 0) {
        return res.status(400).json({
          status: "error",
          message: `No readable content was found for "${document.title || "a selected document"}". Re-upload or re-process it.`,
        });
      }
      chunkGroups.push({
        document,
        chunks: documentChunks.map((chunk) => ({
          ...chunk,
          content: `[Source: ${document.title || "Untitled document"}]\n${chunk.content}`,
        })),
      });
    }

    // Interleave sources so the global context character cap cannot be consumed
    // by the first document before later selected documents are included.
    const chunks = [];
    const longestGroup = Math.max(...chunkGroups.map((group) => group.chunks.length));
    for (let index = 0; index < longestGroup; index += 1) {
      for (const group of chunkGroups) {
        if (group.chunks[index]) chunks.push(group.chunks[index]);
      }
    }

    const generatedCards = await generateFlashcardsFromChunks(chunks, {
      sources: chunkGroups.map(({ document, chunks: sourceChunks }) => ({
        title: document.title || "Untitled document",
        chunkCount: sourceChunks.length,
      })),
      targetCardCount: MAX_GENERATED_FLASHCARDS,
    });
    const cards = generatedCards.slice(0, MAX_GENERATED_FLASHCARDS);

    if (cards.length === 0) {
      return res.status(422).json({
        status: "error",
        message: "AI could not create flashcards from the selected documents.",
      });
    }

    const primaryDocument = documents[0];
    const primaryDocumentId = primaryDocument.id;
    const workspaceIds = new Set(
      documents.map((document) => document.workspace_id).filter(Boolean),
    );
    const sharedWorkspaceId = workspaceIds.size === 1
      ? [...workspaceIds][0]
      : null;
    const setTitle = documents.length === 1
      ? primaryDocument.title || "AI Flashcards"
      : `Combined flashcards (${documents.length} sources)`;

    const flashcardSet = {
      id: crypto.randomUUID(),
      document_id: primaryDocumentId,
      workspace_id: sharedWorkspaceId,
      creator_id: userId,
      title: setTitle,
      created_at: new Date().toISOString(),
    };

    const { error: setInsertError } = await supabase
      .from("flashcard_sets")
      .insert(flashcardSet);
    if (setInsertError) throw setInsertError;


    const rows = cards.map((card) => ({
      set_id: flashcardSet.id,
      document_id: primaryDocumentId,
      workspace_id: sharedWorkspaceId,
      creator_id: userId,
      question: card.question,
      answer: card.answer,
    }));

    const result = await supabase
      .from("flashcards")
      .insert(rows)
      .select("*");

    if (result.error) {
      await supabase
        .from("flashcard_sets")
        .delete()
        .eq("id", flashcardSet.id)
        .eq("creator_id", userId);
      throw result.error;
    }
    const cardsList = Array.isArray(result.data) ? result.data : rows;

    await increaseChatUsage(userId);

    if (cardsList.length > 0) {
      await createActivityLog({
        actorUserId: userId,
        actionType: "FLASHCARDS_GENERATED",
        entityType: "flashcard_set",
        entityId: flashcardSet.id,
        newData: {
          cardCount: cardsList.length,
          flashcardSetId: flashcardSet.id,
          documentIds: requestedDocumentIds,
          dailyLimit: DAILY_AI_REQUEST_LIMIT,
        },
        request: req,
        details: `Generated ${cardsList.length} flashcard(s) from ${documents.length} document(s).`,
      });
    }

    return res.status(201).json({
      status: "success",
      data: cardsList,
      flashcardSet,
      documentIds: requestedDocumentIds,
      quota: {
        dailyLimit: DAILY_AI_REQUEST_LIMIT,
      },
    });
  } catch (error) {
    console.error("generateFlashcards error:", error);

    const storageMissing =
      error.code === "PGRST205" ||
      String(error.message || "").includes("public.flashcards") ||
      String(error.message || "").includes("public.flashcard_sets");

    return res.status(storageMissing ? 503 : error.statusCode || 500).json({
      status: "error",
      message: storageMissing
        ? "Flashcard storage is not initialized. Apply the flashcards database migration first."
        : error.message || "Failed to generate flashcards.",
    });
  }
};

exports.getDocumentFlashcards = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.id;

    if (userId === "guest" || userId === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(200).json({ status: "success", data: [] });
    }

    const document = await getAllowedDocument(documentId, userId);
    if (!document) {
      return res.status(404).json({ status: "error", message: "Document not found." });
    }
    if (document === "FORBIDDEN") {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this document.",
      });
    }

    const { data: latestSet, error: setError } = await supabase
      .from("flashcard_sets")
      .select("id")
      .eq("document_id", documentId)
      .eq("creator_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (setError) throw setError;
    if (!latestSet) {
      return res.status(200).json({ status: "success", data: [] });
    }

    const { data: flashcards, error } = await supabase
      .from("flashcards")
      .select("id, set_id, document_id, workspace_id, creator_id, question, answer, created_at")
      .eq("set_id", latestSet.id)
      .eq("creator_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return res.status(200).json({ status: "success", data: flashcards || [] });
  } catch (error) {
    console.error("getDocumentFlashcards error:", error);
    const storageMissing =
      error.code === "PGRST205" ||
      String(error.message || "").includes("public.flashcards") ||
      String(error.message || "").includes("public.flashcard_sets");
    return res.status(storageMissing ? 503 : 500).json({
      status: "error",
      message: storageMissing
        ? "Flashcard storage is not initialized. Apply the flashcards database migration first."
        : "Could not load flashcards.",
    });
  }
};

exports.listFlashcardSets = async (req, res) => {
  try {
    const userId = req.user.id;
    if (isGuestUser(req.user)) {
      return res.status(200).json({ status: "success", data: [] });
    }

    const { data: sets, error: setsError } = await supabase
      .from("flashcard_sets")
      .select("id, document_id, workspace_id, creator_id, title, created_at")
      .eq("creator_id", userId)
      .order("created_at", { ascending: false });
    if (setsError) throw setsError;

    const setIds = (sets || []).map((set) => set.id);
    let cardCounts = new Map();
    if (setIds.length > 0) {
      const { data: cardRows, error: cardsError } = await supabase
        .from("flashcards")
        .select("set_id")
        .in("set_id", setIds)
        .eq("creator_id", userId);
      if (cardsError) throw cardsError;

      cardCounts = (cardRows || []).reduce((counts, card) => {
        counts.set(card.set_id, (counts.get(card.set_id) || 0) + 1);
        return counts;
      }, new Map());
    }

    return res.status(200).json({
      status: "success",
      data: (sets || []).map((set) => ({
        ...set,
        card_count: cardCounts.get(set.id) || 0,
      })),
    });
  } catch (error) {
    console.error("listFlashcardSets error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load flashcard history.",
    });
  }
};

exports.getFlashcardSet = async (req, res) => {
  try {
    const userId = req.user.id;
    const { setId } = req.params;

    const { data: set, error: setError } = await supabase
      .from("flashcard_sets")
      .select("id, document_id, workspace_id, creator_id, title, created_at")
      .eq("id", setId)
      .eq("creator_id", userId)
      .maybeSingle();
    if (setError) throw setError;
    if (!set) {
      return res.status(404).json({
        status: "error",
        message: "Flashcard set not found.",
      });
    }

    const { data: cards, error: cardsError } = await supabase
      .from("flashcards")
      .select("id, set_id, document_id, workspace_id, creator_id, question, answer, created_at")
      .eq("set_id", setId)
      .eq("creator_id", userId)
      .order("created_at", { ascending: true });
    if (cardsError) throw cardsError;

    return res.status(200).json({
      status: "success",
      data: { ...set, cards: cards || [] },
    });
  } catch (error) {
    console.error("getFlashcardSet error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load this flashcard set.",
    });
  }
};

exports.deleteFlashcardSet = async (req, res) => {
  try {
    const userId = req.user.id;
    const { setId } = req.params;

    const { data: set, error: findError } = await supabase
      .from("flashcard_sets")
      .select("id")
      .eq("id", setId)
      .eq("creator_id", userId)
      .maybeSingle();
    if (findError) throw findError;
    if (!set) {
      return res.status(404).json({
        status: "error",
        message: "Flashcard set not found.",
      });
    }

    const { error: deleteError } = await supabase
      .from("flashcard_sets")
      .delete()
      .eq("id", setId)
      .eq("creator_id", userId);
    if (deleteError) throw deleteError;

    return res.status(200).json({
      status: "success",
      data: { id: setId },
      message: "Flashcard set deleted permanently.",
    });
  } catch (error) {
    console.error("deleteFlashcardSet error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not delete this flashcard set.",
    });
  }
};
