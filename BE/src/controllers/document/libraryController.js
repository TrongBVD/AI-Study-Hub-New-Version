const supabase = require("../../config/supabase");
const { MAX_LIBRARIES_PER_USER } = require("./documentHelpers");

exports.createLibrary = async (req, res) => {
  try {
    const { name, description, is_public, share_on_profile } = req.body;
    const userID = req.user.id;

    if (!userID) {
      return res.status(401).json({
        status: "error",
        message: "Authenticated user id is missing.",
      });
    }

    if (userID === "guest" || userID === "00000000-0000-0000-0000-000000000000" || req.user?.role === "GUEST") {
      return res.status(403).json({
        status: "error",
        message: "Guest users cannot create libraries.",
      });
    }

    if (!name || name.trim() === "") {
      return res.status(400).json({
        status: "error",
        message: "Library name is required.",
      });
    }

    const { count: libraryCount, error: countError } = await supabase
      .from("libraries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userID);

    if (countError) throw countError;

    if ((libraryCount || 0) >= MAX_LIBRARIES_PER_USER) {
      return res.status(409).json({
        status: "error",
        code: "LIBRARY_LIMIT_REACHED",
        message: `You can create up to ${MAX_LIBRARIES_PER_USER} libraries. Delete an existing library before creating another one.`,
      });
    }

    const { data: existingLib, error: searchError } = await supabase
      .from("libraries")
      .select("id")
      .eq("user_id", userID)
      .ilike("name", name.trim())
      .maybeSingle();

    if (searchError) throw searchError;

    if (existingLib) {
      return res.status(400).json({
        status: "error",
        message: `You already have another library named "${name.trim()}". Please choose a different name!`,
      });
    }

    const { data, error } = await supabase
      .from("libraries")
      .insert({
        user_id: userID,
        name: name.trim(),
        description,
        is_public,
        share_on_profile
      })
      .select().single();

    if (error) throw error;
    return res.status(201).json({ status: "success", data });
  } catch (error) {
    console.error("Create library error:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

exports.updateLibrary = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_public, share_on_profile } = req.body;
    const userID = req.user.id;

    if (userID === "guest" || userID === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(403).json({
        status: "error",
        message: "Guest users cannot update libraries.",
      });
    }

    const { data: targetLib, error: getLibErr } = await supabase
      .from("libraries")
      .select("id, user_id, is_public")
      .eq("id", id)
      .maybeSingle();

    if (getLibErr || !targetLib) {
      return res.status(404).json({
        status: "error",
        message: "Library not found.",
      });
    }

    if (String(targetLib.user_id) !== String(userID)) {
      return res.status(403).json({
        status: "error",
        message: "You can only update your own library.",
      });
    }

    if (name && name.trim() !== "") {
      const { data: existingLib, error: searchError } = await supabase
        .from("libraries")
        .select("id")
        .eq("user_id", userID)
        .ilike("name", name.trim())
        .neq("id", id)
        .maybeSingle();

      if (searchError) throw searchError;

      if (existingLib) {
        return res.status(400).json({
          status: "error",
          message: `The library name "${name.trim()}" is already used by another library of yours.`,
        });
      }
    }

    const { data, error } = await supabase
      .from("libraries")
      .update({
        name: name ? name.trim() : undefined,
        description,
        is_public,
        share_on_profile
      })
      .eq("id", id)
      .eq("user_id", userID)
      .select().single();

    if (error) throw error;

    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

exports.listMyLibraries = async (req, res) => {
  try {
    const userID = req.user.id;

    if (!userID) {
      return res.status(401).json({
        status: "error",
        message: "Authenticated user id is missing.",
      });
    }

    if (userID === "guest" || userID === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    const { data: libraries, error } = await supabase
      .from("libraries")
      .select("*")
      .eq("user_id", userID)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const libraryIds = (libraries || []).map(lib => lib.id);
    const docCountsMap = {};
    const docSizesMap = {};

    if (libraryIds.length > 0) {
      const { data: docs, error: docsError } = await supabase
        .from("documents")
        .select("library_id, file_size_bytes")
        .in("library_id", libraryIds)
        .is("deleted_at", null);

      if (!docsError && docs) {
        docs.forEach(doc => {
          if (doc.library_id) {
            docCountsMap[doc.library_id] = (docCountsMap[doc.library_id] || 0) + 1;
            docSizesMap[doc.library_id] = (docSizesMap[doc.library_id] || 0) + (Number(doc.file_size_bytes) || 0);
          }
        });
      }
    }

    const mapped = (libraries || []).map(lib => ({
      ...lib,
      documents: docCountsMap[lib.id] || 0,
      total_size_bytes: docSizesMap[lib.id] || 0,
    }));

    return res.status(200).json({
      status: "success",
      data: mapped,
    });
  } catch (error) {
    console.error("listMyLibraries error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load personal libraries.",
      error: error.message,
    });
  }
};

exports.getLibrary = async (req, res) => {
  try {
    const { libraryId } = req.params;
    const userID = req.user.id;

    if (!userID) {
      return res.status(401).json({
        status: "error",
        message: "Authenticated user id is missing.",
      });
    }

    const { data, error } = await supabase
      .from("libraries")
      .select("*")
      .eq("id", libraryId)
      .eq("user_id", userID)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        status: "error",
        message: "Library not found.",
      });
    }

    const [{ count: docCount, error: docCountError }, { count: starCount, error: starCountError }, { count: downloadCount, error: downloadCountError }, { data: myStar, error: myStarError }] =
      await Promise.all([
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("library_id", libraryId).is("deleted_at", null),
        supabase.from("library_stars").select("library_id", { count: "exact", head: true }).eq("library_id", libraryId),
        supabase.from("library_downloads").select("id", { count: "exact", head: true }).eq("library_id", libraryId),
        supabase.from("library_stars").select("library_id").eq("library_id", libraryId).eq("user_id", userID).maybeSingle(),
      ]);

    if (docCountError) throw docCountError;
    if (starCountError) throw starCountError;
    if (downloadCountError) throw downloadCountError;
    if (myStarError) throw myStarError;

    const mapped = {
      ...data,
      documents: docCount || 0,
      stars: starCount || 0,
      downloads: downloadCount || 0,
      isStarred: Boolean(myStar),
    };

    return res.status(200).json({
      status: "success",
      data: mapped,
    });
  } catch (error) {
    console.error("getLibrary error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load library details.",
      error: error.message,
    });
  }
};

