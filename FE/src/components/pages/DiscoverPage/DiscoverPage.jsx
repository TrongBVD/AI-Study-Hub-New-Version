import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicLibraries, getPublicTags } from "../../../utils/publicApi.js";
import { getCurrentUserId } from "../../../utils/userStorage.js";
import "./DiscoverPage.css";

const libraryThemes = [
  {
    cover: "linear-gradient(135deg, #315c62, #7fa7a0)",
    badge: "#14383d",
  },
  {
    cover: "linear-gradient(135deg, #7a4a2f, #c97945)",
    badge: "#4a2416",
  },
  {
    cover: "linear-gradient(135deg, #5f6844, #b7a66a)",
    badge: "#333a23",
  },
  {
    cover: "linear-gradient(135deg, #58446d, #a17aa8)",
    badge: "#33233f",
  },
  {
    cover: "linear-gradient(135deg, #3f4d73, #8191c7)",
    badge: "#202b4d",
  },
  {
    cover: "linear-gradient(135deg, #8a5a35, #d7a36a)",
    badge: "#4a2b18",
  },
];

function getLibraryTheme(index) {
  return libraryThemes[index % libraryThemes.length];
}

function normalizeLibrary(library, index) {
  const id = library.id || library.libraryId;
  const name = library.name || library.libraryName || "Untitled library";
  const documents = Number(library.documents || library.document_count || 0);
  const matchingFileCount = Number(library.matchingFileCount || 0);
  const downloads = Number(
    library.downloads ?? library.download_count ?? library.downloadCount ?? 0,
  );
  const createdAt = library.created_at || library.createdAt || "";
  const ageInDays = createdAt
    ? Math.max(1, (Date.now() - Date.parse(createdAt)) / 86400000)
    : null;
  const owner = library.owner || library.user || {};
  const ownerId = library.user_id || owner.id || owner.user_id || "";
  const ownerName =
    owner.full_name ||
    owner.fullName ||
    owner.username ||
    library.ownerName ||
    "StudyHub member";
  const ownerAvatar =
    owner.avatar_url || owner.avatarUrl || library.ownerAvatar || "";

  return {
    ...library,
    id,
    name,
    documents,
    matchingFileCount,
    downloads,
    trendingScore: ageInDays ? downloads / Math.sqrt(ageInDays) : 0,
    ownerId,
    ownerName,
    ownerAvatar,
    description:
      library.description ||
      "A public study collection shared by the StudyHub community.",
    coverIndex: index % 6,
    createdAt,
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("en", {
    notation: Number(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);
}

function formatCreatedDate(value) {
  const date = new Date(value || "");

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return `Created ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function getCreatedTimestamp(library) {
  const timestamp = Date.parse(library?.createdAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function DiscoverCategoryEmpty({ children }) {
  return <p className="discover_category_empty">{children}</p>;
}

function DiscoverLibraryCard({ library, rank, metricLabel, activeTag, wide }) {
  const theme = getLibraryTheme(library.coverIndex || 0);

  return (
    <Link
      to={`/dashboard/libraries/${library.id}`}
      state={{ library, from: "/dashboard/discover" }}
      className={`discover_library_card cover_${library.coverIndex} ${
        wide ? "wide" : ""
      }`}
      style={{
        "--discover-cover": theme.cover,
        "--discover-badge": theme.badge,
      }}
    >
      <div className="discover_card_art">
        <span>{String(rank).padStart(2, "0")}</span>
        <i className="ti-archive" />
      </div>
      <div className="discover_card_body">
        <div>
          <strong>{library.name}</strong>
          <span className="discover_card_owner">
            <i className="ti-user" />
            {library.ownerName}
          </span>
          <p>{library.description}</p>
        </div>
        <footer>
          <span>
          <i className="ti-download" /> {formatNumber(library.downloads)}
          </span>
          <span>
            <i className="ti-download" /> {formatNumber(library.downloads)}
          </span>
          <span title="Total Documents">
            <i className="ti-files" /> {formatNumber(library.documents)} {library.documents === 1 ? "document" : "documents"}
          </span>
          {activeTag && library.matchingFileCount > 0 && (
            <span className="matching_count_badge" title={`Matching tag: ${activeTag}`}>
              <i className="ti-tag" /> {library.matchingFileCount} matching {library.matchingFileCount === 1 ? "file" : "files"}
            </span>
          )}
          <span className="discover_card_created">
            <i className="ti-calendar" /> {formatCreatedDate(library.createdAt)}
          </span>
          {metricLabel && <em>{metricLabel}</em>}
        </footer>
      </div>
    </Link>
  );
}

function DiscoverPage() {
  const [libraries, setLibraries] = useState([]);
  const [tagsList, setTagsList] = useState([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTags() {
      try {
        const tags = await getPublicTags();
        setTagsList(Array.isArray(tags) ? tags : []);
      } catch {
        setTagsList([]);
      }
    }
    loadTags();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDiscoverData() {
      try {
        setIsLoading(true);
        setError("");
        const publicLibraries = await getPublicLibraries(selectedTag);

        if (!isMounted) return;

        const currentUserId = getCurrentUserId();

        setLibraries(
          (Array.isArray(publicLibraries) ? publicLibraries : [])
            .filter((library) => library?.id || library?.libraryId)
            .map(normalizeLibrary)
            .filter(
              (library) =>
                !currentUserId ||
                String(library.ownerId) !== String(currentUserId),
            ),
        );
      } catch (requestError) {
        if (!isMounted) return;

        setLibraries([]);
        setError(
          requestError.response?.data?.message ||
            "Could not load Discover data right now.",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDiscoverData();

    return () => {
      isMounted = false;
    };
  }, [selectedTag]);

  const handleTagSearchSubmit = (e) => {
    e.preventDefault();
    setSelectedTag(tagInput.trim());
  };

  const favoriteLibraries = useMemo(() => {
    return [...libraries].sort((a, b) => {
      if (selectedTag) {
        return (
          b.matchingFileCount - a.matchingFileCount ||
          b.downloads - a.downloads ||
          getCreatedTimestamp(b) - getCreatedTimestamp(a)
        );
      }
      return (
        b.downloads - a.downloads ||
        b.documents - a.documents ||
        getCreatedTimestamp(b) - getCreatedTimestamp(a)
      );
    });
  }, [libraries, selectedTag]);

  return (
    <main className="discover_page">
      <section className="discover_shell">
        <header className="discover_hero">
          <div className="discover_hero_copy">
            <span>StudyHub Discover</span>
            <h1>Find the collections everyone is studying from.</h1>
            <p>
              Explore public study collections categorized by AI subjects and sub-topics.
            </p>

            <div className="discover_tag_bar">
              <form className="discover_tag_search_box" onSubmit={handleTagSearchSubmit}>
                <i className="ti-search" />
                <input
                  type="text"
                  placeholder="Search by subject or topic (e.g. Mathematics, Integrals)..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                />
                {tagInput && (
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                    onClick={() => {
                      setTagInput("");
                      setSelectedTag("");
                    }}
                  >
                    <i className="ti-close" />
                  </button>
                )}
              </form>

              <div className="discover_tag_pills">
                <button
                  type="button"
                  className={`tag_pill ${!selectedTag ? "active" : ""}`}
                  onClick={() => {
                    setSelectedTag("");
                    setTagInput("");
                  }}
                >
                  All Subjects
                </button>
                {tagsList.map((tagObj) => {
                  const tagName = tagObj.name || tagObj;
                  const isActive = selectedTag.toLowerCase() === tagName.toLowerCase();
                  return (
                    <button
                      type="button"
                      key={tagName}
                      className={`tag_pill ${isActive ? "active" : ""}`}
                      onClick={() => {
                        if (isActive) {
                          setSelectedTag("");
                          setTagInput("");
                        } else {
                          setSelectedTag(tagName);
                          setTagInput(tagName);
                        }
                      }}
                    >
                      {tagName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        {error && <p className="discover_error">{error}</p>}

        {isLoading ? (
          <section className="discover_empty">
            <i className="ti-reload" />
            <h2>Loading Discover...</h2>
          </section>
        ) : libraries.length === 0 ? (
          <section className="discover_empty">
            <i className="ti-archive" />
            <h2>No matching public libraries found</h2>
            <p>
              {selectedTag
                ? `No libraries contain files tagged with "${selectedTag}". Try selecting another subject.`
                : "Shared libraries will appear here once users publish them."}
            </p>
          </section>
        ) : (
          <section className="discover_split">
            <section className="discover_section">
              <div className="discover_section_title">
                <h2>{selectedTag ? `Libraries for "${selectedTag}"` : "Most favorite"}</h2>
                <p>
                  {selectedTag
                    ? `Sorted by number of files matching tag "${selectedTag}"`
                    : "Public libraries ranked by downloads, documents and recency."}
                </p>
              </div>
              <div className="discover_list">
                {favoriteLibraries.length > 0 ? (
                  favoriteLibraries.map((library, index) => (
                    <DiscoverLibraryCard
                      key={library.id}
                      library={library}
                      rank={index + 1}
                      activeTag={selectedTag}
                      metricLabel={selectedTag ? `${library.matchingFileCount} files` : "Favorite"}
                    />
                  ))
                ) : (
                  <DiscoverCategoryEmpty>
                    No library is available for this tag.
                  </DiscoverCategoryEmpty>
                )}
              </div>
            </section>
          </section>
        )}
      </section>
    </main>
  );
}

export default DiscoverPage;
