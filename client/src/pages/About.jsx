// Explains how the system is built. Useful during a demonstration.
import Icon from '../components/Icon.jsx';

const LAYERS = [
  ['Browser', 'React single page app', ['Pages for three roles', 'Socket.IO client for live updates', 'Recharts for analytics']],
  ['Render (PaaS)', 'Node.js and Express', ['REST API with role checks', 'Socket.IO server', 'Zod input validation']],
  ['MongoDB Atlas (DBaaS)', 'Managed database', ['Users, batches, documents', 'GridFS for PDF files', 'Notifications and audit log']],
];

const STACK = [
  ['Frontend', 'React 19, React Router, Vite, Recharts, Socket.IO client'],
  ['Backend', 'Node.js, Express 5, Socket.IO, Multer, Zod'],
  ['Database', 'MongoDB Atlas with Mongoose and GridFS'],
  ['Security', 'bcrypt, JWT in HttpOnly cookies, Helmet, rate limiting'],
  ['DevOps', 'GitHub Actions CI, Docker, Render auto-deploy'],
  ['Testing', 'Node test runner, Supertest, Playwright'],
];

export default function About() {
  return (
    <div className="about">
      <section className="about-intro">
        <span className="eyebrow"><Icon name="info" size={14} /> How it works</span>
        <h1>A full stack cloud application</h1>
        <p className="lead">
          SubmitTrack is built with the MERN stack and runs entirely on managed cloud services on their free plans.
          Every request passes through the same three layers.
        </p>
      </section>

      <div className="architecture">
        {LAYERS.map(([title, subtitle, items], index) => (
          <div key={title} className="arch-step">
            <article className="card arch-card">
              <span className="arch-number">{index + 1}</span>
              <h3>{title}</h3>
              <p className="muted small">{subtitle}</p>
              <ul>{items.map((item) => <li key={item}><Icon name="check" size={14} />{item}</li>)}</ul>
            </article>
            {index < LAYERS.length - 1 && <span className="arch-arrow" aria-hidden="true"><Icon name="arrow" size={22} /></span>}
          </div>
        ))}
      </div>

      <div className="grid two">
        <section className="card">
          <h2>Technology stack</h2>
          <dl className="details">
            {STACK.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>
        <section className="card">
          <h2>From code to cloud</h2>
          <ol className="flow">
            <li><strong>Push</strong> code to GitHub.</li>
            <li><strong>Test:</strong> GitHub Actions runs the API, real-time and browser tests, and builds the Docker image.</li>
            <li><strong>Deploy:</strong> Render builds and releases the new version only after the checks pass.</li>
            <li><strong>Monitor:</strong> Render calls the health check, and request logs record every API call.</li>
            <li><strong>Remind:</strong> a scheduled GitHub Actions job triggers deadline reminders every day.</li>
          </ol>
          <a className="button ghost small" href="/api/docs" target="_blank" rel="noreferrer"><Icon name="book" size={15} /> Open the API documentation</a>
        </section>
      </div>
    </div>
  );
}
