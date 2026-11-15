import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Login({ onLogin }) {
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
      onLogin(await api('/auth/login', { method: 'POST', body: { systemId, password } }));
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  }

  return (
    <section className="card narrow">
      {created && !error && <p className="notice success">{created}</p>}
      {error && <p className="notice error shake" key={error}>{error}</p>}
      <h1>Log in</h1>
      <form className="stack" onSubmit={submit}>
        <label>System ID <input name="systemId" value={systemId} onChange={(e) => setSystemId(e.target.value)} required autoFocus /></label>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="button" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
      </form>
      <p className="hint">New student? <Link to="/register">Create an account</Link></p>
    </section>
  );
}
