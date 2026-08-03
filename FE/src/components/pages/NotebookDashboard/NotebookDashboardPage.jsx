import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiOutlinePlus,
  HiOutlineMagnifyingGlass,
  HiOutlineSquares2X2,
  HiOutlineListBullet,
  HiOutlineBookOpen,
  HiOutlineTrash,
  HiOutlinePencil,
  HiOutlineCircleStack,
  HiOutlineSparkles,
  HiEllipsisVertical,
  HiOutlineFolderPlus,
  HiOutlineXMark,
  HiOutlineChevronDown,
} from "react-icons/hi2";
import { getMyLibraries, createLibrary, deleteLibrary } from "../../../utils/documentApi.js";
import { getPublicLibraries } from "../../../utils/publicApi.js";
import { getStoredUser } from "../../../utils/authToken.js";
import Toast from "../../common/Toast/Toast.jsx";
import { showPopupConfirm } from "../../common/ActionPopup/actionPopupService.js";
import "./NotebookDashboardPage.css";

/**
 * NotebookDashboardPage Component
 * Provides a Google NotebookLM-style dashboard for managing AI Study Hub libraries.
 * Features 100% English UI, dark-mode aesthetics, custom English Toast popups,
 * sleek library creation modal, 50MB storage limit indicator, and grid/list view toggles.
 */
