import { NavLink } from "react-router-dom";

const LINKS = [
  {
    to: "/",
    label: "Dashboard",
    icon: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  },
  {
    to: "/detection",
    label: "Detection",
    icon: "M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5zm0 12.5a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z",
  },
  {
    to: "/history",
    label: "History",
    icon: "M13 3a9 9 0 00-9 9H1l3.9 3.9L9 12H6a7 7 0 112.1 5l-1.4 1.4A9 9 0 1013 3zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8H12z",
  },
];

export default function Navbar({ user, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">DrowzyGuard</span>
      </div>

      <nav className="nav">
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end className="nav-link">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={link.icon} />
            </svg>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="user-email" title={user.email}>{user.email}</span>
        <button className="btn btn-ghost btn-sm" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
