"""DrowzyGuard Flask app: configuration and API routes."""

import os

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app, origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")])


def error(message, code):
    """Every error response has the same shape: {"error": "..."}."""
    return jsonify({"error": message}), code


# ---------- Health ----------

@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


# ---------- Error handlers ----------

@app.errorhandler(404)
def not_found(_):
    return error("Not found", 404)


@app.errorhandler(405)
def method_not_allowed(_):
    return error("Method not allowed", 405)


@app.errorhandler(500)
def server_error(_):
    return error("Internal server error", 500)


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
    )
