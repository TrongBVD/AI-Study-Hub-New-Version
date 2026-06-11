import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PersonalProfilePage.css";
import defaultAvatar from "../../../assets/imgs/default_avatar.png";

function PersonalProfile() {
  const navigate = useNavigate();

  const [userName, setUserName] = useState(() => {
    return localStorage.getItem("aiStudyHubProfileName") || "dangkhoabi456";
  });

  const dateOfBirth = new Date("2003-11-19");
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(userName);
  const [avatar, setAvatar] = useState(defaultAvatar);

  const libraries = JSON.parse(
    localStorage.getItem("aiStudyHubLibraries") || "[]"
  ).filter((library) => library.shareOnProfile === true);

  function handleChangeAvatar(e) {
    const file = e.target.files[0];

    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setAvatar(imageUrl);
  }

  function handleSaveName() {
    const trimmedName = newName.trim();

    if (trimmedName === "") return;

    setUserName(trimmedName);
    localStorage.setItem("aiStudyHubProfileName", trimmedName);
    setIsEditingName(false);
  }

  function handleCancelEdit() {
    setNewName(userName);
    setIsEditingName(false);
  }

  return (
    <main className="profile_page">
      <aside className="profile_sidebar">
        <label className="profile_main_avatar">
          <img src={avatar} alt="User avatar" />

          <div className="avatar_overlay">Change avatar</div>

          <input type="file" accept="image/*" onChange={handleChangeAvatar} />
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
              <h2>{userName}@gmail.com</h2>
              <h2>{dateOfBirth.toDateString()}</h2>

              <button
                type="button"
                className="edit_name_btn"
                onClick={() => setIsEditingName(true)}
                title="Edit name"
              >
                ✏️
              </button>
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