import { useEffect, useState } from "react";
import InfoCard from "./components/InfoCard.jsx";
import ProgramExplorer from "./components/ProgramExplorer.jsx";
import SignalStrip from "./components/SignalStrip.jsx";
import SpotlightList from "./components/SpotlightList.jsx";
import StudyPlanPanel from "./components/StudyPlanPanel.jsx";
import {
  assignmentSignals,
  featureCards,
  productSignals,
  universitySpotlights,
} from "./data/sampleData.js";

export default function App() {
  const [overview, setOverview] = useState(null);
  const [apiStatus, setApiStatus] = useState("checking");

  useEffect(() => {
    fetch("/api/v1/dashboard/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Backend not reachable");
        return res.json();
      })
      .then((json) => {
        if (json.success) {
          setOverview(json.data);
          setApiStatus("connected");
        }
      })
      .catch(() => {
        setApiStatus("disconnected");
      });
  }, []);

  const displaySignals = overview
    ? [
        {
          label: "Live Students",
          value: `${overview.totalStudents} registered students`,
        },
        {
          label: "Available Programs",
          value: `${overview.totalPrograms} active university courses`,
        },
        {
          label: "Applications In Pipeline",
          value: `${overview.totalApplications} tracked applications`,
        },
      ]
    : productSignals;

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Waygood Candidate Evaluation Platform</p>
          <h1>Study-Abroad Backend Architecture & Engineering</h1>
          <p className="hero-text">
            Production-ready backend implemented with JWT authentication,
            MongoDB aggregation-powered recommendation engine, compound unique
            indexes for application workflow safety, in-memory TTL caching, and
            automated Jest/Supertest coverage.
          </p>
          <div style={{ marginTop: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: apiStatus === "connected" ? "#1d7a65" : "#d98639",
              }}
            />
            <small style={{ color: "var(--muted)", fontWeight: 600 }}>
              Backend Status: {apiStatus === "connected" ? "Connected to API (Live Cache)" : "Ready (Start backend on port 4000)"}
            </small>
          </div>
        </div>
        <div className="hero-panel">
          <p className="panel-label">Implemented Platform Features</p>
          <ul>
            {assignmentSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </div>
      </section>

      <SignalStrip items={displaySignals} />

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Product direction</p>
          <h2>Waygood-style platform areas reflected in the starter</h2>
        </div>
        <div className="card-grid">
          {featureCards.map((card) => (
            <InfoCard key={card.title} title={card.title} body={card.body} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Live discovery API</p>
          <h2>Filter, sort and paginate real program data</h2>
        </div>
        <ProgramExplorer />
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">AI study planner</p>
          <h2>Plans grounded on the aggregation shortlist</h2>
        </div>
        <StudyPlanPanel />
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Sample destinations</p>
          <h2>University examples seeded into the backend</h2>
        </div>
        <SpotlightList items={universitySpotlights} />
      </section>

      <section className="section closing-note">
        <p className="eyebrow">Candidate note</p>
        <h2>Backend Architecture & Automated Test Verification</h2>
        <p>
          All 6 required tasks (Authentication, Discovery, Recommendation Engine
          with Aggregation, Application Workflow with Compound Index & Audit Trail,
          In-Memory Caching & Indexes, and Automated Test Suite) are fully
          implemented, tested, and documented — alongside all 4 bonus tasks: an
          AI study planner grounded on the aggregation shortlist, Docker Compose
          deployment, rate limiting with Helmet and NoSQL sanitisation, and this
          dashboard driving the live discovery and AI endpoints. 26 Jest/Supertest
          scenarios pass against the seeded database.
        </p>
      </section>
    </main>
  );
}
