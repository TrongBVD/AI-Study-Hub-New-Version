import "./FileViewer.css";

function isOfficeDocument(fileName = "") {
  return /\.(docx|doc)$/i.test(fileName);
}

function FileViewer({
  documentUrl,
  documentName,
  displayName,
  backLabel = "",
  onBack,
}) {
  const iframeSrc = isOfficeDocument(documentName)
    ? `https://docs.google.com/gview?url=${encodeURIComponent(documentUrl)}&embedded=true`
    : documentUrl;
  const shownName = displayName || documentName || "Document";

  return (
    <main className="file_viewer_container">
      <section className="file_preview_section">
        <header className="file_viewer_header">
          <div className="file_viewer_title">
            <h1>{shownName}</h1>
          </div>

          {backLabel && onBack && (
            <button
              type="button"
              className="file_viewer_back"
              onClick={onBack}
            >
              <i className="ti-arrow-left" aria-hidden="true"></i>
              {backLabel}
            </button>
          )}

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
            title={`${shownName} preview`}
            width="100%"
            height="100%"
          />
        </div>
      </section>
    </main>
  );
}

export default FileViewer;
