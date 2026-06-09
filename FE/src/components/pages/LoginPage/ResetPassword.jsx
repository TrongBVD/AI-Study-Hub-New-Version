import { useState } from "react";
import FormInput from "../../common/FormInput/FormInput.jsx";
import axios from "axios";
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

  if (!email) {
    return <Navigate to="/forgot-password" replace />;
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.otp.trim()) {
      return setErrorMsg("Vui lòng nhập OTP.");
    }

    if (!formData.newPassword) {
      return setErrorMsg("Vui lòng nhập mật khẩu mới.");
    }

    if (formData.newPassword !== formData.confirmPassword) {
      return setErrorMsg("Mật khẩu xác nhận không khớp.");
    }

    try {
      setLoading(true);

      await axios.post("http://ai-student-hub-xtw6.onrender.com/api/auth/reset-password", {
        email,
        otp: formData.otp,
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
      <form className="login_form" onSubmit={handleSubmit}>
        <p className="login_title">Đặt lại mật khẩu</p>

        <p
          className="login_message"
          style={{ textAlign: "left", marginBottom: "15px" }}
        >
          Nhập mã OTP đã gửi tới <b>{email}</b> và mật khẩu mới của bạn.
        </p>
        <div className="login_flex">
          <FormInput
            type="text"
            name="otp"
            label="OTP"
            value={formData.otp}
            onChange={handleChange}
            required
          />
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
        </div>
        <p
          className="login_message"
          style={{ fontSize: "13px", color: "#7c6a58", textAlign: "left" }}
        >
          Mật khẩu mới cần có ít nhất 8 ký tự, bao gồm chữ thường, số và ký tự
          đặc biệt.
        </p>
        {errorMsg && (
          <p style={{ color: "red", textAlign: "center", fontSize: "14px" }}>
            {errorMsg}
          </p>
        )}
        <button className="login_submit" type="submit" disabled={loading}>
          {loading ? "Đang xử lý..." : "Đổi mật khẩu"}
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
