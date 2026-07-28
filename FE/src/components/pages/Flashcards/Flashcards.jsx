import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaRotate } from "react-icons/fa6";
import { FaCheck, FaClock, FaHistory, FaPlus, FaTrash } from "react-icons/fa";
import api from "../../../utils/api.js";
import "./Flashcards.css";

const FLASHCARD_HISTORY_KEY = "aiStudyHubFlashcardHistory";

function loadFlashcardHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(FLASHCARD_HISTORY_KEY) || "[]");
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

function Flashcards() {
  const [searchParams] = useSearchParams();
  const requestedDocumentId = searchParams.get("documentId");
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [history, setHistory] = useState(loadFlashcardHistory);
  const [activeSetId, setActiveSetId] = useState("");
  const [sessionComplete, setSessionComplete] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);

  const selectedDocument = documents.find(
    (doc) => String(doc.id) === String(selectedDocumentId),
  );
  const currentCard = flashcards[currentCardIndex];
  const progress = flashcards.length
    ? ((currentCardIndex + 1) / flashcards.length) * 100
    : 0;
  const setTitle = selectedDocument?.title?.replace(/\.[^/.]+$/, "") ||
    "AI Flashcards";

  useEffect(() => {
    localStorage.setItem(FLASHCARD_HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (!currentCard || !sessionStarted || sessionComplete) return undefined;

    const timerId = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [currentCard, sessionComplete, sessionStarted]);

  useEffect(() => {
    async function loadDocuments() {
      try {
        const response = await api.get("/documents");
        const result = response.data;

        const approvedDocs = (result.data || []).filter(
          (doc) => doc.status === "APPROVED"
        );

        setDocuments(approvedDocs);

        if (approvedDocs.length > 0) {
          const requestedDocument = approvedDocs.find(
            (doc) => String(doc.id) === String(requestedDocumentId),
          );
          setSelectedDocumentId(
            requestedDocument ? requestedDocument.id : approvedDocs[0].id,
          );
        }
      } catch (error) {
        setMessage(error.response?.data?.message || error.message);
      }
    }

    loadDocuments();
  }, [requestedDocumentId]);

  useEffect(() => {
    if (!selectedDocumentId) return;
    async function loadDatabaseFlashcards() {
      try {
        const response = await api.get(`/ai/documents/${selectedDocumentId}/flashcards`);
        const cards = response.data?.data || [];
        if (cards.length > 0) {
          setFlashcards(cards);
        }
      } catch (err) {
        console.warn("Could not load flashcards from Database:", err);
      }
    }
    loadDatabaseFlashcards();
  }, [selectedDocumentId]);

  async function generateFlashcards() {
    if (!selectedDocumentId || loading) return;

    setLoading(true);
    setMessage("");
    setFlashcards([]);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setElapsedSeconds(0);
    setSessionStarted(false);

    try {
      const response = await api.post(
        `/ai/documents/${selectedDocumentId}/flashcards`
      );
      const result = response.data;

      setFlashcards(result.data || []);
      const cards = result.data || [];

      if (selectedDocument && cards.length > 0) {
        const savedSet = {
          id: globalThis.crypto?.randomUUID?.() || `${selectedDocument.id}-${Date.now()}`,
          documentId: selectedDocument.id,
          title: selectedDocument.title,
          createdAt: new Date().toISOString(),
          cards,
        };

        setHistory((current) => [savedSet, ...current].slice(0, 30));
        setActiveSetId(savedSet.id);
      }

      if (selectedDocument) {
        localStorage.setItem(
          "aiStudyHubLastStudyCard",
          JSON.stringify({
            documentId: selectedDocument.id,
            title: selectedDocument.title,
            libraryId: selectedDocument.library_id,
            workspaceId: selectedDocument.workspace_id,
            studiedCards: cards.length,
            totalCards: cards.length,
            studiedAt: new Date().toISOString(),
          }),
        );
      }
      setMessage("Flashcards generated successfully.");
    } catch (error) {
      setMessage(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  }

  function selectDocument(documentId) {
    setSelectedDocumentId(documentId);
    setFlashcards([]);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setActiveSetId("");
    setElapsedSeconds(0);
    setSessionStarted(false);
    setMessage("");
  }

  function moveToCard(nextIndex) {
    if (nextIndex < 0 || nextIndex >= flashcards.length) return;
    setCurrentCardIndex(nextIndex);
    setIsFlipped(false);
  }

  function openHistorySet(savedSet) {
    setSelectedDocumentId(savedSet.documentId);
    setFlashcards(savedSet.cards || []);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setActiveSetId(savedSet.id);
    setElapsedSeconds(0);
    setSessionStarted(false);
    setMessage("");
  }

  function deleteHistorySet(event, setId) {
    event.stopPropagation();
    setHistory((current) => current.filter((item) => item.id !== setId));

    if (activeSetId === setId) {
      setFlashcards([]);
      setActiveSetId("");
      setSessionComplete(false);
      setElapsedSeconds(0);
      setSessionStarted(false);
    }
  }

  function startNewSet() {
    setFlashcards([]);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setActiveSetId("");
    setElapsedSeconds(0);
    setSessionStarted(false);
    setMessage("");
  }

  function finishSession() {
    setIsFlipped(false);
    setSessionComplete(true);
  }

  function restartSession() {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setElapsedSeconds(0);
    setSessionStarted(true);
  }

  function startSession() {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setElapsedSeconds(0);
    setSessionStarted(true);
  }

  return (
    <div className="flashcards-page">
      <div className="flashcards-layout">
        <aside className="flashcard-history-panel">
          <div className="flashcard-history-title">
            <h2>Flashcard History</h2>
            <FaHistory aria-hidden="true" />
          </div>

          <button type="button" className="flashcard-new-button" onClick={startNewSet}>
            <FaPlus /> Generate New
          </button>

          <div className="flashcard-history-list">
            {history.length === 0 ? (
              <p className="flashcard-history-empty">Your generated sets will appear here.</p>
            ) : (
              history.map((savedSet) => (
                <button
                  type="button"
                  key={savedSet.id}
                  className={`flashcard-history-item ${
                    activeSetId === savedSet.id ? "is-active" : ""
                  }`}
                  onClick={() => openHistorySet(savedSet)}
                >
                  <strong>{savedSet.title?.replace(/\.[^/.]+$/, "")}</strong>
                  <span>
                    {savedSet.cards?.length || 0} cards · {formatHistoryDate(savedSet.createdAt)}
                  </span>
                  <FaTrash
                    role="button"
                    tabIndex={0}
                    aria-label={`Delete ${savedSet.title}`}
                    onClick={(event) => deleteHistorySet(event, savedSet.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        deleteHistorySet(event, savedSet.id);
                      }
                    }}
                  />
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="flashcards-card">
        <div className="flashcards-toolbar" aria-label="Flashcard setup">
          <div className="flashcards-field">
            <label>Approved document</label>
            <select
              value={selectedDocumentId}
              onChange={(e) => selectDocument(e.target.value)}
              disabled={loading}
            >
              {documents.length === 0 && (
                <option value="">No approved documents available</option>
              )}

              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </div>

          <button
            className="flashcards-primary-btn"
            onClick={generateFlashcards}
            disabled={loading || !selectedDocumentId}
          >
            {loading ? "Generating..." : "Generate Flashcards"}
          </button>
        </div>

        {message && <div className="flashcards-message">{message}</div>}

        {currentCard && !sessionStarted && !sessionComplete && (
          <section className="flashcard-set-preview" aria-labelledby="flashcard-set-title">
            <div className="flashcard-set-preview-mark"><FaHistory /></div>
            <span>Flashcard Set</span>
            <h1 id="flashcard-set-title">{setTitle}</h1>
            <p>{flashcards.length} cards ready to review</p>
            <button type="button" className="flashcards-primary-btn" onClick={startSession}>
              Start Studying <FaArrowRight />
            </button>
          </section>
        )}

        {currentCard && sessionStarted && !sessionComplete && (
          <section className="flashcard-study" aria-live="polite">
            <header className="flashcard-study-header">
              <div>
                <h1>{setTitle}</h1>
                <p>Review the generated questions one card at a time</p>
              </div>

              <div className="flashcard-session-stats">
                <div className="flashcard-timer" aria-label={`Elapsed time ${formatDuration(elapsedSeconds)}`}>
                  <FaClock aria-hidden="true" />
                  <div>
                    <strong>Time</strong>
                    <span>{formatDuration(elapsedSeconds)}</span>
                  </div>
                </div>

                <div className="flashcard-progress">
                  <strong>Session Progress</strong>
                  <div className="flashcard-progress-track" aria-hidden="true">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <small>
                    {currentCardIndex + 1} of {flashcards.length} cards
                  </small>
                </div>
              </div>
            </header>

            <button
              type="button"
              className={`flashcard-stage ${isFlipped ? "is-flipped" : ""}`}
              onClick={() => setIsFlipped((current) => !current)}
              aria-label={isFlipped ? "Show question" : "Show answer"}
            >
              <div className="flashcard-stage-inner">
                <div className="flashcard-face flashcard-front">
                  <span>Question</span>
                  <h2>{currentCard.question}</h2>
                  <small><FaRotate /> Click to flip</small>
                </div>
                <div className="flashcard-face flashcard-back">
                  <span>Answer</span>
                  <h2>{currentCard.answer}</h2>
                  <small><FaRotate /> Click to see question</small>
                </div>
              </div>
            </button>

            <nav className="flashcard-controls" aria-label="Flashcard navigation">
              <button
                type="button"
                className="flashcard-arrow"
                onClick={() => moveToCard(currentCardIndex - 1)}
                disabled={currentCardIndex === 0}
                aria-label="Previous card"
              >
                <FaArrowLeft />
              </button>
              <button
                type="button"
                className="flashcard-flip-button"
                onClick={() => setIsFlipped((current) => !current)}
              >
                <FaRotate /> Flip Card
              </button>
              <button
                type="button"
                className={`flashcard-arrow ${
                  currentCardIndex === flashcards.length - 1 ? "is-finish" : ""
                }`}
                onClick={() =>
                  currentCardIndex === flashcards.length - 1
                    ? finishSession()
                    : moveToCard(currentCardIndex + 1)
                }
                aria-label={
                  currentCardIndex === flashcards.length - 1
                    ? "Finish session"
                    : "Next card"
                }
              >
                {currentCardIndex === flashcards.length - 1 ? <FaCheck /> : <FaArrowRight />}
              </button>
            </nav>
          </section>
        )}

        {sessionComplete && (
          <section className="flashcard-complete" aria-labelledby="flashcard-complete-title">
            <div className="flashcard-complete-icon"><FaCheck /></div>
            <span>Session complete</span>
            <h1 id="flashcard-complete-title">You finished all {flashcards.length} cards!</h1>
            <div className="flashcard-total-time">
              <FaClock aria-hidden="true" />
              <span>Total study time</span>
              <strong>{formatDuration(elapsedSeconds)}</strong>
            </div>
            <p>Would you like to continue studying this set?</p>
            <div className="flashcard-complete-actions">
              <button type="button" className="flashcards-primary-btn" onClick={restartSession}>
                Study Again
              </button>
              <button type="button" className="flashcard-secondary-btn" onClick={startNewSet}>
                Choose Another Set
              </button>
            </div>
          </section>
        )}

        {!loading && flashcards.length === 0 && (
          <div className="flashcards-empty">
            <strong>Ready to study?</strong>
            <span>
              Select a document to generate new flashcards, or choose a saved
              set from Flashcard History to continue learning.
            </span>
          </div>
        )}
        </main>
      </div>
    </div>
  );
}

function formatHistoryDate(dateValue) {
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return "Saved recently";

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [minutes, seconds].map((part) => String(part).padStart(2, "0"));

  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${parts.join(":")}`
    : parts.join(":");
}

export default Flashcards;
