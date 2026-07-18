const {
  normalizeDocumentTitle,
  parseReplacementDocumentIds,
  resolveDuplicateUploadDecisions,
} = require("../../src/utils/documentDuplicateUtils");

describe("documentDuplicateUtils", () => {
  test("normalizes document names for case-insensitive comparison", () => {
    expect(normalizeDocumentTitle("  Notes.DOCX ")).toBe("notes.docx");
  });

  test("parses replacement ids without changing file alignment", () => {
    expect(parseReplacementDocumentIds('["doc-1", null]', 3)).toEqual([
      "doc-1",
      null,
      null,
    ]);
  });

  test("reports an existing document until its replacement is approved", () => {
    const files = [{ originalname: "Notes.docx" }];
    const existing = [
      { id: "doc-1", title: "notes.DOCX", file_size_bytes: 120 },
    ];

    expect(resolveDuplicateUploadDecisions(files, existing, [null])).toEqual({
      conflicts: [
        {
          fileIndex: 0,
          fileName: "Notes.docx",
          documentId: "doc-1",
          existingSizeBytes: 120,
          reason: "ALREADY_UPLOADED",
        },
      ],
      replacementTargetIds: [[]],
    });

    expect(resolveDuplicateUploadDecisions(files, existing, ["doc-1"])).toEqual({
      conflicts: [],
      replacementTargetIds: [["doc-1"]],
    });
  });

  test("rejects the same document name twice in one upload batch", () => {
    const decision = resolveDuplicateUploadDecisions(
      [
        { originalname: "notes.txt" },
        { originalname: "NOTES.txt" },
      ],
      [],
      [null, null],
    );

    expect(decision.conflicts).toEqual([
      {
        fileIndex: 1,
        fileName: "NOTES.txt",
        documentId: null,
        reason: "DUPLICATE_IN_BATCH",
      },
    ]);
  });
});
