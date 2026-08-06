import { HiOutlineArrowPath, HiOutlineDocumentText } from "react-icons/hi2";

export default function LibrarySummaryCard({
  documentCount = 0,
  onResetChat,
  resetDisabled = false,
}) {
  return (
    <section className="library_summary_card" aria-label="Library summary">
      <div className="library_summary_card_info">
        <span className="library_summary_card_icon" aria-hidden="true">
          <HiOutlineDocumentText />
        </span>
        <span>
          <small>Library documents</small>
          <strong>
            {documentCount} total {documentCount === 1 ? "file" : "files"}
          </strong>
        </span>
      </div>

      <button
        type="button"
        className="library_summary_reset_btn"
        onClick={onResetChat}
        disabled={resetDisabled}
        title="Start a new chat without deleting history"
      >
        <HiOutlineArrowPath aria-hidden="true" />
        <span>Reset Chat</span>
      </button>
    </section>
  );
}
