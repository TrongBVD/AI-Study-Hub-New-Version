import { useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar.jsx";
import AdminNavbar from "./AdminNavbar.jsx";
import "../../../layout/Dashboard/Dashboard.css";
import "./AdminLayout.css";

function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="admin-layout layout">
      <AdminSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="main_area admin-layout__main-area">
        <AdminNavbar
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="content admin-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
