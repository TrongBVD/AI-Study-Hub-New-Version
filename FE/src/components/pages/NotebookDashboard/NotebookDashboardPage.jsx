import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineMagnifyingGlass,
  HiOutlineSquares2X2,
  HiOutlineListBullet,
  HiOutlineBookOpen,
  HiOutlineFolderPlus,
  HiOutlineTrash,
  HiOutlinePencil,
  HiOutlineCircleStack,
  HiEllipsisVertical,
  HiOutlineChevronDown,
  HiOutlineUserCircle,
  HiOutlinePlus,
  HiOutlineSquaresPlus,
  HiOutlineXMark,
} from "react-icons/hi2";
import {
  createLibrary,
  getMyLibraries,
  getMyLibraryStorageUsage,
  deleteLibrary,
} from "../../../utils/documentApi.js";
import { getStoredUser } from "../../../utils/authToken.js";
import Toast from "../../common/Toast/Toast.jsx";
import { showPopupConfirm } from "../../common/ActionPopup/actionPopupService.js";
import "./NotebookDashboardPage.css";

/**
 * NotebookDashboardPage Component
 * Provides a Google NotebookLM-style dashboard for managing AI Study Hub libraries.
 * Features 100% English UI, dark-mode aesthetics, custom English Toast popups,
 * a 50MB storage limit indicator and grid/list view toggles.
 */
