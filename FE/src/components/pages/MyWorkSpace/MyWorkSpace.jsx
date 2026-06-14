import { useState } from "react";
import { Link } from "react-router-dom";
import "./MyWorkSpace.css";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

function MyWorkSpace() {
  const [currentPage, setCurrentPage] = useState(1);
  function getSavedWorkSpaces() {
    try {
      return JSON.parse(localStorage.getItem("aiStudyHubWorkspaces") || "[]");
    } catch (error) {
      console.error("Cannot read workspaces from localStorage:", error);
      return [];
    }
  }

  const workspaces = getSavedWorkSpaces();
const ITEMS_PER_PAGE = 12;

const totalPages = Math.ceil(workspaces.length / ITEMS_PER_PAGE);

const safeCurrentPage = Math.min(currentPage, totalPages || 1);

const paginatedWorkspaces = workspaces.slice(
  (safeCurrentPage - 1) * ITEMS_PER_PAGE,
  safeCurrentPage * ITEMS_PER_PAGE,
);
  return (
    <main className="my_workspace_page">
      <section className="workspace_content">
        <div className="workspace_page_header">
          <div>
            <h1>My Workspaces</h1>
            <p>
              Manage your private workspaces, shared documents, and selected
              collaborators.
            </p>
          </div>

          <div className="workspace_header_actions">
            <Link
              to="/dashboard/create-workspace"
              state={{ from: "/dashboard/workspaces" }}
              className="create_workspace_link"
            >
              <i className="ti-plus"></i>
              Create workspace
            </Link>
          </div>
        </div>

        {workspaces.length === 0 ? (
          <section className="empty_workspace_state">
            <div className="empty_workspace_icon">
              <i className="ti-layout-grid2"></i>
            </div>

            <h2>You have no workspace here.</h2>

            <p>
              Let's{" "}
              <Link
                to="/dashboard/create-workspace"
                state={{ from: "/dashboard/workspaces" }}
              >
                create one for now
              </Link>
              .
            </p>
          </section>
        ) : (
          <section className="workspace_grid">
            {paginatedWorkspaces.map((workspace) => (
<Link
  to={`/dashboard/workspaces/${workspace.id}`}
  state={{ workspace, from: "/dashboard/workspaces" }}
  className="workspace_card"
  key={workspace.id}

>
                <div className="workspace_icon">
                  <i className={workspace.icon || "ti-layout-grid2"}></i>
                </div>

                <div className="workspace_body">
                  <h3>{workspace.name}</h3>
                </div>

                <div className="workspace_footer">
                  <span>{workspace.updatedAt || "Updated just now"}</span>
                  <span className="workspace_arrow">›</span>
                </div>
              </Link>
            ))}
          </section>
        )}

        {totalPages > 1 && (
  <div className="workspace_pagination">
    <button
      type="button"
      disabled={safeCurrentPage === 1}
      onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
    >
      ‹
    </button>

    {Array.from({ length: totalPages }, (_, index) => index + 1).map(
      (page) => (
        <button
          type="button"
          key={page}
          className={safeCurrentPage === page ? "active" : ""}
          onClick={() => setCurrentPage(page)}
        >
          {page}
        </button>
      ),
    )}

    <button
      type="button"
      disabled={safeCurrentPage === totalPages}
      onClick={() =>
        setCurrentPage((page) => Math.min(page + 1, totalPages))
      }
    >
      ›
    </button>
  </div>
)}
      </section>
    </main>
  );
}


export default MyWorkSpace;
