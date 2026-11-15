import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { useSession } from '../context/Session.jsx';

export function AuthAside() {
  return (
    <aside className="auth-aside">
      <h2>One place for your internship submission</h2>
      <ul>
        <li><Icon name="upload" /><span><strong>Upload once, update anytime</strong>Every version is kept until your mentor approves it.</span></li>
        <li><Icon name="zap" /><span><strong>See decisions instantly</strong>No refreshing. Updates arrive the moment they happen.</span></li>
        <li><Icon name="message" /><span><strong>Talk to your mentor</strong>Ask questions right next to each document.</span></li>
      </ul>
    </aside>
  );
}

export default function Login() {
  const { setUser } = useSession();
  const [systemId, setSystemId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const created = useLocation().state?.message;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      setUser(await api('/auth/login', { method: 'POST', body: { systemId, password } }));
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <AuthAside />
      <section className="auth-form card">
        <h1>Welcome back</h1>
        <p className="muted">Log in with your System ID or staff ID.</p>
        {created && !error && <p className="notice success">{created}</p>}
        {error && <p className="notice error shake" key={error}>{error}</p>}
        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="systemId">System ID</label>
            <input id="systemId" name="systemId" value={systemId} autoComplete="username" onChange={(e) => setSystemId(e.target.value)} required autoFocus />
          </div>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="button block" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
        </form>
        <p className="muted small">New student? <Link to="/register">Create an account</Link>. Mentors get their login from the coordinator.</p>
      </section>
    </div>
  );
}
