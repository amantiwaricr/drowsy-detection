import { useState } from "react";
import { useLocation } from "react-router-dom";
import AlertBox from "../components/AlertBox.jsx";
import Camera from "../components/Camera.jsx";
import StatusCard, { formatStatus } from "../components/StatusCard.jsx";
import { FRAME_INTERVAL_MS } from "../config.js";

export default function Detection() {
  const location = useLocation();
  const [running, setRunning] = useState(Boolean(location.state?.autoStart));
  const [result, setResult] = useState(null);

  function start() {
    setResult(null);
    setRunning(true);
  }

  function stop() {
    setRunning(false);
  }

  async function handleFrame() {
    // Phase 7 sends each frame to POST /api/detection and stores the result.
  }

  const status = running ? result?.status : undefined;
  const alarmOn = running && Boolean(result?.alert);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Live Detection</h1>
          <p className="muted">Keep your face in view of the camera while driving.</p>
        </div>
      </header>

      <AlertBox active={alarmOn} score={result?.score} />

      <div className="detection-grid">
        <section className={`card camera-card ${alarmOn ? "camera-card-alert" : ""}`}>
          <Camera active={running} onFrame={handleFrame} onError={stop} interval={FRAME_INTERVAL_MS} />
          <div className="controls">
            <button className="btn btn-primary" onClick={start} disabled={running}>
              Start
            </button>
            <button className="btn btn-danger" onClick={stop} disabled={!running}>
              Stop
            </button>
          </div>
        </section>

        <aside className="detection-stats">
          <StatusCard
            large
            label="Drowsiness Score"
            value={result && running ? `${result.score}%` : "—"}
            status={status}
            meter={result && running ? result.score : 0}
          />
          <StatusCard
            label="Status"
            value={status ? formatStatus(status).toUpperCase() : running ? "Analyzing…" : "Idle"}
            status={status}
            dot
          />
          <StatusCard label="Eyes" value={running && result ? result.eyes.toUpperCase() : "—"} />
          <StatusCard
            label="Alarm"
            value={alarmOn ? "ACTIVE" : "OFF"}
            status={alarmOn ? "drowsy" : undefined}
          />
        </aside>
      </div>
    </div>
  );
}
