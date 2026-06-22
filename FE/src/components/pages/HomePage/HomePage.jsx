import "./HomePage.css";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";
import { Link } from "react-router-dom";
import studyHubLogo from "../../../assets/images/StudyHubLogo.svg";

function readStorageList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function HomePage() {
  const profileName =
    localStorage.getItem("aiStudyHubProfileName") || "dangkhoabi456";

  const libraries = readStorageList("aiStudyHubLibraries");
  const workspaces = readStorageList("aiStudyHubWorkspaces");
  const recentLibraries = readStorageList("aiStudyHubRecentLibraries").slice(0, 2);
  const recentWorkspaces = readStorageList("aiStudyHubRecentWorkspaces").slice(0, 4);

  const totalDocuments = libraries.reduce(
    (total, library) => total + Number(library.documents || 0),
    0
  );

  const stats = [
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
  ];

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
    {
      title: "Open AI Chat",
      description: "Ask questions and continue your learning flow.",
      icon: "ti-comments",
      to: "/dashboard/ai-chat",
    },
  ];

  const latestLibrary = recentLibraries[0];
  const latestWorkspace = recentWorkspaces[0];

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
              <Link
                to={
                  latestLibrary?.id
                    ? `/dashboard/libraries/${latestLibrary.id}`
                    : "/dashboard/libraries"
                }
              >
                {latestLibrary ? "Open library" : "Browse libraries"}
              </Link>
            </div>

            <div className="focus_card focus_card_light">
              <span>Latest workspace</span>
              <h2>{latestWorkspace?.name || "No workspace opened yet"}</h2>
              <p>
                {latestWorkspace
                  ? "Continue the discussion from this workspace."
                  : "Your recent collaboration room will appear here."}
              </p>
              <Link
                to={
                  latestWorkspace?.id
                    ? `/dashboard/workspaces/${latestWorkspace.id}`
                    : "/dashboard/workspaces"
                }
              >
                {latestWorkspace ? "Open workspace" : "Browse workspaces"}
              </Link>
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

              <Link to="/dashboard/libraries" className="home_text_link">
                View all libraries
                <i className="ti-arrow-right"></i>
              </Link>
            </div>

            <div className="recent_library_grid">
              {recentLibraries.length === 0 ? (
                <div className="home_empty_state home_empty_large">
                  <div className="home_empty_icon">
                    <i className="ti-folder"></i>
                  </div>
                  <h3>No recent libraries yet</h3>
                  <p>Open or create a library to bring your latest study materials into this area.</p>
                  <Link to="/dashboard/libraries">Browse libraries</Link>
                </div>
              ) : (
                recentLibraries.map((library, index) => (
                  <article className="recent_library_card" key={library.id}>
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
                      <p>{library.updatedAt || "Updated just now"}</p>
                    </div>

                    <div className="library_card_footer">
                      <span>{library.documents || 0} docs</span>
                      <Link to={`/dashboard/libraries/${library.id}`}>Open</Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <aside className="home_side_stack">
            <div className="home_section_header compact_header">
              <div>
                <span className="home_label">Recent rooms</span>
                <h2>Workspaces</h2>
              </div>

              <Link to="/dashboard/workspaces" className="home_text_link compact_link">
                View all
              </Link>
            </div>

            <div className="recent_workspace_list">
              {recentWorkspaces.length === 0 ? (
                <div className="home_empty_state home_empty_compact">
                  <div className="home_empty_icon">
                    <i className="ti-briefcase"></i>
                  </div>
                  <h3>No recent workspaces</h3>
                  <p>Open a workspace once and it will be listed here.</p>
                  <Link to="/dashboard/workspaces">Browse workspaces</Link>
                </div>
              ) : (
                recentWorkspaces.map((workspace) => (
                  <article className="recent_workspace_card" key={workspace.id}>
                    <div className="workspace_icon">
                      <i className={workspace.icon || "ti-briefcase"}></i>
                    </div>

                    <div className="workspace_recent_info">
                      <h3>{workspace.name || "Untitled Workspace"}</h3>
                      <p>Workspace</p>
                    </div>

                    <Link
                      to={`/dashboard/workspaces/${workspace.id}`}
                      className="home_open_btn"
                    >
                      Open
                    </Link>
                  </article>
                ))
              )}
            </div>
          </aside>
        </section>

        <section className="home_action_grid" aria-label="Quick actions">
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
        </section>
      </section>
    </main>
  );
}

export default HomePage;