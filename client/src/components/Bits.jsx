// Small pieces used on many pages.
import { initials } from '../api.js';
import Icon from './Icon.jsx';

const STATUS_ICONS = { Approved: 'check', Rejected: 'x', Pending: 'clock' };

export function StatusBadge({ status }) {
  const value = status ?? 'Not uploaded';
  return (
    <span className={`status ${status ? status.toLowerCase() : 'missing'}`}>
      {STATUS_ICONS[value] && <Icon name={STATUS_ICONS[value]} size={13} />}
      {value}
    </span>
  );
}

export function Avatar({ name, size = 'medium' }) {
  return <span className={`avatar ${size}`} aria-hidden="true">{initials(name)}</span>;
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading" aria-label="Loading">
      <div className="skeleton tall" />
      <div className="skeleton" />
    </div>
  );
}

export function EmptyState({ icon = 'info', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={26} />
      <strong>{title}</strong>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

export function ProgressBar({ done, total }) {
  return (
    <span className="progress">
      <span className="bar"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></span>
      <span className="muted small">{done}/{total}</span>
    </span>
  );
}

// Shows how far a document has moved: Uploaded, Mentor review, Approved.
export function Tracker({ status }) {
  const steps = [
    { label: 'Uploaded', state: status ? 'done' : 'todo' },
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
