jest.mock("../../src/config/supabase", () => {
  const tableResults = new Map();

  function createBuilder(table) {
    const builder = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      is: jest.fn(() => builder),
      maybeSingle: jest.fn(async () =>
        tableResults.get(table) || { data: null, error: null }),
    };
    return builder;
  }

  return {
    from: jest.fn((table) => createBuilder(table)),
    __setTableResult(table, result) {
      tableResults.set(table, result);
    },
    __clearTableResults() {
      tableResults.clear();
    },
  };
});

const supabase = require("../../src/config/supabase");
const {
  canAccessDocument,
} = require("../../src/services/documentAccessService");

describe("documentAccessService", () => {
  beforeEach(() => {
    supabase.__clearTableResults();
    jest.clearAllMocks();
  });

  it("allows the uploader to access their document", async () => {
    await expect(
      canAccessDocument({ uploader_id: "owner" }, "owner"),
    ).resolves.toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("allows an approved public document only when its library is public", async () => {
    supabase.__setTableResult("libraries", {
      data: { id: "library-1", is_public: true },
      error: null,
    });

    await expect(
      canAccessDocument(
        {
          uploader_id: "owner",
          library_id: "library-1",
          is_public: true,
          status: "APPROVED",
        },
        "viewer",
      ),
    ).resolves.toBe(true);
  });

  it("denies a public document record when the parent library is private", async () => {
    supabase.__setTableResult("libraries", { data: null, error: null });

    await expect(
      canAccessDocument(
        {
          uploader_id: "owner",
          library_id: "library-1",
          is_public: true,
          status: "APPROVED",
        },
        "viewer",
      ),
    ).resolves.toBe(false);
  });

  it("denies an unapproved document even when its library is public", async () => {
    supabase.__setTableResult("libraries", {
      data: { id: "library-1", is_public: true },
      error: null,
    });

    await expect(
      canAccessDocument(
        {
          uploader_id: "owner",
          library_id: "library-1",
          is_public: true,
          status: "PENDING",
        },
        "viewer",
      ),
    ).resolves.toBe(false);
  });

  it("allows an active workspace member to access a workspace document", async () => {
    supabase.__setTableResult("workspaces", {
      data: { id: "workspace-1" },
      error: null,
    });
    supabase.__setTableResult("workspace_members", {
      data: { role: "Viewer" },
      error: null,
    });

    await expect(
      canAccessDocument(
        {
          uploader_id: "owner",
          workspace_id: "workspace-1",
          is_public: false,
          status: "APPROVED",
        },
        "member",
      ),
    ).resolves.toBe(true);
  });

  it("denies a non-member from accessing a workspace document", async () => {
    supabase.__setTableResult("workspaces", {
      data: { id: "workspace-1" },
      error: null,
    });
    supabase.__setTableResult("workspace_members", {
      data: null,
      error: null,
    });

    await expect(
      canAccessDocument(
        {
          uploader_id: "owner",
          workspace_id: "workspace-1",
          is_public: false,
          status: "APPROVED",
        },
        "outsider",
      ),
    ).resolves.toBe(false);
  });
});
