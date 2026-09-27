import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { unlockAlarm } from "../components/AlertBox.jsx";
import StatusCard from "../components/StatusCard.jsx";
import { getHistory } from "../services/api.js";
import { formatDate, formatTime, timeAgo } from "./Dashboard.jsx";

// Records more than this far apart belong to different sessions. While
// detection runs, a record is saved at least every 10 seconds.
const SESSION_GAP_MS = 90 * 1000;

const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All" },
];

// Status is never shown by color alone: every use has an icon and a label.
const STATUS = {
  awake: { icon: "✓", label: "Awake", range: "0–30%" },
  warning: { icon: "!", label: "Warning", range: "31–60%" },
  drowsy: { icon: "⚠", label: "Drowsy", range: "61–100%" },
};

const time = (record) => new Date(record.timestamp).getTime();

function rangeStart(range) {
  const now = new Date();
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (range === "7d") return now.getTime() - 7 * 864e5;
  if (range === "30d") return now.getTime() - 30 * 864e5;
  return 0;
}

/** Group records (newest first from the API) into sessions, each oldest-first inside. */
function buildSessions(records) {
  const sessions = [];
  let current = null;
  for (const record of [...records].reverse()) {
    if (!current || time(record) - time(current.records.at(-1)) > SESSION_GAP_MS) {
      current = { id: record.id, records: [] };
      sessions.push(current);
    }
    current.records.push(record);
  }
  return sessions
    .map((session) => {
      const { records: list } = session;
      const alarms = list.filter((r) => r.alert).length;
      const hadWarning = list.some((r) => r.status !== "awake");
      return {
        ...session,
        start: time(list[0]),
        end: time(list.at(-1)),
        peak: Math.max(...list.map((r) => r.score)),
        alarms,
        verdict: alarms > 0 ? "drowsy" : hadWarning ? "warning" : "awake",
      };
    })
    .reverse(); // newest session first
}

