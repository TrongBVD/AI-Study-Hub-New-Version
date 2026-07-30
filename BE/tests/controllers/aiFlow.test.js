jest.mock("../../src/config/supabase", () => {
  const chainable = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: jest.fn(() => chainable),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
});

jest.mock("../../src/services/aiService", () => ({
  createEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  toVectorLiteral: jest.fn().mockReturnValue("[0.1, 0.2, 0.3]"),
  answerWithContext: jest.fn().mockResolvedValue({
    answer: "Detailed study answer derived from document context.",
    sources: ["Chunk 1"],
  }),
  generateFlashcardsFromChunks: jest.fn().mockResolvedValue([
    { question: "What is Newton's First Law?", answer: "An object stays at rest unless acted upon by a net force." },
  ]),
}));

jest.mock("../../src/services/activityLogService", () => ({
  createActivityLog: jest.fn(),
}));

jest.mock("../../src/services/documentAccessService", () => ({
  canAccessDocument: jest.fn(),
}));

const supabase = require("../../src/config/supabase");
const { canAccessDocument } = require("../../src/services/documentAccessService");
const aiController = require("../../src/controllers/aiController");

describe("AI Pipeline Main Flow Tests", () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: "user-student-1", role: "STUDENT" },
      body: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("1. RAG Document Chat Flow", () => {
    test("returns 400 if question or documentId is missing", async () => {
      req.body = { question: "What is this?" }; // Missing documentId

      await aiController.chatWithDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 404 if document is not found", async () => {
      req.body = { documentId: "doc-missing", question: "Explain chapter 1" };

      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await aiController.chatWithDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("returns 403 if user lacks permission to document", async () => {
      req.body = { documentId: "doc-private", question: "Explain chapter 1" };

      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { id: "doc-private", owner_id: "other-user" },
        error: null,
      });

      canAccessDocument.mockResolvedValueOnce(false);

      await aiController.chatWithDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("2. AI Usage & Summary Flow", () => {
    test("returns AI quota and usage statistics for registered users", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { chat_count: 5, tokens_consumed: 1200 },
        error: null,
      });

      await aiController.getAiSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: expect.objectContaining({
            chatLimit: 50,
            chatsUsed: 5,
            chatsRemaining: 45,
          }),
        })
      );
    });
  });

  describe("3. Flashcard Generation Flow", () => {
    test("returns 404 if target document does not exist", async () => {
      req.params = { documentId: "doc-not-exist" };

      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await aiController.generateFlashcards(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
