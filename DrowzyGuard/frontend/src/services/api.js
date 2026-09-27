// Small client for the Flask backend. Every function returns the parsed JSON
// or throws an Error whose message can be shown to the user.
import { API_URL } from "../config.js";

async function request(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export function getHealth() {
  return request("/api/health");
}

// Send one webcam frame (a data URL). `reset` starts a fresh score window.
export function detectFrame(image, reset = false) {
  return request("/api/detection", { method: "POST", body: { image, reset } });
}
