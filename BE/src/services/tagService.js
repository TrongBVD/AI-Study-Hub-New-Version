const supabase = require("../config/supabase");

const HARDCODED_LEVEL_1_TAGS = [
  "Literature",
  "Mathematics",
  "History",
  "Languages",
  "Geography",
  "Physics",
  "Chemistry",
  "Biology",
  "Information Technology",
  "Engineering & Technology: Engineering",
  "Architecture",
  "Economics",
  "Business Administration",
  "Finance & Banking",
  "Medicine",
  "Law",
  "Other",
];

/**
 * Normalizes tag strings for comparison and storage
 */
function normalizeTagName(str) {
  if (!str) return "";
  return String(str)
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ");
}

/**
 * Fetches all Level 1 hardcoded tags from the database.
 * Falls back to hardcoded array if DB is not seeded or encounters error.
 */
async function getLevel1Tags() {
  try {
    const { data, error } = await supabase
      .from("tags")
      .select("id, name, level")
      .eq("level", 1)
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      return HARDCODED_LEVEL_1_TAGS.map((name) => ({ name, level: 1 }));
    }

    return data;
  } catch (err) {
    console.warn("getLevel1Tags fallback to hardcoded list:", err.message);
    return HARDCODED_LEVEL_1_TAGS.map((name) => ({ name, level: 1 }));
  }
}

/**
 * Validates and matches Level 1 tag against hardcoded list.
 * Returns exact matched Level 1 string or "Other".
 */
function matchLevel1Tag(inputTag) {
  const normalized = normalizeTagName(inputTag).toLowerCase();
  if (!normalized) return "Other";

  const matched = HARDCODED_LEVEL_1_TAGS.find(
    (tag) => tag.toLowerCase() === normalized
  );

  if (matched) return matched;

  // Fuzzy match check (e.g. "Math" -> "Mathematics", "IT" -> "Information Technology")
  if (normalized.includes("math")) return "Mathematics";
  if (normalized.includes("info") || normalized === "it" || normalized.includes("software")) return "Information Technology";
  if (normalized.includes("econ")) return "Economics";
  if (normalized.includes("lit")) return "Literature";
  if (normalized.includes("phys")) return "Physics";
  if (normalized.includes("chem")) return "Chemistry";
  if (normalized.includes("bio")) return "Biology";
  if (normalized.includes("eng")) return "Engineering & Technology: Engineering";
  if (normalized.includes("med")) return "Medicine";
  if (normalized.includes("law")) return "Law";

  return "Other";
}

/**
 * Inserts or retrieves a tag record in DB.
 */
async function findOrCreateTag(name, level, parentId = null, options = {}) {
  const normName = normalizeTagName(name);
  if (!normName) return null;

  try {
    let query = supabase
      .from("tags")
      .select("id, name, level, parent_id")
      .eq("level", level)
      .ilike("name", normName);

    if (parentId) {
      query = query.eq("parent_id", parentId);
    } else {
      query = query.is("parent_id", null);
    }

    const { data: existingTag } = await query.maybeSingle();
    if (existingTag) return existingTag;

    const { data: newTag, error: insertError } = await supabase
      .from("tags")
      .insert({
        name: normName,
        level,
        parent_id: parentId,
      })
      .select("id, name, level, parent_id")
      .single();

    if (insertError) {
      // Re-query if concurrent insert happened
      let retryQuery = supabase
        .from("tags")
        .select("id, name, level, parent_id")
        .eq("level", level)
        .ilike("name", normName);

      retryQuery = parentId
        ? retryQuery.eq("parent_id", parentId)
        : retryQuery.is("parent_id", null);

      const { data: retryTag, error: retryError } =
        await retryQuery.maybeSingle();

      if (!retryTag && options.throwOnError) {
        throw insertError || retryError || new Error(`Could not persist tag "${normName}".`);
      }

      return retryTag || null;
    }

    return newTag;
  } catch (err) {
    console.error(`findOrCreateTag failed for level ${level} tag "${name}":`, err.message);
    if (options.throwOnError) throw err;
    return null;
  }
}

/**
 * Persists 3-level document tags into `document_tags` table.
 */
async function ensureAndLinkDocumentTags(
  documentId,
  classificationResult = {},
  options = {},
) {
  try {
    if (!documentId) return null;

    const rawL1 = classificationResult.level1 || classificationResult.subject || "Other";
    const matchedL1Name = matchLevel1Tag(rawL1);

    const level1Tag = await findOrCreateTag(
      matchedL1Name,
      1,
      null,
      options,
    );
    if (!level1Tag) {
      const error = new Error("Could not find or create the Level 1 tag.");
      if (options.throwOnError) throw error;
      console.warn(error.message, documentId);
      return null;
    }

    let level2Tag = null;
    const rawL2 = classificationResult.level2;
    if (rawL2 && String(rawL2).trim().toLowerCase() !== "none" && String(rawL2).trim().toLowerCase() !== "other") {
      level2Tag = await findOrCreateTag(rawL2, 2, level1Tag.id, options);
    }

    let level3Tag = null;
    const rawL3 = classificationResult.level3;
    if (
      level2Tag &&
      rawL3 &&
      String(rawL3).trim().toLowerCase() !== "none" &&
      String(rawL3).trim().toLowerCase() !== "other"
    ) {
      level3Tag = await findOrCreateTag(rawL3, 3, level2Tag.id, options);
    }

    const { data: docTag, error } = await supabase
      .from("document_tags")
      .upsert(
        {
          document_id: documentId,
          level_1_tag_id: level1Tag.id,
          level_2_tag_id: level2Tag?.id || null,
          level_3_tag_id: level3Tag?.id || null,
        },
        { onConflict: "document_id" }
      )
      .select(`
        id,
        document_id,
        l1:tags!document_tags_level_1_tag_id_fkey(id, name, level),
        l2:tags!document_tags_level_2_tag_id_fkey(id, name, level),
        l3:tags!document_tags_level_3_tag_id_fkey(id, name, level)
      `)
      .single();

    if (error) {
      if (options.throwOnError) throw error;
      console.warn("ensureAndLinkDocumentTags upsert warning:", error.message);
    }

    return {
      level1: level1Tag.name,
      level2: level2Tag?.name || null,
      level3: level3Tag?.name || null,
      rawRecord: docTag,
    };
  } catch (err) {
    console.error("ensureAndLinkDocumentTags error:", err.message);
    if (options.throwOnError) throw err;
    return null;
  }
}

/**
 * Retrieves the 3-level tags for a document.
 */
async function getTagsForDocument(documentId) {
  try {
    const { data } = await supabase
      .from("document_tags")
      .select(`
        id,
        l1:tags!document_tags_level_1_tag_id_fkey(id, name, level),
        l2:tags!document_tags_level_2_tag_id_fkey(id, name, level),
        l3:tags!document_tags_level_3_tag_id_fkey(id, name, level)
      `)
      .eq("document_id", documentId)
      .maybeSingle();

    if (!data) return null;

    return {
      level1: data.l1?.name || null,
      level2: data.l2?.name || null,
      level3: data.l3?.name || null,
    };
  } catch (err) {
    console.warn("getTagsForDocument error:", err.message);
    return null;
  }
}

module.exports = {
  HARDCODED_LEVEL_1_TAGS,
  normalizeTagName,
  getLevel1Tags,
  matchLevel1Tag,
  findOrCreateTag,
  ensureAndLinkDocumentTags,
  getTagsForDocument,
};
