// Batches and their deadlines.
import { useState } from 'react';
import { api, endOfDay, formatDay, toDateInput } from '../../api.js';
import { EmptyState, Loading, PageHeader } from '../../components/Bits.jsx';
import Icon from '../../components/Icon.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useLiveData } from '../../hooks/useLiveData.js';

export default function AdminBatches() {
  const showToast = useToast();
  const { data: batches, error, reload } = useLiveData('/batches');
  const { data: users } = useLiveData('/admin/users');
  const [form, setForm] = useState({ name: '', deadline: '' });

  async function run(path, options) {
    try {
      const { message } = await api(path, options);
      showToast(message);
      await reload();
      return true;
    } catch (problem) {
      showToast(problem.message, 'error');
      return false;
    }
  }

  async function create(event) {
    event.preventDefault();
    if (await run('/admin/batches', { method: 'POST', body: { name: form.name, deadline: endOfDay(form.deadline) } })) {
      setForm({ name: '', deadline: '' });
    }
  }

  function remove(batch) {
    if (window.confirm(`Delete the batch "${batch.name}"? This cannot be undone.`)) run(`/admin/batches/${batch._id}`, { method: 'DELETE' });
  }

  if (error) return <p className="notice error">{error}</p>;
  if (!batches || !users) return <Loading />;
  const studentsIn = (batch) => users.filter((user) => user.batch?._id === batch._id).length;

  return (
    <>
      <PageHeader title="Batches" subtitle="Each batch has one deadline. Students choose their batch when they register." />
      <div className="batches-layout">
        <section className="card">
          <h2>New batch</h2>
          <form className="stack" onSubmit={create}>
            <div className="field">
              <label htmlFor="batch-name">Name</label>
              <input id="batch-name" placeholder="For example B.Tech CSE 2026" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="batch-deadline">Deadline (end of day, India time)</label>
              <input id="batch-deadline" type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} required />
            </div>
            <button className="button block"><Icon name="plus" size={16} /> Create batch</button>
          </form>
        </section>

        <section className="card table-card">
          {batches.length === 0 ? <EmptyState icon="calendar" title="No batches yet">Create the first batch to set a deadline.</EmptyState> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Batch</th><th>Deadline</th><th>Students</th><th>Status</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {batches.map((batch) => {
                    const open = new Date(batch.deadline) > new Date();
                    return (
                      <tr key={batch._id}>
                        <td><strong>{batch.name}</strong></td>
                        <td>
                          <input type="date" aria-label={`Deadline for ${batch.name}`} value={toDateInput(batch.deadline)}
                            onChange={(event) => event.target.value && run(`/admin/batches/${batch._id}`, { method: 'PATCH', body: { deadline: endOfDay(event.target.value) } })} />
                        </td>
                        <td>{studentsIn(batch)}</td>
                        <td>{open ? <span className="status approved">Open until {formatDay(batch.deadline)}</span> : <span className="status rejected">Closed</span>}</td>
                        <td>
                          <button className="icon-button" aria-label={`Delete ${batch.name}`} title="Delete batch" onClick={() => remove(batch)}>
                            <Icon name="trash" size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
