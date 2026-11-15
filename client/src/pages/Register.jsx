import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Register() {
  const [form, setForm] = useState({ systemId: '', name: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

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
    <section className="card narrow">
      {error && <p className="notice error shake" key={error}>{error}</p>}
      <h1>Create a student account</h1>
      <form className="stack" onSubmit={submit}>
        <label>System ID <input name="systemId" value={form.systemId} onChange={update} required autoFocus /></label>
        <label>Full name <input name="name" value={form.name} onChange={update} required /></label>
        <PasswordInput value={form.password} onChange={update} minLength="8" showStrength />
        <button className="button" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
      </form>
      <p className="hint">Already registered? <Link to="/login">Log in</Link></p>
    </section>
  );
}
