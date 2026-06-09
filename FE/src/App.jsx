import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/layout/Dashboard/Dashboard.jsx";
import HomePage from "./components/pages/HomePage/HomePage.jsx";
import MyLibraryPage from "./components/pages/MyLibraryPage/MyLibraryPage.jsx";
import CreateLibraryPage from "./components/pages/CreateLibraryPage/CreateLibraryPage.jsx";
import CreateWorkSpacePage from "./components/pages/CreateWorkSpacePage/CreateWorkSpacePage.jsx";
import MyWorkSpace from "./components/pages/MyWorkSpace/MyWorkSpace.jsx";
import WorkSpacePage from "./components/pages/WorkSpacePage/WorkSpacePage.jsx";
import LibraryPage from "./components/pages/LibraryPage/LibraryPage.jsx";
import PersonalProfilePage from "./components/pages/PersonalProfilePage/PersonalProfilePage.jsx";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard/home" replace />} />

        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<Navigate to="/dashboard/home" replace />} />

          <Route path="home" element={<HomePage />} />

          <Route path="libraries" element={<MyLibraryPage />} />
          <Route path="libraries/:libraryId" element={<LibraryPage />} />
          <Route path="create-library" element={<CreateLibraryPage />} />

          <Route path="workspaces" element={<MyWorkSpace />} />
          <Route path="workspaces/:workspaceId" element={<WorkSpacePage />} />
          <Route path="create-workspace" element={<CreateWorkSpacePage />} />

          <Route path="profile" element={<PersonalProfilePage />} />

          <Route path="uploads" element={<div>Uploads page</div>} />
          <Route path="subjects" element={<div>Subjects page</div>} />
          <Route path="settings" element={<div>Settings page</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;