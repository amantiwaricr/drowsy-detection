import { formatStatus } from "../components/StatusCard.jsx";
import { formatDate } from "./Dashboard.jsx";

export default function History() {
  const records = []; // loaded from /api/history in Phase 9

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Detection History</h1>
          <p className="muted">Your saved detection results, newest first.</p>
        </div>
      </header>

      <section className="card table-card">
        {records.length === 0 ? (
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
                  <td>{record.alert ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
