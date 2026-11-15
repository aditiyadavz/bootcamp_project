import { useState } from 'react';
import { api, formatDay } from '../api.js';
import { Avatar, PageHeader } from '../components/Bits.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { useToast } from '../components/Toast.jsx';
import { useSession } from '../context/Session.jsx';

const ROLE_LABEL = { student: 'Student', mentor: 'Mentor', admin: 'Coordinator' };

export default function Profile() {
  const { user, setUser } = useSession();
  const showToast = useToast();
  const [name, setName] = useState(user.name);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });

  async function saveName(event) {
    event.preventDefault();
    try {
      setUser(await api('/auth/me', { method: 'PATCH', body: { name } }));
      showToast('Name updated.');
    } catch (problem) {
      showToast(problem.message, 'error');
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    try {
      const { message } = await api('/auth/password', { method: 'POST', body: passwords });
      showToast(message);
      setPasswords({ currentPassword: '', newPassword: '' });
    } catch (problem) {
      showToast(problem.message, 'error');
    }
  }

  const facts = [
    ['Login ID', user.systemId],
    ['Role', ROLE_LABEL[user.role]],
    ...(user.role === 'student' ? [
      ['Batch', user.batch?.name ?? 'Not set'],
      ['Mentor', user.mentor?.name ?? 'Not assigned yet'],
      ['Deadline', user.deadline ? `${formatDay(user.deadline)}${user.extendedDeadline ? ' (extended)' : ''}` : 'Not set'],
    ] : []),
  ];

  return (
    <>
      <PageHeader title="Profile" subtitle="Your account details and password." />
      <div className="grid two">
        <section className="card">
          <div className="profile-head">
            <Avatar name={user.name} size="large" />
            <div><h2>{user.name}</h2><p className="muted">{ROLE_LABEL[user.role]}</p></div>
          </div>
          <dl className="details">{facts.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
          <form className="inline-form" onSubmit={saveName}>
            <div className="field grow">
              <label htmlFor="profile-name">Display name</label>
              <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <button className="button" disabled={name.trim() === user.name}>Save</button>
          </form>
        </section>
        <section className="card">
          <h2>Change password</h2>
          <p className="muted small">Use at least 8 characters. A mix of letters, numbers and symbols is stronger.</p>
          <form className="stack" onSubmit={changePassword}>
            <PasswordInput id="current-password" name="currentPassword" label="Current password" value={passwords.currentPassword}
              onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} />
            <PasswordInput id="new-password" name="newPassword" label="New password" value={passwords.newPassword} minLength="8" showStrength
              autoComplete="new-password" onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} />
            <button className="button">Change password</button>
          </form>
        </section>
      </div>
    </>
  );
}
