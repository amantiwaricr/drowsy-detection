"""DrowzyGuard Flask app: configuration and API routes."""

import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

import database
import detection
import model

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024  # webcam frames are ~20-80 KB
# Comma-separated list, e.g. "http://localhost:5173,http://127.0.0.1:5173"
CORS(app, origins=os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(","))

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


# ---------- Detection ----------

@app.post("/api/detection")
def detect():
    data = request.get_json(silent=True) or {}
    image = detection.decode_image(data.get("image"))
    if image is None:
        return error("A valid base64-encoded image is required", 400)

    user_key = "demo"  # replaced by the logged-in user's id in Phase 8
    if data.get("reset"):
        detection.reset(user_key)
    return jsonify(detection.analyze_frame(image, user_key))


# ---------- Error handlers ----------

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
