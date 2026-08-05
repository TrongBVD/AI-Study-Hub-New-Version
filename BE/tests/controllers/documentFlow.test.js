jest.mock("../../src/config/supabase", () => {
  const chainable = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: jest.fn(() => chainable),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        remove: jest.fn().mockResolvedValue({ error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/signed-file.pdf" },
          error: null,
        }),
      })),
    },
  };
});

jest.mock("../../src/services/textExtractService", () => ({
  extractTextFromFile: jest.fn().mockResolvedValue("Readable algebra study content."),
  splitTextIntoChunks: jest.fn().mockReturnValue(["Readable algebra study content."]),
}));

jest.mock("../../src/services/aiService", () => ({
  moderateDocument: jest.fn(),
  createEmbedding: jest.fn(),
  toVectorLiteral: jest.fn(),
  checkSensitiveContent: jest.fn(),
  validateTagsAndContent: jest.fn(),
  classifyDocumentHierarchicalTags: jest.fn().mockResolvedValue({
    level1: "Mathematics",
    level2: "Algebra",
    level3: null,
  }),
  createBatchEmbeddings: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
}));

jest.mock("../../src/services/tagService", () => ({
  ensureAndLinkDocumentTags: jest.fn().mockResolvedValue({
    level1: "Mathematics",
    level2: "Algebra",
    level3: null,
  }),
}));

jest.mock("../../src/services/activityLogService", () => ({
  createActivityLog: jest.fn(),
}));

jest.mock("../../src/services/documentAccessService", () => ({
  canAccessDocument: jest.fn(),
}));

const supabase = require("../../src/config/supabase");
const documentController = require("../../src/controllers/documentController");

describe("Document & Library Main Flow Tests", () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: "user-1", role: "STUDENT" },
      body: {},
      params: {},
      query: {},
      files: [],
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("Library Operations", () => {
    test("creates a library with the selected public visibility", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      mockChain.single.mockResolvedValueOnce({
        data: {
          id: "lib-new",
          user_id: "user-1",
          name: "Biology",
          description: "Exam notes",
          is_public: true,
          share_on_profile: false,
        },
        error: null,
      });
      req.body = {
        name: "  Biology  ",
        description: "  Exam notes  ",
        is_public: true,
      };

      await documentController.createLibrary(req, res);

      expect(mockChain.insert).toHaveBeenCalledWith({
        user_id: "user-1",
        name: "Biology",
        description: "Exam notes",
        is_public: true,
        share_on_profile: false,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: expect.objectContaining({ id: "lib-new", documents: 0 }),
        }),
      );
    });

    test("returns 404 when updating non-existent library", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      req.params = { id: "lib-999" };
      req.body = { name: "Updated Name" };

      await documentController.updateLibrary(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("Document Upload & Validation Flow", () => {
    test("rejects upload request when no files are provided", async () => {
      req.files = [];
      req.body = { library_id: "lib-1" };

      await documentController.uploadDocuments(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/tệp|file|files/i) })
      );
    });

    test("waits for a library tag retry to complete", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "doc-1",
          uploader_id: "user-1",
          library_id: "lib-1",
          workspace_id: null,
          title: "Algebra.pdf",
          file_url: "user-1/algebra.pdf",
          file_size_bytes: 1024,
          status: "APPROVED",
        },
        error: null,
      });
      supabase.storage.from.mockReturnValueOnce({
        download: jest.fn().mockResolvedValue({
          data: {
            arrayBuffer: jest
              .fn()
              .mockResolvedValue(Buffer.from("Readable algebra study content.")),
          },
          error: null,
        }),
      });
      req.params = { documentId: "doc-1" };

      await documentController.retryDocumentTags(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: expect.objectContaining({
            tagging_status: "COMPLETED",
            ai_ready: true,
          }),
        }),
      );
    });

    test("does not allow another user to retry document tags", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "doc-2",
          uploader_id: "user-2",
          title: "Private.pdf",
        },
        error: null,
      });
      req.params = { documentId: "doc-2" };

      await documentController.retryDocumentTags(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("Document Access & Deletion Flow", () => {
    test("returns 404 when downloading non-existent document", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      req.params = { id: "doc-missing" };

      await documentController.downloadDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 404 when attempting to delete non-existent document", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      req.params = { id: "doc-missing" };

      await documentController.deleteDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
