from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, KeepTogether, HRFlowable
)
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from PIL import Image as PILImage

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "AI_StudyHub_Milestone_02_Report.pdf"
AI_DIR = ROOT / "tmp" / "pdfs" / "ai_logs"
APP_DIR = ROOT / "tmp" / "pdfs" / "app_screens"

NAVY = colors.HexColor("#172554")
BLUE = colors.HexColor("#2563EB")
ORANGE = colors.HexColor("#F97316")
PALE = colors.HexColor("#F8FAFC")
INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#64748B")
GREEN = colors.HexColor("#16A34A")
RED = colors.HexColor("#DC2626")

pdfmetrics.registerFont(TTFont("Arial", "C:/Windows/Fonts/arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", "C:/Windows/Fonts/arialbd.ttf"))

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="BodyA", fontName="Arial", fontSize=9.2, leading=13, textColor=INK, spaceAfter=5))
styles.add(ParagraphStyle(name="SmallA", fontName="Arial", fontSize=7.5, leading=10, textColor=MUTED))
styles.add(ParagraphStyle(name="TitleA", fontName="Arial-Bold", fontSize=27, leading=31, textColor=NAVY))
styles.add(ParagraphStyle(name="SubA", fontName="Arial", fontSize=12, leading=17, textColor=MUTED))
styles.add(ParagraphStyle(name="H1A", fontName="Arial-Bold", fontSize=18, leading=22, textColor=NAVY, spaceBefore=2, spaceAfter=9))
styles.add(ParagraphStyle(name="H2A", fontName="Arial-Bold", fontSize=12, leading=15, textColor=BLUE, spaceBefore=7, spaceAfter=5))
styles.add(ParagraphStyle(name="CellA", fontName="Arial", fontSize=7.3, leading=9.2, textColor=INK))
styles.add(ParagraphStyle(name="CellHeadA", fontName="Arial-Bold", fontSize=7.4, leading=9.2, textColor=colors.white))
styles.add(ParagraphStyle(name="CaptionA", fontName="Arial", fontSize=7.5, leading=10, textColor=MUTED, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="CoverTag", fontName="Arial-Bold", fontSize=10, textColor=ORANGE, alignment=TA_CENTER))


def P(text, style="BodyA"):
    return Paragraph(text, styles[style])


def table(rows, widths, header=True):
    data = []
    for r, row in enumerate(rows):
        data.append([P(str(x), "CellHeadA" if header and r == 0 else "CellA") for x in row])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("BACKGROUND", (0, 0), (-1, 0), NAVY if header else colors.white),
    ]
    for r in range(1 if header else 0, len(rows)):
        if r % 2 == 0:
            commands.append(("BACKGROUND", (0, r), (-1, r), PALE))
    t.setStyle(TableStyle(commands))
    return t


def fitted_image(path, max_w=170*mm, max_h=105*mm):
    with PILImage.open(path) as im:
        w, h = im.size
    scale = min(max_w / w, max_h / h)
    return Image(str(path), width=w * scale, height=h * scale)


def screenshot_block(path, caption, max_h=110*mm):
    return KeepTogether([
        fitted_image(path, 170*mm, max_h),
        Spacer(1, 2*mm),
        P(caption, "CaptionA"),
    ])


def header_footer(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setStrokeColor(colors.HexColor("#E2E8F0"))
        canvas.line(20*mm, 282*mm, 190*mm, 282*mm)
        canvas.setFont("Arial", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(20*mm, 287*mm, "AI StudyHub  |  Milestone 02")
        canvas.drawRightString(190*mm, 12*mm, f"Page {doc.page}")
    canvas.restoreState()


doc = BaseDocTemplate(
    str(OUT), pagesize=A4, rightMargin=20*mm, leftMargin=20*mm,
    topMargin=18*mm, bottomMargin=18*mm, title="AI StudyHub - Milestone 02 Report",
    author="AI StudyHub Team"
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=header_footer)])
story = []

