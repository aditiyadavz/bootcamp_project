// The frame around every logged-in page: a sidebar with links for the user's role and a top bar.
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useRealtime } from '../context/Realtime.jsx';
import { useSession } from '../context/Session.jsx';
import { useTheme } from '../context/Theme.jsx';
import { Avatar } from './Bits.jsx';
import Icon from './Icon.jsx';

const NAV = {
  student: [
    { section: 'My work', links: [['/dashboard', 'Dashboard', 'home']] },
    { section: 'Account', links: [['/notifications', 'Notifications', 'bell'], ['/profile', 'Profile', 'user']] },
  ],
  mentor: [
    { section: 'Review', links: [['/mentor', 'My students', 'users']] },
    { section: 'Account', links: [['/notifications', 'Notifications', 'bell'], ['/profile', 'Profile', 'user']] },
  ],
  admin: [
    { section: 'Manage', links: [['/admin', 'Overview', 'chart'], ['/admin/users', 'Users', 'users'], ['/admin/batches', 'Batches', 'calendar'], ['/admin/audit', 'Audit log', 'log']] },
    { section: 'Review', links: [['/mentor', 'All students', 'file']] },
    { section: 'Account', links: [['/notifications', 'Notifications', 'bell'], ['/profile', 'Profile', 'user']] },
  ],
};

const ROLE_LABEL = { student: 'Student', mentor: 'Mentor', admin: 'Coordinator' };

export function ThemeButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button className="icon-button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title="Change theme">
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark"><Icon name="file" size={16} /></span>
      <span>SubmitTrack</span>
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useSession();
  const { unread, connected } = useRealtime();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <Brand />
        <nav aria-label="Main">
          {NAV[user.role].map((group) => (
            <div key={group.section} className="nav-group">
              <p className="nav-title">{group.section}</p>
              {group.links.map(([to, label, icon]) => (
                <NavLink key={to} to={to} end onClick={() => setMenuOpen(false)}>
                  <Icon name={icon} />
                  <span>{label}</span>
                  {to === '/notifications' && unread > 0 && <span className="count">{unread}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <p className={`live ${connected ? 'on' : ''}`}>
          <span className="dot" /> {connected ? 'Live updates on' : 'Connecting...'}
        </p>
      </aside>
      {menuOpen && <button className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
          </button>
          <div className="topbar-right">
            <ThemeButton />
            <Link className={`icon-button bell ${location.pathname === '/notifications' ? 'active' : ''}`} to="/notifications" aria-label={`Notifications, ${unread} unread`}>
              <Icon name="bell" />
              {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <div className="user-chip">
              <Avatar name={user.name} size="small" />
              <span className="user-text">
                <strong>{user.name}</strong>
                <span className="muted small">{ROLE_LABEL[user.role]} &middot; {user.systemId}</span>
              </span>
            </div>
            <button className="icon-button" onClick={logout} aria-label="Log out" title="Log out">
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PublicLayout() {
  const { user } = useSession();
  return (
    <div className="public">
      <header className="public-header">
        <Brand />
        <nav className="public-nav" aria-label="Main">
          <NavLink to="/about">About</NavLink>
          {user ? <NavLink to="/">Open dashboard</NavLink> : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link className="button small" to="/register">Create account</Link>
            </>
          )}
          <ThemeButton />
        </nav>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <span>SubmitTrack: internship document submission</span>
        <span className="muted">React, Node.js, Express, MongoDB Atlas and Render</span>
      </footer>
    </div>
  );
}
