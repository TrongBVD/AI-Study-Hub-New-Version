const supabase = require("../../config/supabase");
const { createActivityLog } = require("../../services/activityLogService");
const path = require("path");
const crypto = require("crypto");

const ATTACHMENT_BUCKET = "issue-report-attachments";

const CATEGORIES = ["LIBRARY", "WORKSPACE", "DISCOVERY", "AI_CHATBOT", "OTHER"];
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"];
const reporterSelect = "reporter:profiles!system_issue_reports_reporter_user_id_fkey(id, email, username, full_name)";

function error(res, status, code, message) { return res.status(status).json({ status: "error", code, message }); }
function clean(value) { return typeof value === "string" ? value.trim() : ""; }
function validateSubmission(body) {
  const category = String(body.category || "").toUpperCase();
  const title = clean(body.title); const description = clean(body.description);
  const pagePath = clean(body.pagePath);
  if (!CATEGORIES.includes(category)) return { code: "INVALID_ISSUE_CATEGORY", message: "A supported issue category is required." };
  if (title.length < 5 || title.length > 150) return { code: "VALIDATION_ERROR", message: "Title must be between 5 and 150 characters." };
  if (description.length < 20 || description.length > 5000) return { code: "VALIDATION_ERROR", message: "Description must be between 20 and 5000 characters." };
  if (pagePath.length > 500) return { code: "VALIDATION_ERROR", message: "Page path is too long." };
  return { value: { category, title, description, page_path: pagePath || null } };
}

async function attachSignedUrls(reports) {
  return Promise.all(reports.map(async (report) => ({
    ...report,
    attachments: await Promise.all((Array.isArray(report.attachments) ? report.attachments : []).map(async (item) => {
      const { data } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(item.storage_path, 3600);
      return { ...item, url: data?.signedUrl || null };
    })),
  })));
}

exports.submitIssue = async (req, res) => {
  const uploadedPaths = [];
  let reportId = null;
  try {
    const validation = validateSubmission(req.body || {});
    if (validation.code) return error(res, 400, validation.code, validation.message);
    const { data, error: dbError } = await supabase.from("system_issue_reports").insert({ ...validation.value, reporter_user_id: req.user.id, status: "OPEN" }).select("*").single();
    if (dbError) throw dbError;
    reportId = data.id;
    const rows = [];
    for (const file of req.files || []) {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const storagePath = `${req.user.id}/${data.id}/${crypto.randomUUID()}${extension}`;
      const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
      if (uploadError) throw uploadError;
      uploadedPaths.push(storagePath);
      rows.push({ id: crypto.randomUUID(), storage_path: storagePath, file_name: file.originalname, mime_type: file.mimetype, file_size: file.size, created_at: new Date().toISOString() });
    }
    if (rows.length) {
      const { data: updated, error: attachmentError } = await supabase.from("system_issue_reports").update({ attachments: rows }).eq("id", data.id).select("*").single();
      if (attachmentError) throw attachmentError;
      Object.assign(data, updated);
    }
    const [result] = await attachSignedUrls([data]);
    return res.status(201).json({ status: "success", data: result });
  } catch (err) {
    if (uploadedPaths.length) await supabase.storage.from(ATTACHMENT_BUCKET).remove(uploadedPaths);
    if (reportId) await supabase.from("system_issue_reports").delete().eq("id", reportId);
    console.error("submitIssue:", err); return error(res, 500, "INTERNAL_ERROR", "Could not submit issue report.");
  }
};

exports.getMyIssues = async (req, res) => {
  try {
    const { data, error: dbError } = await supabase.from("system_issue_reports").select("id, category, title, description, page_path, attachments, status, admin_note, resolved_at, created_at, updated_at").eq("reporter_user_id", req.user.id).order("created_at", { ascending: false });
    if (dbError) throw dbError;
    return res.json({ status: "success", data: await attachSignedUrls(data || []) });
  } catch (err) { console.error("getMyIssues:", err); return error(res, 500, "INTERNAL_ERROR", "Could not load issue reports."); }
};

