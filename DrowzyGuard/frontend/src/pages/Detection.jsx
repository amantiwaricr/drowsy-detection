import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AlertBox, { unlockAlarm } from "../components/AlertBox.jsx";
import Camera from "../components/Camera.jsx";
import StatusCard, { formatStatus } from "../components/StatusCard.jsx";
import { FRAME_INTERVAL_MS } from "../config.js";
import { detectFrame, getHealth } from "../services/api.js";

export default function Detection() {
  const location = useLocation();
  const navigate = useNavigate();
  const [running, setRunning] = useState(Boolean(location.state?.autoStart));
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(null); // "model" | "opencv fallback" | null

  // Each Start begins a new session; responses from an older session are ignored.
  const sessionRef = useRef(0);
  const resetNextRef = useRef(true);

  // Auto-start only once when arriving from the Dashboard, not again on page reload.
  useEffect(() => {
    if (location.state?.autoStart) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  useEffect(() => {
    document.title = "Live Detection · DrowzyGuard";
    getHealth()
      .then((health) => setMode(health.detection))
      .catch((err) => setError(err.message));
  }, []);

  function start() {
    unlockAlarm(); // browsers only allow sound after a click
    sessionRef.current += 1;
    resetNextRef.current = true;
    setResult(null);
    setError("");
    setRunning(true);
  }

  function stop() {
    sessionRef.current += 1;
    setRunning(false);
  }

  async function handleFrame(frame) {
    const session = sessionRef.current;
    const reset = resetNextRef.current;
    resetNextRef.current = false;
    try {
      const data = await detectFrame(frame, reset);
      if (session !== sessionRef.current) return;
      setResult(data);
      setError("");
    } catch (err) {
      if (session !== sessionRef.current) return;
      resetNextRef.current = reset; // retry the reset with the next frame
      setError(err.message);
    }
  }

  const live = running && result;
  const status = live ? result.status : undefined;
  const alarmOn = Boolean(live && result.alert);

  return (
    <div className="page">
      <header className="page-header page-header-row">
        <div>
          <h1>Live Detection</h1>
          <p className="muted">Keep your face in view of the camera while driving.</p>
        </div>
        {mode && (
          <span className="mode-badge" title="Change by adding model/drowsiness_model.h5">
            {mode === "model" ? "AI model" : "OpenCV fallback"}
          </span>
        )}
      </header>

      <AlertBox active={alarmOn} score={result?.score} />
      {error && <p className="banner banner-error" role="alert">{error}</p>}

      <div className="detection-grid">
        <section className={`card camera-card ${alarmOn ? "camera-card-alert" : ""}`}>
          <Camera
            active={running}
            onFrame={handleFrame}
            onError={stop}
            interval={FRAME_INTERVAL_MS}
            faceBox={live ? result.box : null}
            eyeBoxes={live ? result.eyeBoxes : []}
          />
          <div className="controls">
            <button className="btn btn-primary" onClick={start} disabled={running}>
              Start
            </button>
            <button className="btn btn-danger" onClick={stop} disabled={!running}>
              Stop
            </button>
          </div>
          <ul className="tips">
            <li>Face the camera in good, even lighting.</li>
            <li>The alarm sounds after about 3 seconds of closed eyes.</li>
            <li>Keep this tab open while driving — the alarm plays here.</li>
          </ul>
        </section>

        <aside className="detection-stats">
          <StatusCard
            large
            label="Drowsiness Score"
            value={live ? `${result.score}%` : "—"}
            status={status}
            meter={live ? result.score : 0}
          />
          <StatusCard
            label="Status"
            value={status ? formatStatus(status).toUpperCase() : running ? "Analyzing…" : "Idle"}
            status={status}
            dot
            className="status-card-wide"
            hint={status === "no_face" ? "Center your face in the camera" : undefined}
          />
          <StatusCard label="Eyes" value={live ? result.eyes.toUpperCase() : "—"} />
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
