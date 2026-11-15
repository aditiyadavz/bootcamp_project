import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatDay } from '../api.js';
import PasswordInput from '../components/PasswordInput.jsx';
import { AuthAside } from './Login.jsx';

export default function Register() {
  const [form, setForm] = useState({ systemId: '', name: '', password: '', batch: '' });
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  useEffect(() => {
    api('/batches').then(setBatches).catch(() => setBatches([]));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { message } = await api('/auth/register', { method: 'POST', body: form });
      navigate('/login', { state: { message } });
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <AuthAside />
      <section className="auth-form card">
        <h1>Create your student account</h1>
        <p className="muted">Use your university System ID. Your coordinator assigns your mentor.</p>
        {error && <p className="notice error shake" key={error}>{error}</p>}
        <form className="stack" onSubmit={submit}>
          <div className="grid two tight">
            <div className="field">
              <label htmlFor="systemId">System ID</label>
              <input id="systemId" name="systemId" value={form.systemId} autoComplete="username" onChange={update} required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" value={form.name} autoComplete="name" onChange={update} required />
            </div>
          </div>
          {batches.length > 0 && (
            <div className="field">
              <label htmlFor="batch">Batch</label>
              <select id="batch" name="batch" value={form.batch} onChange={update} required>
                <option value="">Choose your batch</option>
                {batches.map((batch) => <option key={batch._id} value={batch._id}>{batch.name} (deadline {formatDay(batch.deadline)})</option>)}
              </select>
            </div>
          )}
          <PasswordInput value={form.password} onChange={update} minLength="8" showStrength autoComplete="new-password" />
          <button className="button block" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
        </form>
        <p className="muted small">Already registered? <Link to="/login">Log in</Link></p>
      </section>
    </div>
  );
}
