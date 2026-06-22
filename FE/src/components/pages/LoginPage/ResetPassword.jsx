import { useState } from "react";
import FormInput from "../../common/FormInput/FormInput.jsx";
import api from "../../../utils/api.js";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import "./LoginPage.css";


function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email;

  const [formData, setFormData] = useState({
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resetToken, setResetToken] = useState("");
  const isOtpVerified = Boolean(resetToken);

  if (!email) {
    return <Navigate to="/forgot-password" replace />;
  }

  const handleChange = (e) => {
    const nextValue =
      e.target.name === "otp"
        ? e.target.value.replace(/\D/g, "").slice(0, 6)
        : e.target.value;

    setFormData({
      ...formData,
      [e.target.name]: nextValue,
    });
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.otp.trim()) {
      return setErrorMsg("Vui lòng nhập OTP.");
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/verify-reset-otp", {
        email,
        otp: formData.otp,
      });

      setResetToken(response.data.data.resetToken);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || "Không thể xác minh OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.newPassword) {
      return setErrorMsg("Vui lòng nhập mật khẩu mới.");
    }

    if (formData.newPassword !== formData.confirmPassword) {
      return setErrorMsg("Mật khẩu xác nhận không khớp.");
    }

    try {
      setLoading(true);

      await api.post("/auth/reset-password", {
        email,
        resetToken,
        newPassword: formData.newPassword,
      });
      alert("Đổi mật khẩu thành công. Vui lòng đăng nhập lại.");
      navigate("/login", { replace: true });
    } catch (error) {
      setErrorMsg(error.response?.data?.message || "Không thể đổi mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login_page">
      <form
        className="login_form"
        onSubmit={isOtpVerified ? handleResetPassword : handleVerifyOTP}
      >
        <p className="login_title">Đặt lại mật khẩu</p>

        <p
          className="login_message"
          style={{ textAlign: "left", marginBottom: "15px" }}
        >
          {isOtpVerified ? (
            <>OTP đã được xác minh. Hãy nhập mật khẩu mới cho <b>{email}</b>.</>
          ) : (
            <>Nhập mã OTP gồm 6 chữ số đã gửi tới <b>{email}</b>.</>
          )}
        </p>
        <div className="login_flex">
          {!isOtpVerified ? (
            <FormInput
              type="text"
              name="otp"
              label="OTP"
              value={formData.otp}
              onChange={handleChange}
              required
            />
          ) : (
            <>
              <FormInput
                type="password"
                name="newPassword"
                label="Mật khẩu mới"
                value={formData.newPassword}
                onChange={handleChange}
                required
              />
              <FormInput
                type="password"
                name="confirmPassword"
                label="Xác nhận mật khẩu"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </>
          )}
        </div>
        {isOtpVerified && (
          <p
            className="login_message"
            style={{ fontSize: "13px", color: "#7c6a58", textAlign: "left" }}
          >
            Mật khẩu mới cần có ít nhất 8 ký tự, bao gồm chữ thường, số và ký tự
            đặc biệt.
          </p>
        )}
        {errorMsg && (
          <p style={{ color: "red", textAlign: "center", fontSize: "14px" }}>
            {errorMsg}
          </p>
        )}
        <button className="login_submit" type="submit" disabled={loading}>
          {loading
            ? "Đang xử lý..."
            : isOtpVerified
              ? "Đổi mật khẩu"
              : "Xác minh OTP"}
        </button>
        <p className="login_message" style={{ marginTop: "20px" }}>
          <span
            onClick={() => navigate("/login")}
            style={{
              color: "#0056b3",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Quay lại đăng nhập
          </span>
        </p>
      </form>
    </div>
  );
}

export default ResetPassword;
