const {
  normalizeEmail,
  validateUsername,
  signAccessToken,
  signRefreshToken,
  signSetupToken,
  verifySetupToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
  buildPublicUser,
} = require("../../src/utils/authHelpers");

describe("Black-box tests - authentication public functions", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = "lab4-black-box-secret";
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  test("BB-01 public user response follows the documented safe-field contract", () => {
    expect(buildPublicUser({ id: "u1", email: "a@test.com", username: "alice", full_name: "Alice" })).toEqual({
      id: "u1", email: "a@test.com", username: "alice", full_name: "Alice", bio: "", role: "USER", status: "ACTIVE",
    });
  });

  test("BB-02 email with consecutive dots is rejected", () => {
    expect(() => normalizeEmail("user..name@example.com")).toThrow("Invalid email address");
  });

  test("BB-03 email with a domain label starting with hyphen is rejected", () => {
    expect(() => normalizeEmail("user@-example.com")).toThrow("Invalid email address");
  });

  test("BB-04 username beginning with a dot is rejected", () => {
    expect(validateUsername(".student").valid).toBe(false);
  });

  test("BB-05 username containing consecutive dots is rejected", () => {
    expect(validateUsername("student..01").valid).toBe(false);
  });

  test("BB-06 access token is not issued without a session id", () => {
    expect(() => signAccessToken({ id: "u1", email: "a@test.com" })).toThrow();
  });

  test("BB-07 refresh token is not issued without a session id", () => {
    expect(() => signRefreshToken({ id: "u1" })).toThrow();
  });

  test("BB-08 setup token is not issued for an invalid email", () => {
    expect(() => signSetupToken("invalid-email")).toThrow("Invalid email address");
  });

  test("BB-09 setup token verification treats email casing as equivalent", () => {
    const token = signSetupToken("Student@Example.com");
    expect(() => verifySetupToken(token, "student@example.com")).not.toThrow();
  });

  test("BB-10 password-reset token verification treats email casing as equivalent", () => {
    const token = signPasswordResetToken("Student@Example.com");
    expect(() => verifyPasswordResetToken(token, "student@example.com")).not.toThrow();
  });
});