exports.toggleLibraryStar = async (req, res) => {
  try {
    const { libraryId } = req.params;
    const userID = req.user.id;
    const { data: library, error: libraryError } = await supabase
      .from("libraries")
      .select("id, is_public")
      .eq("id", libraryId)
      .maybeSingle();

    if (libraryError) throw libraryError;
    if (!library || !library.is_public) {
      return res.status(404).json({ status: "error", message: "Public library not found." });
    }

    const { data: existing, error: existingError } = await supabase
      .from("library_stars")
      .select("library_id")
      .eq("library_id", libraryId)
      .eq("user_id", userID)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      const { error } = await supabase
        .from("library_stars")
        .delete()
        .eq("library_id", libraryId)
        .eq("user_id", userID);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("library_stars")
        .insert({ library_id: libraryId, user_id: userID });
      if (error) throw error;
    }

    const { count, error: countError } = await supabase
      .from("library_stars")
      .select("library_id", { count: "exact", head: true })
      .eq("library_id", libraryId);

    if (countError) throw countError;
    return res.status(200).json({
      status: "success",
      data: { libraryId, isStarred: !existing, stars: count || 0 },
    });
  } catch (error) {
    console.error("Toggle library star error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not update library star.",
      error: error.message,
    });
  }
};

exports.getLibraryEngagement = async (req, res) => {
  try {
    const { libraryId } = req.params;
    const userID = req.user.id;
    const { data: library, error: libraryError } = await supabase
      .from("libraries")
      .select("id, is_public, user_id")
      .eq("id", libraryId)
      .maybeSingle();

    if (libraryError) throw libraryError;
    if (!library || (!library.is_public && String(library.user_id) !== String(userID))) {
      return res.status(404).json({ status: "error", message: "Library not found." });
    }

    const [{ count: stars, error: starsError }, { count: downloads, error: downloadsError }, { data: myStar, error: myStarError }] =
      await Promise.all([
        supabase.from("library_stars").select("library_id", { count: "exact", head: true }).eq("library_id", libraryId),
        supabase.from("library_downloads").select("id", { count: "exact", head: true }).eq("library_id", libraryId),
        supabase.from("library_stars").select("library_id").eq("library_id", libraryId).eq("user_id", userID).maybeSingle(),
      ]);

    if (starsError) throw starsError;
    if (downloadsError) throw downloadsError;
    if (myStarError) throw myStarError;

    return res.status(200).json({
      status: "success",
      data: {
        libraryId,
        stars: stars || 0,
        downloads: downloads || 0,
        isStarred: Boolean(myStar),
      },
    });
  } catch (error) {
    console.error("Get library engagement error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load library engagement.",
      error: error.message,
    });
  }
};

