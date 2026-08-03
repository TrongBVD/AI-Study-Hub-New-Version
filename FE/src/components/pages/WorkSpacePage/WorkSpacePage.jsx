import {
  Link,
  useLocation,
  useParams,
  useNavigate,
} from "react-router-dom";
import ActionPopup from "../../common/ActionPopup/ActionPopup.jsx";
import useActionPopup from "../../common/ActionPopup/useActionPopup.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addWorkspaceMember,
  getWorkspaceMembers,
  removeWorkspaceMember,
  searchWorkspaceUsers,
  getWorkspace,
  updateWorkspace,
  updateWorkspaceMemberRole,
  deleteWorkspace,
  getWorkspaceMessages,
  createWorkspaceMessage,
  getWorkspaceFlashcards,
  getWorkspaceDocuments,
  reviewWorkspaceDocument,
  generateWorkspaceDocumentFlashcards,
  leaveWorkspace,
  transferAdminOwnership,
} from "../../../utils/workspaceApi";
import { downloadDocument, uploadDocuments } from "../../../utils/documentApi";
import { getStoredUser as getAuthStoredUser } from "../../../utils/authToken.js";
import WorkspaceAiChat from "./WorkspaceAiChat.jsx";
import "./WorkSpacePage.css";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

function getInviteErrorMessage(error) {
  const status = error.response?.status;
  const backendMessage = error.response?.data?.message;

  if (status === 401) {
    return "Your login session is not valid anymore. Please log in again, then search users.";
  }

  if (status === 403) {
    return backendMessage || "Only workspace admins can add members.";
  }

  if (status === 409) {
    return backendMessage || "This user is already a member of the workspace.";
  }

  return backendMessage || "Cannot search users right now.";
}

function normalizeWorkspaceRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();

  if (
    value.includes("admin") ||
    value.includes("manager") ||
    value.includes("owner")
  ) {
    return "admin";
  }

  if (value.includes("editor")) {
    return "editor";
  }

  return "viewer";
}

