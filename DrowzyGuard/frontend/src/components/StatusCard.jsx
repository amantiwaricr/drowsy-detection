const STATUS_LABELS = {
  awake: "Awake",
  warning: "Warning",
  drowsy: "Drowsy",
  no_face: "No face",
};

export function formatStatus(status) {
  return STATUS_LABELS[status] || "—";
}

/**
 * A dashboard card. `status` colours the value (awake / warning / drowsy /
 * no_face). `meter` (0-100) adds a progress bar under the value.
 */
export default function StatusCard({ label, value, status, hint, meter, large = false, dot = false }) {
  return (
    <div className={`card status-card ${large ? "status-card-large" : ""}`}>
      <span className="card-label">{label}</span>
      <span className={`card-value ${status ? `text-${status}` : ""}`}>
        {dot && status && <span className={`status-dot bg-${status}`} aria-hidden="true" />}
        {value}
      </span>
      {meter !== undefined && (
        <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter}>
          <div className={`meter-fill bg-${status || "neutral"}`} style={{ width: `${meter}%` }} />
        </div>
      )}
      {hint && <span className="card-hint">{hint}</span>}
    </div>
  );
}
