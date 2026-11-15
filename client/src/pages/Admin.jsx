import { useCallback, useEffect, useState } from 'react';
import { api, formatDate, formatDay } from '../api.js';
import { useToast } from '../components/Toast.jsx';

const REFRESH_MS = 15000;
const QUICK_COMMENTS = ['Similarity is above 10%', 'Signature is missing', 'Wrong file uploaded', 'Format not followed'];

const findDocument = (student, type) => student.documents.find((item) => item.type === type);

// The key above includes the upload time, so a new upload starts with an empty comment box.
function ReviewRow({ label, document, onReview }) {
  const [comment, setComment] = useState(document?.comment ?? '');

  if (!document) {
    return (
      <li className="review-row">
        <div className="review-head"><strong>{label}</strong><span className="status missing">Not uploaded</span></div>
      </li>
    );
  }

  return (
    <li className="review-row">
      <div className="review-head">
        <strong>{label}</strong>
        <span key={document.status} className={`status pop ${document.status.toLowerCase()}`}>{document.status}</span>
      </div>
      <div className="file-row">
        <span className="file-name">{document.originalName}</span>
        <span className="hint">{formatDate(document.uploadedAt)}</span>
        <a href={`/api/documents/${document._id}/file?view=1`} target="_blank" rel="noreferrer">Preview</a>
        <a href={`/api/documents/${document._id}/file`}>Download</a>
      </div>
      {document.status !== 'Approved' && (
        <div className="quick-comments">
          {QUICK_COMMENTS.map((text) => (
            <button key={text} type="button" className="chip" onClick={() => setComment(text)}>{text}</button>
          ))}
        </div>
      )}
      <div className="review">
        <input placeholder="Write a comment (needed to reject)" aria-label={`Comment on ${label}`}
          value={comment} onChange={(event) => setComment(event.target.value)} />
        <button className="button small" disabled={document.status === 'Approved'}
          onClick={() => onReview(document._id, 'Approved', comment)}>Approve</button>
        <button className="button small danger" onClick={() => onReview(document._id, 'Rejected', comment)}>Reject</button>
      </div>
    </li>
  );
}

function StudentCard({ student, types, onReview }) {
  const total = Object.keys(types).length;
  const approved = student.documents.filter((document) => document.status === 'Approved').length;
  const needsReview = student.documents.some((document) => document.status === 'Pending');
  const [open, setOpen] = useState(needsReview);

  return (
    <section className="card student">
      <button className="student-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="avatar" aria-hidden="true">{student.name.charAt(0).toUpperCase()}</span>
        <span className="student-name"><strong>{student.name}</strong><span className="hint">{student.systemId}</span></span>
        <span className="student-progress">
          <span className="bar"><span style={{ width: `${(approved / total) * 100}%` }} /></span>
          <span className="hint">{approved}/{total} approved</span>
        </span>
        {needsReview && <span className="status pending">Needs review</span>}
        <span className={`chevron ${open ? 'open' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul className="review-list">
          {Object.entries(types).map(([type, label]) => (
            <ReviewRow key={`${type}-${findDocument(student, type)?.uploadedAt}`} label={label} onReview={onReview}
              document={findDocument(student, type)} />
          ))}
        </ul>
      )}
    </section>
  );
}

// Each filter decides whether a student should be shown.
const FILTERS = {
  all: { label: 'Students', test: () => true },
  pending: { label: 'Need review', test: (student) => student.documents.some((d) => d.status === 'Pending') },
  rejected: { label: 'Have rejections', test: (student) => student.documents.some((d) => d.status === 'Rejected') },
  missing: { label: 'Missing files', test: (student, total) => student.documents.length < total },
  complete: { label: 'All approved', test: (student, total) => student.documents.filter((d) => d.status === 'Approved').length === total },
};

export default function Admin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const showToast = useToast();

  const load = useCallback(() => api('/admin/students').then(setData), []);

  useEffect(() => {
    load().catch((problem) => setError(problem.message));
    // New uploads appear while this page is open.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load().catch(() => {});
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function review(id, status, comment) {
    try {
      const { message } = await api(`/admin/documents/${id}`, { method: 'PATCH', body: { status, comment } });
      showToast(message, status === 'Rejected' ? 'error' : 'success');
      await load();
    } catch (problem) {
      showToast(problem.message, 'error');
    }
  }

  if (error) return <p className="notice error">{error}</p>;
  if (!data) return <div className="skeleton" aria-label="Loading" />;

  const total = Object.keys(data.types).length;
  const term = search.trim().toLowerCase();
  const visible = data.students.filter((student) => FILTERS[filter].test(student, total)
    && (student.name.toLowerCase().includes(term) || student.systemId.toLowerCase().includes(term)));

  return (
    <>
      <div className="heading-row">
        <h1>Mentor dashboard</h1>
        <p className="deadline">Deadline: {formatDay(data.deadline)}</p>
      </div>

      <div className="stats">
        {Object.entries(FILTERS).map(([key, item]) => (
          <button key={key} className={`stat ${filter === key ? 'active' : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>
            <strong>{data.students.filter((student) => item.test(student, total)).length}</strong>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <input className="search" type="search" placeholder="Search by name or System ID" aria-label="Search students"
        value={search} onChange={(event) => setSearch(event.target.value)} />

      {visible.length === 0 && (
        <section className="card empty"><p>No students match this view.</p></section>
      )}
      {visible.map((student) => <StudentCard key={student._id} student={student} types={data.types} onReview={review} />)}
    </>
  );
}
