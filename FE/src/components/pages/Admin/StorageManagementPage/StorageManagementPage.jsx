import { useState } from "react";
import "./StorageManagement.css";

const StorageManagementPage = () => {
  const [activeNav, setActiveNav] = useState("Storage Nodes");
  const [autoArchive, setAutoArchive] = useState(true);
  const [dataCleanup, setDataCleanup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  const navItems = [
    { name: "Dashboard", icon: "⊞" },
    { name: "Storage Nodes", icon: "🗄️" },
    { name: "Quota Management", icon: "◫" },
    { name: "Archive Policies", icon: "📋" },
    { name: "Audit Logs", icon: "" },
  ];

  const quotaData = [
    { name: "STEM Research", used: 850, total: 1000 },
    { name: "Humanities", used: 120, total: 300 },
    { name: "Medical Sciences", used: 420, total: 600 },
    { name: "Social Sciences", used: 95, total: 300 },
  ];

  const nodes = [
    {
      id: "Node-US-East",
      location: "Virginia Datacenter 01",
      status: "Active/Healthy",
      statusClass: "status-active",
      load: 78,
      uptime: "248 Days",
      maintenance: "May 12, 2024",
    },
    {
      id: "Node-Europe-West",
      location: "Frankfurt Hub 04",
      status: "Active/Healthy",
      statusClass: "status-active",
      load: 42,
      uptime: "152 Days",
      maintenance: "June 08, 2024",
    },
    {
      id: "Node-Asia-South",
      location: "Mumbai Backup Cluster",
      status: "Standby",
      statusClass: "status-standby",
      load: 12,
      uptime: "1,024 Days",
      maintenance: "Jan 22, 2024",
    },
  ];

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-header">
            <span className="sidebar-brand-icon">📖</span>
            <h1>ScholarHub</h1>
          </div>
          <p className="sidebar-brand-subtitle">Admin Console</p>
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
          <button className="btn-new-node">
            <span>+</span>
            <span>New Node</span>
          </button>

          <button className="btn-sidebar-ghost">
            <span>❓</span>
            <span>Support</span>
          </button>

          <button className="btn-sidebar-ghost">
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <h1 className="header-title">Storage Management</h1>

          <div className="header-actions">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search archive records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <button className="icon-btn">
              <span>❓</span>
            </button>

            <button
              className="icon-btn"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <span></span>
            </button>

            <button className="icon-btn">
              <span>️</span>
            </button>

            <div className="avatar">A</div>
          </div>
        </header>

        {showNotifications && (
          <div className="notifications-dropdown">
            <h3>Notifications</h3>

            <div className="notif-item">
              <p>Storage at 60% capacity</p>
              <p>2 hours ago</p>
            </div>

            <div className="notif-item">
              <p>Node-US-East load high (78%)</p>
              <p>5 hours ago</p>
            </div>
          </div>
        )}

        <div className="page-content">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-header">
                <div>
                  <p className="stat-label">Total Capacity Used</p>
                  <p className="stat-value">
                    1.2<span className="unit">TB</span>
                  </p>
                </div>

                <span className="stat-icon">🗄️</span>
              </div>

              <div className="progress-bar">
                <div className="progress-fill" style={{ width: "60%" }}></div>
              </div>

              <p className="progress-text">60% of 2.0TB total allocated</p>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div>
                  <p className="stat-label">Weekly Growth Rate</p>
                  <p className="stat-value">+4.2%</p>
                </div>

                <span className="stat-icon">📈</span>
              </div>

              <p className="stat-description">
                Approximately 84GB added in the last 7 days.
              </p>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div>
                  <p className="stat-label">Estimated Days Until Full</p>
                  <p className="stat-value red">
                    68<span className="unit">Days</span>
                  </p>
                </div>

                <span className="stat-icon">📅</span>
              </div>

              <p className="stat-description red">
                Recommendation: Expand Node-US-East by Q3.
              </p>
            </div>
          </div>

          <div className="two-col-grid">
            <div className="quota-card">
              <div className="quota-header">
                <div>
                  <h2 className="quota-title">Faculty Quota Distribution</h2>
                  <p className="quota-subtitle">
                    Storage allocation across primary academic departments.
                  </p>
                </div>

                <button className="btn-edit">
                  <span>✎</span>
                  <span>Edit Quota</span>
                </button>
              </div>

              <div className="quota-grid">
                {quotaData.map((dept) => (
                  <div key={dept.name} className="quota-item">
                    <div className="quota-item-header">
                      <span className="quota-item-name">{dept.name}</span>
                      <span className="quota-item-value">
                        {dept.used}GB / {dept.total}GB
                      </span>
                    </div>

                    <div className="quota-progress">
                      <div
                        className="quota-progress-fill"
                        style={{
                          width: `${(dept.used / dept.total) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="policies-card">
              <h3 className="policies-title">Archive Policies</h3>

              <div className="space-y-3">
                <div className="policy-item">
                  <div className="policy-info">
                    <span className="policy-icon"></span>

                    <div>
                      <p className="policy-name">Auto-Archive</p>
                      <p className="policy-description">
                        Move files {">"} 2 years old
                      </p>
                    </div>
                  </div>

                  <button
                    className={`toggle-switch ${
                      autoArchive ? "active" : "inactive"
                    }`}
                    onClick={() => setAutoArchive(!autoArchive)}
                  ></button>
                </div>

                <div className="policy-item">
                  <div className="policy-info">
                    <span className="policy-icon">🧹</span>

                    <div>
                      <p className="policy-name">Data Cleanup</p>
                      <p className="policy-description">
                        Remove redundant caches
                      </p>
                    </div>
                  </div>

                  <button
                    className={`toggle-switch ${
                      dataCleanup ? "active" : "inactive"
                    }`}
                    onClick={() => setDataCleanup(!dataCleanup)}
                  ></button>
                </div>
              </div>

              <button className="btn-view-all">View All Policies →</button>
            </div>
          </div>

          <div className="nodes-card">
            <div className="nodes-header">
              <h2 className="nodes-title">Active Storage Nodes</h2>

              <div className="nodes-actions">
                <button className="btn-icon">
                  <span>🔄</span>
                </button>

                <button className="btn-icon">
                  <span>⋮</span>
                </button>
              </div>
            </div>

            <table className="nodes-table">
              <thead>
                <tr>
                  <th>Node Identity</th>
                  <th>Status</th>
                  <th>Current Load</th>
                  <th>Uptime</th>
                  <th>Last Maintenance</th>
                </tr>
              </thead>

              <tbody>
                {nodes.map((node) => (
                  <tr key={node.id}>
                    <td>
                      <div className="node-info">
                        <span className="node-icon">️</span>

                        <div>
                          <p className="node-name">{node.id}</p>
                          <p className="node-location">{node.location}</p>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`status-badge ${node.statusClass}`}>
                        {node.status}
                      </span>
                    </td>

                    <td>
                      <div className="load-info">
                        <span className="load-value">{node.load}%</span>

                        <div className="load-bar">
                          <div
                            className={`load-fill ${
                              node.load > 70
                                ? "high"
                                : node.load > 40
                                ? "medium"
                                : "low"
                            }`}
                            style={{ width: `${node.load}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    <td className="table-cell-text">{node.uptime}</td>
                    <td className="table-cell-text">{node.maintenance}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button className="btn-download">
              Download Node Statistics Report ↓
            </button>
          </div>

          <footer className="footer">
            <p>
              © 2024 ScholarHub Academic Institution. Institutional Storage
              Division.
            </p>

            <div className="footer-links">
              <a href="#" className="footer-link">
                Privacy Policy
              </a>

              <a href="#" className="footer-link">
                Service Level Agreement
              </a>

              <a href="#" className="footer-link">
                Contact System Administrator
              </a>
            </div>
          </footer>
        </div>

        <button className="fab">+</button>
      </main>
    </div>
  );
};

export default StorageManagementPage;