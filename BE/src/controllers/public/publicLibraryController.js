const supabase = require("../../config/supabase");

const downloadDeduplicationCache = new Map();

async function getLibraryEngagement(libraryIds) {
  const ids = (libraryIds || []).filter(Boolean);
  const downloadsByLibrary = new Map();

  if (ids.length === 0) return { downloadsByLibrary };

  const { data: downloads, error: downloadsError } =
    await supabase.from("library_downloads").select("library_id").in("library_id", ids);

  if (downloadsError) throw downloadsError;

  (downloads || []).forEach(({ library_id }) => {
    const key = String(library_id);
    downloadsByLibrary.set(key, (downloadsByLibrary.get(key) || 0) + 1);
  });

  return { downloadsByLibrary };
}

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

const { getLevel1Tags } = require("../../services/tagService");

exports.listPublicTags = async (req, res) => {
  try {
    const tags = await getLevel1Tags();
    return res.status(200).json({
      status: "success",
      data: tags,
    });
  } catch (error) {
    console.error("listPublicTags error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load tags.",
    });
  }
};

exports.listPublicLibraries = async (req, res) => {
  try {
    const searchTag = String(req.query.tag || req.query.tagQuery || "").trim();

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
    let matchingFileCounts = new Map();
    let ownersById = new Map();
    const { downloadsByLibrary } =
      await getLibraryEngagement(libraryIds);

    let downloadCounts = new Map();

    if (libraryIds.length > 0) {
      const { data: documents, error: documentError } = await supabase
        .from("documents")
        .select("id, library_id")
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

      // If searchTag is specified, calculate matching file count per library
      if (searchTag && documents && documents.length > 0) {
        const docIds = documents.map((d) => d.id);
        const { data: matchedTags } = await supabase
          .from("tags")
          .select("id")
          .ilike("name", `%${searchTag}%`);

        const matchedTagIds = (matchedTags || []).map((t) => t.id);

        if (matchedTagIds.length > 0) {
          const { data: matchedDocTags } = await supabase
            .from("document_tags")
            .select("document_id")
            .in("document_id", docIds)
            .or(
              `level_1_tag_id.in.(${matchedTagIds.join(",")}),level_2_tag_id.in.(${matchedTagIds.join(",")}),level_3_tag_id.in.(${matchedTagIds.join(",")})`
            );

          const matchedDocIdSet = new Set((matchedDocTags || []).map((d) => String(d.document_id)));

          documents.forEach((doc) => {
            if (matchedDocIdSet.has(String(doc.id))) {
              const key = String(doc.library_id);
              matchingFileCounts.set(key, (matchingFileCounts.get(key) || 0) + 1);
            }
          });
        }
      }

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

    let mappedLibraries = (libraries || []).map((library) => {
      const key = String(library.id);
      const matchCount = matchingFileCounts.get(key) || 0;
      return {
        ...library,
        documents: documentCounts.get(key) || 0,
        matchingFileCount: matchCount,
        downloads: downloadsByLibrary.get(key) || downloadCounts.get(key) || 0,
        owner: ownersById.get(String(library.user_id)) || null,
        visibility: "public",
      };
    });

    if (searchTag) {
      // Filter libraries that have matching files, or if name/desc matches tag
      mappedLibraries = mappedLibraries.filter(
        (lib) =>
          lib.matchingFileCount > 0 ||
          String(lib.name || "").toLowerCase().includes(searchTag.toLowerCase()) ||
          String(lib.description || "").toLowerCase().includes(searchTag.toLowerCase())
      );

      // Sort libraries by matchingFileCount DESC, then created_at DESC
      mappedLibraries.sort((a, b) => b.matchingFileCount - a.matchingFileCount || new Date(b.created_at) - new Date(a.created_at));
    }

    return res.status(200).json({
      status: "success",
      data: mappedLibraries,
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

    const [
      { data: documents, error: documentError },
      { data: owner, error: ownerError },
    ] = await Promise.all([
      supabase
        .from("documents")
        .select("id, library_id, title, file_size_bytes, status, created_at")
        .eq("library_id", libraryId)
        .eq("is_public", true)
        .eq("status", "APPROVED")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("id", library.user_id)
        .maybeSingle(),
    ]);

    if (documentError) throw documentError;
    const { downloadsByLibrary } =
      await getLibraryEngagement([library.id]);
    if (ownerError) throw ownerError;

    const { count: downloadsCount } = await supabase
      .from("library_downloads")
      .select("*", { count: "exact", head: true })
      .eq("library_id", libraryId);

    return res.status(200).json({
      status: "success",
      data: {
        library: {
          ...library,
          owner: owner || null,
          documents: documents?.length || 0,
          downloads: downloadsCount || 0,
          visibility: "public",
          downloads: downloadsByLibrary.get(String(library.id)) || 0,
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

exports.recordPublicLibraryDownload = async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { data: library, error: libraryError } = await supabase
      .from("libraries")
      .select("id")
      .eq("id", libraryId)
      .eq("is_public", true)
      .maybeSingle();

    if (libraryError) throw libraryError;
    if (!library) {
      return res.status(404).json({ status: "error", message: "Public library not found." });
    }

    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anonymous";
    const dedupKey = `${clientIp}:${libraryId}`;
    const nowMs = Date.now();
    const lastMs = downloadDeduplicationCache.get(dedupKey) || 0;

    if (nowMs - lastMs > 60000) {
      downloadDeduplicationCache.set(dedupKey, nowMs);
      await supabase
        .from("library_downloads")
        .insert({ library_id: libraryId });
    }

    const { count, error: countError } = await supabase
      .from("library_downloads")
      .select("id", { count: "exact", head: true })
      .eq("library_id", libraryId);

    if (countError) throw countError;
    return res.status(201).json({
      status: "success",
      data: { libraryId, downloads: count || 0 },
    });
  } catch (error) {
    console.error("Record public library download error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not record library download.",
      error: error.message,
    });
  }
};

exports.getLibraryEngagement = getLibraryEngagement;
