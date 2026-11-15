// One student's documents for review: preview, versions, decision, messages and history.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatDay } from '../../api.js';
import { Avatar, EmptyState, Loading, ProgressBar, StatusBadge } from '../../components/Bits.jsx';
import { CommentThread, History, PdfPreview, VersionList } from '../../components/Documents.jsx';
import Icon from '../../components/Icon.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useLiveData } from '../../hooks/useLiveData.js';

const QUICK_COMMENTS = ['Signature is missing', 'Please follow the report format', 'Wrong file uploaded', 'Similarity is above 10%'];

function ReviewForm({ document, onDone }) {
  const showToast = useToast();
  const [comment, setComment] = useState('');
  const [similarity, setSimilarity] = useState(document.similarity ?? '');
  const [busy, setBusy] = useState(false);
  const isPlagiarism = document.type === 'plagiarism';

  async function review(status) {
    setBusy(true);
    try {
      const body = { status, comment };
      if (isPlagiarism && similarity !== '') body.similarity = Number(similarity);
      const { message } = await api(`/mentor/documents/${document._id}`, { method: 'PATCH', body });
      showToast(message, status === 'Rejected' ? 'error' : 'success');
      setComment('');
      await onDone();
    } catch (problem) {
      showToast(problem.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="review-form">
      {isPlagiarism && (
        <div className="field inline">
          <label htmlFor="similarity">Similarity %</label>
          <input id="similarity" type="number" min="0" max="100" step="0.1" value={similarity} onChange={(event) => setSimilarity(event.target.value)} />
          <span className={`muted small ${similarity !== '' && Number(similarity) >= 10 ? 'danger-text' : ''}`}>Must be below 10% to approve.</span>
        </div>
      )}
      <div className="quick-comments">
        {QUICK_COMMENTS.map((text) => <button key={text} type="button" className="chip" onClick={() => setComment(text)}>{text}</button>)}
      </div>
      <textarea rows="2" placeholder="Feedback for the student (needed to reject)" aria-label="Feedback" value={comment} onChange={(event) => setComment(event.target.value)} />
      <div className="row">
        <button className="button" disabled={busy || document.status === 'Approved'} onClick={() => review('Approved')}><Icon name="check" size={16} /> Approve</button>
        <button className="button danger" disabled={busy} onClick={() => review('Rejected')}><Icon name="x" size={16} /> Reject</button>
      </div>
    </div>
  );
}

export default function MentorStudent() {
  const { id } = useParams();
  const { data, error, reload } = useLiveData(`/mentor/students/${id}`);
  const [tab, setTab] = useState('report');
  const [selected, setSelected] = useState(null);

  const document = data?.documents.find((item) => item.type === tab);
  const latestNumber = document?.latest?.number;
  useEffect(() => setSelected(latestNumber ?? null), [tab, latestNumber]);

  if (error) return <p className="notice error">{error}</p>;
  if (!data) return <Loading />;
  const { student, types } = data;
  const approved = data.documents.filter((item) => item.status === 'Approved').length;

  return (
    <>
      <Link className="back-link" to="/mentor"><Icon name="back" size={15} /> Students</Link>
      <section className="card student-header">
        <Avatar name={student.name} size="large" />
        <div className="student-title">
          <h1>{student.name}</h1>
          <p className="muted">{student.systemId}</p>
        </div>
        <dl className="facts">
          <div><dt>Batch</dt><dd>{student.batch?.name ?? 'None'}</dd></div>
          <div><dt>Mentor</dt><dd>{student.mentor?.name ?? 'Unassigned'}</dd></div>
          <div><dt>Deadline</dt><dd>{student.deadline ? formatDay(student.deadline) : 'None'}{student.extendedDeadline && ' (extended)'}</dd></div>
          <div><dt>Progress</dt><dd><ProgressBar done={approved} total={Object.keys(types).length} /></dd></div>
        </dl>
      </section>

      <div className="tabs" role="tablist" aria-label="Documents">
        {Object.entries(types).map(([type, label]) => {
          const item = data.documents.find((entry) => entry.type === type);
          return (
            <button key={type} role="tab" aria-selected={tab === type} className={`tab ${tab === type ? 'active' : ''}`} onClick={() => setTab(type)}>
              <span>{label}</span>
              <StatusBadge status={item?.status} />
            </button>
          );
        })}
      </div>

      {!document ? (
        <section className="card"><EmptyState icon="file" title="Not uploaded yet">You will get a notification when the student uploads it.</EmptyState></section>
      ) : (
        <div className="doc-layout">
          <section className="card preview-card">
            <div className="card-head">
              <h2>{document.latest.originalName}</h2>
              <a className="button ghost small" href={`/api/documents/${document._id}/file?view=1&version=${selected}`} target="_blank" rel="noreferrer">
                <Icon name="eye" size={15} /> Open in new tab
              </a>
            </div>
            {selected && <PdfPreview documentId={document._id} version={selected} />}
          </section>
          <div className="side-stack">
            <section className="card">
              <div className="card-head">
                <h2>Decision</h2>
                <StatusBadge status={document.status} />
              </div>
              <ReviewForm key={`${document._id}-${document.latest.number}`} document={document} onDone={reload} />
            </section>
            <section className="card">
              <h2>Messages</h2>
              <CommentThread documentId={document._id} comments={document.comments} onSent={reload} />
            </section>
            <section className="card">
              <h2>Versions</h2>
              <VersionList documentId={document._id} versions={document.versions} selected={selected} onSelect={setSelected} />
            </section>
            <section className="card">
              <h2>Activity</h2>
              <History entries={document.history} />
            </section>
          </div>
        </div>
      )}
    </>
  );
}
