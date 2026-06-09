import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";

function getSavedLibraries() {
  try {
    return JSON.parse(localStorage.getItem("aiStudyHubLibraries") || "[]");
  } catch (error) {
    console.error("Cannot read libraries from localStorage:", error);
    return [];
  }
}

function getSavedWorkspaces() {
  try {
    return JSON.parse(localStorage.getItem("aiStudyHubWorkspaces") || "[]");
  } catch (error) {
    console.error("Cannot read workspaces from localStorage:", error);
    return [];
  }
}

function saveRecentLibrary(library) {
  const currentRecentLibraries = JSON.parse(
    localStorage.getItem("aiStudyHubRecentLibraries") || "[]"
  );

  const recentLibrary = {
    id: library.id,
    name: library.name || library.libraryName || "Untitled Library",
    description: library.description || "",
    documents: Number(library.documents) || 0,
    icon: library.icon || "ti-archive",
    visitedAt: Date.now(),
  };

  const nextRecentLibraries = [
    recentLibrary,
    ...currentRecentLibraries.filter((item) => item.id !== library.id),
  ].slice(0, 2);

  localStorage.setItem(
    "aiStudyHubRecentLibraries",
    JSON.stringify(nextRecentLibraries)
  );
}

function saveRecentWorkspace(workspace) {
  const currentRecentWorkspaces = JSON.parse(
    localStorage.getItem("aiStudyHubRecentWorkspaces") || "[]"
  );

  const recentWorkspace = {
    id: workspace.id,
    name: workspace.name || "Untitled Workspace",
    documents: Number(workspace.documents) || 0,
    icon: workspace.icon || "ti-layout-grid2",
    visitedAt: Date.now(),
  };

  const nextRecentWorkspaces = [
    recentWorkspace,
    ...currentRecentWorkspaces.filter((item) => item.id !== workspace.id),
  ].slice(0, 3);

  localStorage.setItem(
    "aiStudyHubRecentWorkspaces",
    JSON.stringify(nextRecentWorkspaces)
  );
}

function Navbar({ onOpenSidebar }) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const libraries = getSavedLibraries();
  const workspaces = getSavedWorkspaces();

  const searchResults = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();

    if (keyword === "") {
      return [];
    }

    const matchedLibraries = libraries
      .filter((library) => {
        const libraryName = library.name || library.libraryName || "";
        const libraryDescription = library.description || "";

        return (
          libraryName.toLowerCase().includes(keyword) ||
          libraryDescription.toLowerCase().includes(keyword)
        );
      })
      .map((library) => ({
        id: library.id,
        type: "library",
        title: library.name || library.libraryName || "Untitled Library",
        description: library.description || `${Number(library.documents) || 0} documents`,
        icon: library.icon || "ti-archive",
        data: library,
      }));

    const matchedWorkspaces = workspaces
      .filter((workspace) => {
        const workspaceName = workspace.name || "";
        const workspaceDescription = workspace.description || "";

        return (
          workspaceName.toLowerCase().includes(keyword) ||
          workspaceDescription.toLowerCase().includes(keyword)
        );
      })
      .map((workspace) => ({
        id: workspace.id,
        type: "workspace",
        title: workspace.name || "Untitled Workspace",
        description: workspace.description || `${Number(workspace.documents) || 0} documents`,
        icon: workspace.icon || "ti-layout-grid2",
        data: workspace,
      }));

    return [...matchedLibraries, ...matchedWorkspaces].slice(0, 8);
  }, [searchValue, libraries, workspaces]);

  function handleOpenSearchResult(result) {
    if (result.type === "library") {
      saveRecentLibrary(result.data);
      navigate(`/dashboard/libraries/${result.id}`, {
        state: {
          library: result.data,
          from: window.location.pathname,
        },
      });
    }

    if (result.type === "workspace") {
      saveRecentWorkspace(result.data);
      navigate(`/dashboard/workspaces/${result.id}`, {
        state: {
          workspace: result.data,
          from: window.location.pathname,
        },
      });
    }

    setSearchValue("");
    setIsSearchFocused(false);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();

    if (searchResults.length === 0) return;

    handleOpenSearchResult(searchResults[0]);
  }

  const shouldShowSearchPanel = isSearchFocused && searchValue.trim() !== "";

  return (
    <header className="top_navbar">
      <div className="nav_left">
        <button className="menu_btn" onClick={onOpenSidebar}>
          ☰
        </button>
      </div>

      <form className="search_box" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          value={searchValue}
          placeholder="Search your library or workspace..."
          onChange={(e) => setSearchValue(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
        />

        {shouldShowSearchPanel && (
          <div className="global_search_panel">
            {searchResults.length === 0 ? (
              <div className="global_search_empty">
                <i className="ti-search"></i>
                <p>No library or workspace found.</p>
              </div>
            ) : (
              searchResults.map((result) => (
                <button
                  type="button"
                  className="global_search_item"
                  key={`${result.type}-${result.id}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleOpenSearchResult(result)}
                >
                  <div className="global_search_icon">
                    <i className={result.icon}></i>
                  </div>

                  <div>
                    <strong>{result.title}</strong>
                    <p>{result.description}</p>
                  </div>

                  <span>{result.type}</span>
                </button>
              ))
            )}
          </div>
        )}
      </form>

      <div className="nav_actions">
        <div className="create_dropdown">
          <button type="button" className="create_dropdown_btn">
            <i className="ti-plus"></i>
          </button>

          <div className="create_dropdown_menu">
            <Link to="/dashboard/create-library">
              <i className="ti-folder"></i>
              Create library
            </Link>

            <Link to="/dashboard/create-workspace">
              <i className="ti-layout-grid2"></i>
              Create workspace
            </Link>
          </div>
        </div>

        <button>
          <i className="ti-bell"></i>
        </button>

        <Link
          to="/dashboard/profile"
          className="profile_avatar"
          aria-label="Go to personal profile"
        />
      </div>
    </header>
  );
}

export default Navbar;