import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getMyProfile,
  getProfileById,
  updateMyAvatar,
  updateMyProfile,
} from "../../../utils/profileApi";
import defaultAvatar from "../../../assets/images/account.png";
import "./PersonalProfilePage.css";

function getLoggedInUserEmail() {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    return storedUser?.email || "";
  } catch (error) {
    console.error("Cannot read logged-in user from localStorage:", error);
    return "";
  }
}

function getLoggedInUserId() {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    return storedUser?.id || storedUser?._id || storedUser?.user_id || "";
  } catch (error) {
    console.error("Cannot read logged-in user id from localStorage:", error);
    return "";
  }
}

function PersonalProfile() {
  const navigate = useNavigate();
  const { id: profileId } = useParams();
  const loggedInUserId = getLoggedInUserId();
  const isOwnProfile = !profileId || profileId === loggedInUserId;

  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState(getLoggedInUserEmail);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [isDateOfBirthPublic, setIsDateOfBirthPublic] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(userName);
  const [avatar, setAvatar] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [libraries, setLibraries] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const profileData = isOwnProfile
          ? await getMyProfile()
          : await getProfileById(profileId);
        if (!isMounted) return;

        const profile = isOwnProfile ? profileData : profileData?.profile;
        const sharedLibraries = isOwnProfile
          ? JSON.parse(localStorage.getItem("aiStudyHubLibraries") || "[]").filter(
              (library) => library.shareOnProfile === true,
            )
          : profileData?.libraries || [];
        const nextAvatar = profile?.avatar_url || "";
        const nextName =
          profile?.full_name || profile?.username || profile?.email || "User";

        setUserName(nextName);
        setNewName(nextName);
        setUserEmail(isOwnProfile ? profile?.email || "" : "");
        setDateOfBirth(profile?.date_of_birth || "");
        setIsDateOfBirthPublic(profile?.is_dob_public !== false);
        setAvatar(nextAvatar);
        setLibraries(sharedLibraries);

        if (isOwnProfile) {
          window.dispatchEvent(
            new CustomEvent("aiStudyHubProfileChanged", {
              detail: { avatar: nextAvatar },
            }),
          );
        }
      } catch (error) {
        console.error("Cannot load profile:", error);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [isOwnProfile, profileId]);

  async function handleChangeAvatar(e) {
    if (!isOwnProfile) return;

    const file = e.target.files[0];

    if (!file) return;

    try {
      setIsUploadingAvatar(true);
      const profile = await updateMyAvatar(file);
      const nextAvatar = profile?.avatar_url || "";
      setAvatar(nextAvatar);

      window.dispatchEvent(
        new CustomEvent("aiStudyHubProfileChanged", {
          detail: { avatar: nextAvatar },
        }),
      );
    } catch (error) {
      console.error("Cannot update avatar:", error);
      alert(error.response?.data?.message || "Cannot update avatar. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = "";
    }
  }

  async function handleSaveName() {
    if (!isOwnProfile) return;

    const trimmedName = newName.trim();

    if (trimmedName === "") return;

    try {
      const profile = await updateMyProfile({ full_name: trimmedName });
      const nextName =
        profile?.full_name || profile?.username || profile?.email || trimmedName;

      setUserName(nextName);
      setNewName(nextName);
      setIsEditingName(false);
    } catch (error) {
      console.error("Cannot update profile name:", error);
      alert(error.response?.data?.message || "Cannot update profile name.");
    }
  }

  function handleCancelEdit() {
    setNewName(userName);
    setIsEditingName(false);
  }

  const displayAvatar = avatar || defaultAvatar;
  const birthdayText =
    dateOfBirth && (isOwnProfile || isDateOfBirthPublic)
      ? new Date(dateOfBirth).toDateString()
      : "Birthday unavailable";

  return (
    <main className="profile_page">
      <aside className="profile_sidebar">
        <label className="profile_main_avatar">
          <img
            src={displayAvatar}
            alt="User avatar"
            className={avatar ? "" : "default_profile_avatar"}
          />

          {isOwnProfile && (
            <>
              <div className="avatar_overlay">
                {isUploadingAvatar ? "Uploading..." : "Change avatar"}
              </div>

              <input type="file" accept="image/*" onChange={handleChangeAvatar} />
            </>
          )}
        </label>

        <div className="profile_name_area">
          {isEditingName ? (
            <div className="edit_name_box">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />

              <div className="edit_name_actions">
                <button type="button" onClick={handleSaveName}>
                  Save
                </button>

                <button type="button" onClick={handleCancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="profile_name_row">
              <h2>{userName}</h2>
              {isOwnProfile && <h2>{userEmail || "Email unavailable"}</h2>}
              <h2>{birthdayText}</h2>

              {isOwnProfile && (
              <button
                type="button"
                className="edit_name_btn"
                onClick={() => setIsEditingName(true)}
                title="Edit name"
              >
                ✏️
              </button>
              )}
            </div>
          )}
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
