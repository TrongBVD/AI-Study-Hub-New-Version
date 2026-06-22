import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

import "./ImportLibraryPage.css";

function readStorageList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function normalizeLibraryName(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase();
}

function ImportLibraryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = location.state?.from || "/dashboard/libraries";

  const [libraryLink, setLibraryLink] = useState("");
  const [libraryName, setLibraryName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceLibrary, setSourceLibrary] = useState(null);
  const [sourceItems, setSourceItems] = useState([]);
  const [linkError, setLinkError] = useState("");

  const trimmedLink = libraryLink.trim();
  const trimmedName = libraryName.trim();
  const trimmedDescription = description.trim();
  const savedLibraries = readStorageList("aiStudyHubLibraries");
  const isDuplicateName =
    trimmedName.length > 0 &&
    savedLibraries.some(
      (library) =>
        normalizeLibraryName(library.name || library.libraryName) ===
        normalizeLibraryName(trimmedName),
    );
  const storedFileCount = sourceItems.filter((item) => item.type !== "folder").length;
  const fileCount =
    storedFileCount || Number(sourceLibrary?.documents || 0);
  const folderCount = sourceItems.filter((item) => item.type === "folder").length;
  const canImport = Boolean(sourceLibrary && trimmedName && !isDuplicateName);

  function resolveLibraryLink() {
    setLinkError("");
    setSourceLibrary(null);
    setSourceItems([]);

    if (!trimmedLink) {
      setLinkError("Please enter a library link.");
      return;
    }

    try {
      const parsedUrl = new URL(trimmedLink, window.location.origin);
      const match = parsedUrl.pathname.match(/\/dashboard\/libraries\/([^/?#]+)/);
      const libraryId = match?.[1];

      if (!libraryId) {
        throw new Error("This is not a valid AI Study Hub library link.");
      }

      const savedLibraries = readStorageList("aiStudyHubLibraries");
      const matchedLibrary = savedLibraries.find(
        (library) => String(library.id) === decodeURIComponent(libraryId),
      );

      if (!matchedLibrary) {
        throw new Error(
          "This library is not available in the current browser session.",
        );
      }

      const importedItems = readStorageList(
        `aiStudyHubImportedLibraryItems:${matchedLibrary.id}`,
      );

      setSourceLibrary(matchedLibrary);
      setSourceItems(importedItems);
      setLibraryName(matchedLibrary.name || "Imported library");
      setDescription(matchedLibrary.description || "");
    } catch (error) {
      setLinkError(error.message || "Cannot read this library link.");
    }
  }

  function handleImportLibrary() {
    if (!canImport) return;

    const importTimestamp = Date.now();
    const importedIdMap = new Map(
      sourceItems.map((item, index) => [
        item.id,
        `imported-${importTimestamp}-${index}`,
      ]),
    );
    const normalizedItems = sourceItems.map((item, index) => ({
      ...item,
      id: importedIdMap.get(item.id) || `imported-${importTimestamp}-${index}`,
      folderId: item.folderId
        ? importedIdMap.get(item.folderId) || item.folderId
        : null,
      isBackendFile: false,
      importedOnly: true,
    }));
    const newLibrary = {
      ...sourceLibrary,
      id: `library-${importTimestamp}`,
      name: trimmedName,
      description:
        trimmedDescription ||
        "Imported library shared through AI Study Hub.",
      documents:
        normalizedItems.filter((item) => item.type !== "folder").length ||
        Number(sourceLibrary.documents || 0),
      updatedAt: "Imported just now",
      createdAt: new Date().toISOString(),
      icon: sourceLibrary.icon || "ti-archive",
    };
    const currentRecentLibraries = readStorageList(
      "aiStudyHubRecentLibraries",
    );
    const recentLibrary = {
      id: newLibrary.id,
      name: newLibrary.name,
      description: newLibrary.description,
      documents: newLibrary.documents,
      icon: newLibrary.icon,
      updatedAt: newLibrary.updatedAt,
      visitedAt: Date.now(),
    };

    localStorage.setItem(
      "aiStudyHubLibraries",
      JSON.stringify([newLibrary, ...savedLibraries]),
    );
    localStorage.setItem(
      `aiStudyHubImportedLibraryItems:${newLibrary.id}`,
      JSON.stringify(normalizedItems),
    );
    localStorage.setItem(
      "aiStudyHubRecentLibraries",
      JSON.stringify([
        recentLibrary,
        ...currentRecentLibraries.filter((item) => item.id !== newLibrary.id),
      ].slice(0, 2)),
    );

    navigate(`/dashboard/libraries/${newLibrary.id}`, {
      state: {
        library: newLibrary,
        importedItems: normalizedItems,
      },
    });
  }

  return (
    <main className="import_library_page">
      <section className="import_library_shell">
        <section className="import_library_hero">
          <div className="import_library_hero_content">
            <button
              type="button"
              className="import_library_back"
              onClick={() => navigate(returnPath)}
            >
              <i className="ti-angle-left" />
              Back
            </button>

            <div>
              <span className="import_library_kicker">Library importer</span>
              <h1>Bring a shared library into your study hub.</h1>
              <p>
                Paste a library link, review its information and choose how the
                imported copy should appear in your account.
              </p>
            </div>

            <div className="import_library_steps" aria-label="Import steps">
              <article>
                <strong>01</strong>
                <span>Paste library link</span>
              </article>
              <article>
                <strong>02</strong>
                <span>Review details</span>
              </article>
              <article>
                <strong>03</strong>
                <span>Import library</span>
              </article>
            </div>
          </div>

          <aside className="import_library_preview" aria-label="Import preview">
            <div className="import_preview_topline">
              <span className="import_preview_icon">
                <i className={sourceLibrary?.icon || "ti-link"} />
              </span>
              <span className={`import_preview_badge ${sourceLibrary ? "is-ready" : ""}`}>
                {sourceLibrary ? "Ready" : "Waiting"}
              </span>
            </div>

            <div className="import_preview_body">
              <span>Library preview</span>
              <h2>{trimmedName || "No library selected"}</h2>
              <p>
                {trimmedDescription ||
                  "Enter a valid library link to preview its information here."}
              </p>
            </div>

            <div className="import_preview_footer">
              <div>
                <strong>{fileCount}</strong>
                <span>Documents</span>
              </div>
              <div>
                <strong>{folderCount}</strong>
                <span>Folders</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="import_library_card">
          <header className="import_section_header">
            <div>
              <span className="import_section_number">01</span>
              <h2>Library information</h2>
              <p>Enter the shared link and information for the imported copy.</p>
            </div>
            <span className="import_format_badge">SHARED LINK</span>
          </header>

          <div className="import_link_form">
            <div className="import_form_group import_link_group">
              <label htmlFor="libraryLink">Library link *</label>
              <div className="import_link_input">
                <i className="ti-link" />
                <input
                  id="libraryLink"
                  type="url"
                  value={libraryLink}
                  onChange={(event) => {
                    setLibraryLink(event.target.value);
                    setSourceLibrary(null);
                    setSourceItems([]);
                    setLibraryName("");
                    setDescription("");
                    setLinkError("");
                  }}
                  placeholder="https://studyhub.app/dashboard/libraries/library-id"
                />
                <button type="button" onClick={resolveLibraryLink}>
                  Check link
                </button>
              </div>
              {linkError && <p className="import_field_error">{linkError}</p>}
              {!linkError && sourceLibrary && (
                <p className="import_field_success">
                  <i className="ti-check" /> Library link verified.
                </p>
              )}
            </div>

            <div className="import_form_group">
              <label htmlFor="importLibraryName">Library name *</label>
              <input
                id="importLibraryName"
                type="text"
                value={libraryName}
                maxLength={50}
                onChange={(event) => setLibraryName(event.target.value)}
                placeholder="Enter a name for this library"
              />
              <div className="import_field_meta">
                <span>
                  {isDuplicateName
                    ? "This library name already exists."
                    : "The imported copy can use a different name."}
                </span>
                <strong className={isDuplicateName ? "is-error" : ""}>
                  {isDuplicateName ? "Unavailable" : `${libraryName.length} / 50`}
                </strong>
              </div>
            </div>

            <div className="import_form_group">
              <label htmlFor="importLibraryDescription">Description</label>
              <textarea
                id="importLibraryDescription"
                value={description}
                maxLength={350}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Write a short description for the imported library"
              />
              <div className="import_field_meta">
                <span>Describe what this library contains.</span>
                <strong>{description.length} / 350</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="import_library_card">
          <header className="import_section_header">
            <div>
              <span className="import_section_number">02</span>
              <h2>Review library</h2>
              <p>Confirm the library details before adding it to your account.</p>
            </div>
          </header>

          <div className="import_review_grid">
            <article>
              <span className="import_review_icon">
                <i className="ti-book" />
              </span>
              <div>
                <small>Library title</small>
                <strong>{trimmedName || "Not available"}</strong>
              </div>
            </article>
            <article>
              <span className="import_review_icon">
                <i className="ti-files" />
              </span>
              <div>
                <small>Stored items</small>
                <strong>{fileCount} files · {folderCount} folders</strong>
              </div>
            </article>
            <article>
              <span className="import_review_icon">
                <i className="ti-eye" />
              </span>
              <div>
                <small>Visibility</small>
                <strong>{sourceLibrary?.visibility || "Not available"}</strong>
              </div>
            </article>
          </div>

          <div
            className={`import_validation ${canImport ? "is-valid" : ""} ${
              isDuplicateName ? "has-error" : ""
            }`}
          >
            <i className={canImport ? "ti-check" : "ti-info-alt"} />
            <div>
              <strong>
                {isDuplicateName
                  ? "Choose a unique library name"
                  : canImport
                    ? "Library is ready to import"
                    : "Verify the library link first"}
              </strong>
              <p>
                {isDuplicateName
                  ? "You already have a library with this name."
                  : canImport
                    ? "A new copy will be created, so the shared library remains unchanged."
                    : "The import button will be enabled after the link and name are valid."}
              </p>
            </div>
          </div>
        </section>

        <footer className="import_library_actions">
          <button type="button" onClick={() => navigate(returnPath)}>
            Return
          </button>
          <button
            type="button"
            className="import_library_submit"
            disabled={!canImport}
            onClick={handleImportLibrary}
          >
            <i className="ti-import" />
            Import library
          </button>
        </footer>
      </section>
    </main>
  );
}

export default ImportLibraryPage;
