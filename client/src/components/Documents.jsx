// Pieces for working with one document: the PDF preview, versions, messages and history.
import { useState } from 'react';
import { api, formatDate, formatSize, timeAgo } from '../api.js';
import { useSession } from '../context/Session.jsx';
import Icon from './Icon.jsx';
import { useToast } from './Toast.jsx';

export function PdfPreview({ documentId, version }) {
  return (
    <div className="pdf-frame">
      {/* The part after # asks the browser's PDF viewer to fit the page width and hide its toolbar. */}
      <iframe title={`PDF preview, version ${version}`} src={`/api/documents/${documentId}/file?view=1&version=${version}#toolbar=0&view=FitH`} />
    </div>
  );
}

export function VersionList({ documentId, versions, selected, onSelect }) {
  return (
    <ul className="versions">
      {versions.map((version) => (
        <li key={version.number} className={version.number === selected ? 'active' : ''}>
          <button className="version-main" onClick={() => onSelect(version.number)} aria-pressed={version.number === selected}>
            <span className="version-number">v{version.number}</span>
            <span className="version-text">
              <strong>{version.originalName}</strong>
              <span className="muted small">{formatSize(version.size)} &middot; {formatDate(version.uploadedAt)}</span>
            </span>
          </button>
          <a className="icon-button" href={`/api/documents/${documentId}/file?version=${version.number}`} aria-label={`Download version ${version.number}`} title="Download">
            <Icon name="download" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function CommentThread({ documentId, comments, onSent }) {
  const { user } = useSession();
  const showToast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/documents/${documentId}/comments`, { method: 'POST', body: { text } });
      setText('');
      await onSent?.();
    } catch (problem) {
      showToast(problem.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="thread">
      {comments.length === 0 ? <p className="muted small">No messages yet. Questions about this document go here.</p> : (
        <ul>
          {comments.map((comment) => (
            <li key={comment._id} className={`bubble ${comment.author === user.id ? 'mine' : ''}`}>
              <span className="bubble-meta">
                <strong>{comment.author === user.id ? 'You' : comment.authorName}</strong>
                <span className="role-tag">{comment.authorRole === 'admin' ? 'coordinator' : comment.authorRole}</span>
                <span>{timeAgo(comment.createdAt)}</span>
              </span>
              <p>{comment.text}</p>
            </li>
          ))}
        </ul>
      )}
      <form className="thread-form" onSubmit={send}>
        <textarea rows="2" value={text} maxLength="1000" placeholder="Write a message" aria-label="Message"
          onChange={(event) => setText(event.target.value)} required />
        <button className="button" disabled={busy || !text.trim()}>
          <Icon name="message" size={16} /> Send
        </button>
      </form>
    </div>
  );
}

export function History({ entries }) {
  if (!entries?.length) return <p className="muted small">Nothing has happened yet.</p>;
  return (
    <ol className="timeline">
      {[...entries].reverse().map((entry, index) => (
        <li key={index} className={entry.action.toLowerCase()}>
          <span className="timeline-dot" />
          <div>
            <strong>{entry.action}</strong>
            {entry.by && <span className="muted"> by {entry.by}</span>}
            <span className="muted small"> &middot; {formatDate(entry.at)}</span>
            {entry.note && <p className="muted small">{entry.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
