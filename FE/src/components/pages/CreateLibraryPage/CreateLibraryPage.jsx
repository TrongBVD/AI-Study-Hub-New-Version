import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./CreateLibraryPage.css";

const PROFILE_NAME_KEY = "aiStudyHubProfileName";
const PROFILE_AVATAR_KEY = "aiStudyHubProfileAvatar";

function getInitials(name) {
  const normalizedName = name.trim();

  if (!normalizedName) return "U";

  const nameParts = normalizedName.split(/\s+/);

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }

  return nameParts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function CreateLibraryPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const TITLE_LIMIT = 20;
  const DESCRIPTION_LIMIT = 350;
  const returnPath = location.state?.from || "/dashboard/home";

  const [libraryName, setLibraryName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const ownerName = localStorage.getItem(PROFILE_NAME_KEY) || "dangkhoabi456";
  const ownerAvatar = localStorage.getItem(PROFILE_AVATAR_KEY) || "";
  const ownerInitials = getInitials(ownerName);

  const trimmedLibraryName = libraryName.trim();
  const trimmedDescription = description.trim();
  const canCreate = trimmedLibraryName.length > 0;

  const previewName = trimmedLibraryName || "Untitled library";
  const previewDescription =
    trimmedDescription ||
    "This library helps students manage learning resources, upload documents, and use AI to summarize or ask questions from files.";

  const titleCountClass = libraryName.length >= TITLE_LIMIT ? "is-warning" : "";
  const descriptionProgress = useMemo(() => {
    return Math.min((description.length / DESCRIPTION_LIMIT) * 100, 100);
  }, [description.length]);

  function handleReturn() {
    navigate(returnPath);
  }

  function handleCreateLibrary(e) {
    e.preventDefault();

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
      owner: ownerName,
      ownerAvatar,
      name: trimmedLibraryName,
      description: previewDescription,
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
      <section className="create_library_shell">
        <div className="create_library_hero">
          <div className="create_library_hero_content">
            <button type="button" className="create_library_back" onClick={handleReturn}>
              <i className="ti-angle-left" />
              Back
            </button>

            <span className="create_library_kicker">Library builder</span>
            <h1>Create a focused space for your study files.</h1>
            <p>
              Set up a library for course documents, summaries, research notes,
              and AI-supported learning materials.
            </p>

            <div className="create_library_steps" aria-label="Library setup steps">
              <article>
                <strong>01</strong>
                <span>Name your library</span>
              </article>
              <article>
                <strong>02</strong>
                <span>Choose visibility</span>
              </article>
              <article>
                <strong>03</strong>
                <span>Start uploading files</span>
              </article>
            </div>
          </div>

          <aside className="create_library_preview" aria-label="Library preview">
            <div className="preview_topline">
              <div className="preview_icon">
                <i className="ti-archive" />
              </div>
              <span className={`preview_badge ${visibility === "private" ? "private" : ""}`}>
                {visibility}
              </span>
            </div>

            <div className="preview_body">
              <span>Live preview</span>
              <h2>{previewName}</h2>
              <p>{previewDescription}</p>
            </div>

            <div className="preview_footer">
              <div>
                <strong>0</strong>
                <span>Documents</span>
              </div>
              <div>
                <strong>50MB</strong>
                <span>Storage limit</span>
              </div>
            </div>
          </aside>
        </div>

        <form className="create_library_form" onSubmit={handleCreateLibrary}>
          <section className="form_section form_section_primary">
            <div className="form_section_header">
              <div>
                <span className="section_number">01</span>
                <h2>General information</h2>
                <p>Keep the title short so it displays cleanly across cards and search.</p>
              </div>
            </div>

            <div className="library_name_row">
              <div className="form_group owner_group">
                <label>Owner *</label>
                <button type="button" className="owner_btn">
                  <span className="owner_avatar">
                    {ownerAvatar ? <img src={ownerAvatar} alt="" /> : ownerInitials}
                  </span>
                  <span>{ownerName}</span>
                  <i className="ti-angle-down" />
                </button>
                <p className="library_hint">The owner controls library settings and visibility.</p>
              </div>

              <div className="form_group library_name_group">
                <label htmlFor="libraryName">Library name *</label>
                <input
                  id="libraryName"
                  type="text"
                  value={libraryName}
                  maxLength={TITLE_LIMIT}
                  onChange={(e) => setLibraryName(e.target.value)}
                  placeholder="Example: Marketing notes"
                />
                <div className="field_meta_row">
                  <p className={`character_count ${titleCountClass}`}>
                    {libraryName.length} / {TITLE_LIMIT} characters
                  </p>
                  <span>{canCreate ? "Ready" : "Required"}</span>
                </div>
              </div>
            </div>

            <div className="form_group description_group">
              <label htmlFor="libraryDescription">Description</label>
              <textarea
                id="libraryDescription"
                value={description}
                maxLength={DESCRIPTION_LIMIT}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write a short description for this library"
              />
              <div className="description_meter" aria-hidden="true">
                <span style={{ width: `${descriptionProgress}%` }} />
              </div>
              <p
                className={
                  description.length > DESCRIPTION_LIMIT
                    ? "character_count error"
                    : "character_count"
                }
              >
                {description.length} / {DESCRIPTION_LIMIT} characters
              </p>
            </div>
          </section>

          <section className="form_section">
            <div className="form_section_header">
              <div>
                <span className="section_number">02</span>
                <h2>Privacy & visibility</h2>
                <p>Decide whether the library can be discovered by others.</p>
              </div>
            </div>

            <div className="visibility_options">
              <label
                className={`visibility_card ${visibility === "public" ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={(e) => setVisibility(e.target.value)}
                />
                <span className="visibility_icon"><i className="ti-world" /></span>
                <div>
                  <h3>Public</h3>
                  <p>Visible to members and searchable inside the University Hub.</p>
                </div>
              </label>

              <label
                className={`visibility_card ${visibility === "private" ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibility === "private"}
                  onChange={(e) => setVisibility(e.target.value)}
                />
                <span className="visibility_icon"><i className="ti-lock" /></span>
                <div>
                  <h3>Private</h3>
                  <p>Only visible to you and invited collaborators. Hidden from search.</p>
                </div>
              </label>
            </div>
          </section>

          <div className="create_library_actions">
            <button type="button" className="return_library_btn" onClick={handleReturn}>
              Return
            </button>
            <button type="submit" className="create_library_btn" disabled={!canCreate}>
              <i className="ti-plus" />
              Create library
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CreateLibraryPage;