# Cover
story += [
    Spacer(1, 20*mm),
    P("FPT UNIVERSITY - HCMC CAMPUS", "CoverTag"),
    Spacer(1, 8*mm),
    HRFlowable(width="32%", thickness=4, color=ORANGE, hAlign="CENTER"),
    Spacer(1, 13*mm),
    P("AI StudyHub", "TitleA"),
    Spacer(1, 4*mm),
    P("Milestone 02 Report", "TitleA"),
    Spacer(1, 7*mm),
    P("Near-complete product evidence: upload workflow, architecture, database, Git contribution, and AI-assisted debugging", "SubA"),
    Spacer(1, 22*mm),
    table([
        ["Team member", "Student ID"],
        ["Bui Vo Duc Trong", "SE204122"],
        ["Ha Thuc Nhat Thanh", "SE204066"],
        ["Vo Dang Khoa", "SE204298"],
        ["Le Minh Hoang", "SE204280"],
    ], [105*mm, 45*mm]),
    Spacer(1, 18*mm),
    P("<b>Course:</b> SWP391 - Software Development Project", "BodyA"),
    P("<b>Submission:</b> Milestone 02 - Week 08", "BodyA"),
    P("<b>Prepared:</b> 04 July 2026", "BodyA"),
]
story.append(PageBreak())

# Executive summary
story += [
    P("1. Executive Summary", "H1A"),
    P("AI StudyHub is a web-based academic document platform that combines personal and shared libraries, workspace collaboration, document processing, AI moderation, semantic retrieval, and administrative controls. This report demonstrates the Milestone 02 requirements using checked-in source code, all-branch Git history, the project database specification, and captured application/debugging evidence."),
    table([
        ["Milestone criterion", "Evidence in this report", "Status"],
        ["Project and team", "Cover page and team roster", "Covered"],
        ["Main workflow + at least 2 exception paths", "Document upload flow with validation, processing, moderation, and recovery branches", "Covered"],
        ["Multi-layer codebase and complete CRUD", "React presentation layer, API wrappers, Express routes/controllers/services, Supabase persistence; representative CRUD matrix", "Covered"],
        ["Database with at least 10 tables", "15-table logical data model", "Covered"],
        ["At least 8 commits/member", "All local and remote branches; identities consolidated by member", "Covered"],
        ["At least 6 AI debugging logs", "7 supplied AI-assistance screenshots", "Covered"],
    ], [46*mm, 94*mm, 25*mm]),
    P("Scope note", "H2A"),
    P("Git counts are repository-history counts across <b>all branches visible in the local clone</b>. Aliases sharing the same verified email or known team identity are consolidated. The database section reports the project logical schema documented in the SRS evidence; runtime deployment credentials and live production data are intentionally excluded."),
    P("Evidence base", "H2A"),
    P("Primary artifacts: FE and BE source trees; <font name='Arial'>tools/srs_rewrite/evidence.json</font>; all-branch Git history; nine application screenshots; and seven AI debugging screenshots supplied by the team."),
]
story.append(PageBreak())

# Architecture
story += [
    P("2. Product and Architecture", "H1A"),
    P("The application follows a layered web architecture. Each layer has a narrow responsibility, making the upload pipeline traceable from the browser to storage and AI processing."),
    table([
        ["Layer", "Primary implementation", "Responsibilities"],
        ["Presentation", "React/Vite pages and components", "Library navigation, upload interaction, document views, admin dashboards, user feedback."],
        ["Client API", "FE/src/utils/*.js", "HTTP endpoint wrappers, authentication headers, refresh/retry behavior, and response normalization."],
        ["Routing and access control", "Express routes + auth/admin middleware", "Endpoint mapping, authenticated-user context, role checks, and request rejection."],
        ["Application logic", "Controllers", "Coordinates validation, CRUD operations, response codes, and workflow transitions."],
        ["Domain services", "aiService, textExtractService, activityLogService", "Text extraction, chunking, AI moderation, embeddings, RAG support, and audit logging."],
        ["Persistence and external services", "Supabase/PostgreSQL, storage, Gemini", "Relational data, file storage, vector data, authentication, and AI inference."],
    ], [33*mm, 52*mm, 80*mm]),
    Spacer(1, 5*mm),
    table([
        ["Client", "API", "Workflow services", "Data/AI"],
        ["React Library page", "documentApi -> Express route", "documentController -> extraction/moderation/chunking", "Supabase tables + storage; Gemini moderation/embedding"],
    ], [38*mm, 42*mm, 51*mm, 34*mm]),
    P("Implementation highlights", "H2A"),
    P("The backend extracts text from PDF, DOCX, and TXT files, normalizes whitespace, and splits content into overlapping chunks. The AI service moderates academic suitability, generates or validates tags, creates 768-dimensional embeddings, and supports RAG answers and flashcard generation. Controllers handle authentication failures, missing resources, database errors, and file-processing failures with explicit HTTP responses."),
    P("Representative CRUD coverage", "H2A"),
    table([
        ["Resource", "Create", "Read", "Update", "Delete"],
        ["Libraries", "Create library", "List/get library", "Edit metadata/settings", "Delete library"],
        ["Documents", "Upload document", "List/view/download", "Visibility/metadata/moderation state", "Delete document"],
        ["Workspaces", "Create workspace", "List/get workspace", "Update workspace and members", "Delete/leave workspace"],
        ["Users/Admin", "Register/invite", "Profile/user directory", "Profile/status/role actions", "Administrative disable/removal path"],
    ], [28*mm, 34*mm, 34*mm, 39*mm, 30*mm]),
]
story.append(PageBreak())

