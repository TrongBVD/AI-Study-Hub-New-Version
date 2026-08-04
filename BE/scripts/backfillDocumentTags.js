require("dotenv").config();

const supabase = require("../src/config/supabase");
const { extractTextFromFile } = require("../src/services/textExtractService");
const {
  classifyDocumentHierarchicalTags,
} = require("../src/services/aiService");
const {
  ensureAndLinkDocumentTags,
} = require("../src/services/tagService");

const execute = process.argv.includes("--execute");
const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const limit = Math.max(1, Number(limitArgument?.split("=")[1]) || 25);
const bucket = process.env.SUPABASE_DOCUMENT_BUCKET || "documents";

async function updateTaggingState(documentId, status, errorMessage = null) {
  const { error } = await supabase
    .from("documents")
    .update({
      tagging_status: status,
      tagging_error: errorMessage,
      tagging_updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) throw error;
}

async function loadFile(document) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(document.file_url);
  if (error || !data) throw error || new Error("Stored file is unavailable.");

  const arrayBuffer = await data.arrayBuffer();
  return {
    originalname: document.title,
    size: Number(document.file_size_bytes) || arrayBuffer.byteLength,
    buffer: Buffer.from(arrayBuffer),
  };
}

async function run() {
  const [{ data: documents, error: documentError }, { data: linkedRows, error: tagError }] =
    await Promise.all([
      supabase
        .from("documents")
        .select("id, title, file_url, file_size_bytes")
        .eq("status", "APPROVED")
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      supabase.from("document_tags").select("document_id"),
    ]);

  if (documentError) throw documentError;
  if (tagError) throw tagError;

  const linkedIds = new Set((linkedRows || []).map((row) => String(row.document_id)));
  const candidates = (documents || [])
    .filter((document) => !linkedIds.has(String(document.id)))
    .slice(0, limit);

  console.log(
    `${execute ? "Executing" : "Dry run"}: ${candidates.length} untagged document(s) selected.`,
  );
  candidates.forEach((document) => console.log(`- ${document.id}: ${document.title}`));

  if (!execute || candidates.length === 0) return;

  let completed = 0;
  let failed = 0;
  for (const document of candidates) {
    try {
      await updateTaggingState(document.id, "PROCESSING");
      const file = await loadFile(document);
      const text = await extractTextFromFile(file);
      if (!text || text.trim().length < 20) {
        throw new Error("The file does not contain enough readable text for AI tagging.");
      }
      const classification = await classifyDocumentHierarchicalTags(
        text,
        document.title,
        { throwOnError: true },
      );
      await ensureAndLinkDocumentTags(document.id, classification, {
        throwOnError: true,
      });
      await updateTaggingState(document.id, "COMPLETED");
      completed += 1;
    } catch (error) {
      await ensureAndLinkDocumentTags(document.id, {
        level1: "Other",
        level2: null,
        level3: null,
      });
      await updateTaggingState(document.id, "FAILED", error.message);
      failed += 1;
      console.error(`Failed ${document.id}: ${error.message}`);
    }
  }

  console.log(`Backfill finished: ${completed} completed, ${failed} failed.`);
}

run().catch((error) => {
  console.error("Backfill aborted:", error);
  process.exitCode = 1;
});
