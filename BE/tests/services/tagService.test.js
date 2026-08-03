const {
  HARDCODED_LEVEL_1_TAGS,
  normalizeTagName,
  matchLevel1Tag,
} = require("../../src/services/tagService");

describe("tagService Unit Tests", () => {
  describe("HARDCODED_LEVEL_1_TAGS", () => {
    test("contains the required 15 hardcoded Level 1 subjects", () => {
      expect(HARDCODED_LEVEL_1_TAGS).toHaveLength(15);
      expect(HARDCODED_LEVEL_1_TAGS).toContain("Literature");
      expect(HARDCODED_LEVEL_1_TAGS).toContain("Mathematics");
      expect(HARDCODED_LEVEL_1_TAGS).toContain("Information Technology");
      expect(HARDCODED_LEVEL_1_TAGS).toContain("Other");
    });
  });

  describe("normalizeTagName", () => {
    test("trims whitespace and removes leading hashtags", () => {
      expect(normalizeTagName("  #Mathematics  ")).toBe("Mathematics");
      expect(normalizeTagName("###Software Engineering")).toBe("Software Engineering");
      expect(normalizeTagName("")).toBe("");
    });
  });

  describe("matchLevel1Tag", () => {
    test("matches exact Level 1 subjects", () => {
      expect(matchLevel1Tag("Mathematics")).toBe("Mathematics");
      expect(matchLevel1Tag("Information Technology")).toBe("Information Technology");
      expect(matchLevel1Tag("Economics")).toBe("Economics");
    });

    test("matches fuzzy/shortened keywords to Level 1 subjects", () => {
      expect(matchLevel1Tag("Math")).toBe("Mathematics");
      expect(matchLevel1Tag("IT")).toBe("Information Technology");
      expect(matchLevel1Tag("Physics")).toBe("Physics, Chemistry, Biology");
      expect(matchLevel1Tag("Medicine")).toBe("Medicine");
    });

    test("defaults unlisted or completely unrelated subjects to 'Other'", () => {
      expect(matchLevel1Tag("Random Unknown Subject XYZ")).toBe("Other");
      expect(matchLevel1Tag("Cookbook Recipes")).toBe("Other");
    });
  });
});
