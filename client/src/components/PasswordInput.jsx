// A password box with a Show/Hide button and an optional strength meter.
import { useState } from 'react';

function strengthOf(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const LABELS = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'];

export default function PasswordInput({ value, onChange, showStrength, minLength, id = 'password', name = 'password', label = 'Password', autoComplete = 'current-password' }) {
  const [visible, setVisible] = useState(false);
  const score = strengthOf(value);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-box">
        <input id={id} name={name} type={visible ? 'text' : 'password'} value={value} autoComplete={autoComplete}
          onChange={onChange} minLength={minLength} required />
        <button type="button" className="link-button" aria-pressed={visible} onClick={() => setVisible(!visible)}>
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {showStrength && value && (
        <div className="strength" data-score={score}>
          <div className="strength-bar"><span style={{ width: `${(score / 4) * 100}%` }} /></div>
          <span className="muted small">{LABELS[score]}</span>
        </div>
      )}
    </div>
  );
}
