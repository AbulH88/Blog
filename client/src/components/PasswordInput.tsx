import { useState } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Show a strength meter below the input (skip on login forms). */
  showStrength?: boolean;
  required?: boolean;
  autoComplete?: string;
  style?: React.CSSProperties;
  /** Inline style override for the actual <input>. */
  inputStyle?: React.CSSProperties;
}

/**
 * Reusable password input — eye-toggle to reveal, optional strength meter.
 * Designed to slot into existing forms without restyling them.
 */
export default function PasswordInput({
  value, onChange, placeholder = 'Password',
  showStrength = false, required, autoComplete,
  style, inputStyle,
}: Props) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div style={style}>
      <div style={{ position: 'relative' }}>
        <input
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          style={{
            paddingRight: 44,
            width: '100%',
            padding: '12px 44px 12px 14px',
            borderRadius: 10,
            border: '1.5px solid var(--v3-line)',
            background: '#FFFAF4',
            color: 'var(--v3-ink)',
            fontFamily: 'inherit',
            fontSize: '0.92rem',
            outline: 'none',
            boxSizing: 'border-box',
            ...inputStyle,
          }}
        />
        <button
          type="button"
          onClick={() => setRevealed(r => !r)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 8, color: 'var(--v3-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {revealed ? (
            // eye-off
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            // eye
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {showStrength && value.length > 0 && <PasswordStrength password={value} />}
    </div>
  );
}

// ── Strength meter ──────────────────────────────────────────────────────────

function scorePassword(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  // Common passwords always tank the score
  const common = /^(password|12345|qwerty|letmein|abc123|111111|iloveyou|admin)/i;
  if (common.test(pw)) s = 0;

  if (s <= 1) return { score: 1, label: 'Weak',     color: '#d44b3c' };
  if (s === 2) return { score: 2, label: 'Fair',     color: '#e08a3c' };
  if (s === 3) return { score: 3, label: 'Good',     color: '#d4a93c' };
  if (s === 4) return { score: 4, label: 'Strong',   color: '#5fa84c' };
  return         { score: 4, label: 'Very strong',  color: '#3a9d52' };
}

function PasswordStrength({ password }: { password: string }) {
  const { score, label, color } = scorePassword(password);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{
        display: 'flex', gap: 4, marginBottom: 4,
      }}>
        {[1, 2, 3, 4].map(i => (
          <span
            key={i}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= score ? color : 'rgba(0,0,0,0.08)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: '0.72rem', color, fontWeight: 600 }}>
        {label}
      </p>
    </div>
  );
}
