const supabase = require("../config/supabase");

const BUCKET = process.env.SUPABASE_DOCUMENT_BUCKET || "documents";

function mapDocument(document) {
  return {
    id: document.id,
    library_id: document.library_id,
    title: document.title,
    file_size_bytes: document.file_size_bytes,
    status: document.status,
    created_at: document.created_at,
  };
}

exports.listPublicLibraries = async (req, res) => {
  try {
    const { data: libraries, error: libraryError } = await supabase
      .from("libraries")
      .select("id, user_id, name, description, is_public, share_on_profile, created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (libraryError) throw libraryError;

    const libraryIds = (libraries || []).map((library) => library.id);
    const ownerIds = [
      ...new Set((libraries || []).map((library) => library.user_id).filter(Boolean)),
    ];
    let documentCounts = new Map();
    let ownersById = new Map();

    let starCounts = new Map();
    let downloadCounts = new Map();

    if (libraryIds.length > 0) {
      const { data: documents, error: documentError } = await supabase
        .from("documents")
        .select("library_id")
        .in("library_id", libraryIds)
        .eq("is_public", true)
        .eq("status", "APPROVED")
        .is("deleted_at", null);

      if (documentError) throw documentError;

      documentCounts = (documents || []).reduce((counts, document) => {
        const key = String(document.library_id);
        counts.set(key, (counts.get(key) || 0) + 1);
        return counts;
      }, new Map());

      const { data: starsData } = await supabase
        .from("library_stars")
        .select("library_id")
        .in("library_id", libraryIds);

      starCounts = (starsData || []).reduce((counts, row) => {
        const key = String(row.library_id);
        counts.set(key, (counts.get(key) || 0) + 1);
        return counts;
      }, new Map());

      const { data: downloadsData } = await supabase
        .from("library_downloads")
        .select("library_id")
        .in("library_id", libraryIds);

      downloadCounts = (downloadsData || []).reduce((counts, row) => {
        const key = String(row.library_id);
        counts.set(key, (counts.get(key) || 0) + 1);
        return counts;
      }, new Map());
    }

    if (ownerIds.length > 0) {
      const { data: owners, error: ownerError } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", ownerIds)
        .eq("status", "ACTIVE");

      if (ownerError) throw ownerError;

      ownersById = (owners || []).reduce((ownersMap, owner) => {
        ownersMap.set(String(owner.id), owner);
        return ownersMap;
      }, new Map());
    }

    return res.status(200).json({
      status: "success",
      data: (libraries || []).map((library) => ({
        ...library,
        documents: documentCounts.get(String(library.id)) || 0,
        stars: starCounts.get(String(library.id)) || 0,
        downloads: downloadCounts.get(String(library.id)) || 0,
        owner: ownersById.get(String(library.user_id)) || null,
        visibility: "public",
      })),
    });
  } catch (error) {
    console.error("Public library list error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load public libraries.",
      error: error.message,
    });
  }
};

exports.getPublicLibrary = async (req, res) => {
  try {
    const { libraryId } = req.params;

    const { data: library, error: libraryError } = await supabase
      .from("libraries")
      .select("id, user_id, name, description, is_public, share_on_profile, created_at")
      .eq("id", libraryId)
      .eq("is_public", true)
      .maybeSingle();

    if (libraryError) throw libraryError;

    if (!library) {
      return res.status(404).json({
        status: "error",
        message: "Public library not found.",
      });
    }

    const { data: documents, error: documentError } = await supabase
      .from("documents")
      .select("id, library_id, title, file_size_bytes, status, created_at")
      .eq("library_id", libraryId)
      .eq("is_public", true)
      .eq("status", "APPROVED")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (documentError) throw documentError;

    const { count: starsCount } = await supabase
      .from("library_stars")
      .select("*", { count: "exact", head: true })
      .eq("library_id", libraryId);

    const { count: downloadsCount } = await supabase
      .from("library_downloads")
      .select("*", { count: "exact", head: true })
      .eq("library_id", libraryId);

    return res.status(200).json({
      status: "success",
      data: {
        library: {
          ...library,
          documents: documents?.length || 0,
          stars: starsCount || 0,
          downloads: downloadsCount || 0,
          visibility: "public",
        },
        documents: (documents || []).map(mapDocument),
      },
    });
  } catch (error) {
    console.error("Public library detail error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load public library.",
      error: error.message,
    });
  }
};

exports.downloadPublicDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, library_id, title, file_url, is_public, status, deleted_at")
      .eq("id", documentId)
      .eq("is_public", true)
      .eq("status", "APPROVED")
      .is("deleted_at", null)
      .maybeSingle();

    if (documentError) throw documentError;

    if (!document || !document.library_id) {
      return res.status(404).json({
        status: "error",
        message: "Public document not found.",
      });
    }

    const { data: library, error: libraryError } = await supabase
      .from("libraries")
      .select("id")
      .eq("id", document.library_id)
      .eq("is_public", true)
      .maybeSingle();

    if (libraryError) throw libraryError;

    if (!library) {
      return res.status(404).json({
        status: "error",
        message: "Public document not found.",
      });
    }

    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage.from(BUCKET).createSignedUrl(document.file_url, 60, {
        download: document.title,
      });

    if (signedUrlError) throw signedUrlError;

    if (document.library_id) {
      try {
        await supabase.from("library_downloads").insert({
          library_id: document.library_id,
          user_id: null,
        });
      } catch (dlErr) {
        console.warn("Could not log public library download:", dlErr);
      }
    }

    return res.status(200).json({
      status: "success",
      data: {
        documentId: document.id,
        fileName: document.title,
        downloadUrl: signedUrlData.signedUrl,
      },
    });
  } catch (error) {
    console.error("Public document download error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not download public document.",
      error: error.message,
    });
  }
};
