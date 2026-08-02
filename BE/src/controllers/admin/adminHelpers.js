const supabase = require("../../config/supabase");

const DOCUMENT_BUCKET = process.env.SUPABASE_DOCUMENT_BUCKET || "documents";
const WAITING_BUCKET = process.env.SUPABASE_DOCUMENT_WAITING_ADMIN_APPROVED || "document_waiting_admin";
const WAITING_DOCUMENT_STATUSES = new Set(["FLAGGED", "REJECTED", "PENDING_RETRY"]);

function getDocumentBucket(document) {
  return WAITING_DOCUMENT_STATUSES.has(String(document.status || "").toUpperCase())
    ? WAITING_BUCKET
    : DOCUMENT_BUCKET;
}

function chunkArray(items, size = 500) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function removeWorkspaceStorageFiles(documents) {
  const pathsByBucket = new Map();
  for (const document of documents) {
    const path = String(document.file_url || "").trim();
    if (!path) continue;
    const bucket = getDocumentBucket(document);
    if (!pathsByBucket.has(bucket)) pathsByBucket.set(bucket, new Set());
    pathsByBucket.get(bucket).add(path);
  }

  for (const [bucket, paths] of pathsByBucket) {
    for (const batch of chunkArray([...paths])) {
      const { error } = await supabase.storage.from(bucket).remove(batch);
      if (error) {
        throw new Error(`Storage cleanup failed for bucket "${bucket}": ${error.message}`);
      }
    }
  }
}

async function getWorkspaceForPurge(workspaceId) {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, description, created_by, created_at, deleted_at")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getWorkspaceDocuments(workspaceId) {
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, file_url, file_size_bytes, status, workspace_id, library_id, deleted_at")
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return data || [];
}

async function countRows(table, filter) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  query = filter(query);
  const { count, error } = await query;
  if (error && ["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code)) {
    return 0;
  }
  if (error) throw error;
  return count || 0;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getPagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(query.pageSize, 10) || 100),
  );

  return {
    page,
    pageSize,
    from: (page - 1) * pageSize,
    to: page * pageSize - 1,
  };
}

function paginationPayload(count, page, pageSize) {
  return {
    page,
    pageSize,
    totalItems: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
  };
}

module.exports = {
  DOCUMENT_BUCKET,
  WAITING_BUCKET,
  WAITING_DOCUMENT_STATUSES,
  getDocumentBucket,
  chunkArray,
  removeWorkspaceStorageFiles,
  getWorkspaceForPurge,
  getWorkspaceDocuments,
  countRows,
  getTodayDate,
  getPagination,
  paginationPayload,
};