exports.deleteLibrary = async (req, res) => {
  try {
    const { id } = req.params;
    const userID = req.user.id;

    if (!userID) {
      return res.status(401).json({
        status: "error",
        message: "Authenticated user id is missing.",
      });
    }

    if (userID === "guest" || userID === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(403).json({
        status: "error",
        message: "Guest users cannot delete libraries.",
      });
    }

    const { data: targetLib, error: findLibErr } = await supabase
      .from("libraries")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (findLibErr) throw findLibErr;

    if (!targetLib) {
      return res.status(404).json({
        status: "error",
        message: "Library not found.",
      });
    }

    if (String(targetLib.user_id) !== String(userID)) {
      return res.status(403).json({
        status: "error",
        message: "You can only delete your own library.",
      });
    }

    let rpcSuccess = false;
    try {
      const { error: rpcError } = await supabase.rpc("delete_owned_library", {
        p_library_id: id,
        p_user_id: userID,
      });

      if (rpcError) {
        if (String(rpcError.message).includes("LIBRARY_NOT_FOUND")) {
          return res.status(404).json({
            status: "error",
            message: "Library not found.",
          });
        }
        if (String(rpcError.message).includes("LIBRARY_OWNER_REQUIRED")) {
          return res.status(403).json({
            status: "error",
            message: "You can only delete your own library.",
          });
        }
        if (
          !String(rpcError.message).includes("schema cache") &&
          !String(rpcError.message).includes("Could not find the function")
        ) {
          console.warn("RPC delete_owned_library failed, falling back to direct queries:", rpcError.message);
        }
      } else {
        rpcSuccess = true;
      }
    } catch (rpcErr) {
      if (
        !String(rpcErr?.message).includes("schema cache") &&
        !String(rpcErr?.message).includes("Could not find the function")
      ) {
        console.warn("RPC delete_owned_library threw exception, falling back to direct queries:", rpcErr.message);
      }
    }

    if (!rpcSuccess) {
      await supabase.from("library_stars").delete().eq("library_id", id);
      await supabase.from("library_downloads").delete().eq("library_id", id);
      await supabase
        .from("documents")
        .update({ library_id: null, is_public: false })
        .eq("library_id", id);

      const { error: deleteLibError } = await supabase
        .from("libraries")
        .delete()
        .eq("id", id)
        .eq("user_id", userID);

      if (deleteLibError) throw deleteLibError;
    }

    return res.status(200).json({
      status: "success",
      message: "Library deleted successfully.",
    });
  } catch (error) {
    console.error("deleteLibrary error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not delete library.",
      error: error.message,
    });
  }
};

exports.toggleStarLibrary = async (req, res) => {
  try {
    const { libraryId } = req.params;
    const userID = req.user.id;

    if (userID === "guest" || userID === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(403).json({
        status: "error",
        message: "Guest accounts cannot star libraries.",
      });
    }

    const { data: existing } = await supabase
      .from("library_stars")
      .select("library_id")
      .eq("library_id", libraryId)
      .eq("user_id", userID)
      .maybeSingle();

    let isStarred = false;

    if (existing) {
      await supabase
        .from("library_stars")
        .delete()
        .eq("library_id", libraryId)
        .eq("user_id", userID);
      isStarred = false;
    } else {
      await supabase
        .from("library_stars")
        .insert({ library_id: libraryId, user_id: userID });
      isStarred = true;
    }

    const { count } = await supabase
      .from("library_stars")
      .select("*", { count: "exact", head: true })
      .eq("library_id", libraryId);

    return res.status(200).json({
      status: "success",
      data: {
        libraryId,
        isStarred,
        stars: count || 0,
      },
    });
  } catch (error) {
    console.error("toggleStarLibrary error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not update library star status.",
      error: error.message,
    });
  }
};
