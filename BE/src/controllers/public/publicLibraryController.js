const supabase = require("../../config/supabase");

function mapDocument(document) {
  return {
    id: document.id,
    library_id: document.library_id,
    title: document.title,
    file_size_bytes: document.file_size_bytes,
    status: document.status,
    tagging_status: document.tagging_status || "COMPLETED",
    tagging_error: document.tagging_error || null,
    tags: document.tags || null,
    created_at: document.created_at,
    ai_ready: true,
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

    let { data: documents, error: documentError } = await supabase
      .from("documents")
      .select("id, library_id, title, file_size_bytes, status, tagging_status, tagging_error, created_at")
      .eq("library_id", libraryId)
      .eq("status", "APPROVED")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (documentError && (documentError.code === "42703" || String(documentError.message || "").includes("tagging_status"))) {
      const fallbackDocs = await supabase
        .from("documents")
        .select("id, library_id, title, file_size_bytes, status, created_at")
        .eq("library_id", libraryId)
        .eq("status", "APPROVED")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      documents = (fallbackDocs.data || []).map((doc) => ({
        ...doc,
        tagging_status: "COMPLETED",
        tagging_error: null,
      }));
      documentError = fallbackDocs.error;
    }

    const { data: owner, error: ownerError } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("id", library.user_id)
      .maybeSingle();

    if (documentError) throw documentError;
    if (ownerError) throw ownerError;

    // Fetch 3-level document tags for public documents
    const tagsByDocumentId = new Map();
    const docIds = (documents || []).map((doc) => doc.id).filter(Boolean);
    if (docIds.length > 0) {
      const { data: documentTagRows } = await supabase
        .from("document_tags")
        .select(`
          document_id,
          l1:tags!document_tags_level_1_tag_id_fkey(name),
          l2:tags!document_tags_level_2_tag_id_fkey(name),
          l3:tags!document_tags_level_3_tag_id_fkey(name)
        `)
        .in("document_id", docIds);

      (documentTagRows || []).forEach((row) => {
        tagsByDocumentId.set(String(row.document_id), {
          level1: row.l1?.name || null,
          level2: row.l2?.name || null,
          level3: row.l3?.name || null,
        });
      });
    }

    const mappedDocuments = (documents || []).map((doc) =>
      mapDocument({
        ...doc,
        tags: tagsByDocumentId.get(String(doc.id)) || null,
      }),
    );

    return res.status(200).json({
      status: "success",
      data: {
        library: {
          ...library,
          owner: owner || null,
          documents: mappedDocuments.length,
          visibility: "public",
        },
        documents: mappedDocuments,
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
