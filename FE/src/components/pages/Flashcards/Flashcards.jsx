import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa6";
import {
  FaCheck,
  FaClock,
  FaHandPointer,
  FaHistory,
  FaLayerGroup,
  FaPlus,
  FaTimes,
  FaTrash,
} from "react-icons/fa";
import api from "../../../utils/api.js";
import {
  getUserStoredItem,
  setUserStoredItem,
} from "../../../utils/userStorage.js";
import "./Flashcards.css";

const FLASHCARD_HISTORY_STORAGE_KEY = "aiStudyHubFlashcardHistory";
const MAX_FLASHCARD_HISTORY_SETS = 30;
const MAX_FLASHCARD_DOCUMENTS = 5;

function getCardResultKey(card, index) {
  return String(card?.id || `${index}:${card?.question || "card"}`);
}

function loadFlashcardHistory() {
  try {
    const storedHistory = JSON.parse(
      getUserStoredItem(FLASHCARD_HISTORY_STORAGE_KEY) || "[]",
    );

    if (!Array.isArray(storedHistory)) return [];

    return storedHistory
      .filter(
        (savedSet) =>
          savedSet &&
          savedSet.id &&
          savedSet.documentId &&
          Array.isArray(savedSet.cards),
      )
      .slice(0, MAX_FLASHCARD_HISTORY_SETS);
  } catch (error) {
    console.warn("Could not load flashcard history:", error);
    return [];
  }
}

function getFlashcardSetId(documentId, cards) {
  const firstCard = cards?.[0];
  const stableCardValue = firstCard?.created_at || firstCard?.id;

  return stableCardValue
    ? `flashcard-set:${documentId}:${stableCardValue}`
    : `flashcard-set:${documentId}:${Date.now()}`;
}

