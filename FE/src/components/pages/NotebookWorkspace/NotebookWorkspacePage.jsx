import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import {
  HiOutlineChevronRight,
  HiOutlineChevronDown,
  HiOutlinePaperAirplane,
  HiOutlineDocumentDuplicate,
  HiOutlineSparkles,
  HiOutlineLightBulb,
  HiOutlineAcademicCap,
  HiOutlineQuestionMarkCircle,
  HiOutlineArrowLeft,
  HiOutlineArrowPath,
  HiOutlineArrowRight,
  HiOutlineCog6Tooth,
  HiOutlineTrash,
  HiOutlineXMark,
  HiMiniStop,
} from "react-icons/hi2";
import {
  getLibrary,
  getMyDocuments,
  uploadDocuments,
  downloadDocument,
  deleteDocument,
  updateLibrary,
  deleteLibrary,
  retryDocumentTags,
} from "../../../utils/documentApi.js";
import {
  downloadPublicDocument,
  getPublicLibrary,
} from "../../../utils/publicApi.js";
import {
  LuPanelLeftOpen,
  LuPanelRightClose,
  LuPanelRightOpen,
} from "react-icons/lu";
import {
  chatWithDocument,
  deleteChatHistory,
  getChatHistory,
} from "../../../utils/aiApi.js";
import { getStoredUser } from "../../../utils/authToken.js";
import { getMyProfile } from "../../../utils/profileApi.js";
import { createAppNotification } from "../../../utils/notificationStore.js";
import Toast from "../../common/Toast/Toast.jsx";
import { showPopupConfirm } from "../../common/ActionPopup/actionPopupService.js";
import SourcesSidebar from "./SourcesSidebar.jsx";
import DeleteConfirmModal from "./DeleteConfirmModal.jsx";
import DuplicateConfirmModal from "./DuplicateConfirmModal.jsx";
import "./NotebookWorkspacePage.css";

function createConversationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = character === "x" ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
}

