// Small client for the Flask backend. Every function returns the parsed JSON
// or throws an Error whose message can be shown to the user.
import { API_URL } from "../config.js";

let token = null;
let onUnauthorized = () => {};

export function setToken(newToken) {
  token = newToken;
}

// Called when a logged-in request gets 401 (expired or invalid session).
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || `Request failed (${response.status})`;
    if (response.status === 401 && token) onUnauthorized(message);
    throw new Error(message);
  }
  return data;
}

export function getHealth() {
  return request("/api/health");
}

// Both return { token, user: { id, name, email } }.
export function login(email, password) {
  return request("/api/login", { method: "POST", body: { email, password } });
}

export function register(email, password) {
  return request("/api/register", { method: "POST", body: { email, password } });
}

// Send one webcam frame (a data URL). `reset` starts a fresh score window.
export function detectFrame(image, reset = false) {
  return request("/api/detection", { method: "POST", body: { image, reset } });
}

// Returns { history: [{ id, score, status, alert, timestamp }], totalAlerts }.
export function getHistory(limit = 100) {
  return request(`/api/history?limit=${limit}`);
}
