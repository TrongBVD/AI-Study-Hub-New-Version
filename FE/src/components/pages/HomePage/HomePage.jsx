import { useEffect, useMemo, useState } from "react";
import "./HomePage.css";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";
import { Link } from "react-router-dom";
import studyHubLogo from "../../../assets/images/StudyHubLogo.svg";
import { getMyLibraries } from "../../../utils/documentApi.js";
import { getWorkspaces } from "../../../utils/workspaceApi.js";

function getItemId(item) {
  return item?.id || item?._id || item?.libraryId || item?.workspaceId || "";
}

function getRecentTimestamp(item) {
  const values = [
    item?.visitedAt,
    item?.lastAccessedAt,
    item?.lastOpenedAt,
    item?.updatedAt,
    item?.updated_at,
    item?.createdAt,
    item?.created_at,
  ];

  for (const value of values) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const parsedValue = Date.parse(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return 0;
}
    
function getStoredUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return String(user?.role || "").toUpperCase();
  } catch {
    return "";
  }
}

function notifyGuestRegistrationRequired() {
  alert("Please register or log in with an account to create libraries and workspaces.");
}

function HomePage() {
  const profileName =
    localStorage.getItem("aiStudyHubProfileName") || "dangkhoabi456";
  const isGuest = getStoredUserRole() === "GUEST";
  const [libraries, setLibraries] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    if (isGuest) {
      setLibraries([]);
      setWorkspaces([]);
      return;
    }

    let isMounted = true;

    async function loadDashboardData() {
      try {
        const [libraryData, workspaceData] = await Promise.all([
          getMyLibraries(),
          getWorkspaces(),
        ]);

        if (!isMounted) return;

        setLibraries(Array.isArray(libraryData) ? libraryData : []);
        setWorkspaces(Array.isArray(workspaceData) ? workspaceData : []);
      } catch (error) {
        console.error("Cannot load dashboard data:", error);

        if (!isMounted) return;

        setLibraries([]);
        setWorkspaces([]);
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [isGuest]);

  const recentLibraries = useMemo(
    () =>
      isGuest
        ? []
        : [...libraries]
            .sort((a, b) => getRecentTimestamp(b) - getRecentTimestamp(a))
            .slice(0, 2),
    [isGuest, libraries]
  );

  const recentWorkspaces = useMemo(
    () =>
      isGuest
        ? []
        : [...workspaces]
            .sort((a, b) => getRecentTimestamp(b) - getRecentTimestamp(a))
            .slice(0, 1),
    [isGuest, workspaces]
  );

  const totalDocuments = useMemo(() => {
    return libraries.reduce(
      (total, library) => total + Number(library.documents || 0),
      0
    );
  }, [libraries]);

  const stats = useMemo(() => [
    {
      title: "Libraries",
      value: libraries.length,
      detail: "Saved collections",
      icon: "ti-folder",
    },
    {
      title: "Workspaces",
      value: workspaces.length,
      detail: "Collaboration rooms",
      icon: "ti-layout-grid2",
    },
    {
      title: "Documents",
      value: totalDocuments,
      detail: "Across all libraries",
      icon: "ti-files",
    },
  ], [libraries.length, workspaces.length, totalDocuments]);

  const quickActions = [
    {
      title: "Create workspace",
      description: "Open a private room for topics, files and team discussion.",
      icon: "ti-briefcase",
      to: "/dashboard/create-workspace",
      primary: true,
    },
    {
      title: "Create library",
      description: "Build a clean collection for documents and study materials.",
      icon: "ti-folder",
      to: "/dashboard/create-library",
    },
  ];

  const latestLibrary = recentLibraries[0];
  const latestWorkspace = recentWorkspaces[0];
  const latestLibraryId = getItemId(latestLibrary);
  const latestWorkspaceId = getItemId(latestWorkspace);

  return (
    <main className="home_page">
      <section className="home_shell">
        <section className="home_intro_grid" aria-label="Home overview">
          <div className="home_command_panel">
            <div className="home_brand_row">
              <img src={studyHubLogo} alt="Study Hub" />
            </div>

            <div className="home_headline_block">
              <span className="home_label">Workspace command center</span>
              <h1>
                Welcome back,
                <span>{profileName}</span>
              </h1>
              <p>
                Continue from your latest materials, manage study spaces and start new work without leaving the dashboard.
              </p>
            </div>

            <div className="home_primary_actions">
  {isGuest ? (
    <>
      <button
        type="button"
        onClick={notifyGuestRegistrationRequired}
        className="home_btn home_btn_primary"
      >
        <i className="ti-briefcase"></i>
        Create workspace
      </button>

      <button
        type="button"
        onClick={notifyGuestRegistrationRequired}
        className="home_btn home_btn_secondary"
      >
        <i className="ti-folder"></i>
        Create library
      </button>

      <Link
        to="/dashboard/import-library"
        state={{ from: "/dashboard/home" }}
        className="home_btn home_btn_secondary"
      >
        <i className="ti-import"></i>
        Import library
      </Link>
    </>
  ) : (
    <>
      <Link
        to="/dashboard/create-workspace"
        state={{ from: "/dashboard/home" }}
        className="home_btn home_btn_primary"
      >
        <i className="ti-briefcase"></i>
        Create workspace
      </Link>

      <Link
        to="/dashboard/create-library"
        state={{ from: "/dashboard/home" }}
        className="home_btn home_btn_secondary"
      >
        <i className="ti-folder"></i>
        Create library
      </Link>

      <Link
        to="/dashboard/import-library"
        state={{ from: "/dashboard/home" }}
        className="home_btn home_btn_secondary"
      >
        <i className="ti-import"></i>
        Import library
      </Link>
    </>
  )}
</div>
          </div>

          <aside className="home_focus_panel" aria-label="Latest activity preview">
            <div className="focus_panel_header">
              <span className="home_label">Today</span>
              <strong>Focus board</strong>
            </div>

            <div className="focus_card focus_card_dark">
              <span>Latest library</span>
              <h2>
                {latestLibrary?.name ||
                  latestLibrary?.libraryName ||
                  "No library opened yet"}
              </h2>
              <p>
                {latestLibrary
                  ? `${latestLibrary.documents || 0} documents saved`
                  : "Open a library once to place it here."}
              </p>
              {latestLibrary && (
                <Link
                  to={
                    latestLibraryId
                      ? `/dashboard/libraries/${latestLibraryId}`
                      : "/dashboard/libraries"
                  }
                >
                  Open library
                </Link>
              )}
            </div>

            <div className="focus_card focus_card_light">
              <span>Latest workspace</span>
              <h2>{latestWorkspace?.name || "No workspace opened yet"}</h2>
              <p>
                {latestWorkspace
                  ? latestWorkspace.description
                  : "Your recent collaboration room will appear here."}
              </p>
              {latestWorkspace && !isGuest && (
                <Link
                  to={
                    latestWorkspaceId
                      ? `/dashboard/workspaces/${latestWorkspaceId}`
                      : "/dashboard/workspaces"
                  }
                >
                  Open workspace
                </Link>
              )}
            </div>
          </aside>
        </section>

        <section className="home_stats_strip" aria-label="Account summary">
          {stats.map((stat) => (
            <article className="home_stat_item" key={stat.title}>
              <div className="home_stat_icon">
                <i className={stat.icon}></i>
              </div>
              <div>
                <strong>{stat.value}</strong>
                <span>{stat.title}</span>
                <p>{stat.detail}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="home_body_grid">
          <section className="home_main_stack">
            <div className="home_section_header">
              <div>
                <span className="home_label">Recent materials</span>
                <h2>Libraries you opened recently</h2>
              </div>

              {!isGuest && (
                <Link to="/dashboard/libraries" className="home_text_link">
                  View all libraries
                  <i className="ti-arrow-right"></i>
                </Link>
              )}
            </div>

            <div className="recent_library_grid">
              {recentLibraries.length === 0 ? (
                <div className="home_empty_state home_empty_large">
                  <div className="home_empty_icon">
                    <i className="ti-folder"></i>
                  </div>
                  <h3>No recent libraries yet</h3>
                  <p>Open or create a library to bring your latest study materials into this area.</p>
                  <Link to="/dashboard/libraries">
                    {isGuest ? "Browse public libraries" : "Browse libraries"}
                  </Link>
                </div>
              ) : (
                recentLibraries.map((library, index) => {
                  const libraryId = getItemId(library);

                  return (
                    <article className="recent_library_card" key={libraryId || index}>
                      <div className="library_card_header">
                        <div className="library_icon_cluster">
                          <i className={library.icon || "ti-archive"}></i>
                        </div>
                        <span>{index === 0 ? "Most recent" : "Recent"}</span>
                      </div>

                    <div className="library_card_body">
                      <h3>
                        {library.name ||
                          library.libraryName ||
                          "Untitled Library"}
                      </h3>
                      <p>{library.updated_at ? new Date(library.updated_at).toLocaleDateString() : (library.updatedAt || "Updated just now")}</p>
                    </div>

                      <div className="library_card_footer">
                        <span>{library.documents || 0} docs</span>
                        <Link
                          to={
                            libraryId
                              ? `/dashboard/libraries/${libraryId}`
                              : "/dashboard/libraries"
                          }
                        >
                          Open
                        </Link>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <aside className="home_side_stack">
            <div className="home_section_header compact_header">
              <div>
                <span className="home_label">Recent rooms</span>
                <h2>Workspaces</h2>
              </div>

              {!isGuest && (
                <Link to="/dashboard/workspaces" className="home_text_link compact_link">
                  View all
                </Link>
              )}
            </div>

            <div className="recent_workspace_list">
              {recentWorkspaces.length === 0 ? (
                <div className="home_empty_state home_empty_compact">
                  <div className="home_empty_icon">
                    <i className="ti-briefcase"></i>
                  </div>
                  <h3>No recent workspaces</h3>
                  <p>Open a workspace once and it will be listed here.</p>
                  {!isGuest && <Link to="/dashboard/workspaces">Browse workspaces</Link>}
                </div>
              ) : (
                recentWorkspaces.map((workspace, index) => {
                  const workspaceId = getItemId(workspace);

                  return (
                    <article className="recent_workspace_card" key={workspaceId || index}>
                      <div className="workspace_icon">
                        <i className={workspace.icon || "ti-briefcase"}></i>
                      </div>

                      <div className="workspace_recent_info">
                        <h3>{workspace.name || "Untitled Workspace"}</h3>
                        <p>Workspace</p>
                      </div>

                      <Link
                        to={
                          workspaceId
                            ? `/dashboard/workspaces/${workspaceId}`
                            : "/dashboard/workspaces"
                        }
                        className="home_open_btn"
                      >
                        Open
                      </Link>
                    </article>
                  );
                })
              )}
            </div>
          </aside>
        </section>

        {/* <section className="home_action_grid" aria-label="Quick actions">
          {quickActions.map((action) => (
            <Link
              to={action.to}
              state={action.to.includes("create") ? { from: "/dashboard/home" } : undefined}
              className={
                action.primary
                  ? "quick_action_card quick_action_card_primary"
                  : "quick_action_card"
              }
              key={action.title}
            >
              <i className={action.icon}></i>
              <div>
                <h3>{action.title}</h3>
                <p>{action.description}</p>
              </div>
              <span className="quick_action_arrow">
                <i className="ti-arrow-right"></i>
              </span>
            </Link>
          ))}
        </section> */}
      </section>
    </main>
  );
}

export default HomePage;
