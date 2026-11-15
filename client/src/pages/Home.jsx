// The first page visitors see. The three steps can be clicked to explain the process.
import { useState } from 'react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    title: 'Upload',
    text: 'Drag in your three documents as PDF files. If you make a mistake, you can replace a file until it is approved.',
    status: 'Not uploaded',
    statusClass: 'missing',
    note: 'plagiarism_report.pdf is ready to upload',
  },
  {
    title: 'Get reviewed',
    text: 'Your mentor sees every submission on one dashboard, opens the files and makes a decision.',
    status: 'Pending',
    statusClass: 'pending',
    note: 'Waiting for your mentor',
  },
  {
    title: 'Track and fix',
    text: 'The decision appears on your page without a refresh. A rejected file always comes with a comment explaining what to fix.',
    status: 'Approved',
    statusClass: 'approved',
    note: 'Approved by your mentor',
  },
];

export default function Home() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <>
      <section className="hero">
        <div>
          <h1>Submit your internship documents. Always know where they stand.</h1>
          <p className="hero-text">
            One place for your final report, plagiarism report and completion certificate.
            See each decision and what to fix, well before the deadline.
          </p>
          <div className="row">
            <Link className="button large" to="/register">Create an account</Link>
            <Link className="button large ghost" to="/login">Log in</Link>
          </div>
        </div>
        <div className="mock" aria-live="polite">
          <p className="mock-title">Plagiarism Report</p>
          <span key={step.status} className={`status pop ${step.statusClass}`}>{step.status}</span>
          <p className="hint">{step.note}</p>
          <div className="mock-track">
            {STEPS.map((item, index) => <span key={item.title} className={index <= active ? 'on' : ''} />)}
          </div>
        </div>
      </section>

      <section aria-label="How it works">
        <h2 className="section-title">How it works</h2>
        <div className="steps">
          {STEPS.map((item, index) => (
            <button key={item.title} className={`step-card ${index === active ? 'active' : ''}`}
              aria-pressed={index === active} onClick={() => setActive(index)}>
              <span className="step-number">{index + 1}</span>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
