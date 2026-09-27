import { useNavigate } from "react-router-dom";
import StatusCard, { formatStatus } from "../components/StatusCard.jsx";

export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const history = []; // loaded from /api/history in Phase 9

  const latest = history[0];
  const totalAlerts = history.filter((record) => record.alert).length;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Welcome, {user.name}</h1>
          <p className="muted">Here is your drowsiness monitoring overview.</p>
        </div>
      </header>

      <div className="card-grid">
        <StatusCard
          label="Detection Status"
          value={latest ? formatStatus(latest.status).toUpperCase() : "—"}
          status={latest?.status}
          dot
          hint={latest ? "From your last session" : "No detections yet"}
        />
        <StatusCard
          label="Drowsiness Score"
          value={latest ? `${latest.score}%` : "—"}
          status={latest?.status}
          meter={latest ? latest.score : 0}
        />
        <StatusCard
          label="Total Alerts"
          value={totalAlerts}
          status={totalAlerts > 0 ? "drowsy" : undefined}
          hint="Drowsy alerts recorded"
        />
        <StatusCard
          label="Recent Detection"
          value={latest ? formatDate(latest.timestamp) : "—"}
          hint={latest ? `${latest.score}% · ${formatStatus(latest.status)}` : "Start a session to record one"}
        />
      </div>

      <section className="card cta-card">
        <div>
          <h2>Ready to drive?</h2>
          <p className="muted">
            DrowzyGuard watches your eyes through the webcam and sounds an alarm if you
            start to fall asleep.
          </p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => navigate("/detection", { state: { autoStart: true } })}>
          Start Detection
        </button>
      </section>
    </div>
  );
}
