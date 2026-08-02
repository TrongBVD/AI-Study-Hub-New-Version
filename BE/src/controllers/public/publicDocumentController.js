const supabase = require("../../config/supabase");
const BUCKET = process.env.SUPABASE_DOCUMENT_BUCKET || "documents";

exports.viewPublicDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, library_id, title, file_url, file_size_bytes, is_public, status, deleted_at")
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
      await supabase.storage.from(BUCKET).createSignedUrl(document.file_url, 60 * 60);

    if (signedUrlError) throw signedUrlError;

    return res.status(200).json({
      status: "success",
      data: {
        documentId: document.id,
        fileName: document.title,
        fileSizeBytes: document.file_size_bytes,
        status: document.status,
        viewUrl: signedUrlData.signedUrl,
        expiresIn: 60 * 60,
      },
    });
  } catch (error) {
    console.error("Public document view error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not view public document.",
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