export default function NotebookDashboardPage() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const isGuest = String(user?.role || "").toUpperCase() === "GUEST";

  // Search query & view mode state
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
  const [sortBy, setSortBy] = useState("recent"); // 'recent' | 'name'
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const sortDropdownRef = useRef(null);
  const createDropdownRef = useRef(null);
  const activeMenuRef = useRef(null);

  // Data states for libraries & storage
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalStorageBytes, setTotalStorageBytes] = useState(0);
  const [storageLimitBytes, setStorageLimitBytes] = useState(50 * 1024 * 1024);

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newLibrary, setNewLibrary] = useState({
    name: "",
    description: "",
    isPublic: false,
  });
  const [isCreating, setIsCreating] = useState(false);

  // Toast Notification state
  const [toast, setToast] = useState({ message: "", title: "", type: "error" });

  useEffect(() => {
    const closeSortDropdown = (event) => {
      if (!sortDropdownRef.current?.contains(event.target)) {
        setIsSortOpen(false);
      }
      if (!createDropdownRef.current?.contains(event.target)) {
        setIsCreateMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeSortDropdown);
    return () => document.removeEventListener("pointerdown", closeSortDropdown);
  }, []);

  useEffect(() => {
    if (activeMenuId === null) return undefined;

    const closeCardMenu = (event) => {
      if (!activeMenuRef.current?.contains(event.target)) {
        setActiveMenuId(null);
      }
    };

    document.addEventListener("pointerdown", closeCardMenu);
    return () => document.removeEventListener("pointerdown", closeCardMenu);
  }, [activeMenuId]);

  /**
   * Helper to trigger custom English toast popup
   */
  const showToast = (message, title = "Error", type = "error") => {
    setToast({ message, title, type });
  };

  /**
   * Fetches personal libraries on mount
   */
  useEffect(() => {
    let isMounted = true;
    async function loadDashboardData() {
      setLoading(true);
      try {
        if (!isGuest) {
          const [myLibs, storageUsage] = await Promise.all([
            getMyLibraries(),
            getMyLibraryStorageUsage().catch((storageError) => {
              console.warn("Failed to load library storage usage:", storageError);
              return null;
            }),
          ]);

          if (isMounted) {
            setLibraries(myLibs || []);
            if (storageUsage) {
              setTotalStorageBytes(Math.max(0, Number(storageUsage.usedBytes) || 0));
              setStorageLimitBytes(
                Math.max(1, Number(storageUsage.limitBytes) || 50 * 1024 * 1024),
              );
            }
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard libraries:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, [isGuest]);

  /**
   * Deletes a library
   */
  const handleDeleteLibrary = async (libId, e) => {
    e.stopPropagation();
    const confirmed = await showPopupConfirm(
      "Are you sure you want to delete this library? This action cannot be undone.",
      { title: "Delete library?", confirmText: "Delete", tone: "danger" },
    );
    if (!confirmed) return;

    try {
      await deleteLibrary(libId);
      setLibraries((prev) => prev.filter((lib) => lib.id !== libId));
      try {
        const storageUsage = await getMyLibraryStorageUsage();
        setTotalStorageBytes(Math.max(0, Number(storageUsage?.usedBytes) || 0));
        setStorageLimitBytes(
          Math.max(1, Number(storageUsage?.limitBytes) || 50 * 1024 * 1024),
        );
      } catch (storageError) {
        console.warn("Failed to refresh library storage usage:", storageError);
      }
      showToast("Library deleted successfully.", "Success", "success");
    } catch (err) {
      showToast("Failed to delete library: " + (err.message || "Unknown error"), "Error", "error");
    }
  };

  const closeCreateModal = () => {
    if (isCreating) return;
    setIsCreateModalOpen(false);
    setNewLibrary({ name: "", description: "", isPublic: false });
  };

  const handleCreateLibrary = async (event) => {
    event.preventDefault();
    const name = newLibrary.name.trim();

    if (!name) {
      showToast("Please enter a library name.", "Name required", "error");
      return;
    }

    setIsCreating(true);
    try {
      const createdLibrary = await createLibrary({
        name,
        description: newLibrary.description.trim(),
        is_public: newLibrary.isPublic,
      });
      setLibraries((current) => [createdLibrary, ...current]);
      setIsCreateModalOpen(false);
      setNewLibrary({ name: "", description: "", isPublic: false });
      navigate(`/dashboard/libraries/${createdLibrary.id}`);
    } catch (error) {
      showToast(
        error.response?.data?.message || error.message || "Could not create the library.",
        "Create library failed",
        "error",
      );
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Filtered and sorted library list computation
   */
  const filteredLibraries = useMemo(() => {
    let list = libraries.filter((lib) => {
      const name = lib.name || lib.libraryName || "";
      const desc = lib.description || "";
      return (
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        desc.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    if (sortBy === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else {
      list.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0) -
          new Date(a.updated_at || a.created_at || 0)
      );
    }

    return list;
  }, [libraries, searchQuery, sortBy]);

  // Compute 50MB storage stats
  const storageMB = (totalStorageBytes / (1024 * 1024)).toFixed(1);
  const storageLimitMB = (storageLimitBytes / (1024 * 1024)).toFixed(0);
  const storagePercentage = Math.min(
    100,
    Math.round((totalStorageBytes / storageLimitBytes) * 100)
  );

  return (
    <div className="notebook_dashboard_container">
      {/* Custom English Toast Notification Banner */}
      <Toast
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast({ message: "", title: "", type: "error" })}
      />

      {/* Top Action Bar (For logged-in users only) */}
      {!isGuest && (
        <header className="notebook_dashboard_header">
          <div className="dashboard_controls">
            {/* Search Box */}
            <div className="search_input_wrapper">
              <HiOutlineMagnifyingGlass className="search_icon" />
              <input
                type="text"
                placeholder="Search libraries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* View Mode Toggle Button */}
            <div className="view_mode_toggle">
              <button
                type="button"
                className={`toggle_btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid View"
              >
                <HiOutlineSquares2X2 />
              </button>
              <button
                type="button"
                className={`toggle_btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="List View"
              >
                <HiOutlineListBullet />
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="sort_dropdown_wrapper" ref={sortDropdownRef}>
              <button
                type="button"
                className={`sort_dropdown_trigger ${isSortOpen ? "open" : ""}`}
                onClick={() => {
                  setIsSortOpen((open) => !open);
                  setIsCreateMenuOpen(false);
                }}
                aria-label="Sort libraries"
                aria-haspopup="listbox"
                aria-expanded={isSortOpen}
              >
                <span>{sortBy === "recent" ? "Most recent" : "Name (A-Z)"}</span>
                <HiOutlineChevronDown aria-hidden="true" />
              </button>

              {isSortOpen && (
                <div className="sort_dropdown_menu" role="listbox" aria-label="Sort libraries">
                  {[
                    { value: "recent", label: "Most recent" },
                    { value: "name", label: "Name (A-Z)" },
                  ].map((option) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={sortBy === option.value}
                      className={`sort_dropdown_option ${sortBy === option.value ? "selected" : ""}`}
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        setIsSortOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard_create_dropdown" ref={createDropdownRef}>
              <button
                type="button"
                className={`create_new_btn ${isCreateMenuOpen ? "open" : ""}`}
                onClick={() => {
                  setIsCreateMenuOpen((open) => !open);
                  setIsSortOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={isCreateMenuOpen}
              >
                <HiOutlinePlus aria-hidden="true" />
                <span>Create new</span>
              </button>

              {isCreateMenuOpen && (
                <div className="dashboard_create_menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsCreateMenuOpen(false);
                      setIsCreateModalOpen(true);
                    }}
                  >
                    <HiOutlineBookOpen aria-hidden="true" />
                    <span>
                      <strong>New library</strong>
                      <small>Create a personal study collection</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate("/dashboard/create-workspace")}
                  >
                    <HiOutlineSquaresPlus aria-hidden="true" />
                    <span>
                      <strong>New workspace</strong>
                      <small>Create a collaborative study space</small>
                    </span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>
      )}

      {/* Total Storage Limit Indicator (50 MB Cap) */}
      {!isGuest && (
        <div className="storage_indicator_card">
          <div className="storage_info">
            <HiOutlineCircleStack className="storage_icon" />
            <span>
              Total Storage Used: <strong>{storageMB} MB</strong> / {storageLimitMB} MB
            </span>
          </div>
          <div className="storage_bar_track">
            <div
              className={`storage_bar_fill ${storagePercentage > 90 ? "warning" : ""}`}
              style={{ width: `${storagePercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* All Libraries Grid / List Section */}
      <section className="all_libraries_section">
        <div className="section_title">
          <h2>All Libraries</h2>
        </div>

        {/* Guest Authentication Banner */}
        {isGuest && (
          <div className="guest_auth_banner">
            <div className="guest_banner_content">
              <div className="guest_banner_badge">
                <HiOutlineUserCircle />
                <span>Guest Access Mode</span>
              </div>
              <h3>Sign in to create & manage your study libraries</h3>
              <p>
                Please log in or register an account to upload documents, create custom study libraries, generate AI flashcards, and save your chat history.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading_state">
            <p>Loading libraries...</p>
          </div>
        ) : (
          <div className={`libraries_layout ${viewMode}`}>
            {!isGuest && (
              <button
                type="button"
                className="create_library_card"
                onClick={() => setIsCreateModalOpen(true)}
                aria-label="Create a new library"
              >
                <span className="create_library_card_icon" aria-hidden="true">
                  <HiOutlinePlus />
                </span>
                <span>Create new library</span>
              </button>
            )}
            {filteredLibraries.map((lib) => (
              <div
                key={lib.id}
                className="library_card"
                onClick={() => navigate(`/dashboard/libraries/${lib.id}`)}
              >
                <div className="card_header">
                  <div className="card_cover_icon">
                    <HiOutlineBookOpen />
                  </div>
                  <div
                    className="card_actions"
                    ref={activeMenuId === lib.id ? activeMenuRef : null}
                  >
                    <button
                      type="button"
                      className="more_btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === lib.id ? null : lib.id);
                      }}
                    >
                      <HiEllipsisVertical />
                    </button>

                    {activeMenuId === lib.id && (
                      <div className="card_dropdown_menu" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            navigate(`/dashboard/libraries/${lib.id}`);
                          }}
                        >
                          <HiOutlinePencil /> Open
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            setActiveMenuId(null);
                            handleDeleteLibrary(lib.id, e);
                          }}
                          className="danger"
                        >
                          <HiOutlineTrash /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card_body">
                  <h3>{lib.name || lib.libraryName || "Untitled Library"}</h3>
                  <p className="card_description">
                    {lib.description || "No description provided."}
                  </p>
                  <div className="card_meta">
                    <span>{lib.documents || 0} sources</span>
                    <span>•</span>
                    <span>
                      {new Date(lib.updated_at || lib.created_at || Date.now()).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {isCreateModalOpen && (
        <div
          className="modal_overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateModal();
          }}
        >
          <div
            className="sleek_modal create_library_modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-library-title"
          >
            <div className="modal_header">
              <div className="modal_title_group">
                <div className="modal_icon_badge" aria-hidden="true">
                  <HiOutlineFolderPlus />
                </div>
                <div>
                  <h3 id="create-library-title">Create New Library</h3>
                  <p>Organize your sources and generate AI insights</p>
                </div>
              </div>
              <button
                type="button"
                className="close_modal_btn"
                onClick={closeCreateModal}
                aria-label="Close create library dialog"
              >
                <HiOutlineXMark />
              </button>
            </div>

            <form className="modal_form" onSubmit={handleCreateLibrary}>
              <div className="form_group">
                <label htmlFor="new-library-name">
                  Library name <span className="required_star">*</span>
                </label>
                <input
                  id="new-library-name"
                  type="text"
                  maxLength={100}
                  autoFocus
                  value={newLibrary.name}
                  onChange={(event) =>
                    setNewLibrary((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="e.g. Machine Learning & IoT Systems"
                  disabled={isCreating}
                />
              </div>

              <div className="form_group">
                <label htmlFor="new-library-description">Description</label>
                <textarea
                  id="new-library-description"
                  maxLength={500}
                  value={newLibrary.description}
                  onChange={(event) =>
                    setNewLibrary((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Brief summary of topics or documents contained..."
                  disabled={isCreating}
                />
              </div>

              <div className="toggle_switch_row">
                <div className="toggle_info">
                  <strong>Make Library Public</strong>
                  <span>Allow other AI Study Hub users to discover and view this library</span>
                </div>
                <label className="toggle_switch" aria-label="Make library public">
                  <input
                    type="checkbox"
                    checked={newLibrary.isPublic}
                    onChange={(event) =>
                      setNewLibrary((current) => ({
                        ...current,
                        isPublic: event.target.checked,
                      }))
                    }
                    disabled={isCreating}
                  />
                  <span className="toggle_slider" />
                </label>
              </div>

              <div className="modal_actions">
                <button type="button" className="cancel_btn" onClick={closeCreateModal} disabled={isCreating}>
                  Cancel
                </button>
                <button type="submit" className="submit_btn" disabled={isCreating || !newLibrary.name.trim()}>
                  {isCreating ? "Creating..." : "Create Library"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
