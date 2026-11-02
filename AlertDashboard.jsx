import { useCallback, useEffect, useState } from "react";
import api from "../api/api";
import "./AlertDashboard.css";

const API = api.defaults.baseURL || "http://localhost:5000";

const FILTERS = [
  ["all", "All"],
  ["violence", "Violence"],
  ["other", "Objects"],
  ["new", "Unreviewed"],
];

const STATUS_TEXT = {
  new: "Unreviewed",
  acknowledged: "Acknowledged",
  confirmed: "Confirmed",
  false_alarm: "False alarm",
};

const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function AlertDashboard() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ today: 0, unreviewed: 0, critical: 0 });
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const [perm, setPerm] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  const load = useCallback(async () => {
    const params = {};
    if (filter === "violence" || filter === "other") params.label = filter;
    if (filter === "new") params.status = "new";
    try {
      const [a, s] = await Promise.all([
        api.get("/alerts", { params }),
        api.get("/alerts/stats"),
      ]);
      setAlerts(a.data);
      setStats(s.data);
      setError("");
    } catch {
      setError("Can't reach the server. Check that the Flask backend is running.");
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // live updates
  useEffect(() => {
    const es = new EventSource(`${API}/alerts/stream`);
    es.onmessage = (e) => {
      const a = JSON.parse(e.data);
      if (a.severity === "critical" && perm === "granted") {
        new Notification("Violence detected", {
          body: `${a.camera} - ${Math.round(a.confidence * 100)}% confidence`,
        });
      }
      load();
    };
    return () => es.close();
  }, [load, perm]);

  const setStatus = async (id, status) => {
    await api.patch(`/alerts/${id}`, { status });
    setOpen(null);
    load();
  };

  const enableNotifications = async () => setPerm(await Notification.requestPermission());

  const live = alerts.find((a) => a.status === "new" && a.severity === "critical");

  return (
    <main className="sa">
      <header className="sa-head">
        <div>
          <h1>Sentinel Eye</h1>
          <p>Live alert monitor</p>
        </div>
        {perm === "default" && (
          <button className="sa-ghost" onClick={enableNotifications}>
            Turn on notifications
          </button>
        )}
      </header>

      {error && <p className="sa-error">{error}</p>}

      <section className="sa-stats">
        <div><b>{stats.today}</b><span>Alerts today</span></div>
        <div><b>{stats.unreviewed}</b><span>Unreviewed</span></div>
        <div><b>{stats.critical}</b><span>Critical</span></div>
      </section>

      {live && (
        <section className="sa-live">
          <p className="sa-tag">Critical, needs review</p>
          <h2>{live.label === "violence" ? "Violence detected" : live.label}</h2>
          <p>{live.camera} at {timeOf(live.created_at)} - {Math.round(live.confidence * 100)}%</p>
          <div className="sa-row">
            <button className="sa-gold" onClick={() => setStatus(live.id, "acknowledged")}>
              Acknowledge
            </button>
            <button className="sa-ghost" onClick={() => setOpen(live)}>View details</button>
          </div>
        </section>
      )}

      <nav className="sa-chips" aria-label="Filter alerts">
        {FILTERS.map(([key, text]) => (
          <button
            key={key}
            className={filter === key ? "on" : ""}
            onClick={() => setFilter(key)}
          >
            {text}
          </button>
        ))}
      </nav>

      <ul className="sa-list">
        {alerts.length === 0 && !error && (
          <li className="sa-empty">No alerts yet. Detections will show up here as they happen.</li>
        )}
        {alerts.map((a) => (
          <li key={a.id}>
            <button onClick={() => setOpen(a)}>
              <span>
                <b>{a.label === "violence" ? "Violence detected" : a.label}</b>
                <small>{a.camera} - {timeOf(a.created_at)} - {STATUS_TEXT[a.status]}</small>
              </span>
              <em className={a.severity}>{Math.round(a.confidence * 100)}%</em>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div className="sa-sheet" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <div className="sa-card" onClick={(e) => e.stopPropagation()}>
            <h2>Alert #{open.id}</h2>
            {open.snapshot ? (
              <img src={`${API}/alerts/media/${open.snapshot}`} alt="Frame captured at detection" />
            ) : (
              <p className="sa-empty">No snapshot saved for this alert.</p>
            )}
            <dl>
              <dt>Camera</dt><dd>{open.camera}</dd>
              <dt>Time</dt><dd>{new Date(open.created_at).toLocaleString()}</dd>
              <dt>Confidence</dt><dd>{Math.round(open.confidence * 100)}%</dd>
              <dt>Status</dt><dd>{STATUS_TEXT[open.status]}</dd>
            </dl>
            <div className="sa-row">
              <button className="sa-gold" onClick={() => setStatus(open.id, "confirmed")}>Confirm</button>
              <button className="sa-ghost" onClick={() => setStatus(open.id, "false_alarm")}>False alarm</button>
            </div>
            <button className="sa-link" onClick={() => setOpen(null)}>Close</button>
          </div>
        </div>
      )}
    </main>
  );
}
