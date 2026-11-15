// The public landing page.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge, Tracker } from '../components/Bits.jsx';
import Icon from '../components/Icon.jsx';

const STEPS = [
  { title: 'Upload', text: 'Drag in your three documents as PDFs. Every new upload is saved as a version.', status: null, note: 'Ready to upload' },
  { title: 'Review', text: 'Your assigned mentor previews each file in the browser and approves or rejects it.', status: 'Pending', note: 'Waiting for your mentor' },
  { title: 'Fix and finish', text: 'Decisions arrive instantly. A rejection always says what to fix, so you can reply and upload again.', status: 'Approved', note: 'Approved by your mentor' },
];

const FEATURES = [
  ['zap', 'Instant updates', 'Decisions and messages appear the moment they happen, using WebSockets.'],
  ['layers', 'Version history', 'Every upload is kept, so mentors can compare a new file with the last one.'],
  ['message', 'Document chat', 'Students and mentors discuss each document in one place.'],
  ['chart', 'Live analytics', 'Coordinators see progress, mentor workload and daily uploads in charts.'],
  ['shield', 'Secure by design', 'Hashed passwords, signed sessions, role checks and validated input.'],
  ['cloud', 'Runs on the cloud', 'Hosted on Render with data in MongoDB Atlas, deployed by GitHub Actions.'],
];

const ROLES = [
  ['user', 'Students', 'Upload documents, track every decision and see the deadline count down.'],
  ['file', 'Mentors', 'Review assigned students, preview PDFs, check plagiarism scores and leave feedback.'],
  ['chart', 'Coordinators', 'Create batches and deadlines, assign mentors, give extensions and export reports.'],
];

export default function Home() {
  const [active, setActive] = useState(2);
  const step = STEPS[active];

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><Icon name="cloud" size={14} /> Cloud internship portal</span>
          <h1>Every internship document, submitted, reviewed and tracked in one place.</h1>
          <p className="lead">
            SubmitTrack replaces scattered forms and follow-up messages. Students upload, mentors review,
            and coordinators see the whole batch at a glance.
          </p>
          <div className="row">
            <Link className="button large" to="/register">Create a student account <Icon name="arrow" size={16} /></Link>
            <Link className="button large ghost" to="/login">Log in</Link>
          </div>
          <ul className="hero-points">
            <li><Icon name="check" size={15} /> Final report</li>
            <li><Icon name="check" size={15} /> Plagiarism report</li>
            <li><Icon name="check" size={15} /> Completion certificate</li>
          </ul>
        </div>

        <div className="hero-visual" aria-live="polite">
          <div className="mock-card">
            <div className="mock-head">
              <strong>Plagiarism Report</strong>
              <StatusBadge key={active} status={step.status} />
            </div>
            <Tracker status={step.status} />
            <p className="muted small">{step.note}</p>
          </div>
          <div className="mock-card mock-chat">
            <span className="bubble-meta"><strong>Mentor</strong><span className="role-tag">mentor</span></span>
            <p>Similarity is 6%. Approved. Well done!</p>
          </div>
          <div className="steps">
            {STEPS.map((item, index) => (
              <button key={item.title} className={`step ${index === active ? 'active' : ''}`} aria-pressed={index === active} onClick={() => setActive(index)}>
                <span className="step-number">{index + 1}</span>
                <span><strong>{item.title}</strong><span className="muted small">{item.text}</span></span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="roles-title">
        <h2 id="roles-title" className="section-title">Built for three roles</h2>
        <div className="grid three">
          {ROLES.map(([icon, title, text]) => (
            <article key={title} className="card feature">
              <span className="feature-icon"><Icon name={icon} /></span>
              <div><h3>{title}</h3><p className="muted">{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="features-title">
        <h2 id="features-title" className="section-title">What it does</h2>
        <div className="grid three">
          {FEATURES.map(([icon, title, text]) => (
            <article key={title} className="card feature">
              <span className="feature-icon"><Icon name={icon} /></span>
              <div><h3>{title}</h3><p className="muted">{text}</p></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
