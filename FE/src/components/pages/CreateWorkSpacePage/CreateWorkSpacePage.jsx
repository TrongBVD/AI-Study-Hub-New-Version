import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CreateWorkSpacePage.css";

function CreateWorkSpacePage() {
  const navigate = useNavigate();


  const [workspaceName, setWorkspaceName] = useState("");
  const [description, setDescription] = useState("");

function handleReturn() {
  if (window.history.length > 1) {
    navigate(-1);
    return;
  }

  navigate("/dashboard/home");
}

  function handleCreateWorkSpace(e) {
    e.preventDefault();

    if (workspaceName.trim() === "") {
      alert("Please enter workspace name");
      return;
    }

    const newWorkSpace = {
      id: `workspace-${Date.now()}`,
      owner: "dangkhoabi456",
      name: workspaceName.trim(),
      description:
        description.trim() ||
        "This workspace helps you organize private projects, manage documents, and collaborate with selected members.",
      visibility: "private",
      documents: 0,
      updatedAt: "Updated just now",
      icon: "ti-briefcase",
      highlight: false,
      createdAt: new Date().toISOString(),
    };

    const savedWorkSpaces = JSON.parse(
      localStorage.getItem("aiStudyHubWorkspaces") || "[]"
    );

    localStorage.setItem(
      "aiStudyHubWorkspaces",
      JSON.stringify([newWorkSpace, ...savedWorkSpaces])
    );

    navigate(`/dashboard/workspaces/${newWorkSpace.id}`, {
      state: {
        workspace: newWorkSpace,
        from: "/dashboard/create-workspace",
      },
    });
  }

  return (
    <main className="create_workspace_page">
      <section className="create_workspace_container">
        <div className="create_workspace_header">
          <h1>Create a new workspace</h1>
          <p>
            A workspace contains your private projects, files, notes, and shared
            working materials.
          </p>
        </div>

        <form className="create_workspace_form" onSubmit={handleCreateWorkSpace}>
          <div className="form_section">
            <h2>General information</h2>

            <div className="workspace_name_row">
              <div className="form_group owner_group">
                <label>Owner *</label>

                <button type="button" className="owner_btn">
                  <span className="owner_avatar"></span>
                  <span>dangkhoabi456</span>
                  <span>▾</span>
                </button>

                <p className="workspace_hint">
                  The person who created this private workspace.
                </p>
              </div>

              <div className="form_group workspace_name_group">
                <label>Workspace name *</label>

                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Enter workspace name"
                />
              </div>
            </div>

            <p className="workspace_hint">
              Great workspace names are short, clear, and easy to recognize.
            </p>

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

          <div className="workspace_privacy_notice">
            <div className="workspace_privacy_icon">
              <i className="ti-lock"></i>
            </div>

            <div>
              <h3>Workspace is private by default</h3>
              <p>
                Only you and invited members can access this workspace. Public
                visibility is not available for workspaces.
              </p>
            </div>
          </div>

          <div className="create_workspace_actions">
            <button
              type="button"
              className="return_workspace_btn"
              onClick={handleReturn}
            >
              Return
            </button>

            <button type="submit" className="create_workspace_btn">
              Create workspace
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CreateWorkSpacePage;
