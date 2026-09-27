"""Registration, login, password hashing and JWT tokens."""

import os
import re
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

import database

TOKEN_LIFETIME = timedelta(days=7)
MIN_PASSWORD_LENGTH = 6
MAX_PASSWORD_LENGTH = 128
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthError(Exception):
    """Raised for user-facing auth problems; app.py turns it into a JSON error."""

    def __init__(self, message, code):
        super().__init__(message)
        self.message = message
        self.code = code


def _secret():
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is not set. Add it to backend/.env.")
    return secret


def check_config():
    """Fail fast at startup if the JWT secret is missing, warn if it is the placeholder."""
    if _secret() == "change-me":
        print("[auth] WARNING: JWT_SECRET is still 'change-me'. Set a long random value in backend/.env.")


# ---------- Passwords ----------

def hash_password(password):
    return generate_password_hash(password)


def verify_password(password_hash, password):
    return check_password_hash(password_hash, password)


# ---------- Tokens ----------

def create_token(user_id):
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "iat": now, "exp": now + TOKEN_LIFETIME}
    return jwt.encode(payload, _secret(), algorithm="HS256")


def require_auth(view):
    """Route decorator: requires 'Authorization: Bearer <token>' and sets g.user_id."""

    @wraps(view)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify({"error": "Please log in"}), 401
        try:
            payload = jwt.decode(
                header[len("Bearer "):], _secret(), algorithms=["HS256"],
                options={"require": ["sub", "exp"]},
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Your session has expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid session. Please log in again."}), 401
        g.user_id = payload["sub"]
        return view(*args, **kwargs)

    return wrapper


# ---------- Register / login ----------

def _clean(email, password):
    email = email.strip().lower() if isinstance(email, str) else ""
    password = password if isinstance(password, str) else ""
    return email, password


def _session(user_id, name, email):
    return {"token": create_token(user_id), "user": {"id": user_id, "name": name, "email": email}}


def register(email, password):
    email, password = _clean(email, password)
    if not EMAIL_PATTERN.match(email):
        raise AuthError("Please enter a valid email address", 400)
    if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        raise AuthError(f"Password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters", 400)

    name = email.split("@")[0]
    user_id = database.create_user(name, email, hash_password(password))
    if user_id is None:
        raise AuthError("An account with this email already exists", 409)
    return _session(user_id, name, email)


def login(email, password):
    email, password = _clean(email, password)
    user = database.find_user_by_email(email) if email and password else None
    # Same message for unknown email and wrong password, so accounts can't be probed.
    if not user or not verify_password(user["password"], password):
        raise AuthError("Invalid email or password", 401)
    return _session(str(user["_id"]), user["name"], user["email"])
