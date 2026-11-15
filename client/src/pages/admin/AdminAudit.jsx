// The audit log: a record of important actions that cannot be edited from the website.
import { useState } from 'react';
import { formatDate } from '../../api.js';
import { EmptyState, Loading, PageHeader } from '../../components/Bits.jsx';
import Icon from '../../components/Icon.jsx';
import { useLiveData } from '../../hooks/useLiveData.js';

export default function AdminAudit() {
  const { data, error } = useLiveData('/admin/audit');
  const [search, setSearch] = useState('');

  if (error) return <p className="notice error">{error}</p>;
  if (!data) return <Loading />;
  const term = search.trim().toLowerCase();
  const visible = data.filter((entry) => `${entry.actorName} ${entry.action} ${entry.details}`.toLowerCase().includes(term));

  return (
    <>
      <PageHeader title="Audit log" subtitle="The latest 300 actions: uploads, reviews, account and batch changes, exports and reminders." />
      <section className="card table-card">
        <div className="table-tools">
          <label className="search">
            <Icon name="search" size={16} />
            <input type="search" placeholder="Search by person, action or details" aria-label="Search the audit log" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <span className="muted small">{visible.length} entries</span>
        </div>
        {visible.length === 0 ? <EmptyState icon="log" title="Nothing recorded yet" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>
                {visible.map((entry) => (
                  <tr key={entry._id}>
                    <td className="nowrap muted">{formatDate(entry.createdAt)}</td>
                    <td>{entry.actorName}</td>
                    <td><span className={`action-tag ${entry.action.split(' ')[0].toLowerCase()}`}>{entry.action}</span></td>
                    <td className="muted">{entry.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
