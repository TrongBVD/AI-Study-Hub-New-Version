import React from "react";
import {
  HiOutlinePlus,
  HiOutlineChevronLeft,
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlineArrowDownTray,
  HiOutlineTrash,
} from "react-icons/hi2";

/**
 * SourcesSidebar Component
 * Encapsulates the Left Panel sources list, file upload trigger, select all checkbox,
 * and individual document action buttons (View, Download, Delete).
 */
export default function SourcesSidebar({
  documents = [],
  selectedDocIds = new Set(),
  selectAll = false,
  showLeftPanel = true,
  uploading = false,
  isGuest = false,
  fileInputRef,
  onTogglePanel,
  onToggleSelectAll,
  onToggleDocSelect,
  onFileUpload,
  onViewDoc,
  onDownloadDoc,
  onDeleteDoc,
}) {
  return (
    <aside className={`workspace_panel sources_panel ${showLeftPanel ? "" : "collapsed"}`}>
      <div className="panel_header">
        <div className="panel_title">
          <h3>Sources</h3>
          <span className="source_count_badge">{documents.length}</span>
        </div>
        <button
          type="button"
          className="icon_btn"
          onClick={onTogglePanel}
          title="Toggle Sources Panel"
        >
          <HiOutlineChevronLeft />
        </button>
      </div>

      {showLeftPanel && (
        <div className="panel_content">
          {/* Upload Button */}
          {!isGuest && (
            <button
              type="button"
              className="add_source_btn"
              onClick={() => fileInputRef?.current?.click()}
              disabled={uploading}
            >
              <HiOutlinePlus />
              <span>{uploading ? "Uploading..." : "Add sources"}</span>
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.csv,.json,.mp3,.wav,.m4a,.py,.js,.html,.css"
            onChange={onFileUpload}
          />

          {/* Select All Checkbox */}
          <div className="select_all_bar">
            <label className="checkbox_label">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={onToggleSelectAll}
              />
              <span>Select all</span>
            </label>
          </div>

          {/* Document Sources List */}
          <div className="sources_list">
            {documents.length === 0 ? (
              <div className="empty_sources">
                <HiOutlineDocumentText className="empty_icon" />
                <p>No source documents added yet.</p>
                <span>Upload PDF, DOCX, TXT, MD, CSV, Audio, or Code files to synthesize with AI.</span>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`source_item ${selectedDocIds.has(doc.id) ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedDocIds.has(doc.id)}
                    onChange={() => onToggleDocSelect(doc.id)}
                  />
                  <HiOutlineDocumentText className="doc_icon" />
                  <div className="doc_info">
                    <span className="doc_title">{doc.title || "Untitled Document"}</span>
                    <span className="doc_size">
                      {((doc.file_size_bytes || 0) / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>

                  {/* View, Download & Delete Action Buttons */}
                  <div className="doc_item_actions">
                    <button
                      type="button"
                      className="doc_action_btn"
                      title="View Document"
                      onClick={(e) => onViewDoc(doc.id, e)}
                    >
                      <HiOutlineEye />
                    </button>
                    <button
                      type="button"
                      className="doc_action_btn"
                      title="Download Document"
                      onClick={(e) => onDownloadDoc(doc.id, doc.title, e)}
                    >
                      <HiOutlineArrowDownTray />
                    </button>
                    <button
                      type="button"
                      className="doc_action_btn delete_btn"
                      title="Delete Document"
                      onClick={(e) => onDeleteDoc(doc.id, doc.title, e)}
                    >
                      <HiOutlineTrash />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
