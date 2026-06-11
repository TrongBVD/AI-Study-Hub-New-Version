import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./CreateLibraryPage.css";

function CreateLibraryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const TITLE_LIMIT = 50;
const DESCRIPTION_LIMIT = 350;

  const returnPath = location.state?.from || "/dashboard/home";

  const [libraryName, setLibraryName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");

  function handleReturn() {
    navigate(returnPath);
  }

function handleCreateLibrary(e) {
  e.preventDefault();

  const trimmedLibraryName = libraryName.trim();
  const trimmedDescription = description.trim();

  if (trimmedLibraryName === "") {
    alert("Please enter library name");
    return;
  }

  if (trimmedLibraryName.length > TITLE_LIMIT) {
    alert(`Library name cannot exceed ${TITLE_LIMIT} characters.`);
    return;
  }

  if (trimmedDescription.length > DESCRIPTION_LIMIT) {
    alert(`Library description cannot exceed ${DESCRIPTION_LIMIT} characters.`);
    return;
  }

  const newLibrary = {
    id: `library-${Date.now()}`,
    owner: "dangkhoabi456",
    name: trimmedLibraryName,
    description:
      trimmedDescription ||
      "This library helps students manage learning resources, upload documents, and use AI to summarize or ask questions from files.",
    visibility,
    documents: 0,
    updatedAt: "Updated just now",
    icon: "ti-archive",
    highlight: false,
    createdAt: new Date().toISOString(),
  };

  const savedLibraries = JSON.parse(
    localStorage.getItem("aiStudyHubLibraries") || "[]"
  );

  localStorage.setItem(
    "aiStudyHubLibraries",
    JSON.stringify([newLibrary, ...savedLibraries])
  );

  navigate(`/dashboard/libraries/${newLibrary.id}`, {
    state: {
      library: newLibrary,
      from: "/dashboard/create-library",
    },
  });
}

  return (
    <main className="create_library_page">
      <section className="create_library_container">
        <div className="create_library_header">
          <h1>Create a new library</h1>
          <p>
            A library contains your study files, documents, notes, and learning
            materials.
          </p>
        </div>

        <form className="create_library_form" onSubmit={handleCreateLibrary}>
          <div className="form_section">
            <h2>General information</h2>

            <div className="library_name_row">
              <div className="form_group owner_group">
                <label>Owner *</label>

                <button type="button" className="owner_btn">
                  <span className="owner_avatar"></span>
                  <span>dangkhoabi456</span>
                  <span>▾</span>
                </button>

                <p className="library_hint">
                  The person who set the foundation.
                </p>
              </div>

              <div className="form_group library_name_group">
                <label>Library name *</label>

<input
  type="text"
  value={libraryName}
  onChange={(e) => setLibraryName(e.target.value)}
  placeholder="Enter library name"
/>

<p className={libraryName.length > TITLE_LIMIT ? "character_count error" : "character_count"}>
  {libraryName.length} / {TITLE_LIMIT} characters
</p>
              </div>
            </div>

            <p className="library_hint">
              Great library names are short and memorable.
            </p>

            <div className="form_group">
              <label>Description</label>

              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write a short description"
              />

<p className={description.length > DESCRIPTION_LIMIT ? "character_count error" : "character_count"}>
  {description.length} / {DESCRIPTION_LIMIT} characters
</p>            </div>
          </div>

          <div className="form_section">
            <h2>Privacy & Visibility</h2>

            <div className="visibility_options">
              <label
                className={`visibility_card ${
                  visibility === "public" ? "selected" : ""
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={(e) => setVisibility(e.target.value)}
                />

                <div>
                  <h3>Public</h3>
                  <p>
                    Visible to all members and searchable within the University
                    Hub.
                  </p>
                </div>
              </label>

              <label
                className={`visibility_card ${
                  visibility === "private" ? "selected" : ""
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibility === "private"}
                  onChange={(e) => setVisibility(e.target.value)}
                />

                <div>
                  <h3>Private</h3>
                  <p>
                    Only visible to you and invited collaborators. Hidden from
                    search.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="create_library_actions">
            <button
              type="button"
              className="return_library_btn"
              onClick={handleReturn}
            >
              Return
            </button>

            <button type="submit" className="create_library_btn">
              Create library
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CreateLibraryPage;
