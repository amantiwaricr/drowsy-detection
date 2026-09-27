"""DrowzyGuard Flask app: configuration and API routes."""

import os

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from pymongo.errors import PyMongoError

import auth
import database
import detection
import model

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024  # webcam frames are ~20-80 KB
# Comma-separated list, e.g. "http://localhost:5173,http://127.0.0.1:5173"
CORS(app, origins=os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(","))

auth.check_config()
database.init_db()
model.load_model()  # loaded once at startup, never per frame


def error(message, code):
    """Every error response has the same shape: {"error": "..."}."""
    return jsonify({"error": message}), code


# ---------- Health ----------

@app.get("/api/health")
def health():
    db_ok = database.is_connected()
    return jsonify({
        "status": "ok",
        "database": "connected" if db_ok else "disconnected",
        "model": "loaded" if model.is_loaded() else "not found",
        "detection": "model" if model.is_loaded() else "opencv fallback",
    })


# ---------- Authentication ----------

@app.post("/api/register")
def register():
    data = request.get_json(silent=True) or {}
    return jsonify(auth.register(data.get("email"), data.get("password"))), 201


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    return jsonify(auth.login(data.get("email"), data.get("password")))


# ---------- Detection ----------

@app.post("/api/detection")
@auth.require_auth
def detect():
    data = request.get_json(silent=True) or {}
    image = detection.decode_image(data.get("image"))
    if image is None:
        return error("A valid base64-encoded image is required", 400)

    if data.get("reset"):
        detection.reset(g.user_id)
    result = detection.analyze_frame(image, g.user_id)

    record = detection.history_record(g.user_id, result)
    if record:
        try:
            database.save_detection(g.user_id, **record)
        except PyMongoError as exc:  # keep detecting even if saving fails
            print(f"[database] Could not save detection: {exc}")
    return jsonify(result)


# ---------- History ----------

@app.get("/api/history")
@auth.require_auth
def history():
    limit = min(max(request.args.get("limit", 100, type=int), 1), 500)
    return jsonify({
        "history": database.get_history(g.user_id, limit),
        "totalAlerts": database.count_alerts(g.user_id),
    })


# ---------- Error handlers ----------

@app.errorhandler(auth.AuthError)
def auth_error(exc):
    return error(exc.message, exc.code)


@app.errorhandler(PyMongoError)
def database_error(exc):
    print(f"[database] {exc}")
    return error("Database unavailable. Please try again later.", 503)


@app.errorhandler(404)
def not_found(_):
    return error("Not found", 404)


@app.errorhandler(405)
def method_not_allowed(_):
    return error("Method not allowed", 405)


@app.errorhandler(413)
def too_large(_):
    return error("Image too large", 413)


@app.errorhandler(500)
def server_error(_):
    return error("Internal server error", 500)


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
    )
