export default function AlertBox({ active, score }) {
  if (!active) return null;

  return (
    <div className="alert-box" role="alert">
      <span className="alert-icon" aria-hidden="true">⚠️</span>
      <div className="alert-text">
        <strong>DROWSINESS DETECTED</strong>
        <span>Drowsiness score {score}% — please stay alert!</span>
      </div>
      <span className="alarm-badge">ALARM ACTIVE</span>
    </div>
  );
}
