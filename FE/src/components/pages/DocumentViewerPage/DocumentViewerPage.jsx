import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDocumentView } from "../../../utils/documentApi";
import FileViewer from "../FileViewer/FileViewer";
import "./DocumentViewerPage.css";

function DocumentViewerPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [documentData, setDocumentData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDocument() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const data = await getDocumentView(documentId);
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
  }, [documentId]);

  if (isLoading) {
    return (
      <main className="document_viewer_state">
        <div>
          <i className="ti-reload" />
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
      documentId={documentData.documentId}
    />
  );
}

export default DocumentViewerPage;
