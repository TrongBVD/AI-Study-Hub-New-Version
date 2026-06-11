import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./WorkSpacePage.css";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

function WorkSpacePage() {
  const WORKSPACE_NAME_MAX_LENGTH = 30;
  
  const { workspaceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("research");
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueContent, setIssueContent] = useState("");
  const [issueFiles, setIssueFiles] = useState([]);
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [inviteStatus, setInviteStatus] = useState("idle");
function handleWorkspaceNameChange(e) {
  const nextValue = e.target.value;

  if (nextValue.length > WORKSPACE_NAME_MAX_LENGTH) return;

  setWorkspaceNameInput(nextValue);

  if (nextValue.length === WORKSPACE_NAME_MAX_LENGTH) {
    setWorkspaceSettingMessage(
      `Workspace name has reached the limit of ${WORKSPACE_NAME_MAX_LENGTH} characters.`
    );
    return;
  }

  setWorkspaceSettingMessage("");
}
  const [pendingInvitations, setPendingInvitations] = useState([
    {
      email: "alex.proctor@edu.com",
      invitedBy: "TrongBVD",
      time: "2 hours ago",
    },
    {
      email: "m.chen@research.io",
      invitedBy: "TrongBVD",
      time: "yesterday",
    },
  ]);

  const [messageText, setMessageText] = useState("");
  const [messageAttachment, setMessageAttachment] = useState(null);
  const [selectedStudySetId, setSelectedStudySetId] = useState("software-architecture");
  const [currentStudyCardIndex, setCurrentStudyCardIndex] = useState(0);
  const [isStudyCardFlipped, setIsStudyCardFlipped] = useState(false);


  const savedWorkSpaces = JSON.parse(
    localStorage.getItem("aiStudyHubWorkspaces") || "[]"
  );

  const workspace =
    location.state?.workspace ||
    savedWorkSpaces.find((item) => item.id === workspaceId);

  useEffect(() => {
    if (!workspace?.id) return;

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
  }, [
    workspace?.id,
    workspace?.name,
    workspace?.description,
    workspace?.icon,
    workspace?.documents,
  ]);

  const [workspaceNameInput, setWorkspaceNameInput] = useState(
    workspace?.name || ""
  );
  const [workspaceSettingMessage, setWorkspaceSettingMessage] = useState("");

  const profileName =
    localStorage.getItem("aiStudyHubProfileName") ||
    workspace?.owner ||
    "dangkhoabi456";

  const [chatMessages, setChatMessages] = useState([
    {
      id: "msg-1",
      senderName: "Sarah Jenkins",
      avatar: "https://i.pravatar.cc/80?img=32",
      text:
        "Does anyone have the notes for yesterday's lecture on architectural patterns? I missed the last 20 minutes.",
      time: "10:42 AM",
      isOwn: false,
    },
    {
      id: "msg-2",
      senderName: profileName,
      text:
        "I have them here! I just finished digitizing the sketches of the microservices diagram we discussed.",
      time: "10:45 AM · Read",
      isOwn: true,
      file: {
        name: "Software_Arch_Notes.pdf",
        sizeLabel: "2.4 MB",
        isImage: false,
      },
    },
    {
      id: "msg-3",
      senderName: "David Chen",
      avatar: "https://i.pravatar.cc/80?img=13",
      text:
        "Found this great reference in the university archives for our project proposal.",
      time: "11:15 AM",
      isOwn: false,
      file: {
        name: "University archive",
        sizeLabel: "Image",
        isImage: true,
        previewUrl:
          "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=80",
      },
    },
  ]);

  const issuesStorageKey = `aiStudyHubWorkspaceIssues_${workspaceId}`;

  const initialIssues = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(issuesStorageKey) || "[]");
    } catch (error) {
      console.error("Cannot read workspace issues:", error);
      return [];
    }
  }, [issuesStorageKey]);

  const [issues, setIssues] = useState(initialIssues);

  if (!workspace) {
    return (
      <main className="workspace_page">
        <section className="workspace_not_found">
          <div className="workspace_not_found_icon">
            <i className="ti-layout-grid2"></i>
          </div>

          <h1>Workspace not found</h1>
          <p>This workspace may have been deleted or the link is incorrect.</p>

          <Link to="/dashboard/workspaces">Back to My Workspaces</Link>
        </section>
      </main>
    );
  }

  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId);

  const studySets = [
    {
      id: "software-architecture",
      title: "Software Architecture Basics",
      meta: "20 Cards · Updated 2h ago",
      tag: "Mastery",
      subtitle: "Focusing on high-availability and distributed systems",
      cards: [
        {
          question:
            "What is the primary purpose of a Load Balancer in a distributed system?",
          answer:
            "It distributes incoming traffic across multiple servers to improve availability, performance, and fault tolerance.",
        },
        {
          question: "What does high availability mean in software architecture?",
          answer:
            "It means the system is designed to remain accessible and operational with minimal downtime.",
        },
        {
          question: "Why do microservices usually need service discovery?",
          answer:
            "Because services can scale or move dynamically, so other services need a way to find their current network locations.",
        },
      ],
    },
    {
      id: "react-hooks",
      title: "React Hooks Mastery",
      meta: "45 Cards · Updated 1d ago",
      tag: "",
      subtitle: "Review useState, useEffect, useRef, and useContext",
      cards: [
        {
          question: "What is the main purpose of useEffect in React?",
          answer:
            "It runs side effects after render, such as fetching data, subscriptions, or DOM updates.",
        },
        {
          question: "When should you use useRef?",
          answer:
            "Use it to access DOM elements directly or store mutable values that should not trigger re-render.",
        },
      ],
    },
    {
      id: "database-normalization",
      title: "Database Normalization",
      meta: "12 Cards · Updated 3d ago",
      tag: "",
      subtitle: "Practice relational design and reducing redundancy",
      cards: [
        {
          question: "What is the goal of database normalization?",
          answer:
            "To organize data to reduce duplication and improve data integrity.",
        },
      ],
    },
    {
      id: "intro-algorithms",
      title: "Intro to Algorithms",
      meta: "30 Cards · Updated 1w ago",
      tag: "",
      subtitle: "Core algorithm concepts and complexity basics",
      cards: [
        {
          question: "What does Big-O notation describe?",
          answer:
            "It describes how an algorithm's time or space usage grows as input size increases.",
        },
      ],
    },
  ];

  const selectedStudySet =
    studySets.find((studySet) => studySet.id === selectedStudySetId) ||
    studySets[0];

  const currentStudyCard =
    selectedStudySet.cards[currentStudyCardIndex] || selectedStudySet.cards[0];

  function formatMessageFileSize(size) {
    if (!size) return "0 KB";

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getCurrentMessageTime() {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function saveIssues(nextIssues) {
    localStorage.setItem(issuesStorageKey, JSON.stringify(nextIssues));
    setIssues(nextIssues);
  }

  function handleCreateIssue(e) {
    e.preventDefault();

    if (issueTitle.trim() === "") {
      alert("Please enter issue name");
      return;
    }

    const newIssue = {
      id: `issue-${Date.now()}`,
      title: issueTitle.trim(),
      creator: profileName,
      status: "Active",
      content: "",
      files: [],
      createdAt: "Created just now",
      updatedAt: "Updated just now",
    };

    saveIssues([newIssue, ...issues]);
    setSelectedIssueId(newIssue.id);
    setIssueTitle("");
    setIssueContent("");
    setIssueFiles([]);
    setShowIssueForm(false);
  }

  function handleIssueFileChange(e) {
    const selectedFiles = Array.from(e.target.files);

    if (selectedFiles.length === 0 || !selectedIssue) return;

    const newFiles = selectedFiles.map((file) => ({
      id: `issue-file-${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      type: file.type,
      addedAt: "Added just now",
    }));

    setIssueFiles((prevFiles) => [...prevFiles, ...newFiles]);
    e.target.value = "";
  }

  function handleSaveIssueNote(e) {
    e.preventDefault();

    if (!selectedIssue) return;

    const nextIssues = issues.map((issue) =>
      issue.id === selectedIssue.id
        ? {
          ...issue,
          content: issueContent,
          files: [...(issue.files || []), ...issueFiles],
          updatedAt: "Updated just now",
        }
        : issue
    );

    saveIssues(nextIssues);
    setIssueFiles([]);
  }

  function handleOpenInviteModal() {
    setIsInviteModalOpen(true);
  }

  function handleCloseInviteModal() {
    setIsInviteModalOpen(false);
    setInviteQuery("");
    setInviteRole("Viewer");
    setInviteStatus("idle");
  }

  function handleInviteQueryChange(e) {
    setInviteQuery(e.target.value);
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
      invitedBy: profileName,
      time: "just now",
    };

    setPendingInvitations((currentInvitations) => [
      newInvitation,
      ...currentInvitations,
    ]);

    handleCloseInviteModal();
  }

  function handleMessageAttachmentChange(e) {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    const isImage = selectedFile.type.startsWith("image/");

    setMessageAttachment({
      name: selectedFile.name,
      size: selectedFile.size,
      sizeLabel: formatMessageFileSize(selectedFile.size),
      type: selectedFile.type,
      isImage,
      previewUrl: isImage ? URL.createObjectURL(selectedFile) : "",
    });

    e.target.value = "";
  }

  function handleRemoveMessageAttachment() {
    if (messageAttachment?.previewUrl) {
      URL.revokeObjectURL(messageAttachment.previewUrl);
    }

    setMessageAttachment(null);
  }

  function handleSendMessage() {
    const trimmedMessage = messageText.trim();

    if (trimmedMessage === "" && !messageAttachment) return;

    const newMessage = {
      id: `msg-${Date.now()}`,
      senderName: profileName,
      text: trimmedMessage,
      time: `${getCurrentMessageTime()} · Sent`,
      isOwn: true,
      file: messageAttachment
        ? {
          name: messageAttachment.name,
          sizeLabel: messageAttachment.sizeLabel,
          isImage: messageAttachment.isImage,
          previewUrl: messageAttachment.previewUrl,
        }
        : null,
    };

    setChatMessages((currentMessages) => [...currentMessages, newMessage]);
    setMessageText("");
    setMessageAttachment(null);
  }

  function handleMessageKeyDown(e) {
    if (e.key !== "Enter" || e.shiftKey) return;

    e.preventDefault();
    handleSendMessage();
  }

function handleRenameWorkspace(e) {
  e.preventDefault();

  const rawName = workspaceNameInput;
  const trimmedName = rawName.trim();

  if (trimmedName === "") {
    setWorkspaceSettingMessage("Workspace name cannot be empty.");
    return;
  }

  if (rawName.length > WORKSPACE_NAME_MAX_LENGTH) {
    setWorkspaceSettingMessage(
      `Workspace name cannot exceed ${WORKSPACE_NAME_MAX_LENGTH} characters.`
    );
    return;
  }

  const updatedWorkspaces = savedWorkSpaces.map((item) =>
    item.id === workspaceId ? { ...item, name: trimmedName } : item
  );

  localStorage.setItem(
    "aiStudyHubWorkspaces",
    JSON.stringify(updatedWorkspaces)
  );

  setWorkspaceNameInput(trimmedName);
  setWorkspaceSettingMessage("Workspace name updated successfully.");
}

  function handleDeleteWorkspace() {
    const isConfirmed = window.confirm(
      "Are you sure you want to delete this workspace?"
    );

    if (!isConfirmed) return;

    const updatedWorkspaces = savedWorkSpaces.filter(
      (item) => item.id !== workspaceId
    );

    localStorage.setItem(
      "aiStudyHubWorkspaces",
      JSON.stringify(updatedWorkspaces)
    );

    navigate("/dashboard/workspaces");
  }

  function handleSelectStudySet(studySetId) {
    setSelectedStudySetId(studySetId);
    setCurrentStudyCardIndex(0);
    setIsStudyCardFlipped(false);
  }

  function handlePreviousStudyCard() {
    setCurrentStudyCardIndex((currentIndex) =>
      currentIndex === 0 ? selectedStudySet.cards.length - 1 : currentIndex - 1
    );
    setIsStudyCardFlipped(false);
  }

  function handleNextStudyCard() {
    setCurrentStudyCardIndex((currentIndex) =>
      currentIndex === selectedStudySet.cards.length - 1 ? 0 : currentIndex + 1
    );
    setIsStudyCardFlipped(false);
  }

  function renderMessagesTab() {
    return (
      <section className="workspace_message_tab">
        <header className="workspace_message_header">
          <div>
            <h2>{workspaceNameInput || workspace.name || "Workspace Group Chat"}</h2>
            <p>
              <span></span>
              14 members online
            </p>
          </div>

          <div className="workspace_message_header_actions">
            <button type="button" aria-label="View members">
              <i className="ti-user"></i>
            </button>

            <button type="button" aria-label="Conversation information">
              <i className="ti-info-alt"></i>
            </button>

            <div className="workspace_message_admin">
              <span>{profileName}</span>
              <img src="https://i.pravatar.cc/80?img=12" alt={profileName} />
            </div>
          </div>
        </header>

        <div className="workspace_message_day">Today</div>

        <section className="workspace_message_body">
          {chatMessages.map((message) => (
            <article
              className={`workspace_message_item ${message.isOwn ? "own" : ""}`}
              key={message.id}
            >
              {!message.isOwn && (
                <img
                  className="workspace_message_avatar"
                  src={message.avatar}
                  alt={message.senderName}
                />
              )}

              <div className="workspace_message_content_area">
                {!message.isOwn && <h3>{message.senderName}</h3>}

                {message.text && (
                  <div
                    className={`workspace_message_bubble ${message.isOwn ? "sent" : "received"
                      }`}
                  >
                    {message.text}
                  </div>
                )}

                {message.file && message.file.isImage && (
                  <div
                    className={`workspace_message_bubble image ${message.isOwn ? "sent" : "received"
                      }`}
                  >
                    <img src={message.file.previewUrl} alt={message.file.name} />
                  </div>
                )}

                {message.file && !message.file.isImage && (
                  <div className="workspace_message_file">
                    <div>
                      <i className="ti-file"></i>
                    </div>

                    <section>
                      <strong>{message.file.name}</strong>
                      <span>{message.file.sizeLabel}</span>
                    </section>
                  </div>
                )}

                <span
                  className={`workspace_message_time ${message.isOwn ? "own" : ""
                    }`}
                >
                  {message.time}
                </span>
              </div>
            </article>
          ))}
        </section>

        {messageAttachment && (
          <div className="workspace_message_selected_file">
            <div>
              <i className={messageAttachment.isImage ? "ti-image" : "ti-file"}></i>
              <span>
                {messageAttachment.name} · {messageAttachment.sizeLabel}
              </span>
            </div>

            <button type="button" onClick={handleRemoveMessageAttachment}>
              ×
            </button>
          </div>
        )}

        <section className="workspace_message_composer">
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleMessageKeyDown}
            placeholder="Type your message here..."
          />

          <div className="workspace_message_composer_actions">
            <div>
              <label title="Attach file">
                <i className="ti-clip"></i>
                <input type="file" onChange={handleMessageAttachmentChange} />
              </label>

              <button type="button" aria-label="Add emoji">
                <i className="ti-face-smile"></i>
              </button>
            </div>

            <button
              type="button"
              className="workspace_message_send_btn"
              onClick={handleSendMessage}
              aria-label="Send message"
            >
              <i className="ti-control-play"></i>
            </button>
          </div>
        </section>

        <p className="workspace_message_hint">
          Press Enter to send, Shift + Enter for new line
        </p>
      </section>
    );
  }

  function renderMembersTab() {
    const workspaceMembers = [
      {
        name: "TrongBVD",
        email: "trongbvd@university.edu",
        role: "Manager",
        joinDate: "Oct 12, 2023",
        avatar: "https://i.pravatar.cc/80?img=11",
        isOnline: true,
      },
      {
        name: profileName,
        email: "d.khoa@academic.org",
        role: "Member",
        joinDate: "Jan 05, 2024",
        avatar: "https://i.pravatar.cc/80?img=14",
        isOnline: false,
      },
      {
        name: "aikirokito",
        email: "kito.ai@study.net",
        role: "Member",
        joinDate: "Mar 22, 2024",
        avatar: "https://i.pravatar.cc/80?img=33",
        isOnline: false,
      },
      {
        name: "Sarah Jenkins",
        email: "s.jenkins@university.edu",
        role: "Member",
        joinDate: "Jun 10, 2024",
        avatar: "https://i.pravatar.cc/80?img=47",
        isOnline: false,
      },
      {
        name: "Nguyễn Văn A",
        email: "v.a.nguyen@university.edu",
        role: "Member",
        joinDate: "Pending",
        avatar: "",
        isPending: true,
      },
    ];

    return (
      <section className="workspace_member_tab">
        <section className="workspace_member_main">
          <div className="workspace_member_top">
            <div>
              <h2>Workspace Members</h2>
              <p>Manage access and roles for this academic resource center.</p>
            </div>

            <div className="workspace_member_actions">
              <div className="workspace_member_search">
                <i className="ti-search"></i>
                <input type="text" placeholder="Search members..." />
              </div>

              <button type="button" onClick={handleOpenInviteModal}>
                <i className="ti-user"></i>
                Add Member
              </button>
            </div>
          </div>

          <div className="workspace_member_table">
            <div className="workspace_member_table_header">
              <span>Member</span>
              <span>Role</span>
              <span>Join Date</span>
              <span>Actions</span>
            </div>

            {workspaceMembers.map((member) => (
              <article className="workspace_member_row" key={member.email}>
                <div className="workspace_member_identity">
                  <div className="workspace_member_avatar">
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.name} />
                    ) : (
                      <i className="ti-user"></i>
                    )}

                    {member.isOnline && <span></span>}
                  </div>

                  <div>
                    <strong>{member.name}</strong>
                    <p>{member.email}</p>
                  </div>
                </div>

                <span
                  className={`workspace_member_status ${member.role === "Manager" ? "manager" : "member"
                    }`}
                >
                  {member.role}
                </span>

                <span
                  className={
                    member.isPending
                      ? "workspace_member_join_date pending"
                      : "workspace_member_join_date"
                  }
                >
                  {member.joinDate}
                </span>

                {member.isPending ? (
                  <button type="button" className="workspace_resend_btn">
                    Resend
                  </button>
                ) : (
                  <button type="button" aria-label="Member settings">
                    <i className="ti-settings"></i>
                  </button>
                )}
              </article>
            ))}
          </div>

          <p className="workspace_member_note">
            Note: Only members who have accepted their invitation or are
            explicitly listed as pending appear in this workspace list.
          </p>

          <section className="workspace_pending_card">
            <div className="workspace_pending_header">
              <h3>Pending Invitations</h3>
              <span>{pendingInvitations.length} Pending</span>
            </div>

            <div className="workspace_pending_list">
              {pendingInvitations.map((invitation) => (
                <article className="workspace_pending_item" key={invitation.email}>
                  <div className="workspace_pending_mail_icon">
                    <i className="ti-email"></i>
                  </div>

                  <div className="workspace_pending_info">
                    <strong>{invitation.email}</strong>
                    <p>
                      Invited {invitation.time} by {invitation.invitedBy}
                    </p>
                  </div>

                  <button type="button">Resend</button>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className="workspace_member_sidebar">
          <section className="workspace_side_card workspace_roles_card">
            <h3>About Roles</h3>

            <div className="workspace_role_item">
              <strong>Managers</strong>
              <p>
                Can edit library settings, upload documents, and manage members.
              </p>
            </div>

            <div className="workspace_role_item">
              <strong>Members</strong>
              <p>
                Can view documents, participate in AI chats, and contribute to
                folders.
              </p>
            </div>
          </section>

          <section className="workspace_side_card workspace_activity_card">
            <div className="workspace_side_title">
              <h3>Activity</h3>
              <i className="ti-stats-up"></i>
            </div>

            <div className="workspace_activity_stats">
              <div>
                <strong>42</strong>
                <span>Posts</span>
              </div>

              <div>
                <strong>12</strong>
                <span>Tasks</span>
              </div>
            </div>
          </section>

          <section className="workspace_side_card workspace_latest_card">
            <h3>Latest Activity</h3>

            <div className="workspace_latest_activity highlight">
              <strong>TrongBVD</strong>
              <p>updated the React Hooks guide.</p>
              <span>5 hours ago</span>
            </div>

            <div className="workspace_latest_activity">
              <strong>{profileName}</strong>
              <p>joined the hub.</p>
              <span>Yesterday</span>
            </div>
          </section>
        </aside>
      </section>
    );
  }


  function renderResearchTab() {
    if (selectedIssue) {
      const relatedFiles = [...(selectedIssue.files || []), ...issueFiles];

      return (
        <section className="research_issue_detail">
          <div className="research_breadcrumb">
            <button type="button" onClick={() => setSelectedIssueId(null)}>
              Research
            </button>
            <i className="ti-angle-right"></i>
            <span>{selectedIssue.title}</span>
          </div>

          <div className="research_issue_editor">
            <header className="research_issue_editor_header">
              <div>
                <span className="research_status_badge">{selectedIssue.status}</span>
                <h2>{selectedIssue.title}</h2>
                <p>
                  Created by {selectedIssue.creator} · {selectedIssue.updatedAt}
                </p>
              </div>

              <button type="button" onClick={() => setSelectedIssueId(null)}>
                Back to issues
              </button>
            </header>

            <form className="research_note_form" onSubmit={handleSaveIssueNote}>
              <label>Issue note</label>
              <textarea
                value={issueContent}
                onChange={(e) => setIssueContent(e.target.value)}
                placeholder="Write your research note, discussion point, or problem description."
              />

              <div className="research_attachment_area">
                <label className="research_file_button">
                  <i className="ti-clip"></i>
                  Attach related files
                  <input type="file" multiple onChange={handleIssueFileChange} />
                </label>

                <button type="submit" className="research_save_btn">
                  Save issue update
                </button>
              </div>
            </form>

            {relatedFiles.length > 0 && (
              <section className="research_related_files">
                <h3>Related files</h3>

                <div className="research_file_list">
                  {relatedFiles.map((file) => (
                    <article className="research_file_item" key={file.id}>
                      <i className="ti-file"></i>

                      <div>
                        <strong>{file.name}</strong>
                        <span>
                          {(file.size / 1024).toFixed(1)} KB · {file.addedAt}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </section>
      );
    }

    return (
      <section className="research_tab_page">
        <div className="research_intro_row">
          <div>
            <span className="research_label">Active inquiry</span>
            <h2>Research Initiatives</h2>
            <p>
              Explore academic problems and collaborative investigations within
              this workspace.
            </p>
          </div>

          <button
            type="button"
            className="new_research_topic_btn"
            onClick={() => setShowIssueForm(true)}
          >
            <i className="ti-plus"></i>
            New Research Topic
          </button>
        </div>

        {issues.length === 0 && !showIssueForm ? (
          <section className="research_empty_state">
            <div className="research_empty_icon">
              <i className="ti-search"></i>
            </div>

            <h3>No issue found</h3>
            <p>
              <button type="button" onClick={() => setShowIssueForm(true)}>
                create new one
              </button>
            </p>
          </section>
        ) : null}

        {showIssueForm && (
          <div className="research_issue_popup_overlay">
            <form
              className="research_create_card research_issue_popup_card"
              onSubmit={handleCreateIssue}
            >
              <button
                type="button"
                className="research_issue_popup_close"
                onClick={() => setShowIssueForm(false)}
                aria-label="Close create issue popup"
              >
                ×
              </button>

              <div className="research_create_header">
                <div className="research_creator_avatar">
                  {profileName.slice(0, 2).toUpperCase()}
                </div>

                <div>
                  <h3>Create new issue</h3>
                  <p>Creator: {profileName}</p>
                </div>
              </div>

              <div className="research_form_group">
                <label>Issue name</label>
                <input
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  placeholder="Enter issue name"
                  autoFocus
                />
              </div>

              <div className="research_create_actions">
                <button type="button" onClick={() => setShowIssueForm(false)}>
                  Cancel
                </button>

                <button type="submit">Create issue</button>
              </div>
            </form>
          </div>
        )}

        {issues.length > 0 && (
          <section className="research_issue_grid">
            {issues.map((issue, index) => (
              <article
                className={`research_issue_card ${index === 0 ? "large" : ""}`}
                key={issue.id}
                onClick={() => {
                  setSelectedIssueId(issue.id);
                  setIssueContent(issue.content || "");
                  setIssueFiles([]);
                }}
              >
                <div className="research_issue_top">
                  <span>{issue.status}</span>
                  <small>{issue.updatedAt}</small>
                </div>

                <h3>{issue.title}</h3>
                <p>
                  Created by {issue.creator}. Open this issue to add notes and
                  attach related research files.
                </p>

                <div className="research_issue_meta">
                  <span>
                    <i className="ti-comment-alt"></i>0 discussions
                  </span>

                  <span>
                    <i className="ti-clip"></i>
                    {issue.files?.length || 0} files
                  </span>
                </div>
              </article>
            ))}
          </section>
        )}
        <section className="workspace_research_about">
          <div className="workspace_research_about_header">
            <i className="ti-bookmark-alt"></i>
            <h3>About this workspace</h3>
          </div>

          <p>
            {workspace?.description ||
              "This workspace is used to organize research topics, study materials, and collaborative academic work."}
          </p>
        </section>
      </section>
    );
  }

  function renderStudyTab() {
    return (
      <section className="workspace_study_tab">
        <aside className="workspace_study_sidebar">
          <div className="workspace_study_sidebar_header">
            <h3>Flashcard Sets</h3>

            <button type="button" aria-label="Open flashcard library">
              <i className="ti-layout-grid2"></i>
            </button>
          </div>

          <button type="button" className="workspace_study_generate_btn">
            <i className="ti-plus"></i>
            Generate New
          </button>

          <div className="workspace_study_set_list">
            {studySets.map((studySet) => (
              <button
                type="button"
                className={`workspace_study_set_card ${selectedStudySetId === studySet.id ? "active" : ""
                  }`}
                key={studySet.id}
                onClick={() => handleSelectStudySet(studySet.id)}
              >
                {studySet.tag && (
                  <strong>
                    <i className="ti-medall"></i>
                    {studySet.tag}
                  </strong>
                )}

                <span>{studySet.title}</span>
                <small>{studySet.meta}</small>
              </button>
            ))}
          </div>

          <section className="workspace_study_ai_card">
            <div>
              <i className="ti-target"></i>
            </div>

            <section>
              <strong>AI Extraction</strong>
              <p>Analyzing System_Design_v2.pdf...</p>
            </section>
          </section>
        </aside>

        <section className="workspace_study_main">
          <header className="workspace_study_header">
            <div>
              <h2>{selectedStudySet.title}</h2>
              <p>{selectedStudySet.subtitle}</p>
            </div>

            <div className="workspace_study_progress">
              <div>
                <span
                  style={{
                    width: `${((currentStudyCardIndex + 1) /
                        selectedStudySet.cards.length) *
                      100
                      }%`,
                  }}
                ></span>
              </div>

              <p>
                <strong>Session Progress</strong>
                {currentStudyCardIndex + 1} of {selectedStudySet.cards.length} cards
              </p>
            </div>
          </header>

          <section className="workspace_study_stage">
            <button
              type="button"
              className={`workspace_flashcard ${isStudyCardFlipped ? "flipped" : ""
                }`}
              onClick={() => setIsStudyCardFlipped(!isStudyCardFlipped)}
            >
              <span>{isStudyCardFlipped ? "Answer" : "Question"}</span>

              <h3>
                {isStudyCardFlipped
                  ? currentStudyCard.answer
                  : currentStudyCard.question}
              </h3>

              <small>
                <i className="ti-mouse"></i>
                Click to flip
              </small>
            </button>

            <div className="workspace_study_controls">
              <button type="button" onClick={handlePreviousStudyCard}>
                <i className="ti-arrow-left"></i>
              </button>

              <button
                type="button"
                className="workspace_study_flip_btn"
                onClick={() => setIsStudyCardFlipped(!isStudyCardFlipped)}
              >
                <i className="ti-reload"></i>
                Flip Card
              </button>

              <button type="button" onClick={handleNextStudyCard}>
                <i className="ti-arrow-right"></i>
              </button>
            </div>
          </section>

          <section className="workspace_study_stats">
            <article>
              <div className="workspace_study_stat_icon">
                <i className="ti-timer"></i>
              </div>

              <section>
                <span>Time Spent</span>
                <strong>14:2</strong>
                <p>This session</p>
              </section>
            </article>

            <article>
              <div className="workspace_study_stat_icon highlight">
                <i className="ti-bolt"></i>
              </div>

              <section>
                <span>Recall Rate</span>
                <strong>92%</strong>
                <p>Higher than average</p>
              </section>
            </article>

            <article>
              <div className="workspace_study_stat_icon">
                <i className="ti-headphone-alt"></i>
              </div>

              <section>
                <span>Focus Level</span>
                <strong>High</strong>
                <p>Keep it up!</p>
              </section>
            </article>
          </section>
        </section>
      </section>
    );
  }

  function renderSettingsTab() {
    return (
      <section className="workspace_settings_tab">
        <header className="workspace_settings_header">
          <div>
            <span>Workspace Settings</span>
            <h2>Manage workspace</h2>
            <p>Update this workspace name or delete this workspace.</p>
          </div>
        </header>

        <section className="workspace_settings_card">
          <div className="workspace_settings_card_header">
            <div className="workspace_settings_icon">
              <i className="ti-pencil-alt"></i>
            </div>

            <div>
              <h3>Rename workspace</h3>
              <p>Change the display name of this workspace.</p>
            </div>
          </div>

          <form className="workspace_settings_form" onSubmit={handleRenameWorkspace}>
            <label>Workspace name</label>
<input
  type="text"
  value={workspaceNameInput}
  onChange={handleWorkspaceNameChange}
  placeholder="Enter workspace name"
/>

<small
  className={
    workspaceNameInput.length > WORKSPACE_NAME_MAX_LENGTH
      ? "settings_warning_text"
      : ""
  }
>
  {workspaceNameInput.length}/{WORKSPACE_NAME_MAX_LENGTH} characters
</small>
            <button type="submit">Save changes</button>
          </form>

          {workspaceSettingMessage && (
            <p className="workspace_settings_message">
              {workspaceSettingMessage}
            </p>
          )}
        </section>

        <section className="workspace_settings_card danger">
          <div className="workspace_settings_card_header">
            <div className="workspace_settings_icon danger">
              <i className="ti-trash"></i>
            </div>

            <div>
              <h3>Delete workspace</h3>
              <p>Remove this workspace from your local workspace list.</p>
            </div>
          </div>

          <button
            type="button"
            className="workspace_delete_btn"
            onClick={handleDeleteWorkspace}
          >
            Delete workspace
          </button>
        </section>
      </section>
    );
  }

  function renderInviteMemberModal() {
    if (!isInviteModalOpen) return null;

    return (
      <div className="workspace_invite_overlay">
        <section className="workspace_invite_modal">
          <header className="workspace_invite_header">
            <div className="workspace_invite_header_icon">
              <i className="ti-user"></i>
            </div>

            <div>
              <h2>Invite Members</h2>
              <p>Add collaborators to your academic hub</p>
            </div>

            <button type="button" onClick={handleCloseInviteModal}>
              ×
            </button>
          </header>

          <div className="workspace_invite_field">
            <label>Find by username or email</label>

            <div className="workspace_invite_search">
              <i className="ti-search"></i>
              <input
                type="text"
                value={inviteQuery}
                onChange={handleInviteQueryChange}
                placeholder="nva_academic"
              />
            </div>
          </div>

          <div className="workspace_invite_result_title">
            SEARCH RESULTS {inviteStatus === "found" ? "(1)" : ""}
          </div>

          {inviteStatus === "found" && (
            <section className="workspace_invite_result">
              <div className="workspace_invite_candidate">
                <div className="workspace_invite_avatar">
                  <img src="https://i.pravatar.cc/80?img=12" alt="Nguyễn Văn A" />
                  <span></span>
                </div>

                <div>
                  <h3>Nguyễn Văn A</h3>
                  <p>@nva_academic · Research Lead</p>
                </div>
              </div>

              <button type="button" onClick={handleSendInvite}>
                <i className="ti-location-arrow"></i>
                Invite
              </button>
            </section>
          )}

          {inviteStatus === "idle" && (
            <section className="workspace_invite_empty_result">
              <i className="ti-search"></i>
              <p>Enter a username or email, then press Search.</p>
            </section>
          )}

          {inviteStatus === "not-found" && (
            <section className="workspace_invite_no_result">
              <div className="workspace_invite_no_result_icon">
                <i className="ti-search"></i>
              </div>

              <h3>No user found</h3>
              <p>
                We couldn't find any student or researcher matching
                "{inviteQuery}". Check the spelling or try a different name.
              </p>

              <div className="workspace_invite_no_result_actions">
                <button type="button" onClick={() => setInviteStatus("idle")}>
                  Try Again
                </button>

                <button type="button" onClick={handleSendInvite}>
                  Invite via Email
                </button>
              </div>
            </section>
          )}

          <section className="workspace_invite_permission">
            <p>
              <i className="ti-shield"></i>
              Select default permissions
            </p>

            <div className="workspace_invite_permission_buttons">
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
                <i className="ti-pencil-alt"></i>
                Editor
              </button>
            </div>
          </section>

          <footer className="workspace_invite_footer">
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
                className="workspace_send_invite_btn"
                disabled={inviteQuery.trim() === ""}
                onClick={
                  inviteStatus === "idle"
                    ? handleSearchInviteMember
                    : handleSendInvite
                }
              >
                {inviteStatus === "idle" ? "Search" : "Done"}
              </button>
            </div>
          </footer>
        </section>
      </div>
    );
  }

  return (
    <main className="workspace_page">
      <nav className="workspace_top_tabs">
        <button
          className={activeTab === "research" ? "active" : ""}
          onClick={() => setActiveTab("research")}
        >
          <i className="ti-search"></i>
          Research
        </button>

        <button
          className={activeTab === "messages" ? "active" : ""}
          onClick={() => setActiveTab("messages")}
        >
          <i className="ti-comment-alt"></i>
          Message
        </button>

        <button
          className={activeTab === "study" ? "active" : ""}
          onClick={() => setActiveTab("study")}
        >
          <i className="ti-book"></i>
          Study
        </button>

        <button
          className={activeTab === "members" ? "active" : ""}
          onClick={() => setActiveTab("members")}
        >
          <i className="ti-user"></i>
          Member
        </button>

        <button
          className={activeTab === "settings" ? "active" : ""}
          onClick={() => setActiveTab("settings")}
        >
          <i className="ti-settings"></i>
          Setting
        </button>
      </nav>

      {activeTab === "messages" && renderMessagesTab()}

      {activeTab === "research" && renderResearchTab()}

      {activeTab === "study" && renderStudyTab()}

      {activeTab === "members" && renderMembersTab()}

      {activeTab === "settings" && renderSettingsTab()}

      {renderInviteMemberModal()}
    </main>
  );
}

export default WorkSpacePage;