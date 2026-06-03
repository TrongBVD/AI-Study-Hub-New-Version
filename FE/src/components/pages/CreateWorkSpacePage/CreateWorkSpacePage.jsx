import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function CreateWorkSpacePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const returnPath = location.state?.from || "/dashboard/home";

  const [workspaceName, setWorkspaceName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");

  function handleReturn() {
    navigate(returnPath);
  }

  function handleCreateWorkspace(e) {
    e.preventDefault();

    if (workspaceName.trim() === "") {
      alert("Please enter workspace name.");
      return;
    }

    const newWorkspace = {
      id: `workspace-${Date.now()}`,
      owner: localStorage.getItem("aiStudyHubProfileName") || "dangkhoabi456",
      name: workspaceName.trim(),
      description:
        description.trim() ||
        "A shared workspace for study collaboration and document organization.",
      visibility,
      members: 1,
      libraries: 0,
      updatedAt: "Updated just now",
      createdAt: new Date().toISOString(),
      icon: "ti-briefcase",
    };

    const savedWorkspaces = JSON.parse(
      localStorage.getItem("aiStudyHubWorkspaces") || "[]"
    );

    localStorage.setItem(
      "aiStudyHubWorkspaces",
      JSON.stringify([newWorkspace, ...savedWorkspaces])
    );

    alert("Workspace created successfully!");

    navigate("/dashboard/home");
  }

  return (
    <main className="create_library_page">
      <section className="create_library_container">
        <div className="create_library_header">
          <h1>Create a new workspace</h1>
          <p>
            A workspace is used for group collaboration, shared libraries, and
            team study activities.
          </p>
        </div>

        <form className="create_library_form" onSubmit={handleCreateWorkspace}>
          <div className="form_section">
            <h2>General information</h2>

            <div className="form_group">
              <label>Workspace name *</label>

              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Enter workspace name"
              />
            </div>

            <div className="form_group">
              <label>Description</label>

              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write a short description"
              />

              <p className="character_count">
                {description.length} / 350 characters
              </p>
            </div>
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
                  name="workspaceVisibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={(e) => setVisibility(e.target.value)}
                />

                <div>
                  <h3>Public</h3>
                  <p>Visible to other users in the university hub.</p>
                </div>
              </label>

              <label
                className={`visibility_card ${
                  visibility === "private" ? "selected" : ""
                }`}
              >
                <input
                  type="radio"
                  name="workspaceVisibility"
                  value="private"
                  checked={visibility === "private"}
                  onChange={(e) => setVisibility(e.target.value)}
                />

                <div>
                  <h3>Private</h3>
                  <p>Only invited members can access this workspace.</p>
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
              Create workspace
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CreateWorkSpacePage;