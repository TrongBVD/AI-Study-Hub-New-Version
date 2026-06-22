import { useState } from "react";
import FormInput from "../../common/FormInput/FormInput.jsx";
import api from "../../../utils/api.js";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await api.post("/auth/forgot-password", { email });
      alert("Mã OTP khôi phục đã được gửi vào Email của bạn.");
      navigate("/reset-password", { state: { email } });
    } catch (error) {
      alert(error.response?.data?.message || "Lỗi hệ thống. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login_page">
      <form className="login_form" onSubmit={handleSubmit}>
        <p className="login_title">Quên mật khẩu</p>
        <p className="login_message" style={{textAlign: "left", marginBottom: "15px"}}>
          Nhập email đã đăng ký của bạn. Hệ thống sẽ gửi một mã OTP gồm 6 chữ số để xác minh.
        </p>
        
        <div className="login_flex">
          <FormInput
            type="email"
            label="Email đăng ký"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <button className="login_submit" type="submit" disabled={loading}>
          {loading ? "Đang gửi..." : "Gửi mã OTP"}
        </button>

        <p className="login_message" style={{marginTop: "20px"}}>
          <span onClick={() => navigate('/login')} style={{ color: '#0056b3', cursor: 'pointer', textDecoration: 'underline' }}>
            Quay lại Đăng nhập
          </span>
        </p>
      </form>
    </div>
  );
}

export default ForgotPassword;
