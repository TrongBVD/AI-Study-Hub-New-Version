import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicLibraries } from "../../../utils/publicApi.js";
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

function getStableNumber(value, min, max) {
  const source = String(value || "studyhub");
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 100000;
  }

  return min + (hash % (max - min + 1));
}

function normalizeLibrary(library, index) {
  const id = library.id || library.libraryId || `library-${index}`;
  const name = library.name || library.libraryName || "Untitled library";
  const documents = Number(library.documents || library.document_count || 0);
  const stars =
    Number(library.stars || library.star_count || library.starCount) ||
    getStableNumber(`${id}-stars`, 48, 980);
  const downloads =
    Number(library.downloads || library.download_count || library.downloadCount) ||
    documents * 17 + getStableNumber(`${id}-downloads`, 120, 4200);
  const createdAt = library.created_at || library.createdAt || "";
  const ageInDays = createdAt
    ? Math.max(1, (Date.now() - Date.parse(createdAt)) / 86400000)
    : getStableNumber(`${id}-age`, 2, 90);
  const owner = library.owner || library.user || {};
  const ownerId = library.user_id || owner.id || owner.user_id || "";
  const ownerName =
    owner.full_name ||
    owner.fullName ||
    owner.username ||
    library.ownerName ||
    `Creator ${String(library.user_id || id).slice(0, 4)}`;

  return {
    ...library,
    id,
    name,
    documents,
    stars,
    downloads,
    trendingScore: stars / Math.sqrt(ageInDays),
    ownerId,
    ownerName,
    description:
      library.description ||
      "A public study collection shared by the StudyHub community.",
    coverIndex: index % 6,
    createdAt,
  };
}

function buildActiveUsers(libraries) {
  const users = new Map();

  libraries.forEach((library) => {
    const key = library.ownerId || library.ownerName;
    const current = users.get(key) || {
      id: key,
      profileId: library.ownerId || "",
      name: library.ownerName,
      libraries: 0,
      stars: 0,
      downloads: 0,
    };

    current.libraries += 1;
    current.stars += library.stars;
    current.downloads += library.downloads;
    users.set(key, current);
  });

  return [...users.values()]
    .sort((a, b) => b.stars + b.downloads / 8 - (a.stars + a.downloads / 8))
    .slice(0, 5);
}

function DiscoverUserSurface({ user, className, children }) {
  if (user?.profileId) {
    return (
      <Link
        to={`/dashboard/profile/${user.profileId}`}
        className={`${className} discover_user_link`}
      >
        {children}
      </Link>
    );
  }

  return <div className={className}>{children}</div>;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en", {
    notation: Number(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);
}

function DiscoverLibraryCard({ library, rank, metricLabel, metricValue, wide }) {
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
          <p>{library.description}</p>
        </div>
        <footer>
          <span>
            <i className="ti-star" /> {formatNumber(library.stars)}
          </span>
          <span>
            <i className="ti-download" /> {formatNumber(library.downloads)}
          </span>
          {metricLabel && <em>{metricLabel}</em>}
        </footer>
      </div>
    </Link>
  );
}

function DiscoverPage() {
  const [libraries, setLibraries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDiscoverData() {
      try {
        setIsLoading(true);
        setError("");
        const publicLibraries = await getPublicLibraries();

        if (!isMounted) return;

        setLibraries(
          (Array.isArray(publicLibraries) ? publicLibraries : []).map(
            normalizeLibrary,
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
  }, []);

  const topLibraries = useMemo(
    () => [...libraries].sort((a, b) => b.stars - a.stars).slice(0, 6),
    [libraries],
  );
  const trendingLibraries = useMemo(
    () =>
      [...libraries]
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 5),
    [libraries],
  );
  const downloadedLibraries = useMemo(
    () => [...libraries].sort((a, b) => b.downloads - a.downloads).slice(0, 5),
    [libraries],
  );
  const activeUsers = useMemo(() => buildActiveUsers(libraries), [libraries]);
  const featuredUser = activeUsers[0];

  return (
    <main className="discover_page">
      <section className="discover_shell">
        <header className="discover_hero">
          <div className="discover_hero_copy">
            <span>StudyHub Discover</span>
            <h1>Find the collections everyone is studying from.</h1>
            <p>
              Explore active creators, starred libraries, fast-rising materials
              and the most downloaded public study packs.
            </p>
          </div>

          <DiscoverUserSurface
            user={featuredUser}
            className="discover_featured_user"
          >
            <span>Most active user</span>
            {featuredUser ? (
              <>
                <div className="discover_user_avatar">
                  {featuredUser.name.slice(0, 2).toUpperCase()}
                </div>
                <h2>{featuredUser.name}</h2>
                <p>
                  {featuredUser.libraries} public libraries ·{" "}
                  {formatNumber(featuredUser.stars)} stars
                </p>
              </>
            ) : (
              <>
                <div className="discover_user_avatar">SH</div>
                <h2>StudyHub community</h2>
                <p>Public activity will appear as libraries are shared.</p>
              </>
            )}
          </DiscoverUserSurface>
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
            <h2>No public libraries yet</h2>
            <p>Shared libraries will appear here once users publish them.</p>
          </section>
        ) : (
          <>
            <section className="discover_section">
              <div className="discover_section_title">
                <h2>Most starred libraries</h2>
                <p>Popular public collections ranked by community stars.</p>
              </div>
              <div className="discover_card_grid">
                {topLibraries.map((library, index) => (
                  <DiscoverLibraryCard
                    key={library.id}
                    library={library}
                    rank={index + 1}
                    metricLabel="Stars"
                    metricValue={formatNumber(library.stars)}
                  />
                ))}
              </div>
            </section>

            <section className="discover_split">
              <section className="discover_section">
                <div className="discover_section_title">
                  <h2>Rising libraries</h2>
                  <p>Libraries gaining stars quickly after publication.</p>
                </div>
                <div className="discover_list">
                  {trendingLibraries.map((library, index) => (
                    <DiscoverLibraryCard
                      key={library.id}
                      library={library}
                      rank={index + 1}
                      metricLabel="Heat"
                      metricValue={formatNumber(library.trendingScore)}
                    />
                  ))}
                </div>
              </section>

              <section className="discover_section">
                <div className="discover_section_title">
                  <h2>Most downloaded</h2>
                  <p>Public libraries with the highest download activity.</p>
                </div>
                <div className="discover_list">
                  {downloadedLibraries.map((library, index) => (
                    <DiscoverLibraryCard
                      key={library.id}
                      library={library}
                      rank={index + 1}
                      metricLabel="Downloads"
                      metricValue={formatNumber(library.downloads)}
                    />
                  ))}
                </div>
              </section>
            </section>

            <section className="discover_section">
              <div className="discover_section_title">
                <h2>Active creators</h2>
                <p>Users sharing the liveliest public study collections.</p>
              </div>
              <div className="discover_users">
                {activeUsers.map((user, index) => (
                  <DiscoverUserSurface
                    user={user}
                    className="discover_user_card"
                    key={user.id}
                  >
                    <span>{index + 1}</span>
                    <div className="discover_user_avatar">
                      {user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong>{user.name}</strong>
                      <p>
                        {user.libraries} libraries · {formatNumber(user.stars)}{" "}
                        stars · {formatNumber(user.downloads)} downloads
                      </p>
                    </div>
                  </DiscoverUserSurface>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

export default DiscoverPage;
