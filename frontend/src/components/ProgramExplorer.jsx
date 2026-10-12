import { useEffect, useState } from "react";

const COUNTRIES = ["", "Canada", "UAE", "United Kingdom", "Australia", "Germany"];
const DEGREE_LEVELS = ["", "bachelor", "master", "diploma", "certificate"];
const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "tuitionAsc", label: "Tuition: low to high" },
  { value: "tuitionDesc", label: "Tuition: high to low" },
  { value: "name", label: "Program name" },
];

const PAGE_SIZE = 6;

export default function ProgramExplorer() {
  const [filters, setFilters] = useState({
    country: "",
    degreeLevel: "",
    maxBudget: "",
    q: "",
    sortBy: "relevance",
  });
  const [page, setPage] = useState(1);
  const [programs, setPrograms] = useState([]);
  const [meta, setMeta] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sortBy: filters.sortBy,
    });

    if (filters.country) params.set("country", filters.country);
    if (filters.degreeLevel) params.set("degreeLevel", filters.degreeLevel);
    if (filters.maxBudget) params.set("maxBudget", filters.maxBudget);
    if (filters.q.trim()) params.set("q", filters.q.trim());

    let cancelled = false;
    setState("loading");

    fetch(`/api/v1/programs?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Request failed");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setPrograms(json.data || []);
        setMeta(json.meta || json.pagination || null);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [filters, page]);

  const updateFilter = (key) => (event) => {
    setPage(1);
    setFilters((previous) => ({ ...previous, [key]: event.target.value }));
  };

  const totalPages = meta?.totalPages || 1;

  return (
    <div className="explorer">
      <div className="explorer-controls">
        <label>
          <span>Country</span>
          <select value={filters.country} onChange={updateFilter("country")}>
            {COUNTRIES.map((country) => (
              <option key={country || "any"} value={country}>
                {country || "Any country"}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Degree level</span>
          <select
            value={filters.degreeLevel}
            onChange={updateFilter("degreeLevel")}
          >
            {DEGREE_LEVELS.map((level) => (
              <option key={level || "any"} value={level}>
                {level ? level[0].toUpperCase() + level.slice(1) : "Any level"}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Max tuition (USD)</span>
          <input
            type="number"
            min="0"
            step="1000"
            placeholder="e.g. 22000"
            value={filters.maxBudget}
            onChange={updateFilter("maxBudget")}
          />
        </label>

        <label>
          <span>Search</span>
          <input
            type="search"
            placeholder="Title, university or field"
            value={filters.q}
            onChange={updateFilter("q")}
          />
        </label>

        <label>
          <span>Sort by</span>
          <select value={filters.sortBy} onChange={updateFilter("sortBy")}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state === "error" && (
        <p className="explorer-note">
          Could not reach <code>GET /api/v1/programs</code>. Start the backend on
          port 4000 and seed the database.
        </p>
      )}

      {state === "loading" && <p className="explorer-note">Loading programs…</p>}

      {state === "ready" && programs.length === 0 && (
        <p className="explorer-note">
          No programs match these filters. Try widening the budget or clearing
          the search term.
        </p>
      )}

      {state === "ready" && programs.length > 0 && (
        <>
          <div className="explorer-grid">
            {programs.map((program) => (
              <article className="program-card" key={program._id}>
                <p className="spotlight-country">
                  {program.country} · {program.degreeLevel}
                </p>
                <h3>{program.title}</h3>
                <p>{program.universityName}</p>
                <dl className="program-facts">
                  <div>
                    <dt>Tuition</dt>
                    <dd>${program.tuitionFeeUsd.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Min IELTS</dt>
                    <dd>{program.minimumIelts || "—"}</dd>
                  </div>
                  <div>
                    <dt>Intakes</dt>
                    <dd>{(program.intakes || []).join(", ") || "—"}</dd>
                  </div>
                </dl>
                {program.scholarshipAvailable && (
                  <span className="pill">Scholarship available</span>
                )}
              </article>
            ))}
          </div>

          <div className="explorer-pagination">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <small>
              Page {meta?.page || page} of {totalPages} · {meta?.total || 0}{" "}
              programs matched
            </small>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(current + 1, totalPages))
              }
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
