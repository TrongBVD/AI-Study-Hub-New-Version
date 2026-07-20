import { useState, useEffect } from "react";
import FormInput from "../../common/FormInput/FormInput.jsx";
import api from "../../../utils/api.js";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import "./Register.css";

function CompleteProfile() {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ username: "", password: "" });
  const [profileBio, setProfileBio] = useState("");
  const [createdUser, setCreatedUser] = useState(null);
  const [showBioPopup, setShowBioPopup] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [bioErrorMsg, setBioErrorMsg] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);

  const email = location.state?.email;
  const setupToken = location.state?.setupToken;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const bioWordCount = profileBio.trim()
    ? profileBio.trim().split(/\s+/).length
    : 0;

  useEffect(() => {
    if (!email || !setupToken) return undefined;

    const delayDebounceFn = setTimeout(async () => {
      if (formData.username.trim() !== "") {
        try {
          const res = await api.get(
            `/auth/check-username?username=${encodeURIComponent(formData.username)}`,
          );
          if (res.data.exists) {
            setUsernameStatus("❌ Username này đã tồn tại.");
          } else {
            setUsernameStatus("✅ Username hợp lệ.");
          }
        } catch {
          console.error("Lỗi kiểm tra username");
        }
      } else {
        setUsernameStatus("");
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [email, formData.username, setupToken]);

  if (!email || !setupToken) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.username) return setErrorMsg("Username là bắt buộc!");
    if (usernameStatus.includes("❌"))
      return setErrorMsg("Vui lòng chọn Username khác.");
    if (!formData.password) return setErrorMsg("Mật khẩu là bắt buộc!");

    try {
      const response = await api.post("/auth/complete-setup", {
        email: email,
        username: formData.username,
        password: formData.password,
        setupToken: setupToken,
      });

      const accessToken = response.data.data.accessToken;
      const user = response.data.data.user;

      localStorage.setItem("accessToken", accessToken);

      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      }

      setCreatedUser(user || null);
      setShowBioPopup(true);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || "Lỗi cập nhật.");
    }
  };

  const handleSaveBio = async (e) => {
    e.preventDefault();

    const trimmedBio = profileBio.trim();
    setBioErrorMsg("");

    if (!trimmedBio) {
      setBioErrorMsg("Vui lòng nhập mô tả bản thân trước khi tiếp tục.");
      return;
    }

    if (bioWordCount > 350) {
      setBioErrorMsg("Mô tả bản thân không được vượt quá 350 chữ.");
      return;
    }

    setIsSavingBio(true);

    let nextUser = createdUser || {};

    try {
      const response = await api.patch("/users/profile-bio", {
        bio: trimmedBio,
      });

      nextUser = {
        ...nextUser,
        ...(response.data?.data || {}),
        bio: trimmedBio,
      };
    } catch (error) {
      console.warn("Không thể lưu mô tả lên server, lưu tạm localStorage:", error);
      nextUser = {
        ...nextUser,
        bio: trimmedBio,
      };
    }

    localStorage.setItem("user", JSON.stringify(nextUser));
    localStorage.setItem("aiStudyHubProfileBio", trimmedBio);
    setIsSavingBio(false);
    navigate("/dashboard/profile", { replace: true });
  };

  return (
    <div className="register_page">
      <form className="register_card" onSubmit={handleSubmit}>
        <p className="register_title">Hoàn tất hồ sơ</p>

        <FormInput
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          label="Username *"
          required
        />
        <span
          style={{
            fontSize: "13px",
            color: usernameStatus.includes("✅") ? "green" : "red",
            display: "block",
            marginTop: "-15px",
          }}
        >
          {usernameStatus}
        </span>

        <p
          className="register_message"
          style={{ fontSize: "13px", color: "var(--text-secondary)" }}
        >
          Mật khẩu cần &gt;= 8 ký tự, 1 chữ thường, 1 số, 1 ký tự đặc biệt.
        </p>

        <FormInput
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          label="Password *"
          required
        />

        {errorMsg && (
          <p
            style={{
              color: "red",
              textAlign: "center",
              fontSize: "14px",
              margin: "0",
            }}
          >
            {errorMsg}
          </p>
        )}

        <button className="register_submit" type="submit">
          Hoàn tất
        </button>
      </form>

      {showBioPopup && (
        <div className="register_bio_overlay" role="dialog" aria-modal="true">
          <form className="register_bio_modal" onSubmit={handleSaveBio}>
            <p className="register_title">Mô tả bản thân</p>
            <p className="register_message">
              Hãy viết một đoạn giới thiệu ngắn về bạn, mục tiêu học tập và lĩnh
              vực bạn quan tâm. Nội dung này sẽ hiển thị ở trang cá nhân.
            </p>

            <textarea
              value={profileBio}
              onChange={(e) => setProfileBio(e.target.value)}
              placeholder="Ví dụ: Mình đang học React, thích AI và muốn xây dựng thói quen tự học tốt hơn..."
              autoFocus
            />

            <div className="register_bio_footer">
              <span className={bioWordCount > 350 ? "over_limit" : ""}>
                {bioWordCount} / 350 chữ
              </span>

              <button
                className="register_submit"
                type="submit"
                disabled={isSavingBio}
              >
                {isSavingBio ? "Đang lưu..." : "Lưu mô tả"}
              </button>
            </div>

            {bioErrorMsg && <p className="register_bio_error">{bioErrorMsg}</p>}
          </form>
        </div>
      )}
    </div>
  );
}

export default CompleteProfile;
