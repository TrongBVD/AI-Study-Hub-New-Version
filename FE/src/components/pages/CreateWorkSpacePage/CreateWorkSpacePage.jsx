import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CreateWorkSpacePage.css";

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

function CreateWorkSpacePage() {
  const navigate = useNavigate();
  const TITLE_LIMIT = 20;
  const DESCRIPTION_LIMIT = 350;

  const [workspaceName, setWorkspaceName] = useState("");
  const [description, setDescription] = useState("");
  const ownerName = localStorage.getItem(PROFILE_NAME_KEY) || "dangkhoabi456";
  const ownerAvatar = localStorage.getItem(PROFILE_AVATAR_KEY) || "";
  const ownerInitials = getInitials(ownerName);

  const trimmedWorkspaceName = workspaceName.trim();
  const trimmedDescription = description.trim();
  const descriptionPercent = Math.min(
    100,
    Math.round((description.length / DESCRIPTION_LIMIT) * 100)
  );

  const previewTitle = trimmedWorkspaceName || "Untitled workspace";
  const previewDescription =
    trimmedDescription ||
    "This workspace helps you organize private projects, manage documents, and collaborate with selected members.";

  const canCreate = useMemo(() => {
    return (
      trimmedWorkspaceName.length > 0 &&
      trimmedWorkspaceName.length <= TITLE_LIMIT &&
      trimmedDescription.length <= DESCRIPTION_LIMIT
    );
  }, [trimmedWorkspaceName, trimmedDescription]);

  function handleReturn() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/dashboard/home");
  }

  function handleCreateWorkSpace(e) {
    e.preventDefault();

    if (trimmedWorkspaceName === "") {
      alert("Please enter workspace name");
      return;
    }

    if (trimmedWorkspaceName.length > TITLE_LIMIT) {
      alert(`Workspace name cannot exceed ${TITLE_LIMIT} characters.`);
      return;
    }

    if (trimmedDescription.length > DESCRIPTION_LIMIT) {
      alert(`Workspace description cannot exceed ${DESCRIPTION_LIMIT} characters.`);
      return;
    }

    const newWorkSpace = {
      id: `workspace-${Date.now()}`,
      owner: ownerName,
      ownerAvatar,
      name: trimmedWorkspaceName,
      description: previewDescription,
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
      <section className="create_workspace_shell">
        <div className="create_workspace_hero">
          <button
            type="button"
            className="workspace_back_chip"
            onClick={handleReturn}
          >
            <i className="ti-arrow-left" />
            Back
          </button>

          <div className="create_workspace_header">
            <span className="workspace_eyebrow">Workspace builder</span>
            <h1>Build a focused space for study and teamwork.</h1>
            <p>
              Create a private workspace for topics, files, discussion threads,
              tasks, and study materials before inviting your members.
            </p>
          </div>

          <aside className="workspace_preview_card" aria-label="Workspace preview">
            <div>
              <div className="workspace_preview_topline">
                <span className="workspace_preview_icon">
                  <i className="ti-briefcase" />
                </span>

                <span className="workspace_private_badge">
                  <i className="ti-lock" />
                  Private
                </span>
              </div>

              <h2>{previewTitle}</h2>
              <p>{previewDescription}</p>
            </div>

            <div className="workspace_preview_meta">
              <span>Owner</span>
              <strong>{ownerName}</strong>
            </div>
          </aside>
        </div>

        <form className="create_workspace_form" onSubmit={handleCreateWorkSpace}>
          <div className="form_section workspace_details_panel">
            <div className="form_section_header">
              <div>
                <span className="section_kicker">General information</span>
                <h2>Define your workspace identity</h2>
              </div>
              <p>
                Keep the name short and the description clear so members can
                understand the workspace purpose quickly.
              </p>
            </div>

            <div className="workspace_name_row">
              <div className="form_group owner_group">
                <div className="label_row">
                  <label>Owner *</label>
                </div>

                <button type="button" className="owner_btn">
                  <span className="owner_avatar">
                    {ownerAvatar ? <img src={ownerAvatar} alt="" /> : ownerInitials}
                  </span>
                  <span className="owner_name_text">{ownerName}</span>
                  <i className="ti-angle-down" />
                </button>

                <p className="workspace_hint">
                  This account will manage workspace settings and member access.
                </p>
              </div>

              <div className="form_group workspace_name_group">
                <div className="label_row">
                  <label htmlFor="workspaceName">Workspace name *</label>
                  <span
                    className={
                      workspaceName.length >= TITLE_LIMIT
                        ? "character_count character_count_limit"
                        : "character_count"
                    }
                  >
                    {workspaceName.length} / {TITLE_LIMIT}
                  </span>
                </div>

                <input
                  id="workspaceName"
                  type="text"
                  value={workspaceName}
                  maxLength={TITLE_LIMIT}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Example: Marketing Sprint"
                />

                <p className="workspace_hint">
                  Short names are easier to display in cards, tabs, and recent
                  activity.
                </p>
              </div>
            </div>

            <div className="form_group description_group">
              <div className="label_row">
                <label htmlFor="workspaceDescription">Description</label>
                <span
                  className={
                    description.length >= DESCRIPTION_LIMIT
                      ? "character_count character_count_limit"
                      : "character_count"
                  }
                >
                  {description.length} / {DESCRIPTION_LIMIT}
                </span>
              </div>

              <textarea
                id="workspaceDescription"
                value={description}
                maxLength={DESCRIPTION_LIMIT}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this workspace is used for..."
              />

              <div className="description_meter" aria-hidden="true">
                <span style={{ width: `${descriptionPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="workspace_privacy_notice">
            <div className="workspace_privacy_icon">
              <i className="ti-lock" />
            </div>

            <div className="workspace_privacy_content">
              <h3>Workspace is private by default</h3>
              <p>
                Only you and invited members can access this workspace. Public
                visibility is not available for workspaces, so your discussion,
                files, and tasks stay protected.
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

            <button
              type="submit"
              className="create_workspace_btn"
              disabled={!canCreate}
            >
              <i className="ti-plus" />
              Create workspace
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CreateWorkSpacePage;
