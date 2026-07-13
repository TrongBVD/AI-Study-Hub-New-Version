import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HiOutlineSquares2X2, HiOutlineSquaresPlus } from "react-icons/hi2";
import { getWorkspaces } from "../../../utils/workspaceApi";
import "./MyWorkSpace.css";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

const ITEMS_PER_PAGE = 6;

function MyWorkSpace() {
  const [currentPage, setCurrentPage] = useState(1);
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaces() {
      try {
        const data = await getWorkspaces();
        if (isMounted) {
          setWorkspaces(data || []);
        }
      } catch (error) {
        console.error("Cannot load workspaces:", error);
        if (isMounted) {
          setWorkspaces([]);
        }
      }
    }

    loadWorkspaces();

    return () => {
      isMounted = false;
    };
  }, []);

  const totalPages = Math.ceil(workspaces.length / ITEMS_PER_PAGE);
  const safeCurrentPage = Math.min(currentPage, totalPages || 1);

  const paginatedWorkspaces = workspaces.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE
  );

  const workspaceSummary = useMemo(() => {
    const totalFiles = workspaces.reduce((sum, workspace) => {
      const files = Array.isArray(workspace.files) ? workspace.files.length : 0;
      const documents = Array.isArray(workspace.documents)
        ? workspace.documents.length
        : 0;
      return sum + files + documents;
    }, 0);

    const visibleWorkspaces = workspaces.filter(
      (workspace) => workspace.visibility === "public" || workspace.showOnProfile
    ).length;

    return {
      total: workspaces.length,
      files: totalFiles,
      visible: visibleWorkspaces,
      latest: workspaces[0],
    };
  }, [workspaces]);

  return (
    <main className="my_workspace_page">
      <section className="workspace_content">
        <section className="workspace_command_hero">
          <div className="workspace_hero_copy">
            <span className="workspace_eyebrow">Workspace command center</span>
            <h1>Build focused rooms for every project.</h1>
            <p>
              Organize discussions, files, members, tasks and study material in
              dedicated collaboration spaces.
            </p>

            <div className="workspace_hero_actions">
              <Link
                to="/dashboard/create-workspace"
                state={{ from: "/dashboard/workspaces" }}
                className="create_workspace_link"
              >
                <HiOutlineSquaresPlus aria-hidden="true" />
                Create workspace
              </Link>

              <a href="#workspace-board" className="workspace_secondary_link">
                <HiOutlineSquares2X2 aria-hidden="true" />
                View board
              </a>
            </div>
          </div>

          <aside className="workspace_focus_card">
            <div className="workspace_focus_icon">
              <HiOutlineSquares2X2 aria-hidden="true" />
            </div>

            <span>Latest workspace</span>

            <h2>{workspaceSummary.latest?.name || "No workspace yet"}</h2>

            <p>
              {workspaceSummary.latest
                ? "Open your newest workspace to continue discussion, manage files and track progress."
                : "Create your first workspace to start collaborating with your team."}
            </p>
          </aside>
        </section>

        <section className="workspace_stats_grid" aria-label="Workspace summary">
          <article>
            <span>Total workspaces</span>
            <strong>{workspaceSummary.total}</strong>
          </article>

          <article>
            <span>Shared files</span>
            <strong>{workspaceSummary.files}</strong>
          </article>

          <article>
            <span>Visible spaces</span>
            <strong>{workspaceSummary.visible}</strong>
          </article>
        </section>

        <section id="workspace-board" className="workspace_board_header">
          <div>
            <span className="workspace_eyebrow">Workspace board</span>
            <h2>My Workspaces</h2>
            <p>
              {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}{" "}
              saved in your collaboration hub.
            </p>
          </div>

          {totalPages > 1 && (
            <span className="workspace_page_badge">
              Page {safeCurrentPage} of {totalPages}
            </span>
          )}
        </section>

        {workspaces.length === 0 ? (
          <section className="empty_workspace_state">
            <div className="empty_workspace_icon">
              <HiOutlineSquares2X2 aria-hidden="true" />
            </div>

            <h2>You have no workspace here.</h2>

            <p>
              Start with a dedicated workspace for one class, project or team.
            </p>

            <Link
              to="/dashboard/create-workspace"
              state={{ from: "/dashboard/workspaces" }}
            >
              <HiOutlineSquaresPlus aria-hidden="true" />
              Create workspace
            </Link>
          </section>
        ) : (
          <section className="workspace_grid">
            {paginatedWorkspaces.map((workspace, index) => (
              <Link
                to={`/dashboard/workspaces/${workspace.id}`}
                state={{ workspace, from: "/dashboard/workspaces" }}
                className="workspace_card"
                key={workspace.id}
              >
                <div className="workspace_card_top">
                  <div className="workspace_icon">
                    <HiOutlineSquares2X2 aria-hidden="true" />
                  </div>

                  <span>{String((safeCurrentPage - 1) * ITEMS_PER_PAGE + index + 1).padStart(2, "0")}</span>
                </div>

                <div className="workspace_body">
                  <h3>{workspace.name}</h3>
                  <p>
                    {workspace.description ||
                      "Open this workspace to manage topics, members and files."}
                  </p>
                </div>

                <div className="workspace_footer">
                  <span>{workspace.updatedAt || "Updated just now"}</span>
                  <span className="workspace_arrow" aria-hidden="true">
                    <i className="ti-arrow-right"></i>
                  </span>
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
              aria-label="Previous page"
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
              )
            )}

            <button
              type="button"
              disabled={safeCurrentPage === totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(page + 1, totalPages))
              }
              aria-label="Next page"
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
