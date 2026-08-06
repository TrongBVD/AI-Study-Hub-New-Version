import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getDocumentView } from "../../../utils/documentApi";
import { viewPublicDocument } from "../../../utils/publicApi";
import { getStoredUser } from "../../../utils/authToken";
import FileViewer from "../FileViewer/FileViewer";
import "./DocumentViewerPage.css";

function formatDisplayFileName(fileName) {
  return String(fileName || "Untitled document")
    .replace(/\.(pdf|docx|txt)$/i, "")
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function DocumentViewerPage() {
  const { documentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [documentData, setDocumentData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const isGuest = getStoredUser()?.role === "GUEST";
  const returnContext = location.state?.returnContext;
  const documentLibraryId = documentData?.libraryId || documentData?.library_id;

  function handleReturn() {
    const destination =
      location.state?.from ||
      (documentLibraryId
        ? `/dashboard/libraries/${documentLibraryId}`
        : "/dashboard/libraries");

    navigate(destination, {
      state:
        returnContext === "files"
          ? { workspaceTab: "documents" }
          : undefined,
    });
  }

  useEffect(() => {
    let isMounted = true;

    async function loadDocument() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const data = isGuest
          ? await viewPublicDocument(documentId)
          : await getDocumentView(documentId);
        if (!isMounted) return;

        setDocumentData(data);
      } catch (error) {
        if (!isMounted) return;

        setErrorMessage(
          error.response?.data?.message || "Cannot open this document.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDocument();

    return () => {
      isMounted = false;
    };
  }, [documentId, isGuest]);

  if (isLoading) {
    return (
      <main className="document_viewer_state">
        <div>
          <i className="ti-reload document_viewer_spinner" />
          <h1>Opening document</h1>
          <p>Please wait while we prepare a secure viewing link.</p>
        </div>
      </main>
    );
  }

  if (errorMessage || !documentData?.viewUrl) {
    return (
      <main className="document_viewer_state">
        <div>
          <i className="ti-alert" />
          <h1>Document unavailable</h1>
          <p>{errorMessage || "The viewing link could not be created."}</p>
          <button type="button" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <FileViewer
      documentUrl={documentData.viewUrl}
      documentName={documentData.fileName}
      displayName={formatDisplayFileName(documentData.fileName)}
      documentId={documentData.documentId}
      backLabel={
        returnContext === "solution"
          ? "Back to Solution"
          : returnContext === "topic"
            ? "Back to Topic"
            : returnContext === "files"
              ? "Back to Files"
              : returnContext === "library" || documentLibraryId
                ? "Back to Library"
                : "Back to Libraries"
      }
      onBack={handleReturn}
    />
  );
}

export default DocumentViewerPage;
