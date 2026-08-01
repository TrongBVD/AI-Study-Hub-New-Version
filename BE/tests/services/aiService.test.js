const { removeChunkReferences } = require("../../src/services/aiService");

describe("AI answer formatting", () => {
  test("removes generated chunk support statements", () => {
    const answer = [
      "Based on the provided document, the key point is:",
      "",
      "The module contains only local utility logic.",
      "",
      "This answer is supported by **Chunk 1**.",
    ].join("\n");

    expect(removeChunkReferences(answer)).toBe(
      "Based on the provided document, the key point is:\n\nThe module contains only local utility logic.",
    );
  });

  test("removes inline chunk source labels", () => {
    expect(removeChunkReferences("The result is 42. [Chunk 2]")).toBe(
      "The result is 42.",
    );
  });

  test("removes Markdown asterisks from AI answers", () => {
    expect(
      removeChunkReferences("***authHelpers.js` contains **local utility logic.**"),
    ).toBe("authHelpers.js` contains local utility logic.");
  });
});
