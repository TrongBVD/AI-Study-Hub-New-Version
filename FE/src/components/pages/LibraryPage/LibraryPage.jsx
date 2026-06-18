import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getMyDocuments,
  uploadDocuments,
  downloadDocument,
} from "../../../utils/documentApi";

import "./LibraryPage.css";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

function LibraryPage() {
  const LIBRARY_NAME_MAX_LENGTH = 20;
const LIBRARY_STORAGE_LIMIT_BYTES = 50 * 1024 * 1024;
  const [libraryNameMessage, setLibraryNameMessage] = useState("");
  const [isStorageLimitPopupOpen, setIsStorageLimitPopupOpen] = useState(false);
  const { libraryId } = useParams();
  const navigate = useNavigate();

  function handleToggleShareOnProfile() {
    if (libraryVisibility === "private") {
      setLibraryNameMessage(
        "Cannot upload to your personal profile when the library is private."
      );
      return;
    }

    setLibraryNameMessage("");
    setShareOnProfile((currentValue) => !currentValue);
  }
  function handleLibraryNameChange(e) {
    const nextValue = e.target.value;

    if (nextValue.length > LIBRARY_NAME_MAX_LENGTH) return;

    setLibraryName(nextValue);

    if (nextValue.length === LIBRARY_NAME_MAX_LENGTH) {
      setLibraryNameMessage(
        `Library name has reached the limit of ${LIBRARY_NAME_MAX_LENGTH} characters.`
      );
      return;
    }

    setLibraryNameMessage("");
  }
  function getInitialLibraryData() {
  const savedLibraries = JSON.parse(
    localStorage.getItem("aiStudyHubLibraries") || "[]",
  );

  const matchedLibrary = savedLibraries.find(
    (library) => library.id === libraryId,
  );

  if (matchedLibrary) {
    return {
      ...matchedLibrary,
      stars: Number(matchedLibrary.stars) || 0,
      isStarred: Boolean(matchedLibrary.isStarred),
    };
  }

  return {
    id: libraryId || "default-library",
    name: "AI-student-hub",
    description:
      "A learning library for storing study materials, organizing subjects, and using AI to review documents.",
    visibility: "public",
    documents: 0,
    updatedAt: "Updated just now",
    icon: "ti-archive",
    stars: 0,
    isStarred: false,
  };
}

  function formatVisibility(value) {
    return value === "private" ? "Private" : "Public";
  }

  const folderIdRef = useRef(1);
  const authorName =
    localStorage.getItem("aiStudyHubProfileName") || "dangkhoabi456";
  const [libraryData, setLibraryData] = useState(getInitialLibraryData);
  const [stars, setStars] = useState(() => Number(getInitialLibraryData().stars) || 0);

const [isStarred, setIsStarred] = useState(
  () => Boolean(getInitialLibraryData().isStarred)
);
  const [activeTab, setActiveTab] = useState("documents");
  const [documentSearch, setDocumentSearch] = useState("");
  const [currentFolder, setCurrentFolder] = useState(null);


  const [libraryName, setLibraryName] = useState(
    () => getInitialLibraryData().name,
  );
  useEffect(() => {
  if (!libraryData?.id) return;

  const currentRecentLibraries = JSON.parse(
    localStorage.getItem("aiStudyHubRecentLibraries") || "[]"
  );

const recentLibrary = {
  id: libraryData.id,
  name: libraryName || libraryData.name || "Untitled Library",
  documents: Number(libraryData.documents) || 0,
  icon: libraryData.icon || "ti-archive",
  updatedAt: libraryData.updatedAt || "Updated just now",
  stars: Number(libraryData.stars) || 0,
  isStarred: Boolean(libraryData.isStarred),
  visitedAt: Date.now(),
};

  const nextRecentLibraries = [
    recentLibrary,
    ...currentRecentLibraries.filter((item) => item.id !== libraryData.id),
  ].slice(0, 2);

  localStorage.setItem(
    "aiStudyHubRecentLibraries",
    JSON.stringify(nextRecentLibraries)
  );
}, [
  libraryData?.id,
  libraryData?.name,
  libraryData?.documents,
  libraryData?.icon,
  libraryData?.updatedAt,
  libraryData?.stars,
libraryData?.isStarred,
  libraryName,
]);
  const [libraryVisibility, setLibraryVisibility] = useState(
    () => getInitialLibraryData().visibility || "public",
  );

  const [pendingFiles, setPendingFiles] = useState([]);
  const [pendingFolderId, setPendingFolderId] = useState(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [hashtags, setHashtags] = useState(["", "", ""]);

  const [libraryItems, setLibraryItems] = useState([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);

  const [shareOnProfile, setShareOnProfile] = useState(
    () => getInitialLibraryData().shareOnProfile ?? false
  );

function handleToggleStar() {
  const nextIsStarred = !isStarred;
  const nextStars = nextIsStarred ? stars + 1 : Math.max(stars - 1, 0);

  const updatedLibrary = {
    ...libraryData,
    stars: nextStars,
    isStarred: nextIsStarred,
  };

  const savedLibraries = JSON.parse(
    localStorage.getItem("aiStudyHubLibraries") || "[]"
  );

  const hasCurrentLibrary = savedLibraries.some(
    (library) => library.id === updatedLibrary.id
  );

  const updatedLibraries = hasCurrentLibrary
    ? savedLibraries.map((library) =>
        library.id === updatedLibrary.id ? updatedLibrary : library
      )
    : [updatedLibrary, ...savedLibraries];

  localStorage.setItem(
    "aiStudyHubLibraries",
    JSON.stringify(updatedLibraries)
  );

  const recentLibraries = JSON.parse(
    localStorage.getItem("aiStudyHubRecentLibraries") || "[]"
  );

  const updatedRecentLibraries = recentLibraries.map((library) =>
    library.id === updatedLibrary.id
      ? {
          ...library,
          stars: nextStars,
          isStarred: nextIsStarred,
        }
      : library
  );

  localStorage.setItem(
    "aiStudyHubRecentLibraries",
    JSON.stringify(updatedRecentLibraries)
  );

  setStars(nextStars);
  setIsStarred(nextIsStarred);
  setLibraryData(updatedLibrary);
}
  function countUploadedFiles(items) {
    return items.filter((item) => item.type !== "folder").length;
  }

  function syncLibraryDocumentCount(nextItems) {
    const nextDocumentCount = countUploadedFiles(nextItems);

    const updatedLibrary = {
      ...libraryData,
      name: libraryName.trim() || libraryData.name,
      visibility: libraryVisibility,
      shareOnProfile: shareOnProfile,
      documents: nextDocumentCount,
      updatedAt: "Updated just now",
    };

    const savedLibraries = JSON.parse(
      localStorage.getItem("aiStudyHubLibraries") || "[]"
    );

    const hasCurrentLibrary = savedLibraries.some(
      (library) => library.id === updatedLibrary.id
    );

    const updatedLibraries = hasCurrentLibrary
      ? savedLibraries.map((library) =>
        library.id === updatedLibrary.id ? updatedLibrary : library
      )
      : [updatedLibrary, ...savedLibraries];

    localStorage.setItem(
      "aiStudyHubLibraries",
      JSON.stringify(updatedLibraries)
    );

    setLibraryData(updatedLibrary);
  }

  function getFolderKey(folder) {
    return folder.id || folder.name;
  }

  function getFileIcon(fileName) {
    const name = String(fileName || "").toLowerCase();

    if (name.endsWith(".pdf")) return "ti-file";
    if (name.endsWith(".doc") || name.endsWith(".docx")) return "ti-write";
    if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
      return "ti-layout-grid3";
    }

    return "ti-file";
  }

  function formatFileSize(size) {
    const safeSize = Number(size) || 0;

    if (safeSize < 1024 * 1024) {
      return `${(safeSize / 1024).toFixed(0)} KB`;
    }

    return `${(safeSize / 1024 / 1024).toFixed(1)} MB`;
  }

function countUsedStorageBytes(items) {
  return items
    .filter((item) => item.type !== "folder")
    .reduce((total, item) => total + (Number(item.sizeBytes) || 0), 0);
}

  function mapBackendDocumentToLibraryItem(document) {
    return {
      id: document.id,
      type: "file",
      name: document.title || "Untitled document",
      note: `${formatFileSize(document.file_size_bytes || 0)} · Uploaded`,
      size: formatFileSize(document.file_size_bytes || 0),
      sizeBytes: Number(document.file_size_bytes) || 0,
      uploadedTime: document.created_at
        ? new Date(document.created_at).toLocaleString()
        : "Recently",
      uploadedBy: authorName,
      icon: getFileIcon(document.title || ""),
      folderId: null,
      hashtags: [],
      isBackendFile: true,
    };
  }

  async function loadBackendDocuments() {
    try {
      setIsLoadingDocuments(true);

      const backendDocuments = await getMyDocuments();

      const backendItems = (backendDocuments || []).map(
        mapBackendDocumentToLibraryItem,
      );

      setLibraryItems((currentItems) => {
        const localFolders = currentItems.filter(
          (item) => item.type === "folder",
        );
        const nextItems = [...localFolders, ...backendItems];

        syncLibraryDocumentCount(nextItems);

        return nextItems;
      });
    } catch (error) {
      console.error("Cannot load documents:", error);
      alert("Cannot load documents. Please login again.");
    } finally {
      setIsLoadingDocuments(false);
    }
  }
  useEffect(() => {
    async function fetchDocuments() {
      await loadBackendDocuments();
    }

    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function handleUploadFile(e) {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    const MAX_SIZE = 50 * 1024 * 1024;
    const validFiles = [];
    const tooLargeFiles = [];

    files.forEach((file) => {
      if (file.size > MAX_SIZE) {
        tooLargeFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    });

    if (tooLargeFiles.length > 0) {
      alert(`These files exceed 50MB limit:\n- ${tooLargeFiles.join("\n- ")}`);
    }

    if (validFiles.length === 0) {
      e.target.value = "";
      return;
    }

    const selectedFilesSize = validFiles.reduce(
      (total, file) => total + (Number(file.size) || 0),
      0
    );

    const currentUsedStorage = countUsedStorageBytes(libraryItems);
    const nextUsedStorage = currentUsedStorage + selectedFilesSize;

    if (nextUsedStorage > LIBRARY_STORAGE_LIMIT_BYTES) {
      setIsStorageLimitPopupOpen(true);
      e.target.value = "";
      return;
    }

    setPendingFiles(validFiles);
    setPendingFolderId(currentFolder ? getFolderKey(currentFolder) : null);
    setHashtags(["", "", ""]);
    setIsTagModalOpen(true);

    e.target.value = "";
  }

  function handleHashtagChange(index, value) {
    const updatedHashtags = [...hashtags];
    updatedHashtags[index] = value;
    setHashtags(updatedHashtags);
  }

  function handleCancelTaggedUpload() {
    setPendingFiles([]);
    setPendingFolderId(null);
    setHashtags(["", "", ""]);
    setIsTagModalOpen(false);
  }

  async function handleConfirmTaggedUpload() {
    const validHashtags = hashtags
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "")
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));

    if (validHashtags.length < 3) {
      alert("Please enter 3 hashtags before uploading.");
      return;
    }

    if (pendingFiles.length === 0) {
      alert("Please choose at least one file.");
      return;
    }

    try {
      setIsUploadingDocuments(true);

      const uploadedDocuments = await uploadDocuments(pendingFiles);

const uploadedItems = (uploadedDocuments || []).map((document, index) => ({
  ...mapBackendDocumentToLibraryItem(document),
  sizeBytes:
    Number(document.file_size_bytes) ||
    Number(pendingFiles[index]?.size) ||
    0,
  size:
    formatFileSize(
      Number(document.file_size_bytes) ||
      Number(pendingFiles[index]?.size) ||
      0
    ),
  folderId: pendingFolderId,
  hashtags: validHashtags,
}));

      setLibraryItems((currentItems) => {
        const nextItems = [...uploadedItems, ...currentItems];
        syncLibraryDocumentCount(nextItems);
        return nextItems;
      });

      handleCancelTaggedUpload();

      alert("Upload successful.");
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Please check backend and Supabase.");
    } finally {
      setIsUploadingDocuments(false);
    }
  }

  function handleCreateFolder() {
    const folderName = window.prompt("Enter folder name:");

    if (!folderName || folderName.trim() === "") return;

    const newFolder = {
      id: `folder-${folderIdRef.current++}`,
      type: "folder",
      name: folderName.trim(),
      note: "0 files · Created just now",
      icon: "ti-folder",
      folderId: currentFolder ? getFolderKey(currentFolder) : null,
    };

    setLibraryItems((currentItems) => [newFolder, ...currentItems]);
  }

  function handleOpenFolder(folder) {
    setCurrentFolder(folder);
    setDocumentSearch("");
  }

  function handleBackToLibrary() {
    setCurrentFolder(null);
    setDocumentSearch("");
  }

function getFolderPath(folder) {
  const path = [];
  let selectedFolder = folder;

  while (selectedFolder) {
    path.unshift(selectedFolder);

    const parentFolderId = selectedFolder.folderId ?? null;

    if (!parentFolderId) break;

    selectedFolder = libraryItems.find(
      (item) =>
        item.type === "folder" &&
        getFolderKey(item) === parentFolderId
    );
  }

  return path;
}

function handleOpenBreadcrumbFolder(folder) {
  setCurrentFolder(folder);
  setDocumentSearch("");
}

  function handleDeleteDocument(documentName) {
    setLibraryItems((currentItems) => {
      const nextItems = currentItems.filter(
        (item) => item.name !== documentName,
      );
      syncLibraryDocumentCount(nextItems);
      return nextItems;
    });

    alert(
      "This only removes the file from the frontend list. Backend delete is not implemented yet.",
    );
  }

  async function handleDownloadDocument(fileItem) {
    try {
      if (!fileItem.id || !fileItem.isBackendFile) {
        alert(
          "This file is local sample data, so it cannot be downloaded from backend yet.",
        );
        return;
      }

      const data = await downloadDocument(fileItem.id);

      if (!data.downloadUrl) {
        alert("Download URL not found.");
        return;
      }

      window.open(data.downloadUrl, "_blank");
    } catch (error) {
      console.error("Download failed:", error);
      alert("Download failed.");
    }
  }

  function handleSaveSettings(e) {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    const rawLibraryName = libraryName;
    const trimmedLibraryName = rawLibraryName.trim();

    if (trimmedLibraryName === "") {
      setLibraryNameMessage("Please enter library name.");
      return;
    }

    if (rawLibraryName.length > LIBRARY_NAME_MAX_LENGTH) {
      setLibraryNameMessage(
        `Library name cannot exceed ${LIBRARY_NAME_MAX_LENGTH} characters.`
      );
      return;
    }

    const updatedLibrary = {
      ...libraryData,
      name: trimmedLibraryName,
      visibility: libraryVisibility,
      shareOnProfile: shareOnProfile,
      documents: countUploadedFiles(libraryItems),
      updatedAt: "Updated just now",
    };

    const savedLibraries = JSON.parse(
      localStorage.getItem("aiStudyHubLibraries") || "[]"
    );

    const hasCurrentLibrary = savedLibraries.some(
      (library) => library.id === updatedLibrary.id
    );

    const updatedLibraries = hasCurrentLibrary
      ? savedLibraries.map((library) =>
        library.id === updatedLibrary.id ? updatedLibrary : library
      )
      : [updatedLibrary, ...savedLibraries];

    localStorage.setItem(
      "aiStudyHubLibraries",
      JSON.stringify(updatedLibraries)
    );

    setLibraryData(updatedLibrary);
    setLibraryName(trimmedLibraryName);
    setLibraryNameMessage("Library settings saved successfully.");
  }
function handleDeleteLibrary() {
  const confirmed = window.confirm(
    "Are you sure you want to delete this library? This action cannot be undone."
  );

  if (!confirmed) return;

  const savedLibraries = JSON.parse(
    localStorage.getItem("aiStudyHubLibraries") || "[]"
  );

  const updatedLibraries = savedLibraries.filter(
    (library) => library.id !== libraryId
  );

  localStorage.setItem(
    "aiStudyHubLibraries",
    JSON.stringify(updatedLibraries)
  );

  const recentLibraries = JSON.parse(
    localStorage.getItem("aiStudyHubRecentLibraries") || "[]"
  );

  const updatedRecentLibraries = recentLibraries.filter(
    (library) => library.id !== libraryId
  );

  localStorage.setItem(
    "aiStudyHubRecentLibraries",
    JSON.stringify(updatedRecentLibraries)
  );

  navigate("/dashboard/libraries", { replace: true });
}

  function handleDeleteFolder(folder, event) {
    event.stopPropagation();

    const folderKey = getFolderKey(folder);
    const confirmDelete = window.confirm(
      `Delete folder "${folder.name}" and everything inside it?`,
    );

    if (!confirmDelete) return;

    setLibraryItems((currentItems) => {
      const folderIdsToDelete = new Set([folderKey]);
      let keepSearching = true;

      while (keepSearching) {
        keepSearching = false;

        currentItems.forEach((item) => {
          const itemParentId = item.folderId ?? null;

          if (
            item.type === "folder" &&
            itemParentId &&
            folderIdsToDelete.has(itemParentId) &&
            !folderIdsToDelete.has(getFolderKey(item))
          ) {
            folderIdsToDelete.add(getFolderKey(item));
            keepSearching = true;
          }
        });
      }

      const nextItems = currentItems.filter((item) => {
        const itemKey = item.type === "folder" ? getFolderKey(item) : null;
        const itemParentId = item.folderId ?? null;

        return (
          !folderIdsToDelete.has(itemKey) &&
          !folderIdsToDelete.has(itemParentId)
        );
      });

      syncLibraryDocumentCount(nextItems);
      return nextItems;
    });

    if (currentFolder && getFolderKey(currentFolder) === folderKey) {
      setCurrentFolder(null);
    }
  }


  const visibleItems = libraryItems.filter((item) => {
    const itemFolderId = item.folderId ?? null;

    if (currentFolder) {
      return itemFolderId === getFolderKey(currentFolder);
    }

    return itemFolderId === null;
  });

  const documentItems = visibleItems.filter((item) => item.type !== "folder");
  const folderItems = visibleItems.filter((item) => item.type === "folder");
  const currentFolderPath = currentFolder ? getFolderPath(currentFolder) : [];

  const filteredDocuments = documentItems.filter((item) =>
    item.name.toLowerCase().includes(documentSearch.toLowerCase()),
  );

  const uploadedFileCount = countUploadedFiles(libraryItems) || Number(libraryData.documents) || 0;

    const usedStorageBytes = countUsedStorageBytes(libraryItems);

const usedStoragePercent = Math.min(
  (usedStorageBytes / LIBRARY_STORAGE_LIMIT_BYTES) * 100,
  100
);

const remainingStorageBytes = Math.max(
  LIBRARY_STORAGE_LIMIT_BYTES - usedStorageBytes,
  0
);

  const totalFolderCount = libraryItems.filter((item) => item.type === "folder").length;
  const currentLocationLabel = currentFolder ? currentFolder.name : "All subjects";
  const statusText = isLoadingDocuments
    ? "Syncing documents"
    : `${uploadedFileCount} files ready`;

  return (
    <main className="library_page">
      <section className="library_workspace">
        <section className="library_command_panel">
          <div className="library_command_left">
            <button
              className="library_back_btn"
              type="button"
              onClick={() => navigate("/dashboard/libraries")}
            >
              <i className="ti-angle-left"></i>
              Back to libraries
            </button>

            <div className="library_identity_block">
              <div className="library_logo">
                <i className="ti-archive"></i>
              </div>

              <div>
                <div className="library_title">
                  <h1>{libraryData.name}</h1>
                  <span>{formatVisibility(libraryData.visibility)}</span>
                </div>

                <p>
                  {libraryData.description ||
                    "Organize files, folders, tags, storage and AI review materials in one library."}
                </p>
              </div>
            </div>
          </div>

          <div className="library_command_right">
            <div className="library_status_card">
              <span>Current view</span>
              <strong>{currentLocationLabel}</strong>
              <p>{statusText}</p>
            </div>

            <div className="library_hero_actions">
              <button
                className={`star_btn ${isStarred ? "active" : ""}`}
                type="button"
                onClick={handleToggleStar}
              >
                <i className="ti-star"></i>
                {isStarred ? "Starred" : "Star"}
                {stars > 0 && <span className="star_count">{stars}</span>}
              </button>

              <label className="upload_btn">
                <i className="ti-upload"></i>
                Upload
                <input type="file" multiple onChange={handleUploadFile} />
              </label>
            </div>
          </div>
        </section>

        <section className="library_metric_strip">
          <article>
            <span>Files</span>
            <strong>{uploadedFileCount}</strong>
          </article>

          <article>
            <span>Folders</span>
            <strong>{totalFolderCount}</strong>
          </article>

          <article>
            <span>Stars</span>
            <strong>{stars}</strong>
          </article>

          <article>
            <span>Visibility</span>
            <strong>{shareOnProfile ? "Profile" : "Hidden"}</strong>
          </article>
        </section>

        <nav className="library_tabs" aria-label="Library sections">
          <button
            type="button"
            className={activeTab === "documents" ? "active" : ""}
            onClick={() => setActiveTab("documents")}
          >
            <i className="ti-files"></i>
            Documents
          </button>

          <button
            type="button"
            className={activeTab === "settings" ? "active" : ""}
            onClick={() => setActiveTab("settings")}
          >
            <i className="ti-settings"></i>
            Settings
          </button>
        </nav>

        <section className="library_body">
          <section className="library_main">
            {activeTab === "documents" && (
              <section className="documents_tab_panel">
                <div className="documents_tab_toolbar">
                  <div className="documents_toolbar_copy">
                    <h2>Document board</h2>
                    <p>Search files, open folders, add tags and keep uploads inside the 50MB limit.</p>
                  </div>

                  <div className="documents_toolbar_controls">
                    <label className="documents_tab_search">
                      <i className="ti-search"></i>
                      <input
                        type="text"
                        placeholder="Search file"
                        value={documentSearch}
                        onChange={(e) => setDocumentSearch(e.target.value)}
                      />
                    </label>

                    <div className="documents_tab_actions">
                      <button
                        type="button"
                        className="documents_new_folder_btn"
                        onClick={handleCreateFolder}
                      >
                        <i className="ti-folder"></i>
                        New folder
                      </button>

                      <label className="documents_upload_btn">
                        <i className="ti-upload"></i>
                        Upload file
                        <input type="file" multiple onChange={handleUploadFile} />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="documents_path_bar">
                  <div className="documents_breadcrumb">
                    <button type="button" onClick={handleBackToLibrary}>
                      All subjects
                    </button>

                    {currentFolderPath.map((folder, index) => {
                      const isLastFolder = index === currentFolderPath.length - 1;

                      return (
                        <span className="breadcrumb_item" key={getFolderKey(folder)}>
                          <i className="ti-angle-right"></i>
                          {isLastFolder ? (
                            <strong>{folder.name}</strong>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenBreadcrumbFolder(folder)}
                            >
                              {folder.name}
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  <span>{filteredDocuments.length} shown</span>
                </div>

                {folderItems.length > 0 && (
                  <section className="folder_grid">
                    {folderItems.map((folder) => (
                      <article
                        className="folder_card"
                        key={getFolderKey(folder)}
                        onClick={() => handleOpenFolder(folder)}
                      >
                        <button
                          className="folder_delete_btn"
                          type="button"
                          title="Delete folder"
                          onClick={(event) => handleDeleteFolder(folder, event)}
                        >
                          <i className="ti-trash"></i>
                        </button>

                        <div className="folder_card_icon">
                          <i className="ti-folder"></i>
                        </div>

                        <div>
                          <h3>{folder.name}</h3>
                          <p>{folder.note}</p>
                        </div>
                      </article>
                    ))}
                  </section>
                )}

                {isLoadingDocuments ? (
                  <div className="empty_state_card loading_state_card">
                    <div className="empty_state_icon">
                      <i className="ti-reload"></i>
                    </div>
                    <h3>Loading documents</h3>
                    <p>Please wait while we load your files.</p>
                  </div>
                ) : visibleItems.length === 0 ? (
                  <div className="empty_state_card">
                    <div className="empty_state_icon">
                      <i className="ti-folder"></i>
                    </div>
                    <h3>{currentFolder ? "This folder is empty" : "Your library is empty"}</h3>
                    <p>Add your first document to start building this study library.</p>
                    <label className="empty_state_action">
                      <i className="ti-upload"></i>
                      Upload document
                      <input type="file" multiple onChange={handleUploadFile} />
                    </label>
                  </div>
                ) : documentSearch && filteredDocuments.length === 0 ? (
                  <div className="empty_state_card">
                    <div className="empty_state_icon">
                      <i className="ti-search"></i>
                    </div>
                    <h3>No documents found</h3>
                    <p>Try another keyword or upload a new document.</p>
                    <label className="empty_state_action">
                      <i className="ti-upload"></i>
                      Upload document
                      <input type="file" multiple onChange={handleUploadFile} />
                    </label>
                  </div>
                ) : (
                  filteredDocuments.length > 0 && (
                    <section className="documents_table_card">
                      <div className="documents_table_header">
                        <span>File</span>
                        <span>Size</span>
                        <span>Uploaded</span>
                        <span>Actions</span>
                      </div>

                      <div className="documents_table_body">
                        {filteredDocuments.map((document) => (
                          <div
                            className="documents_table_row"
                            key={document.id || `${document.name}-${document.uploadedTime || ""}`}
                          >
                            <div className="document_file_name">
                              <div className="document_icon_shell">
                                <i className={getFileIcon(document.name)}></i>
                              </div>

                              <div className="document_name_with_tags">
                                <span>{document.name}</span>

                                {document.hashtags && document.hashtags.length > 0 && (
                                  <div className="document_hashtags">
                                    {document.hashtags.map((tag) => (
                                      <small key={tag}>{tag}</small>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="document_size">
                              {document.size || document.note.split("·")[0].trim()}
                            </div>

                            <div className="document_uploaded">
                              <strong>
                                {document.uploadedTime ||
                                  document.note.split("·")[1]?.trim() ||
                                  "Recently"}
                              </strong>
                              <span>by {document.uploadedBy || "dangkhoabi456"}</span>
                            </div>

                            <div className="document_actions">
                              <button
                                type="button"
                                title="Download"
                                onClick={() => handleDownloadDocument(document)}
                              >
                                <i className="ti-download"></i>
                              </button>

                              <button
                                type="button"
                                className="delete_document_btn"
                                title="Delete"
                                onClick={() => handleDeleteDocument(document.name)}
                              >
                                <i className="ti-trash"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )
                )}
              </section>
            )}

            {activeTab === "settings" && (
              <section className="settings_tab_panel">
                <div className="settings_header">
                  <h2>Library settings</h2>
                  <p>Manage naming, privacy, profile visibility and library removal.</p>
                </div>

                <form className="settings_general_card" onSubmit={handleSaveSettings}>
                  <div className="settings_card_title">
                    <div className="settings_card_icon">
                      <i className="ti-write"></i>
                    </div>

                    <div>
                      <h3>General information</h3>
                      <p>Keep this library clear and easy to identify.</p>
                    </div>
                  </div>

                  <div className="settings_form_group">
                    <label htmlFor="libraryName">Library name</label>
                    <input
                      id="libraryName"
                      type="text"
                      value={libraryName}
                      onChange={handleLibraryNameChange}
                    />

                    <div className="settings_helper_row">
                      <small>{libraryName.length}/{LIBRARY_NAME_MAX_LENGTH} characters</small>
                      {libraryNameMessage && (
                        <small className="settings_warning_text">{libraryNameMessage}</small>
                      )}
                    </div>
                  </div>

                  <div className="settings_form_group">
                    <label>Privacy and visibility</label>

                    <div className="settings_visibility_options">
                      <label
                        className={`settings_visibility_card ${libraryVisibility === "public" ? "selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="libraryVisibility"
                          value="public"
                          checked={libraryVisibility === "public"}
                          onChange={(e) => {
                            setLibraryVisibility(e.target.value);
                            setLibraryNameMessage("");
                          }}
                        />

                        <div>
                          <h4>Public</h4>
                          <p>Visible to members and searchable inside the study hub.</p>
                        </div>
                      </label>

                      <label
                        className={`settings_visibility_card ${libraryVisibility === "private" ? "selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="libraryVisibility"
                          value="private"
                          checked={libraryVisibility === "private"}
                          onChange={(e) => {
                            setLibraryVisibility(e.target.value);
                            setShareOnProfile(false);
                            setLibraryNameMessage("");
                          }}
                        />

                        <div>
                          <h4>Private</h4>
                          <p>Only visible to you and invited collaborators.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="settings_profile_visibility">
                    <div>
                      <label>Profile visibility</label>
                      <p>Show this library on your personal profile.</p>
                      <small>Private libraries cannot be shown on profile.</small>
                    </div>

                    <button
                      type="button"
                      className={`settings_toggle_btn ${shareOnProfile ? "active" : ""}`}
                      onClick={handleToggleShareOnProfile}
                      aria-label="Toggle library visibility on profile"
                    >
                      <span></span>
                    </button>
                  </div>
                </form>

                <div className="settings_save_bar">
                  <span>Save updates to local library data.</span>
                  <button type="button" onClick={handleSaveSettings}>
                    Save changes
                  </button>
                </div>

                <section className="danger_zone_card">
                  <div className="danger_zone_intro">
                    <div>
                      <h3>Danger zone</h3>
                      <p>Deleting this library removes it from saved and recent libraries.</p>
                    </div>
                    <i className="ti-alert"></i>
                  </div>

                  <div className="danger_zone_action">
                    <div>
                      <strong>Delete library</strong>
                      <p>This action cannot be undone.</p>
                    </div>

                    <button
                      type="button"
                      className="delete_library_button"
                      onClick={handleDeleteLibrary}
                    >
                      Delete library
                    </button>
                  </div>
                </section>
              </section>
            )}
          </section>

          <aside className="library_sidebar">
            <div className="capacity_card">
              <div className="storage_card_header">
                <div className="storage_card_icon">
                  <i className="ti-harddrive"></i>
                </div>

                <div>
                  <h3>Library storage</h3>
                  <p>Storage used by uploaded files</p>
                </div>
              </div>

              <div className="storage_usage_line">
                <span>Storage limit</span>
                <strong>
                  {formatFileSize(usedStorageBytes)} / {formatFileSize(LIBRARY_STORAGE_LIMIT_BYTES)}
                </strong>
              </div>

              <div className="capacity_bar">
                <div style={{ width: `${usedStoragePercent}%` }}></div>
              </div>

              <div className="storage_stats">
                <div>
                  <strong>{formatFileSize(usedStorageBytes)}</strong>
                  <span>Used</span>
                </div>

                <div>
                  <strong>{formatFileSize(remainingStorageBytes)}</strong>
                  <span>Remaining</span>
                </div>
              </div>
            </div>

            <div className="side_card library_about_card">
              <div className="library_about_header">
                <i className="ti-book"></i>
                <h3>About</h3>
              </div>
              <p>
                {libraryData.description ||
                  "This library helps students manage learning resources, upload documents, and use AI to summarize or ask questions from files."}
              </p>
            </div>

            <div className="side_card">
              <div className="side_title">
                <h3>Owner</h3>
              </div>

              <div className="collaborator_item">
                <div className="collaborator_icon">
                  <i className="ti-user"></i>
                </div>

                <div>
                  <strong>{authorName}</strong>
                  <p>Library owner</p>
                </div>
              </div>
            </div>

            <div className="side_card library_info_card">
              <h3>Library info</h3>

              <div className="info_row">
                <span>Files uploaded</span>
                <strong>{uploadedFileCount}</strong>
              </div>

              <div className="info_row">
                <span>Stars</span>
                <strong>{stars}</strong>
              </div>

              <div className="info_row">
                <span>Profile visibility</span>
                <strong>{shareOnProfile ? "Shown" : "Hidden"}</strong>
              </div>
            </div>

            <div className="summarize_card">
              <h3>Summarize library</h3>
              <p>Use AI to generate a study overview from uploaded files.</p>
              <button type="button">Start analysis</button>
              <div className="flash_btn">
                <i className="ti-bolt"></i>
              </div>
            </div>
          </aside>
        </section>
      </section>

      {isTagModalOpen && (
        <div className="hashtag_modal_overlay">
          <div className="hashtag_modal">
            <div className="hashtag_modal_header">
              <div>
                <h2>Add tags to your document</h2>
                <p>Provide 3 hashtags to help categorize your file for search and AI review.</p>
              </div>

              <button type="button" onClick={handleCancelTaggedUpload}>
                ×
              </button>
            </div>

            <div className="hashtag_modal_body">
              <div className="hashtag_input_list">
                {hashtags.map((tag, index) => (
                  <input
                    key={index}
                    type="text"
                    value={tag}
                    onChange={(e) => handleHashtagChange(index, e.target.value)}
                    placeholder={`# tag${index + 1}`}
                  />
                ))}
              </div>

              {pendingFiles.length > 0 && (
                <div className="pending_file_preview">
                  <strong>Selected file</strong>
                  <span>
                    {pendingFiles.length === 1
                      ? pendingFiles[0].name
                      : `${pendingFiles.length} files selected`}
                  </span>
                </div>
              )}
            </div>

            <div className="hashtag_modal_actions">
              <button
                type="button"
                className="hashtag_cancel_btn"
                onClick={handleCancelTaggedUpload}
                disabled={isUploadingDocuments}
              >
                Cancel
              </button>

              <button
                type="button"
                className="hashtag_save_btn"
                onClick={handleConfirmTaggedUpload}
                disabled={isUploadingDocuments}
              >
                {isUploadingDocuments ? "Uploading" : "Save and upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isStorageLimitPopupOpen && (
        <div className="storage_limit_overlay">
          <div className="storage_limit_modal">
            <div className="storage_limit_icon">
              <i className="ti-alert"></i>
            </div>

            <h2>Storage limit reached</h2>
            <p>
              This library has reached the 50MB upload limit. Delete some files before uploading more documents.
            </p>

            <div className="storage_limit_info">
              <span>Current usage</span>
              <strong>
                {formatFileSize(usedStorageBytes)} / {formatFileSize(LIBRARY_STORAGE_LIMIT_BYTES)}
              </strong>
            </div>

            <button type="button" onClick={() => setIsStorageLimitPopupOpen(false)}>
              I understand
            </button>
          </div>
        </div>
      )}
    </main>
  );

}


export default LibraryPage;
