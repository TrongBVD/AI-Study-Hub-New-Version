import { useEffect, useRef, useState } from "react";
import api from "../../../utils/api.js";
import {
  clearChatHistory as clearPersistedChatHistory,
  deleteChatHistory as deletePersistedChatHistory,
  getChatHistory as getPersistedChatHistory,
} from "../../../utils/aiApi.js";
import {
  getUserStoredItem,
  removeUserStoredItem,
  setUserStoredItem,
} from "../../../utils/userStorage.js";
import "./ChatBot.css";
import chatBookLogo from "../../../assets/images/ChatBookLogo.svg";

import { IoIosSend } from "react-icons/io";
import { RiResetRightLine } from "react-icons/ri";
import {
  FaCheck,
  FaChevronDown,
  FaHistory,
  FaLayerGroup,
  FaPlus,
  FaTrash,
} from "react-icons/fa";
import { RiRobot2Fill } from "react-icons/ri";
import { FaUser } from "react-icons/fa6";
import { HiOutlineArchiveBox, HiOutlineDocumentText } from "react-icons/hi2";
import { LuPanelLeftClose, LuPanelLeftOpen } from "react-icons/lu";

const CHAT_HISTORY_KEY = "aiStudyHubChatHistory";
const PENDING_DOCUMENT_CHAT_KEY = "aiStudyHubPendingDocumentChat";
const MAX_SELECTED_DOCUMENTS = 25;
const INITIAL_MESSAGE = {
  id: 1,
  role: "ai",
  text: "Hello! Ask a general question, ask about your libraries, or select files for detailed answers.",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function loadStoredHistory() {
  try {
    const raw = getUserStoredItem(CHAT_HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;

    if (parsed && typeof parsed === "object" && Array.isArray(parsed.data)) {
      if (parsed.timestamp && Date.now() - parsed.timestamp > CACHE_TTL_MS) {
        removeUserStoredItem(CHAT_HISTORY_KEY);
        return [];
      }
      return parsed.data;
    }
    return [];
  } catch {
    return [];
  }
}

function formatDisplayFileName(fileName) {
  return String(fileName || "Untitled document")
    .replace(/\.(pdf|docx|txt)$/i, "")
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeChunkReferences(answer) {
  return String(answer || "")
    .replace(
      /(?:^|\n)\s*(?:this\s+(?:answer|response)|the\s+answer|support(?:ing)?\s+evidence)\s+(?:is\s+)?(?:supported|grounded|based)\s+by\s+\*{0,2}chunks?\s*\d+(?:\s*(?:,|and)\s*\d+)*\*{0,2}\s*\.?\s*(?=\n|$)/gim,
      "\n",
    )
    .replace(
      /\s*\(?\[?\*{0,2}(?:source:\s*)?chunks?\s*\d+(?:\s*(?:,|and)\s*\d+)*\*{0,2}\]?\)?\s*\.?/gi,
      "",
    )
    .replace(/\*+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ChatBot() {
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth > 900;
  });
  const [loading, setLoading] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState("");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [isLibraryMenuOpen, setIsLibraryMenuOpen] = useState(false);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);

  const chatBodyRef = useRef(null);
  const processedPendingChatRef = useRef("");
  const librarySelectRef = useRef(null);
  const fileSelectRef = useRef(null);
  const activeChatRequestRef = useRef(null);
  const activeUserMessageRef = useRef(null);

  const [messages, setMessages] = useState([INITIAL_MESSAGE]);

  const [history, setHistory] = useState(loadStoredHistory);
  const selectedLibraryDocuments = documents.filter(
    (doc) => String(getDocumentLibraryId(doc)) === String(selectedLibraryId),
  );
  const selectedLibrary = libraries.find(
    (library) => String(library.id) === String(selectedLibraryId),
  );
  const conversationItems = history.filter(
    (message) => message.role === "user",
  );
  const primarySelectedDocumentId = selectedDocumentIds[0] || "";
  const selectedLibraryCount = new Set(
    documents
      .filter((document) => selectedDocumentIds.includes(String(document.id)))
      .map((document) => String(getDocumentLibraryId(document)))
      .filter(Boolean),
  ).size;
  const currentLibrarySelectedCount = selectedLibraryDocuments.filter(
    (document) => selectedDocumentIds.includes(String(document.id)),
  ).length;
  const chatHeaderTitle =
    selectedDocumentIds.length > 0
      ? `${selectedDocumentIds.length} ${selectedDocumentIds.length === 1 ? "file" : "files"} selected`
      : "Ask StudyHub AI";
  const chatHeaderContext =
    selectedDocumentIds.length > 0
      ? `Using sources from ${selectedLibraryCount} ${selectedLibraryCount === 1 ? "library" : "libraries"}`
      : "Ask briefly about any topic or your libraries; select files for detailed answers";
  const isDefaultChat =
    messages.length === 1 && messages[0].id === INITIAL_MESSAGE.id;

  useEffect(() => {
    setUserStoredItem(
      CHAT_HISTORY_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data: history,
      }),
    );
  }, [history]);

  useEffect(() => {
    let isMounted = true;

    async function loadPersistedHistory() {
      try {
        const conversations = await getPersistedChatHistory();
        if (!isMounted) return;

        const restoredHistory = conversations.flatMap((conversation) =>
          (conversation.messages || []).map((message) => ({
            ...message,
            conversationId: conversation.id,
          })),
        );
        setHistory((currentHistory) => [
          ...restoredHistory,
          ...currentHistory.filter((message) => !message.conversationId),
        ]);
      } catch (error) {
        console.warn("Could not load saved chat history:", error);
      }
    }

    loadPersistedHistory();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    chatBodyRef.current?.scrollTo({
      top: chatBodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!librarySelectRef.current?.contains(event.target)) {
        setIsLibraryMenuOpen(false);
      }
      if (!fileSelectRef.current?.contains(event.target)) {
        setIsFileMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsLibraryMenuOpen(false);
        setIsFileMenuOpen(false);
      }
    };

    window.document.addEventListener("mousedown", handlePointerDown);
    window.document.addEventListener("keydown", handleEscape);

    return () => {
      window.document.removeEventListener("mousedown", handlePointerDown);
      window.document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    async function loadApprovedDocuments() {
      try {
        const [documentsResponse, librariesResponse] = await Promise.all([
          api.get("/documents"),
          api.get("/documents/libraries"),
        ]);
        const result = documentsResponse.data;

        // Approved files remain valid chat sources even when their chunks have
        // not been generated yet. The backend repairs/generates missing chunks
        // on the first question, so hiding ai_ready=false files makes a newly
        // uploaded document appear to be missing from the chatbot.
        const approvedDocs = (result.data || []).filter(
          (doc) => String(doc.status || "").toUpperCase() === "APPROVED",
        );
        const myLibraries = librariesResponse.data?.data || [];

        setDocuments(approvedDocs);
        setLibraries(myLibraries);

        const pendingChat = getPendingDocumentChat();
        const pendingDocument = pendingChat
          ? approvedDocs.find(
              (doc) => String(doc.id) === String(pendingChat.documentId),
            )
          : null;
        const initialDocument =
          pendingDocument ||
          approvedDocs.find((doc) => Boolean(getDocumentLibraryId(doc))) ||
          null;
        const initialLibraryId = initialDocument
          ? getDocumentLibraryId(initialDocument)
          : myLibraries[0]?.id || "";
        const initialLibraryDocuments = approvedDocs.filter(
          (doc) =>
            String(getDocumentLibraryId(doc)) === String(initialLibraryId),
        );
        setSelectedLibraryId(initialLibraryId || "");
        setSelectedDocumentIds(
          pendingDocument
            ? [String(pendingDocument.id)]
            : initialLibraryDocuments
                .slice(0, MAX_SELECTED_DOCUMENTS)
                .map((document) => String(document.id)),
        );

        if (
          pendingChat &&
          pendingDocument &&
          processedPendingChatRef.current !== pendingChat.id
        ) {
          processedPendingChatRef.current = pendingChat.id;
          removeUserStoredItem(PENDING_DOCUMENT_CHAT_KEY);
          setMessages([INITIAL_MESSAGE]);
          submitChatQuestion(pendingChat.question, {
            documentIds: [String(pendingDocument.id)],
            document: pendingDocument,
          });
        }
      } catch (error) {
        console.error("Could not load approved documents:", error);
      }
    }

    loadApprovedDocuments();
    // The pending chat supplies explicit question/document overrides, so this
    // effect intentionally runs once when the page is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitChatQuestion = async (
    questionOverride = input,
    overrides = {},
  ) => {
    const currentInput = questionOverride.trim();
    if (currentInput === "" || loading) return;

    const effectiveDocumentIds = overrides.documentIds || selectedDocumentIds;
    const effectiveDocument =
      overrides.document ||
      documents.find(
        (document) =>
          String(document.id) === String(effectiveDocumentIds[0] || ""),
      );

    const userMessage = {
      id: Date.now(),
      role: "user",
      text: currentInput,
    };

    setMessages((prev) => [...prev, userMessage]);
    activeUserMessageRef.current = userMessage;

    setInput("");

    setLoading(true);
    const controller = new AbortController();
    activeChatRequestRef.current = controller;

    try {
      const response = await api.post(
        "/ai/chat",
        {
          scope: "SELECTED",
          documentIds: effectiveDocumentIds,
          metadataScope: "AUTO",
          currentLibraryId: selectedLibraryId || null,
          question: currentInput,
        },
        { signal: controller.signal },
      );
      const result = response.data;

      const savedMessages = result.data?.chatHistory?.messages || [];
      const savedUserMessage = savedMessages.find(
        (message) => message.role === "user",
      );
      const savedAiMessage = savedMessages.find(
        (message) => message.role === "ai",
      );
      const conversationId = result.data?.chatHistory?.conversationId;
      const aiMessage = {
        id: savedAiMessage?.id || Date.now() + 1,
        conversationId,
        role: "ai",
        text:
          savedAiMessage?.content ||
          result.data?.answer ||
          "I could not find an answer for that.",
        sources: result.data?.sources || [],
      };
      userMessage.id = savedUserMessage?.id || userMessage.id;
      userMessage.conversationId = conversationId;

      if (effectiveDocument) {
        const latestChatDocument = {
          id: effectiveDocument.id,
          title: formatDisplayFileName(effectiveDocument.title),
          libraryId: getDocumentLibraryId(effectiveDocument),
          workspaceId:
            effectiveDocument.workspace_id || effectiveDocument.workspaceId,
          chattedAt: new Date().toISOString(),
        };

        setUserStoredItem(
          "aiStudyHubLastChatDocument",
          JSON.stringify(latestChatDocument),
        );
        window.dispatchEvent(
          new CustomEvent("aiStudyHubLastChatDocumentChanged", {
            detail: latestChatDocument,
          }),
        );
      }

      setMessages((prev) => [...prev, aiMessage]);
      setHistory((prev) => [userMessage, aiMessage, ...prev]);
      activeUserMessageRef.current = null;
    } catch (error) {
      if (error.code === "ERR_CANCELED" || controller.signal.aborted) {
        return;
      }

      const aiMessage = {
        id: Date.now() + 1,
        role: "ai",
        text:
          error.response?.data?.message ||
          error.message ||
          "Sorry, I could not answer using this document.",
      };

      setMessages((prev) => [...prev, aiMessage]);
      setHistory((prev) => [userMessage, aiMessage, ...prev]);
      activeUserMessageRef.current = null;
    } finally {
      if (activeChatRequestRef.current === controller) {
        activeChatRequestRef.current = null;
      }
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    await submitChatQuestion();
  };

  const stopGenerating = () => {
    const stoppedMessage = activeUserMessageRef.current;
    activeChatRequestRef.current?.abort();
    activeChatRequestRef.current = null;
    activeUserMessageRef.current = null;

    if (stoppedMessage) {
      setMessages((currentMessages) =>
        currentMessages.filter((message) => message.id !== stoppedMessage.id),
      );
      setInput(stoppedMessage.text);
    }

    setLoading(false);
  };

  const resetChat = () => {
    activeChatRequestRef.current?.abort();
    activeChatRequestRef.current = null;
    activeUserMessageRef.current = null;
    setLoading(false);
    setInput("");
    setMessages([INITIAL_MESSAGE]);
  };

  const clearHistory = async () => {
    try {
      await clearPersistedChatHistory();
      setHistory([]);
    } catch (error) {
      console.error("Could not clear saved chat history:", error);
    }
  };

  const deleteHistoryItem = async (event, message) => {
    event.stopPropagation();

    if (message.conversationId) {
      try {
        await deletePersistedChatHistory(message.conversationId);
      } catch (error) {
        console.error("Could not delete saved chat history:", error);
        return;
      }
    }

    const itemIndex = history.findIndex((item) => item.id === message.id);
    if (itemIndex === -1) return;

    const answer = history[itemIndex + 1];
    const deletedIds = new Set([
      message.id,
      ...(answer?.role === "ai" ? [answer.id] : []),
    ]);

    setHistory((currentHistory) =>
      currentHistory.filter((item) => !deletedIds.has(item.id)),
    );

    if (messages.some((item) => deletedIds.has(item.id))) {
      setMessages([INITIAL_MESSAGE]);
    }
  };

  const handleLibraryChange = (libraryId) => {
    setSelectedLibraryId(libraryId);
    setIsLibraryMenuOpen(false);
    setIsFileMenuOpen(false);
  };

  const handleDocumentChange = (documentId) => {
    const normalizedId = String(documentId);
    setSelectedDocumentIds((currentIds) => {
      if (currentIds.includes(normalizedId)) {
        return currentIds.filter((id) => id !== normalizedId);
      }
      if (currentIds.length >= MAX_SELECTED_DOCUMENTS) return currentIds;
      return [...currentIds, normalizedId];
    });
  };

  const handleToggleSource = (documentId) => {
    const normalizedId = String(documentId);
    setSelectedDocumentIds((currentIds) => {
      if (currentIds.includes(normalizedId)) {
        return currentIds.filter((id) => id !== normalizedId);
      }
      if (currentIds.length >= MAX_SELECTED_DOCUMENTS) return currentIds;
      return [...currentIds, normalizedId];
    });
  };

  const handleSelectAllSources = () => {
    setSelectedDocumentIds((currentIds) =>
      [
        ...new Set([
          ...currentIds,
          ...selectedLibraryDocuments.map((document) => String(document.id)),
        ]),
      ].slice(0, MAX_SELECTED_DOCUMENTS),
    );
  };

  const handleClearSources = () => {
    setSelectedDocumentIds([]);
  };

  const openHistoryItem = (message) => {
    const itemIndex = history.findIndex((item) => item.id === message.id);
    const nextAnswer = history
      .slice(itemIndex + 1)
      .find((item) => item.role === "ai");

    setMessages([
      INITIAL_MESSAGE,
      message,
      ...(nextAnswer ? [nextAnswer] : []),
    ]);
  };

  return (
    <div className="ai-chat-page">
      <div
        className={`chat-box ${showHistory ? "history-open" : "history-closed"}`}
      >
        <aside className={`chat-sidebar ${showHistory ? "is-open" : ""}`}>
          <div className="chat-brand">
            <img src={chatBookLogo} alt="StudyHub book logo" />
            <span>Sources</span>
            {showHistory && (
              <button
                type="button"
                className="sidebar-toggle-button"
                onClick={() => setShowHistory(false)}
                aria-label="Hide sources sidebar"
                title="Hide sources"
              >
                <LuPanelLeftClose />
              </button>
            )}
          </div>

          <div className="chat-sidebar-actions">
            <button
              type="button"
              className="new-chat-btn"
              disabled={!selectedLibraryId}
              onClick={() => {
                if (selectedLibraryId) {
                  window.location.assign(
                    `/dashboard/libraries/${selectedLibraryId}`,
                  );
                }
              }}
            >
              <FaPlus />
              <span>Manage sources</span>
            </button>
          </div>

          <div className="document-select-container">
            <label htmlFor="ai-chat-library">Library</label>
            <div
              className={`chat-select-shell chat-custom-select ${
                isLibraryMenuOpen ? "is-open" : ""
              }`}
              ref={librarySelectRef}
            >
              <HiOutlineArchiveBox className="chat-select-leading-icon" />
              <button
                type="button"
                id="ai-chat-library"
                className="document-select chat-custom-select-trigger"
                aria-haspopup="listbox"
                aria-expanded={isLibraryMenuOpen}
                onClick={() => setIsLibraryMenuOpen((current) => !current)}
                disabled={loading}
              >
                <span>
                  {selectedLibrary
                    ? selectedLibrary.name ||
                      selectedLibrary.libraryName ||
                      "Untitled library"
                    : libraries.length === 0
                      ? "No libraries available"
                      : "Choose a library"}
                </span>
              </button>
              <FaChevronDown className="chat-select-chevron" />

              {isLibraryMenuOpen && (
                <div
                  className="chat-file-options chat-library-options"
                  role="listbox"
                >
                  {libraries.length === 0 ? (
                    <div className="chat-file-option-empty">
                      No libraries available
                    </div>
                  ) : (
                    libraries.map((library) => {
                      const isSelected =
                        String(library.id) === String(selectedLibraryId);
                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`chat-file-option ${isSelected ? "is-selected" : ""}`}
                          key={library.id}
                          onClick={() => handleLibraryChange(library.id)}
                        >
                          <HiOutlineArchiveBox />
                          <span>
                            {library.name ||
                              library.libraryName ||
                              "Untitled library"}
                          </span>
                          {isSelected && <FaCheck />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          <section
            className="notebook-source-section"
            aria-label="Library sources"
          >
            <div className="notebook-source-actions">
              <div className="notebook-source-stats">
                <div>
                  <strong>{selectedLibraryDocuments.length}</strong>
                  <span>Available files</span>
                </div>
                <div
                  className={
                    currentLibrarySelectedCount > 0 ? "has-selection" : ""
                  }
                >
                  <strong>{currentLibrarySelectedCount}</strong>
                  <span>Selected files</span>
                </div>
              </div>
              <div className="notebook-source-action-buttons">
                <button
                  type="button"
                  onClick={handleSelectAllSources}
                  disabled={loading}
                >
                  Select all files
                </button>
                <button
                  type="button"
                  onClick={handleClearSources}
                  disabled={loading || selectedDocumentIds.length === 0}
                >
                  Clear all selected
                </button>
              </div>
            </div>

            <div className="notebook-source-list">
              {selectedLibraryDocuments.length === 0 ? (
                <p className="chat-file-option-empty">
                  No approved sources yet.
                </p>
              ) : (
                selectedLibraryDocuments.map((document) => {
                  const sourceId = String(document.id);
                  const isChecked = selectedDocumentIds.includes(sourceId);
                  return (
                    <div
                      className={`notebook-source-row ${isChecked ? "is-active" : ""}`}
                      key={document.id}
                    >
                      <button
                        type="button"
                        className="notebook-source-title"
                        onClick={() => handleToggleSource(document.id)}
                        title={document.title}
                      >
                        <span className="notebook-source-type">
                          {getDocumentExtension(document.title)}
                        </span>
                        <span>{formatDisplayFileName(document.title)}</span>
                      </button>
                      <button
                        type="button"
                        className={`notebook-source-check ${isChecked ? "is-checked" : ""}`}
                        onClick={() => handleToggleSource(document.id)}
                        aria-label={`${isChecked ? "Remove" : "Select"} ${document.title}`}
                        aria-pressed={isChecked}
                        disabled={loading}
                      >
                        {isChecked && <FaCheck />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <div className="document-select-container chat-file-select">
            <span className="chat-select-label" id="ai-chat-document-label">
              Files
            </span>
            <div
              className={`chat-select-shell chat-custom-select ${
                isFileMenuOpen ? "is-open" : ""
              }`}
              ref={fileSelectRef}
            >
              <HiOutlineDocumentText className="chat-select-leading-icon" />
              <button
                type="button"
                id="ai-chat-document"
                className="document-select chat-custom-select-trigger"
                aria-labelledby="ai-chat-document-label ai-chat-document"
                aria-haspopup="listbox"
                aria-expanded={isFileMenuOpen}
                onClick={() => setIsFileMenuOpen((current) => !current)}
                disabled={loading || !selectedLibraryId}
              >
                <span>
                  {selectedDocumentIds.length > 0
                    ? `${selectedDocumentIds.length} file(s) selected`
                    : "Choose files"}
                </span>
              </button>
              <FaChevronDown className="chat-select-chevron" />

              {isFileMenuOpen && (
                <div
                  className="chat-file-options"
                  role="listbox"
                  aria-labelledby="ai-chat-document-label"
                >
                  {selectedLibraryDocuments.length === 0 ? (
                    <div className="chat-file-option-empty">
                      No approved files available
                    </div>
                  ) : (
                    selectedLibraryDocuments.map((doc) => {
                      const isSelected = selectedDocumentIds.includes(
                        String(doc.id),
                      );

                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`chat-file-option ${
                            isSelected ? "is-selected" : ""
                          }`}
                          key={doc.id}
                          onClick={() => handleDocumentChange(doc.id)}
                        >
                          <HiOutlineDocumentText />
                          <span title={formatDisplayFileName(doc.title)}>
                            {formatDisplayFileName(doc.title)}
                          </span>
                          {isSelected && <FaCheck />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <small className="chat-selection-hint">
              {selectedDocumentIds.length > 0
                ? `${selectedDocumentIds.length} ${selectedDocumentIds.length === 1 ? "file" : "files"} selected across ${selectedLibraryCount} ${selectedLibraryCount === 1 ? "library" : "libraries"}. `
                : "No content sources selected. MetaChat still covers your account. "}
              Select up to {MAX_SELECTED_DOCUMENTS} files.
            </small>
          </div>

          <div className="conversation-heading">
            <span>Your conversations</span>
            <button type="button" onClick={clearHistory}>
              CLEAR ALL
            </button>
          </div>

          <div className="conversation-list">
            {conversationItems.length === 0 ? (
              <p className="chat-history-empty">No saved messages yet.</p>
            ) : (
              conversationItems.map((message) => (
                <button
                  type="button"
                  className="conversation-item"
                  key={message.id}
                  onClick={() => openHistoryItem(message)}
                >
                  <FaHistory />
                  <span>{message.text}</span>
                  <FaTrash
                    className="conversation-muted-icon"
                    role="button"
                    tabIndex={0}
                    aria-label="Delete conversation"
                    onClick={(event) => deleteHistoryItem(event, message)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        deleteHistoryItem(event, message);
                      }
                    }}
                  />
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="chat-main">
          <header
            className={`chat-header ${showHistory ? "is-sidebar-visible" : ""}`}
          >
            {!showHistory && (
              <button
                type="button"
                className="history-toggle sidebar-toggle-button"
                onClick={() => setShowHistory(true)}
                aria-label="Show sources sidebar"
                title="Show sources"
              >
                <LuPanelLeftOpen />
              </button>
            )}

            <div className="chat-thread-title">
              <span>STUDYHUB AI</span>
              <strong>{chatHeaderTitle}</strong>
              <small>{chatHeaderContext}</small>
            </div>

            <div className="header-actions">
              <button type="button" onClick={resetChat} aria-label="Reset chat">
                <RiResetRightLine />
              </button>
            </div>
          </header>

          <div className="chat-body" ref={chatBodyRef}>
            {isDefaultChat ? (
              <section
                className="chat-welcome"
                aria-labelledby="chat-welcome-title"
              >
                <div className="chat-welcome-mark">
                  <RiRobot2Fill />
                </div>
                <h1 id="chat-welcome-title">Welcome to StudyHub AI</h1>
                <p>
                  Ask briefly about any topic or your libraries. Select or
                  upload files when you want a detailed, source-based answer.
                </p>
              </section>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`msg-row ${
                    m.role === "user" ? "user-row" : "ai-row"
                  }`}
                >
                  <div className="avatar">
                    {m.role === "user" ? <FaUser /> : <RiRobot2Fill />}
                  </div>

                  <div className="message-stack">
                    <span>{m.role === "user" ? "You" : "StudyHub AI"}</span>
                    <div
                      className={`message ${
                        m.role === "user" ? "user-msg" : "ai-msg"
                      }`}
                    >
                      {m.role === "ai" ? removeChunkReferences(m.text) : m.text}
                    </div>
                    {m.role === "ai" &&
                      Array.isArray(m.sources) &&
                      m.sources.length > 0 && (
                        <div
                          className="chat-message-sources"
                          aria-label="Answer sources"
                        >
                          {[
                            ...new Map(
                              m.sources.map((source) => [
                                String(
                                  source.document_id ||
                                    source.document_title ||
                                    source.chunk_index,
                                ),
                                source,
                              ]),
                            ).values(),
                          ].map((source) => (
                            <span
                              key={String(
                                source.document_id ||
                                  source.document_title ||
                                  source.chunk_index,
                              )}
                            >
                              <HiOutlineDocumentText />
                              {formatDisplayFileName(source.document_title)}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div id="load-msg">
                <b>StudyHub AI</b> is thinking...
              </div>
            )}
          </div>

          <div className="chat-input">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything, or select files for a detailed answer"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />

            <button
              type="button"
              onClick={loading ? stopGenerating : sendMessage}
              aria-label={loading ? "Stop generating" : "Send message"}
            >
              {loading ? (
                <i className="ti-control-pause" aria-hidden="true"></i>
              ) : (
                <IoIosSend />
              )}
            </button>
          </div>
        </section>

        <aside className="notebook-tools-rail" aria-label="Study tools">
          <button
            type="button"
            disabled={!primarySelectedDocumentId}
            onClick={() => {
              if (primarySelectedDocumentId) {
                window.location.assign(
                  `/dashboard/documents/${encodeURIComponent(primarySelectedDocumentId)}`,
                );
              }
            }}
            aria-label="Open selected document"
            title="Open selected document"
          >
            <HiOutlineDocumentText />
          </button>
          <button
            type="button"
            disabled={!selectedLibraryId}
            onClick={() => {
              if (selectedLibraryId) {
                window.location.assign(
                  `/dashboard/libraries/${encodeURIComponent(selectedLibraryId)}`,
                );
              }
            }}
            aria-label="Open current library"
            title={selectedLibrary?.name || "Open current library"}
          >
            <HiOutlineArchiveBox />
          </button>
          <button
            type="button"
            disabled={!primarySelectedDocumentId}
            onClick={() => {
              if (primarySelectedDocumentId) {
                window.location.assign(
                  `/dashboard/flashcards?documentId=${encodeURIComponent(primarySelectedDocumentId)}`,
                );
              }
            }}
            aria-label="Generate flashcards from selected document"
            title="Generate flashcards"
          >
            <FaLayerGroup />
          </button>
        </aside>
      </div>
    </div>
  );
}

function getPendingDocumentChat() {
  try {
    const pendingChat = JSON.parse(
      getUserStoredItem(PENDING_DOCUMENT_CHAT_KEY) || "null",
    );

    if (!pendingChat?.documentId || !pendingChat?.question) {
      return null;
    }

    return pendingChat;
  } catch {
    return null;
  }
}

function getDocumentLibraryId(document) {
  return document?.library_id || document?.libraryId || "";
}

function getDocumentExtension(fileName) {
  const match = String(fileName || "").match(/\.([a-z0-9]+)$/i);
  return (match?.[1] || "DOC").slice(0, 4).toUpperCase();
}

export default ChatBot;
