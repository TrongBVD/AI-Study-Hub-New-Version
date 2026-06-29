import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Navbar from "./Navbar.jsx";
import "./Dashboard.css";

function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="layout user_dashboard_layout">
      {isSidebarOpen && (
        <div
          className="sidebar_overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="main_area">
        <Navbar onOpenSidebar={() => setIsSidebarOpen(true)} />

        <main className="content user_dashboard_content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
export default Dashboard;
