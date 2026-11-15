import { useCallback, useEffect, useRef, useState } from 'react';
import { api, formatDate, formatDay } from '../api.js';
import Countdown from '../components/Countdown.jsx';
import DropZone from '../components/DropZone.jsx';
import ProgressRing from '../components/ProgressRing.jsx';
import { useToast } from '../components/Toast.jsx';

const REFRESH_MS = 15000;

// Shows how far a document has moved: Uploaded, Reviewed, Approved.
function Tracker({ document }) {
  const status = document?.status;
  const steps = [
    { label: 'Uploaded', state: document ? 'done' : 'todo' },
    {
      label: status === 'Rejected' ? 'Needs changes' : 'Mentor review',
      state: status === 'Rejected' ? 'bad' : status === 'Approved' ? 'done' : status === 'Pending' ? 'now' : 'todo',
    },
    { label: 'Approved', state: status === 'Approved' ? 'done' : 'todo' },
  ];
  return (
    <ol className="tracker">
      {steps.map((step) => <li key={step.label} className={step.state}><span />{step.label}</li>)}
    </ol>
  );
}

function History({ entries }) {
  return (
    <details className="history">
      <summary>Activity ({entries.length})</summary>
      <ul>
        {[...entries].reverse().map((entry, index) => (
          <li key={index}>
            <strong>{entry.action}</strong> &middot; <span className="hint">{formatDate(entry.at)}</span>
            {entry.note && <p className="hint">{entry.note}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function DocumentCard({ type, label, document, closed, onUploaded }) {
  return (
    <section className={`card document ${document?.status === 'Rejected' ? 'attention' : ''}`}>
      <div className="document-head">
        <h2>{label}</h2>
        <span key={document?.status} className={`status pop ${document ? document.status.toLowerCase() : 'missing'}`}>
          {document ? document.status : 'Not uploaded'}
        </span>
      </div>
      <Tracker document={document} />
      {document?.comment && <p className="comment"><strong>Mentor's comment:</strong> {document.comment}</p>}
      {document && (
        <div className="file-row">
          <span className="file-name">{document.originalName}</span>
          <a href={`/api/documents/${document._id}/file?view=1`} target="_blank" rel="noreferrer">Preview</a>
          <a href={`/api/documents/${document._id}/file`}>Download</a>
        </div>
      )}
      {document?.status !== 'Approved' && !closed && (
        <DropZone type={type} label={label} replacing={Boolean(document)} onUploaded={onUploaded} />
      )}
      {document?.history?.length > 0 && <History entries={document.history} />}
    </section>
  );
}

// Tells the student the single most useful thing to do next.
function nextStep(types, documents) {
  const find = (status) => documents.find((document) => document.status === status);
  const rejected = find('Rejected');
  if (rejected) return `Next: fix your ${types[rejected.type]} and upload it again.`;
  const missing = Object.keys(types).find((type) => !documents.some((document) => document.type === type));
  if (missing) return `Next: upload your ${types[missing]}.`;
  if (find('Pending')) return 'Everything is uploaded. Your mentor will review it next.';
  return 'All your documents are approved. You are done!';
}

const CONFETTI = Array.from({ length: 24 }, (_, index) => index);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const showToast = useToast();
  const lastStatuses = useRef(null);

  const load = useCallback(async () => {
    const result = await api('/documents');
    // If a status changed since the last check, tell the student.
    if (lastStatuses.current) {
      for (const document of result.documents) {
        const before = lastStatuses.current[document._id];
        if (before && before !== document.status) {
          const label = result.types[document.type];
          showToast(`${label} was ${document.status.toLowerCase()}.`, document.status === 'Rejected' ? 'error' : 'success');
        }
      }
    }
    lastStatuses.current = Object.fromEntries(result.documents.map((document) => [document._id, document.status]));
    setData(result);
  }, [showToast]);

  useEffect(() => {
    load().catch((problem) => setError(problem.message));
    // Check for the mentor's decisions while this page is open.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load().catch(() => {});
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (error) return <p className="notice error">{error}</p>;
  if (!data) return <div className="skeleton" aria-label="Loading" />;

  const total = Object.keys(data.types).length;
  const approved = data.documents.filter((document) => document.status === 'Approved').length;
  const closed = new Date(data.deadline) < new Date();
  const allApproved = approved === total;

  return (
    <>
      {allApproved && (
        <div className="confetti" aria-hidden="true">
          {CONFETTI.map((piece) => <span key={piece} />)}
        </div>
      )}
      <section className="summary card">
        <ProgressRing done={approved} total={total} />
        <div className="summary-text">
          <h1>My documents</h1>
          <p className={allApproved ? 'next done' : 'next'}>{nextStep(data.types, data.documents)}</p>
        </div>
        <div className="summary-deadline">
          <p className="hint">Deadline: {formatDay(data.deadline)}</p>
          <Countdown deadline={data.deadline} />
        </div>
      </section>

      {Object.entries(data.types).map(([type, label]) => (
        <DocumentCard key={type} type={type} label={label} closed={closed} onUploaded={load}
          document={data.documents.find((document) => document.type === type)} />
      ))}
    </>
  );
}