function Flashcards() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDocumentIds = useMemo(
    () => searchParams.getAll("documentId").slice(0, MAX_FLASHCARD_DOCUMENTS),
    [searchParams],
  );
  const shouldAutoGenerate = searchParams.get("generate") === "1";
  const autoGenerateHandledRef = useRef(false);
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [history, setHistory] = useState(loadFlashcardHistory);
  const [activeSetId, setActiveSetId] = useState("");
  const [displayedSetTitle, setDisplayedSetTitle] = useState("");
  const [sessionComplete, setSessionComplete] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [cardResults, setCardResults] = useState({});

  const selectedDocuments = documents.filter((doc) =>
    selectedDocumentIds.some((documentId) => String(doc.id) === String(documentId)),
  );
  const selectedDocument = selectedDocuments[0];
  const currentCard = flashcards[currentCardIndex];
  const progress = flashcards.length
    ? ((currentCardIndex + 1) / flashcards.length) * 100
    : 0;
  const selectedSetTitle = selectedDocuments.length > 1
    ? `Combined flashcards (${selectedDocuments.length} sources)`
    : selectedDocument?.title?.replace(/\.[^/.]+$/, "") || "AI Flashcards";
  const sessionResults = flashcards.map((card, index) => ({
    card,
    index,
    status: cardResults[getCardResultKey(card, index)] || "unreviewed",
  }));
  const rememberedResults = sessionResults.filter(
    (result) => result.status === "remembered",
  );
  const missedResults = sessionResults.filter(
    (result) => result.status === "missed",
  );
  const skippedResults = sessionResults.filter(
    (result) => result.status === "skipped",
  );
  const rememberedPercentage = flashcards.length
    ? Math.round((rememberedResults.length / flashcards.length) * 100)
    : 0;
  const currentCardStatus = currentCard
    ? cardResults[getCardResultKey(currentCard, currentCardIndex)]
    : null;

  useEffect(() => {
    setUserStoredItem(
      FLASHCARD_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, MAX_FLASHCARD_HISTORY_SETS)),
    );
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
          const requestedDocuments = requestedDocumentIds
            .map((documentId) =>
              approvedDocs.find((doc) => String(doc.id) === String(documentId)),
            )
            .filter(Boolean);

          if (
            shouldAutoGenerate &&
            (requestedDocumentIds.length === 0 ||
              requestedDocuments.length !== requestedDocumentIds.length)
          ) {
            setSelectedDocumentIds([]);
            setMessage(
              requestedDocumentIds.length > 0
                ? "The requested document is unavailable or not approved. Select a valid document."
                : "Select a document before generating flashcards.",
            );
            return;
          }

          setSelectedDocumentIds([
            ...(requestedDocuments.length > 0
              ? requestedDocuments.map((document) => document.id)
              : [approvedDocs[0].id]),
          ]);
        }
      } catch (error) {
        setMessage(error.response?.data?.message || error.message);
      }
    }

    loadDocuments();
  }, [requestedDocumentIds, shouldAutoGenerate]);

  async function generateFlashcards() {
    if (selectedDocumentIds.length === 0 || loading) return;

    setLoading(true);
    setMessage("");
    setFlashcards([]);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setElapsedSeconds(0);
    setSessionStarted(false);
    setCardResults({});

    try {
      const response = await api.post("/ai/flashcards", {
        documentIds: selectedDocumentIds,
      });
      const result = response.data;

      setFlashcards(result.data || []);
      const cards = result.data || [];
      const generatedSetTitle = result.flashcardSet?.title || selectedSetTitle;
      setDisplayedSetTitle(generatedSetTitle);

      if (selectedDocument && cards.length > 0) {
        const savedSet = {
          id: result.flashcardSet?.id || getFlashcardSetId(selectedDocument.id, cards),
          documentId: selectedDocument.id,
          documentIds: [...selectedDocumentIds],
          title: generatedSetTitle,
          createdAt: new Date().toISOString(),
          cards,
        };

        setHistory((current) => [
          savedSet,
          ...current.filter((item) => item.id !== savedSet.id),
        ].slice(0, MAX_FLASHCARD_HISTORY_SETS));
        setActiveSetId(savedSet.id);
      }

      if (selectedDocument) {
        localStorage.setItem(
          "aiStudyHubLastStudyCard",
          JSON.stringify({
            documentId: selectedDocument.id,
            documentIds: [...selectedDocumentIds],
            title: generatedSetTitle,
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

  useEffect(() => {
    if (
      !shouldAutoGenerate ||
      selectedDocumentIds.length === 0 ||
      autoGenerateHandledRef.current
    ) {
      return;
    }

    autoGenerateHandledRef.current = true;
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("generate");
    setSearchParams(nextSearchParams, { replace: true });
    generateFlashcards();
    // Generate exactly once after the requested document has been selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocumentIds, shouldAutoGenerate]);

  function selectDocument(documentId) {
    setSelectedDocumentIds((current) => {
      const exists = current.some((id) => String(id) === String(documentId));
      if (exists) {
        return current.filter((id) => String(id) !== String(documentId));
      }
      if (current.length >= MAX_FLASHCARD_DOCUMENTS) {
        setMessage(`Select up to ${MAX_FLASHCARD_DOCUMENTS} documents per flashcard set.`);
        return current;
      }
      return [...current, documentId];
    });
    setMessage("");
  }

  function moveToCard(nextIndex) {
    if (nextIndex < 0 || nextIndex >= flashcards.length) return;
    setCurrentCardIndex(nextIndex);
    setIsFlipped(false);
  }

  function openHistorySet(savedSet) {
    setFlashcards(savedSet.cards || []);
    setDisplayedSetTitle(savedSet.title || "AI Flashcards");
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setActiveSetId(savedSet.id);
    setElapsedSeconds(0);
    setSessionStarted(false);
    setCardResults({});
    setMessage("");
  }

  function deleteHistorySet(event, setId) {
    event.stopPropagation();
    setHistory((current) => current.filter((item) => item.id !== setId));

    if (activeSetId === setId) {
      setFlashcards([]);
      setActiveSetId("");
      setDisplayedSetTitle("");
      setSessionComplete(false);
      setElapsedSeconds(0);
      setSessionStarted(false);
      setCardResults({});
    }
  }

  function startNewSet() {
    setFlashcards([]);
    setDisplayedSetTitle("");
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setActiveSetId("");
    setElapsedSeconds(0);
    setSessionStarted(false);
    setCardResults({});
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
    setCardResults({});
  }

  function startSession() {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setElapsedSeconds(0);
    setSessionStarted(true);
    setCardResults({});
  }

  function selectCurrentCardResult(status) {
    if (!currentCard) return;

    const resultKey = getCardResultKey(currentCard, currentCardIndex);
    setCardResults((current) => ({ ...current, [resultKey]: status }));
  }

  function goToNextCard() {
    if (!currentCard) return;

    if (!currentCardStatus) {
      const resultKey = getCardResultKey(currentCard, currentCardIndex);
      setCardResults((current) => ({ ...current, [resultKey]: "skipped" }));
    }

    setIsFlipped(false);

    if (currentCardIndex === flashcards.length - 1) {
      finishSession();
      return;
    }

    setCurrentCardIndex((current) => current + 1);
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
            <label>
              Approved documents
              <span>{selectedDocumentIds.length}/{MAX_FLASHCARD_DOCUMENTS} selected</span>
            </label>
            <div className="flashcards-document-picker">
              {documents.length === 0 ? (
                <p>No approved documents available</p>
              ) : (
                documents.map((doc) => (
                  <label key={doc.id} className="flashcards-document-option">
                    <input
                      type="checkbox"
                      checked={selectedDocumentIds.some(
                        (documentId) => String(documentId) === String(doc.id),
                      )}
                      onChange={() => selectDocument(doc.id)}
                      disabled={loading}
                    />
                    <span>{doc.title}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <button
            className="flashcards-primary-btn"
            onClick={generateFlashcards}
            disabled={loading || selectedDocumentIds.length === 0}
          >
            {loading ? "Generating..." : "Generate Flashcards"}
          </button>
        </div>

        {message && <div className="flashcards-message">{message}</div>}

        {currentCard && !sessionStarted && !sessionComplete && (
          <section className="flashcard-set-preview" aria-labelledby="flashcard-set-title">
            <div className="flashcard-set-preview-mark">
              <FaLayerGroup aria-hidden="true" />
            </div>
            <span>Flashcard Set</span>
            <h1
              id="flashcard-set-title"
              title={displayedSetTitle || "AI Flashcards"}
            >
              {displayedSetTitle || "AI Flashcards"}
            </h1>
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
                <h1 title={displayedSetTitle || "AI Flashcards"}>
                  {displayedSetTitle || "AI Flashcards"}
                </h1>
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
                  <span className="flashcard-card-number">
                    Card {currentCardIndex + 1}/{flashcards.length}
                  </span>
                  <h2>{currentCard.question}</h2>
                  <small><FaHandPointer /> Click to reveal answer</small>
                </div>
                <div className="flashcard-face flashcard-back">
                  <span>
                    Answer <em>Card {currentCardIndex + 1}/{flashcards.length}</em>
                  </span>
                  <h2>{currentCard.answer}</h2>
                  <small><FaHandPointer /> Click to see question</small>
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
                className={`flashcard-result-button is-missed ${
                  currentCardStatus === "missed" ? "is-selected" : ""
                }`}
                onClick={() => selectCurrentCardResult("missed")}
                aria-label="Mark as need review"
                aria-pressed={currentCardStatus === "missed"}
              >
                <FaTimes />
                <strong>{missedResults.length}</strong>
              </button>
              <button
                type="button"
                className={`flashcard-result-button is-remembered ${
                  currentCardStatus === "remembered" ? "is-selected" : ""
                }`}
                onClick={() => selectCurrentCardResult("remembered")}
                aria-label="Mark as known"
                aria-pressed={currentCardStatus === "remembered"}
              >
                <strong>{rememberedResults.length}</strong>
                <FaCheck />
              </button>
              <button
                type="button"
                className="flashcard-arrow flashcard-next-arrow"
                onClick={goToNextCard}
                aria-label={
                  currentCardIndex === flashcards.length - 1
                    ? "Finish session"
                    : "Next card"
                }
              >
                <FaArrowRight />
              </button>
            </nav>
          </section>
        )}

        {sessionComplete && (
          <section className="flashcard-complete" aria-labelledby="flashcard-complete-title">
            <h1 id="flashcard-complete-title">
              {rememberedPercentage >= 70
                ? "Great work — keep the momentum going!"
                : "You’ll get it next time."}
            </h1>

            <div className="flashcard-report-summary">
              <div
                className="flashcard-score-ring"
                style={{ "--flashcard-score": `${rememberedPercentage * 3.6}deg` }}
                aria-label={`${rememberedPercentage}% marked known`}
              >
                <div>
                  <strong>{rememberedResults.length}/{flashcards.length}</strong>
                  <span>{rememberedPercentage}%</span>
                  <small>{formatDuration(elapsedSeconds)}</small>
                </div>
              </div>

              <dl className="flashcard-report-counts">
                <div className="remembered">
                  <dt>Known</dt>
                  <dd>{rememberedResults.length}</dd>
                </div>
                <div className="missed">
                  <dt>Need review</dt>
                  <dd>{missedResults.length}</dd>
                </div>
                <div className="skipped">
                  <dt>Skipped</dt>
                  <dd>{skippedResults.length}</dd>
                </div>
              </dl>
            </div>

            <div className="flashcard-report-groups">
              <FlashcardResultGroup
                title="Known"
                status="remembered"
                results={rememberedResults}
                emptyText="No cards marked as known yet."
              />
              <FlashcardResultGroup
                title="Need review"
                status="missed"
                results={missedResults}
                emptyText="No cards marked as need review."
              />
              <FlashcardResultGroup
                title="Skipped"
                status="skipped"
                results={skippedResults}
                emptyText="No skipped cards."
              />
            </div>

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

function FlashcardResultGroup({ title, status, results, emptyText }) {
  return (
    <section className={`flashcard-report-group ${status}`}>
      <header>
        <span>{title}</span>
        <strong>{results.length}</strong>
      </header>
      {results.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <ol>
          {results.map(({ card, index }) => (
            <li key={getCardResultKey(card, index)}>
              <span>Card {index + 1}</span>
              <strong>{card.question}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
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
