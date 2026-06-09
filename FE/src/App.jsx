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


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<Navigate to="/dashboard/home" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/register" element={<RegisterGoogle />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/enter-username-password" element={<EnterUserNamePass />} />
        <Route path="/verify-otp" element={<OTPVerification />} />
        <Route path="/otp-verification" element={<OTPVerification />} />

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
          <Route path="libraries/create" element={<CreateLibraryPage />} />
          <Route path="create-library" element={<CreateLibraryPage />} />
          <Route path="libraries/:libraryId" element={<LibraryPage />} />

          <Route path="create-workspace" element={<CreateWorkSpacePage />} />

          <Route path="profile" element={<PersonalProfilePage />} />
          <Route path="ai-chat" element={<ChatBot />} />
          <Route path="flashcards" element={<Flashcards />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;