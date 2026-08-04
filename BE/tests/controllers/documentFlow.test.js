jest.mock("../../src/config/supabase", () => {
  const chainable = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
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
  extractTextFromFile: jest.fn(),
  splitTextIntoChunks: jest.fn(),
}));

jest.mock("../../src/services/aiService", () => ({
  moderateDocument: jest.fn(),
  createEmbedding: jest.fn(),
  toVectorLiteral: jest.fn(),
  checkSensitiveContent: jest.fn(),
  validateTagsAndContent: jest.fn(),
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
    test("blocks GUEST user from creating a library", async () => {
      req.user = { id: "guest", role: "GUEST" };
      req.body = { name: "My Library" };

      await documentController.createLibrary(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("requires name when creating a library", async () => {
      req.body = { name: "   " };

      await documentController.createLibrary(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/name/i) })
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

    test("starts an unlimited background tag retry for the uploader", async () => {
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
        download: jest.fn(() => new Promise(() => {})),
      });
      req.params = { documentId: "doc-1" };

      await documentController.retryDocumentTags(req, res);

      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          tagging_status: "PENDING",
          tagging_error: null,
        }),
      );
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tagging_status: "PENDING" }),
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
