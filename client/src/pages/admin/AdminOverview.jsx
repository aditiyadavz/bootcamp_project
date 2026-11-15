// Coordinator dashboard: key numbers, three charts, CSV export, and a setup checklist for a new system.
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, Loading, PageHeader } from '../../components/Bits.jsx';
import Icon from '../../components/Icon.jsx';
import { useLiveData } from '../../hooks/useLiveData.js';

// Status colours carry meaning, so they are fixed. Each status also has a label in the legend and tooltip.
const STATUS_COLORS = { Approved: 'var(--status-good)', Pending: 'var(--status-warning)', Rejected: 'var(--status-critical)', Missing: 'var(--status-missing)' };
const STATUS_ORDER = Object.keys(STATUS_COLORS);
const axis = { stroke: 'var(--line)', tick: { fill: 'var(--muted)', fontSize: 12 }, tickLine: false };
const tooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)', fontSize: 13 },
  labelStyle: { color: 'var(--ink)', fontWeight: 600 },
  cursor: { fill: 'var(--soft)' },
};
const shortDay = (day) => new Date(`${day}T12:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function ChartCard({ title, subtitle, children, table }) {
  return (
    <section className="card chart-card">
      <div className="card-head">
        <div><h2>{title}</h2><p className="muted small">{subtitle}</p></div>
      </div>
      <div className="chart">{children}</div>
      <details className="table-view">
        <summary>Show as table</summary>
        {table}
      </details>
    </section>
  );
}

function SimpleTable({ head, rows }) {
  return (
    <table>
      <thead><tr>{head.map((cell) => <th key={cell}>{cell}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
    </table>
  );
}

function Setup({ batches, mentors, students }) {
  const steps = [
    ['Create a batch with its deadline', batches > 0, '/admin/batches'],
    ['Add mentor accounts', mentors > 0, '/admin/users'],
    ['Share the website link so students can register', students > 0, null],
    ['Assign each student to a mentor', students > 0, '/admin/users'],
  ];
  return (
    <section className="card setup">
      <h2>Get started</h2>
      <ol className="checklist">
        {steps.map(([text, done, link]) => (
          <li key={text} className={done ? 'done' : ''}>
            <span className="check"><Icon name={done ? 'check' : 'arrow'} size={14} /></span>
            {link && !done ? <Link to={link}>{text}</Link> : <span>{text}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function AdminOverview() {
  const { data, error } = useLiveData('/admin/stats');
  const batches = useLiveData('/batches');

  if (error) return <p className="notice error">{error}</p>;
  if (!data || !batches.data) return <Loading />;

  const totalDocuments = data.students * data.byType.length;
  const percent = (value) => (data.students ? Math.round((value / data.students) * 100) : 0);
  const tiles = [
    ['users', 'Students', data.students, `${data.mentors} mentor${data.mentors === 1 ? '' : 's'}`],
    ['check', 'Fully approved', data.complete, `${percent(data.complete)}% of students`],
    ['clock', 'Awaiting review', data.statusTotals.Pending, `of ${totalDocuments} documents`],
    ['alert', 'Unassigned students', data.unassigned, data.unassigned ? 'Assign a mentor in Users' : 'Everyone has a mentor'],
  ];
  const needsSetup = batches.data.length === 0 || data.mentors === 0 || data.students === 0;

  return (
    <>
      <PageHeader title="Overview" subtitle="Live progress across all batches. Updates as students upload and mentors review.">
        <a className="button" href="/api/admin/export.csv" download><Icon name="download" size={16} /> Export CSV</a>
      </PageHeader>

      <div className="tiles">
        {tiles.map(([icon, label, value, note]) => (
          <section key={label} className="card tile">
            <span className="tile-icon"><Icon name={icon} /></span>
            <div>
              <p className="muted small">{label}</p>
              <strong className="tile-value">{value}</strong>
              <p className="muted small">{note}</p>
            </div>
          </section>
        ))}
      </div>

      {needsSetup && <Setup batches={batches.data.length} mentors={data.mentors} students={data.students} />}

      {data.students === 0 ? (
        <section className="card"><EmptyState icon="chart" title="Charts appear when students register">Each chart updates live as documents are uploaded and reviewed.</EmptyState></section>
      ) : (
        <div className="grid two">
          <ChartCard title="Documents by status" subtitle={`Each bar is one document type for all ${data.students} students.`}
            table={<SimpleTable head={['Document', 'Approved', 'Pending', 'Rejected', 'Missing']} rows={data.byType.map((row) => [row.label, row.Approved, row.Pending, row.Rejected, row.Missing])} />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.byType} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="label" {...axis} tickFormatter={(label) => label.replace('Internship ', '').replace(' Report', '')} />
                <YAxis {...axis} allowDecimals={false} axisLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 13, color: 'var(--muted)' }} itemSorter={(item) => STATUS_ORDER.indexOf(item.value)} />
                {Object.entries(STATUS_COLORS).map(([status, color], index, list) => (
                  <Bar key={status} dataKey={status} stackId="status" fill={color} stroke="var(--surface)" strokeWidth={2}
                    radius={index === list.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Uploads per day" subtitle="Every new file or version in the last 14 days."
            table={<SimpleTable head={['Day', 'Uploads']} rows={data.uploadsPerDay.map((row) => [shortDay(row.day), row.uploads])} />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.uploadsPerDay} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="day" {...axis} tickFormatter={shortDay} interval={1} />
                <YAxis {...axis} allowDecimals={false} axisLine={false} />
                <Tooltip {...tooltipStyle} labelFormatter={shortDay} formatter={(value) => [value, 'Uploads']} />
                <Bar dataKey="uploads" name="Uploads" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Mentor workload" subtitle="Documents waiting for each mentor, and documents already reviewed."
            table={<SimpleTable head={['Mentor', 'Students', 'Waiting', 'Reviewed']} rows={data.mentorLoad.map((row) => [row.name, row.students, row.pending, row.reviewed])} />}>
            {data.mentorLoad.length === 0 ? <EmptyState icon="users" title="No mentors yet" /> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.mentorLoad} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="name" {...axis} />
                  <YAxis {...axis} allowDecimals={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 13, color: 'var(--muted)' }} itemSorter={(item) => (item.value === 'Waiting' ? 0 : 1)} />
                  <Bar dataKey="pending" name="Waiting" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="reviewed" name="Reviewed" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <section className="card">
            <div className="card-head"><h2>Quick links</h2></div>
            <div className="quick-links">
              <Link to="/mentor"><Icon name="file" /><span><strong>Review documents</strong><span className="muted small">See every student and decide on files</span></span></Link>
              <Link to="/admin/users"><Icon name="users" /><span><strong>Manage users</strong><span className="muted small">Add mentors, assign students, give extensions</span></span></Link>
              <Link to="/admin/batches"><Icon name="calendar" /><span><strong>Batches and deadlines</strong><span className="muted small">Create batches and move deadlines</span></span></Link>
              <Link to="/admin/audit"><Icon name="log" /><span><strong>Audit log</strong><span className="muted small">Who did what, and when</span></span></Link>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
