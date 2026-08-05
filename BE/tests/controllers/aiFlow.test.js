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
    in: jest.fn().mockReturnThis(),
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

jest.mock("../../src/services/textExtractService", () => ({
  extractTextFromFile: jest.fn().mockResolvedValue("Sample extracted text for study."),
  splitTextIntoChunks: jest.fn().mockReturnValue(["Sample extracted text for study."]),
}));

jest.mock("../../src/services/aiService", () => ({
  createEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  createBatchEmbeddings: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  toVectorLiteral: jest.fn().mockReturnValue("[0.1, 0.2, 0.3]"),
  answerWithContext: jest
    .fn()
    .mockResolvedValue("Detailed study answer derived from document context."),
  answerGeneralQuestion: jest
    .fn()
    .mockResolvedValue("A short general-knowledge answer."),
  classifyChatQuestion: jest.fn().mockResolvedValue({
    intent: "CONTENT",
    metadataScope: "SELECTED",
  }),
  answerMetadataWithContext: jest
    .fn()
    .mockResolvedValue("An answer based on StudyHub metadata."),
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
const aiService = require("../../src/services/aiService");
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

    test("successfully answers question when vector search or chunk fallback is active", async () => {
      req.body = {
        scope: "SELECTED",
        documentIds: ["doc-approved-1"],
        metadataScope: "AUTO",
        question: "What is momentum?",
      };

      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { id: "doc-approved-1", status: "APPROVED", title: "physics.pdf", file_url: "user/physics.pdf" },
        error: null,
      });

      canAccessDocument.mockResolvedValueOnce(true);

      supabase.rpc.mockResolvedValueOnce({
        data: [{ chunk_index: 0, content: "Momentum is mass times velocity.", similarity: 0.95 }],
        error: null,
      });

      await aiController.chatWithDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: expect.objectContaining({
            documentId: "doc-approved-1",
            documentIds: ["doc-approved-1"],
            question: "What is momentum?",
          }),
        })
      );
    });

    test("returns 409 when a selected content source is not approved yet", async () => {
      req.body = {
        scope: "SELECTED",
        documentIds: ["doc-pending-1"],
        question: "Summarize this document",
      };

      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "doc-pending-1",
          status: "PENDING",
          title: "processing.pdf",
          file_url: "user/processing.pdf",
        },
        error: null,
      });
      canAccessDocument.mockResolvedValueOnce(true);

      await aiController.chatWithDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "DOCUMENT_NOT_READY",
        }),
      );
      expect(aiService.answerWithContext).not.toHaveBeenCalled();
    });

    test("auto-repairs missing chunks on-demand and returns AI response", async () => {
      req.body = { documentId: "doc-no-chunks", question: "Explain gravity" };

      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { id: "doc-no-chunks", status: "APPROVED", title: "physics.pdf", file_url: "user/physics.pdf" },
        error: null,
      });

      canAccessDocument.mockResolvedValueOnce(true);

      // rpc returns no chunks
      supabase.rpc.mockResolvedValueOnce({ data: [], error: null });

      // select from document_chunks returns no chunks first time
      mockChain.order.mockResolvedValueOnce({ data: [], error: null });

      // mock storage download
      supabase.storage = {
        from: jest.fn().mockReturnValue({
          download: jest.fn().mockResolvedValue({
            data: { arrayBuffer: jest.fn().mockResolvedValue(Buffer.from("dummy")) },
            error: null,
          }),
        }),
      };

      await aiController.chatWithDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: expect.objectContaining({
            documentId: "doc-no-chunks",
          }),
        })
      );
    });

    test("auto-repair stores raw chunks when document embedding is unavailable", async () => {
      req.body = {
        documentId: "doc-raw-chunks",
        question: "Explain gravity",
      };

      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "doc-raw-chunks",
          status: "APPROVED",
          title: "physics.pdf",
          file_url: "user/physics.pdf",
        },
        error: null,
      });
      canAccessDocument.mockResolvedValueOnce(true);
      supabase.rpc.mockResolvedValueOnce({ data: [], error: null });
      mockChain.order.mockResolvedValueOnce({ data: [], error: null });
      aiService.createBatchEmbeddings.mockResolvedValueOnce([null]);
      supabase.storage = {
        from: jest.fn().mockReturnValue({
          download: jest.fn().mockResolvedValue({
            data: {
              arrayBuffer: jest.fn().mockResolvedValue(Buffer.from("dummy")),
            },
            error: null,
          }),
        }),
      };

      await aiController.chatWithDocument(req, res);

      expect(mockChain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          document_id: "doc-raw-chunks",
          content: "Sample extracted text for study.",
          embedding: null,
        }),
      ]);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("returns a flashcard navigation action instead of a chat answer", async () => {
      req.body = {
        scope: "SELECTED",
        documentIds: ["doc-approved-1"],
        question: "Create quiz-style flashcards from this file",
      };

      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "doc-approved-1",
          status: "APPROVED",
          title: "physics.pdf",
          file_url: "user/physics.pdf",
        },
        error: null,
      });
      canAccessDocument.mockResolvedValueOnce(true);
      aiService.classifyChatQuestion.mockResolvedValueOnce({
        intent: "FLASHCARD",
        metadataScope: "SELECTED",
        contentMode: "NONE",
      });

      await aiController.chatWithDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        data: expect.objectContaining({
          action: "OPEN_FLASHCARDS",
          intent: "FLASHCARD",
          documentId: "doc-approved-1",
          autoGenerate: true,
        }),
      });
      expect(aiService.answerWithContext).not.toHaveBeenCalled();
    });

    test("opens the flashcard page without auto-generating when no file is selected", async () => {
      req.body = {
        scope: "SELECTED",
        documentIds: [],
        question: "Tạo flashcard cho tôi",
      };
      aiService.classifyChatQuestion.mockResolvedValueOnce({
        intent: "FLASHCARD",
        metadataScope: "SELECTED",
        contentMode: "NONE",
      });

      await aiController.chatWithDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        data: expect.objectContaining({
          action: "OPEN_FLASHCARDS",
          documentId: null,
          autoGenerate: false,
        }),
      });
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
            chatLimit: 20,
            chatsUsed: 5,
            chatsRemaining: 15,
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

    test("successfully generates flashcards for any document as long as AI usage quota remains", async () => {
      req.params = { documentId: "doc-flashcards-1" };

      const mockChain = supabase.from();
      mockChain.maybeSingle
        .mockResolvedValueOnce({
          data: { id: "doc-flashcards-1", status: "APPROVED", title: "physics.pdf", file_url: "user/physics.pdf" },
          error: null,
        }) // 1st: getAllowedDocument
        .mockResolvedValueOnce({ data: { id: "log-1", chat_count: 5 }, error: null }); // 2nd: increaseChatUsage

      canAccessDocument.mockResolvedValueOnce(true);

      mockChain.order.mockResolvedValueOnce({
        data: [{ chunk_index: 0, content: "Newton's first law text" }],
        error: null,
      });

      mockChain.delete.mockReturnThis();
      mockChain.insert.mockReturnThis();

      await aiController.generateFlashcards(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(supabase.from).toHaveBeenCalledWith("flashcard_sets");
      expect(supabase.from).toHaveBeenCalledWith("flashcards");
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: "doc-flashcards-1",
          creator_id: "user-student-1",
        }),
      );
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            document_id: "doc-flashcards-1",
            creator_id: "user-student-1",
            set_id: expect.any(String),
          }),
        ]),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          flashcardSet: expect.objectContaining({
            document_id: "doc-flashcards-1",
          }),
        })
      );
    });

    test("combines multiple approved documents into one flashcard set", async () => {
      req.body = { documentIds: ["doc-1", "doc-2"] };

      const mockChain = supabase.from();
      mockChain.maybeSingle
        .mockResolvedValueOnce({
          data: { id: "doc-1", status: "APPROVED", title: "one.pdf", file_url: "user/one.pdf" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "doc-2", status: "APPROVED", title: "two.pdf", file_url: "user/two.pdf" },
          error: null,
        });
      canAccessDocument
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      mockChain.order
        .mockResolvedValueOnce({ data: [{ chunk_index: 0, content: "First source" }], error: null })
        .mockResolvedValueOnce({ data: [{ chunk_index: 0, content: "Second source" }], error: null });

      await aiController.generateFlashcards(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(aiService.generateFlashcardsFromChunks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: expect.stringContaining("[Source: one.pdf]") }),
          expect.objectContaining({ content: expect.stringContaining("[Source: two.pdf]") }),
        ]),
        expect.objectContaining({
          sources: [
            expect.objectContaining({ title: "one.pdf", chunkCount: 1 }),
            expect.objectContaining({ title: "two.pdf", chunkCount: 1 }),
          ],
        }),
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        documentIds: ["doc-1", "doc-2"],
        flashcardSet: expect.objectContaining({
          title: "Combined flashcards (2 sources)",
        }),
      }));
    });

    test("rejects more than five documents for one flashcard set", async () => {
      req.body = {
        documentIds: ["doc-1", "doc-2", "doc-3", "doc-4", "doc-5", "doc-6"],
      };

      await aiController.generateFlashcards(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: "Select up to 5 documents per flashcard set.",
      }));
    });

    test("lists saved flashcard sets for the authenticated user", async () => {
      const mockChain = supabase.from();
      mockChain.eq
        .mockReturnValueOnce(mockChain)
        .mockResolvedValueOnce({
          data: [{ set_id: "set-1" }, { set_id: "set-1" }],
          error: null,
        });
      mockChain.order.mockResolvedValueOnce({
        data: [{
          id: "set-1",
          document_id: "doc-1",
          creator_id: "user-student-1",
          title: "Physics",
          created_at: "2026-08-03T00:00:00.000Z",
        }],
        error: null,
      });

      await aiController.listFlashcardSets(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        data: [expect.objectContaining({ id: "set-1", card_count: 2 })],
      });
    });

    test("loads one owned flashcard set with its cards", async () => {
      req.params = { setId: "set-1" };
      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "set-1",
          document_id: "doc-1",
          creator_id: "user-student-1",
          title: "Physics",
        },
        error: null,
      });
      mockChain.order.mockResolvedValueOnce({
        data: [{ id: "card-1", set_id: "set-1", question: "Q", answer: "A" }],
        error: null,
      });

      await aiController.getFlashcardSet(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        data: expect.objectContaining({
          id: "set-1",
          cards: [expect.objectContaining({ id: "card-1" })],
        }),
      });
    });

    test("permanently deletes an owned flashcard set", async () => {
      req.params = { setId: "set-1" };
      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { id: "set-1" },
        error: null,
      });

      await aiController.deleteFlashcardSet(req, res);

      expect(mockChain.delete).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        data: { id: "set-1" },
      }));
    });
  });
});
