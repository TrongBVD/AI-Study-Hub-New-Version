import { useState } from "react";
import "./AdminDashboardPage.css";

const AdminDashboardPage = () => {
  const [activeNav, setActiveNav] = useState("Home");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [approvedItems, setApprovedItems] = useState([]);
  const [removedItems, setRemovedItems] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const navItems = [
    { name: "Home", icon: "🏠" },
    { name: "Library", icon: "" },
    { name: "Documents", icon: "📄" },
    { name: "AI Chat", icon: "🤖" },
    { name: "Study", icon: "" },
    { name: "Members", icon: "👥" },
    { name: "Settings", icon: "⚙️" },
  ];

  const flaggedDocs = [
    {
      id: 1,
      name: "Quantum-Dynamics-Thesis.pdf",
      uploader: "Dr. Aris Thorne",
      time: "2 hours ago",
      reason: "Copyright Concern",
      reasonClass: "green",
      icon: "⚠️",
      iconClass: "red",
    },
    {
      id: 2,
      name: "Neural-Networks-Survey.docx",
      uploader: "Janet Lee",
      time: "5 hours ago",
      reason: "AI-Generated Content",
      reasonClass: "orange",
      icon: "🤖",
      iconClass: "orange",
    },
    {
      id: 3,
      name: "Forbidden-Archives-Excerpt.txt",
      uploader: "Anonymous",
      time: "1 day ago",
      reason: "Banned Keywords",
      reasonClass: "green",
      icon: "🚫",
      iconClass: "red",
    },
  ];

  const filters = [
    "All",
    "Copyright Concern",
    "AI-Generated Content",
    "Banned Keywords",
  ];

  const visibleDocs = flaggedDocs.filter((doc) => {
    if (approvedItems.includes(doc.id) || removedItems.includes(doc.id)) {
      return false;
    }

    if (selectedFilter === "All") {
      return true;
    }

    return doc.reason === selectedFilter;
  });

  const handleApprove = (id) => {
    setApprovedItems([...approvedItems, id]);
  };

  const handleRemove = (id) => {
    setRemovedItems([...removedItems, id]);
  };

  const handleSendBroadcast = () => {
    setShowBroadcast(false);
    setBroadcastMessage("");
  };

  return (
    <div className="admin-dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>
            Resource
            <br />
            Hub
          </h1>
          <p>University Library</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${activeNav === item.name ? "active" : ""}`}
              onClick={() => setActiveNav(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-actions">
          <button className="btn-primary">New Resource</button>

          <button className="btn-ghost">
            <span>❓</span>
            <span>Help</span>
          </button>

          <button className="btn-ghost">
            <span></span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Search system logs..." />
          </div>

          <div className="header-actions">
            <button
              className="icon-btn"
              aria-label="Notifications"
              onClick={(e) => {
                e.stopPropagation();
                setShowNotifications(!showNotifications);
              }}
            >
              <span>🔔</span>
              <span className="pulse-dot"></span>
            </button>

            <button className="icon-btn" aria-label="Help">
              <span>❓</span>
            </button>

            <button className="btn-upload">Upload</button>

            <div className="avatar">A</div>
          </div>
        </header>

        {showNotifications && (
          <div className="notifications-dropdown">
            <h3>Notifications</h3>

            <div className="notif-item">
              <p>3 documents pending review</p>
              <p>2 hours ago</p>
            </div>

            <div className="notif-item">
              <p>Storage at 84% capacity</p>
              <p>5 hours ago</p>
            </div>
          </div>
        )}

        <div className="content">
          <div className="page-header">
            <h1>Admin Dashboard Home</h1>
            <p>Overview of the AI Study Hub scholarly ecosystem.</p>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-icon">👥</div>
                <span className="stat-trend">+12% this week</span>
              </div>

              <p className="stat-label">Total Users</p>
              <p className="stat-value">2,840</p>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-icon">️</div>
                <span className="stat-trend">84% Capacity</span>
              </div>

              <p className="stat-label">Storage Used</p>
              <p className="stat-value">1.2 TB</p>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-icon">📄</div>
                <span className="stat-trend">42 New Today</span>
              </div>

              <p className="stat-label">Active Docs</p>
              <p className="stat-value">14,203</p>
            </div>

            <div className="stat-card stat-card-alt">
              <div className="stat-card-header">
                <span className="stat-title">Storage Health</span>
                <span className="stat-chart-icon">📈</span>
              </div>

              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>

              <div className="progress-info">
                <span>Used: 1,228 GB</span>
                <span>Limit: 1,500 GB</span>
              </div>

              <button className="link-btn">Manage Quotas →</button>
            </div>
          </div>

          <div className="two-col">
            <div className="moderation-card">
              <div className="section-header">
                <div>
                  <h2>Moderation Hub</h2>
                  <p>AI-flagged documents requiring scholarly review</p>
                </div>

                <button
                  className="btn-filter"
                  onClick={() => setShowFilterBar(!showFilterBar)}
                >
                  <span>⚙️</span>
                  <span>Filters</span>
                </button>
              </div>

              {showFilterBar && (
                <div className="filter-bar">
                  {filters.map((filter) => (
                    <button
                      key={filter}
                      className={`filter-chip ${
                        selectedFilter === filter ? "active" : ""
                      }`}
                      onClick={() => setSelectedFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              )}

              <div className="doc-list">
                {visibleDocs.length === 0 ? (
                  <div className="empty-state">
                    <div className="emoji">✅</div>
                    <p>All documents have been reviewed!</p>
                  </div>
                ) : (
                  visibleDocs.map((doc) => (
                    <div key={doc.id} className="doc-item">
                      <div className={`doc-icon ${doc.iconClass}`}>
                        <span>{doc.icon}</span>
                      </div>

                      <div className="doc-info">
                        <p className="doc-name">{doc.name}</p>
                        <p className="doc-meta">
                          Uploader: {doc.uploader} • {doc.time}
                        </p>
                      </div>

                      <span className={`doc-reason ${doc.reasonClass}`}>
                        {doc.reason}
                      </span>

                      <button
                        className="btn-approve"
                        onClick={() => handleApprove(doc.id)}
                      >
                        Approve
                      </button>

                      <button
                        className="btn-remove"
                        onClick={() => handleRemove(doc.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button className="btn-view-all">View All Flagged Items (14)</button>
            </div>

            <div className="right-col">
              <div className="quick-actions">
                <h3>Quick Actions</h3>

                <button className="action-btn">
                  <span>Manage Users</span>
                  <span>→</span>
                </button>

                <button
                  className="action-btn"
                  onClick={() => setShowBroadcast(true)}
                >
                  <span>Broadcast Message</span>
                  <span>📢</span>
                </button>

                <button className="action-btn">
                  <span>System Reports</span>
                  <span>📊</span>
                </button>
              </div>

              <div className="insights-card">
                <h3>Admin Insights</h3>

                <div className="insight-item">
                  <div className="insight-bar red"></div>
                  <p className="insight-text">
                    <strong>Peak upload traffic</strong> detected between 2 PM -
                    4 PM today.
                  </p>
                </div>

                <div className="insight-item">
                  <div className="insight-bar green"></div>
                  <p className="insight-text">
                    <strong>AI categorization accuracy</strong> improved by 5.4%
                    this cycle.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="update-banner">
            <div className="update-content">
              <span className="update-badge">System Update</span>

              <h2>Neural Semantic Tagging is Live</h2>

              <p>
                The new AI engine now automatically applies smart hashtags to all
                library documents, improving search discoverability by up to 40%
                across all faculty departments.
              </p>

              <button className="btn-read-notes">Read Release Notes</button>
            </div>

            <div className="update-image">
              <img
                src="https://image.qwenlm.ai/public_source/c5f9999d-9e90-4bcb-94a9-21c1c120b45b/14b1c136f-ac9e-4aa5-ae04-63d5484d93b0.png"
                alt="University Library"
              />
            </div>
          </div>
        </div>
      </main>

      {showBroadcast && (
        <div
          className="modal-overlay"
          onClick={() => setShowBroadcast(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Broadcast Message</h3>
            <p>Send a message to all users</p>

            <textarea
              rows="4"
              placeholder="Type your message here..."
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
            />

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowBroadcast(false)}
              >
                Cancel
              </button>

              <button className="btn-send" onClick={handleSendBroadcast}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;