# Workflow
story += [
    P("3. Main Workflow - Upload Document", "H1A"),
    P("The selected end-to-end workflow begins in a library, crosses the client and backend layers, invokes extraction and AI processing, persists metadata/chunks, and returns a visible result to the user."),
    table([
        ["Step", "Actor/layer", "Action and expected result"],
        ["1", "User / React UI", "Open a library, select Upload file, and choose a PDF, DOCX, or TXT document."],
        ["2", "Client validation", "Validate required context, file type, size, and tags before sending multipart form data."],
        ["3", "API + middleware", "Attach authentication, resolve the current user, and route the request to the document controller."],
        ["4", "Controller", "Validate library/workspace access and create the document/storage operation."],
        ["5", "Text service", "Extract readable text, normalize it, and split it into overlapping chunks."],
        ["6", "AI service", "Moderate academic suitability and validate/generate tags; optionally produce embeddings for chunks."],
        ["7", "Persistence", "Save document metadata, storage location, tags, chunks, moderation state, and activity/usage records."],
        ["8", "UI refresh", "Return success; refresh the library so the uploaded document and storage usage are visible."],
    ], [12*mm, 39*mm, 114*mm]),
    P("Workflow outcome", "H2A"),
    P("For a valid document, the user sees the new item in the selected library. The system retains enough metadata and extracted content for later search, RAG, flashcard, moderation, and audit capabilities."),
]
upload_screen = APP_DIR / "Application_s screens" / "Screenshot 2026-07-04 125100.png"
story += [Spacer(1, 3*mm), screenshot_block(upload_screen, "Figure 1. Library detail screen exposing the primary Upload file action and storage state.", 102*mm)]
story.append(PageBreak())

# Exceptions
story += [
    P("4. Exception and Recovery Paths", "H1A"),
    P("The workflow includes explicit branches before and after the request reaches the backend. These paths prevent invalid data from becoming visible and give the user a controlled result."),
    table([
        ["Path", "Trigger", "System response", "Recovery"],
        ["E1 - Invalid or unsupported file", "No file, unsupported type, missing buffer, or file exceeds configured limits", "Reject before persistence; return a clear validation error. Text extraction accepts PDF, DOCX, and TXT only.", "User selects a supported document within the configured limit and retries."],
        ["E2 - Authentication or authorization failure", "Expired/missing session or no access to the target library/workspace", "Middleware/controller returns 401/403; no document is created in the protected location.", "Client refreshes the session when possible; otherwise user signs in or selects an authorized library."],
        ["E3 - AI/content moderation branch", "Content violates academic rules or AI result is uncertain", "Set REJECTED/FLAGGED/PENDING_RETRY rather than publishing normally; record reason/status.", "Admin reviews flagged content or the user uploads a corrected document."],
        ["E4 - Processing/storage failure", "Extraction, AI, storage, or database operation fails", "Return an error response; avoid presenting a false successful upload; log diagnostic context.", "Retry transient operations or correct service configuration/data before retry."],
    ], [31*mm, 43*mm, 55*mm, 36*mm]),
    P("State model", "H2A"),
    table([
        ["State", "Meaning", "Allowed next states"],
        ["PENDING", "Uploaded and awaiting moderation/processing", "APPROVED, REJECTED, FLAGGED, PENDING_RETRY"],
        ["APPROVED", "Accepted and visible according to access rules", "DELETED"],
        ["REJECTED", "Blocked by AI or retained after admin review", "FLAGGED or APPROVED after review"],
        ["FLAGGED", "Requires administrative review", "APPROVED or REJECTED"],
        ["PENDING_RETRY", "Transient AI/processing error", "PENDING, APPROVED, REJECTED, FLAGGED"],
        ["DELETED", "Soft-deleted and hidden", "Scheduled purge"],
    ], [31*mm, 79*mm, 55*mm]),
]
story.append(PageBreak())

