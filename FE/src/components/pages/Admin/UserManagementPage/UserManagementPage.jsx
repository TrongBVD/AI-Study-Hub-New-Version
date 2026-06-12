import { useState } from "react";
import "./UserManagement.css";

const UserManagementPage = () => {
  const [activeNav, setActiveNav] = useState('User Management');
  const [activeTab, setActiveTab] = useState('All Users');
  const [sortBy, setSortBy] = useState('Last Activity');
  const [inviteEmail, setInviteEmail] = useState('faculty@university.edu');
  const [inviteSent, setInviteSent] = useState(false);

  const navItems = [
    { name: 'Dashboard', icon: 'dashboard' },
    { name: 'User Management', icon: 'users' },
    { name: 'Storage', icon: 'storage' },
    { name: 'AI Insights', icon: 'ai' },
    { name: 'Settings', icon: 'settings' },
  ];

  const users = [
    {
      id: 1,
      name: 'Dr. Elena Rostova',
      email: 'elena.r@scholarhub.edu',
      avatar: 'ER',
      avatarBg: 'avatar-dark',
      role: 'FACULTY',
      roleClass: 'role-faculty',
      status: 'Active',
      statusClass: 'status-active',
      storageUsed: 82,
      storageText: '41/50GB',
      lastActive: '2 mins ago',
    },
    {
      id: 2,
      name: 'Julian Marchetti',
      email: 'j.marchetti@scholarhub.edu',
      avatar: 'JM',
      avatarBg: 'avatar-tan',
      role: 'RESEARCHER',
      roleClass: 'role-researcher',
      status: 'Active',
      statusClass: 'status-active',
      storageUsed: 12,
      storageText: '12/100GB',
      lastActive: '1 hour ago',
    },
    {
      id: 3,
      name: 'Liam Thorne',
      email: 'l.thorne@scholarhub.edu',
      avatar: 'LT',
      avatarBg: 'avatar-muted',
      role: 'STUDENT',
      roleClass: 'role-student',
      status: 'Suspended',
      statusClass: 'status-suspended',
      storageUsed: 45,
      storageText: '4.5/10GB',
      lastActive: 'Oct 12, 2023',
    },
  ];

  const storageData = [
    { name: 'Humanities & Arts', used: 1.2, total: 2, color: '#2C1810' },
    { name: 'STEM & Medical Research', used: 4.8, total: 5, color: '#2C1810' },
    { name: 'Social Sciences', used: 0.8, total: 2, color: '#2C1810' },
  ];

  const Icon = ({ name, className = '' }) => {
    const icons = {
      dashboard: (
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
      storage: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      ),
      ai: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      ),
      settings: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      search: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
      bell: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      clock: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      graduation: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M22 10l-10-5L2 10l10 5 10-5z" />
          <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
        </svg>
      ),
      plus: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
      userPlus: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      ),
      userIcon: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      lightning: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      mail: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
      shield: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      chevronDown: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      ),
      filter: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      ),
      lock: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      history: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      ban: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      ),
      gear: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      chevronLeft: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      ),
      chevronRight: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      ),
      help: (
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
      pie: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
      ),
      check: (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ),
    };
    return icons[name] || null;
  };

  const handleSendInvite = () => {
    setInviteSent(true);
    setTimeout(() => setInviteSent(false), 2000);
  };

  return (
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
              <span>New Report</span>
            </button>
            <button className="btn-sidebar-ghost">
              <Icon name="help" className="" />
              <span>Help</span>
            </button>
            <button className="btn-sidebar-ghost">
              <Icon name="logout" className="" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {/* Header */}
          <header className="header">
            <div className="search-box">
              <Icon name="search" className="" />
              <input
                type="text"
                placeholder="Search research, users, or logs..."
                className="search-input"
              />
            </div>

            <div className="header-actions">
              <button className="btn-icon">
                <Icon name="bell" className="" />
              </button>
              <button className="btn-icon">
                <Icon name="clock" className="" />
              </button>
              <div className="header-divider"></div>
              <button className="btn-support">Support</button>
              <div className="profile-section">
                <div className="profile-info">
                  <p className="profile-name">Admin Profile</p>
                  <p className="profile-role">Senior Curator</p>
                </div>
                <div className="profile-avatar">A</div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="page-content">
            {/* Breadcrumb */}
            <div className="breadcrumb">
              <span className="breadcrumb-link">Console</span>
              <span>›</span>
              <span className="breadcrumb-current">Users</span>
            </div>

            {/* Page Header */}
            <div className="page-header">
              <div>
                <h1 className="page-header-title">User Management</h1>
                <p className="page-header-subtitle">
                  Configure academic roles, storage limits, and security clearances.
                </p>
              </div>
              <button className="btn-invite">
                <Icon name="userPlus" className="" />
                <span>Invite New User</span>
              </button>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-card-header">
                  <div className="stat-icon user">
                    <Icon name="userIcon" className="" />
                  </div>
                  <span className="stat-badge">+12% this month</span>
                </div>
                <p className="stat-label">Total Users</p>
                <p className="stat-value">1,482</p>
                <div className="stat-progress">
                  <div className="stat-progress-fill" style={{ width: '75%' }}></div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <div className="stat-icon lightning">
                    <Icon name="lightning" className="" />
                  </div>
                  <span className="stat-badge">Real-time</span>
                </div>
                <p className="stat-label">Active Today</p>
                <p className="stat-value">342</p>
                <div className="stat-avatars">
                  <div className="stat-avatar dark">E</div>
                  <div className="stat-avatar muted">J</div>
                  <div className="stat-avatar darker">M</div>
                  <div className="stat-avatar tan">+339</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <div className="stat-icon mail">
                    <Icon name="mail" className="" />
                  </div>
                  <span className="stat-badge red">Action Needed</span>
                </div>
                <p className="stat-label">Pending Invites</p>
                <p className="stat-value">28</p>
                <p className="stat-quote">"Waiting for department head approval"</p>
              </div>
            </div>

            {/* Table Card */}
            <div className="table-card">
              <div className="table-header">
                <div className="table-tabs">
                  <button
                    className={`tab-btn ${activeTab === 'All Users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('All Users')}
                  >
                    All Users
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'Suspended' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Suspended')}
                  >
                    Suspended
                  </button>
                </div>
                <div className="table-controls">
                  <div className="select-wrapper">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="sort-select"
                    >
                      <option>Last Activity</option>
                      <option>Name</option>
                      <option>Role</option>
                      <option>Storage Used</option>
                    </select>
                    <Icon name="chevronDown" className="" />
                  </div>
                  <button className="btn-filter">
                    <Icon name="filter" className="" />
                  </button>
                </div>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>User Profile</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Storage</th>
                    <th>Last Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-profile-cell">
                          <div className={`user-avatar ${user.avatarBg}`}>
                            {user.avatar}
                          </div>
                          <div>
                            <p className="user-name">{user.name}</p>
                            <p className="user-email">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${user.roleClass}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <div className="status-cell">
                          <span
                            className={`status-dot ${
                              user.status === 'Active' ? 'active' : 'suspended'
                            }`}
                          ></span>
                          <span className={`status-text ${user.statusClass}`}>
                            {user.status}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="storage-cell">
                          <div className="storage-bar">
                            <div
                              className={`storage-fill ${
                                user.storageUsed > 70 ? 'high' : 'normal'
                              }`}
                              style={{ width: `${user.storageUsed}%` }}
                            ></div>
                          </div>
                          <span className="storage-text">{user.storageText}</span>
                        </div>
                      </td>
                      <td>
                        <span className="last-active-text">{user.lastActive}</span>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button className="btn-action">
                            <Icon name="lock" className="" />
                          </button>
                          <button className="btn-action">
                            <Icon name="history" className="" />
                          </button>
                          <button
                            className={`btn-action ${
                              user.status === 'Suspended' ? 'suspended' : ''
                            }`}
                          >
                            <Icon
                              name={user.status === 'Suspended' ? 'gear' : 'ban'}
                              className=""
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="pagination">
                <p className="pagination-info">Showing 1 to 10 of 1,482 entries</p>
                <div className="pagination-controls">
                  <button className="btn-page">
                    <Icon name="chevronLeft" className="" />
                  </button>
                  <button className="btn-page-number active">1</button>
                  <button className="btn-page-number">2</button>
                  <button className="btn-page-number">3</button>
                  <button className="btn-page">
                    <Icon name="chevronRight" className="" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Grid */}
            <div className="bottom-grid">
              {/* Storage Card */}
              <div className="storage-card">
                <div className="storage-card-header">
                  <h3 className="storage-card-title">Storage Efficiency</h3>
                  <div className="storage-card-icon">
                    <Icon name="pie" className="" />
                  </div>
                </div>

                {storageData.map((dept) => (
                  <div key={dept.name} className="storage-item">
                    <div className="storage-item-header">
                      <span className="storage-item-name">{dept.name}</span>
                      <span className="storage-item-value">
                        <strong>{dept.used} TB</strong> / {dept.total} TB
                      </span>
                    </div>
                    <div className="storage-item-bar">
                      <div
                        className="storage-item-fill"
                        style={{
                          width: `${(dept.used / dept.total) * 100}%`,
                          backgroundColor: dept.color,
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Invite Card */}
              <div className="invite-card">
                <h3 className="invite-card-title">Invite New Faculty</h3>
                <p className="invite-card-description">
                  Generate unique access tokens for institutional partners and department heads.
                </p>

                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="invite-input"
                  placeholder="faculty@university.edu"
                />

                <button className="btn-send-invite" onClick={handleSendInvite}>
                  {inviteSent ? (
                    <>
                      <Icon name="check" className="" />
                      <span>Invite Sent!</span>
                    </>
                  ) : (
                    <span>Send Invite</span>
                  )}
                </button>

                <div className="invite-security">
                  <Icon name="shield" className="" />
                  <span>Security check compliant</span>
                </div>
              </div>
            </div>
          </div>
        </main>
    </div>
  );
};

export default UserManagementPage;
