import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { purgeUnapprovedLocalStorage } from "./utils/userStorage.js";
import SettingPage from "./components/pages/SettingPage/SettingPage.jsx";
// ================= AUTH IMPORTS =================
import LandingPage from "./components/pages/LandingPage/LandingPage.jsx";
import LoginPage from "./components/pages/LoginPage/LoginPage.jsx";
import ForgotPassword from "./components/pages/LoginPage/ForgotPassword.jsx";
import ResetPassword from "./components/pages/LoginPage/ResetPassword.jsx";

import RegisterGoogle from "./components/pages/RegisterPage/RegisterGoogle.jsx";
import CompleteProfile from "./components/pages/RegisterPage/CompleteProfile.jsx";
import EnterUserNamePass from "./components/pages/RegisterPage/EnterUserNamePass.jsx";
import OTPVerification from "./components/pages/RegisterPage/OTPVerification.jsx";

// ================= LAYOUT IMPORTS =================
import Dashboard from "./components/layout/Dashboard/Dashboard.jsx";

// ================= USER PAGE IMPORTS =================
import CreateLibraryPage from "./components/pages/CreateLibraryPage/CreateLibraryPage.jsx";
import MyWorkSpace from "./components/pages/MyWorkSpace/MyWorkSpace.jsx";
import PersonalProfilePage from "./components/pages/PersonalProfilePage/PersonalProfilePage.jsx";
import CreateWorkSpacePage from "./components/pages/CreateWorkSpacePage/CreateWorkSpacePage.jsx";
import SearchUserPage from "./components/pages/SearchUserPage/SearchUserPage";
import SearchResultPage from "./components/pages/SearchResultPage/SearchResultPage.jsx";
import NotificationsPage from "./components/pages/NotificationsPage/NotificationsPage.jsx";
import DiscoverPage from "./components/pages/DiscoverPage/DiscoverPage.jsx";

// ================= NOTEBOOK LM REDESIGN IMPORTS =================
import NotebookDashboardPage from "./components/pages/NotebookDashboard/NotebookDashboardPage.jsx";
import NotebookWorkspacePage from "./components/pages/NotebookWorkspace/NotebookWorkspacePage.jsx";

// ================= PROTECTED ROUTE =================
import ProtectedRoute from "./components/common/ProtectedRoute/ProtectedRoute.jsx";

// ================= ADMIN IMPORTS =================
import AdminLayout from "./components/pages/Admin/AdminLayout/AdminLayout.jsx";
import ReportIssuePage from "./components/pages/ReportIssuePage/ReportIssuePage.jsx";

const ImportLibraryPage = lazy(() => import("./components/pages/ImportLibraryPage/ImportLibraryPage.jsx"));
const DocumentViewerPage = lazy(() => import("./components/pages/DocumentViewerPage/DocumentViewerPage.jsx"));
const WorkSpacePage = lazy(() => import("./components/pages/WorkSpacePage/WorkSpacePage.jsx"));
const Flashcards = lazy(() => import("./components/pages/Flashcards/Flashcards.jsx"));
const AdminDashboardPage = lazy(() => import("./components/pages/Admin/AdminDashboardPage/AdminDashboardPage.jsx"));
const AdminModerationPage = lazy(() => import("./components/pages/Admin/AiContentModerationPage/AIContentModerationPage.jsx"));
const AdminUsersPage = lazy(() => import("./components/pages/Admin/UserManagementPage/UserManagementPage.jsx"));
const AdminLogsPage = lazy(() => import("./components/pages/Admin/ActivityLogPage/ActivityLogPage.jsx"));
const AdminUsagePage = lazy(() => import("./components/pages/Admin/AdminUsagePage/AdminUsagePage.jsx"));
const AdminProfilePage = lazy(() => import("./components/pages/Admin/AdminProfilePage/AdminProfilePage.jsx"));
const DeletedWorkspacesPage = lazy(() => import("./components/pages/Admin/DeletedWorkspacesPage/DeletedWorkspacesPage.jsx"));
const IssueReportsPage = lazy(() => import("./components/pages/Admin/IssueReportsPage/IssueReportsPage.jsx"));

/**
 * Main Application Component with React Router Configuration
 * Includes NotebookLM UI redesign routes for AI Study Hub
 */
function App() {
  useEffect(() => {
    purgeUnapprovedLocalStorage();
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/reset-password-otp" element={<ResetPassword />} />

          <Route path="/register" element={<RegisterGoogle />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/enter-username-password" element={<EnterUserNamePass />} />
          <Route path="/verify-otp" element={<OTPVerification />} />
          <Route path="/otp-verification" element={<OTPVerification />} />

          {/* Dashboard Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard/home" replace />} />

            {/* NotebookLM Dashboard & Workspace Pages */}
            <Route path="home" element={<NotebookDashboardPage />} />
            <Route path="libraries" element={<NotebookDashboardPage />} />
            <Route path="libraries/:libraryId" element={<NotebookWorkspacePage />} />

            <Route path="discover" element={<DiscoverPage />} />
            <Route
              path="ai-chat"
              element={<Navigate to="/dashboard/libraries" replace />}
            />

            <Route path="create-library" element={<CreateLibraryPage />} />
            <Route path="import-library" element={<ImportLibraryPage />} />
            <Route path="documents/:documentId" element={<DocumentViewerPage />} />
            <Route
              path="workspaces/:workspaceId/topics/:topicId/attachments/:attachmentId"
              element={<DocumentViewerPage />}
            />
            <Route path="settings" element={<SettingPage />} />
            <Route path="create-workspace" element={<CreateWorkSpacePage />} />
            <Route path="workspaces" element={<MyWorkSpace />} />
            <Route path="workspaces/:workspaceId" element={<WorkSpacePage />} />

            <Route path="profile" element={<PersonalProfilePage />} />
            <Route path="profile/:id" element={<PersonalProfilePage />} />

            <Route path="flashcards" element={<Flashcards />} />
            <Route path="search-user" element={<SearchUserPage />} />
            <Route path="search" element={<SearchResultPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="report-issue" element={<ReportIssuePage />} />
          </Route>

          {/* Admin Protected Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="moderation" element={<AdminModerationPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="logs" element={<AdminLogsPage />} />
            <Route path="usage" element={<AdminUsagePage />} />
            <Route path="workspaces/deleted" element={<DeletedWorkspacesPage />} />
            <Route path="issues" element={<IssueReportsPage />} />
            <Route path="settings" element={<SettingPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
          </Route>

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
