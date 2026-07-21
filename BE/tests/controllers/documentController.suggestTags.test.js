jest.mock("../../src/config/supabase", () => ({}));
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

const {
  extractTextFromFile,
} = require("../../src/services/textExtractService");
const {
  validateTagsAndContent,
} = require("../../src/services/aiService");
const {
  suggestDocumentTags,
} = require("../../src/controllers/documentController");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("documentController.suggestDocumentTags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("requires one uploaded document", async () => {
    const response = createResponse();

    await suggestDocumentTags({ files: [] }, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(extractTextFromFile).not.toHaveBeenCalled();
  });

  test("returns normalized optional suggestions", async () => {
    const readableText = "A sufficiently detailed mathematics document about algebra.";
    extractTextFromFile.mockResolvedValue(readableText);
    validateTagsAndContent.mockResolvedValue({
      aiRecommendedTags: [" math ", "#Math", "#linear algebra"],
    });
    const response = createResponse();

    await suggestDocumentTags(
      { files: [{ originalname: "notes.txt" }] },
      response,
    );

    expect(validateTagsAndContent).toHaveBeenCalledWith(
      readableText,
      "notes.txt",
      [],
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: "success",
      data: ["#math", "#linearalgebra"],
    });
  });

  test("combines and deduplicates suggestions from multiple documents", async () => {
    extractTextFromFile.mockResolvedValue("Readable educational content.");
    validateTagsAndContent
      .mockResolvedValueOnce({ aiRecommendedTags: ["#math", "#algebra"] })
      .mockResolvedValueOnce({ aiRecommendedTags: ["Math", "#geometry"] });
    const response = createResponse();

    await suggestDocumentTags(
      {
        files: [
          { originalname: "algebra.txt" },
          { originalname: "geometry.txt" },
        ],
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: "success",
      data: ["#math", "#algebra", "#geometry"],
    });
  });
});