function normalizeIdentity(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function shortenPopupFileName(fileName, maxLength = 48) {
  const value = String(fileName || "Document");
  if (value.length <= maxLength) return value;

  const extensionIndex = value.lastIndexOf(".");
  const extension = extensionIndex > 0 ? value.slice(extensionIndex) : "";
  const availableNameLength = Math.max(12, maxLength - extension.length - 3);
  return `${value.slice(0, availableNameLength)}...${extension}`;
}



function getStoredUserProfile() {
  return getAuthStoredUser();
}

function getStoredUserId(user) {
  return (
    user?.id ||
    user?._id ||
    user?.userId ||
    user?.user_id ||
    user?.profile?.id ||
    user?.user?.id ||
    user?.data?.id ||
    ""
  );
}

function getWorkspaceMemberRole(member) {
  return (
    member?.role ||
    member?.workspaceRole ||
    member?.workspace_role ||
    member?.permission ||
    member?.memberRole ||
    member?.pivot?.role ||
    ""
  );
}

function getWorkspaceMemberIdentities(member) {
  return [
    member?.email,
    member?.username,
    member?.full_name,
    member?.fullName,
    member?.name,
    member?.displayName,
    member?.user?.email,
    member?.user?.username,
    member?.user?.full_name,
    member?.user?.fullName,
    member?.user?.name,
    member?.user?.displayName,
  ]
    .map(normalizeIdentity)
    .filter(Boolean);
}

function formatWorkspaceMessageTime(createdAt) {
  if (!createdAt) return "";

  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWorkspaceStudyDate(createdAt) {
  if (!createdAt) return "Recently updated";

  return `Updated ${new Date(createdAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })}`;
}

function formatWorkspaceFileSize(bytes) {
  const value = Number(bytes) || 0;

  if (value <= 0) return "0 KB";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getWorkspaceRoleLabel(role) {
  return ["viewer", "editor"].includes(String(role || "").toLowerCase())
    ? "Contributor"
    : role;
}



function normalizeWorkspaceDocumentTitle(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase();
}

function buildWorkspaceUploadCandidates(files, documents) {
  const seenFileNames = new Set();
  const duplicateBatchFileNames = [];
  const uniqueFiles = [];

  (files || []).forEach((file) => {
    const normalizedName = normalizeWorkspaceDocumentTitle(file?.name);

    if (seenFileNames.has(normalizedName)) {
      duplicateBatchFileNames.push(file?.name || "Unnamed file");
      return;
    }

    seenFileNames.add(normalizedName);
    uniqueFiles.push(file);
  });

  const replaceableDocuments = (documents || []).filter((document) => {
    const documentLibraryId =
      document?.libraryId ?? document?.library_id ?? null;

    return documentLibraryId === null || documentLibraryId === "";
  });

  return {
    duplicateBatchFileNames,
    candidates: uniqueFiles.map((file) => ({
      file,
      existingDocument: replaceableDocuments.find(
        (document) =>
          normalizeWorkspaceDocumentTitle(document?.title) ===
          normalizeWorkspaceDocumentTitle(file?.name),
      ),
    })),
  };
}

function getDocumentStatusLabel(status) {
  const value = String(status || "PENDING").toUpperCase();

  if (value === "APPROVED") return "Approved";
  if (value === "FLAGGED") return "Flagged";
  if (value === "REJECTED") return "Rejected";
  if (value === "DELETED") return "Deleted";
  if (value === "PENDING_RETRY") return "Waiting for review";

  return "Waiting approval";
}

function formatStudySessionDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildWorkspaceStudySets(flashcards) {
  const groupedCards = new Map();

  (flashcards || []).forEach((card) => {
    const groupId = card.documentId || "workspace-flashcards";
    const currentGroup = groupedCards.get(groupId) || {
      id: groupId,
      title: card.documentTitle || "Workspace flashcards",
      subtitle: card.documentTitle
        ? `Generated from ${card.documentTitle}`
        : "Generated workspace study cards",
      tag: card.documentStatus === "APPROVED" ? "Ready" : "",
      updatedAt: card.createdAt,
      cards: [],
    };

    currentGroup.cards.push({
      id: card.id,
      question: card.question,
      answer: card.answer,
    });

    if (
      card.createdAt &&
      (!currentGroup.updatedAt ||
        new Date(card.createdAt) > new Date(currentGroup.updatedAt))
    ) {
      currentGroup.updatedAt = card.createdAt;
    }

    groupedCards.set(groupId, currentGroup);
  });

  return Array.from(groupedCards.values()).map((studySet) => ({
    ...studySet,
    meta: `${studySet.cards.length} ${
      studySet.cards.length === 1 ? "Card" : "Cards"
    } · ${formatWorkspaceStudyDate(studySet.updatedAt)}`,
  }));
}

function WorkSpacePage() {
  const WORKSPACE_NAME_MAX_LENGTH = 20;


  const { workspaceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    popup: actionPopup,
    showConfirm,
    showAlert,
    resolvePopup: resolveActionPopup,
  } = useActionPopup();
  const requestedWorkspaceTab = location.state?.workspaceTab;
  const [activeTab, setActiveTab] = useState(
    ["messages", "documents", "study", "members", "settings"].includes(
      requestedWorkspaceTab,
    )
      ? requestedWorkspaceTab
      : "messages",
  );
  const [isLeaveBlockedModalOpen, setIsLeaveBlockedModalOpen] =
    useState(false);
  const [isDeleteWorkspaceModalOpen, setIsDeleteWorkspaceModalOpen] =
    useState(false);
  const [isSoleAdminLeaving, setIsSoleAdminLeaving] = useState(false);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [deleteWorkspaceError, setDeleteWorkspaceError] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [inviteStatus, setInviteStatus] = useState("idle");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [isInviteSearching, setIsInviteSearching] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [backendMembers, setBackendMembers] = useState([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [memberActionStatus, setMemberActionStatus] = useState("");
  const [memberActionId, setMemberActionId] = useState("");
  const [openRoleMenuId, setOpenRoleMenuId] = useState("");
  const [isTransferAdminMenuOpen, setIsTransferAdminMenuOpen] =
    useState(false);
  const [transferAdminTargetId, setTransferAdminTargetId] = useState("");
  const [roleAfterAdminTransfer, setRoleAfterAdminTransfer] =
    useState("Viewer");
  const [pendingAdminTransfer, setPendingAdminTransfer] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [candidateUsers, setCandidateUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [activeMemberProfileId, setActiveMemberProfileId] = useState("");

  useEffect(() => {
    if (!isLeaveBlockedModalOpen && !isDeleteWorkspaceModalOpen) {
      return undefined;
    }

    const handlePopupKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsLeaveBlockedModalOpen(false);
        if (!isDeletingWorkspace) {
          setIsDeleteWorkspaceModalOpen(false);
          setDeleteWorkspaceError("");
        }
      }
    };

    document.addEventListener("keydown", handlePopupKeyDown);
    return () => document.removeEventListener("keydown", handlePopupKeyDown);
  }, [isDeleteWorkspaceModalOpen, isDeletingWorkspace, isLeaveBlockedModalOpen]);

  useEffect(() => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("aiStudyHubPendingInvitations")) {
          localStorage.removeItem(key);
        }
      });
    } catch (err) {
      console.error("Could not clean pending invitation keys:", err);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!activeMemberProfileId) return;

    function closeActiveMemberProfile() {
      setActiveMemberProfileId("");
    }

    document.addEventListener("click", closeActiveMemberProfile);

    return () => {
      document.removeEventListener("click", closeActiveMemberProfile);
    };
  }, [activeMemberProfileId]);

  function handleViewMemberProfile(profileId) {
    if (!profileId) return;
    navigate(`/dashboard/profile/${profileId}`);
  }

  function handleToggleMemberProfile(event, profileId) {
    event.stopPropagation();
    if (!profileId) return;

    setActiveMemberProfileId((currentId) =>
      currentId === profileId ? "" : profileId,
    );
  }

  function handleWorkspaceNameChange(e) {
    const nextValue = e.target.value;

    if (nextValue.length > WORKSPACE_NAME_MAX_LENGTH) return;

    setWorkspaceNameInput(nextValue);

    if (nextValue.length === WORKSPACE_NAME_MAX_LENGTH) {
      setWorkspaceSettingMessage(
        `Workspace name has reached the limit of ${WORKSPACE_NAME_MAX_LENGTH} characters.`,
      );
      return;
    }

    setWorkspaceSettingMessage("");
  }
  const [messageText, setMessageText] = useState("");
  const [messageStatus, setMessageStatus] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [workspaceFlashcards, setWorkspaceFlashcards] = useState([]);
  const [workspaceDocuments, setWorkspaceDocuments] = useState([]);
  const [workspaceFileView, setWorkspaceFileView] = useState("documents");
  const [workspaceUploadFiles, setWorkspaceUploadFiles] = useState([]);
  const [workspaceReplacementDocumentIds, setWorkspaceReplacementDocumentIds] =
    useState([]);
  const [workspaceDocumentStatus, setWorkspaceDocumentStatus] = useState("");
  const [isUploadingWorkspaceDocuments, setIsUploadingWorkspaceDocuments] =
    useState(false);
  const [selectedStudyDocumentId, setSelectedStudyDocumentId] = useState("");
  const [isStudyDocumentMenuOpen, setIsStudyDocumentMenuOpen] = useState(false);
  const studyDocumentPickerRef = useRef(null);
  const [isLoadingStudySets, setIsLoadingStudySets] = useState(false);
  const [isGeneratingStudyCards, setIsGeneratingStudyCards] = useState(false);
  const [studySetStatus, setStudySetStatus] = useState("");
  const [selectedStudySetId, setSelectedStudySetId] = useState("");
  const [currentStudyCardIndex, setCurrentStudyCardIndex] = useState(0);
  const [isStudyCardFlipped, setIsStudyCardFlipped] = useState(false);
  const [studySessionSeconds, setStudySessionSeconds] = useState(0);
  const [reviewedStudyCardIds, setReviewedStudyCardIds] = useState([]);
  const [isStudySessionComplete, setIsStudySessionComplete] = useState(false);

  const [workspace, setWorkspace] = useState(() => {
    return location.state?.workspace || null;
  });

  useEffect(() => {
    if (!workspaceId) return;

    let isMounted = true;

    if (!workspace || workspace.id !== workspaceId) {
      getWorkspace(workspaceId)
        .then((data) => {
          if (isMounted) {
            setWorkspace(data);
          }
        })
        .catch((err) => console.error("Cannot load workspace:", err));
    }

    getWorkspaceMembers(workspaceId)
      .then((members) => {
        if (isMounted) {
          setBackendMembers(members || []);
        }
      })
      .catch((error) => {
        console.error("Cannot load workspace members:", error);
      });

    return () => {
      isMounted = false;
    };
  }, [workspaceId, workspace]);

  const [workspaceNameInput, setWorkspaceNameInput] = useState(
    workspace?.name || "",
  );
  const [workspaceSettingMessage, setWorkspaceSettingMessage] = useState("");

  const storedUser = useMemo(() => getStoredUserProfile(), []);
  const currentUserId = String(getStoredUserId(storedUser) || "");
  const profileName =
    workspace?.owner ||
    storedUser?.displayName ||
    storedUser?.fullName ||
    storedUser?.full_name ||
    storedUser?.name ||
    storedUser?.username ||
    "Current user";

  const loadWorkspaceMembers = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const members = await getWorkspaceMembers(workspaceId);
      setBackendMembers(members || []);
    } catch (error) {
      console.error("Cannot load workspace members:", error);
      setMemberActionStatus(
        error.response?.data?.message || "Could not load workspace members.",
      );
    }
  }, [workspaceId]);

  const currentUserIdentifiers = useMemo(
    () =>
      [
        profileName,
        storedUser?.email,
        storedUser?.username,
        storedUser?.full_name,
        storedUser?.fullName,
        storedUser?.name,
        storedUser?.displayName,
        storedUser?.user?.email,
        storedUser?.user?.username,
        storedUser?.user?.full_name,
        storedUser?.user?.fullName,
        storedUser?.user?.name,
        storedUser?.user?.displayName,
      ]
        .map(normalizeIdentity)
        .filter(Boolean),
    [profileName, storedUser],
  );

  const currentWorkspaceMember = useMemo(
    () =>
      backendMembers.find((member) =>
        getWorkspaceMemberIdentities(member).some((identity) =>
          currentUserIdentifiers.includes(identity),
        ),
      ),
    [backendMembers, currentUserIdentifiers],
  );

  const isWorkspaceOwner = useMemo(() => {
    const workspaceOwnerIdentifiers = [
      workspace?.owner,
      workspace?.ownerName,
      workspace?.ownerEmail,
      workspace?.createdBy,
      workspace?.creator,
      workspace?.user?.email,
      workspace?.user?.username,
    ]
      .map(normalizeIdentity)
      .filter(Boolean);

    return workspaceOwnerIdentifiers.some((identity) =>
      currentUserIdentifiers.includes(identity),
    );
  }, [currentUserIdentifiers, workspace]);

  const currentWorkspaceRole = normalizeWorkspaceRole(
    workspace?.myRole ||
      getWorkspaceMemberRole(currentWorkspaceMember) ||
      workspace?.currentUserRole ||
      workspace?.role ||
      workspace?.memberRole ||
      (isWorkspaceOwner || backendMembers.length === 0 ? "Admin" : "Viewer"),
  );

  const canManageTopics = currentWorkspaceRole === "admin" || isWorkspaceOwner;
  const canManageWorkspace = currentWorkspaceRole === "admin" || isWorkspaceOwner;
  const normalizedMemberSearch = normalizeIdentity(memberSearchQuery);

  const [chatMessages, setChatMessages] = useState([]);

  const visibleWorkspaceMembers = useMemo(() => {
    const members = backendMembers.map((member) => ({
      id: member.user?.id,
      profileId: member.user?.id,
      name:
        member.user?.full_name || member.user?.username || "Workspace member",
      email: member.user?.email || member.user?.username || "",
      role: member.role || "Viewer",
      joinDate: member.joined_at
        ? new Date(member.joined_at).toLocaleDateString()
        : "Recently",
      avatar: "",
      isOnline: false,
    }));

    if (!normalizedMemberSearch) return members;

    return members.filter((member) =>
      [member.name, member.email, member.role]
        .join(" ")
        .toLowerCase()
        .includes(normalizedMemberSearch),
    );
  }, [backendMembers, normalizedMemberSearch]);

  useEffect(() => {
    if (!workspace?.name) return;
    setWorkspaceNameInput(workspace.name);
  }, [workspace?.name]);



  useEffect(() => {
    if (!workspaceId) return;

    let isMounted = true;

    async function loadWorkspaceMessages() {
      try {
        setIsLoadingMessages(true);
        setMessageStatus("");
        const messages = await getWorkspaceMessages(workspaceId);

        if (!isMounted) return;

        setChatMessages(
          (messages || []).map((message) => {
            const senderMatchesCurrentUser = [
              message.senderEmail,
              message.senderName,
            ]
              .map(normalizeIdentity)
              .some(
                (identity) =>
                  identity && currentUserIdentifiers.includes(identity),
              );

            return {
              id: message.id,
              senderName: message.senderName,
              text: message.text,
              time: formatWorkspaceMessageTime(message.createdAt),
              isOwn:
                (currentUserId && String(message.senderId) === currentUserId) ||
                senderMatchesCurrentUser,
              avatar: message.senderAvatar || "",
              file: null,
            };
          }),
        );
      } catch (error) {
        console.error("Cannot load workspace messages:", error);
        if (isMounted) {
          setMessageStatus(
            error.response?.data?.message ||
              "Could not load workspace messages.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingMessages(false);
        }
      }
    }

    loadWorkspaceMessages();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, currentUserIdentifiers, workspaceId]);

  const studySets = useMemo(
    () => buildWorkspaceStudySets(workspaceFlashcards),
    [workspaceFlashcards],
  );

  const approvedWorkspaceDocuments = useMemo(
    () =>
      workspaceDocuments.filter(
        (document) =>
          String(document.status || "").toUpperCase() === "APPROVED",
      ),
    [workspaceDocuments],
  );
  const waitingWorkspaceDocuments = useMemo(
    () =>
      workspaceDocuments.filter((document) =>
        ["PENDING", "PENDING_RETRY", "FLAGGED"].includes(
          String(document.status || "PENDING").toUpperCase(),
        ),
      ),
    [workspaceDocuments],
  );
  const selectedStudyDocument = approvedWorkspaceDocuments.find(
    (document) => String(document.id) === String(selectedStudyDocumentId),
  );

  const loadWorkspaceDocuments = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const documents = await getWorkspaceDocuments(workspaceId);
      setWorkspaceDocuments(documents || []);
    } catch (error) {
      console.error("Cannot load workspace documents:", error);
      setWorkspaceDocumentStatus(
        error.response?.data?.message || "Could not load workspace documents.",
      );
      setWorkspaceDocuments([]);
    }
  }, [workspaceId]);

  const loadWorkspaceFlashcards = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoadingStudySets(true);
    setStudySetStatus("");

    try {
      const cards = await getWorkspaceFlashcards(workspaceId);
      setWorkspaceFlashcards(cards || []);
    } catch (error) {
      console.error("Cannot load workspace flashcards:", error);
      setStudySetStatus(
        error.response?.data?.message || "Could not load workspace flashcards.",
      );
      setWorkspaceFlashcards([]);
    } finally {
      setIsLoadingStudySets(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadWorkspaceDocuments();
  }, [loadWorkspaceDocuments]);

  useEffect(() => {
    loadWorkspaceFlashcards();
  }, [loadWorkspaceFlashcards]);

  useEffect(() => {
    if (approvedWorkspaceDocuments.length === 0) {
      setSelectedStudyDocumentId("");
      return;
    }

    if (
      !approvedWorkspaceDocuments.some(
        (document) => document.id === selectedStudyDocumentId,
      )
    ) {
      setSelectedStudyDocumentId(approvedWorkspaceDocuments[0].id);
    }
  }, [approvedWorkspaceDocuments, selectedStudyDocumentId]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!studyDocumentPickerRef.current?.contains(event.target)) {
        setIsStudyDocumentMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setIsStudyDocumentMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (studySets.length === 0) {
      setSelectedStudySetId("");
      setCurrentStudyCardIndex(0);
      setIsStudyCardFlipped(false);
      setReviewedStudyCardIds([]);
      setStudySessionSeconds(0);
      setIsStudySessionComplete(false);
      return;
    }

    if (
      selectedStudySetId &&
      !studySets.some((studySet) => studySet.id === selectedStudySetId)
    ) {
      setSelectedStudySetId("");
      setCurrentStudyCardIndex(0);
      setIsStudyCardFlipped(false);
      setReviewedStudyCardIds([]);
      setStudySessionSeconds(0);
      setIsStudySessionComplete(false);
    }
  }, [selectedStudySetId, studySets]);

  useEffect(() => {
    if (
      activeTab !== "study" ||
      !selectedStudySetId ||
      isStudySessionComplete
    ) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setStudySessionSeconds((currentSeconds) => currentSeconds + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [activeTab, isStudySessionComplete, selectedStudySetId]);

  const selectedStudySet =
    studySets.find((studySet) => studySet.id === selectedStudySetId) || null;
  const currentStudyCard =
    selectedStudySet?.cards[currentStudyCardIndex] ||
    selectedStudySet?.cards[0] ||
    null;

  useEffect(() => {
    if (activeTab !== "study" || !currentStudyCard?.id) return;

    setReviewedStudyCardIds((currentIds) =>
      currentIds.includes(currentStudyCard.id)
        ? currentIds
        : [...currentIds, currentStudyCard.id],
    );
  }, [activeTab, currentStudyCard?.id]);



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



  /*
  const sampleStudySets = [
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
          question:
            "What does high availability mean in software architecture?",
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
  */

  function getCurrentMessageTime() {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function requireWorkspaceAdminPermission(actionLabel) {
    if (canManageWorkspace) return true;

    showAlert(`Only workspace admins can ${actionLabel}.`);
    return false;
  }


  async function resolveWorkspaceUploadSelection(files) {
    const { candidates, duplicateBatchFileNames } =
      buildWorkspaceUploadCandidates(files, workspaceDocuments);

    if (duplicateBatchFileNames.length > 0) {
      showAlert(
        `These files were selected more than once and will only be uploaded once:\n- ${duplicateBatchFileNames.join(
          "\n- ",
        )}`,
      );
    }

  const acceptedFiles = [];
  const replacementDocumentIds = [];
  const keptExistingFileNames = [];

  for (const { file, existingDocument } of candidates) {
    if (!existingDocument) {
      acceptedFiles.push(file);
      replacementDocumentIds.push(null);
      continue;
    }

    const existingUploaderId = String(
      existingDocument.uploaderId || existingDocument.uploader_id || "",
    );
    const canReplaceExistingDocument =
      canManageWorkspace ||
      (currentUserId && existingUploaderId === currentUserId);

    if (!canReplaceExistingDocument) {
      showAlert(
        `"${shortenPopupFileName(file.name)}" has already been uploaded to this workspace by ${
          existingDocument.uploaderName || "another member"
        }. Only the original uploader or a workspace admin can replace it.`,
      );
      keptExistingFileNames.push(file.name);
      continue;
    }

    const shouldReplace = await showConfirm(
      `"${shortenPopupFileName(file.name)}" has already been uploaded to this workspace.\n\nSelect OK to replace the existing document, or Cancel to keep the current version.`,
      {
        title: "Replace existing document?",
        confirmText: "Replace document",
        cancelText: "Keep current",
      },
    );

    if (!shouldReplace) {
      keptExistingFileNames.push(file.name);
      continue;
    }

    acceptedFiles.push(file);
    replacementDocumentIds.push(String(existingDocument.id));
  }

  return {
    acceptedFiles,
    replacementDocumentIds,
    keptExistingFileNames,
  };
}

async function uploadWorkspaceFilesWithDuplicateConfirmation(
  files,
  initialReplacementDocumentIds = [],
) {
  let replacementDocumentIds = [...initialReplacementDocumentIds];

  const submitUpload = (replacementIds) =>
    uploadDocuments(files, workspaceId, null, [], null, replacementIds);

  try {
    const uploadedDocuments = await submitUpload(replacementDocumentIds);
    return { uploadedDocuments, replacementDocumentIds, cancelled: false };
  } catch (uploadError) {
    const duplicateData = uploadError.response?.data;

    if (duplicateData?.code !== "DUPLICATE_DOCUMENT") {
      throw uploadError;
    }

    const duplicateDocuments = Array.isArray(duplicateData.duplicates)
      ? duplicateData.duplicates
      : [];
    const duplicateInBatch = duplicateDocuments.find(
      (duplicate) => !duplicate.documentId,
    );

    if (duplicateInBatch) {
      showAlert(
        `"${duplicateInBatch.fileName}" was selected more than once. Remove the duplicate selection and try again.`,
      );
      return {
        uploadedDocuments: [],
        replacementDocumentIds,
        cancelled: true,
        reason: "duplicate-batch",
      };
    }

    const forbiddenReplacement = duplicateDocuments.find(
      (duplicate) => duplicate.canReplace === false,
    );

    if (forbiddenReplacement) {
      showAlert(
        `"${shortenPopupFileName(forbiddenReplacement.fileName)}" has already been uploaded by another workspace member. Only the original uploader or a workspace admin can replace it.`,
      );
      return {
        uploadedDocuments: [],
        replacementDocumentIds,
        cancelled: true,
        reason: "replacement-forbidden",
      };
    }

    const duplicateNames = duplicateDocuments
      .map((duplicate) => shortenPopupFileName(duplicate.fileName))
      .filter(Boolean);
    const shouldReplace = await showConfirm(
      `${duplicateNames.join(", ")} ${
        duplicateNames.length === 1 ? "has" : "have"
      } already been uploaded to this workspace.\n\nSelect OK to replace the existing ${
        duplicateNames.length === 1 ? "document" : "documents"
      }, or Cancel to keep the current version.`,
    );

    if (!shouldReplace) {
      return {
        uploadedDocuments: [],
        replacementDocumentIds,
        cancelled: true,
        reason: "kept-existing",
      };
    }

    replacementDocumentIds = files.map((_, fileIndex) => {
      const duplicate = duplicateDocuments.find(
        (item) => Number(item.fileIndex) === fileIndex,
      );

      return duplicate?.documentId || replacementDocumentIds[fileIndex] || null;
    });

    const uploadedDocuments = await submitUpload(replacementDocumentIds);
    return { uploadedDocuments, replacementDocumentIds, cancelled: false };
  }
}

function handleOpenInviteModal() {
  if (!requireWorkspaceAdminPermission("manage workspace members")) return;

  setInviteSuccess("");
  setIsInviteModalOpen(true);
}

function handleCloseInviteModal() {
  setIsInviteModalOpen(false);
  setInviteQuery("");
  setInviteRole("Viewer");
  setInviteStatus("idle");
  setCandidateUsers([]);
  setSelectedUserId("");
  setInviteError("");
  setIsInviteSearching(false);
  setIsAddingMember(false);
}

function handleInviteQueryChange(e) {
  setInviteQuery(e.target.value);
  setInviteStatus("idle");
  setCandidateUsers([]);
  setSelectedUserId("");
  setInviteError("");
}

async function handleSearchInviteMember() {
  if (!requireWorkspaceAdminPermission("search and invite workspace members")) {
    return;
  }

  const query = inviteQuery.trim().replace(/^@+/, "");

  if (query.length < 2) {
    setInviteError("Enter at least 2 characters to search.");
    return;
  }

  try {
    setIsInviteSearching(true);
    setInviteError("");
    const users = await searchWorkspaceUsers(workspaceId, query);
    const firstAvailableUser = users?.find((user) => !user.isWorkspaceMember);

    setCandidateUsers(users || []);
    setSelectedUserId(firstAvailableUser?.id || "");
    setInviteStatus(users?.length ? "found" : "not-found");
  } catch (error) {
    console.error("Cannot search workspace users:", error);
    setCandidateUsers([]);
    setSelectedUserId("");
    setInviteStatus("error");
    setInviteError(getInviteErrorMessage(error));
  } finally {
    setIsInviteSearching(false);
  }
}

async function handleSendInvite() {
  if (!requireWorkspaceAdminPermission("add workspace members")) return;

  if (inviteStatus !== "found" || !selectedUserId) return;

  try {
    setIsAddingMember(true);
    setInviteError("");
    const invitedUser = candidateUsers.find(
      (user) => user.id === selectedUserId,
    );
    await addWorkspaceMember(workspaceId, {
      userId: selectedUserId,
      role: inviteRole,
    });

    const invitedName =
      invitedUser?.full_name ||
      invitedUser?.username ||
      invitedUser?.email ||
      "new member";
    const invitedEmail =
      invitedUser?.email || invitedUser?.username || invitedName;

    setPendingInvitations((currentInvitations) => {
      const nextInvitation = {
        userId: selectedUserId,
        email: invitedEmail,
        name: invitedName,
        role: inviteRole,
        invitedBy: profileName,
        time: "just now",
        createdAtMs: Date.now(),
      };

      return [
        nextInvitation,
        ...currentInvitations.filter(
          (invitation) => invitation.userId !== selectedUserId,
        ),
      ];
    });
    handleCloseInviteModal();
    await loadWorkspaceMembers();
    setInviteSuccess(`Workspace invitation sent to ${invitedName}.`);
  } catch (error) {
    console.error("Cannot add workspace member:", error);
    setInviteError(getInviteErrorMessage(error));
  } finally {
    setIsAddingMember(false);
  }
}

async function handleUpdateMemberRole(userId, nextRole) {
  if (!userId || !nextRole) return;

  try {
    setOpenRoleMenuId("");
    setMemberActionId(userId);
    setMemberActionStatus("");

    await updateWorkspaceMemberRole(workspaceId, userId, {
      role: nextRole,
    });
    await loadWorkspaceMembers();

    setMemberActionStatus(`Member role updated to ${nextRole}.`);
  } catch (error) {
    console.error("Cannot update workspace member role:", error);
    setMemberActionStatus(
      error.response?.data?.message || "Could not update member role.",
    );
  } finally {
    setMemberActionId("");
  }
}

async function handleTransferAdminOwnership(
  targetUserId,
  targetUserName,
  nextCurrentUserRole = "Viewer",
) {
  if (!targetUserId) return;

  const nextRoleLabel = getWorkspaceRoleLabel(nextCurrentUserRole);

  const isConfirmed = await showConfirm(
    `Are you sure you want to transfer Admin ownership to ${targetUserName || "this member"}? Your role will become ${nextRoleLabel}.`
  );
  if (!isConfirmed) return;

  try {
    setOpenRoleMenuId("");
    setMemberActionId(targetUserId);
    setMemberActionStatus("");

    const res = await transferAdminOwnership(
      workspaceId,
      targetUserId,
      nextCurrentUserRole,
    );
    await showAlert(
      res?.message || `Admin ownership transferred to ${targetUserName}.`,
      {
        title: "Admin ownership transferred",
        confirmText: "Got it",
      },
    );
    await loadWorkspaceMembers();
    setWorkspace(await getWorkspace(workspaceId));
  } catch (error) {
    console.error("Cannot transfer admin ownership:", error);
    showAlert(error.response?.data?.message || "Could not transfer admin ownership.");
  } finally {
    setMemberActionId("");
  }
}

async function handleRemoveWorkspaceMember(userId, memberName) {
  if (!userId) return;

  const isConfirmed = await showConfirm(
    `Remove ${memberName || "this member"} from the workspace?`,
  );

  if (!isConfirmed) return;

  try {
    setMemberActionId(userId);
    setMemberActionStatus("");

    await removeWorkspaceMember(workspaceId, userId);
    await loadWorkspaceMembers();

    setMemberActionStatus("Member removed from workspace.");
  } catch (error) {
    console.error("Cannot remove workspace member:", error);
    setMemberActionStatus(
      error.response?.data?.message || "Could not remove member.",
    );
  } finally {
    setMemberActionId("");
  }
}

function handleResendPendingInvitation(invitation) {
  if (!invitation) return;

  setPendingInvitations((currentInvitations) =>
    currentInvitations.map((item) =>
      (item.id || item.email) === (invitation.id || invitation.email)
        ? {
            ...item,
            time: "just now",
            resentAtMs: Date.now(),
          }
        : item,
    ),
  );

  setMemberActionStatus(
    `Resent invitation for ${invitation.name || invitation.email}.`,
  );
}

async function handleSendMessage() {
  const trimmedMessage = messageText.trim();

  if (trimmedMessage === "") return;

  try {
    setIsSendingMessage(true);
    setMessageStatus("");

    const savedMessage = await createWorkspaceMessage(workspaceId, {
      content: trimmedMessage,
    });

    const newMessage = {
      id: savedMessage.id,
      senderName: savedMessage.senderName || profileName,
      text: savedMessage.text,
      time: getCurrentMessageTime(),
      isOwn: true,
      file: null,
    };

    setChatMessages((currentMessages) => [...currentMessages, newMessage]);
    setMessageText("");
  } catch (error) {
    console.error("Cannot send workspace message:", error);
    setMessageStatus(
      error.response?.data?.message || "Could not send workspace message.",
    );
  } finally {
    setIsSendingMessage(false);
  }
}

function handleMessageKeyDown(e) {
  if (e.key !== "Enter" || e.shiftKey) return;

  e.preventDefault();
  handleSendMessage();
}

async function handleRenameWorkspace(e) {
  e.preventDefault();

  if (!requireWorkspaceAdminPermission("rename this workspace")) return;

  const rawName = workspaceNameInput;
  const trimmedName = rawName.trim();

  if (trimmedName === "") {
    setWorkspaceSettingMessage("Workspace name cannot be empty.");
    return;
  }

  if (rawName.length > WORKSPACE_NAME_MAX_LENGTH) {
    setWorkspaceSettingMessage(
      `Workspace name cannot exceed ${WORKSPACE_NAME_MAX_LENGTH} characters.`,
    );
    return;
  }

  try {
    await updateWorkspace(workspaceId, { name: trimmedName });
    setWorkspace((current) => ({ ...current, name: trimmedName }));
    setWorkspaceNameInput(trimmedName);
    setWorkspaceSettingMessage("Workspace name updated successfully.");
  } catch (err) {
    console.error("Failed to update workspace name:", err);
    setWorkspaceSettingMessage("Failed to update workspace name on server.");
  }
}

async function handleDeleteWorkspace() {
  if (!requireWorkspaceAdminPermission("delete this workspace")) return;

  setDeleteWorkspaceError("");
  setIsSoleAdminLeaving(false);
  setIsDeleteWorkspaceModalOpen(true);
}

async function handleConfirmDeleteWorkspace() {
  try {
    setIsDeletingWorkspace(true);
    setDeleteWorkspaceError("");
    await deleteWorkspace(workspaceId);
    setIsDeleteWorkspaceModalOpen(false);
    navigate("/dashboard/workspaces");
  } catch (err) {
    console.error("Failed to delete workspace:", err);
    setDeleteWorkspaceError(
      err.response?.data?.message || "Failed to delete workspace on server.",
    );
  } finally {
    setIsDeletingWorkspace(false);
  }
}

async function handleLeaveWorkspace() {
  if (canManageWorkspace) {
    if (backendMembers.length <= 1) {
      setDeleteWorkspaceError("");
      setIsSoleAdminLeaving(true);
      setIsDeleteWorkspaceModalOpen(true);
    } else {
      setIsLeaveBlockedModalOpen(true);
    }
    return;
  }

  const isConfirmed = await showConfirm(
    "Are you sure you want to leave this workspace?",
  );

  if (!isConfirmed) return;

  try {
    const res = await leaveWorkspace(workspaceId);
    showAlert(res?.message || "Successfully left the workspace.");
    navigate("/dashboard/workspaces");
  } catch (err) {
    console.error("Failed to leave workspace:", err);
    showAlert(err.response?.data?.message || "Could not leave the workspace.");
  }
}

function handleSelectStudySet(studySetId) {
  setSelectedStudySetId(studySetId);
  setCurrentStudyCardIndex(0);
  setIsStudyCardFlipped(false);
  setReviewedStudyCardIds([]);
  setStudySessionSeconds(0);
  setIsStudySessionComplete(false);
}

function handleRestartStudySession() {
  setCurrentStudyCardIndex(0);
  setIsStudyCardFlipped(false);
  setReviewedStudyCardIds([]);
  setStudySessionSeconds(0);
  setIsStudySessionComplete(false);
}

async function handleGenerateWorkspaceFlashcards() {
  if (!selectedStudyDocumentId || isGeneratingStudyCards) return;

  try {
    setIsGeneratingStudyCards(true);
    setStudySetStatus("Generating flashcards from the selected document...");

    const generatedCards = await generateWorkspaceDocumentFlashcards(
      selectedStudyDocumentId,
    );

    await loadWorkspaceFlashcards();

    setStudySetStatus(
      `${generatedCards?.length || 0} flashcards generated successfully.`,
    );
  } catch (error) {
    console.error("Cannot generate workspace flashcards:", error);
    setStudySetStatus(
      error.response?.data?.message ||
        "Could not generate flashcards for this document.",
    );
  } finally {
    setIsGeneratingStudyCards(false);
  }
}

async function handleWorkspaceDocumentFileChange(event) {
  const selectedFiles = Array.from(event.target.files || []);
  const { acceptedFiles, replacementDocumentIds, keptExistingFileNames } =
    await resolveWorkspaceUploadSelection(selectedFiles);

  setWorkspaceUploadFiles(acceptedFiles);
  setWorkspaceReplacementDocumentIds(replacementDocumentIds);

  if (keptExistingFileNames.length > 0) {
    setWorkspaceDocumentStatus(
      `${keptExistingFileNames.length} existing ${
        keptExistingFileNames.length === 1 ? "document was" : "documents were"
      } kept and will not be uploaded again.`,
    );
  } else if (replacementDocumentIds.some(Boolean)) {
    setWorkspaceDocumentStatus(
      "The selected duplicate will replace the existing document when you upload.",
    );
  } else {
    setWorkspaceDocumentStatus("");
  }

  event.target.value = "";
}

async function handleUploadWorkspaceDocuments() {
  if (workspaceUploadFiles.length === 0 || isUploadingWorkspaceDocuments) {
    return;
  }

  try {
    setIsUploadingWorkspaceDocuments(true);
    setWorkspaceDocumentStatus("Uploading workspace documents...");

    const uploadResult = await uploadWorkspaceFilesWithDuplicateConfirmation(
      workspaceUploadFiles,
      workspaceReplacementDocumentIds,
    );

    if (uploadResult.cancelled) {
      setWorkspaceUploadFiles([]);
      setWorkspaceReplacementDocumentIds([]);
      setWorkspaceDocumentStatus(
        uploadResult.reason === "kept-existing"
          ? "The existing document was kept and no duplicate was uploaded."
          : "Duplicate files were not uploaded.",
      );
      return;
    }

    const uploadedDocuments = Array.isArray(uploadResult.uploadedDocuments)
      ? uploadResult.uploadedDocuments.map((document) => ({
          ...document,
          status: document.status || "PENDING",
          uploaderName: document.uploaderName || profileName,
          createdAt:
            document.createdAt ||
            document.created_at ||
            new Date().toISOString(),
        }))
      : [];
    const replacedDocumentIds = new Set([
      ...uploadResult.replacementDocumentIds.filter(Boolean).map(String),
      ...(uploadedDocuments || []).flatMap((document) =>
        Array.isArray(document.replaced_document_ids)
          ? document.replaced_document_ids.map(String)
          : [],
      ),
    ]);

    // Show newly uploaded files immediately while the server performs its
    // moderation work and the workspace list catches up.
    setWorkspaceDocuments((currentDocuments) => {
      const uploadedIds = new Set(
        uploadedDocuments.map((document) => String(document.id)),
      );
      const retainedDocuments = currentDocuments.filter(
        (document) =>
          !replacedDocumentIds.has(String(document.id)) &&
          !uploadedIds.has(String(document.id)),
      );

      return [...uploadedDocuments, ...retainedDocuments];
    });

    setWorkspaceUploadFiles([]);
    setWorkspaceReplacementDocumentIds([]);
    await loadWorkspaceDocuments();

    // A background moderation transaction can make the list endpoint lag
    // briefly. Keep any just-uploaded entry visible until the next refresh.
    setWorkspaceDocuments((currentDocuments) => {
      const currentIds = new Set(
        currentDocuments.map((document) => String(document.id)),
      );
      const missingUploads = uploadedDocuments.filter(
        (document) => !currentIds.has(String(document.id)),
      );

      return [...missingUploads, ...currentDocuments];
    });

    const hasFlagged = (uploadedDocuments || []).some(
      (document) => document.status === "FLAGGED",
    );

    setWorkspaceDocumentStatus(
      replacedDocumentIds.size > 0
        ? `${replacedDocumentIds.size} existing ${
            replacedDocumentIds.size === 1 ? "document was" : "documents were"
          } replaced successfully.`
        : hasFlagged
          ? "Upload completed. Some documents were flagged for review."
          : "Workspace documents uploaded and waiting for workspace admin review.",
    );
  } catch (error) {
    console.error("Workspace document upload failed:", error);
    setWorkspaceDocumentStatus(
      error.response?.data?.message ||
        error.response?.data?.error ||
        "Could not upload workspace documents.",
    );
  } finally {
    setIsUploadingWorkspaceDocuments(false);
  }
}

async function handleReviewWorkspaceDocument(documentId, decision) {
  if (!canManageWorkspace) {
    setWorkspaceDocumentStatus(
      "Only workspace admins can review workspace documents.",
    );
    return;
  }

  try {
    const updatedDocument = await reviewWorkspaceDocument(
      workspaceId,
      documentId,
      {
        decision,
        reason:
          decision === "APPROVE"
            ? "Approved by workspace admin."
            : "Rejected by workspace admin.",
      },
    );

    setWorkspaceDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === documentId ? updatedDocument : document,
      ),
    );
    await loadWorkspaceDocuments();

    setWorkspaceDocumentStatus(
      decision === "APPROVE"
        ? "Document approved for workspace study tools."
        : "Document rejected by workspace admin.",
    );
  } catch (error) {
    console.error("Workspace document review failed:", error);
    setWorkspaceDocumentStatus(
      error.response?.data?.message ||
        "Could not save workspace document review.",
    );
  }
}

function handlePreviousStudyCard() {
  if (!selectedStudySet?.cards?.length) return;

  setCurrentStudyCardIndex((currentIndex) =>
    currentIndex === 0 ? selectedStudySet.cards.length - 1 : currentIndex - 1,
  );
  setIsStudyCardFlipped(false);
}

function handleNextStudyCard() {
  if (!selectedStudySet?.cards?.length) return;

  if (currentStudyCardIndex === selectedStudySet.cards.length - 1) {
    setIsStudySessionComplete(true);
    setIsStudyCardFlipped(false);
    return;
  }

  setCurrentStudyCardIndex((currentIndex) => currentIndex + 1);
  setIsStudyCardFlipped(false);
}

function handleViewWorkspaceDocument(document) {
  if (!canManageTopics || !document?.id) return;

  navigate(`/dashboard/documents/${document.id}`, {
    state: {
      from: `/dashboard/workspaces/${workspaceId}`,
      fileName: document.title || "Workspace document",
      returnContext: "files",
    },
  });
}

async function handleDownloadWorkspaceDocument(workspaceDocument) {
  if (!workspaceDocument?.id) return;

  try {
    const downloadData = await downloadDocument(workspaceDocument.id);
    const downloadUrl = downloadData?.downloadUrl || downloadData?.viewUrl;

    if (!downloadUrl) {
      throw new Error("The download link could not be created.");
    }

    const downloadLink = window.document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = workspaceDocument.title || "workspace-document";
    downloadLink.rel = "noopener";
    window.document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  } catch (error) {
    console.error("Cannot download workspace document:", error);
    await showAlert(
      error.response?.data?.message ||
        error.message ||
        "Could not download this document.",
      { title: "Download failed", confirmText: "Close" },
    );
  }
}






function renderMessagesTab() {
  return (
    <section className="workspace_message_tab">
      <header className="workspace_message_header">
        <div>
          <h2>
            {workspaceNameInput || workspace.name || "Workspace Group Chat"}
          </h2>
          <p>
            <span></span>
            {backendMembers.length || 1} member
            {(backendMembers.length || 1) === 1 ? "" : "s"} in workspace
          </p>
        </div>

      </header>

      <div className="workspace_message_day">Today</div>

      <section className="workspace_message_body">
        {isLoadingMessages ? (
          <div className="workspace_message_empty">
            <i className="ti-reload"></i>
            <h3>Loading messages...</h3>
            <p>Please wait while this workspace conversation loads.</p>
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="workspace_message_empty">
            <i className="ti-comment-alt"></i>
            <h3>No messages yet</h3>
            <p>Start the first conversation in this workspace.</p>
          </div>
        ) : (
          chatMessages.map((message) => (
            <article
              className={`workspace_message_item ${message.isOwn ? "own" : ""}`}
              key={message.id}
            >
              {!message.isOwn && (
                <div
                  className="workspace_message_avatar"
                  aria-label={`${message.senderName} avatar`}
                >
                  <span aria-hidden="true">
                    {(message.senderName || "U").trim().charAt(0).toUpperCase()}
                  </span>
                  {message.avatar && (
                    <img
                      src={message.avatar}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                </div>
              )}

              <div className="workspace_message_content_area">
                <h3 className={message.isOwn ? "workspace_message_you" : ""}>
                  {message.isOwn ? "You" : message.senderName}
                </h3>

                {message.text && (
                  <div
                    className={`workspace_message_bubble ${
                      message.isOwn ? "sent" : "received"
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                {message.file && message.file.isImage && (
                  <div
                    className={`workspace_message_bubble image ${
                      message.isOwn ? "sent" : "received"
                    }`}
                  >
                    <img
                      src={message.file.previewUrl}
                      alt={message.file.name}
                    />
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
                  className={`workspace_message_time ${
                    message.isOwn ? "own" : ""
                  }`}
                >
                  {message.time} · {message.isOwn ? "Sent" : "Received"}
                </span>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="workspace_message_composer">
        <textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleMessageKeyDown}
          placeholder="Type your message here..."
          disabled={isSendingMessage}
        />

        <div className="workspace_message_composer_actions">
          <button
            type="button"
            className="workspace_message_send_btn"
            onClick={handleSendMessage}
            aria-label="Send message"
            disabled={isSendingMessage || messageText.trim() === ""}
          >
            <i className="ti-control-play"></i>
          </button>
        </div>
      </section>

      <p className="workspace_message_hint">
        {messageStatus || "Press Enter to send, Shift + Enter for new line"}
      </p>
    </section>
  );
}

function renderMembersTab() {
  const adminCount = visibleWorkspaceMembers.filter(
    (member) => member.role === "Admin",
  ).length;

  return (
    <section className="workspace_member_tab">
      <section className="workspace_member_main">
        <div className="workspace_member_top">
          <div>
            <h2>Workspace Members</h2>
            <p>
              {canManageWorkspace
                ? "Manage access and roles for this academic resource center."
                : "View members and roles in this academic resource center."}
            </p>
          </div>

          {canManageWorkspace && (
            <div className="workspace_member_actions">
              <div className="workspace_member_search">
                <i className="ti-search"></i>
                <input
                  type="text"
                  placeholder="Search members..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                />
              </div>

              <button type="button" onClick={handleOpenInviteModal}>
                <i className="ti-user"></i>
                Add Member
              </button>
            </div>
          )}
        </div>

        {inviteSuccess && (
          <div className="workspace_invite_success" role="status">
            <i className="ti-check-box"></i>
            <span>{inviteSuccess}</span>
            <button type="button" onClick={() => setInviteSuccess("")}>
              ×
            </button>
          </div>
        )}

        {memberActionStatus && (
          <div className="workspace_invite_success" role="status">
            <i className="ti-info-alt"></i>
            <span>{memberActionStatus}</span>
            <button type="button" onClick={() => setMemberActionStatus("")}>
              ×
            </button>
          </div>
        )}

        <div className="workspace_member_table">
          <div className="workspace_member_table_header">
            <span>Member</span>
            <span>Role</span>
            <span>Join Date</span>
            <span>Actions</span>
          </div>

          {visibleWorkspaceMembers.length === 0 ? (
            <div className="workspace_member_empty">
              <i className="ti-user"></i>
              <p>No members were returned for this workspace.</p>
            </div>
          ) : (
            visibleWorkspaceMembers.map((member) => {
              const canViewProfile = Boolean(member.profileId || member.id);
              const profileId = member.profileId || member.id;
              const isProfileOptionActive = activeMemberProfileId === profileId;
              const isCurrentUser = currentUserId
                ? String(member.id) === currentUserId
                : false;
              const isLastAdmin = member.role === "Admin" && adminCount <= 1;
              const isActionBusy = memberActionId === member.id;

              return (
                <article
                  className="workspace_member_row"
                  key={member.id || member.email || member.name}
                >
                  <div className="workspace_member_identity">
                    <div
                      className={`workspace_member_profile_trigger ${
                        canViewProfile ? "" : "is-disabled"
                      } ${isProfileOptionActive ? "is-active" : ""}`}
                      role={canViewProfile ? "button" : undefined}
                      tabIndex={canViewProfile ? 0 : undefined}
                      onClick={(event) =>
                        handleToggleMemberProfile(event, profileId)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleToggleMemberProfile(event, profileId);
                        }
                      }}
                    >
                      <div className="workspace_member_avatar">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} />
                        ) : (
                          <i className="ti-user"></i>
                        )}

                        {member.isOnline && <span></span>}
                      </div>

                      <div className="workspace_member_profile_text">
                        <strong>{member.name}</strong>
                        <p>{member.email}</p>
                      </div>

                      {canViewProfile && (
                        <button
                          type="button"
                          className="workspace_member_profile_option"
                          tabIndex={isProfileOptionActive ? 0 : -1}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleViewMemberProfile(profileId);
                          }}
                        >
                          <i className="ti-id-badge"></i>
                          View profile
                        </button>
                      )}
                    </div>
                  </div>

                  <span
                    className={`workspace_member_status ${
                      member.role === "Admin"
                        ? "manager"
                        : member.role === "Editor"
                          ? "editor"
                          : "member"
                    }`}
                  >
                    {getWorkspaceRoleLabel(member.role)}
                  </span>

                  <span className="workspace_member_join_date">
                    {member.joinDate}
                  </span>

                  {canManageWorkspace ? (
                    <div className="workspace_member_admin_actions">
                      {member.role !== "Admin" && (
                        <div
                          className="workspace_role_dropdown"
                          onBlur={(event) => {
                            if (
                              !event.currentTarget.contains(event.relatedTarget)
                            ) {
                              setOpenRoleMenuId("");
                            }
                          }}
                        >
                          <button
                            type="button"
                            className={`workspace_role_trigger role_${member.role.toLowerCase()}`}
                            disabled={isActionBusy}
                            aria-haspopup="listbox"
                            aria-expanded={openRoleMenuId === member.id}
                            aria-label={`Change role for ${member.name}`}
                            onClick={() =>
                              setOpenRoleMenuId((currentId) =>
                                currentId === member.id ? "" : member.id,
                              )
                            }
                          >
                            <span>{getWorkspaceRoleLabel(member.role)}</span>
                            <i className="ti-angle-down" aria-hidden="true"></i>
                          </button>

                          {openRoleMenuId === member.id && (
                            <div className="workspace_role_menu" role="listbox">
                              {["Admin", "Viewer"].map((role) => (
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={member.role === role}
                                  className={
                                    member.role === role ? "selected" : ""
                                  }
                                  key={role}
                                  onClick={() => {
                                    if (role === "Admin") {
                                      setOpenRoleMenuId("");
                                      setPendingAdminTransfer({
                                        id: member.id,
                                        name: member.name || member.username,
                                      });
                                    } else {
                                      handleUpdateMemberRole(member.id, role);
                                    }
                                  }}
                                >
                                  <span
                                    className={`workspace_role_dot role_${role.toLowerCase()}`}
                                  ></span>
                                  <span>
                                    {role === "Admin"
                                      ? "Transfer Admin"
                                      : getWorkspaceRoleLabel(role)}
                                  </span>
                                  {member.role === role && (
                                    <i
                                      className="ti-check"
                                      aria-hidden="true"
                                    ></i>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={isActionBusy || isCurrentUser || isLastAdmin}
                        onClick={() =>
                          handleRemoveWorkspaceMember(member.id, member.name)
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <span className="workspace_member_readonly_action">
                      View only
                    </span>
                  )}
                </article>
              );
            })
          )}
        </div>

        {canManageWorkspace && (
          <section className="workspace_pending_card">
            <div className="workspace_pending_header">
              <h3>Pending Invitations</h3>
              <span>
                <strong>{pendingInvitations.length}</strong> Pending
              </span>
            </div>

            <div className="workspace_pending_list">
              {pendingInvitations.length > 0 ? (
                pendingInvitations.map((invitation) => (
                  <article
                    className="workspace_pending_item"
                    key={invitation.id || invitation.email}
                  >
                    <div className="workspace_pending_mail_icon">
                      <i className="ti-email"></i>
                    </div>

                    <div className="workspace_pending_info">
                      <strong>{invitation.name || invitation.email}</strong>
                      <p>
                        Invited {invitation.time} by {invitation.invitedBy}
                        {invitation.role
                          ? ` as ${getWorkspaceRoleLabel(invitation.role)}`
                          : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleResendPendingInvitation(invitation)}
                    >
                      Resend
                    </button>
                  </article>
                ))
              ) : (
                <div className="workspace_pending_empty">
                  <i className="ti-check-box"></i>
                  <p>No pending invitations right now.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </section>

      <aside className="workspace_member_sidebar">
        <section className="workspace_side_card">
          <h3>About Roles</h3>
          <div className="workspace_role_item">
            <strong>Admin</strong>
            <p>
              Can manage workspace settings and members, review documents, and
              manage workspace files.
            </p>
          </div>

          <div className="workspace_role_item">
            <strong>Contributor</strong>
            <p>
              Can view workspace content and upload files.
            </p>
          </div>
        </section>
      </aside>
    </section>
  );
}

function renderStudyTab() {
  const hasStudyCards = Boolean(selectedStudySet && currentStudyCard);

  return (
    <section className="workspace_study_tab">
      <aside className="workspace_study_sidebar">
        <div className="workspace_study_sidebar_header">
          <h3>Flashcard Sets</h3>

          <button type="button" aria-label="Open flashcard library">
            <i className="ti-layout-grid2"></i>
          </button>
        </div>

        <button
          type="button"
          className="workspace_study_generate_btn"
          onClick={handleGenerateWorkspaceFlashcards}
          disabled={isGeneratingStudyCards || !selectedStudyDocumentId}
        >
          <i className="ti-plus"></i>
          {isGeneratingStudyCards ? "Generating..." : "Generate New"}
        </button>

        <div
          className={`workspace_study_document_picker ${
            isStudyDocumentMenuOpen ? "is-open" : ""
          }`}
          ref={studyDocumentPickerRef}
        >
          <span id="workspace-study-document-label">Approved document</span>
          <button
            type="button"
            className="workspace_study_document_trigger"
            aria-labelledby="workspace-study-document-label"
            aria-haspopup="listbox"
            aria-expanded={isStudyDocumentMenuOpen}
            disabled={
              isGeneratingStudyCards || approvedWorkspaceDocuments.length === 0
            }
            onClick={() => setIsStudyDocumentMenuOpen((current) => !current)}
          >
            <i className="ti-file"></i>
            <span title={selectedStudyDocument?.title || ""}>
              {selectedStudyDocument?.title || "No approved workspace documents"}
            </span>
            <i className="ti-angle-down"></i>
          </button>

          {isStudyDocumentMenuOpen && (
            <div className="workspace_study_document_options" role="listbox">
              {approvedWorkspaceDocuments.map((document) => {
                const isSelected =
                  String(document.id) === String(selectedStudyDocumentId);
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={isSelected ? "is-selected" : ""}
                    key={document.id}
                    onClick={() => {
                      setSelectedStudyDocumentId(document.id);
                      setIsStudyDocumentMenuOpen(false);
                    }}
                  >
                    <i className="ti-file"></i>
                    <span title={document.title}>{document.title}</span>
                    {isSelected && <i className="ti-check"></i>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="workspace_study_set_list">
          {isLoadingStudySets && (
            <p className="workspace_empty_text">Loading flashcards...</p>
          )}

          {!isLoadingStudySets && studySets.length === 0 && (
            <p className="workspace_empty_text">
              No generated flashcards found for this workspace.
            </p>
          )}

          {!isLoadingStudySets &&
            studySets.map((studySet) => (
              <button
                type="button"
                className={`workspace_study_set_card ${
                  selectedStudySetId === studySet.id ? "active" : ""
                }`}
                key={studySet.id}
                onClick={() => handleSelectStudySet(studySet.id)}
              >
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
            <strong>Flashcards</strong>
            <p>
              {studySetStatus ||
                `${workspaceFlashcards.length} saved workspace cards`}
            </p>
          </section>
        </section>
      </aside>

      <section className="workspace_study_main">
        <header className="workspace_study_header">
          <div>
            <h2>
              {selectedStudySet?.title ||
                (studySets.length > 0
                  ? "Choose a flashcard set"
                  : "No flashcards yet")}
            </h2>
            <p>
              {selectedStudySet?.subtitle ||
                (studySets.length > 0
                  ? "Select the flashcard set you want to study from the list."
                  : "Generate flashcards from an approved workspace document to study here.")}
            </p>
          </div>

          {hasStudyCards && <div className="workspace_study_progress">
            <div>
              <span
                style={{
                  width: `${
                    hasStudyCards
                      ? ((currentStudyCardIndex + 1) /
                          selectedStudySet.cards.length) *
                        100
                      : 0
                  }%`,
                }}
              ></span>
            </div>

            <p>
              <strong>Session Progress</strong>
              {hasStudyCards ? currentStudyCardIndex + 1 : 0} of{" "}
              {selectedStudySet?.cards?.length || 0} cards
            </p>
          </div>}
        </header>

        {!hasStudyCards && (
          <section className="workspace_study_empty_state">
            <div className="workspace_study_empty_icon">
              <i className="ti-light-bulb"></i>
            </div>
            <span className="workspace_study_empty_badge">
              {studySets.length > 0 ? "Choose a set" : "Start studying"}
            </span>
            <h3>
              {studySets.length > 0
                ? "Select the flashcards you want to study"
                : "Turn a document into your first flashcard set"}
            </h3>
            <p>
              {studySets.length > 0
                ? "Your flashcard content will appear here after you choose a set from the list."
                : "Choose an approved workspace document, then generate a set to begin reviewing key ideas."}
            </p>
            {studySets.length === 0 && (
              <div className="workspace_study_empty_steps">
                <span><strong>1</strong>Select a document</span>
                <span><strong>2</strong>Generate flashcards</span>
                <span><strong>3</strong>Start reviewing</span>
              </div>
            )}
          </section>
        )}

        {hasStudyCards && isStudySessionComplete && (
          <section className="workspace_study_completion" role="status">
            <div className="workspace_study_completion_icon">
              <i className="ti-cup"></i>
            </div>
            <span>Session complete</span>
            <h3>Great work! You finished this flashcard set.</h3>
            <p>
              You reviewed {reviewedStudyCardIds.length} of{" "}
              {selectedStudySet.cards.length} cards in{" "}
              <strong>{formatStudySessionDuration(studySessionSeconds)}</strong>.
            </p>
            <div className="workspace_study_completion_summary">
              <div>
                <i className="ti-timer"></i>
                <strong>{formatStudySessionDuration(studySessionSeconds)}</strong>
                <span>Total time</span>
              </div>
              <div>
                <i className="ti-layers"></i>
                <strong>{reviewedStudyCardIds.length}</strong>
                <span>Cards reviewed</span>
              </div>
            </div>
            <button type="button" onClick={handleRestartStudySession}>
              <i className="ti-reload"></i>
              Start again
            </button>
          </section>
        )}

        {hasStudyCards && !isStudySessionComplete && <>
          <section className="workspace_study_stage">
          <button
            type="button"
            className={`workspace_flashcard ${
              isStudyCardFlipped ? "flipped" : ""
            }`}
            onClick={() =>
              hasStudyCards && setIsStudyCardFlipped(!isStudyCardFlipped)
            }
          >
            <span>{isStudyCardFlipped ? "Answer" : "Question"}</span>

            <h3>
              {!hasStudyCards
                ? "No flashcards are available for this workspace yet."
                : isStudyCardFlipped
                  ? currentStudyCard.answer
                  : currentStudyCard.question}
            </h3>

            <small>
              <i className="ti-mouse"></i>
              Click to flip
            </small>
          </button>

          <div className="workspace_study_controls">
            <button
              type="button"
              onClick={handlePreviousStudyCard}
              disabled={!hasStudyCards}
            >
              <i className="ti-arrow-left"></i>
            </button>

            <button
              type="button"
              className="workspace_study_flip_btn"
              onClick={() =>
                hasStudyCards && setIsStudyCardFlipped(!isStudyCardFlipped)
              }
              disabled={!hasStudyCards}
            >
              <i className="ti-reload"></i>
              Flip Card
            </button>

            <button
              type="button"
              onClick={handleNextStudyCard}
              disabled={!hasStudyCards}
            >
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
              <strong>{formatStudySessionDuration(studySessionSeconds)}</strong>
              <p>This session</p>
            </section>
          </article>

          <article>
            <div className="workspace_study_stat_icon highlight">
              <i className="ti-bolt"></i>
            </div>

            <section>
              <span>Cards Reviewed</span>
              <strong>
                {reviewedStudyCardIds.length}/
                {selectedStudySet?.cards?.length || 0}
              </strong>
              <p>Unique cards opened</p>
            </section>
          </article>

          <article>
            <div className="workspace_study_stat_icon">
              <i className="ti-headphone-alt"></i>
            </div>

            <section>
              <span>Current Card</span>
              <strong>{hasStudyCards ? currentStudyCardIndex + 1 : 0}</strong>
              <p>{selectedStudySet?.cards?.length || 0} cards in this set</p>
            </section>
          </article>
          </section>
        </>}
      </section>
    </section>
  );
}

function renderDocumentsTab() {
  if (workspaceFileView === "ai-chat") {
    return (
      <WorkspaceAiChat
        documents={workspaceDocuments}
        activeView={workspaceFileView}
        onViewChange={setWorkspaceFileView}
      />
    );
  }

  return (
    <section className="workspace_documents_tab">
      <header className="workspace_documents_header">
        <div>
          <span>Workspace Files</span>
          <div className="workspace_file_view_tabs" role="tablist">
            <button
              type="button"
              className="active"
              role="tab"
              aria-selected="true"
              onClick={() => setWorkspaceFileView("documents")}
            >
              Documents
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="false"
              onClick={() => setWorkspaceFileView("ai-chat")}
            >
              AI Chat
            </button>
          </div>
          <p>
            Upload learning materials to this workspace and use approved files
            for AI study cards.
          </p>
        </div>

        <div className="workspace_documents_count">
          <strong>{workspaceDocuments.length}</strong>
          <span>Files</span>
        </div>
      </header>

      <section className="workspace_documents_upload_card">
        <div className="workspace_documents_upload_copy">
          <div className="workspace_documents_upload_icon">
            <i className="ti-upload"></i>
          </div>

          <div>
            <h3>Upload workspace documents</h3>
            <p>
              PDF, DOCX, and TXT files are supported. Files are checked before
              becoming available for study tools.
            </p>
          </div>
        </div>

        <div className="workspace_documents_upload_actions">
          <label className="workspace_documents_file_picker">
            <i className="ti-folder"></i>
            <span>
              {workspaceUploadFiles.length > 0
                ? `${workspaceUploadFiles.length} selected`
                : "Choose files"}
            </span>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              onChange={handleWorkspaceDocumentFileChange}
              disabled={isUploadingWorkspaceDocuments}
            />
          </label>

          <button
            type="button"
            onClick={handleUploadWorkspaceDocuments}
            disabled={
              isUploadingWorkspaceDocuments || workspaceUploadFiles.length === 0
            }
          >
            {isUploadingWorkspaceDocuments ? "Uploading..." : "Upload"}
          </button>
        </div>

        {workspaceUploadFiles.length > 0 && (
          <div className="workspace_documents_selected_files">
            {workspaceUploadFiles.map((file) => (
              <span className="workspace_documents_selected_file" key={`${file.name}-${file.size}`}>
                <strong title={file.name}>{file.name}</strong>
                <small>{formatWorkspaceFileSize(file.size)}</small>
              </span>
            ))}
          </div>
        )}

        {workspaceDocumentStatus && (
          <p className="workspace_documents_status">
            {workspaceDocumentStatus}
          </p>
        )}
      </section>

      <section className="workspace_documents_list_card">
        <div className="workspace_documents_list_header">
          <h3>Sources</h3>
          <span>
            {workspaceDocuments.length} file{workspaceDocuments.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="workspace_documents_source_summary">
          <span><i className="ti-check-box" /> Select all</span>
          <small>{approvedWorkspaceDocuments.length} approved · {waitingWorkspaceDocuments.length} waiting</small>
        </div>

        {workspaceDocuments.length === 0 ? (
          <div className="workspace_documents_empty">
            <i className="ti-files"></i>
            <h3>No workspace documents yet</h3>
            <p>
              Upload a document here, then use approved documents in the Study
              tab.
            </p>
          </div>
        ) : (
          <div className="workspace_documents_list">
            {workspaceDocuments.map((document) => {
              const status = String(document.status || "PENDING").toUpperCase();
              const needsWorkspaceReview =
                canManageWorkspace &&
                ["PENDING", "FLAGGED", "PENDING_RETRY", "REJECTED"].includes(
                  status,
                );

              return (
                <article className="workspace_document_row" key={document.id}>
                  <div className="workspace_document_icon">
                    <i className="ti-file"></i>
                  </div>

                  <div className="workspace_document_info">
                    <h3 title={document.title}>{document.title}</h3>
                    <p>
                      {formatWorkspaceFileSize(
                        document.fileSizeBytes ?? document.file_size_bytes,
                      )}
                      <span className="workspace_document_uploader">
                        Uploaded by {document.uploaderName || "Unknown user"}
                        <br />
                        {document.createdAt || document.created_at
                          ? new Date(
                              document.createdAt || document.created_at,
                            ).toLocaleString()
                          : "Just now"}
                      </span>
                    </p>
                  </div>

                  <span
                    className={`workspace_document_status ${status.toLowerCase()}`}
                  >
                    {getDocumentStatusLabel(status)}
                  </span>

                  <div className="workspace_document_actions">
                    {canManageTopics && (
                      <button
                        type="button"
                        className="view"
                        onClick={() => handleViewWorkspaceDocument(document)}
                      >
                        <i className="ti-eye" aria-hidden="true"></i>
                        View file
                      </button>
                    )}

                    <button
                      type="button"
                      className="download"
                      onClick={() => handleDownloadWorkspaceDocument(document)}
                    >
                      <i className="ti-download" aria-hidden="true"></i>
                      Download
                    </button>

                    {needsWorkspaceReview && (
                      <>
                        <button
                          type="button"
                          className="approve"
                          onClick={() =>
                            handleReviewWorkspaceDocument(
                              document.id,
                              "APPROVE",
                            )
                          }
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          className="reject"
                          onClick={() =>
                            handleReviewWorkspaceDocument(document.id, "REJECT")
                          }
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function renderSettingsTab() {
  if (!canManageWorkspace) {
    return (
      <section className="workspace_permission_empty">
        <i className="ti-lock"></i>
        <h2>Admin access only</h2>
        <p>Only workspace admins can change workspace settings.</p>
      </section>
    );
  }

  const transferableMembers = visibleWorkspaceMembers.filter(
    (member) => String(member.id || member.userId) !== currentUserId,
  );
  const transferAdminTarget = transferableMembers.find(
    (member) =>
      String(member.id || member.userId) === String(transferAdminTargetId),
  );

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

        <form
          className="workspace_settings_form"
          onSubmit={handleRenameWorkspace}
        >
          <label>Workspace name</label>
          <input
            type="text"
            value={workspaceNameInput || workspace?.name || ""}
            onChange={handleWorkspaceNameChange}
            placeholder="Enter workspace name"
          />

          <small
            className={
              (workspaceNameInput || workspace?.name || "").length > WORKSPACE_NAME_MAX_LENGTH
                ? "settings_warning_text"
                : ""
            }
          >
            {(workspaceNameInput || workspace?.name || "").length}/{WORKSPACE_NAME_MAX_LENGTH} characters
          </small>
          <button type="submit">Save changes</button>
        </form>

        {workspaceSettingMessage && (
          <p className="workspace_settings_message">
            {workspaceSettingMessage}
          </p>
        )}
      </section>

      {!canManageWorkspace && (
        <section className="workspace_settings_card danger">
          <div className="workspace_settings_card_header">
            <div className="workspace_settings_icon warning" style={{ background: "#fef3c7", color: "#d97706" }}>
              <i className="ti-export"></i>
            </div>

            <div>
              <h3>Leave workspace</h3>
              <p>Remove yourself from this workspace. Workspace admins will be notified.</p>
            </div>
          </div>

          <button
            type="button"
            className="workspace_delete_btn"
            style={{ backgroundColor: "#d97706" }}
            onClick={handleLeaveWorkspace}
          >
            Leave workspace
          </button>
        </section>
      )}

      {canManageWorkspace && (
        <section className="workspace_settings_card" style={{ marginTop: "16px" }}>
          <div className="workspace_settings_card_header">
            <div className="workspace_settings_icon workspace_transfer_admin_icon">
              <i className="ti-crown"></i>
            </div>

            <div>
              <h3>Transfer Admin ownership</h3>
              <p>
                Promote a member to Admin and choose your role after the
                transfer.
              </p>
            </div>
          </div>

          <div className="workspace_transfer_role_choice">
            <span>Your role after transfer</span>
            <div role="radiogroup" aria-label="Your role after Admin transfer">
              {[
                { value: "Viewer", label: "Contributor", description: "Can upload files and contribute" },
              ].map((roleOption) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={roleAfterAdminTransfer === roleOption.value}
                  className={
                    roleAfterAdminTransfer === roleOption.value ? "selected" : ""
                  }
                  key={roleOption.value}
                  onClick={() => setRoleAfterAdminTransfer(roleOption.value)}
                >
                  <i
                    className="ti-user"
                    aria-hidden="true"
                  ></i>
                  <span>
                    <strong>{roleOption.label}</strong>
                    <small>{roleOption.description}</small>
                  </span>
                  <i className="ti-check" aria-hidden="true"></i>
                </button>
              ))}
            </div>
          </div>

          <div className="workspace_transfer_admin_controls">
            <div
              className={`workspace_transfer_admin_select ${
                isTransferAdminMenuOpen ? "is_open" : ""
              }`}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsTransferAdminMenuOpen(false);
                }
              }}
            >
              <button
                type="button"
                className="workspace_transfer_admin_trigger"
                aria-haspopup="listbox"
                aria-expanded={isTransferAdminMenuOpen}
                onClick={() =>
                  setIsTransferAdminMenuOpen((isOpen) => !isOpen)
                }
              >
                <span className="workspace_transfer_admin_trigger_content">
                  <i className="ti-user" aria-hidden="true"></i>
                  <span>
                    <strong>
                      {transferAdminTarget
                        ? transferAdminTarget.name ||
                          transferAdminTarget.username ||
                          transferAdminTarget.email
                        : "Select a member to promote"}
                    </strong>
                    <small>
                      {transferAdminTarget
                        ? getWorkspaceRoleLabel(transferAdminTarget.role)
                        : "Choose the next workspace administrator"}
                    </small>
                  </span>
                </span>
                <i className="ti-angle-down" aria-hidden="true"></i>
              </button>

              {isTransferAdminMenuOpen && (
                <div className="workspace_transfer_admin_menu" role="listbox">
                  {transferableMembers.length === 0 ? (
                    <p>No eligible workspace members</p>
                  ) : (
                    transferableMembers.map((member) => {
                      const memberId = String(member.id || member.userId);
                      const isSelected = memberId === String(transferAdminTargetId);
                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={isSelected ? "selected" : ""}
                          key={memberId}
                          onClick={() => {
                            setTransferAdminTargetId(memberId);
                            setIsTransferAdminMenuOpen(false);
                          }}
                        >
                          <span className="workspace_transfer_admin_avatar">
                            {(member.name || member.username || member.email || "M")
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                          <span>
                            <strong>{member.name || member.username || member.email}</strong>
                            <small>{getWorkspaceRoleLabel(member.role)}</small>
                          </span>
                          {isSelected && <i className="ti-check" aria-hidden="true"></i>}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              className="workspace_delete_btn workspace_transfer_admin_btn"
              onClick={() => {
                const targetId = transferAdminTargetId;
                if (!targetId) {
                  showAlert(
                    "Choose a workspace member before transferring Admin ownership.",
                    {
                      title: "Select a member",
                      confirmText: "Got it",
                    },
                  );
                  return;
                }
                handleTransferAdminOwnership(
                  targetId,
                  transferAdminTarget?.name || transferAdminTarget?.username,
                  roleAfterAdminTransfer,
                );
              }}
            >
              Transfer Admin
            </button>
          </div>
        </section>
      )}

      {canManageWorkspace && (
        <section className="workspace_settings_card danger" style={{ marginTop: "16px" }}>
          <div className="workspace_settings_card_header">
            <div className="workspace_settings_icon danger">
              <i className="ti-trash"></i>
            </div>

            <div>
              <h3>Delete workspace</h3>
              <p>Remove this workspace for all members.</p>
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
      )}
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
          <label>Find by username or full name</label>

          <div className="workspace_invite_search">
            <i className="ti-search"></i>
            <input
              type="text"
              value={inviteQuery}
              onChange={handleInviteQueryChange}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearchInviteMember();
                }
              }}
              placeholder="Username, full name or email"
              autoFocus
            />
          </div>
          {inviteError && (
            <p className="workspace_invite_error" role="alert">
              <i className="ti-alert" />
              {inviteError}
            </p>
          )}
        </div>

        <div className="workspace_invite_result_title">
          SEARCH RESULTS{" "}
          {inviteStatus === "found" ? `(${candidateUsers.length})` : ""}
        </div>

        {inviteStatus === "found" && (
          <section className="workspace_invite_result">
            {candidateUsers.map((user) => (
              <label
                className={`workspace_invite_candidate ${
                  selectedUserId === user.id ? "is-selected" : ""
                } ${user.isWorkspaceMember ? "is-existing-member" : ""}`}
                key={user.id}
              >
                <input
                  type="radio"
                  name="workspace-user"
                  checked={selectedUserId === user.id}
                  disabled={user.isWorkspaceMember}
                  onChange={() => setSelectedUserId(user.id)}
                />

                <div className="workspace_invite_avatar">
                  <i className="ti-user"></i>
                </div>

                <div>
                  <h3>
                    {user.full_name || user.username || "Unnamed user"}
                    {user.isWorkspaceMember && (
                      <span className="workspace_invite_existing_badge">
                        Already in workspace
                      </span>
                    )}
                  </h3>
                  <p>{user.username ? `@${user.username}` : user.email}</p>
                  {user.isWorkspaceMember && (
                    <p className="workspace_invite_existing_note">
                      This user is already a member of this workspace.
                    </p>
                  )}
                </div>
              </label>
            ))}
          </section>
        )}

        {isInviteSearching && (
          <section className="workspace_invite_empty_result">
            <i className="ti-reload workspace_invite_spinner"></i>
            <p>Searching users...</p>
          </section>
        )}

        {inviteStatus === "idle" && !isInviteSearching && (
          <section className="workspace_invite_empty_result">
            <i className="ti-search"></i>
            <p>Enter a username, full name or email, then press Enter.</p>
          </section>
        )}

        {inviteStatus === "error" && !isInviteSearching && (
          <section className="workspace_invite_no_result">
            <div className="workspace_invite_no_result_icon">
              <i className="ti-alert"></i>
            </div>

            <h3>Cannot search users</h3>
            <p>{inviteError}</p>

            <div className="workspace_invite_no_result_actions">
              <button
                type="button"
                onClick={() => {
                  setInviteStatus("idle");
                  setInviteError("");
                }}
              >
                Try Again
              </button>
            </div>
          </section>
        )}

        {inviteStatus === "not-found" && !isInviteSearching && (
          <section className="workspace_invite_no_result">
            <div className="workspace_invite_no_result_icon">
              <i className="ti-search"></i>
            </div>

            <h3>No user found</h3>
            <p>
              We couldn't find any student or researcher matching "{inviteQuery}
              ".
            </p>

            <div className="workspace_invite_no_result_actions">
              <button type="button" onClick={() => setInviteStatus("idle")}>
                Try Again
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
              Contributor
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
              disabled={
                isInviteSearching ||
                isAddingMember ||
                inviteQuery.trim().replace(/^@+/, "").length < 2 ||
                (inviteStatus === "found" && !selectedUserId)
              }
              onClick={
                inviteStatus === "found"
                  ? handleSendInvite
                  : handleSearchInviteMember
              }
            >
              {isInviteSearching
                ? "Searching..."
                : isAddingMember
                  ? "Adding..."
                  : inviteStatus === "found"
                    ? "Add member"
                    : "Search"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

return (
  <main
    className={`workspace_page${
      activeTab === "documents" ? " workspace_page--documents" : ""
    }`}
  >
    <nav className="workspace_top_tabs">
      <span className="workspace_nav_title">
        {workspace?.name || workspaceNameInput || "Workspace"}
      </span>
      <button
        className={activeTab === "messages" ? "active" : ""}
        onClick={() => setActiveTab("messages")}
      >
        <i className="ti-comment-alt"></i>
        Message
      </button>

      <button
        className={activeTab === "documents" ? "active" : ""}
        onClick={() => setActiveTab("documents")}
      >
        <i className="ti-files"></i>
        Files
      </button>

      <button
        className={activeTab === "study" ? "active" : ""}
        onClick={() => setActiveTab("study")}
      >
        <i className="ti-light-bulb"></i>
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

      <button
          type="button"
          className={`workspace_leave_tab_btn ${
            canManageWorkspace ? "is-admin-blocked" : ""
          }`}
          title={
            canManageWorkspace
              ? backendMembers.length > 1
                ? "Transfer Admin ownership before leaving this workspace"
                : "Leaving will delete this workspace"
              : "Leave workspace"
          }
          style={{
            marginLeft: "auto",
            color: "#dc2626",
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            borderRadius: "8px",
            padding: "6px 14px",
            cursor: "pointer",
            fontWeight: 600,
          }}
          onClick={handleLeaveWorkspace}
        >
          <i className="ti-export"></i>
          Leave workspace
        </button>
    </nav>

    {activeTab === "messages" && renderMessagesTab()}

    {activeTab === "documents" && renderDocumentsTab()}

    {activeTab === "study" && renderStudyTab()}

    {activeTab === "members" && renderMembersTab()}

    {activeTab === "settings" && renderSettingsTab()}

    {renderInviteMemberModal()}

    {pendingAdminTransfer && (
      <div
        className="workspace_leave_blocked_overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setPendingAdminTransfer(null);
          }
        }}
      >
        <section
          className="workspace_leave_blocked_modal workspace_transfer_role_modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-transfer-role-title"
        >
          <button
            type="button"
            className="workspace_leave_blocked_close"
            aria-label="Close role selection"
            onClick={() => setPendingAdminTransfer(null)}
          >
            <i className="ti-close"></i>
          </button>

          <div className="workspace_leave_blocked_icon" aria-hidden="true">
            <i className="ti-crown"></i>
          </div>
          <span className="workspace_leave_blocked_eyebrow">Role after transfer</span>
          <h2 id="workspace-transfer-role-title">Choose your new role</h2>
          <p>
            {pendingAdminTransfer.name} will become Admin. Choose the access
            level you want to keep in this workspace.
          </p>

          <div className="workspace_transfer_role_choice workspace_transfer_role_choice_modal">
            <div role="radiogroup" aria-label="Your role after Admin transfer">
              {[
                { value: "Viewer", label: "Contributor", description: "Can upload files and contribute" },
              ].map((roleOption) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={roleAfterAdminTransfer === roleOption.value}
                  className={roleAfterAdminTransfer === roleOption.value ? "selected" : ""}
                  key={roleOption.value}
                  onClick={() => setRoleAfterAdminTransfer(roleOption.value)}
                >
                  <i
                    className="ti-user"
                    aria-hidden="true"
                  ></i>
                  <span>
                    <strong>{roleOption.label}</strong>
                    <small>{roleOption.description}</small>
                  </span>
                  <i className="ti-check" aria-hidden="true"></i>
                </button>
              ))}
            </div>
          </div>

          <div className="workspace_leave_blocked_actions">
            <button
              type="button"
              className="workspace_leave_blocked_cancel"
              onClick={() => setPendingAdminTransfer(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="workspace_leave_blocked_transfer"
              onClick={() => {
                const transferTarget = pendingAdminTransfer;
                setPendingAdminTransfer(null);
                handleTransferAdminOwnership(
                  transferTarget.id,
                  transferTarget.name,
                  roleAfterAdminTransfer,
                );
              }}
            >
              Continue
            </button>
          </div>
        </section>
      </div>
    )}

    {isDeleteWorkspaceModalOpen && (
      <div
        className="workspace_leave_blocked_overlay"
        onMouseDown={(event) => {
          if (
            event.target === event.currentTarget &&
            !isDeletingWorkspace
          ) {
            setIsDeleteWorkspaceModalOpen(false);
            setDeleteWorkspaceError("");
          }
        }}
      >
        <section
          className="workspace_leave_blocked_modal workspace_delete_confirm_modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="workspace-delete-confirm-title"
          aria-describedby="workspace-delete-confirm-description"
        >
          <button
            type="button"
            className="workspace_leave_blocked_close"
            aria-label="Close delete confirmation"
            disabled={isDeletingWorkspace}
            onClick={() => {
              setIsDeleteWorkspaceModalOpen(false);
              setDeleteWorkspaceError("");
            }}
          >
            <i className="ti-close"></i>
          </button>

          <div
            className="workspace_leave_blocked_icon workspace_delete_confirm_icon"
            aria-hidden="true"
          >
            <i className="ti-trash"></i>
          </div>

          <span className="workspace_leave_blocked_eyebrow">
            {isSoleAdminLeaving ? "Last workspace member" : "Permanent action"}
          </span>
          <h2 id="workspace-delete-confirm-title">
            {isSoleAdminLeaving
              ? "Leaving will delete this workspace"
              : "Delete this workspace?"}
          </h2>
          <p id="workspace-delete-confirm-description">
            {isSoleAdminLeaving
              ? "If you leave this workspace, it will be deleted because you are its only Admin and member."
              : "This workspace and its content will be removed for every member. This action cannot be undone."}
          </p>

          <div className="workspace_delete_confirm_warning">
            <i className="ti-alert" aria-hidden="true"></i>
            <span>
              {isSoleAdminLeaving
                ? "Leaving removes the workspace documents, discussions and study data. This action cannot be undone."
                : "Make sure you no longer need the workspace documents, discussions and study data before continuing."}
            </span>
          </div>

          {deleteWorkspaceError && (
            <p className="workspace_delete_confirm_error" role="alert">
              {deleteWorkspaceError}
            </p>
          )}

          <div className="workspace_leave_blocked_actions">
            <button
              type="button"
              className="workspace_leave_blocked_cancel"
              disabled={isDeletingWorkspace}
              onClick={() => {
                setIsDeleteWorkspaceModalOpen(false);
                setDeleteWorkspaceError("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="workspace_delete_confirm_primary"
              autoFocus
              disabled={isDeletingWorkspace}
              onClick={handleConfirmDeleteWorkspace}
            >
              <i className={isDeletingWorkspace ? "ti-reload" : "ti-trash"}></i>
              {isDeletingWorkspace
                ? "Deleting..."
                : isSoleAdminLeaving
                  ? "Leave and delete"
                  : "Delete workspace"}
            </button>
          </div>
        </section>
      </div>
    )}

    {isLeaveBlockedModalOpen && (
      <div
        className="workspace_leave_blocked_overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setIsLeaveBlockedModalOpen(false);
          }
        }}
      >
        <section
          className="workspace_leave_blocked_modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="workspace-leave-blocked-title"
          aria-describedby="workspace-leave-blocked-description"
        >
          <button
            type="button"
            className="workspace_leave_blocked_close"
            aria-label="Close popup"
            onClick={() => setIsLeaveBlockedModalOpen(false)}
          >
            <i className="ti-close"></i>
          </button>

          <div className="workspace_leave_blocked_icon" aria-hidden="true">
            <i className="ti-lock"></i>
          </div>

          <span className="workspace_leave_blocked_eyebrow">
            Admin ownership required
          </span>
          <h2 id="workspace-leave-blocked-title">
            Transfer Admin before leaving
          </h2>
          <p id="workspace-leave-blocked-description">
            You are still the Admin of this workspace. Transfer Admin ownership
            to another member before you leave.
          </p>

          <div className="workspace_leave_blocked_hint">
            <i className="ti-info-alt" aria-hidden="true"></i>
            <span>
              Open workspace settings and use <strong>Transfer Admin</strong> to
              choose a new owner.
            </span>
          </div>

          <div className="workspace_leave_blocked_actions">
            <button
              type="button"
              className="workspace_leave_blocked_cancel"
              onClick={() => setIsLeaveBlockedModalOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="workspace_leave_blocked_primary"
              autoFocus
              onClick={() => {
                setIsLeaveBlockedModalOpen(false);
                setActiveTab("settings");
              }}
            >
              <i className="ti-settings"></i>
              Go to settings
            </button>
          </div>
        </section>
      </div>
    )}

    <ActionPopup popup={actionPopup} onResolve={resolveActionPopup} />
  </main>
);
}

export default WorkSpacePage;
