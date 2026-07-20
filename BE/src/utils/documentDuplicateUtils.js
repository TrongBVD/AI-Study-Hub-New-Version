function normalizeDocumentTitle(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function parseReplacementDocumentIds(value, fileCount) {
  let parsed = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = [];
    }
  }

  const replacements = Array.isArray(parsed) ? parsed : [];

  return Array.from({ length: fileCount }, (_, index) => {
    const documentId = replacements[index];
    return documentId === null || documentId === undefined || documentId === ""
      ? null
      : String(documentId);
  });
}

function resolveDuplicateUploadDecisions(
  files,
  existingDocuments,
  requestedReplacementIds,
) {
  const documentsByTitle = new Map();

  for (const document of existingDocuments || []) {
    const normalizedTitle = normalizeDocumentTitle(document?.title);
    if (!normalizedTitle || !document?.id) continue;

    const matches = documentsByTitle.get(normalizedTitle) || [];
    matches.push(document);
    documentsByTitle.set(normalizedTitle, matches);
  }

  const seenBatchTitles = new Set();
  const conflicts = [];
  const replacementTargetIds = Array.from(
    { length: files.length },
    () => [],
  );

  files.forEach((file, fileIndex) => {
    const fileName = String(file?.originalname || file?.name || "").trim();
    const normalizedTitle = normalizeDocumentTitle(fileName);

    if (seenBatchTitles.has(normalizedTitle)) {
      conflicts.push({
        fileIndex,
        fileName,
        documentId: null,
        reason: "DUPLICATE_IN_BATCH",
      });
      return;
    }

    seenBatchTitles.add(normalizedTitle);

    const matches = documentsByTitle.get(normalizedTitle) || [];
    if (matches.length === 0) return;

    const requestedId = requestedReplacementIds[fileIndex];
    const isApprovedReplacement = matches.some(
      (document) => String(document.id) === requestedId,
    );

    if (!isApprovedReplacement) {
      const existingDocument = matches[0];
      conflicts.push({
        fileIndex,
        fileName,
        documentId: String(existingDocument.id),
        existingSizeBytes: Number(existingDocument.file_size_bytes) || 0,
        reason: "ALREADY_UPLOADED",
      });
      return;
    }

    replacementTargetIds[fileIndex] = matches.map((document) =>
      String(document.id),
    );
  });

  return { conflicts, replacementTargetIds };
}

module.exports = {
  normalizeDocumentTitle,
  parseReplacementDocumentIds,
  resolveDuplicateUploadDecisions,
};
