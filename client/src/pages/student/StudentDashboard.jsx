import { Link } from 'react-router-dom';
import { formatDay, timeAgo } from '../../api.js';
import { EmptyState, Loading, PageHeader, StatusBadge, Tracker } from '../../components/Bits.jsx';
import Countdown from '../../components/Countdown.jsx';
import DropZone from '../../components/DropZone.jsx';
import Icon from '../../components/Icon.jsx';
import ProgressRing from '../../components/ProgressRing.jsx';
import { useSession } from '../../context/Session.jsx';
import { useLiveData } from '../../hooks/useLiveData.js';

// Tells the student the single most useful thing to do next.
function nextStep(types, documents) {
  const rejected = documents.find((document) => document.status === 'Rejected');
  if (rejected) return { tone: 'bad', text: `Fix your ${rejected.label} and upload a new version.` };
  const missing = Object.keys(types).find((type) => !documents.some((document) => document.type === type));
  if (missing) return { tone: 'todo', text: `Upload your ${types[missing]}.` };
  if (documents.some((document) => document.status === 'Pending')) return { tone: 'wait', text: 'Everything is uploaded. Your mentor will review it next.' };
  return { tone: 'done', text: 'All your documents are approved. You are done!' };
}

const CONFETTI = Array.from({ length: 24 }, (_, index) => index);

export default function StudentDashboard() {
  const { user } = useSession();
  const { data, error, reload } = useLiveData('/documents');

  if (error) return <p className="notice error">{error}</p>;
  if (!data) return <Loading />;

  const total = Object.keys(data.types).length;
  const approved = data.documents.filter((document) => document.status === 'Approved').length;
  const closed = data.deadline && new Date(data.deadline) < new Date();
  const next = nextStep(data.types, data.documents);

  return (
    <>
      {approved === total && <div className="confetti" aria-hidden="true">{CONFETTI.map((piece) => <span key={piece} />)}</div>}
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Your internship documents at a glance." />

      <div className="summary-grid">
        <section className="card summary">
          <ProgressRing done={approved} total={total} />
          <div>
            <p className="eyebrow">Next step</p>
            <p className={`next ${next.tone}`}>{next.text}</p>
            <div className="chips">
              <span className="chip-static"><Icon name="calendar" size={14} /> {user.batch?.name ?? 'No batch'}</span>
              <span className="chip-static"><Icon name="user" size={14} /> Mentor: {user.mentor?.name ?? 'not assigned yet'}</span>
            </div>
          </div>
        </section>
        <section className="card deadline-card">
          <p className="eyebrow">Deadline</p>
          {data.deadline ? (
            <>
              <strong className="deadline-date">{formatDay(data.deadline)}</strong>
              <Countdown deadline={data.deadline} />
              {user.extendedDeadline && <p className="muted small">Includes your extension.</p>}
            </>
          ) : <p className="muted">No deadline has been set for your batch yet.</p>}
        </section>
      </div>

      <div className="grid three">
        {Object.entries(data.types).map(([type, label]) => {
          const document = data.documents.find((item) => item.type === type);
          return (
            <section key={type} className={`card doc-card ${document?.status === 'Rejected' ? 'attention' : ''}`}>
              <div className="doc-card-head">
                <h2>{label}</h2>
                <StatusBadge status={document?.status} />
              </div>
              <Tracker status={document?.status} />
              {document ? (
                <p className="doc-meta">
                  <Icon name="file" size={15} />
                  <span><strong>{document.latest.originalName}</strong>
                    <span className="muted small"> &middot; v{document.latest.number} &middot; {timeAgo(document.latest.uploadedAt)}</span></span>
                </p>
              ) : <p className="muted small doc-meta">Not uploaded yet.</p>}
              {document?.status === 'Rejected' && document.history.at(-1)?.note && (
                <p className="comment"><strong>Mentor:</strong> {document.history.at(-1).note}</p>
              )}
              {document?.status !== 'Approved' && !closed && (
                <DropZone type={type} label={label} replacing={Boolean(document)} onUploaded={reload} compact />
              )}
              <Link className="card-link" to={`/documents/${type}`}>
                Open document, versions and messages <Icon name="arrow" size={15} />
              </Link>
            </section>
          );
        })}
      </div>
      {closed && <EmptyState icon="clock" title="Uploads are closed">The deadline has passed. Contact your coordinator if you need an extension.</EmptyState>}

      <div className="grid two below">
        <section className="card">
          <h2>Recent activity</h2>
          <RecentActivity documents={data.documents} />
        </section>
        <section className="card">
          <h2>Submission rules</h2>
          <ul className="rules">
            <li><Icon name="file" size={16} /><span><strong>PDF files only, up to 5 MB each.</strong> Scanned certificates must be saved as PDF.</span></li>
            <li><Icon name="shield" size={16} /><span><strong>Plagiarism must be below 10%.</strong> Your mentor enters the similarity score.</span></li>
            <li><Icon name="check" size={16} /><span><strong>The certificate must be signed</strong> by your mentor before you upload it.</span></li>
            <li><Icon name="layers" size={16} /><span><strong>You can upload new versions</strong> until a document is approved. The last 5 are kept.</span></li>
          </ul>
        </section>
      </div>
    </>
  );
}

// The latest events across all three documents, newest first.
function RecentActivity({ documents }) {
  const events = documents
    .flatMap((document) => document.history.map((entry) => ({ ...entry, label: document.label })))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 5);
  if (events.length === 0) return <p className="muted small">Your uploads and your mentor's decisions will appear here.</p>;
  return (
    <ol className="timeline">
      {events.map((event, index) => (
        <li key={index} className={event.action.toLowerCase()}>
          <span className="timeline-dot" />
          <div>
            <strong>{event.label}: {event.action.toLowerCase()}</strong>
            <span className="muted small"> &middot; {timeAgo(event.at)}</span>
            {event.note && <p className="muted small">{event.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
