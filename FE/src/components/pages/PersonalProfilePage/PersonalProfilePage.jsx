import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../utils/api.js";
import "./PersonalProfilePage.css";

const PROFILE_AVATAR_KEY = "aiStudyHubProfileAvatar";
const PROFILE_BIO_KEY = "aiStudyHubProfileBio";
const PROFILE_NAME_KEY = "aiStudyHubProfileName";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null") || {};
  } catch (error) {
    console.error("Cannot read logged-in user from localStorage:", error);
    return {};
  }
}

function getLoggedInUserEmail() {
  return getStoredUser()?.email || "";
}

function getStoredProfileBio() {
  const storedUser = getStoredUser();
  return storedUser?.bio || localStorage.getItem(PROFILE_BIO_KEY) || "";
}

function getStoredProfileName() {
  const storedUser = getStoredUser();
  return (
    localStorage.getItem(PROFILE_NAME_KEY) ||
    storedUser.full_name ||
    storedUser.username ||
    "User"
  );
}

function PersonalProfile() {
  const navigate = useNavigate();

  const [userName, setUserName] = useState(getStoredProfileName);
  const [userEmail] = useState(getLoggedInUserEmail);

  const dateOfBirth = new Date("2003-11-19");
  const [profileBio, setProfileBio] = useState(getStoredProfileBio);
  const [draftBio, setDraftBio] = useState(profileBio);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioStatus, setBioStatus] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [avatar, setAvatar] = useState(() => {
    return localStorage.getItem(PROFILE_AVATAR_KEY) || "";
  });

  const libraries = JSON.parse(
    localStorage.getItem("aiStudyHubLibraries") || "[]",
  ).filter((library) => library.shareOnProfile === true);

  useEffect(() => {
    function syncProfileName() {
      setUserName(getStoredProfileName());
    }

    window.addEventListener("aiStudyHubProfileNameChanged", syncProfileName);
    window.addEventListener("storage", syncProfileName);

    return () => {
      window.removeEventListener(
        "aiStudyHubProfileNameChanged",
        syncProfileName,
      );
      window.removeEventListener("storage", syncProfileName);
    };
  }, []);

  function handleChangeAvatar(e) {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const imageUrl = reader.result;

      if (typeof imageUrl !== "string") return;

      setAvatar(imageUrl);
      localStorage.setItem(PROFILE_AVATAR_KEY, imageUrl);
      window.dispatchEvent(new Event("aiStudyHubProfileAvatarChanged"));
    };

    reader.readAsDataURL(file);
  }

  const bioWordCount = draftBio.trim() ? draftBio.trim().split(/\s+/).length : 0;

  async function handleSaveBio() {
    const trimmedBio = draftBio.trim();
    setBioStatus("");

    if (!trimmedBio) {
      setBioStatus("Vui lòng nhập mô tả bản thân.");
      return;
    }

    if (bioWordCount > 350) {
      setBioStatus("Mô tả bản thân không được vượt quá 350 chữ.");
      return;
    }

    setIsSavingBio(true);

    let nextUser = getStoredUser();

    try {
      const response = await api.patch("/users/profile-bio", {
        bio: trimmedBio,
      });

      nextUser = {
        ...nextUser,
        ...(response.data?.data || {}),
        bio: trimmedBio,
      };
      setBioStatus("Đã lưu mô tả.");
    } catch (error) {
      console.warn("Không thể lưu mô tả lên server, lưu tạm localStorage:", error);
      nextUser = {
        ...nextUser,
        bio: trimmedBio,
      };
      setBioStatus("Đã lưu tạm trên trình duyệt.");
    }

    localStorage.setItem("user", JSON.stringify(nextUser));
    localStorage.setItem(PROFILE_BIO_KEY, trimmedBio);
    setProfileBio(trimmedBio);
    setDraftBio(trimmedBio);
    setIsEditingBio(false);
    setIsSavingBio(false);
  }

  function handleCancelBioEdit() {
    setDraftBio(profileBio);
    setBioStatus("");
    setIsEditingBio(false);
  }

  return (
    <main className="profile_page">
      <aside className="profile_sidebar">
        <label className="profile_main_avatar">
          {avatar ? <img src={avatar} alt="User avatar" /> : null}

          <div className="avatar_overlay">Change avatar</div>

          <input type="file" accept="image/*" onChange={handleChangeAvatar} />
        </label>

        <div className="profile_name_area">
          <div className="profile_name_row">
            <h2>{userName}</h2>
            <h2>{userEmail || "Email unavailable"}</h2>
            <h2>{dateOfBirth.toDateString()}</h2>
          </div>
        </div>

        <div className="profile_bio_panel">
          <div className="profile_bio_header">
            <h3>About me</h3>
            {!isEditingBio && (
              <button type="button" onClick={() => setIsEditingBio(true)}>
                Edit
              </button>
            )}
          </div>

          {isEditingBio ? (
            <div className="profile_bio_editor">
              <textarea
                value={draftBio}
                onChange={(e) => setDraftBio(e.target.value)}
                placeholder="Write a short description about yourself..."
              />

              <div className="profile_bio_meta">
                <span className={bioWordCount > 350 ? "over_limit" : ""}>
                  {bioWordCount} / 350 chữ
                </span>

                <div>
                  <button
                    type="button"
                    onClick={handleSaveBio}
                    disabled={isSavingBio}
                  >
                    {isSavingBio ? "Saving..." : "Save"}
                  </button>
                  <button type="button" onClick={handleCancelBioEdit}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className={profileBio ? "" : "profile_bio_empty"}>
              {profileBio || "No profile description yet."}
            </p>
          )}

          {bioStatus && <p className="profile_bio_status">{bioStatus}</p>}
        </div>
      </aside>

      <section className="profile_content">
        <div className="libraries_section">
          <div className="libraries_header">
            <h3>Shared libraries</h3>
          </div>

          {libraries.length === 0 ? (
            <div className="profile_empty_library">
              <h3>No library upload</h3>
            </div>
          ) : (
            <div className="library_grid">
              {libraries.map((library) => (
                <LibraryCard
                  key={library.id || library.name}
                  library={library}
                  onView={() => navigate(`/dashboard/libraries/${library.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function LibraryCard({ library, onView }) {
  return (
    <div className="library_profile_card">
      <div className="library_card_title">
        <h4>{library.name}</h4>
        <span>{library.visibility === "private" ? "Private" : "Public"}</span>
      </div>

      {library.description && (
        <p className="library_description">{library.description}</p>
      )}

      <button type="button" className="library_view_btn" onClick={onView}>
        View
      </button>
    </div>
  );
}

export default PersonalProfile;
