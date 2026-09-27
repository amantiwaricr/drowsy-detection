import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Detection from "./pages/Detection.jsx";
import History from "./pages/History.jsx";
import Login from "./pages/Login.jsx";
import { setToken, setUnauthorizedHandler } from "./services/api.js";

// A session is { token, user: { id, name, email } }, kept in localStorage.
function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem("session"));
    return session?.token ? session : null;
  } catch {
    return null;
  }
}

const initialSession = loadSession();
setToken(initialSession?.token ?? null);

export default function App() {
  const [session, setSession] = useState(initialSession);
  const [notice, setNotice] = useState("");

  function login(newSession) {
    localStorage.setItem("session", JSON.stringify(newSession));
    setToken(newSession.token);
    setNotice("");
    setSession(newSession);
  }

  function logout(message = "") {
    localStorage.removeItem("session");
    setToken(null);
    setNotice(message);
    setSession(null);
  }

  useEffect(() => {
    setUnauthorizedHandler((message) => logout(message));
  }, []);

  const user = session?.user;

  return (
    <BrowserRouter>
      {user ? (
        <div className="layout">
          <Navbar user={user} onLogout={() => logout()} />
          <main className="content">
            <Routes>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/detection" element={<Detection />} />
              <Route path="/history" element={<History />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login onLogin={login} notice={notice} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
