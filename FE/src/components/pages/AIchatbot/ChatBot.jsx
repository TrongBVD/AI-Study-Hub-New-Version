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
import { IoMdClose } from "react-icons/io";
import { IoChatbubbleEllipses } from "react-icons/io5";
import {
  FaCheck,
  FaChevronDown,
  FaHistory,
  FaPlus,
  FaTrash,
} from "react-icons/fa";
import { RiRobot2Fill } from "react-icons/ri";
import { FaUser } from "react-icons/fa6";
import {
  HiOutlineArchiveBox,
  HiOutlineDocumentText,
  HiOutlineFolder,
} from "react-icons/hi2";

const CHAT_HISTORY_KEY = "aiStudyHubChatHistory";
const PENDING_DOCUMENT_CHAT_KEY = "aiStudyHubPendingDocumentChat";
const ROOT_FOLDER_VALUE = "__library_root__";
const INITIAL_MESSAGE = {
  id: 1,
  role: "ai",
  text: "Hello 👋 Select an approved document and ask me something.",
};

const STARTER_PROMPTS = [
  {
    label: "Summarize document",
    prompt: "Summarize the key points in this document.",
    icon: HiOutlineDocumentText,
  },
];

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

function ChatBot({ defaultOpen = false, showBubble = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth > 900;
  });
  const [loading, setLoading] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [isLibraryMenuOpen, setIsLibraryMenuOpen] = useState(false);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);

  const bottomRef = useRef(null);
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
  const availableFolders = Array.from(
    selectedLibraryDocuments.reduce((folders, doc) => {
      const folderId = getDocumentFolderId(doc);

      if (folderId && !folders.has(folderId)) {
        folders.set(folderId, {
          id: folderId,
          name: getDocumentFolderName(doc),
        });
      }

      return folders;
    }, new Map()).values(),
  );
  const hasFolderDocuments = availableFolders.length > 0;
  const visibleDocuments = selectedLibraryDocuments.filter((doc) => {
    const folderId = getDocumentFolderId(doc);

    if (!hasFolderDocuments) return true;
    if (!selectedFolderId) return false;
    if (selectedFolderId === ROOT_FOLDER_VALUE) return !folderId;

    return folderId === selectedFolderId;
  });
  const selectedDocument = documents.find(
    (doc) => String(doc.id) === String(selectedDocumentId),
  );
  const selectedLibrary = libraries.find(
    (library) => String(library.id) === String(selectedLibraryId),
  );
  const conversationItems = history.filter((message) => message.role === "user");
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

        const approvedDocs = (result.data || []).filter(
          (doc) => doc.status === "APPROVED" && doc.ai_ready !== false,
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
        const initialLibraryHasFolders = initialLibraryDocuments.some((doc) =>
          Boolean(getDocumentFolderId(doc)),
        );
        const initialFolderId = pendingDocument
          ? getDocumentFolderId(pendingDocument) || ROOT_FOLDER_VALUE
          : initialLibraryHasFolders
            ? ""
            : ROOT_FOLDER_VALUE;

        setSelectedLibraryId(initialLibraryId || "");
        setSelectedFolderId(initialFolderId);
        setSelectedDocumentId(
          pendingDocument || !initialLibraryHasFolders
            ? initialDocument?.id || ""
            : "",
        );

        if (
          pendingChat &&
          pendingDocument &&
          processedPendingChatRef.current !== pendingChat.id
        ) {
          processedPendingChatRef.current = pendingChat.id;
          removeUserStoredItem(PENDING_DOCUMENT_CHAT_KEY);
          setMessages([INITIAL_MESSAGE]);
          submitChatQuestion(
            pendingChat.question,
            pendingDocument.id,
            pendingDocument,
          );
        }
      } catch (error) {
        console.error("Could not load approved documents:", error);
      }
    }

    if (open) {
      loadApprovedDocuments();
    }
    // The pending chat supplies explicit question/document overrides, so this
    // effect intentionally reacts only when the panel is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submitChatQuestion = async (
    questionOverride = input,
    documentIdOverride = selectedDocumentId,
    documentOverride = selectedDocument,
  ) => {
    const currentInput = questionOverride.trim();
    if (currentInput === "" || loading) return;

    if (!documentIdOverride) {
      const aiMessage = {
        id: Date.now(),
        role: "ai",
        text: "Please upload and select an approved document first.",
      };

      setMessages((prev) => [...prev, aiMessage]);
      return;
    }

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
          documentId: documentIdOverride,
          question: currentInput,
        },
        { signal: controller.signal },
      );
      const result = response.data;

      const savedMessages = result.data?.chatHistory?.messages || [];
      const savedUserMessage = savedMessages.find((message) => message.role === "user");
      const savedAiMessage = savedMessages.find((message) => message.role === "ai");
      const conversationId = result.data?.chatHistory?.conversationId;
      const aiMessage = {
        id: savedAiMessage?.id || Date.now() + 1,
        conversationId,
        role: "ai",
        text: savedAiMessage?.content || result.data?.answer || "I could not find an answer for that.",
      };
      userMessage.id = savedUserMessage?.id || userMessage.id;
      userMessage.conversationId = conversationId;

      if (documentOverride) {
        const latestChatDocument = {
          id: documentOverride.id,
          title: formatDisplayFileName(documentOverride.title),
          libraryId: getDocumentLibraryId(documentOverride),
          workspaceId: documentOverride.workspace_id || documentOverride.workspaceId,
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
    const libraryDocuments = documents.filter(
      (doc) => String(getDocumentLibraryId(doc)) === String(libraryId),
    );
    const libraryHasFolders = libraryDocuments.some((doc) =>
      Boolean(getDocumentFolderId(doc)),
    );

    setSelectedLibraryId(libraryId);
    setIsLibraryMenuOpen(false);
    setIsFileMenuOpen(false);
    setSelectedFolderId(libraryHasFolders ? "" : ROOT_FOLDER_VALUE);
    setSelectedDocumentId(
      libraryHasFolders ? "" : libraryDocuments[0]?.id || "",
    );
  };

  const handleFolderChange = (folderId) => {
    const folderDocuments = selectedLibraryDocuments.filter((doc) => {
      const documentFolderId = getDocumentFolderId(doc);

      return folderId === ROOT_FOLDER_VALUE
        ? !documentFolderId
        : documentFolderId === folderId;
    });

    setSelectedFolderId(folderId);
    setIsFileMenuOpen(false);
    setSelectedDocumentId(folderDocuments[0]?.id || "");
  };

  const handleDocumentChange = (documentId) => {
    setSelectedDocumentId(documentId);
    setIsFileMenuOpen(false);
  };

  const openHistoryItem = (message) => {
    const itemIndex = history.findIndex((item) => item.id === message.id);
    const nextAnswer = history
      .slice(itemIndex + 1)
      .find((item) => item.role === "ai");

    setMessages([INITIAL_MESSAGE, message, ...(nextAnswer ? [nextAnswer] : [])]);
  };

  return (
    <div className={`ai-chat-page ${showBubble ? "ai-chat-floating" : ""}`}>
      {showBubble && (
        <div id="bubble">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label="Open AI chat"
          >
            <IoChatbubbleEllipses />
          </button>
        </div>
      )}

      {open && (
        <div
          className={`chat-box ${showHistory ? "history-open" : "history-closed"}`}
        >
          <aside className={`chat-sidebar ${showHistory ? "is-open" : ""}`}>
            <div className="chat-brand">
              <img src={chatBookLogo} alt="StudyHub book logo" />
              <span>CHAT A.I+</span>
            </div>

            <div className="chat-sidebar-actions">
              <button type="button" className="new-chat-btn" onClick={resetChat}>
                <FaPlus />
                <span>New chat</span>
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
                      ? selectedLibrary.name || selectedLibrary.libraryName || "Untitled library"
                      : libraries.length === 0
                        ? "No libraries available"
                        : "Choose a library"}
                  </span>
                </button>
                <FaChevronDown className="chat-select-chevron" />

                {isLibraryMenuOpen && (
                  <div className="chat-file-options chat-library-options" role="listbox">
                    {libraries.length === 0 ? (
                      <div className="chat-file-option-empty">No libraries available</div>
                    ) : (
                      libraries.map((library) => {
                        const isSelected = String(library.id) === String(selectedLibraryId);
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
                            <span>{library.name || library.libraryName || "Untitled library"}</span>
                            {isSelected && <FaCheck />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedLibraryId && hasFolderDocuments && (
              <div className="document-select-container chat-folder-select">
                <label htmlFor="ai-chat-folder">Folder</label>
                <div className="chat-select-shell">
                  <HiOutlineFolder className="chat-select-leading-icon" />
                  <select
                    id="ai-chat-folder"
                    value={selectedFolderId}
                    onChange={(event) => handleFolderChange(event.target.value)}
                    className="document-select"
                    disabled={loading}
                  >
                    <option value="">Choose a folder</option>
                    {selectedLibraryDocuments.some(
                      (doc) => !getDocumentFolderId(doc),
                    ) && (
                      <option value={ROOT_FOLDER_VALUE}>
                        Files in library root
                      </option>
                    )}
                    {availableFolders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <FaChevronDown className="chat-select-chevron" />
                </div>
              </div>
            )}

            <div className="document-select-container chat-file-select">
              <span className="chat-select-label" id="ai-chat-document-label">
                File
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
                  disabled={
                    loading ||
                    !selectedLibraryId ||
                    (hasFolderDocuments && !selectedFolderId)
                  }
                >
                  <span>
                    {selectedDocument
                      ? formatDisplayFileName(selectedDocument.title)
                      :
                      (hasFolderDocuments && !selectedFolderId
                        ? "Choose a folder first"
                        : "Choose a file")}
                  </span>
                </button>
                <FaChevronDown className="chat-select-chevron" />

                {isFileMenuOpen && (
                  <div
                    className="chat-file-options"
                    role="listbox"
                    aria-labelledby="ai-chat-document-label"
                  >
                    {visibleDocuments.length === 0 ? (
                      <div className="chat-file-option-empty">
                        No approved files available
                      </div>
                    ) : (
                      visibleDocuments.map((doc) => {
                        const isSelected =
                          String(doc.id) === String(selectedDocumentId);

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
            </div>

            <div className="conversation-heading">
              <span>Your conversations</span>
              <button type="button" onClick={clearHistory}>
                Clear All
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
            <header className="chat-header">
              <button
                type="button"
                className="history-toggle"
                onClick={() => setShowHistory(!showHistory)}
                aria-label="Toggle chat history"
              >
                <FaHistory />
              </button>

              <div className="chat-thread-title">
                <span>CHAT A.I+</span>
                <strong>
                  {selectedDocument
                    ? formatDisplayFileName(selectedDocument.title)
                    : "Select an approved document"}
                </strong>
              </div>

              <div className="header-actions">
                <button type="button" onClick={resetChat} aria-label="Reset chat">
                  <RiResetRightLine />
                </button>

                {showBubble && (
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close chat"
                  >
                    <IoMdClose />
                  </button>
                )}
              </div>
            </header>

            <div className="chat-body" ref={chatBodyRef}>
              {isDefaultChat ? (
                <section className="chat-welcome" aria-labelledby="chat-welcome-title">
                  <div className="chat-welcome-mark">
                    <RiRobot2Fill />
                  </div>
                  <h1 id="chat-welcome-title">Welcome to StudyHub AI</h1>
                  <p>
                    Choose a starting point or ask anything about the selected
                    document.
                  </p>

                  <div className="chat-starter-grid">
                    {STARTER_PROMPTS.map(({ label, prompt, icon: Icon }) => (
                      <button
                        type="button"
                        key={label}
                        onClick={() =>
                          submitChatQuestion(
                            prompt,
                            selectedDocumentId,
                            selectedDocument,
                          )
                        }
                        disabled={loading}
                      >
                        <span className="chat-starter-icon">
                          <Icon />
                        </span>
                        <strong>{label}</strong>
                        <FaPlus className="chat-starter-plus" />
                      </button>
                    ))}
                  </div>
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
                    </div>
                  </div>
                ))
              )}

              {loading && (
                <div id="load-msg">
                  <b>StudyHub AI</b> is thinking...
                </div>
              )}

              <div ref={bottomRef}></div>
            </div>

            <div className="chat-input">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask StudyHub AI about this document"
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
        </div>
      )}
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

function getDocumentFolderId(document) {
  const folderId =
    document?.folder_id ?? document?.folderId ?? document?.folder?.id ?? "";

  return folderId === null || folderId === undefined ? "" : String(folderId);
}

function getDocumentFolderName(document) {
  return (
    document?.folder?.name ||
    document?.folder_name ||
    document?.folderName ||
    "Folder"
  );
}

export default ChatBot;
