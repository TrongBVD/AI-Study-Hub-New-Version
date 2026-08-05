const authMiddleware = require("../../src/middleware/authMiddleware");
const requireAuthenticatedUser = require("../../src/middleware/requireAuthenticatedUser");
const workspaceController = require("../../src/controllers/workspaceController");
const documentController = require("../../src/controllers/documentController");

// Mock Supabase
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
    ilike: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: jest.fn(() => chainable),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: "http://test.url" }, error: null }),
      })),
    },
  };
});

describe("Security & Workspace Verification Tests", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: { id: "user-123", role: "STUDENT" },
      body: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("1. Authentication Middleware Security", () => {
    it("should reject requests without Authorization header with 401", async () => {
      await authMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error" })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject fake tokens with guest_signature_bypass with 401", async () => {
      req.headers.authorization = "Bearer fake_token_with_guest_signature_bypass";
      await authMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("2. Guest Role Block Checks", () => {
    it("should block GUEST role from all authenticated AI features", () => {
      req.user = { id: "guest", role: "GUEST" };

      requireAuthenticatedUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("should block GUEST role from creating workspaces", async () => {
      req.user = { id: "guest", role: "GUEST" };
      req.body = { name: "Test Workspace" };
      await workspaceController.createWorkspace(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/guest/i) })
      );
    });

    it("should block GUEST role from updating libraries", async () => {
      req.user = { id: "guest", role: "GUEST" };
      req.params = { id: "lib-1" };
      await documentController.updateLibrary(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should block GUEST role from deleting libraries", async () => {
      req.user = { id: "guest", role: "GUEST" };
      req.params = { id: "lib-1" };
      await documentController.deleteLibrary(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
