const jwt = require("jsonwebtoken");

const {
  normalizeEmail,
  normalizeUsername,
  validateUsername,
  validatePassword,
  generateOtp,
  getOtpExpiryDate,
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../../src/utils/authHelpers");

describe("System test - 10 authentication modules", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = "lab4-system-test-secret";
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  test("ST-01 normalizeEmail normalizes a valid email", () => {
    expect(normalizeEmail("  Student@Example.COM ")).toBe("student@example.com");
  });

  test("ST-02 normalizeUsername trims surrounding whitespace", () => {
    expect(normalizeUsername("  student_01  ")).toBe("student_01");
  });

  test("ST-03 validateUsername accepts a supported username", () => {
    expect(validateUsername("student.01")).toEqual({ valid: true, username: "student.01" });
  });

  test("ST-04 validatePassword accepts a strong password", () => {
    expect(validatePassword("studyhub1!")).toEqual({ valid: true });
  });

  test("ST-05 generateOtp returns a six-digit code", () => {
    expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  test("ST-06 getOtpExpiryDate returns a time about ten minutes ahead", () => {
    const before = Date.now() + 10 * 60 * 1000;
    const expiry = getOtpExpiryDate().getTime();
    const after = Date.now() + 10 * 60 * 1000;
    expect(expiry).toBeGreaterThanOrEqual(before);
    expect(expiry).toBeLessThanOrEqual(after);
  });

  test("ST-07 hashPassword produces a bcrypt hash different from the password", async () => {
    const hash = await hashPassword("studyhub1!");
    expect(hash).not.toBe("studyhub1!");
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  test("ST-08 signAccessToken creates a decodable access token", () => {
    const token = signAccessToken({ id: "u1", email: "student@example.com", session_id: "s1" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ userId: "u1", role: "USER", status: "ACTIVE", session_id: "s1" });
  });

  test("ST-09 signRefreshToken creates a refresh token", () => {
    const token = signRefreshToken({ id: "u1", session_id: "s1" }, true);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ userId: "u1", session_id: "s1", type: "refresh", rememberMe: true });
  });

  test("ST-10 verifyRefreshToken accepts a valid refresh token", () => {
    const token = signRefreshToken({ id: "u1", session_id: "s1" });
    expect(verifyRefreshToken(token)).toMatchObject({ userId: "u1", session_id: "s1", type: "refresh" });
  });
});
