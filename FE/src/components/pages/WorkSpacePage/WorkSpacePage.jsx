import {
  Link,
  useLocation,
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import ActionPopup from "../../common/ActionPopup/ActionPopup.jsx";
import useActionPopup from "../../common/ActionPopup/useActionPopup.js";
import { createAppNotification } from "../../../utils/notificationStore.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addWorkspaceMember,
  addWorkspaceDiscussionComment,
  updateWorkspaceDiscussionComment,
  uploadWorkspaceDiscussionAttachments,
  addWorkspaceDiscussionSubtask,
  getWorkspaceMembers,
  getWorkspaceDiscussionTopics,
  removeWorkspaceMember,
  searchWorkspaceUsers,
  getWorkspace,
  updateWorkspace,
  updateWorkspaceDiscussionTopic,
  deleteWorkspaceDiscussionAttachment,
  deleteWorkspaceDiscussionSubtask,
  deleteWorkspaceDiscussionTopic,
  updateWorkspaceMemberRole,
  deleteWorkspace,
  getWorkspaceMessages,
  createWorkspaceMessage,
  getWorkspaceFlashcards,
  getWorkspaceDocuments,
  reviewWorkspaceDocument,
  generateWorkspaceDocumentFlashcards,
  createWorkspaceDiscussionTopic,
  updateWorkspaceDiscussionSubtask,
  leaveWorkspace,
  transferAdminOwnership,
  downloadWorkspaceDiscussionAttachment,
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

function normalizeDiscussionTopicTitle(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
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

function normalizeDisplayFileName(fileName) {
  const value = String(fileName || "");
  if (!value || [...value].some((character) => character.charCodeAt(0) > 255)) {
    return value.normalize("NFC");
  }

  try {
    const bytes = Uint8Array.from(value, (character) =>
      character.charCodeAt(0),
    );
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded.normalize("NFC");
  } catch {
    return value.normalize("NFC");
  }
}

function getSolutionPreview(content, wordLimit = 15) {
  const words = String(content || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= wordLimit) return words.join(" ");
  return `${words.slice(0, wordLimit).join(" ")}...`;
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
  const showLegacySubtaskPanel = false;

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
  const [isTopicFormOpen, setIsTopicFormOpen] = useState(false);
  const [activeTopicSection, setActiveTopicSection] = useState("details");
  const [isUploadingSolution, setIsUploadingSolution] = useState(false);
  const [isSolutionFormOpen, setIsSolutionFormOpen] = useState(false);
  const [solutionContent, setSolutionContent] = useState("");
  const [solutionAttachments, setSolutionAttachments] = useState([]);
  const [solutionCommentDrafts, setSolutionCommentDrafts] = useState({});
  const [openSolutionCommentId, setOpenSolutionCommentId] = useState(null);
  const [selectedSolutionCommentsId, setSelectedSolutionCommentsId] =
    useState(null);
  const [submittingSolutionCommentId, setSubmittingSolutionCommentId] =
    useState(null);
  const [editingSolutionId, setEditingSolutionId] = useState(null);
  const [selectedSolutionDetail, setSelectedSolutionDetail] = useState(null);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicContent, setTopicContent] = useState("");
  const [isTopicDescriptionEditing, setIsTopicDescriptionEditing] =
    useState(false);
  const [newTopicDescription, setNewTopicDescription] = useState("");
  const [newTopicType, setNewTopicType] = useState("Question");
  const [newTopicStatus, setNewTopicStatus] = useState("Open");
  const [newTopicAttachments, setNewTopicAttachments] = useState([]);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [topicCommentInput, setTopicCommentInput] = useState("");
  const [topicSubtaskInput, setTopicSubtaskInput] = useState("");
  const [isSubtaskEditing, setIsSubtaskEditing] = useState(false);
  const [subtaskPriority, setSubtaskPriority] = useState("");
  const [subtaskDateMode, setSubtaskDateMode] = useState("none");
  const [subtaskStartDate, setSubtaskStartDate] = useState("");
  const [subtaskEndDate, setSubtaskEndDate] = useState("");
  const [isSubtaskDateOpen, setIsSubtaskDateOpen] = useState(false);
  const [isSubtaskPriorityOpen, setIsSubtaskPriorityOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTopicId = searchParams.get("topic");
  const setSelectedTopicId = (id) => {
    if (id) {
      setActiveTopicSection("details");
      setIsTopicDescriptionEditing(false);
      setSearchParams({ topic: id });
    } else {
      setSearchParams({});
    }
  };
  const [topicFilter, setTopicFilter] = useState("All");
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

  const [discussionTopics, setDiscussionTopics] = useState([]);
  const [discussionStatus, setDiscussionStatus] = useState("");
  const [isLoadingDiscussion, setIsLoadingDiscussion] = useState(false);

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

    async function loadDiscussionTopics() {
      try {
        setIsLoadingDiscussion(true);
        setDiscussionStatus("");
        const topics = await getWorkspaceDiscussionTopics(workspaceId);

        if (isMounted) {
          setDiscussionTopics(topics || []);
        }
      } catch (error) {
        console.error("Cannot load workspace discussion topics:", error);
        if (isMounted) {
          setDiscussionStatus(
            error.response?.data?.message ||
              "Could not load workspace discussion topics.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingDiscussion(false);
        }
      }
    }

    loadDiscussionTopics();

    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

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

  const WORKSPACE_STORAGE_LIMIT_BYTES = 50 * 1024 * 1024;

  const discussionStorageUsedBytes = discussionTopics.reduce((total, topic) => {
    const topicFileSize = (topic.files || []).reduce(
      (fileTotal, file) =>
        fileTotal + (Number(file.fileSizeBytes || file.size) || 0),
      0,
    );

    return total + topicFileSize;
  }, 0);

  const workspaceStorageUsedBytes = discussionStorageUsedBytes;
  const workspaceStorageRemainingBytes = Math.max(
    WORKSPACE_STORAGE_LIMIT_BYTES - workspaceStorageUsedBytes,
    0,
  );

  const workspaceStoragePercent = Math.min(
    (workspaceStorageUsedBytes / WORKSPACE_STORAGE_LIMIT_BYTES) * 100,
    100,
  );

  function formatWorkspaceStorageSize(bytes) {
    if (!bytes) return "0 KB";

    if (bytes < 1024 * 1024) {
      return `${Math.ceil(bytes / 1024)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

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

  const selectedTopic = discussionTopics.find(
    (topic) => topic.id === selectedTopicId,
  );

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

  function requireTopicPermission(actionLabel) {
    if (canManageTopics) return true;

    showAlert(`Only workspace admins can ${actionLabel}.`);
    return false;
  }

  function requireWorkspaceAdminPermission(actionLabel) {
    if (canManageWorkspace) return true;

    showAlert(`Only workspace admins can ${actionLabel}.`);
    return false;
  }

  async function handleCreateTopic(e) {
    e.preventDefault();

    if (!requireTopicPermission("create or edit topics")) return;

    if (topicTitle.trim() === "") {
      await showAlert("Enter a title before creating this topic.", {
        title: "Topic title required",
        confirmText: "Got it",
      });
      return;
    }

    if (newTopicDescription.trim() === "") {
      await showAlert("Enter a description before creating this topic.", {
        title: "Topic description required",
        confirmText: "Got it",
      });
      return;
    }

    const normalizedNewTopicTitle = normalizeDiscussionTopicTitle(topicTitle);
    const hasDuplicateTitle = discussionTopics.some(
      (topic) =>
        normalizeDiscussionTopicTitle(topic.title) === normalizedNewTopicTitle,
    );

    if (hasDuplicateTitle) {
      await showAlert(
        "A topic with this title already exists in the workspace. Choose a different title.",
        {
          title: "Duplicate topic title",
          confirmText: "Got it",
        },
      );
      return;
    }

    const attachmentSize = newTopicAttachments.reduce(
      (total, file) => total + file.size,
      0,
    );

    if (
      workspaceStorageUsedBytes + attachmentSize >
      WORKSPACE_STORAGE_LIMIT_BYTES
    ) {
      await showAlert(
        "These attachments would exceed the workspace 50MB storage limit. Delete some files before uploading more attachments.",
        {
          title: "Workspace storage limit reached",
          confirmText: "I understand",
        },
      );
      return;
    }

    try {
      setIsCreatingTopic(true);
      setDiscussionStatus("");
      const createdTopic = await createWorkspaceDiscussionTopic(workspaceId, {
        title: topicTitle.trim(),
        content: newTopicDescription.trim(),
        topicType: newTopicType,
        status: newTopicStatus,
        priority: "Normal",
        dateMode: "none",
        startDate: "",
        endDate: "",
      });

      let topicWithAttachments = createdTopic;
      let attachmentError = null;

      if (newTopicAttachments.length > 0) {
        try {
          const attachments = await uploadWorkspaceDiscussionAttachments(
            workspaceId,
            createdTopic.id,
            newTopicAttachments,
          );
          if (attachments.length > 0) {
            topicWithAttachments = { ...createdTopic, files: attachments };
          }
        } catch (error) {
          attachmentError = error;
          console.error("Cannot upload new topic attachments:", error);
        }
      }

      setDiscussionTopics((currentTopics) => [
        topicWithAttachments,
        ...currentTopics,
      ]);
      createAppNotification({
        category: "discussion",
        action: "newTopic",
        title: "New discussion topic",
        message: `${profileName} created topic "${createdTopic.title}".`,
        icon: "ti-comments",
        link: `/dashboard/workspaces/${workspaceId}`,
      });
      setSelectedTopicId(createdTopic.id);

      setTopicTitle("");
      setTopicContent(createdTopic.content || "");

      setNewTopicDescription("");
      setNewTopicType("Question");
      setNewTopicStatus("Open");
      setNewTopicAttachments([]);

      setIsTopicFormOpen(false);

      if (attachmentError) {
        await showAlert(
          attachmentError.response?.data?.message ||
            "Topic was created, but its attachments could not be uploaded.",
          {
            title:
              attachmentError.response?.data?.code ===
              "AI_MODERATION_REJECTED"
                ? "File did not pass moderation"
                : "Attachment upload failed",
            confirmText: "Close",
          },
        );
      }
    } catch (error) {
      console.error("Cannot create discussion topic:", error);
      await showAlert(
        error.response?.data?.message || "Could not create discussion topic.",
        {
          title: "Could not create topic",
          confirmText: "Close",
        },
      );
    } finally {
      setIsCreatingTopic(false);
    }
  }

  function handleNewTopicAttachmentsChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length > 10) {
      showAlert("You can attach up to 10 files to a topic.");
    }
    setNewTopicAttachments(files.slice(0, 10));
    event.target.value = "";
  }

  async function handleDeleteTopicFile(fileId) {
    if (!selectedTopic) return;
    if (!requireTopicPermission("delete topic files")) return;

    const savedFile = (selectedTopic.files || []).find(
      (file) => file.id === fileId,
    );

    const fileToDelete = savedFile;

    if (!fileToDelete) return;

    const confirmDelete = await showConfirm(
      `Delete "${fileToDelete.fileName || fileToDelete.name}" from this topic?`,
    );

    if (!confirmDelete) return;

    // Xóa file đang chờ lưu
    try {
      await deleteWorkspaceDiscussionAttachment(
        workspaceId,
        selectedTopic.id,
        fileId,
      );

      // Xóa file đã lưu trong topic
      setDiscussionTopics((currentTopics) =>
        currentTopics.map((topic) =>
          topic.id === selectedTopic.id
            ? {
                ...topic,
                files: (topic.files || []).filter((file) => file.id !== fileId),
              }
            : topic,
        ),
      );
    } catch (error) {
      console.error("Cannot delete discussion attachment:", error);
      showAlert(error.response?.data?.message || "Could not delete attachment.");
    }
  }

  async function handleDeleteSelectedTopic() {
    if (!selectedTopic) return;
    if (!requireTopicPermission("delete topics")) return;

    const confirmDelete = await showConfirm(
      `Delete topic "${selectedTopic.title}"?`,
    );

    if (!confirmDelete) return;

    try {
      await deleteWorkspaceDiscussionTopic(workspaceId, selectedTopic.id);
      setDiscussionTopics((currentTopics) =>
        currentTopics.filter((topic) => topic.id !== selectedTopic.id),
      );
      setSelectedTopicId(null);
      setTopicContent("");
    } catch (error) {
      console.error("Cannot delete discussion topic:", error);
      showAlert(error.response?.data?.message || "Could not delete topic.");
    }
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

async function handleTopicFileChange(e) {
  const selectedFiles = Array.from(e.target.files);

  if (selectedFiles.length === 0 || !selectedTopic) return;
  if (!requireTopicPermission("upload topic files")) {
    e.target.value = "";
    return;
  }

const selectedFilesSize = selectedFiles.reduce(
  (total, file) => total + file.size,
  0,
);

const nextStorageUsed = workspaceStorageUsedBytes + selectedFilesSize;

if (nextStorageUsed > WORKSPACE_STORAGE_LIMIT_BYTES) {
  createAppNotification({
    category: "file",
    action: "storageWarning",
    title: "Workspace storage warning",
    message: "This workspace has reached the 50MB storage limit.",
    icon: "ti-alert",
    link: `/dashboard/workspaces/${workspaceId}`,
  });

  await showAlert(
    "This upload would exceed the workspace 50MB storage limit. Delete some files before uploading more attachments.",
    {
      title: "Workspace storage limit reached",
      confirmText: "I understand",
    },
  );

  e.target.value = "";
  return;
}

try {
  const attachments = await uploadWorkspaceDiscussionAttachments(
    workspaceId,
    selectedTopic.id,
    selectedFiles,
  );

  setDiscussionTopics((currentTopics) =>
    currentTopics.map((topic) =>
      topic.id === selectedTopic.id
        ? { ...topic, files: [...(topic.files || []), ...attachments] }
        : topic,
    ),
  );
  createAppNotification({
    category: "file",
    action: "uploaded",
    title: "File uploaded",
    message: `${profileName} uploaded ${attachments.length} file(s) to ${selectedTopic.title}.`,
    icon: "ti-folder",
    link: `/dashboard/workspaces/${workspaceId}`,
  });
} catch (error) {
  console.error("Cannot upload discussion attachments:", error);
  await showAlert(
    error.response?.data?.message || "Could not upload discussion files.",
    {
      title:
        error.response?.data?.code === "AI_MODERATION_REJECTED"
          ? "File did not pass moderation"
          : "Attachment upload failed",
      confirmText: "Close",
    },
  );
} finally {
  e.target.value = "";
}
}

function handleSolutionFileChange(event) {
  const selectedFiles = Array.from(event.target.files || []).slice(0, 10);
  event.target.value = "";
  setSolutionAttachments(selectedFiles);
}

async function handleSubmitSolution(event) {
  event.preventDefault();

  if (!selectedTopic || isUploadingSolution) return;
  const alreadySubmittedSolution = Boolean(
    currentUserId &&
      (selectedTopic.solutions || []).some(
        (solution) =>
          String(solution.userId || solution.author?.id || "") ===
          currentUserId,
      ),
  );
  if (alreadySubmittedSolution && !editingSolutionId) {
    showAlert("You have already submitted a solution for this topic.");
    return;
  }
  if (!solutionContent.trim()) {
    showAlert("Please describe your solution before submitting it.");
    return;
  }

  const selectedFilesSize = solutionAttachments.reduce(
    (total, file) => total + file.size,
    0,
  );

  if (
    workspaceStorageUsedBytes + selectedFilesSize >
    WORKSPACE_STORAGE_LIMIT_BYTES
  ) {
    await showAlert(
      "These solution files would exceed the workspace 50MB storage limit. Delete some files before uploading more files.",
      {
        title: "Workspace storage limit reached",
        confirmText: "I understand",
      },
    );
    return;
  }

  try {
    setIsUploadingSolution(true);
    const savedSolution = editingSolutionId
      ? await updateWorkspaceDiscussionComment(
          workspaceId,
          selectedTopic.id,
          editingSolutionId,
          { content: solutionContent.trim() },
        )
      : await addWorkspaceDiscussionComment(workspaceId, selectedTopic.id, {
          kind: "solution",
          content: solutionContent.trim(),
        });
    let uploadedSolutions = [];

    if (solutionAttachments.length > 0) {
      uploadedSolutions = await uploadWorkspaceDiscussionAttachments(
        workspaceId,
        selectedTopic.id,
        solutionAttachments,
        { kind: "solution", solutionId: savedSolution.id },
      );
    }

    setDiscussionTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === selectedTopic.id
          ? {
              ...topic,
              solutions: editingSolutionId
                ? (topic.solutions || []).map((solution) =>
                    solution.id === savedSolution.id ? savedSolution : solution,
                  )
                : [...(topic.solutions || []), savedSolution],
              files: [...(topic.files || []), ...uploadedSolutions],
            }
          : topic,
      ),
    );

    setSolutionContent("");
    setSolutionAttachments([]);
    setIsSolutionFormOpen(false);
    setEditingSolutionId(null);

    createAppNotification({
      category: "file",
      action: "uploaded",
      title: editingSolutionId ? "Solution updated" : "Solution uploaded",
      message: `${profileName} ${editingSolutionId ? "updated" : "submitted"} a solution to ${selectedTopic.title}.`,
      icon: "ti-light-bulb",
      link: `/dashboard/workspaces/${workspaceId}?topic=${selectedTopic.id}`,
    });
  } catch (error) {
    console.error("Cannot submit topic solution:", error);
    await showAlert(
      error.response?.data?.message || "Could not submit your solution.",
      {
        title:
          error.response?.data?.code === "AI_MODERATION_REJECTED"
            ? "File did not pass moderation"
            : "Solution submission failed",
        confirmText: "Close",
      },
    );
  } finally {
    setIsUploadingSolution(false);
  }
}

async function handleDeleteSolutionFile(fileId) {
  if (!selectedTopic) return;

  try {
    await deleteWorkspaceDiscussionAttachment(
      workspaceId,
      selectedTopic.id,
      fileId,
    );
    setDiscussionTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === selectedTopic.id
          ? {
              ...topic,
              files: (topic.files || []).filter((file) => file.id !== fileId),
            }
          : topic,
      ),
    );
  } catch (error) {
    console.error("Cannot delete solution attachment:", error);
    showAlert(
      error.response?.data?.message || "Could not delete solution attachment.",
    );
  }
}

async function handleSubmitSolutionComment(event, solutionId) {
  event.preventDefault();
  const content = String(solutionCommentDrafts[solutionId] || "").trim();
  if (!selectedTopic || !content || submittingSolutionCommentId) return;

  try {
    setSubmittingSolutionCommentId(solutionId);
    const savedComment = await addWorkspaceDiscussionComment(
      workspaceId,
      selectedTopic.id,
      { kind: "solutionReply", solutionId, content },
    );

    setDiscussionTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === selectedTopic.id
          ? {
              ...topic,
              solutions: (topic.solutions || []).map((solution) =>
                solution.id === solutionId
                  ? {
                      ...solution,
                      replies: [...(solution.replies || []), savedComment],
                    }
                  : solution,
              ),
            }
          : topic,
      ),
    );
    setSolutionCommentDrafts((drafts) => ({ ...drafts, [solutionId]: "" }));
    setOpenSolutionCommentId(null);
  } catch (error) {
    console.error("Cannot comment on solution:", error);
    showAlert(error.response?.data?.message || "Could not post your comment.");
  } finally {
    setSubmittingSolutionCommentId(null);
  }
}

async function handleSaveTopicNote(e) {
  e.preventDefault();

  if (!selectedTopic) return;
  if (!requireTopicPermission("edit topic content")) return;

  try {
    const updatedTopic = await updateWorkspaceDiscussionTopic(
      workspaceId,
      selectedTopic.id,
      {
        content: topicContent,
      },
    );

    setDiscussionTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === updatedTopic.id ? updatedTopic : topic,
      ),
    );
    setIsTopicDescriptionEditing(false);
  } catch (error) {
    console.error("Cannot update discussion topic:", error);
    showAlert(
      error.response?.data?.message || "Could not update discussion topic.",
    );
  }
}

async function handleUpdateTopicField(field, value) {
  if (!requireTopicPermission("edit topic properties")) return;

  const previousStatus = selectedTopic?.status;
  const payloadFieldMap = {
    type: "topicType",
    status: "status",
    priority: "priority",
  };

  try {
    const updatedTopic = await updateWorkspaceDiscussionTopic(
      workspaceId,
      selectedTopic.id,
      {
        [payloadFieldMap[field] || field]: value,
      },
    );

    setDiscussionTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === updatedTopic.id ? updatedTopic : topic,
      ),
    );

    if (
      field === "status" &&
      value === "Solved" &&
      previousStatus !== "Solved"
    ) {
      createAppNotification({
        category: "discussion",
        action: "solved",
        title: "Topic solved",
        message: `Topic "${selectedTopic.title}" was marked as solved.`,
        icon: "ti-check-box",
        link: `/dashboard/workspaces/${workspaceId}`,
      });
    }
  } catch (error) {
    console.error("Cannot update discussion topic field:", error);
    showAlert(
      error.response?.data?.message || "Could not update discussion topic.",
    );
  }
}

async function handleMarkSelectedTopicResolved() {
  if (!selectedTopic || selectedTopic.status === "Solved") return;
  await handleUpdateTopicField("status", "Solved");
}

// Retained for the discussion feature while its navigation tab is disabled.
// eslint-disable-next-line no-unused-vars
async function handleUpdateTopicDeadlineMode(value) {
  if (!requireTopicPermission("edit topic deadline")) return;

  try {
    const updatedTopic = await updateWorkspaceDiscussionTopic(
      workspaceId,
      selectedTopic.id,
      {
        dateMode: value,
        startDate: value === "deadline" ? selectedTopic.startDate : null,
        endDate: value === "deadline" ? selectedTopic.endDate : null,
      },
    );

    setDiscussionTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === updatedTopic.id ? updatedTopic : topic,
      ),
    );
  } catch (error) {
    console.error("Cannot update discussion deadline mode:", error);
    showAlert(
      error.response?.data?.message || "Could not update discussion topic.",
    );
  }
}

// Retained for the discussion feature while its navigation tab is disabled.
// eslint-disable-next-line no-unused-vars
async function handleUpdateTopicDate(field, value) {
  if (!requireTopicPermission("edit topic deadline")) return;

  try {
    const updatedTopic = await updateWorkspaceDiscussionTopic(
      workspaceId,
      selectedTopic.id,
      {
        dateMode: "deadline",
        [field]: value,
      },
    );

    setDiscussionTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === updatedTopic.id ? updatedTopic : topic,
      ),
    );
  } catch (error) {
    console.error("Cannot update discussion deadline date:", error);
    showAlert(
      error.response?.data?.message || "Could not update discussion topic.",
    );
  }
}

// Retained for the discussion feature while its navigation tab is disabled.
// eslint-disable-next-line no-unused-vars
async function handleAddTopicComment(e) {
  e.preventDefault();

  if (topicCommentInput.trim() === "") return;

  try {
    const comment = await addWorkspaceDiscussionComment(
      workspaceId,
      selectedTopic.id,
      { content: topicCommentInput.trim() },
    );

    setDiscussionTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === selectedTopic.id
          ? { ...topic, comments: [...(topic.comments || []), comment] }
          : topic,
      ),
    );
    setTopicCommentInput("");
  } catch (error) {
    console.error("Cannot add discussion comment:", error);
    showAlert(error.response?.data?.message || "Could not add comment.");
  }
}

async function handleAddTopicSubtask(e) {
  e.preventDefault();

  if (!requireTopicPermission("create subtasks")) return;

  if (topicSubtaskInput.trim() === "") return;

  try {
    const subtask = await addWorkspaceDiscussionSubtask(
      workspaceId,
      selectedTopic.id,
      {
        title: topicSubtaskInput.trim(),
        sortOrder: 0,
      },
    );

    setDiscussionTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === selectedTopic.id
          ? { ...topic, subtasks: [...(topic.subtasks || []), subtask] }
          : topic,
      ),
    );

    setTopicSubtaskInput("");
    setSubtaskPriority("");
    setSubtaskDateMode("none");
    setSubtaskStartDate("");
    setSubtaskEndDate("");
    setIsSubtaskEditing(false);
    setIsSubtaskPriorityOpen(false);
    setIsSubtaskDateOpen(false);
  } catch (error) {
    console.error("Cannot add discussion subtask:", error);
    showAlert(error.response?.data?.message || "Could not add subtask.");
  }
}

function handleCancelSubtask() {
  setTopicSubtaskInput("");
  setSubtaskPriority("");
  setSubtaskDateMode("none");
  setSubtaskStartDate("");
  setSubtaskEndDate("");
  setIsSubtaskEditing(false);
  setIsSubtaskPriorityOpen(false);
  setIsSubtaskDateOpen(false);
}

async function handleToggleSubtask(subtaskId) {
  if (!requireTopicPermission("update subtasks")) return;

  const subtask = selectedTopic?.subtasks?.find(
    (item) => item.id === subtaskId,
  );
  if (!subtask) return;

  try {
    const updatedSubtask = await updateWorkspaceDiscussionSubtask(
      workspaceId,
      selectedTopic.id,
      subtaskId,
      { isDone: !subtask.isDone },
    );

    setDiscussionTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === selectedTopic.id
          ? {
              ...topic,
              subtasks: (topic.subtasks || []).map((item) =>
                item.id === subtaskId ? updatedSubtask : item,
              ),
            }
          : topic,
      ),
    );
  } catch (error) {
    console.error("Cannot update discussion subtask:", error);
    showAlert(error.response?.data?.message || "Could not update subtask.");
  }
}

async function handleDeleteSubtask(subtaskId) {
  if (!requireTopicPermission("delete subtasks")) return;

  try {
    await deleteWorkspaceDiscussionSubtask(
      workspaceId,
      selectedTopic.id,
      subtaskId,
    );

    setDiscussionTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === selectedTopic.id
          ? {
              ...topic,
              subtasks: (topic.subtasks || []).filter(
                (subtask) => subtask.id !== subtaskId,
              ),
            }
          : topic,
      ),
    );
  } catch (error) {
    console.error("Cannot delete discussion subtask:", error);
    showAlert(error.response?.data?.message || "Could not delete subtask.");
  }
}

function getSubtaskPriorityIcon(priority) {
  if (priority === "Urgent") return "🚩";
  if (priority === "High") return "🟧";
  if (priority === "Normal") return "🟦";
  if (priority === "Low") return "⬜";
  return "";
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

function handleViewTopicAttachment(file, returnContext = "topic") {
  if (!selectedTopic?.id || !file?.id) return;

  navigate(
    `/dashboard/workspaces/${workspaceId}/topics/${selectedTopic.id}/attachments/${file.id}`,
    {
      state: {
        from: `/dashboard/workspaces/${workspaceId}?topic=${selectedTopic.id}`,
        fileName: normalizeDisplayFileName(file.fileName || file.name),
        returnContext,
      },
    },
  );
}

async function handleDownloadTopicAttachment(file) {
  if (!selectedTopic?.id || !file?.id) return;

  try {
    const downloadData = await downloadWorkspaceDiscussionAttachment(
      workspaceId,
      selectedTopic.id,
      file.id,
    );
    if (!downloadData?.viewUrl) {
      throw new Error("The download link could not be created.");
    }

    const downloadLink = document.createElement("a");
    downloadLink.href = downloadData.viewUrl;
    downloadLink.download =
      downloadData.fileName || file.fileName || file.name || "attachment";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  } catch (error) {
    console.error("Cannot download topic attachment:", error);
    await showAlert(
      error.response?.data?.message ||
        error.message ||
        "Could not download this attachment.",
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
              use all discussion features.
            </p>
          </div>

          <div className="workspace_role_item">
            <strong>Contributor</strong>
            <p>
              Can view workspace content, upload files, participate in
              discussions.
            </p>
          </div>
        </section>

      </aside>
    </section>
  );
}

// Retained so the discussion UI can be restored without rebuilding its state.
// eslint-disable-next-line no-unused-vars
function renderDiscussionTab() {
  const totalTopicFiles = discussionTopics.reduce(
    (total, topic) => total + (topic.files?.length || 0),
    0,
  );
  const filteredDiscussionTopics = discussionTopics
    .filter((topic) => {
      if (topicFilter === "All") return true;
      if (topicFilter === "Solved") return topic.status === "Solved";
      return topic.type === topicFilter;
    })
    .sort((firstTopic, secondTopic) => {
      const firstEndTime = firstTopic.endDate
        ? new Date(firstTopic.endDate).getTime()
        : Number.POSITIVE_INFINITY;
      const secondEndTime = secondTopic.endDate
        ? new Date(secondTopic.endDate).getTime()
        : Number.POSITIVE_INFINITY;

      if (firstEndTime !== secondEndTime) {
        return firstEndTime - secondEndTime;
      }

      return String(firstTopic.title || "").localeCompare(
        String(secondTopic.title || ""),
      );
    })
    .filter(
      (topic, topicIndex, topics) =>
        topics.findIndex(
          (candidate) =>
            normalizeDiscussionTopicTitle(candidate.title) ===
            normalizeDiscussionTopicTitle(topic.title),
        ) === topicIndex,
    );
  if (selectedTopic) {
    const relatedFiles = (selectedTopic.files || []).filter(
      (file) => file.kind !== "solution",
    );
    const solutionFiles = (selectedTopic.files || []).filter(
      (file) => file.kind === "solution",
    );
    const solutions = selectedTopic.solutions || [];
    const currentUserSolutions = currentUserId
      ? solutions.filter(
          (solution) =>
            String(solution.userId || solution.author?.id || "") ===
            currentUserId,
        )
      : [];
    const hasCurrentUserSubmittedSolution = Boolean(
      currentUserSolutions.length,
    );
    const subtasks = selectedTopic.subtasks || [];
    const selectedCommentsSolution = solutions.find(
      (solution) => solution.id === selectedSolutionCommentsId,
    );
    const renderSolutionComments = (solution) => {
      const replies = solution.replies || [];
      const isCommentFormOpen = openSolutionCommentId === solution.id;

      return (
        <div className="workspace_solution_comments">
          <div className="workspace_solution_comments_heading">
            <button
              type="button"
              className="workspace_solution_comments_toggle"
              onClick={() => setSelectedSolutionCommentsId(solution.id)}
              aria-haspopup="dialog"
            >
              <i className="ti-comment-alt" aria-hidden="true"></i>
              <strong>
                {replies.length} {replies.length === 1 ? "comment" : "comments"}
              </strong>
              <i className="ti-angle-right" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              className="workspace_solution_comment_action"
              onClick={() =>
                setOpenSolutionCommentId((currentId) =>
                  currentId === solution.id ? null : solution.id,
                )
              }
              aria-expanded={isCommentFormOpen}
            >
              <i className={isCommentFormOpen ? "ti-close" : "ti-comment"}></i>
              {isCommentFormOpen ? "Cancel" : "Leave a comment"}
            </button>
          </div>

          {isCommentFormOpen && (
            <form
              className="workspace_solution_comment_form"
              onSubmit={(event) =>
                handleSubmitSolutionComment(event, solution.id)
              }
            >
              <input
                type="text"
                value={solutionCommentDrafts[solution.id] || ""}
                onChange={(event) =>
                  setSolutionCommentDrafts((drafts) => ({
                    ...drafts,
                    [solution.id]: event.target.value,
                  }))
                }
                maxLength={1000}
                placeholder="Comment on this solution..."
                aria-label="Comment on this solution"
                disabled={submittingSolutionCommentId === solution.id}
              />
              <button
                type="submit"
                disabled={
                  submittingSolutionCommentId === solution.id ||
                  !String(solutionCommentDrafts[solution.id] || "").trim()
                }
                aria-label="Post comment"
              >
                <i className="ti-arrow-right" aria-hidden="true"></i>
              </button>
            </form>
          )}
        </div>
      );
    };
    return (
      <section className="workspace_clickup_detail">
        <main className="workspace_clickup_main">
          <header className="workspace_clickup_header">
            <button
              type="button"
              className="workspace_clickup_back"
              onClick={() => setSelectedTopicId(null)}
            >
              <i className="ti-angle-left"></i>
              Back to topics
            </button>

            <div className="workspace_clickup_title">
              <span className="workspace_clickup_status_dot"></span>

              <h1>{selectedTopic.title}</h1>
            </div>

            {canManageTopics && (
              <div className="workspace_topic_header_actions">
                <button
                  type="button"
                  className="workspace_topic_resolve_btn"
                  onClick={handleMarkSelectedTopicResolved}
                  disabled={selectedTopic.status === "Solved"}
                >
                  <i className="ti-check-box" aria-hidden="true"></i>
                  {selectedTopic.status === "Solved"
                    ? "Resolved"
                    : "Mark as resolved"}
                </button>

                <button
                  type="button"
                  className="workspace_topic_delete_btn"
                  onClick={handleDeleteSelectedTopic}
                >
                  <i className="ti-trash" aria-hidden="true"></i>
                  Delete topic
                </button>
              </div>
            )}
          </header>

          <nav
            className="workspace_topic_section_tabs"
            aria-label="Topic sections"
          >
            <button
              type="button"
              className={activeTopicSection === "details" ? "active" : ""}
              onClick={() => setActiveTopicSection("details")}
            >
              <i className="ti-info-alt" aria-hidden="true"></i>
              Topic details
            </button>
            <button
              type="button"
              className={activeTopicSection === "solutions" ? "active" : ""}
              onClick={() => setActiveTopicSection("solutions")}
            >
              <i className="ti-light-bulb" aria-hidden="true"></i>
              Solutions
              <span>{solutions.length}</span>
            </button>
          </nav>

          {activeTopicSection === "details" && (
            <>
              <form
                className={`workspace_clickup_description ${
                  isTopicDescriptionEditing ? "is_editing" : "is_read_only"
                }`}
                onSubmit={handleSaveTopicNote}
              >
                <textarea
                  value={topicContent}
                  onChange={(e) => setTopicContent(e.target.value)}
                  placeholder="Add topic description, information, note, or wiki..."
                  readOnly={!canManageTopics || !isTopicDescriptionEditing}
                />

                {canManageTopics ? (
                  <div className="workspace_clickup_description_actions">
                    {isTopicDescriptionEditing ? (
                      <>
                        <button
                          type="button"
                          className="workspace_topic_update_cancel"
                          onClick={() => {
                            setTopicContent(selectedTopic.content || "");
                            setIsTopicDescriptionEditing(false);
                          }}
                        >
                          Cancel
                        </button>
                        <button type="submit">Save update</button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsTopicDescriptionEditing(true)}
                      >
                        <i className="ti-pencil" aria-hidden="true"></i>
                        Update
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="workspace_permission_hint">
                    Contributor mode: you can read topics, comment, and submit
                    solutions.
                  </p>
                )}
              </form>

              {showLegacySubtaskPanel && (
                <section className="workspace_clickup_section">
                    <div className="workspace_clickup_subtask_header">
                      <h2>Add subtask</h2>

                      <div className="workspace_clickup_subtask_header_actions">
                        <button type="button">
                          <i className="ti-exchange-vertical"></i>
                          Sort
                        </button>

                        <button type="button">
                          <i className="ti-arrows-corner"></i>
                        </button>
                      </div>
                    </div>

                    {canManageTopics ? (
                      <form
                        className={`workspace_clickup_subtask_form ${
                          isSubtaskEditing ? "editing" : ""
                        }`}
                        onSubmit={handleAddTopicSubtask}
                      >
                        <div className="workspace_clickup_subtask_input_side">
                          <span className="workspace_clickup_subtask_circle"></span>

                          <input
                            value={topicSubtaskInput}
                            onFocus={() => setIsSubtaskEditing(true)}
                            onChange={(e) => {
                              setTopicSubtaskInput(e.target.value);
                              setIsSubtaskEditing(true);
                            }}
                            placeholder="Add Task"
                          />
                        </div>

                        {isSubtaskEditing && (
                          <div className="workspace_clickup_subtask_tools">
                            <div className="workspace_clickup_subtask_tool_wrap">
                              <button
                                type="button"
                                title="Date"
                                onClick={() => {
                                  setIsSubtaskDateOpen(!isSubtaskDateOpen);
                                  setIsSubtaskPriorityOpen(false);
                                }}
                              >
                                <i className="ti-calendar"></i>
                              </button>

                              {isSubtaskDateOpen && (
                                <div className="workspace_clickup_subtask_date_panel">
                                  <div className="workspace_clickup_deadline_options">
                                    <button
                                      type="button"
                                      className={
                                        subtaskDateMode === "none"
                                          ? "active"
                                          : ""
                                      }
                                      onClick={() => {
                                        setSubtaskDateMode("none");
                                        setSubtaskStartDate("");
                                        setSubtaskEndDate("");
                                      }}
                                    >
                                      <i className="ti-close"></i>
                                      No deadline
                                    </button>

                                    <button
                                      type="button"
                                      className={
                                        subtaskDateMode === "deadline"
                                          ? "active"
                                          : ""
                                      }
                                      onClick={() =>
                                        setSubtaskDateMode("deadline")
                                      }
                                    >
                                      <i className="ti-calendar"></i>
                                      Set deadline
                                    </button>
                                  </div>

                                  {subtaskDateMode === "deadline" && (
                                    <div className="workspace_clickup_date_inputs">
                                      <label>
                                        <span>Start date</span>
                                        <input
                                          type="date"
                                          value={subtaskStartDate}
                                          onChange={(e) =>
                                            setSubtaskStartDate(e.target.value)
                                          }
                                        />
                                      </label>

                                      <label>
                                        <span>End date</span>
                                        <input
                                          type="date"
                                          value={subtaskEndDate}
                                          min={subtaskStartDate}
                                          onChange={(e) =>
                                            setSubtaskEndDate(e.target.value)
                                          }
                                        />
                                      </label>
                                    </div>
                                  )}

                                  <div className="workspace_clickup_date_footer">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSubtaskDateMode("none");
                                        setSubtaskStartDate("");
                                        setSubtaskEndDate("");
                                        setIsSubtaskDateOpen(false);
                                      }}
                                    >
                                      Clear
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setIsSubtaskDateOpen(false)
                                      }
                                    >
                                      Apply
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="workspace_clickup_subtask_tool_wrap">
                              <button
                                type="button"
                                title="Priority"
                                onClick={() => {
                                  setIsSubtaskPriorityOpen(
                                    !isSubtaskPriorityOpen,
                                  );
                                  setIsSubtaskDateOpen(false);
                                }}
                              >
                                <i className="ti-flag-alt"></i>
                              </button>

                              {isSubtaskPriorityOpen && (
                                <div className="workspace_clickup_subtask_menu priority_menu">
                                  <strong>Priority</strong>

                                  {["Urgent", "High", "Normal", "Low"].map(
                                    (priorityOption) => (
                                      <button
                                        type="button"
                                        key={priorityOption}
                                        className={
                                          subtaskPriority === priorityOption
                                            ? "active"
                                            : ""
                                        }
                                        onClick={() => {
                                          setSubtaskPriority(priorityOption);
                                          setIsSubtaskPriorityOpen(false);
                                        }}
                                      >
                                        <span>
                                          {getSubtaskPriorityIcon(
                                            priorityOption,
                                          )}
                                        </span>
                                        {priorityOption}
                                      </button>
                                    ),
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubtaskPriority("");
                                      setIsSubtaskPriorityOpen(false);
                                    }}
                                  >
                                    <span>⊘</span>
                                    Clear
                                  </button>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              className="workspace_clickup_subtask_cancel"
                              onClick={handleCancelSubtask}
                            >
                              Cancel
                            </button>

                            <button
                              type="submit"
                              className="workspace_clickup_subtask_save"
                            >
                              Save ↵
                            </button>
                          </div>
                        )}
                      </form>
                    ) : (
                      <p className="workspace_permission_hint">
                        Only workspace admins can add or update subtasks.
                      </p>
                    )}

                    {subtasks.length > 0 && (
                      <div className="workspace_clickup_subtask_list">
                        {subtasks.map((subtask) => (
                          <article
                            className={`workspace_clickup_subtask_item ${
                              subtask.isDone ? "completed" : ""
                            }`}
                            key={subtask.id}
                          >
                            <button
                              type="button"
                              className="workspace_clickup_subtask_check"
                              onClick={() => handleToggleSubtask(subtask.id)}
                              disabled={!canManageTopics}
                            >
                              {subtask.isDone ? (
                                <i className="ti-check"></i>
                              ) : null}
                            </button>

                            <div className="workspace_clickup_subtask_info">
                              <strong>{subtask.title}</strong>

                              <div>
                                {subtask.priority && (
                                  <span>
                                    {getSubtaskPriorityIcon(subtask.priority)}{" "}
                                    {subtask.priority}
                                  </span>
                                )}

                                {subtask.dateMode === "deadline" && (
                                  <span>
                                    <i className="ti-calendar"></i>
                                    {subtask.startDate || "No start"} →{" "}
                                    {subtask.endDate || "No end"}
                                  </span>
                                )}

                                {subtask.dateMode !== "deadline" && (
                                  <span>
                                    <i className="ti-close"></i>
                                    No deadline
                                  </span>
                                )}

                                <span>
                                  <i className="ti-user"></i>
                                  {subtask.assignee || profileName}
                                </span>
                              </div>
                            </div>

                            {canManageTopics && (
                              <button
                                type="button"
                                className="workspace_clickup_subtask_delete"
                                onClick={() => handleDeleteSubtask(subtask.id)}
                              >
                                <i className="ti-trash"></i>
                              </button>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                </section>
              )}

              <section className="workspace_clickup_attachment_section">
                    <div className="workspace_clickup_attachment_header">
                      <div>
                        <h2>Attachments</h2>
                        <span>{relatedFiles.length}</span>
                      </div>
                    </div>

                    {canManageTopics ? (
                      <label className="workspace_clickup_drop_zone">
                        Drop your files here to <span>upload</span>
                        <input
                          type="file"
                          multiple
                          onChange={handleTopicFileChange}
                        />
                      </label>
                    ) : (
                      <p className="workspace_permission_hint">
                        Only workspace admins can upload attachments to
                        topics.
                      </p>
                    )}

                    {relatedFiles.length === 0 ? (
                      <div className="workspace_clickup_attachment_empty">
                        <i className="ti-clip"></i>
                        <h3>No attachments yet</h3>
                        <p>
                          Upload files related to this topic so members can
                          review them.
                        </p>
                      </div>
                    ) : (
                      <div className="workspace_clickup_attachment_grid">
                        {relatedFiles.map((file) => (
                          <article
                            className="workspace_clickup_attachment_card"
                            key={file.id}
                          >
                            <div className="workspace_clickup_attachment_preview">
                              <i className="ti-clip"></i>
                              <div className="workspace_clickup_attachment_file_actions">
                                <button
                                  type="button"
                                  onClick={() => handleViewTopicAttachment(file)}
                                  title="View file"
                                  aria-label={`View ${file.fileName || file.name}`}
                                >
                                  <i className="ti-eye" aria-hidden="true"></i>
                                  <span>View</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadTopicAttachment(file)}
                                  title="Download file"
                                  aria-label={`Download ${file.fileName || file.name}`}
                                >
                                  <i className="ti-download" aria-hidden="true"></i>
                                  <span>Download</span>
                                </button>
                              </div>
                            </div>

                            <div className="workspace_clickup_attachment_info">
                              <div>
                                <strong>{file.fileName || file.name}</strong>
                                <span>
                                  {file.createdAt
                                    ? new Date(
                                        file.createdAt,
                                      ).toLocaleDateString()
                                    : "Just now"}
                                </span>
                                <span className="workspace_clickup_attachment_uploader">
                                  Uploaded by {file.uploader?.name || "Workspace member"}
                                </span>
                              </div>

                              <div className="workspace_clickup_attachment_actions">
                                <span
                                  className="workspace_clickup_attachment_owner"
                                  title={file.uploader?.name || "Workspace member"}
                                >
                                  {(file.uploader?.name || "W")
                                    .slice(0, 1)
                                    .toUpperCase()}
                                </span>

                                {canManageTopics && (
                                  <button
                                    type="button"
                                    className="workspace_clickup_attachment_delete"
                                    onClick={() =>
                                      handleDeleteTopicFile(file.id)
                                    }
                                    title="Delete file"
                                  >
                                    <i className="ti-trash"></i>
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
              </section>
            </>
          )}

          {activeTopicSection === "details" && (
            <section className="workspace_topic_solutions">
              <header>
                <div>
                  <span>Community solutions</span>
                  <h2>Share your solution</h2>
                  <p>
                    Upload, review, and update your own solution for this topic.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={hasCurrentUserSubmittedSolution}
                  aria-disabled={hasCurrentUserSubmittedSolution}
                  title={
                    hasCurrentUserSubmittedSolution
                      ? "You have already submitted a solution. Use Edit to update it."
                      : "Upload your solution"
                  }
                  onClick={() => {
                    if (hasCurrentUserSubmittedSolution) return;
                    setEditingSolutionId(null);
                    setSolutionContent("");
                    setSolutionAttachments([]);
                    setIsSolutionFormOpen((isOpen) => !isOpen);
                  }}
                >
                  <i
                    className={
                      hasCurrentUserSubmittedSolution
                        ? "ti-check"
                        : "ti-upload"
                    }
                  ></i>
                  {hasCurrentUserSubmittedSolution
                    ? "Solution submitted"
                    : "Upload your solution"}
                </button>
              </header>

              {isSolutionFormOpen && (
                <form
                  className="workspace_solution_form"
                  onSubmit={handleSubmitSolution}
                >
                  <label htmlFor="solution-content">
                    {editingSolutionId ? "Edit your solution" : "Your solution"}
                  </label>
                  <textarea
                    id="solution-content"
                    value={solutionContent}
                    onChange={(event) => setSolutionContent(event.target.value)}
                    placeholder="Explain your approach and provide the steps for your solution..."
                    autoFocus
                  />

                  <div className="workspace_solution_form_files">
                    <label>
                      <i className="ti-clip"></i>
                      Attach files
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        multiple
                        disabled={isUploadingSolution}
                        onChange={handleSolutionFileChange}
                      />
                    </label>
                    <span>Optional · PDF, DOCX or TXT · up to 10 files</span>
                  </div>

                  {editingSolutionId &&
                    solutionFiles.some(
                      (file) => file.solutionId === editingSolutionId,
                    ) && (
                      <div className="workspace_solution_selected_files">
                        {solutionFiles
                          .filter(
                            (file) => file.solutionId === editingSolutionId,
                          )
                          .map((file) => (
                            <div key={file.id}>
                              <span>
                                <i className="ti-file"></i>
                                {normalizeDisplayFileName(
                                  file.fileName || file.name,
                                )}
                                <small>
                                  {formatWorkspaceFileSize(
                                    file.fileSizeBytes,
                                  )}
                                </small>
                              </span>
                              <button
                                type="button"
                                aria-label={`Remove ${file.fileName || file.name}`}
                                title="Remove attachment"
                                disabled={isUploadingSolution}
                                onClick={() =>
                                  handleDeleteSolutionFile(file.id)
                                }
                              >
                                ×
                              </button>
                            </div>
                          ))}
                      </div>
                    )}

                  {solutionAttachments.length > 0 && (
                    <div className="workspace_solution_selected_files">
                      {solutionAttachments.map((file, index) => (
                        <div key={`${file.name}-${file.lastModified}-${index}`}>
                          <span>
                            <i className="ti-file"></i>
                            {file.name}
                            <small>{formatWorkspaceFileSize(file.size)}</small>
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={() =>
                              setSolutionAttachments((files) =>
                                files.filter(
                                  (_, fileIndex) => fileIndex !== index,
                                ),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <footer>
                    <button
                      type="button"
                      disabled={isUploadingSolution}
                      onClick={() => {
                        setIsSolutionFormOpen(false);
                        setSolutionContent("");
                        setSolutionAttachments([]);
                        setEditingSolutionId(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" disabled={isUploadingSolution}>
                      {isUploadingSolution
                        ? "Saving..."
                        : editingSolutionId
                          ? "Save changes"
                          : "Submit solution"}
                    </button>
                  </footer>
                </form>
              )}

              {currentUserSolutions.length === 0 ? (
                <div className="workspace_topic_solution_empty">
                  <i className="ti-light-bulb"></i>
                  <h3>You have not submitted a solution yet</h3>
                  <p>
                    Upload your solution when you are ready to share your work.
                  </p>
                </div>
              ) : (
                <div className="workspace_topic_solution_grid">
                  {currentUserSolutions.map((solution) => {
                    const attachedFiles = solutionFiles.filter(
                      (file) => file.solutionId === solution.id,
                    );

                    return (
                      <article key={solution.id}>
                        <div className="workspace_topic_solution_avatar">
                          {solution.author?.avatarUrl ? (
                            <img src={solution.author.avatarUrl} alt="" />
                          ) : (
                            (solution.author?.name || "M")
                              .slice(0, 1)
                              .toUpperCase()
                          )}
                        </div>
                        <div className="workspace_topic_solution_info">
                          <div className="workspace_topic_solution_heading">
                            <strong>
                              {solution.author?.name || "Workspace member"}
                            </strong>
                            {currentUserId &&
                              String(
                                solution.userId || solution.author?.id || "",
                              ) === currentUserId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSolutionId(solution.id);
                                    setSolutionContent(solution.content || "");
                                    setSolutionAttachments([]);
                                    setIsSolutionFormOpen(true);
                                  }}
                                >
                                  <i className="ti-pencil"></i>
                                  Edit
                                </button>
                              )}
                          </div>
                          <small>
                            {solution.createdAt
                              ? new Date(solution.createdAt).toLocaleString()
                              : "Just now"}
                          </small>
                          <p>{getSolutionPreview(solution.content)}</p>
                          <button
                            type="button"
                            className="workspace_solution_view_detail"
                            onClick={() => setSelectedSolutionDetail(solution)}
                          >
                            View detail
                          </button>
                          {attachedFiles.length > 0 && (
                            <div className="workspace_topic_solution_files">
                              {attachedFiles.map((file) => (
                                <span key={file.id}>
                                  <span className="workspace_solution_file_label">
                                    <i className="ti-clip"></i>
                                    {normalizeDisplayFileName(
                                      file.fileName || file.name,
                                    )}
                                    <small>
                                      {formatWorkspaceFileSize(
                                        file.fileSizeBytes,
                                      )}
                                    </small>
                                  </span>
                                  <button
                                    type="button"
                                    className="view"
                                    onClick={() =>
                                      handleViewTopicAttachment(file, "solution")
                                    }
                                  >
                                    <i className="ti-eye" aria-hidden="true"></i>
                                    View file
                                  </button>
                                  <button
                                    type="button"
                                    className="download"
                                    onClick={() =>
                                      handleDownloadTopicAttachment(file)
                                    }
                                  >
                                    <i className="ti-download" aria-hidden="true"></i>
                                    Download
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activeTopicSection === "solutions" && (
            <section className="workspace_topic_solutions workspace_topic_solutions_list_only">
              <header>
                <div>
                  <span>Community solutions</span>
                  <h2>Solutions from members</h2>
                  <p>
                    Review the approaches and files submitted by workspace
                    members.
                  </p>
                </div>
              </header>

              {solutions.length === 0 ? (
                <div className="workspace_topic_solution_empty">
                  <i className="ti-light-bulb"></i>
                  <h3>No solutions yet</h3>
                  <p>Submitted solutions will appear here.</p>
                </div>
              ) : (
                <div className="workspace_topic_solution_grid">
                  {solutions.map((solution) => {
                    const attachedFiles = solutionFiles.filter(
                      (file) => file.solutionId === solution.id,
                    );

                    return (
                      <article key={solution.id}>
                        <div className="workspace_topic_solution_avatar">
                          {solution.author?.avatarUrl ? (
                            <img src={solution.author.avatarUrl} alt="" />
                          ) : (
                            (solution.author?.name || "M")
                              .slice(0, 1)
                              .toUpperCase()
                          )}
                        </div>
                        <div className="workspace_topic_solution_info">
                          <strong>
                            {solution.author?.name || "Workspace member"}
                          </strong>
                          <small>
                            {solution.createdAt
                              ? new Date(solution.createdAt).toLocaleString()
                              : "Just now"}
                          </small>
                          <p>{getSolutionPreview(solution.content)}</p>
                          <button
                            type="button"
                            className="workspace_solution_view_detail"
                            onClick={() => setSelectedSolutionDetail(solution)}
                          >
                            View detail
                          </button>
                          {attachedFiles.length > 0 && (
                            <div className="workspace_topic_solution_files">
                              {attachedFiles.map((file) => (
                                <span key={file.id}>
                                  <span className="workspace_solution_file_label">
                                    <i className="ti-clip"></i>
                                    {normalizeDisplayFileName(
                                      file.fileName || file.name,
                                    )}
                                    <small>
                                      {formatWorkspaceFileSize(
                                        file.fileSizeBytes,
                                      )}
                                    </small>
                                  </span>
                                  <button
                                    type="button"
                                    className="view"
                                    onClick={() =>
                                      handleViewTopicAttachment(file, "solution")
                                    }
                                  >
                                    <i className="ti-eye" aria-hidden="true"></i>
                                    View file
                                  </button>
                                  <button
                                    type="button"
                                    className="download"
                                    onClick={() =>
                                      handleDownloadTopicAttachment(file)
                                    }
                                  >
                                    <i className="ti-download" aria-hidden="true"></i>
                                    Download
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          {renderSolutionComments(solution)}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {selectedSolutionDetail &&
            (() => {
              const detailFiles = solutionFiles.filter(
                (file) => file.solutionId === selectedSolutionDetail.id,
              );

              return (
                <div
                  className="workspace_solution_detail_overlay"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Solution detail"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget)
                      setSelectedSolutionDetail(null);
                  }}
                >
                  <article className="workspace_solution_detail_modal">
                    <button
                      type="button"
                      className="workspace_solution_detail_close"
                      onClick={() => setSelectedSolutionDetail(null)}
                      aria-label="Close solution detail"
                    >
                      ×
                    </button>
                    <header>
                      <div className="workspace_topic_solution_avatar">
                        {selectedSolutionDetail.author?.avatarUrl ? (
                          <img
                            src={selectedSolutionDetail.author.avatarUrl}
                            alt=""
                          />
                        ) : (
                          (selectedSolutionDetail.author?.name || "M")
                            .slice(0, 1)
                            .toUpperCase()
                        )}
                      </div>
                      <div>
                        <h2>
                          {selectedSolutionDetail.author?.name ||
                            "Workspace member"}
                        </h2>
                        <span>
                          {selectedSolutionDetail.createdAt
                            ? new Date(
                                selectedSolutionDetail.createdAt,
                              ).toLocaleString()
                            : "Just now"}
                        </span>
                      </div>
                    </header>
                    <div className="workspace_solution_detail_content">
                      {selectedSolutionDetail.content}
                    </div>
                    {detailFiles.length > 0 && (
                      <div className="workspace_solution_detail_files">
                        <strong>Attachments</strong>
                        {detailFiles.map((file) => (
                          <div
                            className="workspace_solution_detail_file_actions"
                            key={file.id}
                          >
                            <button
                              type="button"
                              className="workspace_solution_attachment_view"
                              onClick={() =>
                                handleViewTopicAttachment(file, "solution")
                              }
                            >
                              <i className="ti-clip"></i>
                              {normalizeDisplayFileName(
                                file.fileName || file.name,
                              )}
                              <small>
                                {formatWorkspaceFileSize(file.fileSizeBytes)}
                              </small>
                              <span>View file</span>
                              <i className="ti-eye" aria-hidden="true"></i>
                            </button>
                            <button
                              type="button"
                              className="workspace_solution_attachment_download"
                              onClick={() =>
                                handleDownloadTopicAttachment(file)
                              }
                            >
                              <i className="ti-download" aria-hidden="true"></i>
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                </div>
              );
            })()}

          {selectedCommentsSolution && (
            <div
              className="workspace_solution_detail_overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="solution-comments-title"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedSolutionCommentsId(null);
                }
              }}
            >
              <article className="workspace_solution_comments_modal">
                <button
                  type="button"
                  className="workspace_solution_detail_close"
                  onClick={() => setSelectedSolutionCommentsId(null)}
                  aria-label="Close comments"
                >
                  ×
                </button>
                <header>
                  <span className="workspace_solution_comments_modal_icon">
                    <i className="ti-comment-alt" aria-hidden="true"></i>
                  </span>
                  <div>
                    <h2 id="solution-comments-title">Solution comments</h2>
                    <p>
                      Comments on {selectedCommentsSolution.author?.name || "this member"}&apos;s solution
                    </p>
                  </div>
                </header>

                {(selectedCommentsSolution.replies || []).length > 0 ? (
                  <div className="workspace_solution_comments_modal_list">
                    {(selectedCommentsSolution.replies || []).map((reply) => (
                      <div className="workspace_solution_comment" key={reply.id}>
                        <span className="workspace_solution_comment_avatar">
                          {reply.author?.avatarUrl ? (
                            <img src={reply.author.avatarUrl} alt="" />
                          ) : (
                            (reply.author?.name || "M").slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <div>
                          <strong>{reply.author?.name || "Workspace member"}</strong>
                          <small>
                            {reply.createdAt
                              ? new Date(reply.createdAt).toLocaleString()
                              : "Just now"}
                          </small>
                          <p>{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="workspace_solution_comments_empty">
                    <i className="ti-comment-alt" aria-hidden="true"></i>
                    <h3>No comments yet</h3>
                    <p>Be the first to leave a comment on this solution.</p>
                  </div>
                )}
              </article>
            </div>
          )}
        </main>

      </section>
    );
  }

  return (
    <section className="discussion_tab_page">
      <div className="discussion_intro_row">
        <div>
          <span className="discussion_label">Student discussion</span>
          <h2>Discussion Board</h2>
          <p>
            Ask questions, share learning materials, and discuss lessons with
            members in this workspace.
          </p>
        </div>

        <div className="discussion_intro_actions">
          <Link
            to="/dashboard/workspaces"
            className="discussion_back_workspaces_btn"
          >
            <i className="ti-arrow-left"></i>
            My Workspaces
          </Link>

          {canManageTopics ? (
            <button
              type="button"
              className="new_discussion_topic_btn"
              onClick={() => setIsTopicFormOpen(true)}
            >
              <i className="ti-plus"></i>
              New Topic
            </button>
          ) : (
            <span className="workspace_permission_pill">
              <i className="ti-eye"></i>
              Contributor mode
            </span>
          )}
        </div>
      </div>

      <div className="discussion_filter_row">
        <button
          type="button"
          className={topicFilter === "All" ? "active" : ""}
          onClick={() => setTopicFilter("All")}
        >
          All topics
        </button>

        <button
          type="button"
          className={topicFilter === "Solved" ? "active" : ""}
          onClick={() => setTopicFilter("Solved")}
        >
          Solved
        </button>
      </div>
      {(isLoadingDiscussion || discussionStatus) && (
        <div className="workspace_permission_hint">
          {isLoadingDiscussion
            ? "Loading discussion topics..."
            : discussionStatus}
        </div>
      )}
      {isTopicFormOpen && canManageTopics && (
        <div className="discussion_topic_modal_overlay">
          <form
            className="discussion_create_card discussion_topic_modal_card"
            onSubmit={handleCreateTopic}
          >
            <button
              type="button"
              className="discussion_topic_modal_close"
              onClick={() => setIsTopicFormOpen(false)}
              aria-label="Close create topic popup"
            >
              ×
            </button>

            <div className="discussion_create_header">
              <div>
                <h3>Create new topic</h3>
                <p>Started by {profileName}</p>
              </div>
            </div>

            <div className="discussion_form_group">
              <label>Topic title</label>
              <input
                value={topicTitle}
                onChange={(e) => setTopicTitle(e.target.value)}
                placeholder="Example: Why does this constraint use >= ?"
                autoFocus
              />
            </div>

            <div className="discussion_form_group">
              <label>Topic description</label>
              <textarea
                value={newTopicDescription}
                onChange={(e) => setNewTopicDescription(e.target.value)}
                placeholder="Describe the problem, lesson note, question, or material you want members to discuss..."
              />
            </div>

            <div className="discussion_form_group discussion_new_topic_attachments">
              <label>Upload attachment</label>
              <label className="discussion_attachment_picker">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  multiple
                  onChange={handleNewTopicAttachmentsChange}
                  disabled={isCreatingTopic}
                />
                <i className="ti-clip" aria-hidden="true"></i>
                <span>
                  <strong>Choose files</strong>
                  <small>PDF, DOCX or TXT · up to 10 files</small>
                </span>
              </label>

              {newTopicAttachments.length > 0 && (
                <div className="discussion_attachment_selection">
                  {newTopicAttachments.map((file, index) => (
                    <div key={`${file.name}-${file.lastModified}-${index}`}>
                      <span>
                        <i className="ti-file" aria-hidden="true"></i>
                        <span>
                          <strong>{file.name}</strong>
                          <small>{formatWorkspaceFileSize(file.size)}</small>
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          setNewTopicAttachments((files) =>
                            files.filter((_, fileIndex) => fileIndex !== index),
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="discussion_create_actions">
              <button
                type="button"
                onClick={() => setIsTopicFormOpen(false)}
                disabled={isCreatingTopic}
              >
                Cancel
              </button>

              <button type="submit" disabled={isCreatingTopic}>
                {isCreatingTopic ? "Creating..." : "Create topic"}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="discussion_content_grid">
        <div className="discussion_content_left">
          {discussionTopics.length === 0 && !isTopicFormOpen ? (
            <section className="discussion_empty_state">
              <div className="discussion_empty_icon">
                <i className="ti-comments"></i>
              </div>

              <h3>No discussion topic yet</h3>
              <p>
                Start the first topic so members can ask questions, share notes,
                and exchange study materials.
              </p>
              {canManageTopics ? (
                <button type="button" onClick={() => setIsTopicFormOpen(true)}>
                  Create first topic
                </button>
              ) : (
                <span className="workspace_permission_pill">
                  Workspace admins can create topics
                </span>
              )}
            </section>
          ) : null}

          {filteredDiscussionTopics.length > 0 && (
            <>
              <section className="discussion_topic_list">
                {filteredDiscussionTopics.map((topic) => (
                  <article
                    className="discussion_topic_card"
                    key={topic.id}
                    onClick={() => {
                      setSelectedTopicId(topic.id);
                      setTopicContent(topic.content || "");
                      setTopicCommentInput("");
                      setTopicSubtaskInput("");
                    }}
                  >
                    <div className="discussion_topic_type">
                      <span>{topic.type || "Question"}</span>
                      <small>{topic.updatedAt}</small>
                    </div>

                    <h3>{topic.title}</h3>
                    <p>
                      Started by {topic.creator}. Open this topic to reply, add
                      study notes, and attach learning files.
                    </p>

                    <div className="discussion_topic_meta">
                      <span>
                        <i className="ti-comment-alt"></i>
                        {topic.comments?.length || 0} solution
                      </span>

                      <span>
                        <i className="ti-clip"></i>
                        {topic.files?.length || 0} files
                      </span>

                      <span>
                        <i className="ti-check"></i>
                        {topic.status || "Open"}
                      </span>
                    </div>
                  </article>
                ))}
              </section>
              {discussionTopics.length > 0 &&
                filteredDiscussionTopics.length === 0 && (
                  <section className="discussion_empty_state">
                    <div className="discussion_empty_icon">
                      <i className="ti-filter"></i>
                    </div>

                    <h3>No matching topics</h3>
                    <p>
                      There are no topics matching this filter. Try another
                      topic type or create a new one.
                    </p>

                    <button type="button" onClick={() => setTopicFilter("All")}>
                      Show all topics
                    </button>
                  </section>
                )}
            </>
          )}
        </div>

        <aside className="discussion_content_sidebar">
          <section className="discussion_side_card">
            <div className="discussion_side_title">
              <h3>Discussion overview</h3>
              <i className="ti-comments"></i>
            </div>

            <div className="discussion_stats_grid">
              <div>
                <strong>{discussionTopics.length}</strong>
                <span>Topics</span>
              </div>

              <div>
                <strong>{totalTopicFiles}</strong>
                <span>Files</span>
              </div>
            </div>
          </section>

          <section className="workspace_storage_card">
            <div className="workspace_storage_header">
              <div className="workspace_storage_icon">
                <i className="ti-harddrives"></i>
              </div>

              <div>
                <h3>Workspace Storage</h3>
                <p>Storage used by files uploaded in discussion topics</p>
              </div>
            </div>

            <div className="workspace_storage_limit_row">
              <strong>Storage limit</strong>
              <span>
                {formatWorkspaceStorageSize(workspaceStorageUsedBytes)} / 50.0
                MB
              </span>
            </div>

            <div className="workspace_storage_progress">
              <div style={{ width: `${workspaceStoragePercent}%` }}></div>
            </div>

            <div className="workspace_storage_numbers">
              <div>
                <strong>
                  {formatWorkspaceStorageSize(workspaceStorageUsedBytes)}
                </strong>
                <span>Used</span>
              </div>

              <div>
                <strong>
                  {formatWorkspaceStorageSize(workspaceStorageRemainingBytes)}
                </strong>
                <span>Remaining</span>
              </div>
            </div>
          </section>

          <section className="discussion_side_card">
            <div className="discussion_side_title">
              <h3>Topic guide</h3>
              <i className="ti-light-bulb"></i>
            </div>

            <ul className="discussion_guide_list">
              <li>
                Use Question when you need help with a lesson or exercise.
              </li>
              <li>Use Material when you share notes, slides, or documents.</li>
              <li>
                Use Announcement for deadlines, schedules, or group updates.
              </li>
            </ul>
          </section>

          <section className="workspace_about_card">
            <div className="workspace_about_header">
              <i className="ti-bookmark-alt"></i>
              <h3>About this workspace</h3>
            </div>

            <p>
              {workspace?.description ||
                "This workspace helps students discuss lessons, share documents, and collaborate with selected members."}
            </p>
          </section>
        </aside>
      </section>
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
