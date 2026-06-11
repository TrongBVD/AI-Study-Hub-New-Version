import { useState } from "react";
import "./CloudUploadPage.css";
import "../../../assets/icons/themify-icons-font/themify-icons/themify-icons.css";

function CloudUploadPage() {
  const [cloudLink, setCloudLink] = useState("");
  const [viewMode, setViewMode] = useState("list");

  const documents = [
    {
      id: 1,
      name: "Quantitative_Analysis_2023.pdf",
      addedAt: "Oct 12, 2023",
      size: "4.2 MB",
      status: "Indexed",
      icon: "ti-file",
    },
    {
      id: 2,
      name: "Anthropology_Field_Notes_V4.docx",
      addedAt: "Oct 14, 2023",
      size: "1.8 MB",
      status: "Scanning...",
      icon: "ti-file",
    },
    {
      id: 3,
      name: "Medieval_Manuscript_Scans_Archive.zip",
      addedAt: "Oct 15, 2023",
      size: "402.1 MB",
      status: "Indexed",
      icon: "ti-archive",
    },
  ];

  const cloudProviders = [
    {
      name: "Google Drive",
      status: "Linked",
      icon: "ti-google",
      connected: true,
    },
    {
      name: "OneDrive",
      status: "Linked",
      icon: "ti-cloud",
      connected: true,
    },
    {
      name: "Dropbox",
      status: "Connect",
      icon: "ti-dropbox",
      connected: false,
    },
  ];

  function handleScanLink() {
    if (cloudLink.trim() === "") return;

    console.log("Scan cloud link:", cloudLink);
    setCloudLink("");
  }

  return (
    <main className="cloud_upload_page">
      <section className="cloud_management_shell">
        <header className="cloud_management_header">
          <div>
            <h1>Cloud Link Management</h1>
            <p>
              Integrate and index external academic resources from global cloud
              providers.
            </p>
          </div>

          <button type="button" className="sync_provider_btn">
            <i className="ti-link"></i>
            Sync All Providers
          </button>
        </header>

        <section className="cloud_management_grid">
          <section className="cloud_main_column">
            <section className="cloud_import_card">
              <div className="cloud_card_title">
                <div className="cloud_title_icon">
                  <i className="ti-cloud-up"></i>
                </div>

                <div>
                  <h2>Cloud Import</h2>
                  <p>
                    Paste links from Google Drive, OneDrive, or Dropbox to index
                    resources using the ScholarHub AI crawler.
                  </p>
                </div>
              </div>

              <div className="cloud_link_form">
                <div className="cloud_link_input">
                  <i className="ti-link"></i>
                  <input
                    type="text"
                    value={cloudLink}
                    placeholder="https://drive.google.com/file/d/..."
                    onChange={(e) => setCloudLink(e.target.value)}
                  />
                </div>

                <button type="button" onClick={handleScanLink}>
                  <i className="ti-target"></i>
                  Scan & Index
                </button>
              </div>

              <div className="cloud_import_features">
                <span>
                  <i className="ti-check-box"></i>
                  Auto-metadata extraction
                </span>

                <span>
                  <i className="ti-check-box"></i>
                  Content indexing
                </span>

                <span>
                  <i className="ti-check-box"></i>
                  Permission mapping
                </span>
              </div>
            </section>

            <section className="integrated_documents_card">
              <div className="integrated_documents_header">
                <div>
                  <h2>Integrated Documents</h2>
                  <span>12 Active</span>
                </div>

                <div className="document_view_actions">
                  <button
                    type="button"
                    className={viewMode === "grid" ? "active" : ""}
                    onClick={() => setViewMode("grid")}
                  >
                    <i className="ti-layout-grid2"></i>
                  </button>

                  <button
                    type="button"
                    className={viewMode === "list" ? "active" : ""}
                    onClick={() => setViewMode("list")}
                  >
                    <i className="ti-menu-alt"></i>
                  </button>
                </div>
              </div>

              <div className="integrated_document_list">
                {documents.map((document) => (
                  <article className="integrated_document_item" key={document.id}>
                    <div className="integrated_document_icon">
                      <i className={document.icon}></i>
                    </div>

                    <div className="integrated_document_info">
                      <h3>{document.name}</h3>
                      <p>
                        Added: {document.addedAt} · {document.size}
                      </p>
                    </div>

                    <span className="document_index_status">
                      {document.status}
                    </span>

                    <button type="button" className="document_download_btn">
                      <i className="ti-download"></i>
                      Download
                    </button>

                    <button type="button" className="document_delete_btn">
                      <i className="ti-trash"></i>
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </section>

          <aside className="cloud_side_column">
            <section className="download_center_card">
              <div className="cloud_side_title">
                <div className="side_title_icon">
                  <i className="ti-bar-chart"></i>
                </div>

                <h2>Download Center</h2>
              </div>

              <div className="download_limit_block">
                <div>
                  <span>Daily Download Limit</span>
                  <strong>1.2GB / 5GB used</strong>
                </div>

                <div className="download_progress">
                  <span></span>
                </div>

                <p>
                  Resetting in 14h 22m. Limits are scaled based on your Academic
                  Tier.
                </p>
              </div>

              <div className="download_stats_grid">
                <div>
                  <strong>14</strong>
                  <span>Files Today</span>
                </div>

                <div>
                  <strong>8.4s</strong>
                  <span>Avg Speed</span>
                </div>
              </div>

              <button type="button" className="download_history_btn">
                View Download History
              </button>
            </section>

            <section className="cloud_status_card">
              <h2>Cloud Status</h2>

              <div className="cloud_provider_list">
                {cloudProviders.map((provider) => (
                  <div className="cloud_provider_item" key={provider.name}>
                    <div>
                      <span className="provider_icon">
                        <i className={provider.icon}></i>
                      </span>

                      <strong>{provider.name}</strong>
                    </div>

                    <span
                      className={
                        provider.connected
                          ? "provider_status linked"
                          : "provider_status connect"
                      }
                    >
                      {provider.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="automated_indexing_card">
              <i className="ti-sparkles"></i>
              <h2>Automated Indexing</h2>
              <p>
                Files added via cloud links are automatically OCR-processed and
                cross-referenced with your existing research citations.
              </p>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}

export default CloudUploadPage;