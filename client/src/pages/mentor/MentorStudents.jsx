// The mentor's list of students (all students for a coordinator), with filters and search.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDay, timeAgo } from '../../api.js';
import { Avatar, EmptyState, Loading, PageHeader, ProgressBar, StatusBadge } from '../../components/Bits.jsx';
import Icon from '../../components/Icon.jsx';
import { useSession } from '../../context/Session.jsx';
import { useLiveData } from '../../hooks/useLiveData.js';

const SHORT = { report: 'Report', plagiarism: 'Plagiarism', certificate: 'Certificate' };
const count = (student, status) => student.documents.filter((document) => document.status === status).length;

// Each filter decides whether a student is shown.
const FILTERS = {
  all: { label: 'All students', test: () => true },
  pending: { label: 'Need review', test: (student) => count(student, 'Pending') > 0 },
  rejected: { label: 'Have rejections', test: (student) => count(student, 'Rejected') > 0 },
  missing: { label: 'Missing files', test: (student, total) => student.documents.length < total },
  complete: { label: 'All approved', test: (student, total) => count(student, 'Approved') === total },
};

export default function MentorStudents() {
  const { user } = useSession();
  const { data, error } = useLiveData('/mentor/students');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  if (error) return <p className="notice error">{error}</p>;
  if (!data) return <Loading />;

  const types = Object.entries(data.types);
  const total = types.length;
  const term = search.trim().toLowerCase();
  const visible = data.students.filter((student) => FILTERS[filter].test(student, total)
    && (student.name.toLowerCase().includes(term) || student.systemId.toLowerCase().includes(term)));
  const isAdmin = user.role === 'admin';

  return (
    <>
      <PageHeader title={isAdmin ? 'All students' : 'My students'}
        subtitle={isAdmin ? 'Every student in every batch. Open a student to review their documents.' : 'Students assigned to you. Open a student to review their documents.'} />

      <div className="stats">
        {Object.entries(FILTERS).map(([key, item]) => (
          <button key={key} className={`stat ${filter === key ? 'active' : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>
            <strong>{data.students.filter((student) => item.test(student, total)).length}</strong>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <section className="card table-card">
        <div className="table-tools">
          <label className="search">
            <Icon name="search" size={16} />
            <input type="search" placeholder="Search by name or System ID" aria-label="Search students" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <span className="muted small">{visible.length} of {data.students.length} shown</span>
        </div>
        {data.students.length === 0 ? (
          <EmptyState icon="users" title="No students yet">
            {isAdmin ? 'Students appear here after they register.' : 'The coordinator has not assigned any students to you yet.'}
          </EmptyState>
        ) : visible.length === 0 ? <EmptyState icon="search" title="No students match this view" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Batch</th>
                  {isAdmin && <th>Mentor</th>}
                  <th>Deadline</th>
                  {types.map(([type]) => <th key={type}>{SHORT[type]}</th>)}
                  <th>Approved</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map((student) => (
                  <tr key={student._id}>
                    <td>
                      <Link className="person" to={`/mentor/students/${student._id}`}>
                        <Avatar name={student.name} size="small" />
                        <span><strong>{student.name}</strong><span className="muted small">{student.systemId}</span></span>
                      </Link>
                    </td>
                    <td>{student.batch?.name ?? <span className="muted">None</span>}</td>
                    {isAdmin && <td>{student.mentor?.name ?? <span className="status rejected">Unassigned</span>}</td>}
                    <td className="nowrap">{student.deadline ? formatDay(student.deadline) : <span className="muted">None</span>}</td>
                    {types.map(([type]) => (
                      <td key={type}><StatusBadge status={student.documents.find((document) => document.type === type)?.status} /></td>
                    ))}
                    <td><ProgressBar done={count(student, 'Approved')} total={total} /></td>
                    <td><Link className="button small ghost" to={`/mentor/students/${student._id}`}>Review</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.students.length > 0 && (
        <div className="grid two">
          <ReviewQueue students={data.students} />
          <ProgressByType students={data.students} types={types} />
        </div>
      )}
    </>
  );
}

// Documents waiting for a decision, oldest first, so nobody waits too long.
function ReviewQueue({ students }) {
  const queue = students
    .flatMap((student) => student.documents.filter((document) => document.status === 'Pending').map((document) => ({ student, document })))
    .sort((a, b) => new Date(a.document.latest.uploadedAt) - new Date(b.document.latest.uploadedAt))
    .slice(0, 6);
  return (
    <section className="card">
      <div className="card-head"><h2>Waiting for review</h2><span className="muted small">Oldest first</span></div>
      {queue.length === 0 ? <EmptyState icon="check" title="Nothing waiting">Every uploaded document has a decision.</EmptyState> : (
        <ul className="queue">
          {queue.map(({ student, document }) => (
            <li key={document._id}>
              <Link to={`/mentor/students/${student._id}`}>
                <Avatar name={student.name} size="small" />
                <span className="queue-text"><strong>{student.name}</strong><span className="muted small">{document.label} &middot; v{document.latest.number}</span></span>
                <span className="muted small nowrap">{timeAgo(document.latest.uploadedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProgressByType({ students, types }) {
  return (
    <section className="card">
      <div className="card-head"><h2>Approved so far</h2><span className="muted small">{students.length} students</span></div>
      <ul className="type-progress">
        {types.map(([type, label]) => {
          const approved = students.filter((student) => student.documents.some((document) => document.type === type && document.status === 'Approved')).length;
          const uploaded = students.filter((student) => student.documents.some((document) => document.type === type)).length;
          return (
            <li key={type}>
              <span className="type-row"><strong>{label}</strong><span className="muted small">{approved} approved &middot; {uploaded} uploaded</span></span>
              <ProgressBar done={approved} total={students.length} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
