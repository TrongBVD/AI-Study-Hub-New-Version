import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import HomePage from "./components/pages/HomePage/HomePage.jsx";
import MyLibraryPage from "./components/pages/MyLibraryPage/MyLibraryPage.jsx";
import CreateLibraryPage from "./components/pages/CreateLibraryPage/CreateLibraryPage.jsx";
import ImportLibraryPage from "./components/pages/ImportLibraryPage/ImportLibraryPage.jsx";
import LibraryPage from "./components/pages/LibraryPage/LibraryPage.jsx";
import MyWorkSpace from "./components/pages/MyWorkSpace/MyWorkSpace.jsx";
import WorkSpacePage from "./components/pages/WorkSpacePage/WorkSpacePage.jsx";
import PersonalProfilePage from "./components/pages/PersonalProfilePage/PersonalProfilePage.jsx";
import Flashcards from "./components/pages/Flashcards/Flashcards.jsx";
import CreateWorkSpacePage from "./components/pages/CreateWorkSpacePage/CreateWorkSpacePage.jsx";
import SearchUserPage from "./components/pages/SearchUserPage/SearchUserPage";
import SearchResultPage from "./components/pages/SearchResultPage/SearchResultPage.jsx";
import DiscoverPage from "./components/pages/DiscoverPage/DiscoverPage.jsx";


// ================= PROTECTED ROUTE =================
import ProtectedRoute from "./components/common/ProtectedRoute/ProtectedRoute.jsx";

// ================= ADMIN IMPORTS =================
import AdminLayout from "./components/pages/Admin/AdminLayout/AdminLayout.jsx";
import AdminDashboardPage from "./components/pages/Admin/AdminDashboardPage/AdminDashboardPage.jsx";
import AdminModerationPage from "./components/pages/Admin/AiContentModerationPage/AIContentModerationPage.jsx";
import AdminUsersPage from "./components/pages/Admin/UserManagementPage/UserManagementPage.jsx";
import AdminLogsPage from "./components/pages/Admin/ActivityLogPage/ActivityLogPage.jsx";
import AdminUsagePage from "./components/pages/Admin/AdminUsagePage/AdminUsagePage.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* DEFAULT: vào web sẽ về login */}
        <Route path="/" element={<LandingPage />} />

        {/* AUTH ROUTES */}

        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password-otp" element={<ResetPassword />} />

        <Route path="/register" element={<RegisterGoogle />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />

        <Route
          path="/enter-username-password"
          element={<EnterUserNamePass />}
        />

        <Route path="/verify-otp" element={<OTPVerification />} />
        <Route path="/otp-verification" element={<OTPVerification />} />

        {/* USER ROUTES - CẦN ĐĂNG NHẬP */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard/home" replace />} />

          <Route path="home" element={<HomePage />} />
          <Route path="discover" element={<DiscoverPage />} />

          <Route path="libraries" element={<MyLibraryPage />} />
          <Route path="create-library" element={<CreateLibraryPage />} />
          <Route path="import-library" element={<ImportLibraryPage />} />
          <Route path="libraries/:libraryId" element={<LibraryPage />} />
          <Route path="settings" element={<SettingPage />} />
          <Route path="create-workspace" element={<CreateWorkSpacePage />} />
          <Route path="workspaces" element={<MyWorkSpace />} />
          <Route path="workspaces/:workspaceId" element={<WorkSpacePage />} />

          <Route path="profile" element={<PersonalProfilePage />} />

          <Route path="profile/:id" element={<PersonalProfilePage />} />



          <Route path="flashcards" element={<Flashcards />} />
          <Route path="search-user" element={<SearchUserPage />} />
          <Route path="search" element={<SearchResultPage />} />
        </Route>

        {/* ADMIN ROUTES - CHỈ SYSTEM_ADMIN TRUY CẬP ĐƯỢC */}
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
          <Route path="settings" element={<SettingPage />} />
          <Route path="profile" element={<PersonalProfilePage />} />
        </Route>

        {/* NOT FOUND */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
