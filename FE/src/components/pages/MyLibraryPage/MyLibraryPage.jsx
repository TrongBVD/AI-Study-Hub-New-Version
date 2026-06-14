import { useState } from "react";
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

function MyLibraryPage() {
  const [currentPage, setCurrentPage] = useState(1);

  // Đọc trực tiếp từ localStorage để My Library luôn hiển thị library đã tạo/lưu mới nhất.
  const libraries = getSavedLibraries();
const ITEMS_PER_PAGE = 12;

const totalPages = Math.ceil(libraries.length / ITEMS_PER_PAGE);

const safeCurrentPage = Math.min(currentPage, totalPages || 1);

const paginatedLibraries = libraries.slice(
  (safeCurrentPage - 1) * ITEMS_PER_PAGE,
  safeCurrentPage * ITEMS_PER_PAGE,
);
  return (
    <main className="my_library_page">
      <section className="library_content">
        <div className="library_page_header">
          <div>
            <h1>My Academic Collections</h1>
            <p>
              Organize your research, notes, and curriculum data across specific
              domains.
            </p>
          </div>

<div className="library_header_actions">
  <Link
    to="/dashboard/create-library"
    state={{ from: "/dashboard/libraries" }}
    className="create_library_btn"
  >
    <i className="ti-folder"></i>
    Create library
  </Link>
</div>
        </div>

        {libraries.length === 0 ? (
          <section className="empty_library_state">
            <div className="empty_library_icon">
              <i className="ti-folder"></i>
            </div>

            <h2>You have no library here.</h2>

            <p>
              Let&apos;s{" "}
              <Link
                to="/dashboard/create-library"
                state={{ from: "/dashboard/libraries" }}
              >
                create one for now
              </Link>
              .
            </p>
          </section>
        ) : (
          <section className="collection_grid">
            {paginatedLibraries.map((library) => {
              const libraryName =
                library.name || library.libraryName || "Untitled Library";

              return (
                <Link
                  to={`/dashboard/libraries/${library.id}`}
                  state={{ library, from: "/dashboard/libraries" }}
                  className="collection_card collection_card_link"
                  key={library.id}
                >
                  <div
                    className={`collection_icon ${
                      library.highlight ? "highlight" : ""
                    }`}
                  >
                    <i className={library.icon || "ti-archive"}></i>
                  </div>

                  <div className="collection_body">
                    <h3>{libraryName}</h3>
                    <p>{Number(library.documents) || 0} documents</p>
                  </div>

                  <div className="collection_footer">
                    <span>{library.updatedAt || "Updated just now"}</span>
                    <span className="collection_arrow">›</span>
                  </div>
                </Link>
              );
            })}
          </section>
        )}

        {totalPages > 1 && (
  <div className="library_pagination">
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

export default MyLibraryPage;
