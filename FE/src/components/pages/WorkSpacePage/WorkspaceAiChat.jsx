import { useEffect, useRef, useState } from "react";
import { chatWithDocument } from "../../../utils/aiApi.js";
import "./WorkspaceAiChat.css";

const STARTERS = [
  {
    icon: "ti-wand",
    title: "Summarize Key Insights",
    description: "Summarize the key insights and main takeaways from all selected sources.",
  },
  {
    icon: "ti-light-bulb",
    title: "Extract Core Concepts",
    description: "Extract and explain the core concepts, terms, and definitions.",
  },
  {
    icon: "ti-book",
    title: "Create Study Guide",
    description: "Create a comprehensive study guide with key questions and answers.",
  },
  {
    icon: "ti-help-alt",
    title: "Important Takeaways",
    description: "What are the most important findings or statistics in these files?",
  },
];

function shortFileName(name, maxLength = 24) {
  const value = String(name || "Untitled document");
  if (value.length <= maxLength) return value;
  const dotIndex = value.lastIndexOf(".");
  const extension = dotIndex > 0 ? value.slice(dotIndex) : "";
  const available = Math.max(8, maxLength - extension.length - 3);
  return `${value.slice(0, available)}...${extension}`;
}

export default function WorkspaceAiChat({
  documents = [],
  activeView = "ai-chat",
  onViewChange,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef(null);

  const approvedDocuments = documents.filter(
    (document) => String(document.status || "").toUpperCase() === "APPROVED",
  );
  const allSelected =
    approvedDocuments.length > 0 && selectedIds.length === approvedDocuments.length;

  useEffect(() => {
    const availableIds = new Set(approvedDocuments.map((document) => String(document.id)));
    setSelectedIds((current) => current.filter((id) => availableIds.has(String(id))));
  }, [documents]);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending]);

  function toggleDocument(documentId) {
    const normalizedId = String(documentId);
    setSelectedIds((current) =>
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId],
    );
  }

  function toggleAll() {
    setSelectedIds(
      allSelected ? [] : approvedDocuments.map((document) => String(document.id)),
    );
  }

  async function submitQuestion(question = input) {
    const trimmedQuestion = String(question || "").trim();
    if (!trimmedQuestion || isSending) return;

    if (selectedIds.length === 0) {
      setError("Select at least one approved file before asking a question.");
      return;
    }

    const userMessage = { id: `${Date.now()}-user`, role: "user", text: trimmedQuestion };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setIsSending(true);

    try {
      const result = await chatWithDocument({
        documentId: selectedIds[0],
        selectedDocIds: selectedIds,
        question: trimmedQuestion,
      });
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-ai`,
          role: "ai",
          text: result?.answer || "I could not find an answer in the selected files.",
        },
      ]);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "AI Chat could not answer from the selected files.",
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleInputKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitQuestion();
    }
  }

  return (
    <section className="workspace_ai_chat">
      <aside className="workspace_ai_sources">
        <header>
          <h2>Sources</h2>
          <span>{selectedIds.length} selected</span>
        </header>

        <label className="workspace_ai_select_all">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          <span>Select all</span>
        </label>

        <div className="workspace_ai_source_list">
          {approvedDocuments.length === 0 ? (
            <p className="workspace_ai_no_sources">No approved files available.</p>
          ) : (
            approvedDocuments.map((document) => (
              <label className="workspace_ai_source" key={document.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(String(document.id))}
                  onChange={() => toggleDocument(document.id)}
                />
                <i className="ti-file" aria-hidden="true" />
                <span title={document.title}>{shortFileName(document.title)}</span>
              </label>
            ))
          )}
        </div>
      </aside>

      <main className="workspace_ai_main">
        <header className="workspace_ai_view_header">
          <div className="workspace_file_view_tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "documents"}
              onClick={() => onViewChange?.("documents")}
            >
              Documents
            </button>
            <button
              type="button"
              className="active"
              role="tab"
              aria-selected={activeView === "ai-chat"}
              onClick={() => onViewChange?.("ai-chat")}
            >
              AI Chat
            </button>
          </div>
        </header>

        <div className="workspace_ai_thread" ref={threadRef}>
          {messages.length === 0 ? (
            <section className="workspace_ai_welcome">
              <div className="workspace_ai_mark"><i className="ti-wand" /></div>
              <h1>What do you want to explore today?</h1>
              <p>Select your source documents on the left panel and choose a prompt or type your question.</p>

              <div className="workspace_ai_starters">
                {STARTERS.map((starter) => (
                  <button
                    type="button"
                    key={starter.title}
                    onClick={() => submitQuestion(starter.description)}
                  >
                    <i className={starter.icon} />
                    <span><strong>{starter.title}</strong><small>{starter.description}</small></span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="workspace_ai_messages">
              {messages.map((message) => (
                <article className={`workspace_ai_message ${message.role}`} key={message.id}>
                  <span>{message.role === "ai" ? "AI" : "You"}</span>
                  <p>{message.text}</p>
                </article>
              ))}
              {isSending && <div className="workspace_ai_typing">AI is reading your sources...</div>}
            </div>
          )}
        </div>

        <div className="workspace_ai_composer">
          {error && <p className="workspace_ai_error">{error}</p>}
          <div>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask a question or create content from your sources..."
              rows="1"
            />
            <span>{selectedIds.length} source{selectedIds.length === 1 ? "" : "s"}</span>
            <button
              type="button"
              onClick={() => submitQuestion()}
              disabled={isSending || !input.trim() || selectedIds.length === 0}
              aria-label="Send question"
            >
              <i className="ti-arrow-right" />
            </button>
          </div>
        </div>
      </main>
    </section>
  );
}
