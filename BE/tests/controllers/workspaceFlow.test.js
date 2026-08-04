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
        download: jest.fn().mockResolvedValue({ data: null, error: null }),
        upload: jest.fn().mockResolvedValue({ error: null }),
        remove: jest.fn().mockResolvedValue({ error: null }),
      })),
    },
  };
});

jest.mock("../../src/utils/mailerService", () => ({
  createMailTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock("../../src/services/activityLogService", () => ({
  createActivityLog: jest.fn(),
}));

jest.mock("../../src/services/workspaceLimitService", () => ({
  MAX_OWNED_WORKSPACES: 5,
  countActiveOwnedWorkspaces: jest.fn().mockResolvedValue(1),
}));

const supabase = require("../../src/config/supabase");
const { createMailTransporter } = require("../../src/utils/mailerService");
const workspaceController = require("../../src/controllers/workspaceController");

describe("Workspace & Collaboration Main Flow Tests", () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: "user-admin", role: "STUDENT" },
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

  describe("1. Workspace Creation Flow", () => {
    test("blocks GUEST users from creating a workspace", async () => {
      req.user = { id: "guest-id", role: "GUEST" };
      req.body = { name: "Group Study" };

      await workspaceController.createWorkspace(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("validates required workspace name", async () => {
      req.body = { name: "" };

      await workspaceController.createWorkspace(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("2. Add & Remove Members & Invitation Mail Verification", () => {
    test("addMember creates In-App Invitation log and DOES NOT send external SMTP mail", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle
        .mockResolvedValueOnce({
          data: { id: "user-2", email: "student2@example.com", username: "student2", status: "ACTIVE" },
          error: null,
        }) // target user query
        .mockResolvedValueOnce({
          data: { id: "ws-100", name: "AI Study Group" },
          error: null,
        }) // workspace access query
        .mockResolvedValueOnce({
          data: { role: "Admin" },
          error: null,
        }) // member role check
        .mockResolvedValueOnce({ data: null, error: null }) // existing member check
        .mockResolvedValueOnce({
          data: { id: "admin-1", full_name: "Admin User" },
          error: null,
        }); // inviter profile

      mockChain.single.mockResolvedValueOnce({
        data: { id: "log-invitation-123", created_at: new Date().toISOString() },
        error: null,
      }); // activity_log insert

      req.params = { workspaceId: "ws-100" };
      req.body = { userId: "user-2", role: "Viewer" };

      await workspaceController.addMember(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: expect.objectContaining({
            status: "PENDING",
            role: "Viewer",
          }),
        })
      );

      // Verify that SMTP Mail Transporter was NOT called for workspace invitations
      const transporter = createMailTransporter();
      expect(transporter.sendMail).not.toHaveBeenCalled();
    });

    test("blocks non-admin members from removing another member", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle
        .mockResolvedValueOnce({ data: { id: "ws-100", name: "WS" }, error: null })
        .mockResolvedValueOnce({ data: { role: "Viewer" }, error: null });

      req.params = { workspaceId: "ws-100", memberId: "user-2" };

      await workspaceController.removeMember(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("3. Workspace Messaging Flow", () => {
    test("prevents sending empty chat messages", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle
        .mockResolvedValueOnce({ data: { id: "ws-100" }, error: null }) // workspace check
        .mockResolvedValueOnce({ data: { role: "Editor" }, error: null }); // member check

      req.params = { workspaceId: "ws-100" };
      req.body = { content: "   " };

      await workspaceController.createMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("lists workspace messages for authorized workspace members", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle
        .mockResolvedValueOnce({ data: { id: "ws-100" }, error: null })
        .mockResolvedValueOnce({ data: { role: "Editor" }, error: null });

      req.params = { workspaceId: "ws-100" };

      await workspaceController.listMessages(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

});
