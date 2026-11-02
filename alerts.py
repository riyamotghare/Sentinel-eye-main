"""
alerts.py - drop-in alert feature for Sentinel Eye (Flask).

Adds: SQLite alert store, snapshot saving, REST endpoints, live SSE stream.
Keeps your existing CSV logging untouched.
"""
import json
import os
import queue
import sqlite3
import threading
import time
from datetime import datetime

import cv2
from flask import Blueprint, Response, jsonify, request, send_from_directory

DB_PATH = "alerts.db"
MEDIA_DIR = "alerts_media"
COOLDOWN_SEC = 2           # ignore repeat alerts from same source+label within this window
CRITICAL_CONF = 0.90       # confidence at/above this = "critical"

os.makedirs(MEDIA_DIR, exist_ok=True)
alerts_bp = Blueprint("alerts", __name__)

_subscribers = []
_sub_lock = threading.Lock()
_last_fired = {}


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with _conn() as c:
        c.execute(
            """CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                camera TEXT NOT NULL,
                label TEXT NOT NULL,
                confidence REAL NOT NULL,
                severity TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'new',
                snapshot TEXT
            )"""
        )


def _publish(alert):
    payload = json.dumps(alert)
    with _sub_lock:
        for q in list(_subscribers):
            q.put(payload)


def log_alert(camera, label, confidence, frame=None):
    """Call this from detector.py wherever you currently fire an alert / write the CSV row."""
    key = (camera, label)
    now = time.time()
    if now - _last_fired.get(key, 0) < COOLDOWN_SEC:
        return None
    _last_fired[key] = now

    created = datetime.now().isoformat(timespec="seconds")
    severity = "critical" if confidence >= CRITICAL_CONF else "warning"
    snapshot = None
    if frame is not None:
        snapshot = f"{int(now * 1000)}.jpg"
        cv2.imwrite(os.path.join(MEDIA_DIR, snapshot), frame)

    with _conn() as c:
        cur = c.execute(
            "INSERT INTO alerts (created_at, camera, label, confidence, severity, snapshot) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (created, camera, label, float(confidence), severity, snapshot),
        )
        row = c.execute("SELECT * FROM alerts WHERE id = ?", (cur.lastrowid,)).fetchone()
    alert = dict(row)
    _publish(alert)
    return alert


@alerts_bp.get("/alerts")
def list_alerts():
    sql, args = "SELECT * FROM alerts WHERE 1=1", []
    status = request.args.get("status")
    label = request.args.get("label")
    if status:
        sql += " AND status = ?"
        args.append(status)
    if label == "violence":
        sql += " AND label = 'violence'"
    elif label == "other":
        sql += " AND label != 'violence'"
    sql += " ORDER BY id DESC LIMIT ?"
    args.append(int(request.args.get("limit", 50)))
    with _conn() as c:
        return jsonify([dict(r) for r in c.execute(sql, args).fetchall()])


@alerts_bp.get("/alerts/stats")
def alert_stats():
    with _conn() as c:
        today = c.execute(
            "SELECT COUNT(*) FROM alerts WHERE date(created_at) = date('now','localtime')"
        ).fetchone()[0]
        unreviewed = c.execute("SELECT COUNT(*) FROM alerts WHERE status = 'new'").fetchone()[0]
        critical = c.execute(
            "SELECT COUNT(*) FROM alerts WHERE severity = 'critical' AND status = 'new'"
        ).fetchone()[0]
    return jsonify({"today": today, "unreviewed": unreviewed, "critical": critical})


@alerts_bp.patch("/alerts/<int:alert_id>")
def update_alert(alert_id):
    status = (request.get_json(silent=True) or {}).get("status")
    if status not in ("acknowledged", "confirmed", "false_alarm"):
        return jsonify({"error": "status must be acknowledged, confirmed or false_alarm"}), 400
    with _conn() as c:
        c.execute("UPDATE alerts SET status = ? WHERE id = ?", (status, alert_id))
        row = c.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone()
    if row is None:
        return jsonify({"error": "alert not found"}), 404
    return jsonify(dict(row))


@alerts_bp.get("/alerts/stream")
def alert_stream():
    q = queue.Queue()
    with _sub_lock:
        _subscribers.append(q)

    def gen():
        try:
            while True:
                try:
                    yield f"data: {q.get(timeout=15)}\n\n"
                except queue.Empty:
                    yield ": keepalive\n\n"
        finally:
            with _sub_lock:
                if q in _subscribers:
                    _subscribers.remove(q)

    return Response(gen(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache"})


@alerts_bp.get("/alerts/media/<path:name>")
def alert_media(name):
    return send_from_directory(os.path.abspath(MEDIA_DIR), name)
