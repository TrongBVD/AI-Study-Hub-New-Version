import { useState } from "react";
import "./StudyPage.css";

function StudyPage() {
  const flashcardSets = [
    {
      id: 1,
      title: "Software Architecture",
      totalCards: 20,
      updated: "Updated 2h ago",
      mastery: "85%",
      active: true,
    },
    {
      id: 2,
      title: "React Hooks Mastery",
      totalCards: 45,
      updated: "Updated 1d ago",
      active: false,
    },
    {
      id: 3,
      title: "Database Normalization",
      totalCards: 12,
      updated: "Updated 3d ago",
      active: false,
    },
    {
      id: 4,
      title: "Intro to Algorithms",
      totalCards: 30,
      updated: "Updated 1w ago",
      active: false,
    },
  ];

  const [currentSet, setCurrentSet] = useState(flashcardSets[0]);
  const [currentCardIndex, setCurrentCardIndex] = useState(5);
  const [isFlipped, setIsFlipped] = useState(false);

  const question =
    "What is the primary purpose of a Load Balancer in a distributed system?";
  const answer =
    "A load balancer distributes incoming traffic across multiple servers to improve availability, performance, and reliability.";

  function handleSelectSet(set) {
    setCurrentSet(set);
    setIsFlipped(false);
    setCurrentCardIndex(5);
  }

  function handleFlipCard() {
    setIsFlipped((prev) => !prev);
  }

  function handlePrevCard() {
    if (currentCardIndex > 1) {
      setCurrentCardIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }

  function handleNextCard() {
    if (currentCardIndex < 20) {
      setCurrentCardIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  }

  return (
    <main className="study_page">
      <div className="study_shell">
        {/* Header */}
        <div className="study_topbar">
          <div className="study_library_info">
            <h2>AI-student-hub</h2>

            <div className="study_tabs">
              <button>Library</button>
              <button>Documents</button>
              <button className="active">Study</button>
              <button>AI Chat</button>
              <button>Settings</button>
            </div>
          </div>

          <div className="study_top_actions">
            <button className="upload_btn">Upload</button>
            <button className="icon_btn">☆</button>
            <button className="icon_btn">⚪</button>
          </div>
        </div>

        {/* Main content */}
        <div className="study_layout">
          {/* Left */}
          <aside className="study_sidebar">
            <div className="study_sidebar_header">
              <h3>Flashcard Sets</h3>
              <button className="small_icon_btn">⎘</button>
            </div>

            <button className="generate_btn">＋ Generate New</button>

            <div className="flashcard_set_list">
              {flashcardSets.map((set) => (
                <button
                  key={set.id}
                  className={`flashcard_set_item ${
                    currentSet.id === set.id ? "active" : ""
                  }`}
                  onClick={() => handleSelectSet(set)}
                >
                  <div className="flashcard_set_top">
                    <p>{set.title}</p>

                    {set.active && (
                      <span className="mastery_badge">
                        {set.mastery} <small>Mastery</small>
                      </span>
                    )}
                  </div>

                  <span>
                    {set.totalCards} Cards - {set.updated}
                  </span>
                </button>
              ))}
            </div>

            <div className="study_ai_card">
              <div className="study_ai_icon">✦</div>
              <div>
                <strong>AI Extraction</strong>
                <p>Analyzing "System Design v2.pdf"...</p>
              </div>
            </div>
          </aside>

          {/* Center */}
          <section className="study_main">
            <div className="study_topic_header">
              <div>
                <h1>Software Architecture Basics</h1>
                <p>Focusing on high-availability and distributed systems</p>
              </div>

              <div className="session_progress">
                <span>Session Progress</span>
                <div className="progress_bar">
                  <div className="progress_fill"></div>
                </div>
                <small>5 of 20 cards</small>
              </div>
            </div>

            <div
              className={`study_card ${isFlipped ? "flipped" : ""}`}
              onClick={handleFlipCard}
            >
              <div className="study_card_inner">
                <div className="study_card_front">
                  <span className="card_label">QUESTION</span>
                  <h2>{question}</h2>
                  <p className="flip_hint">↻ Click to flip</p>
                </div>

                <div className="study_card_back">
                  <span className="card_label">ANSWER</span>
                  <h2>{answer}</h2>
                  <p className="flip_hint">↻ Click to flip back</p>
                </div>
              </div>
            </div>

            <div className="study_controls">
              <button className="nav_circle_btn" onClick={handlePrevCard}>
                ←
              </button>

              <button className="flip_btn" onClick={handleFlipCard}>
                ↻ Flip Card
              </button>

              <button className="nav_circle_btn" onClick={handleNextCard}>
                →
              </button>
            </div>

            <div className="study_stats">
              <div className="study_stat_box">
                <span className="stat_icon">⏱</span>
                <h4>Time Spent</h4>
                <strong>14:22</strong>
                <p>This session</p>
              </div>

              <div className="study_stat_box">
                <span className="stat_icon">⚡</span>
                <h4>Recall Rate</h4>
                <strong>92%</strong>
                <p>Higher than average</p>
              </div>

              <div className="study_stat_box">
                <span className="stat_icon">◉</span>
                <h4>Focus Level</h4>
                <strong>High</strong>
                <p>Keep it up!</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default StudyPage;