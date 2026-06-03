const crypto = require("crypto");
const path = require("path");
const supabase = require("../config/supabase");


const BUCKET = process.env.SUPABASE_DOCUMENT_BUCKET || "documents";

function sanitizeFileName(fileName) {
    const baseName = path.basename(fileName || "upload.bin");
    
    return baseName
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 160);

}

exports.listMyDocuments = async (req, res) => {
    try{
        const userID = req.user.id;

        const { data, error } = await supabase
            .from("documents")
            .select(` id, uploader_id, workspace_id, title, file_size_bytes, is_public, status, created_at `)
            .eq("uploader_id", userID)
            .is("deleted_at", null)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }
        
        return res.status(200).json({
            status: "success",
            data: data || [],
        });
    } catch (error) {
        console.error(" Lỗi listMyDocuments: ", error);
        
        return res.status(500).json({
            status: "error",
            message: "không thể tải danh sách tài liệu.",
            error: error.message,
        });
    }
};

exports.uploadDocuments = async (req, res) => {
    try{
        const userID = req.user.id;
        const files = req.files || [];

        if (files.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "Vui lòng chọn ít nhất một tệp để upload.",
            });
        }

        const uploadDocuments = [];

        for (const file of files) {
            const safeFileName = sanitizeFileName(file.originalname);
            const storagePath = `${userID}/${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;

            const { error: uploadError } = await supabase.storage
                .from(BUCKET)
                .upload(storagePath, file.buffer, {
                    contentType: file.mimetype || "application/octet-stream",
                    upsert: false,
                });
            if (uploadError) {
                throw uploadError;
        }

        const { data: document, error: insertError} = await supabase
            .from("documents")
            .insert({
                uploader_id: userID,
                workspace_id: null,
                title: file.originalname,
                file_url: storagePath,
                file_size_bytes: file.size,
                is_public: false
            })
            .select(` id, uploader_id, workspace_id, title, file_size_bytes, is_public, status, created_at`)
            .single();

        if (insertError) {
            await supabase.storage.from(BUCKET).remove([storagePath]);
            throw insertError;
        }


        uploadedDocuments.push(document); 
    }

    return res.status(201).json({
        status: "success",
        message: "Upload thành công.",
        data: uploadDocuments,
    });
} catch (error) {
    console.error(" lỗi uploadDocument: ", error);

    return res.status(500).json({
        status: "error",
        message: "không thể upload tài liệu.",
        error: error.message,
    });
}
} ;

exports.downloadDocument = async (req, res) => {
    try {
        const userID = req.user.id;
        const { documentId } = req.params;

        const {data: document, error: documentError} = await supabase
            .from("documents")
            .select("*")
            .eq("id", documentId)
            .is("deleted_at", null)
            .maybeSingle();

        if (documentError) {
            throw documentError;
        }

        if (!document) {
            return res.status(404).json({
                status: "error",
                message: "Không tìm thấy tài liệu.",
            }); 
        }

        const isOwner = String(document.uploader_id) === String(userID);

        if (!isOwner && document.is_public !== true){
            return res.status(403).json({
                status: "error",
                message: "Bạn không có quyền truy cập tài liệu này.",
            });
        }
        
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(document.file_url, 60,{
                download: document.title,
            });

        if (signedUrlError) {
            throw signedUrlError;
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
        console.error(" lỗi downloadDocument: ", error);

        return res.status(500).json({
            status: "error",
            message: "Không thể tải tài liệu.",
            error: error.message,
        });
    }
};