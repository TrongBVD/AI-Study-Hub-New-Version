import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./MyLibraryPage.css";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

function getSavedLibraries() {
  try {
    return JSON.parse(localStorage.getItem("aiStudyHubLibraries") || "[]");
  } catch (error) {
    console.error("Cannot read libraries from localStorage:", error);
    return [];
  }
}

function getLibraryName(library) {
  return library.name || library.libraryName || "Untitled Library";
}

function MyLibraryPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const libraries = getSavedLibraries();

  const ITEMS_PER_PAGE = 6;
  const totalPages = Math.ceil(libraries.length / ITEMS_PER_PAGE);
  const safeCurrentPage = Math.min(currentPage, totalPages || 1);

  const paginatedLibraries = libraries.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE,
  );

  const libraryStats = useMemo(() => {
    const totalDocuments = libraries.reduce(
      (total, library) => total + (Number(library.documents) || 0),
      0,
    );

    const visibleLibraries = libraries.filter(
      (library) => library.visibility === "public" || library.profileVisible,
    ).length;

    const latestLibrary = libraries[0];

    return {
      totalDocuments,
      visibleLibraries,
      latestLibraryName: latestLibrary ? getLibraryName(latestLibrary) : "No library yet",
    };
  }, [libraries]);

  return (
    <main className="my_library_page">
      <section className="library_content">
        <header className="my_library_hero">
          <div className="my_library_hero_left">
            <span className="library_overline">Library command center</span>

            <h1>My academic collections</h1>

            <p>
              Keep your research folders, course documents and study material in one
              organized place.
            </p>

            <div className="library_header_actions">
              <Link
                to="/dashboard/create-library"
                state={{ from: "/dashboard/libraries" }}
                className="create_library_btn"
              >
                <i className="ti-folder"></i>
                Create or import library
              </Link>
            </div>
          </div>

          <aside className="my_library_hero_card" aria-label="Library overview">
            <div className="hero_card_icon">
              <i className="ti-archive"></i>
            </div>

            <div>
              <span>Latest collection</span>
              <strong>{libraryStats.latestLibraryName}</strong>
            </div>

            <p>
              Open a library to manage files, folders, tags, visibility and storage.
            </p>
          </aside>
        </header>

        <section className="library_stats_grid" aria-label="Library statistics">
          <article>
            <span>Total libraries</span>
            <strong>{libraries.length}</strong>
          </article>

          <article>
            <span>Total documents</span>
            <strong>{libraryStats.totalDocuments}</strong>
          </article>

          <article>
            <span>Visible libraries</span>
            <strong>{libraryStats.visibleLibraries}</strong>
          </article>
        </section>

        <section className="library_board_header">
          <div>
            <h2>Your library board</h2>
            <p>
              {libraries.length === 0
                ? "Create your first library to start collecting documents."
                : `${libraries.length} libraries saved in your study hub.`}
            </p>
          </div>

          {libraries.length > 0 && (
            <span className="library_page_count">
              Page {safeCurrentPage} of {totalPages}
            </span>
          )}
        </section>

        {libraries.length === 0 ? (
          <section className="empty_library_state">
            <div className="empty_library_icon">
              <i className="ti-folder"></i>
            </div>

            <h2>No libraries yet</h2>

            <p>
              Create a library to group documents by subject, project or research
              topic.
            </p>

            <Link
              to="/dashboard/create-library"
              state={{ from: "/dashboard/libraries" }}
              className="empty_library_action"
            >
              <i className="ti-plus"></i>
              Create first library
            </Link>
          </section>
        ) : (
          <section className="collection_grid">
            {paginatedLibraries.map((library, index) => {
              const libraryName = getLibraryName(library);
              const documentCount = Number(library.documents) || 0;

              return (
                <Link
                  to={`/dashboard/libraries/${library.id}`}
                  state={{ library, from: "/dashboard/libraries" }}
                  className="collection_card collection_card_link"
                  key={library.id}
                >
                  <div className="collection_top">
                    <div
                      className={`collection_icon ${
                        library.highlight ? "highlight" : ""
                      }`}
                    >
                      <i className={library.icon || "ti-archive"}></i>
                    </div>

                    <span className="collection_index">
                      {String((safeCurrentPage - 1) * ITEMS_PER_PAGE + index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="collection_body">
                    <h3>{libraryName}</h3>
                    <p>
                      {documentCount} {documentCount === 1 ? "document" : "documents"}
                    </p>
                  </div>

                  <div className="collection_footer">
                    <span>{library.updatedAt || "Updated just now"}</span>
                    <span className="collection_arrow" aria-hidden="true">
                      <i className="ti-arrow-right"></i>
                    </span>
                  </div>
                </Link>
              );
            })}
          </section>
        )}

        {totalPages > 1 && (
          <nav className="library_pagination" aria-label="Library pagination">
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
                  aria-label={`Go to page ${page}`}
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
              aria-label="Next page"
            >
              ›
            </button>
          </nav>
        )}
      </section>
    </main>
  );
}

export default MyLibraryPage;
