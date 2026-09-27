import { useEffect, useState } from "react";
import { formatStatus } from "../components/StatusCard.jsx";
import { getHistory } from "../services/api.js";
import { formatDate } from "./Dashboard.jsx";

export default function History() {
  const [records, setRecords] = useState(null); // null while loading
  const [error, setError] = useState("");

  function load() {
    setError("");
    getHistory(100)
      .then((data) => setRecords(data.history))
      .catch((err) => {
        setError(err.message);
        setRecords([]);
      });
  }

  useEffect(load, []);

  return (
    <div className="page">
      <header className="page-header page-header-row">
        <div>
          <h1>Detection History</h1>
          <p className="muted">Your last 100 saved results, newest first.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={records === null}>
          Refresh
        </button>
      </header>

      {error && <p className="banner banner-error" role="alert">{error}</p>}

      <section className="card table-card">
        {records === null ? (
          <div className="empty-state">
            <p className="muted">Loading…</p>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <p>No detections yet</p>
            <small className="muted">Results appear here after you run a detection session.</small>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Score</th>
                <th>Status</th>
                <th>Alert</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{formatDate(record.timestamp)}</td>
                  <td>{record.score}%</td>
                  <td>
                    <span className={`pill pill-${record.status}`}>{formatStatus(record.status)}</span>
                  </td>
                  <td>{record.alert ? <span className="alert-flag">⚠ Alarm triggered</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
