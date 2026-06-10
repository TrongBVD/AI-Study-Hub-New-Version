import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./components/pages/LoginPage/LoginPage.jsx";
import ForgotPassword from "./components/pages/LoginPage/ForgotPassword.jsx";
import ResetPassword from "./components/pages/LoginPage/ResetPassword.jsx";

import RegisterGoogle from "./components/pages/RegisterPage/RegisterGoogle.jsx";
import CompleteProfile from "./components/pages/RegisterPage/CompleteProfile.jsx";
import EnterUserNamePass from "./components/pages/RegisterPage/EnterUserNamePass.jsx";
import OTPVerification from "./components/pages/RegisterPage/OTPVerification.jsx";

import Dashboard from "./components/layout/Dashboard/Dashboard.jsx";

import HomePage from "./components/pages/HomePage/HomePage.jsx";
import MyLibraryPage from "./components/pages/MyLibraryPage/MyLibraryPage.jsx";
import CreateLibraryPage from "./components/pages/CreateLibraryPage/CreateLibraryPage.jsx";
import LibraryPage from "./components/pages/LibraryPage/LibraryPage.jsx";
import MyWorkSpace from "./components/pages/MyWorkSpace/MyWorkSpace.jsx";
import WorkSpacePage from "./components/pages/WorkSpacePage/WorkSpacePage.jsx";
import PersonalProfilePage from "./components/pages/PersonalProfilePage/PersonalProfilePage.jsx";
import ChatBot from "./components/pages/AIchatbot/ChatBot.jsx";
import Flashcards from "./components/pages/Flashcards/Flashcards.jsx";
import CreateWorkSpacePage from "./components/pages/CreateWorkSpacePage/CreateWorkSpacePage.jsx";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// ================= ADMIN IMPORTS - TẠM THỜI COMMENT =================
// import AdminDashboardPage from "./components/pages/Admin/AdminDashboardPage/AdminDashboardPage.jsx";
// import UserManagementPage from "./components/pages/Admin/UserManagementPage/UserManagementPage.jsx";
// import StorageManagementPage from "./components/pages/Admin/StorageManagementPage/StorageManagementPage.jsx";
// import AIContentModerationPage from "./components/pages/Admin/AiContentModerationPage/AIContentModerationPage.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* DEFAULT */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* AUTH ROUTES */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/register" element={<RegisterGoogle />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/enter-username-password" element={<EnterUserNamePass />} />
        <Route path="/verify-otp" element={<OTPVerification />} />
        <Route path="/otp-verification" element={<OTPVerification />} />

        {/* USER ROUTES */}
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

          <Route path="libraries" element={<MyLibraryPage />} />
          <Route path="create-library" element={<CreateLibraryPage />} />
          <Route path="libraries/:libraryId" element={<LibraryPage />} />

          <Route path="create-workspace" element={<CreateWorkSpacePage />} />
          <Route path="workspaces" element={<MyWorkSpace />} />
          <Route path="workspaces/:workspaceId" element={<WorkSpacePage />} />

          <Route path="profile" element={<PersonalProfilePage />} />
          <Route path="ai-chat" element={<ChatBot />} />
          <Route path="flashcards" element={<Flashcards />} />
        </Route>

        {/* ================= ADMIN ROUTES - TẠM THỜI COMMENT ================= */}

        {/*
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/storage"
          element={
            <ProtectedRoute>
              <StorageManagementPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/moderation"
          element={
            <ProtectedRoute>
              <AIContentModerationPage />
            </ProtectedRoute>
          }
        />
        */}

        {/* NOT FOUND */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;