// A live countdown to the deadline that updates every second.
import { useEffect, useState } from 'react';

export default function Countdown({ deadline }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer); // Stop the timer when the page closes.
  }, []);

  const secondsLeft = Math.floor((new Date(deadline) - now) / 1000);
  if (secondsLeft <= 0) return <p className="closed">Uploads are closed</p>;

  const parts = [
    ['Days', Math.floor(secondsLeft / 86400)],
    ['Hours', Math.floor(secondsLeft / 3600) % 24],
    ['Mins', Math.floor(secondsLeft / 60) % 60],
    ['Secs', secondsLeft % 60],
  ];

  return (
    <div className="countdown" role="timer" aria-label={`${parts[0][1]} days ${parts[1][1]} hours left`}>
      {parts.map(([label, value]) => (
        <div key={label} className="countdown-part">
          <strong>{String(value).padStart(2, '0')}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
