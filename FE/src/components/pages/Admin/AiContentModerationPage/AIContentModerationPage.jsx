import { useState } from "react";
import "./AIContentModeration.css";

const AIContentModerationPage = () => {
  const [activeNav, setActiveNav] = useState('System Logs');
  const [searchQuery, setSearchQuery] = useState('');
  const [flagType, setFlagType] = useState('All');
  const [confidence, setConfidence] = useState('80%+');
  const [dateRange, setDateRange] = useState('Last 7 Days');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState([]);

  const navItems = [
    { name: 'Dashboard', icon: 'grid' },
    { name: 'User Management', icon: 'users' },
    { name: 'Research Repository', icon: 'repository' },
    { name: 'System Logs', icon: 'logs' },
    { name: 'Academic Settings', icon: 'settings' },
    { name: 'Audit Trails', icon: 'audit' },
  ];

  const documents = [
    {
      id: 1,
      name: 'Quantum_Mechanics_Draft.pdf',
      uploader: 'Dr. Aris Thorne',
      flagType: 'AI-Generated',
      flagClass: 'flag-ai',
      confidence: 85,
      status: 'Flagged',
      statusClass: 'status-flagged',
      icon: 'pdf',
    },
    {
      id: 2,
      name: 'Medical_Ethics_Case_Study.docx',
      uploader: 'Elena Rossi',
      flagType: 'Restricted Keywords',
      flagClass: 'flag-restricted',
      confidence: 98,
      status: 'Under Review',
      statusClass: 'status-review',
      icon: 'doc',
    },
    {
      id: 3,
      name: 'Internal_Research_Archive.zip',
      uploader: 'Anonymous',
      flagType: 'Potential Copyright',
      flagClass: 'flag-copyright',
      confidence: 72,
      status: 'Flagged',
      statusClass: 'status-flagged',
      icon: 'zip',
    },
    {
      id: 4,
      name: 'Neural_Networks_Survey.pdf',
      uploader: 'Janet Lee',
      flagType: 'AI-Generated',
      flagClass: 'flag-ai',
      confidence: 91,
      status: 'Flagged',
      statusClass: 'status-flagged',
      icon: 'pdf',
    },
    {
      id: 5,
      name: 'Historical_Manuscript_Scan.pdf',
      uploader: 'Prof. Michael Chen',
      flagType: 'Potential Copyright',
      flagClass: 'flag-copyright',
      confidence: 67,
      status: 'Under Review',
      statusClass: 'status-review',
      icon: 'pdf',
    },
  ];

  const barData = [
    { hour: '9AM', value: 45 },
    { hour: '10AM', value: 72 },
    { hour: '11AM', value: 58 },
    { hour: '12PM', value: 95 },
    { hour: '1PM', value: 30 },
    { hour: '2PM', value: 68 },
    { hour: '3PM', value: 82 },
    { hour: '4PM', value: 41 },
    { hour: '5PM', value: 55 },
  ];

  const maxValue = Math.max(...barData.map((b) => b.value));

  const Icon = ({ name, className = '' }) => {
    const icons = {
      grid: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
      users: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      repository: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      ),
      logs: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8h10" />
          <path d="M7 12h10" />
          <path d="M7 16h6" />
        </svg>
      ),
      settings: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      audit: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="13" y2="17" />
        </svg>
      ),
      pdf: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
      doc: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
          <line x1="8" y1="9" x2="10" y2="9" />
        </svg>
      ),
      zip: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <rect x="10" y="12" width="4" height="3" />
          <rect x="10" y="16" width="4" height="3" />
        </svg>
      ),
      refresh: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      ),
      bell: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      search: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
      calendar: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
      chevronDown: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      ),
      support: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      logout: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      ),
      plus: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
      trend: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      ),
      graduation: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M22 10l-10-5L2 10l10 5 10-5z" />
          <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
        </svg>
      ),
    };
    return icons[name] || null;
  };

  const toggleRow = (id) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  return (
    <>
      <div className="app-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-header">
              <div className="sidebar-brand-logo">
                <Icon name="graduation" className="" />
              </div>
              <div>
                <h1 className="sidebar-brand-title">ScholarHub</h1>
                <p className="sidebar-brand-subtitle">Admin Console</p>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <button
                key={item.name}
                className={`nav-item ${activeNav === item.name ? 'active' : ''}`}
                onClick={() => setActiveNav(item.name)}
              >
                <Icon name={item.icon} className="" />
                <span>{item.name}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-actions">
            <button className="btn-new-report">
              <Icon name="plus" className="" />
              <span>New System Report</span>
            </button>
            <button className="btn-sidebar-ghost">
              <Icon name="support" className="" />
              <span>Support</span>
            </button>
            <button className="btn-sidebar-ghost">
              <Icon name="logout" className="" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {/* Page Header */}
          <header className="page-header">
            <div>
              <h1 className="page-header-title">AI Content Moderation</h1>
              <p className="page-header-subtitle">
                Review and manage documents flagged by the AI engine.
              </p>
            </div>
            <div className="header-actions">
              <button className="btn-icon">
                <Icon name="refresh" className="" />
              </button>
              <button className="btn-icon">
                <Icon name="bell" className="" />
                <span className="notification-dot"></span>
              </button>
            </div>
          </header>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-label">Total Flagged Today</p>
              <p className="stat-value">24</p>
              <div className="stat-trend">
                <Icon name="trend" className="" />
                <span className="stat-trend-text">+12% from yesterday</span>
              </div>
            </div>

            <div className="stat-card">
              <p className="stat-label">Pending Review</p>
              <p className="stat-value">15</p>
              <div className="stat-progress">
                <div className="stat-progress-fill" style={{ width: '62%' }}></div>
              </div>
            </div>

            <div className="stat-card dark">
              <p className="stat-label">AI Precision Score</p>
              <p className="stat-value">98.2%</p>
              <p className="stat-description">Confidence rating across 1.2k scans</p>
            </div>

            <div className="stat-card">
              <p className="stat-label">System Capacity</p>
              <p className="stat-value small">1.2TB / 2TB</p>
              <div className="stat-capacity-bars">
                <div className="stat-capacity-bar filled"></div>
                <div className="stat-capacity-bar filled"></div>
                <div className="stat-capacity-bar filled"></div>
                <div className="stat-capacity-bar empty"></div>
                <div className="stat-capacity-bar empty"></div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="filter-bar-inner">
              <div className="search-input-wrapper">
                <Icon name="search" className="" />
                <input
                  type="text"
                  placeholder="Search by document or uploader..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="select-wrapper">
                <select
                  value={flagType}
                  onChange={(e) => setFlagType(e.target.value)}
                  className="filter-select"
                >
                  <option>All</option>
                  <option>AI-Generated</option>
                  <option>Restricted Keywords</option>
                  <option>Potential Copyright</option>
                </select>
                <Icon name="chevronDown" className="" />
              </div>
              <div className="select-wrapper">
                <select
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                  className="filter-select"
                >
                  <option>80%+</option>
                  <option>60%+</option>
                  <option>90%+</option>
                  <option>All</option>
                </select>
                <Icon name="chevronDown" className="" />
              </div>
              <button className="btn-date-range">
                <Icon name="calendar" className="" />
                <span>{dateRange}</span>
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="table-section">
            <div className="table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Uploader</th>
                    <th>Flag Type</th>
                    <th>AI Confidence</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className={selectedRows.includes(doc.id) ? 'selected' : ''}
                      onClick={() => toggleRow(doc.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="doc-name-cell">
                          <Icon name={doc.icon} className="" />
                          <span className="doc-name-text">{doc.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="uploader-text">{doc.uploader}</span>
                      </td>
                      <td>
                        <span className={`flag-badge ${doc.flagClass}`}>
                          {doc.flagType}
                        </span>
                      </td>
                      <td>
                        <div className="confidence-cell">
                          <div className="confidence-bar">
                            <div
                              className="confidence-fill"
                              style={{ width: `${doc.confidence}%` }}
                            ></div>
                          </div>
                          <span className="confidence-text">{doc.confidence}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="status-cell">
                          <span
                            className={`status-dot ${
                              doc.status === 'Flagged' ? 'flagged' : 'review'
                            }`}
                          ></span>
                          <span className={`status-text ${doc.statusClass}`}>
                            {doc.status}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button className="btn-review" onClick={(e) => e.stopPropagation()}>
                          Review →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="pagination">
                <p className="pagination-info">Showing 1-15 of 24 flagged documents</p>
                <div className="pagination-actions">
                  <button
                    className="btn-pagination"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <button
                    className="btn-pagination primary"
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="chart-section">
            <h2 className="chart-title">Global AI Activity Monitor</h2>
            <div className="chart-card">
              <div className="chart-container">
                {barData.map((bar, idx) => (
                  <div key={idx} className="chart-bar-wrapper">
                    <div className="chart-bar-container">
                      <div
                        className="chart-bar"
                        style={{
                          height: `${(bar.value / maxValue) * 100}%`,
                          animationDelay: `${idx * 0.05}s`,
                        }}
                      ></div>
                    </div>
                    <span className="chart-label">{bar.hour}</span>
                  </div>
                ))}
              </div>
              <p className="chart-caption">
                Real-time scan frequency per hour across institutional nodes
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default AIContentModerationPage;
