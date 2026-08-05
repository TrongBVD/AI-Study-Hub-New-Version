import { useEffect, useState } from "react";
import { showPopupAlert } from "../../common/ActionPopup/actionPopupService.js";
import { useNavigate } from "react-router-dom";
import { HiOutlineSquares2X2, HiOutlineSquaresPlus } from "react-icons/hi2";
import { createWorkspace, getWorkspaces } from "../../../utils/workspaceApi";
import { getMyProfile } from "../../../utils/profileApi";
import ActionPopup from "../../common/ActionPopup/ActionPopup.jsx";
import "./CreateWorkSpacePage.css";

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
  const [ownerName, setOwnerName] = useState("User");
  const [ownerAvatar, setOwnerAvatar] = useState("");
  const [ownedWorkspaceCount, setOwnedWorkspaceCount] = useState(0);
  const [limitPopup, setLimitPopup] = useState(null);
  const MAX_OWNED_WORKSPACES = 3;
  const ownerInitials = getInitials(ownerName);

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      try {
        const [profile, workspaces] = await Promise.all([
          getMyProfile(),
          getWorkspaces(),
        ]);
        if (!isMounted) return;

        setOwnerName(profile?.full_name || profile?.username || profile?.email || "User");
        setOwnerAvatar(profile?.avatar_url || "");
        setOwnedWorkspaceCount(
          (workspaces || []).filter(
            (workspace) => String(workspace.created_by) === String(profile?.id),
          ).length,
        );
      } catch (error) {
        console.error("Failed to load workspace creation data:", error);
      }
    }

    loadPageData();

    return () => {
      isMounted = false;
    };
  }, []);

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

  function handleReturn() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/dashboard/home");
  }

  async function handleCreateWorkSpace(e) {
    e.preventDefault();

    if (ownedWorkspaceCount >= MAX_OWNED_WORKSPACES) {
      setLimitPopup({
        type: "alert",
        title: "Workspace limit reached",
        message: `You can create up to ${MAX_OWNED_WORKSPACES} workspaces. Delete an existing workspace before creating another one.`,
        confirmText: "Got it",
      });
      return;
    }

    if (trimmedWorkspaceName === "") {
      showPopupAlert("Please enter workspace name");
      return;
    }

    if (trimmedWorkspaceName.length > TITLE_LIMIT) {
      showPopupAlert(`Workspace name cannot exceed ${TITLE_LIMIT} characters.`);
      return;
    }

    if (trimmedDescription.length > DESCRIPTION_LIMIT) {
      showPopupAlert(`Workspace description cannot exceed ${DESCRIPTION_LIMIT} characters.`);
      return;
    }

    try {
      const newWorkSpace = await createWorkspace({
        name: trimmedWorkspaceName,
        description: previewDescription,
      });

      navigate(`/dashboard/workspaces/${newWorkSpace.id}`, {
        state: {
          workspace: newWorkSpace,
          from: "/dashboard/create-workspace",
        },
      });
    } catch (error) {
      console.error("Cannot create workspace:", error);
      if (error?.response?.data?.code === "WORKSPACE_LIMIT_REACHED") {
        setOwnedWorkspaceCount(MAX_OWNED_WORKSPACES);
        setLimitPopup({
          type: "alert",
          title: "Workspace limit reached",
          message:
            error.response.data.message ||
            `You can create up to ${MAX_OWNED_WORKSPACES} workspaces. Delete an existing workspace before creating another one.`,
          confirmText: "Got it",
        });
        return;
      }
      showPopupAlert(error?.response?.data?.message || "Cannot create workspace. Please login again and try later.");
    }
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
              Create a private workspace for files, members, and study resources,
              and study materials before inviting your members.
            </p>
            <p>{ownedWorkspaceCount} / {MAX_OWNED_WORKSPACES} workspaces created</p>
          </div>

          <aside className="workspace_preview_card" aria-label="Workspace preview">
            <div>
              <div className="workspace_preview_topline">
                <span className="workspace_preview_icon">
                  <HiOutlineSquares2X2 aria-hidden="true" />
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
                  <label>
                    Owner <span className="required_star">*</span>
                  </label>
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
                  <label htmlFor="workspaceName">
                    Workspace name <span className="required_star">*</span>
                  </label>
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
                visibility is not available for workspaces, so your resources
                and files stay protected.
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
            >
              <HiOutlineSquaresPlus aria-hidden="true" />
              Create workspace
            </button>
          </div>
        </form>
      </section>
      <ActionPopup
        popup={limitPopup}
        onResolve={() => setLimitPopup(null)}
      />
    </main>
  );
}

export default CreateWorkSpacePage;
