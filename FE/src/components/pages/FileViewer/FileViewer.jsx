import "./FileViewer.css";

function isOfficeDocument(fileName = "") {
  return /\.(docx|doc)$/i.test(fileName);
}

function FileViewer({ documentUrl, documentName }) {
  const iframeSrc = isOfficeDocument(documentName)
    ? `https://docs.google.com/gview?url=${encodeURIComponent(documentUrl)}&embedded=true`
    : documentUrl;

  return (
    <main className="file_viewer_container">
      <section className="file_preview_section">
        <header className="file_viewer_header">
          <div>
            <h1>{documentName || "Document"}</h1>
          </div>

          <a
            className="file_viewer_open"
            href={iframeSrc}
            target="_blank"
            rel="noreferrer"
          >
            <i className="ti-new-window"></i>
            Open in new tab
          </a>
        </header>

        <div className="file_viewer_frame_shell">
          <iframe
            src={iframeSrc}
            title={documentName || "Document preview"}
            width="100%"
            height="100%"
          />
        </div>
      </section>
    </main>
  );
}

export default FileViewer;
