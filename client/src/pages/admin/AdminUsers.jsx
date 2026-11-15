// Manage users: add mentors and coordinators, assign students, give extensions, deactivate accounts.
import { useState } from 'react';
import { api, endOfDay, toDateInput } from '../../api.js';
import { Avatar, EmptyState, Loading, PageHeader } from '../../components/Bits.jsx';
import Icon from '../../components/Icon.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useSession } from '../../context/Session.jsx';
import { useLiveData } from '../../hooks/useLiveData.js';

const ROLES = { student: 'Student', mentor: 'Mentor', admin: 'Coordinator' };
const EMPTY = { systemId: '', name: '', password: '', role: 'mentor' };

function AddUser({ onAdded }) {
  const showToast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { message } = await api('/admin/users', { method: 'POST', body: form });
      showToast(message);
      setForm(EMPTY);
      await onAdded();
    } catch (problem) {
      showToast(problem.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Add a user</h2>
      <p className="muted small">Mentors and coordinators cannot register themselves. Share the password with them; they can change it in Profile.</p>
      <form className="add-user" onSubmit={submit}>
        <div className="field">
          <label htmlFor="new-role">Role</label>
          <select id="new-role" name="role" value={form.role} onChange={update}>
            {Object.entries(ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="new-id">Login ID</label>
          <input id="new-id" name="systemId" value={form.systemId} onChange={update} required />
        </div>
        <div className="field">
          <label htmlFor="new-name">Full name</label>
          <input id="new-name" name="name" value={form.name} onChange={update} required />
        </div>
        <PasswordInput id="new-password" label="Starting password" value={form.password} onChange={update} minLength="8" autoComplete="new-password" />
        <button className="button" disabled={busy}><Icon name="plus" size={16} /> Add user</button>
      </form>
    </section>
  );
}

export default function AdminUsers() {
  const { user: me } = useSession();
  const showToast = useToast();
  const { data: users, error, reload } = useLiveData('/admin/users');
  const { data: batches } = useLiveData('/batches');
  const [role, setRole] = useState('all');
  const [search, setSearch] = useState('');

  async function change(user, changes) {
    try {
      const { message } = await api(`/admin/users/${user._id}`, { method: 'PATCH', body: changes });
      showToast(message);
      await reload();
    } catch (problem) {
      showToast(problem.message, 'error');
    }
  }

  if (error) return <p className="notice error">{error}</p>;
  if (!users || !batches) return <Loading />;

  const mentors = users.filter((user) => user.role === 'mentor' && user.active);
  const term = search.trim().toLowerCase();
  const visible = users.filter((user) => (role === 'all' || user.role === role)
    && (user.name.toLowerCase().includes(term) || user.systemId.toLowerCase().includes(term)));
  const counts = { all: users.length, ...Object.fromEntries(Object.keys(ROLES).map((key) => [key, users.filter((user) => user.role === key).length])) };

  return (
    <>
      <PageHeader title="Users" subtitle="Assign mentors and batches to students, give deadline extensions, and add staff." />
      <AddUser onAdded={reload} />

      <section className="card table-card">
        <div className="table-tools">
          <div className="segmented" role="tablist" aria-label="Filter by role">
            {[['all', 'All'], ['student', 'Students'], ['mentor', 'Mentors'], ['admin', 'Coordinators']].map(([value, label]) => (
              <button key={value} role="tab" aria-selected={role === value} className={role === value ? 'active' : ''} onClick={() => setRole(value)}>
                {label} <span className="muted">{counts[value]}</span>
              </button>
            ))}
          </div>
          <label className="search">
            <Icon name="search" size={16} />
            <input type="search" placeholder="Search by name or ID" aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
        </div>
        {visible.length === 0 ? <EmptyState icon="search" title="No users match this view" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>User</th><th>Role</th><th>Batch</th><th>Mentor</th><th>Extension</th><th>Status</th></tr>
              </thead>
              <tbody>
                {visible.map((user) => {
                  const isMe = user._id === me.id;
                  const isStudent = user.role === 'student';
                  return (
                    <tr key={user._id} className={user.active ? '' : 'inactive'}>
                      <td>
                        <span className="person">
                          <Avatar name={user.name} size="small" />
                          <span><strong>{user.name}{isMe && ' (you)'}</strong><span className="muted small">{user.systemId}</span></span>
                        </span>
                      </td>
                      <td>
                        <select aria-label={`Role of ${user.name}`} value={user.role} disabled={isMe} onChange={(event) => change(user, { role: event.target.value })}>
                          {Object.entries(ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </td>
                      <td>
                        {isStudent ? (
                          <select aria-label={`Batch of ${user.name}`} value={user.batch?._id ?? ''} onChange={(event) => change(user, { batch: event.target.value || null })}>
                            <option value="">No batch</option>
                            {batches.map((batch) => <option key={batch._id} value={batch._id}>{batch.name}</option>)}
                          </select>
                        ) : <span className="muted">&ndash;</span>}
                      </td>
                      <td>
                        {isStudent ? (
                          <select aria-label={`Mentor of ${user.name}`} className={user.mentor ? '' : 'warn'} value={user.mentor?._id ?? ''} onChange={(event) => change(user, { mentor: event.target.value || null })}>
                            <option value="">Unassigned</option>
                            {mentors.map((mentor) => <option key={mentor._id} value={mentor._id}>{mentor.name}</option>)}
                          </select>
                        ) : <span className="muted">&ndash;</span>}
                      </td>
                      <td>
                        {isStudent ? (
                          <span className="row nowrap">
                            <input type="date" aria-label={`Extension for ${user.name}`} value={toDateInput(user.extendedDeadline)}
                              onChange={(event) => event.target.value && change(user, { extendedDeadline: endOfDay(event.target.value) })} />
                            {user.extendedDeadline && (
                              <button className="icon-button" aria-label={`Remove extension for ${user.name}`} title="Remove extension" onClick={() => change(user, { extendedDeadline: null })}>
                                <Icon name="x" size={15} />
                              </button>
                            )}
                          </span>
                        ) : <span className="muted">&ndash;</span>}
                      </td>
                      <td>
                        <label className="switch">
                          <input type="checkbox" checked={user.active} disabled={isMe} onChange={(event) => change(user, { active: event.target.checked })} />
                          <span className="slider" aria-hidden="true" />
                          <span className="small">{user.active ? 'Active' : 'Deactivated'}</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
