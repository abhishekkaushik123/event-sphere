import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <span className="brand-dot" /> Event Sphere
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>Events</NavLink>
          {user?.role === 'user' && <NavLink to="/my-bookings">My bookings</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin">Admin dashboard</NavLink>}
        </nav>
        <div className="nav-user">
          {user ? (
            <>
              <span className="muted small">{user.name}{user.role === 'admin' ? ' · admin' : ''}</span>
              <button className="btn btn-ghost" onClick={() => { logout(); navigate('/'); }}>Log out</button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">Log in</Link>
              <Link className="btn" to="/register">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