function formatAiMessageText(content) {
  return String(content || "")
    .replace(/\r\n?/g, "\n")
    .replace(/([^\n])\s+(#{1,6})\s+/g, "$1\n\n$2 ")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatLibraryDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

/**
 * NotebookWorkspacePage Component
 * 2-Panel Google NotebookLM Style Workspace Interface:
 *  - Left Panel: Sources (File uploads with extended format support like PDF, DOCX, TXT, MD, CSV, MP3, Code; View & Download buttons; Select All checkboxes)
 *  - Main Panel: Modern Chat Stream & Starter Prompt Cards (High contrast styling, NotebookLM header, collapsible Thoughts accordion, markdown, citations [1],[2], prompt input)
 *
 * 100% English UI labels & custom English Toast popups. Chat history is persisted directly to Supabase DB.
 */
export default function NotebookWorkspacePage() {
  const { libraryId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();
  const isGuest = String(user?.role || "").toUpperCase() === "GUEST";

  // Library & documents state
  const [library, setLibrary] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [accessMode, setAccessMode] = useState("loading");
  const [libraryLoadError, setLibraryLoadError] = useState("");

  // Left Panel visibility state
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Chat stream & message state
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [sessionConversationId, setSessionConversationId] = useState(
    () => createConversationId(),
  );
  const sessionConversationIdRef = useRef(sessionConversationId);
  const [historyActionBusy, setHistoryActionBusy] = useState(false);
  const [inputQuery, setInputQuery] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [thoughtsOpenMap, setThoughtsOpenMap] = useState({});
  const [userAvatar, setUserAvatar] = useState(user?.avatar_url || "");

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [retryingDocumentIds, setRetryingDocumentIds] = useState(new Set());

  // Library settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [libraryName, setLibraryName] = useState("");
  const [libraryDescription, setLibraryDescription] = useState("");
  const [allowPublish, setAllowPublish] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isDeletingLibrary, setIsDeletingLibrary] = useState(false);

  // Toast Notification state
  const [toast, setToast] = useState({ message: "", title: "", type: "info" });

  const showToast = (message, title = "Notification", type = "info") => {
    setToast({ message, title, type });
  };

  const chatContainerRef = useRef(null);
  const chatRequestAbortRef = useRef(null);
  const fileInputRef = useRef(null);
  const pendingChatHandledRef = useRef(false);
  const primarySelectedDocumentId = Array.from(selectedDocIds)[0] || "";
  const userDisplayName =
    user?.full_name || user?.username || user?.email || "User";
  const userInitial = String(userDisplayName).trim().charAt(0).toUpperCase() || "U";
  const canManageLibrary = accessMode === "owner" && !isGuest;
  const isPublicLearner = accessMode === "publicLearner";
  const libraryOwner = library?.owner || {};
  const libraryOwnerName =
    libraryOwner.full_name ||
    libraryOwner.fullName ||
    libraryOwner.username ||
    "StudyHub member";
  const libraryOwnerInitial =
    String(libraryOwnerName).trim().charAt(0).toUpperCase() || "S";

  const setCurrentConversation = (conversationId) => {
    const nextConversationId = conversationId || createConversationId();
    sessionConversationIdRef.current = nextConversationId;
    setSessionConversationId(nextConversationId);
    return nextConversationId;
  };

  /**
   * Load library details, documents, and chat history on mount
   */
  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaceData() {
      try {
        setAccessMode("loading");
        setLibraryLoadError("");

        let loadedLibrary;
        let docs;
        let resolvedAccessMode;

        if (isGuest) {
          const publicData = await getPublicLibrary(libraryId);
          loadedLibrary = publicData?.library;
          docs = Array.isArray(publicData?.documents) ? publicData.documents : [];
          resolvedAccessMode = "publicLearner";
        } else {
          try {
            const [ownedLibrary, ownedDocuments] = await Promise.all([
              getLibrary(libraryId),
              getMyDocuments(libraryId),
            ]);
            loadedLibrary = ownedLibrary?.data || ownedLibrary;
            docs = Array.isArray(ownedDocuments)
              ? ownedDocuments
              : ownedDocuments?.data || [];
            resolvedAccessMode = "owner";
          } catch (ownerError) {
            if (ownerError.response?.status !== 404) throw ownerError;

            const publicData = await getPublicLibrary(libraryId);
            loadedLibrary = publicData?.library;
            docs = Array.isArray(publicData?.documents) ? publicData.documents : [];
            resolvedAccessMode = "publicLearner";
          }
        }

        if (!loadedLibrary) {
          throw new Error("Library data is unavailable.");
        }

        if (isMounted) {
          setLibrary(loadedLibrary);
          setLibraryName(loadedLibrary.name || loadedLibrary.libraryName || "");
          setAllowPublish(Boolean(loadedLibrary.is_public ?? loadedLibrary.isPublic));
          setDocuments(docs);
          setAccessMode(resolvedAccessMode);

          // Guests can inspect public files, but they never enter AI source state.
          const allIds = isGuest ? new Set() : new Set(docs.map((d) => d.id));
          setSelectedDocIds(allIds);
          setSelectAll(!isGuest && docs.length > 0);
        }

        // Fetch DB chat history (no localStorage)
        if (!isGuest) {
          const history = await getChatHistory();
          if (isMounted && Array.isArray(history)) {
            const documentIds = new Set(docs.map((document) => String(document.id)));
            const libraryHistory = history.filter((conversation) => {
              const docId = String(conversation.documentId || "");
              return !docId || documentIds.has(docId);
            });
            setChatHistory(libraryHistory);
          }
        }
      } catch (err) {
        console.error("Failed to load workspace data:", err);
        if (isMounted) {
          setLibrary(null);
          setDocuments([]);
          setSelectedDocIds(new Set());
          setSelectAll(false);
          setAccessMode("denied");
          setLibraryLoadError(
            err.response?.data?.message ||
              "This library does not exist or is not available to your account.",
          );
        }
      }
    }

    loadWorkspaceData();
    return () => {
      isMounted = false;
    };
  }, [libraryId, isGuest]);

  useEffect(() => {
    if (isGuest) return undefined;

    let isMounted = true;

    getMyProfile()
      .then((profile) => {
        if (isMounted) setUserAvatar(profile?.avatar_url || "");
      })
      .catch(() => {
        // Keep the stored avatar or initials fallback when profile loading fails.
      });

    return () => {
      isMounted = false;
    };
  }, [isGuest]);

  useEffect(() => {
    if (isGuest || accessMode !== "owner") return undefined;

    const hasPendingTagging = documents.some((document) =>
      ["PENDING", "PROCESSING"].includes(
        String(document.tagging_status || "").toUpperCase(),
      ),
    );
    if (!hasPendingTagging) return undefined;

    let isMounted = true;
    const intervalId = window.setInterval(async () => {
      try {
        const updatedDocuments = await getMyDocuments(libraryId);
        if (!isMounted) return;
        const nextDocuments = Array.isArray(updatedDocuments)
          ? updatedDocuments
          : updatedDocuments?.data || [];
        setDocuments(nextDocuments);
      } catch (error) {
        console.warn("Could not refresh AI tagging status:", error);
      }
    }, 2500);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [accessMode, documents, isGuest, libraryId]);

  /**
   * Scroll chat to bottom when messages update
   */
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  /**
   * Toggle individual document selection for AI context
   */
  const handleToggleDocSelect = (docId) => {
    if (isGuest) return;
    const next = new Set(selectedDocIds);
    if (next.has(docId)) {
      next.delete(docId);
    } else {
      next.add(docId);
    }
    setSelectedDocIds(next);
    setSelectAll(next.size === documents.length);
  };

  /**
   * Toggle Select All documents
   */
  const handleToggleSelectAll = () => {
    if (isGuest) return;
    if (selectAll) {
      setSelectedDocIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedDocIds(new Set(documents.map((d) => d.id)));
      setSelectAll(true);
    }
  };

  // Duplicate confirm popup state
  const [duplicateConfirm, setDuplicateConfirm] = useState(null);

  /**
   * Perform document upload with optional replacement IDs
   */
  const performUpload = async (files, replacementIds = []) => {
    if (!canManageLibrary) return;

    setUploading(true);
    try {
      const res = await uploadDocuments(files, null, libraryId, [], null, replacementIds);
      if (res) {
        const updatedDocs = await getMyDocuments(libraryId);
        const docs = Array.isArray(updatedDocs) ? updatedDocs : (updatedDocs?.data || []);
        setDocuments(docs);
        setSelectedDocIds(new Set(docs.map((d) => d.id)));
        showToast("File uploaded successfully.", "Upload Complete", "success");

        // Trigger immediate in-app notification update on Bell icon
        const libNameText = library?.name ? `library "${library.name}"` : "library";
        createAppNotification({
          category: "file",
          action: "uploaded",
          title: "Document uploaded",
          message: `File "${files[0]?.name || "Document"}" has been uploaded to ${libNameText} successfully.`,
          icon: "ti-file",
          link: `/dashboard/libraries/${libraryId}`,
        });
      }
    } catch (err) {
      const duplicateData = err.response?.data;
      if (duplicateData?.code === "DUPLICATE_DOCUMENT") {
        const duplicates = Array.isArray(duplicateData.duplicates) ? duplicateData.duplicates : [];
        const conflictDoc = duplicates.find((d) => d.documentId);
        const filename = conflictDoc?.filename || files[0]?.name || "File";
        const replacementId = conflictDoc?.documentId || null;

        setDuplicateConfirm({
          files,
          filename,
          replacementIds: replacementId ? [replacementId] : [],
        });
      } else {
        showToast("Failed to upload document: " + (err.response?.data?.message || err.message || "Unknown error"), "Upload Error", "error");
      }
    } finally {
      setUploading(false);
    }
  };

  /**
   * File upload handler supporting full NotebookLM file types
   */
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    performUpload(files);
    e.target.value = "";
  };

  const handleRetryDocumentTags = async (documentId) => {
    if (!canManageLibrary) return;

    setRetryingDocumentIds((current) => new Set(current).add(documentId));
    setDocuments((current) =>
      current.map((document) =>
        String(document.id) === String(documentId)
          ? {
              ...document,
              tagging_status: "PENDING",
              tagging_error: null,
            }
          : document,
      ),
    );

    try {
      await retryDocumentTags(documentId);
      showToast(
        "AI tag generation has restarted.",
        "Generating Tags",
        "info",
      );
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Could not retry AI tag generation.";
      setDocuments((current) =>
        current.map((document) =>
          String(document.id) === String(documentId)
            ? {
                ...document,
                tagging_status: "FAILED",
                tagging_error: message,
              }
            : document,
        ),
      );
      showToast(message, "Tagging Retry Failed", "error");
    } finally {
      setRetryingDocumentIds((current) => {
        const next = new Set(current);
        next.delete(documentId);
        return next;
      });
    }
  };

  const handleConfirmReplace = async () => {
    if (!duplicateConfirm) return;
    const { files, replacementIds } = duplicateConfirm;
    setDuplicateConfirm(null);
    await performUpload(files, replacementIds);
  };

  /**
   * Handle document view
   */
  const handleViewDocument = (docId, e) => {
    e?.stopPropagation();
    navigate(`/dashboard/documents/${docId}`);
  };

  /**
   * Handle document download
   */
  const handleDownloadDocument = async (docId, title, e) => {
    e?.stopPropagation();
    try {
      const downloadData = isPublicLearner
        ? await downloadPublicDocument(docId)
        : await downloadDocument(docId);
      if (downloadData?.downloadUrl) {
        window.open(downloadData.downloadUrl, "_blank");
      } else {
        showToast(`Initiated download for "${title}".`, "Download", "info");
      }
    } catch (err) {
      showToast("Failed to download document: " + (err.message || "Unknown error"), "Download Error", "error");
    }
  };

  // Delete confirm popup state
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState(null);

  /**
   * Handle document deletion from DB and Supabase storage bucket
   */
  const handleConfirmDelete = async () => {
    if (!deleteConfirmDoc || !canManageLibrary) return;
    const { id: docId, title } = deleteConfirmDoc;
    setDeleteConfirmDoc(null);

    // Optimistically remove document from UI instantly (0ms latency)
    setDocuments((prevDocs) => prevDocs.filter((d) => String(d.id) !== String(docId)));
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      next.delete(docId);
      return next;
    });

    try {
      await deleteDocument(docId);
      showToast(`"${title}" has been deleted.`, "File Deleted", "success");

      // Trigger immediate in-app notification update on Bell icon
      const libNameText = library?.name ? `library "${library.name}"` : "library";
      createAppNotification({
        category: "file",
        action: "deleted",
        title: "Document deleted",
        message: `File "${title}" has been deleted from ${libNameText}.`,
        icon: "ti-trash",
        link: `/dashboard/libraries/${libraryId}`,
      });

      // Sync latest DB state
      const updatedDocs = await getMyDocuments(libraryId);
      const docs = Array.isArray(updatedDocs) ? updatedDocs : (updatedDocs?.data || []);
      setDocuments(docs);
    } catch (err) {
      showToast("Failed to delete document: " + (err.response?.data?.message || err.message || "Unknown error"), "Delete Error", "error");
      const updatedDocs = await getMyDocuments(libraryId);
      const docs = Array.isArray(updatedDocs) ? updatedDocs : (updatedDocs?.data || []);
      setDocuments(docs);
    }
  };

  const handleOpenSettings = () => {
    if (!canManageLibrary) return;
    setLibraryName(library?.name || library?.libraryName || "");
    setLibraryDescription(library?.description || "");
    setAllowPublish(Boolean(library?.is_public ?? library?.isPublic));
    setIsSettingsOpen(true);
  };

  const handleSaveLibrarySettings = async (event) => {
    event.preventDefault();
    if (!canManageLibrary) return;
    const trimmedName = libraryName.trim();

    if (!trimmedName) {
      showToast("Please enter a library name.", "Validation Error", "error");
      return;
    }

    setIsSavingSettings(true);
    try {
      const updatedLibrary = await updateLibrary(libraryId, {
        name: trimmedName,
        description: libraryDescription.trim(),
        is_public: Boolean(library?.is_public) || allowPublish,
      });
      setLibrary(updatedLibrary);
      setLibraryName(updatedLibrary.name || trimmedName);
      setLibraryDescription(updatedLibrary.description || "");
      setAllowPublish(Boolean(updatedLibrary.is_public));
      setIsSettingsOpen(false);
      showToast("Library settings saved successfully.", "Settings Updated", "success");
    } catch (error) {
      showToast(
        error.response?.data?.message || "Could not update library settings.",
        "Update Failed",
        "error",
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteLibrary = async () => {
    if (!canManageLibrary) return;

    const confirmed = await showPopupConfirm(
      `Delete “${library?.name || "this library"}”? This action cannot be undone.`,
      { title: "Delete library?", confirmText: "Delete", tone: "danger" },
    );
    if (!confirmed) return;

    setIsDeletingLibrary(true);
    try {
      await deleteLibrary(libraryId);
      navigate("/dashboard/libraries", { replace: true });
    } catch (error) {
      showToast(
        error.response?.data?.message || "Could not delete this library.",
        "Delete Failed",
        "error",
      );
      setIsDeletingLibrary(false);
    }
  };

  /**
   * Send question to AI
   */
  const handleSendMessage = async (queryText = null, documentIdsOverride = null) => {
    if (isGuest) return;
    const query = (queryText || inputQuery).trim();
    if (!query || isAsking) return;

    const activeDocumentIds = documentIdsOverride || Array.from(selectedDocIds);

    const userMsg = { id: `user-${Date.now()}`, role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsAsking(true);
    const abortController = new AbortController();
    chatRequestAbortRef.current = abortController;

    try {
      const res = await chatWithDocument({
        scope: "SELECTED",
        documentIds: activeDocumentIds,
        metadataScope: "AUTO",
        currentLibraryId: libraryId,
        conversationId: sessionConversationIdRef.current,
        question: query,
      }, undefined, { signal: abortController.signal });

      if (res?.action === "OPEN_FLASHCARDS") {
        const flashcardParams = new URLSearchParams();
        (res.documentIds || []).forEach((documentId) => {
          flashcardParams.append("documentId", documentId);
        });
        if (res.autoGenerate) flashcardParams.set("generate", "1");
        const flashcardQuery = flashcardParams.toString();
        navigate(`/dashboard/flashcards${flashcardQuery ? `?${flashcardQuery}` : ""}`);
        return;
      }

      const aiAnswer = res?.data?.answer || res?.answer || "I parsed your selected sources and summarized the answer.";
      const sourceCitations = [
        ...new Map(
          (res?.sources || [])
            .map((source) => {
              const documentId = source.document_id || source.documentId;
              const title = source.document_title || source.documentTitle;
              return documentId && title
                ? [String(documentId), { documentId, title }]
                : null;
            })
            .filter(Boolean),
        ).values(),
      ];
      const aiMsg = {
        id: `ai-${Date.now()}`,
        role: "ai",
        content: aiAnswer,
        citations: sourceCitations,
      };

      setMessages((prev) => [...prev, aiMsg]);

      if (res?.chatHistory) {
        const savedConversationId =
          res.chatHistory.conversationId || res.chatHistory.id;
        const savedConversation = {
          id: savedConversationId,
          documentId: res.chatHistory.documentId || primarySelectedDocumentId,
          title: res.chatHistory.title || query,
          createdAt: res.chatHistory.createdAt || new Date().toISOString(),
          messages: res.chatHistory.messages || [
            { id: userMsg.id, role: "user", text: query },
            { id: aiMsg.id, role: "ai", text: aiAnswer },
          ],
        };
        setCurrentConversation(savedConversationId);
        setChatHistory((current) => {
          const existingConversation = current.find(
            (conversation) =>
              String(conversation.id) === String(savedConversationId),
          );
          const existingMessages = existingConversation?.messages || [];
          const messageMap = new Map(
            [...existingMessages, ...savedConversation.messages].map((message) => [
              String(message.id),
              message,
            ]),
          );
          const updatedConversation = {
            ...existingConversation,
            ...savedConversation,
            messages: [...messageMap.values()],
          };

          return [
            updatedConversation,
            ...current.filter(
              (conversation) =>
                String(conversation.id) !== String(savedConversationId),
            ),
          ];
        });
        setActiveConversationId(savedConversationId);
      }
    } catch (err) {
      if (abortController.signal.aborted || err.code === "ERR_CANCELED") {
        showToast("AI response stopped.", "Stopped", "info");
        return;
      }

      console.error("Chat AI error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "ai",
          content: "Sorry, I could not process your query at this moment: " +
            (err.response?.data?.message || err.message || "Network error"),
        },
      ]);
    } finally {
      if (chatRequestAbortRef.current === abortController) {
        chatRequestAbortRef.current = null;
      }
      setIsAsking(false);
    }
  };

  const handleStopResponse = () => {
    chatRequestAbortRef.current?.abort();
  };

  useEffect(
    () => () => {
      chatRequestAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const pendingDocumentId = location.state?.chatDocumentId;
    const pendingQuestion = String(location.state?.chatQuestion || "").trim();
    if (
      pendingChatHandledRef.current ||
      isGuest ||
      !pendingDocumentId ||
      !pendingQuestion ||
      !documents.some((document) => String(document.id) === String(pendingDocumentId))
    ) {
      return;
    }

    pendingChatHandledRef.current = true;
    const selectedId = String(pendingDocumentId);
    setSelectedDocIds(new Set([selectedId]));
    setSelectAll(documents.length === 1);
    navigate(location.pathname, { replace: true, state: null });
    handleSendMessage(pendingQuestion, [selectedId]);
    // The route state is consumed once after this library's documents load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, isGuest, location.pathname, location.state, navigate]);

  const mapHistoryMessages = (conversations) =>
    [...conversations]
      .sort(
        (first, second) =>
          new Date(first.createdAt || 0).getTime() -
          new Date(second.createdAt || 0).getTime(),
      )
      .flatMap((conversation) =>
        [...(conversation.messages || [])]
          .sort((first, second) => {
            const timeDiff =
              new Date(first.createdAt || 0).getTime() -
              new Date(second.createdAt || 0).getTime();
            if (timeDiff !== 0) return timeDiff;
            if (first.role === "user" && second.role !== "user") return -1;
            if (first.role !== "user" && second.role === "user") return 1;
            return 0;
          })
          .map((message) => ({
            id: message.id,
            role: message.role === "user" ? "user" : "ai",
            content: message.text || message.content,
          })),
      );

  const handleOpenHistoryConversation = (conversation) => {
    setActiveConversationId(conversation.id);
    setCurrentConversation(conversation.id);
    setMessages(mapHistoryMessages([conversation]));
  };

  const handleResetChat = () => {
    setMessages([]);
    setActiveConversationId("");
    setInputQuery("");
    setThoughtsOpenMap({});
    setCurrentConversation();
  };

  const handleDeleteHistoryConversation = async (conversation) => {
    if (historyActionBusy || !conversation?.id) return;
    if (!window.confirm(`Delete chat history "${conversation.title || "Untitled conversation"}"?`)) {
      return;
    }

    try {
      setHistoryActionBusy(true);
      await deleteChatHistory(conversation.id);
      setChatHistory((current) =>
        current.filter((item) => String(item.id) !== String(conversation.id)),
      );

      if (String(activeConversationId) === String(conversation.id)) {
        setActiveConversationId("");
        setMessages([]);
      }
      if (String(sessionConversationId) === String(conversation.id)) {
        setCurrentConversation();
      }
      showToast("Chat history deleted.", "History Updated", "success");
    } catch (error) {
      showToast(
        error.response?.data?.message || "Could not delete chat history.",
        "Delete Error",
        "error",
      );
    } finally {
      setHistoryActionBusy(false);
    }
  };

  const handleClearLibraryHistory = async () => {
    if (historyActionBusy || chatHistory.length === 0) return;
    if (!window.confirm("Delete all chat history in this library? This cannot be undone.")) {
      return;
    }

    try {
      setHistoryActionBusy(true);
      await Promise.all(
        chatHistory.map((conversation) => deleteChatHistory(conversation.id)),
      );
      setChatHistory([]);
      setMessages([]);
      setActiveConversationId("");
      setCurrentConversation();
      showToast("All chat history in this library was deleted.", "History Cleared", "success");
    } catch (error) {
      showToast(
        error.response?.data?.message || "Could not clear chat history.",
        "Clear History Error",
        "error",
      );
    } finally {
      setHistoryActionBusy(false);
    }
  };

  const handleOpenFlashcards = () => {
    if (isGuest) return;
    if (selectedDocIds.size === 0 || selectedDocIds.size > 5) {
      showToast(
        "Select between one and five source documents before generating flashcards.",
        "Select Up To Five Sources",
        "info",
      );
      return;
    }

    const flashcardParams = new URLSearchParams();
    selectedDocIds.forEach((documentId) => {
      flashcardParams.append("documentId", documentId);
    });
    flashcardParams.set("generate", "1");
    navigate(`/dashboard/flashcards?${flashcardParams.toString()}`);
  };

  // Starter prompt starter cards
  const starterPrompts = [
    {
      icon: HiOutlineSparkles,
      title: "Summarize Key Insights",
      prompt: "Summarize the key insights and main takeaways from all selected source documents.",
    },
    {
      icon: HiOutlineLightBulb,
      title: "Extract Core Concepts",
      prompt: "Extract and explain the core concepts, terms, and definitions found in these documents.",
    },
    {
      icon: HiOutlineAcademicCap,
      title: "Create Study Guide",
      prompt: "Generate a comprehensive study guide with key questions and answers based on these files.",
    },
    {
      icon: HiOutlineQuestionMarkCircle,
      title: "Important Takeaways",
      prompt: "What are the most important findings or statistics mentioned in the source files?",
    },
  ];

  if (accessMode === "loading") {
    return (
      <main className="library_access_state">
        <i className="ti-reload library_access_spinner" aria-hidden="true" />
        <h1>Opening library</h1>
        <p>Please wait while we prepare this study space.</p>
      </main>
    );
  }

  if (accessMode === "denied" || !library) {
    return (
      <main className="library_access_state">
        <i className="ti-alert" aria-hidden="true" />
        <h1>Library unavailable</h1>
        <p>{libraryLoadError}</p>
        <button type="button" onClick={() => navigate("/dashboard/discover")}>
          Back to Discover
        </button>
      </main>
    );
  }

  return (
    <div className="notebook_workspace_container">
      {/* Custom English Toast Notification Banner */}
      <Toast
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast({ message: "", title: "", type: "info" })}
      />

      {/* 1. LEFT PANEL: SOURCES */}
      <SourcesSidebar
        libraryName={library?.name || library?.libraryName || "Library"}
        documents={documents}
        selectedDocIds={selectedDocIds}
        selectAll={selectAll}
        showLeftPanel={showLeftPanel}
        uploading={uploading}
        canManageLibrary={canManageLibrary}
        fileInputRef={fileInputRef}
        onTogglePanel={() => setShowLeftPanel(!showLeftPanel)}
        onToggleSelectAll={handleToggleSelectAll}
        onToggleDocSelect={handleToggleDocSelect}
        onFileUpload={handleFileUpload}
        onViewDoc={handleViewDocument}
        onDownloadDoc={handleDownloadDocument}
        onDeleteDoc={(docId, title) => setDeleteConfirmDoc({ id: docId, title: title || "Untitled Document" })}
        onRetryDocumentTags={handleRetryDocumentTags}
        retryingDocumentIds={retryingDocumentIds}
        chatHistory={chatHistory}
        activeConversationId={activeConversationId}
        onOpenHistoryConversation={handleOpenHistoryConversation}
        onDeleteHistoryConversation={handleDeleteHistoryConversation}
        onClearHistory={handleClearLibraryHistory}
        historyActionBusy={historyActionBusy}
        sourceSelectionEnabled={!isGuest}
      />

      {/* 2. MAIN PANEL: CHAT STREAM & WORKSPACE */}
      <main className="workspace_panel chat_panel full_width">
        {/* Top Header Bar */}
        <header className="chat_header">
          <div className="header_left">
            <button
              type="button"
              className="back_to_libraries_btn"
              onClick={() =>
                navigate(
                  isPublicLearner
                    ? location.state?.from || "/dashboard/discover"
                    : "/dashboard/libraries",
                )
              }
              title={isPublicLearner ? "Back to Discover" : "Back to Libraries"}
              aria-label={isPublicLearner ? "Back to Discover" : "Back to Libraries"}
            >
              <HiOutlineArrowLeft />
              <span>{isPublicLearner ? "Discover" : "Libraries"}</span>
            </button>
            {!showLeftPanel && (
              <button
                type="button"
                className="icon_btn expand_sources_btn"
                onClick={() => setShowLeftPanel(true)}
                title="Expand sources sidebar"
                aria-label="Expand sources sidebar"
              >
                <LuPanelLeftOpen />
              </button>
            )}
          </div>
          <div className="workspace_context_badges" aria-label="Chat context">
            {!showRightPanel && (
              <button
                type="button"
                className="icon_btn expand_studio_btn"
                onClick={() => setShowRightPanel(true)}
                title="Expand study tools sidebar"
                aria-label="Expand study tools sidebar"
              >
                <LuPanelRightOpen />
              </button>
            )}
            {canManageLibrary && (
              <button
                type="button"
                className="library_settings_btn"
                onClick={handleOpenSettings}
                title="Library settings"
                aria-label="Open library settings"
              >
                <HiOutlineCog6Tooth />
              </button>
            )}
          </div>
        </header>

        {isPublicLearner && (
          <section className="public_library_owner_banner" aria-label="Library owner">
            <div className="public_library_owner_avatar" aria-hidden="true">
              {libraryOwner.avatar_url ? (
                <img src={libraryOwner.avatar_url} alt="" />
              ) : (
                <span>{libraryOwnerInitial}</span>
              )}
            </div>
            <div className="public_library_owner_copy">
              <span>Library by {libraryOwnerName}</span>
              <strong>{library.name || library.libraryName}</strong>
              {library.description && <p>{library.description}</p>}
            </div>
            <div className="public_library_owner_meta">
              <span>Public learning access</span>
              <small>{documents.length} {documents.length === 1 ? "document" : "documents"}</small>
              <small>Created {formatLibraryDate(library.created_at || library.createdAt)}</small>
            </div>
          </section>
        )}

        {/* Chat Messages Stream or NotebookLM Welcome Hero */}
        <div
          className={`chat_stream ${messages.length > 0 ? "has_conversation" : ""}`}
          ref={chatContainerRef}
        >
          {messages.length === 0 ? (
            <div className="workspace_welcome_hero">
              <div className="sparkle_badge_hero">
                <HiOutlineSparkles />
              </div>
              <h1>{isGuest ? "Explore this public library" : "What do you want to explore today?"}</h1>
              <p>
                {isGuest
                  ? "Browse the public source documents on the left. Log in to use AI learning features."
                  : "Select your source documents on the left panel and click a prompt below or type your question."}
              </p>

              {/* Starter Action Cards Grid */}
              {!isGuest && <div className="starter_cards_grid">
                {starterPrompts.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="starter_card"
                      onClick={() => {
                        setInputQuery(item.prompt);
                        handleSendMessage(item.prompt);
                      }}
                    >
                      <div className="starter_card_icon">
                        <Icon />
                      </div>
                      <div className="starter_card_info">
                        <h4>{item.title}</h4>
                        <p>{item.prompt}</p>
                      </div>
                    </div>
                  );
                })}
              </div>}
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={msg.id || index} className={`chat_message_row ${msg.role}`}>
                {msg.role === "ai" && (
                  <div className="ai_avatar">
                    <HiOutlineSparkles />
                  </div>
                )}

                <div className="message_bubble">
                  {/* Collapsible Thoughts Accordion */}
                  {msg.role === "ai" && msg.thoughts && (
                    <div className="thoughts_accordion">
                      <button
                        type="button"
                        className="thoughts_toggle"
                        onClick={() =>
                          setThoughtsOpenMap((prev) => ({
                            ...prev,
                            [msg.id]: !prev[msg.id],
                          }))
                        }
                      >
                        {thoughtsOpenMap[msg.id] ? <HiOutlineChevronDown /> : <HiOutlineChevronRight />}
                        <span>Thoughts</span>
                      </button>
                      {thoughtsOpenMap[msg.id] && (
                        <div className="thoughts_body">
                          <p>{msg.thoughts}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Body Content */}
                  <div className="message_content">
                    <p className={msg.role === "ai" ? "formatted_ai_text" : ""}>
                      {msg.role === "ai"
                        ? formatAiMessageText(msg.content)
                        : msg.content}
                    </p>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="citations_row">
                        {msg.citations.map((citation) => {
                          const documentId = typeof citation === "string"
                            ? documents.find((document) => document.title === citation)?.id
                            : citation.documentId;
                          const title = typeof citation === "string"
                            ? citation
                            : citation.title;

                          return (
                            <button
                              type="button"
                              key={documentId || title}
                              className="citation_chip"
                              disabled={!documentId}
                              title={`View ${title}`}
                              onClick={() => handleViewDocument(documentId)}
                            >
                              {title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons Below AI Message */}
                  {msg.role === "ai" && (
                    <div className="message_actions">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          showToast("Copied response to clipboard!", "Copied", "info");
                        }}
                        title="Copy response"
                      >
                        <HiOutlineDocumentDuplicate />
                      </button>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="user_chat_avatar" title={userDisplayName}>
                    {userAvatar ? (
                      <img
                        src={userAvatar}
                        alt={`${userDisplayName} avatar`}
                        onError={() => setUserAvatar("")}
                      />
                    ) : (
                      <span aria-hidden="true">{userInitial}</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {isAsking && (
            <div className="chat_message_row ai loading">
              <div className="ai_avatar">
                <HiOutlineSparkles />
              </div>
              <div className="message_bubble">
                <p>StudyHub AI is preparing a response...</p>
              </div>
            </div>
          )}
        </div>

        {/* Floating Input Bar At Bottom */}
        <form
          className="chat_input_form"
          onSubmit={(e) => {
            e.preventDefault();
            if (isGuest) return;
            handleSendMessage();
          }}
        >
          <div className="input_box_wrapper">
            <input
              type="text"
              placeholder={isGuest ? "Log in to chat with AI." : "You can also ask general-knowledge questions directly in the chat."}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              disabled={isGuest || isAsking}
            />
            <div className="input_actions_right">
              <button
                type="button"
                className="reset_chat_btn"
                onClick={handleResetChat}
                disabled={isGuest || isAsking || (messages.length === 0 && !activeConversationId)}
                title="Start a new chat without deleting history"
              >
                <HiOutlineArrowPath aria-hidden="true" />
                <span>Reset Chat</span>
              </button>
              <button
                type={isAsking ? "button" : "submit"}
                className={`send_btn ${isAsking ? "stop_btn" : ""}`}
                onClick={isAsking ? handleStopResponse : undefined}
                disabled={isGuest || (!isAsking && !inputQuery.trim())}
                aria-label={isAsking ? "Stop AI response" : "Send message"}
                title={isAsking ? "Stop response" : "Send message"}
              >
                {isAsking ? <HiMiniStop /> : <HiOutlinePaperAirplane />}
              </button>
            </div>
          </div>
        </form>
      </main>

      {/* 3. RIGHT PANEL: STUDY TOOLS */}
      <aside className={`workspace_panel studio_panel ${showRightPanel ? "" : "collapsed"}`}>
        <div className="studio_panel_header">
          <h3>Study Tools</h3>
          <button
            type="button"
            className="icon_btn collapse_sidebar_btn"
            onClick={() => setShowRightPanel(false)}
            title="Collapse study tools sidebar"
            aria-label="Collapse study tools sidebar"
          >
            <LuPanelRightClose />
          </button>
        </div>

        <div className="studio_panel_content">
          {isGuest && (
            <div className="guest_feature_notice" role="status">
              <HiOutlineSparkles aria-hidden="true" />
              <strong>Log in to use our app features.</strong>
              <span>Study Tools are available to signed-in learners.</span>
            </div>
          )}
          <div className={`studio_tool_list ${isGuest ? "guest_tools_disabled" : ""}`} aria-disabled={isGuest}>
            {starterPrompts.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  type="button"
                  className="studio_tool_button"
                  key={tool.title}
                  onClick={() => handleSendMessage(tool.prompt)}
                  disabled={isGuest || selectedDocIds.size === 0 || isAsking}
                >
                  <span className="studio_tool_icon">
                    <Icon />
                  </span>
                  <span>
                    <strong>{tool.title}</strong>
                    <small>Use {selectedDocIds.size} selected sources</small>
                  </span>
                  <HiOutlineArrowRight className="studio_tool_arrow" />
                </button>
              );
            })}

            <button
              type="button"
              className="studio_tool_button"
              onClick={handleOpenFlashcards}
              disabled={selectedDocIds.size === 0 || isGuest}
            >
              <span className="studio_tool_icon">
                <HiOutlineAcademicCap />
              </span>
              <span>
                <strong>Generate Flashcards</strong>
                <small>Open the flashcard study page</small>
              </span>
              <HiOutlineArrowRight className="studio_tool_arrow" />
            </button>
          </div>

          <div className="library_summary_box">
            <span className="library_file_count">
              {documents.length} total {documents.length === 1 ? "file" : "files"}
            </span>
          </div>

        </div>
      </aside>

      {/* Duplicate File Replacement Confirmation Modal */}
      <DuplicateConfirmModal
        isOpen={canManageLibrary && Boolean(duplicateConfirm)}
        filename={duplicateConfirm?.filename || ""}
        onConfirm={handleConfirmReplace}
        onClose={() => setDuplicateConfirm(null)}
      />

      {/* Delete File Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={canManageLibrary && Boolean(deleteConfirmDoc)}
        filename={deleteConfirmDoc?.title || ""}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirmDoc(null)}
      />

      {canManageLibrary && isSettingsOpen && (
        <div
          className="library_settings_overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingSettings) {
              setIsSettingsOpen(false);
            }
          }}
        >
          <section
            className="library_settings_modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-settings-title"
          >
            <header className="library_settings_modal_header">
              <div>
                <span>Library</span>
                <h2 id="library-settings-title">Settings</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                disabled={isSavingSettings}
                aria-label="Close library settings"
              >
                <HiOutlineXMark />
              </button>
            </header>

            <form className="library_settings_form" onSubmit={handleSaveLibrarySettings}>
              <label>
                <span>Library name</span>
                <input
                  type="text"
                  value={libraryName}
                  onChange={(event) => setLibraryName(event.target.value)}
                  maxLength={100}
                  required
                />
              </label>

              <label>
                <span>Description</span>
                <textarea
                  value={libraryDescription}
                  onChange={(event) => setLibraryDescription(event.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Briefly describe the topics or documents in this library..."
                />
                <small className="library_description_count">
                  {libraryDescription.length} / 500
                </small>
              </label>

              <div className="library_publish_setting">
                <div>
                  <strong>Allow publish</strong>
                  <p>
                    {library?.is_public
                      ? "This library is public. Publishing cannot be turned off."
                      : "Make this library available publicly. This action cannot be reversed."}
                  </p>
                </div>
                <button
                  type="button"
                  className={`library_publish_switch ${allowPublish ? "is_on" : ""}`}
                  onClick={() => setAllowPublish(true)}
                  disabled={Boolean(library?.is_public)}
                  role="switch"
                  aria-checked={allowPublish}
                >
                  <span />
                </button>
              </div>

              <div className="library_settings_actions">
                <button
                  type="button"
                  className="library_delete_btn"
                  onClick={handleDeleteLibrary}
                  disabled={isDeletingLibrary || isSavingSettings}
                >
                  <HiOutlineTrash />
                  {isDeletingLibrary ? "Deleting..." : "Delete library"}
                </button>
                <button
                  type="submit"
                  className="library_settings_save_btn"
                  disabled={isSavingSettings || isDeletingLibrary}
                >
                  {isSavingSettings ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
