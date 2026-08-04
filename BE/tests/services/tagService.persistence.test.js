const mockFrom = jest.fn();

jest.mock("../../src/config/supabase", () => ({
  from: (...args) => mockFrom(...args),
}));

const {
  ensureAndLinkDocumentTags,
} = require("../../src/services/tagService");

function createChain({ maybeSingleData = null, singleData = null, singleError = null } = {}) {
  return {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: maybeSingleData, error: null }),
    single: jest.fn().mockResolvedValue({ data: singleData, error: singleError }),
  };
}

describe("tagService hierarchical persistence", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  test("creates and links all three tag levels for one document", async () => {
    const l1 = createChain({
      singleData: { id: "tag-l1", name: "Mathematics", level: 1 },
    });
    const l2 = createChain({
      singleData: { id: "tag-l2", name: "Linear Algebra", level: 2 },
    });
    const l3 = createChain({
      singleData: { id: "tag-l3", name: "Vector Spaces", level: 3 },
    });
    const documentTags = createChain({
      singleData: { id: "document-tag-1", document_id: "document-1" },
    });
    mockFrom
      .mockReturnValueOnce(l1)
      .mockReturnValueOnce(l1)
      .mockReturnValueOnce(l2)
      .mockReturnValueOnce(l2)
      .mockReturnValueOnce(l3)
      .mockReturnValueOnce(l3)
      .mockReturnValueOnce(documentTags);

    const result = await ensureAndLinkDocumentTags(
      "document-1",
      {
        level1: "Mathematics",
        level2: "Linear Algebra",
        level3: "Vector Spaces",
      },
      { throwOnError: true },
    );

    expect(documentTags.upsert).toHaveBeenCalledWith(
      {
        document_id: "document-1",
        level_1_tag_id: "tag-l1",
        level_2_tag_id: "tag-l2",
        level_3_tag_id: "tag-l3",
      },
      { onConflict: "document_id" },
    );
    expect(result).toMatchObject({
      level1: "Mathematics",
      level2: "Linear Algebra",
      level3: "Vector Spaces",
    });
  });

  test("reuses an existing hierarchy and surfaces an upsert failure", async () => {
    const l1 = createChain({
      maybeSingleData: { id: "tag-l1", name: "Other", level: 1 },
    });
    const documentTags = createChain({
      singleError: new Error("document_tags write failed"),
    });
    mockFrom.mockReturnValueOnce(l1).mockReturnValueOnce(documentTags);

    await expect(
      ensureAndLinkDocumentTags(
        "document-2",
        { level1: "Other" },
        { throwOnError: true },
      ),
    ).rejects.toThrow("document_tags write failed");
  });
});
