import { useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../../../layout/Dashboard/Navbar.jsx";
import AdminSidebar from "./AdminSidebar.jsx";
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
        <Navbar
          onOpenSidebar={() => setIsSidebarOpen(true)}
          profilePath="/admin/profile"
          searchPlaceholder="Search users, documents, actions or logs..."
        />

        <main className="content admin-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
