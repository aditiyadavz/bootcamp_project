import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import { ToastProvider } from './components/Toast.jsx';
import Admin from './pages/Admin.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

function savedTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
  } catch {
    // Browser storage can be blocked. The system setting is used instead.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(savedTheme);

  // When the site opens, ask the server whether this browser is logged in.
  useEffect(() => {
    api('/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  // Apply the light or dark colours and remember the choice.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // The theme still works for this visit.
    }
  }, [theme]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }

  const home = !user ? '/' : user.role === 'admin' ? '/admin' : '/dashboard';

  return (
    <ToastProvider>
      <header className="topbar">
        <Link className="brand" to="/">Document Submission Portal</Link>
        <div className="account">
          {user && <span>{user.name} ({user.systemId})</span>}
          <button className="button secondary" aria-pressed={theme === 'dark'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          {user && <button className="button secondary" onClick={logout}>Log out</button>}
        </div>
      </header>
      <main className="page">
        {loading ? <div className="skeleton" aria-label="Loading" /> : (
          <Routes>
            <Route path="/" element={user ? <Navigate to={home} /> : <Home />} />
            <Route path="/login" element={user ? <Navigate to={home} /> : <Login onLogin={setUser} />} />
            <Route path="/register" element={user ? <Navigate to={home} /> : <Register />} />
            <Route path="/dashboard" element={user?.role === 'student' ? <Dashboard /> : <Navigate to={user ? home : '/login'} />} />
            <Route path="/admin" element={user?.role === 'admin' ? <Admin /> : <Navigate to={user ? home : '/login'} />} />
            <Route path="*" element={<Navigate to={home} />} />
          </Routes>
        )}
      </main>
    </ToastProvider>
  );
}
