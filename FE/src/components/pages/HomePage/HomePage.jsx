import "./HomePage.css";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";
import { Link } from "react-router-dom";

function HomePage() {
  const profileName =
    localStorage.getItem("aiStudyHubProfileName") || "dangkhoabi456";

  const libraries = JSON.parse(
    localStorage.getItem("aiStudyHubLibraries") || "[]"
  );

  const workspaces = JSON.parse(
    localStorage.getItem("aiStudyHubWorkspaces") || "[]"
  );

  const recentLibraries = JSON.parse(
    localStorage.getItem("aiStudyHubRecentLibraries") || "[]"
  );

  const recentWorkspaces = JSON.parse(
    localStorage.getItem("aiStudyHubRecentWorkspaces") || "[]"
  );

  const stats = [
    {
      title: "Total libraries",
      value: libraries.length,
      icon: "ti-folder",
    },
    {
      title: "Joined workspaces",
      value: workspaces.length,
      icon: "ti-layout-grid2",
    },
  ];

  return (
    <main className="home_page">
      <section className="home_workspace">
        <section className="welcome_banner">
          <div className="welcome_text">
            <h1>
              Welcome back, <br />
              {profileName}
            </h1>

            <p>Continue learning from your recent workspaces and libraries.</p>
          </div>

          <div className="welcome_actions">
            <Link
              to="/dashboard/create-workspace"
              state={{ from: "/dashboard/home" }}
              className="primary_home_btn"
            >
              <i className="ti-briefcase"></i>
              Create workspace
            </Link>

            <Link
              to="/dashboard/create-library"
              state={{ from: "/dashboard/home" }}
              className="secondary_home_btn"
            >
              <i className="ti-folder"></i>
              Create library
            </Link>
          </div>
        </section>

        <section className="home_stats_grid">
          {stats.map((stat) => (
            <article className="home_stat_card" key={stat.title}>
              <div className="stat_card_header">
                <span>{stat.title}</span>
                <i className={stat.icon}></i>
              </div>

              <strong>{stat.value}</strong>
            </article>
          ))}
        </section>

        <section className="home_content_grid">
          <section className="recent_libraries_section">
            <div className="section_title_row recent_libraries_title_row">
              <div className="section_title_left">
                <h2>Recent libraries</h2>

                <Link to="/dashboard/libraries" className="view_all_link">
                  View all libraries
                </Link>
              </div>
            </div>

            <div className="recent_library_grid">
              {recentLibraries.length === 0 ? (
                <div className="empty_recent_box">
                  <p>No recent libraries yet.</p>
                </div>
              ) : (
                recentLibraries.map((library) => (
                  <article className="recent_library_card" key={library.id}>
                    <div className="library_card_icon">
                      <i className={library.icon || "ti-archive"}></i>
                    </div>

                    <div className="library_card_body">
                      <h3>
                        {library.name ||
                          library.libraryName ||
                          "Untitled Library"}
                      </h3>
                      <p>{library.documents || 0} documents</p>
                    </div>

                    <div className="library_card_footer">
                      <span>{library.updatedAt || "Updated just now"}</span>

                      <Link to={`/dashboard/libraries/${library.id}`}>Open</Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <aside className="recent_workspaces_section">
            <div className="section_title_row recent_workspaces_title_row">
              <h2>Recent workspaces</h2>

              <Link to="/dashboard/workspaces" className="view_all_link">
                View all workspaces
              </Link>
            </div>

            <div className="recent_workspace_list">
              {recentWorkspaces.length === 0 ? (
                <div className="empty_recent_box">
                  <p>No recent workspaces yet.</p>
                </div>
              ) : (
                recentWorkspaces.map((workspace) => (
                  <article className="recent_workspace_card" key={workspace.id}>
                    <div className="workspace_icon">
                      <i className={workspace.icon || "ti-briefcase"}></i>
                    </div>

                    <div className="workspace_recent_info">
                      <h3>{workspace.name || "Untitled Workspace"}</h3>

                      <Link
                        to={`/dashboard/workspaces/${workspace.id}`}
                        className="home_open_btn"
                      >
                        Open
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}

export default HomePage;
