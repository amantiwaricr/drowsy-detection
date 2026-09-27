import { useState } from "react";
import { login, register } from "../services/api.js";

export default function Login({ onLogin, notice }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  function switchMode() {
    setMode(isRegister ? "login" : "register");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (isRegister && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const session = isRegister ? await register(email, password) : await login(email, password);
      onLogin(session);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="brand brand-center">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">DrowzyGuard</span>
        </div>
        <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="muted">Real-time driver drowsiness monitoring</p>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegister ? "At least 6 characters" : "Your password"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
            />
          </label>

          {notice && !error && <p className="form-notice">{notice}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Please wait…" : isRegister ? "Register" : "Login"}
          </button>
        </form>

        <p className="switch-mode">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" className="link-button" onClick={switchMode}>
            {isRegister ? "Login" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
}
