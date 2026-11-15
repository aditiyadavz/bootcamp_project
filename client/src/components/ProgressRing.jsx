// A circle that fills up as documents are approved.
export default function ProgressRing({ done, total }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const filled = (done / total) * circumference;

  return (
    <svg className="ring" viewBox="0 0 100 100" role="img" aria-label={`${done} of ${total} approved`}>
      <circle className="ring-track" cx="50" cy="50" r={radius} />
      <circle className="ring-fill" cx="50" cy="50" r={radius}
        strokeDasharray={`${filled} ${circumference}`} transform="rotate(-90 50 50)" />
      <text x="50" y="49" textAnchor="middle" className="ring-number">{done}/{total}</text>
      <text x="50" y="66" textAnchor="middle" className="ring-label">approved</text>
    </svg>
  );
}