function formatDuration(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function dayLabel(timestamp) {
  const day = new Date(timestamp).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  if (day === today) return "Today";
  if (day === today - 864e5) return "Yesterday";
  return new Date(timestamp).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * Merge consecutive records with the same status into one event, so a session
 * reads as a short story ("Awake for 2 min", "Became drowsy") instead of a row
 * every 10 seconds.
 */
function buildEvents(records, sessionEnd) {
  const events = [];
  for (const record of records) {
    const last = events.at(-1);
    if (last && last.status === record.status) last.records.push(record);
    else events.push({ status: record.status, records: [record] });
  }
  return events.map((event, i) => {
    const previous = events[i - 1];
    const next = events[i + 1];
    const start = time(event.records[0]);
    let title;
    if (!previous) title = `Started — ${STATUS[event.status].label.toLowerCase()}`;
    else if (event.status === "drowsy") title = "Became drowsy";
    else if (event.status === "warning") title = previous.status === "drowsy" ? "Recovering" : "Warning signs";
    else title = "Back to awake";
    return {
      id: event.records[0].id,
      status: event.status,
      start,
      duration: (next ? time(next.records[0]) : sessionEnd) - start,
      peak: Math.max(...event.records.map((r) => r.score)),
      alarm: event.records.some((r) => r.alert),
      title,
    };
  });
}

function shortDuration(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${Math.max(seconds, 1)} s`;
  return formatDuration(ms);
}

/** One plain-language summary of the selected period. */
function Insight({ sessions, rangeLabel }) {
  const alarms = sessions.reduce((sum, s) => sum + s.alarms, 0);
  const minutes = sessions.reduce((sum, s) => sum + (s.end - s.start), 0);
  const warned = sessions.filter((s) => s.verdict === "warning").length;
  const lastAlarm = sessions.flatMap((s) => s.records).filter((r) => r.alert).sort((a, b) => time(b) - time(a))[0];

  let headline;
  let detail;
  if (alarms > 0) {
    headline = `${plural(alarms, "alarm")} in ${plural(sessions.length, "session")}`;
    detail = `Your last alarm was ${timeAgo(lastAlarm.timestamp).toLowerCase()} (${formatDate(lastAlarm.timestamp)}). If alarms keep happening, take a proper break before driving on.`;
  } else if (warned > 0) {
    headline = "No alarms, but some warning signs";
    detail = `${plural(warned, "session")} showed warning signs. Treat warnings as a cue to rest before they turn into an alarm.`;
  } else {
    headline = "No alarms — you stayed alert";
    detail = `Every session in this period stayed in the awake range.`;
  }

  return (
    <section className={`insight insight-${alarms > 0 ? "drowsy" : warned > 0 ? "warning" : "awake"}`}>
      <span className="insight-icon" aria-hidden="true">{alarms > 0 ? "⚠" : warned > 0 ? "!" : "✓"}</span>
      <div>
        <p className="insight-kicker">{rangeLabel} · {formatDuration(minutes)} monitored</p>
        <h2>{headline}</h2>
        <p className="muted">{detail}</p>
      </div>
    </section>
  );
}

/** Score over time for one session: a single line, threshold guides, alarm markers, hover tooltip. */
function SessionChart({ session }) {
  const [hover, setHover] = useState(null);
  const { records, start, end } = session;
  const span = Math.max(end - start, 1);
  const x = (r) => (records.length === 1 ? 50 : ((time(r) - start) / span) * 100);
  const y = (score) => 100 - score; // percent from the top
  const points = records.map((r) => `${x(r)},${y(r.score)}`).join(" ");

  function onMove(event) {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - box.left) / box.width;
    const target = start + fraction * span;
    let nearest = records[0];
    for (const r of records) if (Math.abs(time(r) - target) < Math.abs(time(nearest) - target)) nearest = r;
    setHover(nearest);
  }

  const summary = `Score over time: peak ${session.peak}%, ${plural(session.alarms, "alarm")}.`;
  const clock = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="session-chart" role="img" aria-label={summary}>
      <div className="chart-plot" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <span className="chart-guide" style={{ top: "40%" }}><span>Drowsy &gt;60%</span></span>
        <span className="chart-guide" style={{ top: "70%" }}><span>Warning &gt;30%</span></span>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points} className="chart-line" vectorEffect="non-scaling-stroke" />
        </svg>
        {records.length === 1 && (
          <span className="chart-dot" style={{ left: "50%", top: `${y(records[0].score)}%` }} />
        )}
        {records.filter((r) => r.alert).map((r) => (
          <span key={r.id} className="chart-alarm" style={{ left: `${x(r)}%`, top: `${y(r.score)}%` }} />
        ))}
        {hover && (
          <>
            <span className="chart-crosshair" style={{ left: `${x(hover)}%` }} />
            <span className="chart-hover-dot" style={{ left: `${x(hover)}%`, top: `${y(hover.score)}%` }} />
            <div className="chart-tooltip" style={{ left: `clamp(70px, ${x(hover)}%, calc(100% - 70px))` }}>
              <strong>{hover.score}%</strong> · {STATUS[hover.status]?.icon} {STATUS[hover.status]?.label}
              <span>{formatTime(hover.timestamp)}{hover.alert ? " · alarm" : ""}</span>
            </div>
          </>
        )}
      </div>
      <div className="chart-axis" aria-hidden="true">
        <span>{clock(start)}</span>
        <span>{clock(end)}</span>
      </div>
    </div>
  );
}

function SessionCard({ session }) {
  const [open, setOpen] = useState(false);
  const events = useMemo(() => buildEvents(session.records, session.end), [session]);
  const verdict = {
    awake: "Stayed alert",
    warning: "Warning signs",
    drowsy: plural(session.alarms, "alarm"),
  }[session.verdict];
  const clock = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <article className="card session-card">
      <header className="session-head">
        <div>
          <h3>{clock(session.start)} – {clock(session.end)}</h3>
          <p className="muted">
            {formatDuration(session.end - session.start)} · peak score {session.peak}%
          </p>
        </div>
        <span className={`verdict verdict-${session.verdict}`}>
          <span aria-hidden="true">{STATUS[session.verdict].icon}</span> {verdict}
        </span>
      </header>

      <SessionChart session={session} />

      <button className="link-button session-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Hide details" : `Show what happened (${plural(events.length, "event")})`}
      </button>

      {open && (
        <ol className="timeline">
          {events.map((event) => (
            <li key={event.id} className={`timeline-item timeline-${event.status}`}>
              <span className="timeline-marker" aria-hidden="true">{STATUS[event.status].icon}</span>
              <span className="timeline-time">{formatTime(event.start)}</span>
              <span className="timeline-text">
                <strong>{event.title}</strong>
                <span className="timeline-score">
                  for {shortDuration(event.duration)} · peak {event.peak}%
                </span>
                {event.alarm && <span className="alert-flag">Alarm triggered</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export default function History() {
  const navigate = useNavigate();
  const [records, setRecords] = useState(null); // null while loading
  const [error, setError] = useState("");
  const [range, setRange] = useState("7d");
  const [alarmsOnly, setAlarmsOnly] = useState(false);

  function load() {
    setError("");
    setRecords(null);
    getHistory(500)
      .then((data) => setRecords(data.history))
      .catch((err) => {
        setError(err.message);
        setRecords([]);
      });
  }

  useEffect(() => {
    document.title = "History · DrowzyGuard";
    load();
  }, []);

  const allSessions = useMemo(() => buildSessions(records || []), [records]);
  const inRange = allSessions.filter((s) => s.end >= rangeStart(range));
  const shown = alarmsOnly ? inRange.filter((s) => s.alarms > 0) : inRange;
  const rangeLabel = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", all: "All time" }[range];

  const byDay = [];
  for (const session of shown) {
    const label = dayLabel(session.start);
    if (byDay.at(-1)?.label !== label) byDay.push({ label, sessions: [] });
    byDay.at(-1).sessions.push(session);
  }

  const totalMs = inRange.reduce((sum, s) => sum + (s.end - s.start), 0);
  const totalAlarms = inRange.reduce((sum, s) => sum + s.alarms, 0);
  const peak = inRange.length ? Math.max(...inRange.map((s) => s.peak)) : null;

  function startDetection() {
    unlockAlarm();
    navigate("/detection", { state: { autoStart: true } });
  }

  return (
    <div className="page">
      <header className="page-header page-header-row">
        <div>
          <h1>Detection History</h1>
          <p className="muted">Your driving sessions, what happened in each, and when the alarm went off.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={records === null}>
          Refresh
        </button>
      </header>

      {error && <p className="banner banner-error" role="alert">{error}</p>}

      {records === null ? (
        <section className="card empty-state"><p className="muted">Loading your history…</p></section>
      ) : allSessions.length === 0 ? (
        <section className="card empty-state">
          <p>No detections yet</p>
          <small className="muted">Run a detection session and your results will appear here.</small>
          <div><button className="btn btn-primary" onClick={startDetection}>Start Detection</button></div>
        </section>
      ) : (
        <>
          <div className="history-controls">
            <div className="segmented" role="group" aria-label="Time range">
              {RANGES.map((r) => (
                <button key={r.id} className={range === r.id ? "active" : ""} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
            <label className="toggle">
              <input type="checkbox" checked={alarmsOnly} onChange={(e) => setAlarmsOnly(e.target.checked)} />
              <span className="toggle-track" aria-hidden="true" />
              Only sessions with alarms
            </label>
          </div>

          {inRange.length === 0 ? (
            <section className="card empty-state">
              <p>No sessions in this period</p>
              <small className="muted">Try a longer time range.</small>
            </section>
          ) : (
            <>
              <Insight sessions={inRange} rangeLabel={rangeLabel} />

              <div className="card-grid history-stats">
                <StatusCard label="Sessions" value={inRange.length} hint={rangeLabel} />
                <StatusCard label="Time monitored" value={formatDuration(totalMs)} hint="Across all sessions" />
                <StatusCard
                  label="Alarms"
                  value={totalAlarms}
                  status={totalAlarms > 0 ? "drowsy" : undefined}
                  hint={totalAlarms > 0 ? "Times you were drowsy" : "None — well done"}
                />
                <StatusCard label="Peak score" value={`${peak}%`} hint="Highest drowsiness score" meter={peak} status={peak > 60 ? "drowsy" : peak > 30 ? "warning" : "awake"} />
              </div>

              <details className="card legend">
                <summary>How to read this</summary>
                <ul>
                  {Object.entries(STATUS).map(([key, s]) => (
                    <li key={key} className={`legend-item timeline-${key}`}>
                      <span className="timeline-marker" aria-hidden="true">{s.icon}</span>
                      <strong>{s.label}</strong> <span className="muted">score {s.range}</span>
                    </li>
                  ))}
                </ul>
                <p className="muted">
                  The drowsiness score is how much of the last few seconds your eyes were closed. The alarm
                  sounds when it goes above 60%. A <strong>session</strong> is one continuous detection run.
                  These are app settings, not medical measurements.
                </p>
              </details>

              {shown.length === 0 ? (
                <section className="card empty-state">
                  <p>No alarms in this period</p>
                  <small className="muted">Turn off “Only sessions with alarms” to see all sessions.</small>
                </section>
              ) : (
                byDay.map((day) => (
                  <section key={day.label} className="day-group">
                    <h2 className="day-label">
                      {day.label} <span className="muted">· {plural(day.sessions.length, "session")}</span>
                    </h2>
                    {day.sessions.map((session) => (
                      <SessionCard key={session.id} session={session} />
                    ))}
                  </section>
                ))
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
