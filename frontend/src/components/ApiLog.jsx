import { useEffect, useRef, useState } from "react";
import { onApiCall } from "../api.js";

export default function ApiLog() {
  const [entries, setEntries] = useState([]);
  const bodyRef = useRef(null);

  useEffect(() => onApiCall((entry) => setEntries((prev) => [...prev, entry])), []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="api-log">
      <div className="api-log-head">
        <strong>Live API calls</strong>
        <span>
          {entries.length} request{entries.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="api-log-body" ref={bodyRef}>
        {entries.length === 0 && (
          <p className="explorer-note">
            Nothing yet. Run a step above and every request the dashboard makes
            will appear here.
          </p>
        )}
        {entries.map((entry) => (
          <div className="api-log-row" key={entry.id}>
            <code
              className={
                entry.status >= 500 || entry.status === 0
                  ? "log-bad"
                  : entry.status >= 400
                  ? "log-warn"
                  : "log-good"
              }
            >
              {entry.status === 0 ? "ERR" : entry.status}
            </code>
            <span className="log-method">{entry.method}</span>
            <span className="log-path">{entry.path}</span>
            <span className="log-ms">
              {entry.cache ? `cache ${entry.cache} · ` : ""}
              {entry.ms}ms
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