# Screens
for title, filename, caption in [
    ("5. Product Evidence - Libraries", "Libraries_Page.png", "Figure 2. Personal library collection view with document and visibility summary."),
    ("5. Product Evidence - Create Library", "Create_Library.png", "Figure 3. Structured library creation workflow and live capacity preview."),
    ("5. Product Evidence - User Dashboard", "Library.png", "Figure 4. User workspace command center with library, workspace, and document counts."),
]:
    story += [P(title, "H1A"), screenshot_block(APP_DIR / "Application_s screens" / filename, caption, 188*mm), PageBreak()]

# Database
tables = [
    ("Users", "Accounts, profile, status, and system role"),
    ("Workspaces", "Collaborative study spaces"),
    ("Workspace_Members", "Workspace membership and scoped roles"),
    ("Folders", "Nested workspace/library organization"),
    ("Documents", "File metadata, ownership, privacy, and moderation lifecycle"),
    ("Tags", "Reusable document taxonomy"),
    ("Document_Tags", "Many-to-many document/tag mapping"),
    ("Document_Chunks", "Extracted text chunks and VECTOR(768) embeddings"),
    ("AI_Summaries", "Cached summaries and keywords"),
    ("Flashcards", "AI-generated questions and answers"),
    ("User_AI_Usage", "AI request/token accounting"),
    ("Daily_Quota_Usage", "Daily upload/download quota tracking"),
    ("Activity_Logs", "Auditable user/admin actions"),
    ("Reviews", "Public document ratings"),
    ("Notifications", "Moderation, quota, invitation, and admin messages"),
]
story += [
    P("6. Database Design", "H1A"),
    P("The documented PostgreSQL/Supabase logical model contains <b>15 core tables</b>, exceeding the milestone threshold of 10. The model separates identity, collaboration, document processing, AI artifacts, quotas, auditability, and user communication."),
    table([["#", "Table", "Purpose"]] + [[str(i+1), n, d] for i, (n, d) in enumerate(tables)], [10*mm, 46*mm, 109*mm]),
    P("Key relationships", "H2A"),
    P("Users own or join Workspaces through Workspace_Members. Documents belong to uploaders and optionally workspaces/libraries; Document_Tags links documents to Tags. Document_Chunks, AI_Summaries, Flashcards, and Reviews depend on Documents. Usage, activity, and notification tables provide operational control and traceability."),
]
story.append(PageBreak())

# Admin evidence
for title, filename, caption in [
    ("7. Administration and Monitoring", "Admin_Dashboard.png", "Figure 5. System overview consolidating users, documents, moderation, quotas, and AI usage."),
    ("7. Administration - AI Moderation", "AI_Moderation.png", "Figure 6. Moderation queue for flagged, pending, and high-risk documents."),
    ("7. Administration - Activity Audit", "Activity_Log.png", "Figure 7. Activity logs provide traceability for system, document, and security actions."),
    ("7. Administration - Usage Control", "Usage_Log.png", "Figure 8. Usage monitor tracks storage, AI consumption, and risk status."),
]:
    story += [P(title, "H1A"), screenshot_block(APP_DIR / "Application_s screens" / filename, caption, 188*mm), PageBreak()]

# Git evidence
story += [
    P("8. Git Contribution Evidence - All Branches", "H1A"),
    P("Commit counts were produced with <font name='Arial'>git shortlog -sne --all</font> and consolidated by team identity. This includes local branches and all remote-tracking branches present in the clone at report time."),
    table([
        ["Member", "Observed author identities", "Commits", ">= 8"],
        ["Vo Dang Khoa", "dangkhoabi456; dangkjoabi80@gmail.com", "169", "Yes"],
        ["Bui Vo Duc Trong", "Duc Trong", "51", "Yes"],
        ["Ha Thuc Nhat Thanh", "AikiroKito; aikirokito", "28", "Yes"],
        ["Le Minh Hoang", "Hoang; HoangLeNewbie", "14", "Yes"],
    ], [40*mm, 72*mm, 25*mm, 28*mm]),
    P("Interpretation", "H2A"),
    P("Every team member exceeds the milestone minimum of eight commits. Counts represent authored commits reachable from any branch, not a claim about equal effort or lines changed. Merge commits and historical branch commits remain part of the repository history."),
    P("Branch coverage", "H2A"),
    P("The inspected clone contains main, backend/auth and admin feature branches, document/library and workspace feature branches, chatbot branches, security fixes, UI feature branches, and dedicated Codex fix branches. The report uses <b>--all</b> to avoid undercounting work that has not been merged into main."),
]
story.append(PageBreak())

