jest.mock("../../src/config/supabase", () => {
  const chainable = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: jest.fn(() => chainable),
    storage: {
      from: jest.fn(() => ({
        download: jest.fn().mockResolvedValue({ data: null, error: null }),
        upload: jest.fn().mockResolvedValue({ error: null }),
        remove: jest.fn().mockResolvedValue({ error: null }),
      })),
    },
  };
});

jest.mock("../../src/services/activityLogService", () => ({
  createActivityLog: jest.fn(),
}));

jest.mock("../../src/services/workspaceLimitService", () => ({
  MAX_OWNED_WORKSPACES: 5,
  countActiveOwnedWorkspaces: jest.fn(),
}));

const supabase = require("../../src/config/supabase");
const adminController = require("../../src/controllers/adminController");

describe("Admin Track Log & Moderation Flow Tests", () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: "admin-user", role: "SYSTEM_ADMIN" },
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("1. Admin Activity Logs Audit Flow", () => {
    test("fetches system activity logs with pagination and filters", async () => {
      const mockChain = supabase.from();
      mockChain.range.mockResolvedValueOnce({
        data: [
          {
            id: "log-1",
            action_type: "WORKSPACE_INVITATION_PENDING",
            details: "User invited to workspace",
            created_at: new Date().toISOString(),
          },
        ],
        count: 1,
        error: null,
      });

      req.query = { page: "1", pageSize: "10" };

      await adminController.getActivityLogs(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: expect.any(Array),
        })
      );
    });
  });

  describe("2. User Management Flow", () => {
    test("prevents admin from disabling their own account", async () => {
      req.params = { userId: "admin-user" };
      req.body = { status: "DISABLED" };

      await adminController.updateUserStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Admin cannot disable their own account." })
      );
    });

    test("returns 404 when toggling status of non-existent user", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      req.params = { userId: "user-ghost" };
      req.body = { status: "DISABLED" };

      await adminController.updateUserStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
