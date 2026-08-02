const crypto = require("crypto");
const supabase = require("../../config/supabase");
const { createActivityLog } = require("../../services/activityLogService");
const {
  getPagination,
  paginationPayload,
} = require("./adminHelpers");

exports.getUsers = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const { page, pageSize, from, to } = getPagination(req.query);
    const status = String(req.query.status || "").toUpperCase();
    const role = String(req.query.role || "").toUpperCase();
    const sortBy = String(req.query.sortBy || "last-active");
    const sortColumn =
      sortBy === "name"
        ? "full_name"
        : sortBy === "created"
          ? "created_at"
          : "last_login_at";

    let query = supabase
      .from("profiles")
      .select(`
        id,
        email,
        username,
        full_name,
        role,
        status,
        created_at,
        updated_at,
        last_login_at
      `, { count: "exact" })
      .order(sortColumn, { ascending: sortBy === "name", nullsFirst: false })
      .range(from, to);

    if (search) {
      query = query.or(
        `username.ilike.%${search}%,email.ilike.%${search}%,full_name.ilike.%${search}%`,
      );
    }
    if (["ACTIVE", "DISABLED"].includes(status)) query = query.eq("status", status);
    if (role) query = query.eq("role", role);

    const { data, error, count } = await query;

    if (error) throw error;

    const userIds = (data || []).map((user) => user.id);

    const [
      { data: workspaceRows, error: workspaceError },
      { data: libraryRows, error: libraryError },
      { data: documentRows, error: documentStorageError },
    ] = await Promise.all([
      userIds.length
        ? supabase
            .from("workspace_members")
            .select("user_id")
            .in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? supabase
            .from("libraries")
            .select("user_id")
            .in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? supabase
            .from("documents")
            .select("uploader_id, file_size_bytes")
            .in("uploader_id", userIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (workspaceError) throw workspaceError;
    if (libraryError) throw libraryError;
    if (documentStorageError) throw documentStorageError;

    const workspaceCounts = new Map();
    (workspaceRows || []).forEach((row) => {
      workspaceCounts.set(
        row.user_id,
        (workspaceCounts.get(row.user_id) || 0) + 1,
      );
    });

    const libraryCounts = new Map();
    (libraryRows || []).forEach((row) => {
      libraryCounts.set(row.user_id, (libraryCounts.get(row.user_id) || 0) + 1);
    });

    const storageTotals = new Map();
    (documentRows || []).forEach((row) => {
      storageTotals.set(
        row.uploader_id,
        (storageTotals.get(row.uploader_id) || 0) +
          Number(row.file_size_bytes || 0),
      );
    });

    return res.status(200).json({
      status: "success",
      data: (data || []).map((user) => ({
        ...user,
        workspace_count: workspaceCounts.get(user.id) || 0,
        library_count: libraryCounts.get(user.id) || 0,
        storage_used_bytes: storageTotals.get(user.id) || 0,
        storage_quota_bytes: 50 * 1024 * 1024,
      })),
      pagination: paginationPayload(count, page, pageSize),
    });
  } catch (error) {
    console.error("Admin get users error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load users.",
      error: error.message,
    });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    if (!["ACTIVE", "DISABLED"].includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "status must be ACTIVE or DISABLED.",
      });
    }

    if (String(userId) === String(req.user.id) && status === "DISABLED") {
      return res.status(400).json({
        status: "error",
        message: "Admin cannot disable their own account.",
      });
    }

    const { data: oldUser, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email, username, full_name, role, status, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!oldUser) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    if (status === "DISABLED" && oldUser.role === "ADMIN") {
      const { count: activeAdminCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "ADMIN")
        .eq("status", "ACTIVE");

      if ((activeAdminCount || 0) <= 1) {
        return res.status(400).json({
          status: "error",
          message: "Cannot disable the last active System Admin.",
        });
      }
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("profiles")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("id, email, username, full_name, role, status, created_at, updated_at")
      .single();

    if (updateError) throw updateError;

    await createActivityLog({
      actorUserId: req.user.id,
      actionType: "ADMIN_UPDATE_USER_STATUS",
      entityType: "profiles",
      entityId: userId,
      oldData: oldUser,
      newData: {
        ...updatedUser,
        admin_reason: reason || null,
      },
      request: req,
      riskLevel: status === "DISABLED" ? "HIGH" : "MEDIUM",
      details: reason || `Account status changed to ${status}.`,
    });

    return res.status(200).json({
      status: "success",
      message: "User status updated.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Admin update user status error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not update user status.",
      error: error.message,
    });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const role = String(req.body.role || "").toUpperCase();
    const reason = String(req.body.reason || "").trim();

    if (!["USER", "SYSTEM_ADMIN"].includes(role)) {
      return res.status(400).json({
        status: "error",
        message: "role must be USER or SYSTEM_ADMIN.",
      });
    }

    if (String(userId) === String(req.user.id)) {
      return res.status(400).json({
        status: "error",
        message: "Administrators cannot change their own system role.",
      });
    }

    const { data: oldUser, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email, username, full_name, role, status, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!oldUser) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    if (oldUser.role === "SYSTEM_ADMIN" && role !== "SYSTEM_ADMIN") {
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "SYSTEM_ADMIN")
        .neq("status", "DISABLED");

      if (countError) throw countError;
      if ((count || 0) <= 1) {
        return res.status(400).json({
          status: "error",
          message: "The final active System Admin cannot be demoted.",
        });
      }
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("profiles")
      .update({
        role,
        session_id: crypto.randomUUID(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("id, email, username, full_name, role, status, created_at, updated_at, last_login_at")
      .single();

    if (updateError) throw updateError;

    await createActivityLog({
      actorUserId: req.user.id,
      actionType: "ADMIN_UPDATE_USER_ROLE",
      entityType: "profiles",
      entityId: userId,
      oldData: oldUser,
      newData: { ...updatedUser, admin_reason: reason || null },
      request: req,
      riskLevel: "HIGH",
      details: reason || `System role changed to ${role}.`,
    });

    return res.status(200).json({
      status: "success",
      message: "User role updated.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Admin update user role error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not update user role.",
      error: error.message,
    });
  }
};