export default function NotebookDashboardPage() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const isGuest = String(user?.role || "").toUpperCase() === "GUEST";

  // Active filter tab: 'all' | 'my' | 'featured' | 'collections'
  const [activeTab, setActiveTab] = useState("all");

  // Search query & view mode state
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
  const [sortBy, setSortBy] = useState("recent"); // 'recent' | 'name'

  // Data states for libraries & storage
  const [libraries, setLibraries] = useState([]);
  const [featuredLibraries, setFeaturedLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalStorageBytes, setTotalStorageBytes] = useState(0);

  // Modal state for creating a new library
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newLibName, setNewLibName] = useState("");
  const [newLibDesc, setNewLibDesc] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Toast Notification state
  const [toast, setToast] = useState({ message: "", title: "", type: "error" });

  /**
   * Helper to trigger custom English toast popup
   */
  const showToast = (message, title = "Error", type = "error") => {
    setToast({ message, title, type });
  };

  /**
   * Fetches personal and featured libraries on mount
   */
  useEffect(() => {
    let isMounted = true;
    async function loadDashboardData() {
      setLoading(true);
      try {
        if (isGuest) {
          const publicLibs = await getPublicLibraries();
          if (isMounted) {
            setLibraries([]);
            setFeaturedLibraries(publicLibs || []);
          }
        } else {
          const [myLibs, publicLibs] = await Promise.all([
            getMyLibraries(),
            getPublicLibraries(),
          ]);

          if (isMounted) {
            setLibraries(myLibs || []);
            setFeaturedLibraries(publicLibs || []);

            // Compute total storage used across all libraries (50MB limit)
            const usedBytes = (myLibs || []).reduce((acc, lib) => {
              return acc + (Number(lib.total_size_bytes) || Number(lib.size_bytes) || 0);
            }, 0);
            setTotalStorageBytes(usedBytes);
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
   * Creates a new library with 50MB quota check & custom English Toast alert
   */
  const handleCreateLibrary = async (e) => {
    e.preventDefault();
    if (!newLibName.trim()) {
      showToast("Please enter a library name.", "Validation Error", "error");
      return;
    }

    setCreating(true);
    try {
      const created = await createLibrary({
        name: newLibName.trim(),
        description: newLibDesc.trim(),
        is_public: isPublic,
      });

      if (created) {
        setLibraries((prev) => [created, ...prev]);
        setIsCreateModalOpen(false);
        setNewLibName("");
        setNewLibDesc("");
        setIsPublic(false);
        navigate(`/dashboard/libraries/${created.id}`);
      }
    } catch (err) {
      const errorMsg =
        err?.response?.data?.message || err?.message || "Failed to create library. Please try again.";
      showToast(errorMsg, "Cannot Create Library", "error");
    } finally {
      setCreating(false);
    }
  };

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
      showToast("Library deleted successfully.", "Success", "success");
    } catch (err) {
      showToast("Failed to delete library: " + (err.message || "Unknown error"), "Error", "error");
    }
  };

  /**
   * Filtered and sorted library list computation
   */
  const filteredLibraries = useMemo(() => {
    let sourceList = libraries;

    if (activeTab === "my") {
      sourceList = libraries;
    } else if (activeTab === "featured") {
      sourceList = featuredLibraries;
    } else if (activeTab === "collections") {
      sourceList = libraries.filter((l) => l.is_public);
    }

    let list = sourceList.filter((lib) => {
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
  }, [libraries, featuredLibraries, activeTab, searchQuery, sortBy]);

  // Compute 50MB storage stats
  const MAX_STORAGE_BYTES = 50 * 1024 * 1024;
  const storageMB = (totalStorageBytes / (1024 * 1024)).toFixed(1);
  const storagePercentage = Math.min(
    100,
    Math.round((totalStorageBytes / MAX_STORAGE_BYTES) * 100)
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

      {/* Top Filter Tabs & Action Bar */}
      <header className="notebook_dashboard_header">
        <div className="tab_navigation">
          <button
            type="button"
            className={`tab_btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All
          </button>
          <button
            type="button"
            className={`tab_btn ${activeTab === "my" ? "active" : ""}`}
            onClick={() => setActiveTab("my")}
          >
            My Libraries
          </button>
          <button
            type="button"
            className={`tab_btn ${activeTab === "featured" ? "active" : ""}`}
            onClick={() => setActiveTab("featured")}
          >
            Featured Libraries
          </button>
          <button
            type="button"
            className={`tab_btn ${activeTab === "collections" ? "active" : ""}`}
            onClick={() => setActiveTab("collections")}
          >
            Collections
          </button>
        </div>

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
          <div className="sort_dropdown_wrapper">
            <select
              className="sort_dropdown"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort libraries"
            >
              <option value="recent">Most recent</option>
              <option value="name">Name (A-Z)</option>
            </select>
            <HiOutlineChevronDown aria-hidden="true" />
          </div>

          {/* Create New Library Button */}
          {!isGuest && (
            <button
              type="button"
              className="create_new_btn"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <HiOutlinePlus />
              <span>Create new</span>
            </button>
          )}
        </div>
      </header>

      {/* Total Storage Limit Indicator (50 MB Cap) */}
      {!isGuest && (
        <div className="storage_indicator_card">
          <div className="storage_info">
            <HiOutlineCircleStack className="storage_icon" />
            <span>
              Total Storage Used: <strong>{storageMB} MB</strong> / 50 MB
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

      {/* Featured Libraries Banner Section */}
      {featuredLibraries.length > 0 && activeTab === "all" && (
        <section className="featured_section">
          <div className="section_title">
            <HiOutlineSparkles className="sparkle_icon" />
            <h2>Featured Libraries</h2>
          </div>
          <div className="featured_grid">
            {featuredLibraries.slice(0, 4).map((lib, idx) => (
              <div
                key={lib.id || idx}
                className="featured_card"
                onClick={() => navigate(`/dashboard/libraries/${lib.id}`)}
              >
                <div
                  className="featured_cover"
                  style={{
                    background: `linear-gradient(135deg, ${["#1e293b, #334155", "#0f172a, #1e1b4b", "#172554, #1e3a8a", "#311042, #581c87"][idx % 4]
                      })`,
                  }}
                >
                  <span className="featured_badge">Featured</span>
                  <h3>{lib.name || lib.libraryName}</h3>
                  <p>{lib.documents || 0} sources</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Libraries Grid / List Section */}
      <section className="recent_section">
        <div className="section_title">
          <h2>Recent Libraries</h2>
        </div>

        {loading ? (
          <div className="loading_state">
            <p>Loading libraries...</p>
          </div>
        ) : (
          <div className={`libraries_layout ${viewMode}`}>
            {/* Create New Card (First item in Grid) */}
            {!isGuest && viewMode === "grid" && (
              <div
                className="library_card create_card"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <div className="create_icon_circle">
                  <HiOutlinePlus />
                </div>
                <span>Create new library</span>
              </div>
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
                  <div className="card_actions">
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

      {/* Modern Sleek NotebookLM Modal for Creating New Library */}
      {isCreateModalOpen && (
        <div className="modal_overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal_card sleek_modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <div className="modal_title_group">
                <div className="modal_icon_badge">
                  <HiOutlineFolderPlus />
                </div>
                <div>
                  <h3>Create New Library</h3>
                  <p>Organize your sources and generate AI insights</p>
                </div>
              </div>
              <button
                type="button"
                className="close_modal_btn"
                onClick={() => setIsCreateModalOpen(false)}
              >
                <HiOutlineXMark />
              </button>
            </div>

            <form onSubmit={handleCreateLibrary} className="modal_form">
              <div className="form_group">
                <label>Library Name <span className="required_star">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Machine Learning & IoT Systems"
                  value={newLibName}
                  onChange={(e) => setNewLibName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form_group">
                <label>Description</label>
                <textarea
                  rows={3}
                  placeholder="Brief summary of topics or documents contained..."
                  value={newLibDesc}
                  onChange={(e) => setNewLibDesc(e.target.value)}
                />
              </div>

              <div className="toggle_switch_row">
                <div className="toggle_info">
                  <strong>Make Library Public</strong>
                  <span>Allow other AI Study Hub users to discover and view this library</span>
                </div>
                <label className="toggle_switch">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  <span className="toggle_slider" />
                </label>
              </div>

              <div className="modal_actions">
                <button
                  type="button"
                  className="cancel_btn"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit_btn" disabled={creating}>
                  {creating ? "Creating Library..." : "Create Library"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