# AI logs intro
story += [
    P("9. AI Usage and Debugging Evidence", "H1A"),
    P("The team supplied seven screenshots documenting AI-assisted debugging and implementation discussions. They show AI used as an engineering support tool: diagnosing control flow, shaping database changes, designing document-view routing, correcting asynchronous behavior, persisting profile/avatar changes, and auditing misplaced frontend/backend files."),
    table([
        ["Log", "Observed engineering topic", "Value to the team"],
        ["1", "Workspace member modal and API refresh", "Debugged incomplete add-member behavior and list refresh."],
        ["2", "Database design sequencing", "Outlined workspace/member/invitation schema work before implementation."],
        ["3", "Document viewer and backend URL flow", "Traced document selection through API data to the viewer."],
        ["4", "Frontend URL normalization helper", "Diagnosed backend URL leakage into the frontend."],
        ["5", "Missing await in async processing", "Identified sequencing defects in extraction/moderation calls."],
        ["6", "Avatar/profile persistence", "Connected UI state to a database-backed profile update."],
        ["7", "Misplaced AuthPage/backend rendering", "Separated React frontend routing from Express backend responsibilities."],
    ], [14*mm, 69*mm, 82*mm]),
    P("Management practice", "H2A"),
    P("AI recommendations were treated as hypotheses and implementation guidance, then checked against project structure and runtime behavior. Git history supplies accountability for accepted changes; application screenshots supply outcome evidence. Sensitive credentials are not reproduced in this report."),
]
story.append(PageBreak())

ai_files = sorted(AI_DIR.rglob("*.png"))
ai_captions = [
    "AI Debug Log 1 - Add-member modal/API and member-list refresh guidance.",
    "AI Debug Log 2 - Database-first plan for workspace membership and invitations.",
    "AI Debug Log 3 - Document viewer routing and backend file URL design.",
    "AI Debug Log 4 - Frontend URL normalization helper and call-site correction.",
    "AI Debug Log 5 - Missing await and asynchronous extraction/moderation sequencing.",
    "AI Debug Log 6 - Persisting profile/avatar changes through a backend API.",
    "AI Debug Log 7 - Detecting a React AuthPage incorrectly placed in the backend tree.",
]
for i, (path, caption) in enumerate(zip(ai_files, ai_captions), 1):
    story += [P(f"Appendix A.{i} - AI Debugging Log", "H1A"), screenshot_block(path, caption, 188*mm)]
    if i != len(ai_files):
        story.append(PageBreak())

story += [
    PageBreak(),
    P("10. Conclusion and Submission Checklist", "H1A"),
    P("The evidence demonstrates a near-complete AI StudyHub product with an end-to-end document upload path, multiple controlled exception paths, layered frontend/backend/service architecture, a 15-table data model, substantial all-branch Git participation from every team member, and more than the required six AI debugging logs."),
    table([
        ["Submission item", "Result"],
        ["One PDF containing project name and team list", "Included"],
        ["Main upload flow", "Included with eight implementation steps"],
        ["At least two exception paths", "Four paths documented"],
        ["Multi-layer design and CRUD", "Architecture and representative CRUD matrix included"],
        ["Database >= 10 tables", "15 logical tables documented"],
        [">= 8 commits/member", "14-169 consolidated authored commits/member"],
        [">= 6 AI debugging logs", "7 screenshot logs included"],
    ], [105*mm, 60*mm]),
    P("Recommended optional additions", "H2A"),
    P("A repository URL and deployed application URL are not required by the assignment text shown, so they are omitted. If the lecturer values reproducibility, adding them on this page would strengthen traceability without changing the core report."),
    P("Source note", "H2A"),
    P("FPT University identity was verified against the official FPT University website (daihoc.fpt.edu.vn). Product and technical claims are grounded in the local AI StudyHub repository and team-supplied screenshots."),
]

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.build(story)
print(OUT)
