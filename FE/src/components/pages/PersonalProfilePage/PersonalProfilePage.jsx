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

function getLoggedInUserId() {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    return storedUser?.id || storedUser?._id || storedUser?.user_id || "";
  } catch (error) {
    console.error("Cannot read logged-in user id from localStorage:", error);
    return "";
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
  const { id: profileId } = useParams();
  const loggedInUserId = getLoggedInUserId();
  const isOwnProfile = !profileId || profileId === loggedInUserId;

  const [userName, setUserName] = useState(getStoredProfileName);
  const [userEmail, setUserEmail] = useState(getLoggedInUserEmail);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [isDateOfBirthPublic, setIsDateOfBirthPublic] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(userName);
  const [profileBio, setProfileBio] = useState(getStoredProfileBio);
  const [draftBio, setDraftBio] = useState(getStoredProfileBio);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [bioStatus, setBioStatus] = useState("");
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
        setProfileBio(profile?.bio || "");
        setDraftBio(profile?.bio || "");
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

    try {
      const profile = await updateMyProfile({ full_name: trimmedName });
      const nextName =
        profile?.full_name || profile?.username || profile?.email || trimmedName;

      setUserName(nextName);
      setNewName(nextName);
      localStorage.setItem(PROFILE_NAME_KEY, nextName);
      setIsEditingName(false);
    } catch (error) {
      console.error("Cannot update profile name:", error);
      alert(error.response?.data?.message || "Cannot update profile name.");
    }
  }

  async function handleSaveBio() {
    if (!isOwnProfile) return;

    const trimmedBio = draftBio.trim();
    const wordCount = trimmedBio === "" ? 0 : trimmedBio.split(/\s+/).length;
    setBioStatus("");

    if (wordCount > 350) {
      setBioStatus("Bio must be 350 words or fewer.");
      return;
    }

    try {
      setIsSavingBio(true);
      const profile = await updateMyProfile({ bio: trimmedBio });
      const nextBio = profile?.bio || trimmedBio;

      setProfileBio(nextBio);
      setDraftBio(nextBio);
      localStorage.setItem(PROFILE_BIO_KEY, nextBio);
      setIsEditingBio(false);
      setBioStatus("Bio updated.");
    } catch (error) {
      console.error("Cannot update profile bio:", error);
      setBioStatus(error.response?.data?.message || "Cannot update bio.");
    } finally {
      setIsSavingBio(false);
    }
  }

  function handleCancelBioEdit() {
    setDraftBio(profileBio);
    setBioStatus("");
    setIsEditingBio(false);
  }

  const displayAvatar = avatar || defaultAvatar;
  const birthdayText =
    dateOfBirth && (isOwnProfile || isDateOfBirthPublic)
      ? new Date(dateOfBirth).toDateString()
      : "Birthday unavailable";
  const bioWordCount = draftBio.trim() === "" ? 0 : draftBio.trim().split(/\s+/).length;

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
          <div className="profile_name_row">
            <h2>{userName}</h2>
            <h2>{userEmail || "Email unavailable"}</h2>
            <h2>{birthdayText}</h2>
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
            <div className="profile_bio_view">
              <p>{profileBio || "No bio yet."}</p>
            </div>
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
