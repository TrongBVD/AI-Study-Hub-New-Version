import { useState, useEffect } from "react";
import FormInput from "../../common/FormInput/FormInput.jsx";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import api, { refreshAccessToken } from "../../../utils/api.js";
import { useNavigate } from "react-router-dom";
import { isTokenValid } from "../../../utils/authToken";
import "./LoginPage.css";

const GOOGLE_CLIENT_ID =
  "816282057609-4clrdj4f4mp1jh72m40ffaf04fne6vhe.apps.googleusercontent.com";

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginNotice, setLoginNotice] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    // Kiểm tra xem token có tồn tại trong localStorage không
    const token = localStorage.getItem("accessToken");
    
    // Nếu có token và token còn hạn, đá thẳng vào trang chủ Dashboard
    if (isTokenValid(token)) {
      navigate("/dashboard/home", { replace: true });
    } else {
      refreshAccessToken()
        .then(() => {
          if (isMounted) navigate("/dashboard/home", { replace: true });
        })
        .catch(() => {
        // Nếu token đã hết hạn, dọn dẹp vùng nhớ tránh bị loop hoặc tự động log in lỗi
          if (!isTokenValid(localStorage.getItem("accessToken"))) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("user");
            localStorage.removeItem("aiStudyHubProfileName");
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  function extractAccessToken(responseData) {
    return (
      responseData?.accessToken ||
      responseData?.token ||
      responseData?.data?.accessToken ||
      responseData?.data?.token ||
      responseData?.data?.user?.accessToken ||
      responseData?.data?.profile?.accessToken
    );
  }

  function extractUserInfo(responseData) {
    return (
      responseData?.user ||
      responseData?.profile ||
      responseData?.data?.user ||
      responseData?.data?.profile ||
      responseData?.data
    );
  }

  function saveLoginData(responseData) {
    const accessToken = extractAccessToken(responseData);

    if (!accessToken) {
      console.log("Login response:", responseData);
      alert("Login succeeded but no token was returned.");
      return false;
    }

    localStorage.setItem("accessToken", accessToken);

    const user = extractUserInfo(responseData);

    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    }

    if (user) {
      const profileName =
        user.username ||
        user.display_name ||
        user.full_name ||
        user.name ||
        user.email ||
        username ||
        "User";

      localStorage.setItem("aiStudyHubProfileName", profileName);
    }

    return user || {};
  }

  // --- HÀM XỬ LÝ ĐĂNG NHẬP CHO GUEST ---
  const handleGuestLogin = () => {
    // Tạo 1 Fake JWT Token để qua mặt hàm isTokenValid() trong authToken.js
    // Payload decode ra sẽ là {"exp": 9999999999} (Sống tới năm 2286)
    const fakeGuestToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.guest_signature_bypass";
    
    // Tạo Profile Ảo
    const guestUser = {
      _id: "guest_" + Date.now(),
      role: "GUEST", // Phân biệt role để chặn quyền phía sau
      username: "GuestUser",
      display_name: "Khách (Guest)",
      email: "guest@studyhub.local",
    };

    // Lưu vào LocalStorage
    localStorage.setItem("accessToken", fakeGuestToken);
    localStorage.setItem("user", JSON.stringify(guestUser));
    localStorage.setItem("aiStudyHubProfileName", guestUser.display_name);

    // Chuyển hướng vào trang chủ
    navigate("/dashboard/home", { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedUsername = username.trim();
    setLoginNotice(null);

    if (!trimmedUsername || !password) {
      setLoginNotice({
        type: "warning",
        title: "Thiếu thông tin đăng nhập",
        message: "Vui lòng nhập đầy đủ Username/Email và Password.",
      });
      return;
    }

    try {
      const res = await api.post("/auth/login", {
        username: trimmedUsername,
        email: trimmedUsername,
        login: trimmedUsername,
        password,
      });

      const user = saveLoginData(res.data);

      if (!user) return;

      if (user.role === "SYSTEM_ADMIN") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/dashboard/home", { replace: true });
      }
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);

      const backendMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Đăng nhập thất bại. Vui lòng kiểm tra username/password.";

      const isWrongPassword =
        error.response?.status === 401 &&
        backendMessage.toLowerCase().includes("mật khẩu");

      setLoginNotice({
        type: "error",
        title: isWrongPassword ? "Sai mật khẩu" : "Đăng nhập thất bại",
        message: isWrongPassword
          ? "Mật khẩu bạn vừa nhập chưa đúng. Vui lòng kiểm tra lại hoặc dùng Quên mật khẩu để đặt lại."
          : backendMessage,
      });
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const googleToken = credentialResponse.credential;

      if (!googleToken) {
        alert("Google login failed: missing Google token.");
        return;
      }

      const res = await api.post("/auth/google", {
        token: googleToken,
      });

      const responseData = res.data?.data || res.data;

      if (responseData?.requiresOTP) {
        if (responseData?.isResume) {
          alert(
            "Bạn có quá trình thiết lập tài khoản chưa hoàn tất. Hệ thống đang chuyển đến trang tiếp tục!",
          );
        } else {
          alert(
            "Email này chưa đăng ký tài khoản. Hệ thống tự động chuyển sang luồng đăng ký mới!",
          );
        }

        navigate("/verify-otp", {
          state: {
            email: responseData.email,
          },
        });

        return;
      }

      const user = saveLoginData(res.data);

      if (!user) return;

      if (user.role === "SYSTEM_ADMIN") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/dashboard/home", { replace: true });
      }
    } catch (error) {
      console.error("Lỗi xác thực Google với Backend:", error);

      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Google login failed. Please try again.";

      alert(errorMsg);
    }
  };

  const handleGoogleError = () => {
    console.log("Người dùng đóng popup hoặc có lỗi xảy ra từ phía Google");
    alert("Google login was cancelled or failed.");
  };

  return (
    <div className="login_page">
      <form className="login_form" onSubmit={handleSubmit}>
        <p className="login_title">Log in</p>

        {loginNotice && (
          <div className={`login_notice ${loginNotice.type}`} role="alert">
            <strong>{loginNotice.title}</strong>
            <span>{loginNotice.message}</span>
          </div>
        )}

        <div className="login_flex">
          <FormInput
            type="text"
            label="Username or gmail"
            className="username_input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <FormInput
            type="password"
            label="Password"
            className="password_input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="login_submit" type="submit">
          Submit
        </button>

        {/* --- NÚT GUEST LOGIN --- */}
        <button 
          className="guest_login_btn" 
          type="button" 
          onClick={handleGuestLogin}
          style={{
            marginTop: "10px",
            width: "100%",
            padding: "12px",
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-secondary)",
            border: "1px solid var(--input-border)",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
            transition: "0.2s"
          }}
        >
          Log in as Guest
        </button>

        <p className="login_message">
          Didn't have an account?{" "}
          <span
            onClick={() => navigate("/register")}
            style={{
              color: "var(--accent-color)",
              cursor: "pointer",
              textDecoration: "underline",
              fontWeight: "500",
            }}
          >
            Create one
          </span>
        </p>

        <p className="forgot_password_message">
          <span
            onClick={() => navigate("/forgot-password")}
            style={{
              color: "var(--accent-color)",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Forgot password?
          </span>
        </p>

        <div className="account_link_container">
          <p className="link_account_text">Or with</p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "10px",
            }}
          >
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap={false}
              />
            </GoogleOAuthProvider>
          </div>
        </div>
      </form>
    </div>
  );
}

export default LoginPage;
