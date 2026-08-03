import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google"; // Thêm import GoogleOAuthProvider
import { showPopupAlert } from "../../common/ActionPopup/actionPopupService.js";
import api from "../../../utils/api.js";
import { storeAuthSession } from "../../../utils/authToken.js";
import { useNavigate } from "react-router-dom";
import "./Register.css";

const GOOGLE_CLIENT_ID = String(
  import.meta.env.VITE_GOOGLE_CLIENT_ID
)
  .trim()
  .replace(/^["']|["']$/g, "");

function Register() {
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const googleToken = credentialResponse.credential;
      if (!googleToken) return;

      const res = await api.post("/auth/google", { token: googleToken, rememberMe: true });
      const responseData = res.data?.data || res.data;

      if (responseData?.requiresOTP) {
        navigate("/verify-otp", {
          state: { email: responseData.email },
        });
        return;
      }

      const accessToken = responseData?.accessToken || responseData?.token;
      const user = responseData?.user || responseData?.profile || responseData;

      if (!accessToken) return;

      storeAuthSession({
        accessToken,
        user,
        rememberMe: true,
      });

      navigate("/dashboard/home", { replace: true });
    } catch (error) {
      console.error("Backend registration error:", error);
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Registration failed. Please try again.";
      showPopupAlert(errorMsg);
    }
  };

  return (
    <div className="register_page">
      <div className="register_card">
        <p className="register_title">Register</p>
        <p className="register_message">
          Sign up instantly using your Google account to secure and access your profile.
        </p>
        <div className="account_link_container">
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            {/* Bọc Provider quanh nút GoogleLogin */}
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => console.log("Google Auth Error")} />
            </GoogleOAuthProvider>
          </div>
        </div>
        <p className="register_signin">
          Already have an account?
          <span
            onClick={() => navigate('/login')}
            style={{ color: 'var(--accent-color)', cursor: 'pointer', textDecoration: 'underline', marginLeft: '5px', fontWeight: '500' }}
          >
            Sign in
          </span>
        </p>
      </div>
    </div>
  );
}

export default Register;
