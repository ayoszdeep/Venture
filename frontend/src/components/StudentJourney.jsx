import { useState } from "react";
import StatusChip from "./StatusChip.jsx";
import { api } from "../api.js";

const LIFECYCLE = [
  "submitted",
  "under-review",
  "offer-received",
  "visa-processing",
  "enrolled",
];

const INTAKE_FALLBACK = "September";

function Step({ number, title, subtitle, children, done }) {
  return (
    <section className={`step ${done ? "step-done" : ""}`}>
      <div className="step-head">
        <span className="step-number">{done ? "✓" : number}</span>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="step-body">{children}</div>
    </section>
  );
}

export default function StudentJourney() {
  const [credentials, setCredentials] = useState({
    email: "aarav@example.com",
    password: "Candidate123!",
  });
  const [busy, setBusy] = useState("");
  const [session, setSession] = useState(null);
  const [profileStatus, setProfileStatus] = useState(0);
  const [anonStatus, setAnonStatus] = useState(0);
  const [shortlist, setShortlist] = useState(null);
  const [affordability, setAffordability] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [application, setApplication] = useState(null);
  const [applyStatus, setApplyStatus] = useState(0);
  const [duplicate, setDuplicate] = useState(null);
  const [counselorToken, setCounselorToken] = useState(null);
  const [transition, setTransition] = useState(null);
  const [error, setError] = useState("");

  const student = session?.user;

  async function run(key, work) {
    setBusy(key);
    setError("");
    try {
      await work();
    } catch (requestError) {
      setError(requestError.message || "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  const signIn = (event) => {
    event.preventDefault();
    return run("signin", async () => {
      const anon = await api("GET", "/auth/me");
      setAnonStatus(anon.status);

      const login = await api("POST", "/auth/login", { body: credentials });
      if (!login.ok) {
        setError(login.message || "Login failed.");
        setSession(null);
        return;
      }

      const token = login.data.token;
      const profile = await api("GET", "/auth/me", { token });
      setProfileStatus(profile.status);

      setSession({ token, user: profile.data });
      setShortlist(null);
      setAffordability(null);
      setRecommendations(null);
      setApplication(null);
      setDuplicate(null);
      setTransition(null);
      setApplyStatus(0);
    });
  };

  const loadShortlist = () =>
    run("shortlist", async () => {
      const countries = student.targetCountries?.length
        ? student.targetCountries
        : ["Canada"];

      const results = await Promise.all(
        countries.map(async (country) => {
          const res = await api(
            "GET",
            `/universities?country=${encodeURIComponent(country)}&sortBy=ranking&order=asc&limit=4`
          );
          return { country, items: res.data || [], meta: res.meta };
        })
      );

      setShortlist(results);
    });

  const loadAffordability = () =>
    run("afford", async () => {
      const field = student.interestedFields?.[0] || "Computer Science";
      const budget = student.maxBudgetUsd || 25000;

      const everything = await api(
        "GET",
        `/programs?field=${encodeURIComponent(field)}&limit=50`
      );
      const withinBudget = await api(
        "GET",
        `/programs?field=${encodeURIComponent(field)}&maxBudget=${budget}&sortBy=tuitionAsc&limit=50`
      );

      setAffordability({
        field,
        budget,
        total: everything.meta?.total ?? 0,
        affordable: withinBudget.meta?.total ?? 0,
        items: withinBudget.data || [],
      });
    });

  const loadRecommendations = () =>
    run("recs", async () => {
      const res = await api("GET", `/recommendations/${student.id}`, {
        token: session.token,
      });
      setRecommendations({
        engine: res.meta?.engine,
        items: res.data?.recommendations || [],
      });
    });

  const applyTo = (program) =>
    run(`apply-${program._id}`, async () => {
      const intake =
        student.preferredIntake ||
        program.intakes?.[0] ||
        INTAKE_FALLBACK;

      const res = await api("POST", "/applications", {
        token: session.token,
        body: {
          programId: program._id,
          intake,
          note: "Submitted from the dashboard.",
        },
      });

      setApplyStatus(res.status);

      if (res.ok) {
        setApplication(res.data);
        setDuplicate(null);
        setTransition(null);
        return;
      }

      setDuplicate({ status: res.status, message: res.message, intake });
    });

  const retrySameApplication = () =>
    run("duplicate", async () => {
      const res = await api("POST", "/applications", {
        token: session.token,
        body: {
          programId: application.program._id,
          intake: application.intake,
        },
      });
      setDuplicate({ status: res.status, message: res.message });
    });

  const studentTriesApproval = () =>
    run("selfapprove", async () => {
      const res = await api("PATCH", `/applications/${application._id}/status`, {
        token: session.token,
        body: { status: "under-review" },
      });
      setTransition({ kind: "self", status: res.status, message: res.message });
    });

  async function counselorSession() {
    if (counselorToken) return counselorToken;

    const res = await api("POST", "/auth/login", {
      body: { email: "counselor@example.com", password: "Candidate123!" },
    });

    if (!res.ok) {
      throw new Error("Could not sign in as the seeded counselor.");
    }

    setCounselorToken(res.data.token);
    return res.data.token;
  }

  const advance = () =>
    run("advance", async () => {
      const token = await counselorSession();
      const current = application.status;
      const next = LIFECYCLE[LIFECYCLE.indexOf(current) + 1];

      if (!next) {
        const res = await api(
          "PATCH",
          `/applications/${application._id}/status`,
          { token, body: { status: "under-review" } }
        );
        setTransition({
          kind: "terminal",
          status: res.status,
          message: res.message,
        });
        return;
      }

      const res = await api("PATCH", `/applications/${application._id}/status`, {
        token,
        body: { status: next, note: `Moved to ${next} by counselor.` },
      });

      if (res.ok) {
        setApplication(res.data);
        setTransition({ kind: "ok", status: res.status, from: current, to: next });
      } else {
        setTransition({ kind: "bad", status: res.status, message: res.message });
      }
    });

  const tryIllegalJump = () =>
    run("illegal", async () => {
      const token = await counselorSession();
      const res = await api("PATCH", `/applications/${application._id}/status`, {
        token,
        body: { status: "enrolled" },
      });
      setTransition({
        kind: "illegal",
        status: res.status,
        message: res.message,
      });
    });

  return (
    <div className="journey">
      {error && <p className="explorer-note journey-error">{error}</p>}

      <Step
        number="1"
        title="Sign in"
        subtitle="Registration, login and the protected profile API — JWT plus bcrypt."
        done={!!session}
      >
        <form className="planner-form" onSubmit={signIn}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={credentials.email}
              onChange={(e) =>
                setCredentials({ ...credentials, email: e.target.value })
              }
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) =>
                setCredentials({ ...credentials, password: e.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={busy === "signin"}>
            {busy === "signin" ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {session && (
          <div className="step-result">
            <div className="chip-row">
              <StatusChip status={anonStatus} label="GET /auth/me without a token" />
              <StatusChip status={profileStatus} label="GET /auth/me with the token" />
            </div>
            <div className="profile-card">
              <strong>{student.fullName}</strong>
              <span className="pill">{student.role}</span>
              <dl className="program-facts">
                <div>
                  <dt>Destinations</dt>
                  <dd>{student.targetCountries?.join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt>Field</dt>
                  <dd>{student.interestedFields?.join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt>Budget</dt>
                  <dd>${(student.maxBudgetUsd || 0).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>{student.englishTest?.exam || "IELTS"}</dt>
                  <dd>{student.englishTest?.score || "—"}</dd>
                </div>
                <div>
                  <dt>Intake</dt>
                  <dd>{student.preferredIntake || "—"}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </Step>

      <Step
        number="2"
        title="Shortlist destinations"
        subtitle="Her target countries, filtered and ranked by the discovery API."
        done={!!shortlist}
      >
        <button
          type="button"
          className="step-action"
          onClick={loadShortlist}
          disabled={!session || busy === "shortlist"}
        >
          {busy === "shortlist" ? "Loading…" : "Shortlist her destinations"}
        </button>

        {!session && <p className="explorer-note">Sign in first.</p>}

        {shortlist && (
          <div className="step-result">
            {shortlist.map((group) => (
              <div key={group.country} className="country-group">
                <p className="spotlight-country">
                  {group.country} · {group.meta?.total ?? group.items.length}{" "}
                  universities
                </p>
                <div className="explorer-grid">
                  {group.items.map((university) => (
                    <article className="program-card" key={university._id}>
                      <h3>{university.name}</h3>
                      <p>
                        {university.city}, {university.country}
                      </p>
                      <dl className="program-facts">
                        <div>
                          <dt>QS rank</dt>
                          <dd>{university.qsRanking || "unranked"}</dd>
                        </div>
                        <div>
                          <dt>Popularity</dt>
                          <dd>{university.popularScore}</dd>
                        </div>
                        <div>
                          <dt>Partner</dt>
                          <dd>{university.partnerType}</dd>
                        </div>
                      </dl>
                      {university.scholarshipAvailable && (
                        <span className="pill">Scholarship</span>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Step>

      <Step
        number="3"
        title="Evaluate tuition affordability"
        subtitle="Which programs in her field actually fit the budget."
        done={!!affordability}
      >
        <button
          type="button"
          className="step-action"
          onClick={loadAffordability}
          disabled={!session || busy === "afford"}
        >
          {busy === "afford" ? "Checking…" : "Check what she can afford"}
        </button>

        {affordability && (
          <div className="step-result">
            <p className="journey-headline">
              <strong>{affordability.affordable}</strong> of{" "}
              <strong>{affordability.total}</strong> {affordability.field}{" "}
              programs are within ${affordability.budget.toLocaleString()}
            </p>
            <table className="afford-table">
              <thead>
                <tr>
                  <th>Tuition</th>
                  <th>Program</th>
                  <th>University</th>
                  <th>Min IELTS</th>
                  <th>Fits</th>
                </tr>
              </thead>
              <tbody>
                {affordability.items.map((program) => {
                  const ieltsOk =
                    (student.englishTest?.score || 0) >=
                    (program.minimumIelts || 0);
                  return (
                    <tr key={program._id}>
                      <td>${program.tuitionFeeUsd.toLocaleString()}</td>
                      <td>{program.title}</td>
                      <td>{program.universityName}</td>
                      <td>{program.minimumIelts || "—"}</td>
                      <td>
                        {ieltsOk ? (
                          <span className="chip chip-good">budget + IELTS</span>
                        ) : (
                          <span className="chip chip-warn">IELTS short</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Step>

      <Step
        number="4"
        title="Get recommendations"
        subtitle="Scored by the MongoDB aggregation pipeline, with reasons."
        done={!!recommendations}
      >
        <button
          type="button"
          className="step-action"
          onClick={loadRecommendations}
          disabled={!session || busy === "recs"}
        >
          {busy === "recs" ? "Scoring…" : "Score every program for her"}
        </button>

        {recommendations && (
          <div className="step-result">
            <p className="planner-meta">engine: {recommendations.engine}</p>
            {recommendations.items.map((program) => (
              <div className="rec-row" key={program._id}>
                <div className="rec-score">
                  <strong>{program.matchScore}</strong>
                  <small>/100</small>
                  <div className="score-bar">
                    <span style={{ width: `${program.matchScore}%` }} />
                  </div>
                </div>
                <div className="rec-main">
                  <strong>{program.title}</strong>
                  <p>
                    {program.universityName} · {program.country} · $
                    {program.tuitionFeeUsd.toLocaleString()}
                  </p>
                  <ul className="rec-reasons">
                    {program.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  className="step-action"
                  onClick={() => applyTo(program)}
                  disabled={busy === `apply-${program._id}`}
                >
                  {busy === `apply-${program._id}` ? "Applying…" : "Apply"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Step>

      <Step
        number="5"
        title="Apply, and try to apply twice"
        subtitle="Duplicate prevention is enforced by a compound unique index."
        done={!!application}
      >
        {!application && !duplicate && (
          <p className="explorer-note">
            Use an <strong>Apply</strong> button in step 4.
          </p>
        )}

        {application && (
          <div className="step-result">
            <div className="chip-row">
              <StatusChip status={applyStatus} label="POST /applications" />
              <span className="pill">{application.status}</span>
            </div>
            <p className="journey-headline">
              {application.program.title} — {application.university.name},{" "}
              {application.intake} intake
            </p>

            <div className="chip-row">
              <button
                type="button"
                className="step-action"
                onClick={retrySameApplication}
                disabled={busy === "duplicate"}
              >
                {busy === "duplicate" ? "Submitting…" : "Submit the same application again"}
              </button>
              <button
                type="button"
                className="step-action"
                onClick={studentTriesApproval}
                disabled={busy === "selfapprove"}
              >
                {busy === "selfapprove" ? "Trying…" : "Try to approve it herself"}
              </button>
            </div>
          </div>
        )}

        {duplicate && (
          <div className="step-result">
            <div className="chip-row">
              <StatusChip status={duplicate.status} label="duplicate blocked" />
            </div>
            <p className="explorer-note">{duplicate.message}</p>
          </div>
        )}

        {transition?.kind === "self" && (
          <div className="step-result">
            <div className="chip-row">
              <StatusChip status={transition.status} label="student self-approval blocked" />
            </div>
            <p className="explorer-note">{transition.message}</p>
          </div>
        )}
      </Step>

      <Step
        number="6"
        title="Track the application to enrolment"
        subtitle="Counselor-only transitions, with the full status history."
        done={application?.status === "enrolled"}
      >
        {!application && <p className="explorer-note">Apply first.</p>}

        {application && (
          <div className="step-result">
            <div className="status-rail">
              {LIFECYCLE.map((status) => {
                const reached =
                  LIFECYCLE.indexOf(status) <=
                  LIFECYCLE.indexOf(application.status);
                return (
                  <span
                    key={status}
                    className={`rail-node ${reached ? "rail-reached" : ""}`}
                  >
                    {status}
                  </span>
                );
              })}
            </div>

            <div className="chip-row">
              <button
                type="button"
                className="step-action"
                onClick={advance}
                disabled={busy === "advance"}
              >
                {busy === "advance"
                  ? "Updating…"
                  : application.status === "enrolled"
                  ? "Try to move it backwards"
                  : `Advance as counselor → ${
                      LIFECYCLE[LIFECYCLE.indexOf(application.status) + 1]
                    }`}
              </button>
              {application.status !== "enrolled" && (
                <button
                  type="button"
                  className="step-action step-action-ghost"
                  onClick={tryIllegalJump}
                  disabled={busy === "illegal"}
                >
                  {busy === "illegal" ? "Trying…" : "Try to skip straight to enrolled"}
                </button>
              )}
            </div>

            {transition && transition.kind !== "self" && (
              <div className="chip-row">
                <StatusChip
                  status={transition.status}
                  label={
                    transition.kind === "ok"
                      ? `${transition.from} → ${transition.to}`
                      : transition.kind === "illegal"
                      ? "illegal jump rejected"
                      : transition.kind === "terminal"
                      ? "enrolled is terminal"
                      : "rejected"
                  }
                />
              </div>
            )}

            {transition?.message && transition.kind !== "ok" && (
              <p className="explorer-note">{transition.message}</p>
            )}

            <p className="planner-meta">
              Status history · {application.timeline.length} entr
              {application.timeline.length === 1 ? "y" : "ies"}
            </p>
            <ol className="timeline">
              {application.timeline.map((entry, index) => (
                <li key={`${entry.status}-${index}`}>
                  <span className="pill">{entry.status}</span>
                  <small>
                    {new Date(entry.changedAt).toLocaleString()} — {entry.note}
                  </small>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Step>
    </div>
  );
}
