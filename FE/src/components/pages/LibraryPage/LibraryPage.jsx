import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import "./LibraryPage.css";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

function LibraryPage() {
  const { libraryId } = useParams();

  function getInitialLibraryData() {
    const savedLibraries = JSON.parse(
      localStorage.getItem("aiStudyHubLibraries") || "[]"
    );

    const matchedLibrary = savedLibraries.find(
      (library) => library.id === libraryId
    );

    return (
      matchedLibrary || {
        id: libraryId || "default-library",
        name: "AI-student-hub",
        description:
          "A learning library for storing study materials, organizing subjects, and using AI to review documents.",
        visibility: "public",
        documents: 0,
        updatedAt: "Updated just now",
        icon: "ti-archive",
      }
    );
  }

  function formatVisibility(value) {
    return value === "private" ? "Private" : "Public";
  }

  const folderIdRef = useRef(1);  
  const [libraryData, setLibraryData] = useState(getInitialLibraryData);
  const [activeTab, setActiveTab] = useState("documents");
  const [documentSearch, setDocumentSearch] = useState("");
  const [currentFolder, setCurrentFolder] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [inviteStatus, setInviteStatus] = useState("idle");
  const [libraryName, setLibraryName] = useState(() => getInitialLibraryData().name);
  const [libraryVisibility, setLibraryVisibility] = useState(
    () => getInitialLibraryData().visibility || "public"
  );
  const [pendingFiles, setPendingFiles] = useState([]);
  const [pendingFolderId, setPendingFolderId] = useState(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [hashtags, setHashtags] = useState(["", "", ""]);

  const [members, setMembers] = useState([
    {
      name: "TrongBVD",
      email: "trongbvd@university.edu",
      role: "Manager",
      joinDate: "Oct 12, 2023",
      avatar: "TB",
      status: "active",
    },
    {
      name: "dangkhoabi456",
      email: "d.khoa@academic.org",
      role: "Member",
      joinDate: "Jan 05, 2024",
      avatar: "DK",
      status: "active",
    },
    {
      name: "aikirokito",
      email: "kito.ai@study.net",
      role: "Member",
      joinDate: "Mar 22, 2024",
      avatar: "AI",
      status: "active",
    },
    {
      name: "Sarah Jenkins",
      email: "s.jenkins@university.edu",
      role: "Member",
      joinDate: "Jun 10, 2024",
      avatar: "SJ",
      status: "active",
    },
  ]);

  const [pendingInvitations, setPendingInvitations] = useState([
    {
      email: "alex.proctor@edu.com",
      invitedAs: "Member",
      time: "2 hours ago",
      invitedBy: "TrongBVD",
    },
    {
      email: "m.chen@research.io",
      invitedAs: "Editor",
      time: "yesterday",
      invitedBy: "TrongBVD",
    },
  ]);
  const [libraryItems, setLibraryItems] = useState([]);


  const collaborators = [
    {
      name: "dangkhoabi456",
      role: "Admin",
      icon: "ti-user",
    },
    {
      name: "TrongBVD",
      role: "Editor",
      icon: "ti-package",
    },
    {
      name: "aikirokito",
      role: "Viewer",
      icon: "ti-wheelchair",
    },
  ];

  const authorName =
    localStorage.getItem("aiStudyHubProfileName") || "dangkhoabi456";

  function countUploadedFiles(items) {
    return items.filter((item) => item.type !== "folder").length;
  }

  function syncLibraryDocumentCount(nextItems) {
    const nextDocumentCount = countUploadedFiles(nextItems);

    const updatedLibrary = {
      ...libraryData,
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
          library.id === updatedLibrary.id
            ? {
                ...library,
                documents: nextDocumentCount,
                updatedAt: "Updated just now",
              }
            : library
        )
      : [updatedLibrary, ...savedLibraries];

    localStorage.setItem(
      "aiStudyHubLibraries",
      JSON.stringify(updatedLibraries)
    );

    setLibraryData(updatedLibrary);
  }

function handleUploadFile(e) {
  const files = Array.from(e.target.files);

  if (files.length === 0) return;

  setPendingFiles(files);
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

  function handleConfirmTaggedUpload() {
    const validHashtags = hashtags
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "")
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));

    if (validHashtags.length < 3) {
      alert("Please enter 3 hashtags before uploading.");
      return;
    }

    const uploadedFiles = pendingFiles.map((file) => {
      const fileUrl = URL.createObjectURL(file);

      return {
        type: "file",
        name: file.name,
        note: `${(file.size / 1024).toFixed(1)} KB · Added just now`,
        size: formatFileSize(file.size),
        uploadedTime: "Just now",
        uploadedBy: authorName,
        icon: getFileIcon(file.name),
        downloadUrl: fileUrl,
        folderId: pendingFolderId,
        hashtags: validHashtags,
      };
    });

    setLibraryItems((currentItems) => {
      const nextItems = [...uploadedFiles, ...currentItems];
      syncLibraryDocumentCount(nextItems);
      return nextItems;
    });

    handleCancelTaggedUpload();
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


  function getFolderKey(folder) {
    return folder.id || folder.name;
  }

  function handleOpenFolder(folder) {
    setCurrentFolder(folder);
    setDocumentSearch("");
  }

  function handleBackToLibrary() {
    setCurrentFolder(null);
    setDocumentSearch("");
  }

  function getFileIcon(fileName) {
    const name = fileName.toLowerCase();

    if (name.endsWith(".pdf")) return "ti-file";
    if (name.endsWith(".doc") || name.endsWith(".docx")) return "ti-write";
    if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
      return "ti-layout-grid3";
    }

    return "ti-file";
  }

  function formatFileSize(size) {
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(0)} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function handleDeleteDocument(documentName) {
    setLibraryItems((currentItems) => {
      const nextItems = currentItems.filter((item) => item.name !== documentName);
      syncLibraryDocumentCount(nextItems);
      return nextItems;
    });
  }

  function handleSaveSettings(e) {
    e.preventDefault();

    const trimmedLibraryName = libraryName.trim();

    if (trimmedLibraryName === "") {
      alert("Please enter library name.");
      return;
    }

    const updatedLibrary = {
      ...libraryData,
      name: trimmedLibraryName,
      visibility: libraryVisibility,
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
    alert("Library settings saved successfully!");
  }

  function handleDeleteLibrary() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this library? This action cannot be undone."
    );

    if (!confirmed) return;

    alert("Delete library will be connected to backend later.");
  }

  function handleDeleteFolder(folder, event) {
    event.stopPropagation();

    const folderKey = getFolderKey(folder);
    const confirmDelete = window.confirm(
      `Delete folder "${folder.name}" and everything inside it?`
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

        return !folderIdsToDelete.has(itemKey) && !folderIdsToDelete.has(itemParentId);
      });

      syncLibraryDocumentCount(nextItems);
      return nextItems;
    });

    if (currentFolder && getFolderKey(currentFolder) === folderKey) {
      setCurrentFolder(null);
    }
  }

  function handleInviteMember() {
    setInviteQuery("");
    setInviteRole("Viewer");
    setInviteStatus("idle");
    setIsInviteModalOpen(true);
  }

  function handleCloseInviteModal() {
    setIsInviteModalOpen(false);
    setInviteQuery("");
    setInviteRole("Viewer");
    setInviteStatus("idle");
  }

  function handleSearchInviteMember() {
    if (inviteQuery.trim() === "") return;

    const normalizedQuery = inviteQuery.trim().toLowerCase();

    if (
      normalizedQuery.includes("unknown") ||
      normalizedQuery.includes("notfound") ||
      normalizedQuery.includes("khong")
    ) {
      setInviteStatus("not-found");
      return;
    }

    setInviteStatus("found");
  }

  function handleSendInvite() {
    const email =
      inviteStatus === "found"
        ? "v.a.nguyen@university.edu"
        : inviteQuery.trim();

    if (!email) return;

    const newInvitation = {
      email,
      invitedAs: inviteRole,
      time: "just now",
      invitedBy: "dangkhoabi456",
    };

    setPendingInvitations((currentInvitations) => [
      newInvitation,
      ...currentInvitations,
    ]);

    handleCloseInviteModal();
  }

  const filteredMembers = members.filter((member) => {
    const keyword = memberSearch.toLowerCase();

    return (
      member.name.toLowerCase().includes(keyword) ||
      member.email.toLowerCase().includes(keyword) ||
      member.role.toLowerCase().includes(keyword)
    );
  });

  const visibleItems = libraryItems.filter((item) => {
    const itemFolderId = item.folderId ?? null;

    if (currentFolder) {
      return itemFolderId === getFolderKey(currentFolder);
    }

    return itemFolderId === null;
  });

  const documentItems = visibleItems.filter((item) => item.type !== "folder");
  const folderItems = visibleItems.filter((item) => item.type === "folder");

  const filteredDocuments = documentItems.filter((item) =>
    item.name.toLowerCase().includes(documentSearch.toLowerCase())
  );

  const uploadedFileCount =
    countUploadedFiles(libraryItems) || Number(libraryData.documents) || 0;

  return (
    <main className="library_page">
      <section className="library_workspace">
        <section className="library_hero">
          <div className="library_hero_left">
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
                  "A learning library for storing study materials, organizing subjects, and using AI to review documents."}
              </p>
            </div>
          </div>

          <div className="library_hero_actions">
            <button className="star_btn">
              <i className="ti-star"></i>
              Star
            </button>

            <label className="upload_btn">
              <i className="ti-upload"></i>
              Upload
              <input type="file" multiple onChange={handleUploadFile} />
            </label>
          </div>
        </section>

        <nav className="library_tabs">
          <button
            className={activeTab === "documents" ? "active" : ""}
            onClick={() => setActiveTab("documents")}
          >
            Documents
          </button>

          <button
            className={activeTab === "messages" ? "active" : ""}
            onClick={() => setActiveTab("messages")}
          >
            Messages
          </button>

          <button
            className={activeTab === "members" ? "active" : ""}
            onClick={() => setActiveTab("members")}
          >
            Members
          </button>

          <button
            className={activeTab === "settings" ? "active" : ""}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
        </nav>

        <section className="library_body">
          <section className="library_main">
            {activeTab === "library" && (
              <>
                <div className="library_tools">
                  <select>
                    <option>All subjects</option>
                    <option>Software Engineering</option>
                    <option>Business Analysis</option>
                    <option>React</option>
                  </select>

                  <div className="library_search">
                    <i className="ti-search"></i>
                    <input type="text" placeholder="Search file..." />
                  </div>

                  <div className="library_tool_actions">
                    <button className="light_btn">
                      <i className="ti-plus"></i>
                      New folder
                    </button>

                    <label className="upload_btn small">
                      <i className="ti-upload"></i>
                      Upload File
                      <input type="file" multiple onChange={handleUploadFile} />
                    </label>
                  </div>
                </div>

                <div className="activity_banner">
                  <div className="activity_left">
                    <div className="activity_avatar">TB</div>
                    <strong>TrongBVD</strong>
                    <span>updated study materials</span>
                  </div>

                  <span className="total_files">
                    Total files: {libraryItems.length}
                  </span>
                </div>

                <div className="library_card_grid">
                  {libraryItems.map((item, index) => (
                    <LibraryCard item={item} key={`${item.name}-${index}`} />
                  ))}
                </div>
              </>
            )}

            {activeTab === "documents" && (
              <section className="documents_tab_panel">
                <div className="documents_tab_toolbar">
                  <div className="documents_tab_search">
                    <i className="ti-search"></i>
                    <input
                      type="text"
                      placeholder="Search file..."
                      value={documentSearch}
                      onChange={(e) => setDocumentSearch(e.target.value)}
                    />
                  </div>

                  <div className="documents_tab_actions">
                    <button
                      className="documents_new_folder_btn"
                      onClick={handleCreateFolder}
                    >
                      <i className="ti-folder"></i>
                      New folder
                    </button>

                    <label className="documents_upload_btn">
                      <i className="ti-upload"></i>
                      Upload File
                      <input type="file" multiple onChange={handleUploadFile} />
                    </label>
                  </div>
                </div>

                {currentFolder && (
                  <div className="documents_breadcrumb">
                    <button onClick={handleBackToLibrary}>All subjects</button>
                    <i className="ti-angle-right"></i>
                    <button onClick={handleBackToLibrary}>
                      Software Engineering
                    </button>
                    <i className="ti-angle-right"></i>
                    <strong>{currentFolder.name}</strong>
                  </div>
                )}

                {!currentFolder && folderItems.length > 0 && (
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

                {visibleItems.length === 0 ? (
                  <div className="empty_state_card">
                    <div className="empty_state_icon">
                      <i className="ti-folder"></i>
                    </div>

                    <h3>
                      {currentFolder ? "This folder is empty" : "Your library is empty"}
                    </h3>
                    <p>Be the first one to add it.</p>

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
                        <span>File Name</span>
                        <span>Size</span>
                        <span>Uploaded</span>
                        <span>Actions</span>
                      </div>

                      <div className="documents_table_body">
                        {filteredDocuments.map((document) => (
                          <div
                            className="documents_table_row"
                            key={`${document.name}-${document.uploadedTime || ""}`}
                          >
                            <div className="document_file_name">
                              <i className={getFileIcon(document.name)}></i>

                              <div className="document_name_with_tags">
                                <span>{document.name}</span>

                                {document.hashtags && (
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
                                title="Download"
                                onClick={() => handleDownloadDocument(document)}
                              >
                                <i className="ti-download"></i>
                              </button>

                              <button
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


            {activeTab === "messages" && (
              <section className="member_chat_tab">
                <header className="member_chat_header">
                  <div>
                    <h2>Software Engineering 2024 Group</h2>
                    <p>
                      <span className="member_chat_online_dot"></span>
                      14 members online
                    </p>
                  </div>

                  <div className="member_chat_header_actions">
                    <button type="button" title="Members">
                      <i className="ti-user"></i>
                    </button>

                    <button type="button" title="Group information">
                      <i className="ti-info-alt"></i>
                    </button>

                    <span>Academic Admin</span>

                    <div className="member_chat_admin_avatar">
                      DK
                    </div>
                  </div>
                </header>

                <div className="member_chat_date">May 16, 2026</div>

                <section className="member_chat_messages">
                  <article className="member_chat_message_row">
                    <div className="member_chat_avatar">
                      <img
                        src="https://i.pravatar.cc/80?img=12"
                        alt="Sarah Jenkins"
                      />
                    </div>

                    <div className="member_chat_content">
                      <h3>Sarah Jenkins</h3>

                      <div className="member_chat_bubble member_chat_received">
                        Does anyone have the notes for yesterday's lecture on
                        architectural patterns? I missed the last 20 minutes.
                      </div>

                      <span className="member_chat_time">10:42 AM</span>
                    </div>
                  </article>

                  <article className="member_chat_message_row member_chat_own">
                    <div className="member_chat_content">
                      <div className="member_chat_bubble member_chat_sent">
                        I have them here! I just finished digitizing the
                        sketches of the microservices diagram we discussed.
                      </div>

                      <div className="member_chat_file_card">
                        <div className="member_chat_file_icon">
                          <i className="ti-file"></i>
                        </div>

                        <div>
                          <strong>Software_Arch_Notes.pdf</strong>
                          <p>2.4 MB</p>
                        </div>
                      </div>

                      <span className="member_chat_time member_chat_time_right">
                        10:45 AM · Read
                      </span>
                    </div>
                  </article>

                  <article className="member_chat_message_row">
                    <div className="member_chat_avatar">
                      <img
                        src="https://i.pravatar.cc/80?img=33"
                        alt="David Chen"
                      />
                    </div>

                    <div className="member_chat_content">
                      <h3>David Chen</h3>

                      <div className="member_chat_bubble member_chat_received">
                        Found this great reference in the university archives
                        for our project proposal.
                      </div>

                      <div className="member_chat_image_preview">
                        <img
                          src="https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=80"
                          alt="University archive"
                        />
                      </div>

                      <span className="member_chat_time">11:15 AM</span>
                    </div>
                  </article>
                </section>

                <footer className="member_chat_input_area">
                  <textarea placeholder="Type your message here..." />

                  <div className="member_chat_input_actions">
                    <div>
                      <button type="button" title="Attach file">
                        <i className="ti-clip"></i>
                      </button>

                      <button type="button" title="Emoji">
                        <i className="ti-face-smile"></i>
                      </button>
                    </div>

                    <button
                      type="button"
                      className="member_chat_send_btn"
                      title="Send message"
                    >
                      <i className="ti-control-play"></i>
                    </button>
                  </div>
                </footer>
              </section>
            )}


            {activeTab === "members" && (
              <section className="members_page">
                <div className="members_header">
                  <div>
                    <h2>Workspace Members</h2>
                    <p>
                      Manage access and roles for this academic resource center.
                    </p>
                  </div>

                  <div className="members_header_actions">
                    <div className="members_search">
                      <i className="ti-search"></i>
                      <input
                        type="text"
                        placeholder="Search members..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className="add_member_btn"
                      onClick={handleInviteMember}
                    >
                      <i className="ti-user"></i>
                      Add Member
                    </button>
                  </div>
                </div>

                {members.length === 0 ? (
                  <div className="empty_state_card">
                    <div className="empty_state_icon">
                      <i className="ti-user"></i>
                    </div>

                    <h3>You have no companion here</h3>
                    <p>Invite someone to have fun together.</p>

                    <button
                      type="button"
                      className="empty_state_action"
                      onClick={handleInviteMember}
                    >
                      <i className="ti-plus"></i>
                      Invite member
                    </button>
                  </div>
                ) : (
                  <>
                    <section className="members_table_card">
                      <div className="members_table_header">
                        <span>Member</span>
                        <span>Role</span>
                        <span>Join date</span>
                        <span>Actions</span>
                      </div>

                      <div className="members_table_body">
                        {filteredMembers.map((member, index) => (
                          <div className="members_table_row" key={member.email}>
                            <div className="member_identity">
                              <div
                                className={`member_photo member_photo_${index}`}
                              >
                                {member.avatar}
                                {member.status === "active" && (
                                  <span className="member_online_dot"></span>
                                )}
                              </div>

                              <div>
                                <strong>{member.name}</strong>
                                <p>{member.email}</p>
                              </div>
                            </div>

                            <div>
                              <span
                                className={`member_role_badge ${
                                  member.role === "Manager" ? "manager" : ""
                                }`}
                              >
                                {member.role}
                              </span>
                            </div>

                            <span className="member_join_date">
                              {member.joinDate}
                            </span>

                            <div className="member_row_actions">
                              <button title="Member settings">
                                <i className="ti-settings"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {filteredMembers.length === 0 && (
                      <div className="empty_state_card compact">
                        <div className="empty_state_icon">
                          <i className="ti-search"></i>
                        </div>

                        <h3>No members found</h3>
                        <p>Try another keyword or invite a new member.</p>

                        <button
                          type="button"
                          className="empty_state_action"
                          onClick={handleInviteMember}
                        >
                          <i className="ti-plus"></i>
                          Invite member
                        </button>
                      </div>
                    )}

                    <p className="members_note">
                      Note: Only members who have accepted the invitation or are
                      explicitly listed as pending appear in this workspace list.
                    </p>

                    <section className="pending_invitation_card">
                      <div className="pending_invitation_header">
                        <h3>Pending Invitations</h3>
                        <span>{pendingInvitations.length} Pending</span>
                      </div>

                      <div className="pending_invitation_list">
                        {pendingInvitations.map((invite) => (
                          <div
                            className="pending_invitation_item"
                            key={`${invite.email}-${invite.time}`}
                          >
                            <div className="pending_mail_icon">
                              <i className="ti-email"></i>
                            </div>

                            <div className="pending_invitation_info">
                              <strong>{invite.email}</strong>
                              <p>
                                Invited {invite.time} by {invite.invitedBy}
                              </p>
                            </div>

                            <button>Resend</button>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </section>
            )}

            {activeTab === "settings" && (
              <section className="settings_tab_panel">
                <div className="settings_header">
                  <h2>Library Settings</h2>
                  <p>
                    Manage your library's core information and administrative controls to keep your resources organized
                    and secure.
                  </p>
                </div>

                <form className="settings_general_card" onSubmit={handleSaveSettings}>
                  <div className="settings_card_title">
                    <div className="settings_card_icon">
                      <i className="ti-write"></i>
                    </div>

                    <div>
                      <h3>General Information</h3>
                      <p>Identify your library collection.</p>
                    </div>
                  </div>

                  <div className="settings_form_group">
                    <label htmlFor="libraryName">Library Name</label>
                    <input
                      id="libraryName"
                      type="text"
                      value={libraryName}
                      onChange={(e) => setLibraryName(e.target.value)}
                    />
                    <small>
                      This name will be visible to all members and shown in
                      search results if public.
                    </small>
                  </div>

                  <div className="settings_form_group">
                    <label>Privacy & Visibility</label>

                    <div className="settings_visibility_options">
                      <label
                        className={`settings_visibility_card ${
                          libraryVisibility === "public" ? "selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="libraryVisibility"
                          value="public"
                          checked={libraryVisibility === "public"}
                          onChange={(e) => setLibraryVisibility(e.target.value)}
                        />

                        <div>
                          <h4>Public</h4>
                          <p>
                            Visible to all members and searchable within the
                            university hub.
                          </p>
                        </div>
                      </label>

                      <label
                        className={`settings_visibility_card ${
                          libraryVisibility === "private" ? "selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="libraryVisibility"
                          value="private"
                          checked={libraryVisibility === "private"}
                          onChange={(e) => setLibraryVisibility(e.target.value)}
                        />

                        <div>
                          <h4>Private</h4>
                          <p>
                            Only visible to you and invited collaborators.
                            Hidden from search.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </form>

                <div className="settings_save_bar">
                  <span>Last updated: 2 hours ago by admin</span>
                  <button type="button" onClick={handleSaveSettings}>
                    Save Changes
                  </button>
                </div>

                <section className="danger_zone_card">
                  <div className="danger_zone_intro">
                    <div>
                      <h3>Danger Zone</h3>
                      <p>
                        Irreversible actions that affect the entire library and
                        its contents.
                      </p>
                    </div>

                    <i className="ti-alert"></i>
                  </div>

                  <div className="danger_zone_action">
                    <div>
                      <strong>Delete Library</strong>
                      <p>Permanently remove this library and all its documents.</p>
                    </div>

                    <button
                      type="button"
                      className="delete_library_button"
                      onClick={handleDeleteLibrary}
                    >
                      Delete Library
                    </button>
                  </div>
                </section>
              </section>
            )}

            {activeTab !== "library" && activeTab !== "documents" && activeTab !== "messages" && activeTab !== "members" && activeTab !== "settings" && (
              <div className="empty_tab">
                <h2>{activeTab}</h2>
                <p>This section will be developed later.</p>
              </div>
            )}
          </section>

          <aside className="library_sidebar">
            {activeTab === "members" ? (
              <>
                <div className="side_card member_role_card">
                  <h3>About Roles</h3>

                  <div className="role_description_item">
                    <strong>Managers</strong>
                    <p>
                      Can edit library settings, upload documents, and manage
                      members.
                    </p>
                  </div>

                  <div className="role_description_item">
                    <strong>Members</strong>
                    <p>
                      Can view documents, participate in AI chats, and
                      contribute to folders.
                    </p>
                  </div>
                </div>

                <div className="side_card member_activity_card">
                  <div className="side_title">
                    <h3>Activity</h3>
                    <i className="ti-stats-up"></i>
                  </div>

                  <div className="member_activity_stats">
                    <div>
                      <strong>42</strong>
                      <span>Posts</span>
                    </div>

                    <div>
                      <strong>12</strong>
                      <span>Tasks</span>
                    </div>
                  </div>
                </div>

                <div className="side_card latest_activity_card">
                  <h3>Latest Activity</h3>

                  <div className="latest_activity_item highlight">
                    <strong>TrongBVD</strong>
                    <span>updated the React Hooks guide.</span>
                    <p>5 hours ago</p>
                  </div>

                  <div className="latest_activity_item">
                    <strong>dangkhoabi456</strong>
                    <span>joined the hub.</span>
                    <p>Yesterday</p>
                  </div>
                </div>
              </>            ) : (
              <>
                <div className="side_card">
                  <h3>About this library</h3>
                  <p>
                    {libraryData.description ||
                      "This library helps students manage learning resources, upload documents, and use AI to summarize or ask questions from files."}
                  </p>
                </div>

                {activeTab === "documents" || activeTab === "settings" ? (
                  <div className="side_card">
                    <div className="side_title">
                      <h3>Author</h3>
                    </div>

                    <div className="collaborator_list">
                      <div className="collaborator_item">
                        <div className="collaborator_icon">
                          <i className="ti-user"></i>
                        </div>

                        <div>
                          <strong>{authorName}</strong>
                          <p>Owner</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="side_card">
                    <div className="side_title">
                      <h3>Collaborators</h3>
                      <span>{collaborators.length}</span>
                    </div>

                    <div className="collaborator_list">
                      {collaborators.map((member) => (
                        <div className="collaborator_item" key={member.name}>
                          <div className="collaborator_icon">
                            <i className={member.icon}></i>
                          </div>

                          <div>
                            <strong>{member.name}</strong>
                            <p>{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="side_card">
                  <h3>Library info</h3>

                  {activeTab === "documents" || activeTab === "settings" ? (
                    <div className="info_row">
                      <span>Files uploaded</span>
                      <strong>{uploadedFileCount}</strong>
                    </div>
                  ) : (
                    <>
                      <div className="info_row">
                        <span>Main subject</span>
                        <strong>{libraryData.name}</strong>
                      </div>

                      <div className="info_row">
                        <span>Storage used</span>
                        <strong>1.2 GB / 5 GB</strong>
                      </div>

                      <div className="storage_bar">
                        <div></div>
                      </div>

                      <div className="info_row">
                        <span>Visibility</span>
                        <strong>{formatVisibility(libraryData.visibility)}</strong>
                      </div>
                    </>
                  )}
                </div>

                <div className="summarize_card">
                  <h3>Summarize Library</h3>
                  <p>
                    Use AI to generate a curriculum overview from these files.
                  </p>

                  <button>Start Analysis</button>

                  <div className="flash_btn">
                    <i className="ti-bolt"></i>
                  </div>
                </div>
              </>
            )}
          </aside>
        </section>
      </section>

      {isTagModalOpen && (
        <div className="hashtag_modal_overlay">
          <div className="hashtag_modal">
            <div className="hashtag_modal_header">
              <div>
                <h2>Add Tags to Your Document</h2>
                <p>
                  Please provide 3 hashtags to help categorize your file for
                  better AI search results.
                </p>
              </div>

              <button type="button" onClick={handleCancelTaggedUpload}>
                ×
              </button>
            </div>

<div className="hashtag_modal_body">
  <p className="hashtag_modal_desc">
    Please provide 3 hashtags to help categorize your file for better AI search
    results.
  </p>

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

            {pendingFiles.length > 0 && (
              <div className="pending_upload_preview">
                <strong>Selected file</strong>
                <span>
                  {pendingFiles.length === 1
                    ? pendingFiles[0].name
                    : `${pendingFiles.length} files selected`}
                </span>
              </div>
            )}

            <div className="hashtag_modal_actions">
              <button
                type="button"
                className="hashtag_cancel_btn"
                onClick={handleCancelTaggedUpload}
              >
                Cancel
              </button>

              <button
                type="button"
                className="hashtag_save_btn"
                onClick={handleConfirmTaggedUpload}
              >
                Save & Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {isInviteModalOpen && (
        <div className="invite_modal_overlay">
          <div className="invite_modal">
            <div className="invite_modal_header">
              <div className="invite_header_icon">
                <i className="ti-user"></i>
              </div>

              <div>
                <h2>Invite Members</h2>
                <p>Add collaborators to your academic collection.</p>
              </div>

              <button type="button" onClick={handleCloseInviteModal}>
                ×
              </button>
            </div>

            <div className="invite_field">
              <label>Username or Email</label>

              <div className="invite_search_box">
                <i className="ti-search"></i>
                <input
                  type="text"
                  value={inviteQuery}
                  placeholder="unknown_scholar_2024"
                  onChange={(e) => {
                    setInviteQuery(e.target.value);
                    setInviteStatus("idle");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearchInviteMember();
                    }
                  }}
                />
              </div>
            </div>

            {inviteStatus === "found" && (
              <div className="invite_result_card">
                <div className="invite_candidate">
                  <div className="invite_candidate_avatar">NA</div>

                  <div>
                    <h3>Nguyễn Văn A</h3>
                    <p>@nva_academic · Research Lead</p>
                  </div>
                </div>

                <button type="button" onClick={handleSendInvite}>
                  <i className="ti-location-arrow"></i>
                  Invite
                </button>
              </div>
            )}

            {inviteStatus === "not-found" && (
              <div className="invite_no_result">
                <div className="invite_no_result_image">
                  <i className="ti-search"></i>
                </div>

                <h3>No user found</h3>
                <p>
                  We could not find any student or researcher matching
                  "{inviteQuery}". Check the spelling or try a different name.
                </p>

                <div className="invite_no_result_actions">
                  <button
                    type="button"
                    onClick={() => {
                      setInviteQuery("");
                      setInviteStatus("idle");
                    }}
                  >
                    Try Again
                  </button>

                  <button type="button" onClick={handleSendInvite}>
                    Invite via Link
                  </button>
                </div>
              </div>
            )}

            {inviteStatus !== "not-found" && (
              <div className="invite_permission_area">
                <p>
                  <i className="ti-shield"></i>
                  Select default permissions
                </p>

                <div className="invite_permission_buttons">
                  <button
                    type="button"
                    className={inviteRole === "Viewer" ? "active" : ""}
                    onClick={() => setInviteRole("Viewer")}
                  >
                    <i className="ti-eye"></i>
                    Viewer
                  </button>

                  <button
                    type="button"
                    className={inviteRole === "Editor" ? "active" : ""}
                    onClick={() => setInviteRole("Editor")}
                  >
                    <i className="ti-pencil"></i>
                    Editor
                  </button>
                </div>
              </div>
            )}

            <div className="invite_modal_footer">
              <span>
                <i className="ti-info-alt"></i>
                Invites expire in 7 days.
              </span>

              <div>
                <button type="button" onClick={handleCloseInviteModal}>
                  Cancel
                </button>

                <button
                  type="button"
                  className="send_invite_btn"
                  onClick={
                    inviteStatus === "idle"
                      ? handleSearchInviteMember
                      : handleSendInvite
                  }
                  disabled={inviteQuery.trim() === ""}
                >
                  {inviteStatus === "idle" ? "Search" : "Done"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function LibraryCard({ item }) {
  return (
    <article className={`library_file_card ${item.type}`}>
      {item.image ? (
        <div
          className="file_preview"
          style={{ backgroundImage: `url(${item.image})` }}
        />
      ) : (
        <div className="file_icon">
          <i className={item.icon}></i>
        </div>
      )}

      <div className="file_info">
        <h3>{item.name}</h3>
        <p>{item.note}</p>
      </div>
    </article>
  );
}

function handleDownloadDocument(fileItem) {
  if (!fileItem.downloadUrl) {
    alert("This file is sample data, so it cannot be downloaded yet.");
    return;
  }

  const downloadLink = window.document.createElement("a");
  downloadLink.href = fileItem.downloadUrl;
  downloadLink.download = fileItem.name;

  window.document.body.appendChild(downloadLink);
  downloadLink.click();
  window.document.body.removeChild(downloadLink);
}
export default LibraryPage;