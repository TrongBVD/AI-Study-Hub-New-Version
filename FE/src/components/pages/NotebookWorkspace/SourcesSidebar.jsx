import { useState } from "react";
import {
  HiOutlinePlus,
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlineArrowDownTray,
  HiOutlineTrash,
  HiOutlineArrowPath,
} from "react-icons/hi2";
import { LuPanelLeftClose } from "react-icons/lu";
import { MdHistory } from "react-icons/md";

/**
 * SourcesSidebar Component
 * Encapsulates the Left Panel sources list, file upload trigger, select all checkbox,
 * and individual document action buttons (View, Download, Delete).
 */
export default function SourcesSidebar({
  libraryName = "Library",
  documents = [],
  selectedDocIds = new Set(),
  selectAll = false,
  showLeftPanel = true,
  uploading = false,
  canManageLibrary = false,
  fileInputRef,
  onTogglePanel,
  onToggleSelectAll,
  onToggleDocSelect,
  onFileUpload,
  onViewDoc,
  onDownloadDoc,
  onDeleteDoc,
  onRetryDocumentTags,
  retryingDocumentIds = new Set(),
  chatHistory = [],
  activeConversationId = "",
  onOpenHistoryConversation,
  onDeleteHistoryConversation,
  onClearHistory,
  historyActionBusy = false,
}) {
  const [expandedTagKeys, setExpandedTagKeys] = useState(() => new Set());

  const toggleTag = (tagKey) => {
    setExpandedTagKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      if (nextKeys.has(tagKey)) {
        nextKeys.delete(tagKey);
      } else {
        nextKeys.add(tagKey);
      }

      return nextKeys;
    });
  };

  return (
    <aside className={`workspace_panel sources_panel ${showLeftPanel ? "" : "collapsed"}`}>
      <div className="panel_header">
        <div className="panel_title">
          <h3 title={libraryName}>{libraryName}</h3>
        </div>
        <button
          type="button"
          className="icon_btn collapse_sidebar_btn"
          onClick={onTogglePanel}
          title="Collapse library sidebar"
          aria-label="Collapse library sidebar"
        >
          <LuPanelLeftClose />
        </button>
      </div>

      {showLeftPanel && (
        <div className="panel_content">
          {/* Upload Button */}
          {canManageLibrary && (
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
            <span className="selected_count_tag">{selectedDocIds.size} selected</span>
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
              documents.map((doc) => {
                const taggingStatus = String(
                  doc.tagging_status || "COMPLETED",
                ).toUpperCase();
                const tagNames = [
                  doc.tags?.level1,
                  doc.tags?.level2,
                  doc.tags?.level3,
                ].filter(Boolean);
                const isRetrying = retryingDocumentIds.has(doc.id);

                return (
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
                    {(taggingStatus === "PENDING" ||
                      taggingStatus === "PROCESSING") && (
                      <span className="doc_tagging_pending">
                        <HiOutlineArrowPath aria-hidden="true" />
                        Pending generating tags...
                      </span>
                    )}
                    {taggingStatus === "COMPLETED" && tagNames.length > 0 && (
                      <span className="doc_tags" aria-label="AI generated tags">
                        {tagNames.map((tagName, tagIndex) => {
                          const tagKey = `${doc.id}-${tagIndex}`;
                          const isExpanded = expandedTagKeys.has(tagKey);

                          return (
                            <button
                              key={tagKey}
                              type="button"
                              className={`doc_tag ${isExpanded ? "expanded" : ""}`}
                              title={isExpanded ? "Collapse tag" : tagName}
                              aria-expanded={isExpanded}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleTag(tagKey);
                              }}
                            >
                              {tagName}
                            </button>
                          );
                        })}
                      </span>
                    )}
                    {taggingStatus === "FAILED" && (
                      <span className="doc_tagging_failed">
                        <span className="doc_tags">
                          <span>{doc.tags?.level1 || "Other"}</span>
                        </span>
                        <span className="doc_tagging_error">
                          {doc.tagging_error || "AI tagging failed. Please retry."}
                        </span>
                        {canManageLibrary && (
                          <button
                            type="button"
                            className="doc_tag_retry"
                            disabled={isRetrying}
                            onClick={(event) => {
                              event.stopPropagation();
                              onRetryDocumentTags?.(doc.id);
                            }}
                          >
                            <HiOutlineArrowPath aria-hidden="true" />
                            {isRetrying ? "Retrying..." : "Retry tags"}
                          </button>
                        )}
                      </span>
                    )}
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
                    {canManageLibrary && (
                      <button
                        type="button"
                        className="doc_action_btn delete_btn"
                        title="Delete Document"
                        onClick={(e) => onDeleteDoc(doc.id, doc.title, e)}
                      >
                        <HiOutlineTrash />
                      </button>
                    )}
                  </div>
                </div>
                );
              })
            )}
          </div>

          <section className="chat_history_section" aria-label="Chat history">
            <div className="chat_history_heading">
              <div className="chat_history_title">
                <MdHistory aria-hidden="true" />
                <span>Conversations</span>
              </div>
              <div className="chat_history_heading_actions">
                {chatHistory.length > 0 && (
                  <button
                    type="button"
                    className="chat_history_clear"
                    onClick={onClearHistory}
                    disabled={historyActionBusy}
                    title="Delete all chat history in this library"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {chatHistory.length > 0 ? (
              <div className="chat_history_list">
                {[...chatHistory]
                  .sort(
                    (first, second) =>
                      new Date(second.createdAt || 0).getTime() -
                      new Date(first.createdAt || 0).getTime(),
                  )
                  .map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`chat_history_row ${
                        String(activeConversationId) === String(conversation.id)
                          ? "is_active"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={`chat_history_item ${
                          String(activeConversationId) === String(conversation.id)
                            ? "is_active"
                            : ""
                        }`}
                        onClick={() => onOpenHistoryConversation?.(conversation)}
                        disabled={historyActionBusy}
                      >
                        <span>{conversation.title || "Untitled conversation"}</span>
                        <small>{formatChatHistoryDate(conversation.createdAt)}</small>
                      </button>
                      <button
                        type="button"
                        className="chat_history_delete"
                        onClick={() => onDeleteHistoryConversation?.(conversation)}
                        disabled={historyActionBusy}
                        title="Delete this conversation"
                        aria-label={`Delete ${conversation.title || "conversation"}`}
                      >
                        <HiOutlineTrash />
                      </button>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="chat_history_empty">Your conversations will appear here.</p>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}

function formatChatHistoryDate(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays < 7
    ? `${elapsedDays}d ago`
    : new Date(timestamp).toLocaleDateString();
}
