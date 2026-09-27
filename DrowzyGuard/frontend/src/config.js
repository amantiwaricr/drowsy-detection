// Frontend configuration. Set VITE_API_URL in frontend/.env to change the backend URL.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// How often the camera sends a frame to the backend (milliseconds).
// The next frame is only sent after the previous response arrives.
export const FRAME_INTERVAL_MS = 250;
