import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { unlockAlarm } from "../components/AlertBox.jsx";
import StatusCard, { formatStatus } from "../components/StatusCard.jsx";
import { getHistory } from "../services/api.js";

export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(timestamp) {
  const minutes = Math.floor((Date.now() - new Date(timestamp)) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;
  const days = Math.floor(minutes / (60 * 24));
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [latest, setLatest] = useState(null);
  const [totalAlerts, setTotalAlerts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getHistory(1)
      .then((data) => {
        setLatest(data.history[0] || null);
        setTotalAlerts(data.totalAlerts);
      })
      .catch((err) => setError(err.message));
  }, []);

  function startDetection() {
    unlockAlarm(); // this click allows the alarm to play on the Detection page
    navigate("/detection", { state: { autoStart: true } });
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Welcome, {user.name}</h1>
          <p className="muted">Here is your drowsiness monitoring overview.</p>
        </div>
      </header>

      {error && <p className="banner banner-error" role="alert">{error}</p>}

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
          value={totalAlerts ?? "—"}
          status={totalAlerts > 0 ? "drowsy" : undefined}
          hint="Times the alarm was triggered"
        />
        <StatusCard
          label="Recent Detection"
          value={latest ? timeAgo(latest.timestamp) : "—"}
          hint={latest ? `${formatDate(latest.timestamp)} · ${latest.score}% ${formatStatus(latest.status)}` : "Start a session to record one"}
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
        <button className="btn btn-primary btn-lg" onClick={startDetection}>
          Start Detection
        </button>
      </section>
    </div>
  );
}
