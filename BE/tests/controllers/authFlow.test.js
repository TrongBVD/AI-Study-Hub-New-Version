jest.mock("../../src/config/supabase", () => {
  const chainable = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: jest.fn(() => chainable),
  };
});

jest.mock("../../src/services/authService", () => ({
  verifyAndLoginGoogle: jest.fn(),
  sendRegisterOtp: jest.fn(),
}));

jest.mock("../../src/utils/mailerService", () => ({
  createMailTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue(true),
  })),
}));

const supabase = require("../../src/config/supabase");
const authService = require("../../src/services/authService");
const authController = require("../../src/controllers/authController");
const jwt = require("jsonwebtoken");

describe("Auth Main Flow Tests", () => {
  let req, res;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-key-12345";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-12345";

    req = {
      body: {},
      query: {},
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("Google Login Flow", () => {
    test("returns 401 when Google login fails or invalid token", async () => {
      authService.verifyAndLoginGoogle.mockRejectedValue(new Error("Invalid token"));
      req.body = { token: "invalid_google_token" };

      await authController.googleLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error", message: "Invalid Google token." })
      );
    });
  });

  describe("OTP Verification Flow", () => {
    test("rejects OTP verification if user profile is not pending completion", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { id: "u1", email: "test@example.com", password_hash: "hashed_pwd" },
        error: null,
      });

      req.body = { email: "test@example.com", otp: "123456" };
      await authController.verifyOTP(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Account is not pending profile completion." })
      );
    });

    test("returns 400 when OTP is invalid or expired", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle
        .mockResolvedValueOnce({
          data: { id: "u1", email: "test@example.com", password_hash: "GOOGLE_SSO_NO_PASSWORD" },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      req.body = { email: "test@example.com", otp: "999999" };
      await authController.verifyOTP(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid or expired OTP code." })
      );
    });

    test("successfully verifies OTP and issues setupToken", async () => {
      const mockChain = supabase.from();
      mockChain.maybeSingle
        .mockResolvedValueOnce({
          data: { id: "u1", email: "test@example.com", password_hash: "GOOGLE_SSO_NO_PASSWORD" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "otp1", email: "test@example.com", otp_code: "123456" },
          error: null,
        });

      req.body = { email: "test@example.com", otp: "123456" };
      await authController.verifyOTP(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: expect.objectContaining({
            email: "test@example.com",
            requiresSetup: true,
            setupToken: expect.any(String),
          }),
        })
      );
    });
  });

  describe("Username Availability Check", () => {
    test("requires username query parameter", async () => {
      req.query = {};
      await authController.checkUsername(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns exists: true when username is already taken", async () => {
      const mockChain = supabase.from();
      mockChain.single.mockResolvedValueOnce({ data: { id: "user-existing" }, error: null });

      req.query = { username: "taken_user" };
      await authController.checkUsername(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ exists: true });
    });
  });

  describe("Complete Setup Flow", () => {
    test("rejects invalid or expired setupToken", async () => {
      req.body = {
        email: "test@example.com",
        username: "newuser",
        password: "Password123!",
        setupToken: "invalid.token.str",
      };

      await authController.completeSetup(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "OTP verification session is invalid or has expired." })
      );
    });

    test("rejects valid token if password strength requirements fail", async () => {
      const token = jwt.sign(
        { email: "test@example.com", type: "complete_setup" },
        process.env.JWT_SECRET
      );

      req.body = {
        email: "test@example.com",
        username: "validuser",
        password: "123", // Too short & lacks requirements
        setupToken: token,
      };

      await authController.completeSetup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error" })
      );
    });
  });
});