exports.getMyIssue = async (req, res) => {
  try {
    const { data, error: dbError } = await supabase
      .from("system_issue_reports")
      .select("id, category, title, description, page_path, attachments, status, admin_note, resolved_at, created_at, updated_at")
      .eq("id", req.params.issueId)
      .eq("reporter_user_id", req.user.id)
      .maybeSingle();
    if (dbError) throw dbError;
    if (!data) return error(res, 404, "ISSUE_REPORT_NOT_FOUND", "Issue report not found.");
    const [result] = await attachSignedUrls([data]);
    return res.json({ status: "success", data: result });
  } catch (err) {
    console.error("getMyIssue:", err);
    return error(res, 500, "INTERNAL_ERROR", "Could not load issue report.");
  }
};

exports.getAdminIssues = async (req, res) => {
  try {
    const status = String(req.query.status || "").toUpperCase(); const category = String(req.query.category || "").toUpperCase(); const search = clean(req.query.search);
    let query = supabase.from("system_issue_reports").select(`id, category, title, description, attachments, status, created_at, updated_at, ${reporterSelect}`).order("created_at", { ascending: false });
    if (STATUSES.includes(status)) query = query.eq("status", status); if (CATEGORIES.includes(category)) query = query.eq("category", category);
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    const { data, error: dbError } = await query; if (dbError) throw dbError;
    return res.json({ status: "success", data: await attachSignedUrls(data || []) });
  } catch (err) { console.error("getAdminIssues:", err); return error(res, 500, "INTERNAL_ERROR", "Could not load issue reports."); }
};

exports.getAdminIssue = async (req, res) => {
  try { const { data, error: dbError } = await supabase.from("system_issue_reports").select(`*, ${reporterSelect}, handler:profiles!system_issue_reports_handled_by_admin_id_fkey(id, email, username, full_name)`).eq("id", req.params.issueId).maybeSingle(); if (dbError) throw dbError; if (!data) return error(res, 404, "ISSUE_REPORT_NOT_FOUND", "Issue report not found."); const [result] = await attachSignedUrls([data]); return res.json({ status: "success", data: result }); }
  catch (err) { console.error("getAdminIssue:", err); return error(res, 500, "INTERNAL_ERROR", "Could not load issue report."); }
};

exports.updateAdminIssue = async (req, res) => {
  try {
    const { data: oldData, error: fetchError } = await supabase.from("system_issue_reports").select("*").eq("id", req.params.issueId).maybeSingle(); if (fetchError) throw fetchError; if (!oldData) return error(res, 404, "ISSUE_REPORT_NOT_FOUND", "Issue report not found.");
    const payload = {}; const body = req.body || {};
    if (body.status !== undefined) { const status = String(body.status).toUpperCase(); if (!STATUSES.includes(status)) return error(res, 400, "INVALID_ISSUE_STATUS", "Unsupported issue status."); payload.status = status; payload.resolved_at = status === "RESOLVED" ? new Date().toISOString() : ["OPEN", "IN_PROGRESS"].includes(status) ? null : oldData.resolved_at; }
    if (body.adminNote !== undefined) { const note = clean(body.adminNote); if (note.length > 5000) return error(res, 400, "VALIDATION_ERROR", "Admin note is too long."); payload.admin_note = note || null; }
    if (!Object.keys(payload).length) return error(res, 400, "VALIDATION_ERROR", "No valid fields were provided.");
    payload.handled_by_admin_id = req.user.id; payload.updated_at = new Date().toISOString();
    const { data, error: updateError } = await supabase.from("system_issue_reports").update(payload).eq("id", oldData.id).select("*").single(); if (updateError) throw updateError;
    await createActivityLog({ actorUserId: req.user.id, adminId: req.user.id, actionType: "ADMIN_UPDATE_ISSUE_REPORT", entityType: "system_issue_reports", entityId: oldData.id, oldData, newData: data, request: req, riskLevel: "INFO", details: `System Admin updated issue report "${oldData.title}".` });
    return res.json({ status: "success", data });
  } catch (err) { console.error("updateAdminIssue:", err); return error(res, 500, "INTERNAL_ERROR", "Could not update issue report."); }
};
