# Admin & Auth Design Consistency Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every remaining dark-themed surface in the Admin area, Login, and Register pages to the v3 cream/terracotta design system so the app feels visually consistent end-to-end.

**Architecture:** Two strategies in parallel: (1) CSS overrides — when `body.v3` is active, restyle the legacy `av2-*` classes used inside Admin's Content and Settings tabs without touching JSX; (2) inline-style rewrites — for pages whose markup is heavy with inline dark colors (Login, Register, internal cards in AdminMessages/AdminBroadcast), replace inline `background: '#1a1a1a'` etc. with `v3-*` classes or v3 token colors.

**Tech Stack:** React 19, Vite, TypeScript, plain CSS (no framework). Existing v3 tokens live in `client/src/styles/theme-v3.css`. Legacy dark styles in `client/src/styles/main.css`.

**Surfaces to fix:**
1. Admin Settings tab cards (`renderSettings` in `Admin.tsx`)
2. Admin Content tab cards + bundle editor (`renderContent` in `Admin.tsx`)
3. Admin Messages page (`AdminMessages.tsx`) — currently driven by `isDark` prop
4. Admin Broadcast page (`AdminBroadcast.tsx`) — same pattern
5. Login page (`Login.tsx`) — dark inputs, dark backdrop
6. Register page (`Register.tsx`) — dark inputs, dark backdrop

**Out of scope:** Gallery/Blog/About pages (still dark, but not in the user's complaint scope right now — separate ticket). Old `/vip` page (already deleted).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `client/src/styles/theme-v3.css` | Source of truth for v3 visual language. Add an "Admin legacy overrides" section that restyles `av2-*` classes when nested in `.v3-admin`. | Modify (append section) |
| `client/src/pages/Admin.tsx` | Replace remaining inline dark inputs (color/file inputs in Appearance + SEO) with v3-compatible styles. Drop the bundle modal's hard-coded purple primary color in favor of terracotta. | Modify |
| `client/src/pages/AdminMessages.tsx` | Already uses `isDark` prop; force the light-side palette to match v3 cream + terracotta when in v3 context. Replace hardcoded `#7c3aed` (purple) accents with `var(--v3-terracotta)`. | Modify |
| `client/src/pages/AdminBroadcast.tsx` | Same isDark-driven palette; align with v3 tokens. Replace purple accent. | Modify |
| `client/src/pages/Login.tsx` | Rewrite inline dark backgrounds to v3 cream + replace dark inputs with v3 inputs. Use `v3-card` wrapper + `v3-btn` button. | Modify |
| `client/src/pages/Register.tsx` | Same shape as Login. | Modify |

---

## Task 1: Add legacy `av2-*` overrides for v3 admin context

**Files:**
- Modify: `client/src/styles/theme-v3.css` (append a new section before the responsive media queries near line 1100)

- [ ] **Step 1: Open theme-v3.css and find the `/* ───── Responsive ──── */` section anchor**

Run: `grep -n "Responsive" client/src/styles/theme-v3.css`
Expected: a single line number for the `/* ───── Responsive ────────────────────────────────────────── */` heading.

- [ ] **Step 2: Insert the override block immediately before that Responsive section**

Add this CSS verbatim:

```css
/* ───── Legacy av2-* overrides inside V3 admin ────────────────
   The new V3 admin shell wraps everything in .v3-admin. Until
   every Admin tab is rewritten to v3 classes, override the
   dark av2-* defaults from main.css when nested in the v3 shell.
   These overrides REPLACE the inherited dark styles.
   ──────────────────────────────────────────────────────────── */
.v3-admin .av2-card {
  background: #fff;
  border: 1px solid var(--v3-line);
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 18px;
  box-shadow: var(--v3-shadow-sm);
}
.v3-admin .av2-section-label {
  font-family: var(--v3-body);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  color: var(--v3-ink-soft);
  margin: 0 0 14px;
}
.v3-admin .av2-label {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--v3-ink-soft);
  margin: 12px 0 6px;
  letter-spacing: 0.2px;
}
.v3-admin .av2-input,
.v3-admin input.av2-input,
.v3-admin textarea.av2-input,
.v3-admin select.av2-input {
  width: 100%;
  background: #FFFAF4;
  border: 1.5px solid var(--v3-line);
  border-radius: 10px;
  padding: 11px 14px;
  font-family: var(--v3-body);
  font-size: 0.9rem;
  color: var(--v3-ink);
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
  margin-bottom: 10px;
}
.v3-admin .av2-input:focus { border-color: var(--v3-terracotta); }
.v3-admin .av2-toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  color: var(--v3-ink);
  font-weight: 500;
  cursor: pointer;
}
.v3-admin .av2-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 22px 16px;
  border: 1.5px dashed var(--v3-line);
  border-radius: 12px;
  background: #FFFAF4;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--v3-ink-soft);
}
.v3-admin .av2-upload-area:hover {
  border-color: var(--v3-terracotta);
  background: var(--v3-cream-deep);
}
.v3-admin .av2-img-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.v3-admin .av2-img-remove {
  position: absolute;
  top: 6px; right: 6px;
  width: 24px; height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.65);
  color: #fff;
  cursor: pointer;
  font-size: 0.78rem;
}
.v3-admin .av2-post-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--v3-line);
}
.v3-admin .av2-post-row:last-child { border-bottom: none; }
.v3-admin .av2-post-thumb {
  width: 56px; height: 56px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--v3-cream-deep);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.v3-admin .av2-tag-btn {
  background: var(--v3-cream-deep);
  color: var(--v3-ink-soft);
  border: 1px solid var(--v3-line);
  border-radius: 14px;
  padding: 5px 10px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
}
.v3-admin .av2-tag-btn.purple {
  background: rgba(199, 90, 62, 0.12);
  color: var(--v3-terracotta);
  border-color: rgba(199, 90, 62, 0.22);
}
.v3-admin .av2-tag-btn.green {
  background: var(--v3-success-bg);
  color: var(--v3-success);
  border-color: rgba(111, 176, 122, 0.25);
}
.v3-admin .av2-tag-btn.red {
  background: var(--v3-danger-bg);
  color: var(--v3-danger);
  border-color: rgba(216, 107, 107, 0.25);
}
.v3-admin .av2-save-bar {
  position: sticky;
  bottom: 0;
  background: #fff;
  border-top: 1px solid var(--v3-line);
  padding: 14px 0;
  margin: 18px 0 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
}
/* legacy purple buttons inside admin → terracotta to match v3 */
.v3-admin .btn.btn-primary {
  background: var(--v3-terracotta);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-family: var(--v3-body);
  font-weight: 700;
  letter-spacing: 0.5px;
  transition: background 0.15s;
}
.v3-admin .btn.btn-primary:hover { background: var(--v3-terracotta-dark); }
.v3-admin .btn.btn-secondary {
  background: transparent;
  color: var(--v3-ink);
  border: 1.5px solid var(--v3-line);
  border-radius: 8px;
  font-family: var(--v3-body);
  font-weight: 700;
}
.v3-admin .btn.btn-secondary:hover { background: var(--v3-cream-deep); }
```

- [ ] **Step 3: Save file and verify Vite hot-reloads without error**

Watch the terminal running `npm run dev`. Expected: no compilation errors, page auto-reloads.

- [ ] **Step 4: Verify visually**

Open http://localhost:5173/admin → log in as `cristina@example.com / admin123` → click **Settings** tab.

Expected: cards are now white with cream-tinted inputs, no more dark `#0a0a0a` backgrounds. Section labels in muted ink. Save button is terracotta, not purple.

If anything looks off, refine the rule block and retry — do not move on with broken styles.

- [ ] **Step 5: Commit**

```bash
git add client/src/styles/theme-v3.css
git commit -m "style(admin): override legacy av2-* classes inside v3 shell"
```

---

## Task 2: Remove hardcoded purple `#7c3aed` from Admin content tab

The bundle editor's "+ New Bundle" button and the "Edit / Save" buttons still hardcode `#7c3aed` (purple) — replace with terracotta to match the v3 palette.

**Files:**
- Modify: `client/src/pages/Admin.tsx` (search for `#7c3aed`)

- [ ] **Step 1: Find all `#7c3aed` references in Admin.tsx**

Run: `grep -n "#7c3aed" client/src/pages/Admin.tsx`

Expected: 4–8 matches in the bundle card section (publish toggle, new bundle button, edit text, etc.).

- [ ] **Step 2: Replace each match with the v3 token**

For inline styles in JSX, replace `'#7c3aed'` (with quotes) with `'var(--v3-terracotta)'`. For raw CSS literals inside template strings, replace `#7c3aed` with `var(--v3-terracotta)`.

Use multi-line Edit calls — `replace_all: true` is safe here because every instance is a brand color reference.

- [ ] **Step 3: Verify visually**

Hard refresh `/admin` → **Content** tab. Bundle "+ New Bundle" button should be terracotta. "Edit" link on bundle cards should be terracotta. Publish/Draft pill colors unchanged (green / grey is correct).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Admin.tsx
git commit -m "style(admin): terracotta replaces leftover purple accents in Content tab"
```

---

## Task 3: Restyle Login page to v3

**Files:**
- Modify: `client/src/pages/Login.tsx` (complete inline-style rewrite)

- [ ] **Step 1: Replace the page contents**

Write this file:

```tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { creatorLogin, fanLogin } from '../api';

type Mode = 'creator' | 'fan';

const Login = () => {
  const [mode, setMode] = useState<Mode>('fan');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'creator') {
        const res = await creatorLogin(email, password);
        if (res.token) {
          localStorage.setItem('adminToken', res.token);
          localStorage.setItem('adminRole', 'creator');
          navigate('/admin');
        } else {
          setError(res.error || 'Invalid credentials');
        }
      } else {
        const res = await fanLogin(email, password);
        if (res.token) {
          localStorage.setItem('fanToken', res.token);
          localStorage.setItem('fanUser', JSON.stringify(res.user));
          navigate('/dashboard');
        } else {
          setError(res.error || 'Invalid credentials');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'var(--v3-cream)' }}>
      <div className="v3-card" style={{ width: '100%', maxWidth: 420, padding: '36px 32px', background: '#fff', borderRadius: 18, border: '1px solid var(--v3-line)', boxShadow: 'var(--v3-shadow)' }}>
        <h1 style={{ fontFamily: 'var(--v3-heading)', fontSize: '1.7rem', textAlign: 'center', margin: '0 0 6px', color: 'var(--v3-ink)' }}>
          {mode === 'creator' ? 'Creator Login' : 'Welcome back'}
        </h1>
        <p style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--v3-ink-soft)', margin: '0 0 24px' }}>
          {mode === 'creator' ? 'Access your admin dashboard' : 'Sign in to your account'}
        </p>

        <div style={{ display: 'flex', background: 'var(--v3-cream-deep)', borderRadius: 10, padding: 4, marginBottom: 22 }}>
          {(['fan', 'creator'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, padding: '9px 0', border: 'none', borderRadius: 7, cursor: 'pointer',
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? 'var(--v3-ink)' : 'var(--v3-ink-soft)',
                fontWeight: mode === m ? 700 : 500, fontSize: '0.82rem',
                fontFamily: 'inherit', textTransform: 'capitalize',
                boxShadow: mode === m ? 'var(--v3-shadow-sm)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {m === 'fan' ? 'Member' : 'Creator'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: '12px 14px', borderRadius: 10,
              border: '1.5px solid var(--v3-line)',
              background: '#FFFAF4', color: 'var(--v3-ink)',
              fontFamily: 'inherit', fontSize: '0.92rem', outline: 'none',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: '12px 14px', borderRadius: 10,
              border: '1.5px solid var(--v3-line)',
              background: '#FFFAF4', color: 'var(--v3-ink)',
              fontFamily: 'inherit', fontSize: '0.92rem', outline: 'none',
            }}
          />
          {error && <p style={{ color: 'var(--v3-danger)', fontSize: '0.84rem', margin: 0 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="v3-btn v3-btn-primary"
            style={{ marginTop: 4, opacity: loading ? 0.7 : 1, width: '100%' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {mode === 'fan' && (
          <p style={{ textAlign: 'center', marginTop: 22, fontSize: '0.88rem', color: 'var(--v3-ink-soft)' }}>
            No account?{' '}
            <Link to="/register" style={{ color: 'var(--v3-terracotta)', textDecoration: 'none', fontWeight: 700 }}>
              Join free
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;
```

- [ ] **Step 2: Verify visually**

Open http://localhost:5173/login. Expected: cream background, white card, terracotta sign-in button, segmented toggle (Member / Creator), no dark surfaces anywhere.

Try a wrong-password attempt — error text should be terracotta-rust color.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Login.tsx
git commit -m "style(login): convert to v3 cream/terracotta palette"
```

---

## Task 4: Restyle Register page to v3

**Files:**
- Modify: `client/src/pages/Register.tsx`

- [ ] **Step 1: Replace the page contents**

Write this file:

```tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fanRegister } from '../api';

const Register = ({ config }: { config: any }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const res = await fanRegister(email, username, password);
      if (res.token) {
        localStorage.setItem('fanToken', res.token);
        localStorage.setItem('fanUser', JSON.stringify(res.user));
        navigate('/dashboard');
      } else {
        setError(res.error || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid var(--v3-line)',
    background: '#FFFAF4', color: 'var(--v3-ink)',
    fontFamily: 'inherit', fontSize: '0.92rem', outline: 'none',
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'var(--v3-cream)' }}>
      <div className="v3-card" style={{ width: '100%', maxWidth: 420, padding: '36px 32px', background: '#fff', borderRadius: 18, border: '1px solid var(--v3-line)', boxShadow: 'var(--v3-shadow)' }}>
        <h1 style={{ fontFamily: 'var(--v3-heading)', fontSize: '1.7rem', textAlign: 'center', margin: '0 0 6px', color: 'var(--v3-ink)' }}>
          Get Premium Access
        </h1>
        <p style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--v3-ink-soft)', margin: '0 0 24px' }}>
          Create your free account to access exclusive content from{' '}
          <strong>{config?.heroTitle || config?.siteTitle || 'the creator'}</strong>
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required style={inputStyle} />
          {error && <p style={{ color: 'var(--v3-danger)', fontSize: '0.84rem', margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} className="v3-btn v3-btn-primary"
            style={{ marginTop: 4, opacity: loading ? 0.7 : 1, width: '100%' }}>
            {loading ? 'Creating account…' : 'Create Account — Free'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 22, fontSize: '0.88rem', color: 'var(--v3-ink-soft)' }}>
          Already a member?{' '}
          <Link to="/login" style={{ color: 'var(--v3-terracotta)', textDecoration: 'none', fontWeight: 700 }}>
            Sign in
          </Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 14, fontSize: '0.74rem', color: 'var(--v3-muted)' }}>
          By joining you confirm you are 18 or older.
        </p>
      </div>
    </div>
  );
};

export default Register;
```

- [ ] **Step 2: Verify visually**

Open http://localhost:5173/register. Cream background, white card, terracotta "Create Account — Free" button, "Sign in" link in terracotta.

Try submitting with mismatched passwords — error in terracotta-rust.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Register.tsx
git commit -m "style(register): convert to v3 cream/terracotta palette"
```

---

## Task 5: Align AdminMessages.tsx palette to v3

`AdminMessages` builds its colors from an `isDark` flag. Both branches use generic neutrals (#0a0a0a/#1a1a1a) and `#7c3aed` purple — both feel out of place inside the v3 admin shell.

**Files:**
- Modify: `client/src/pages/AdminMessages.tsx`

- [ ] **Step 1: Replace the theme tokens block**

Find this block inside the component (search for `// ── Theme tokens`):

```ts
  // ── Theme tokens ─────────────────────────────────────────────
  const C = {
    bg:        isDark ? '#0a0a0a' : '#fafafa',
    panelBg:   isDark ? '#0a0a0a' : '#fff',
    border:    isDark ? '#1a1a1a' : '#e8e8e8',
    text:      isDark ? '#fff'    : '#111',
    muted:     isDark ? '#666'    : '#888',
    faint:     isDark ? '#444'    : '#bbb',
    rowHover:  isDark ? '#141414' : '#f5f5f5',
    rowActive: isDark ? '#141414' : '#f0eaff',
    inputBg:   isDark ? '#0d0d0d' : '#f8f8f8',
    msgFan:    isDark ? '#1a1a1a' : '#f0f0f0',
  };
```

Replace with:

```ts
  // ── Theme tokens (v3 — ignores isDark; always cream/terracotta) ─
  const C = {
    bg:        '#FFF8F2',
    panelBg:   '#fff',
    border:    'var(--v3-line)',
    text:      'var(--v3-ink)',
    muted:     'var(--v3-ink-soft)',
    faint:     'var(--v3-muted)',
    rowHover:  'var(--v3-cream-deep)',
    rowActive: '#FBE3E0',
    inputBg:   '#FFFAF4',
    msgFan:    'var(--v3-cream-deep)',
  };
  // isDark prop is accepted but no longer used — kept for API compat
  void isDark;
```

- [ ] **Step 2: Replace `#7c3aed` accents with terracotta**

Run: `grep -n "#7c3aed" client/src/pages/AdminMessages.tsx`

For every match, swap `#7c3aed` → `var(--v3-terracotta)` (or `'var(--v3-terracotta)'` if it's inside JSX inline-style quotes).

Two notable spots:
- The purple-active-border on inbox rows
- The send button background gradient
- Creator-bubble background (purple) → use `var(--v3-terracotta)` instead

- [ ] **Step 3: Verify visually**

Log in as creator → **Messages** tab. Expected: warm cream subscriber list panel, white thread area, terracotta active-row border, terracotta send button, creator bubbles in terracotta (not purple).

Send a test message — colors should remain consistent.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/AdminMessages.tsx
git commit -m "style(admin-messages): swap dark/purple palette for v3 cream/terracotta"
```

---

## Task 6: Align AdminBroadcast.tsx palette to v3

Same shape as AdminMessages — driven by `isDark` prop with generic neutrals.

**Files:**
- Modify: `client/src/pages/AdminBroadcast.tsx`

- [ ] **Step 1: Replace the theme tokens block**

Find the `const C = {` block near the bottom of the component (just before the return).

Replace with:

```ts
  const C = {
    text:    'var(--v3-ink)',
    muted:   'var(--v3-ink-soft)',
    faint:   'var(--v3-muted)',
    border:  'var(--v3-line)',
    inputBg: '#FFFAF4',
  };
  void isDark;
```

- [ ] **Step 2: Replace `#7c3aed` accents with terracotta**

Run: `grep -n "#7c3aed" client/src/pages/AdminBroadcast.tsx`

Swap each `'#7c3aed'` → `'var(--v3-terracotta)'`. There are 3 matches (PPV toggle active state, Send Broadcast button background, fallback gradient).

- [ ] **Step 3: Verify visually**

Log in as creator → click **📣 Broadcast** in sidebar. Expected: warm cream card, terracotta PPV toggle, terracotta "Send Broadcast" button.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/AdminBroadcast.tsx
git commit -m "style(admin-broadcast): swap dark/purple palette for v3 cream/terracotta"
```

---

## Task 7: Visual regression sweep + cleanup commit

Walk every Admin tab and verify nothing fell through the cracks.

- [ ] **Step 1: Open each admin surface and confirm v3 styling**

Visit each URL in turn and verify cream/terracotta:

1. http://localhost:5173/admin → **Dashboard** tab (overview)
2. **Bio Builder** tab — placeholder card cream/white
3. **Analytics** tab — placeholder card
4. **Content** tab — bundle cards, post list, upload form all white-on-cream
5. **Messages** tab — terracotta accents
6. **Broadcast** tab — terracotta accents
7. **Audience / Branding / Support** tabs — placeholder
8. **Settings** tab — Profile, Fanvue Integration, Media, Appearance, SEO, Social, Blog, Security cards

- [ ] **Step 2: Take final screenshots for the record**

Optional but recommended: use the Chrome MCP (`mcp__claude-in-chrome__*`) to capture a screenshot of each admin tab and commit them under `docs/screenshots/` for posterity. Skip if not available.

- [ ] **Step 3: Search for any remaining dark-color literals in admin**

Run: `grep -rEn "#0a0a0a|#1a1a1a|#111" client/src/pages/Admin.tsx client/src/pages/AdminMessages.tsx client/src/pages/AdminBroadcast.tsx`

Expected: zero or only-non-color matches.

If any remain, replace with `var(--v3-cream-deep)` (background) or `var(--v3-line)` (borders).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "style(admin): final dark-color sweep across all admin surfaces" --allow-empty
```

---

## Verification (post-plan)

A. Sign in as creator (`cristina@example.com / admin123`). Walk every tab. No dark surfaces remain.
B. Sign out. Visit `/login` and `/register`. Cream background, terracotta CTAs.
C. Sign in as creator → Messages → send a fan a PPV. As fan (other browser), visit `/chat` → it stays on its existing rose-pink palette, unaffected by this work.
D. `grep -rE "#7c3aed|#0a0a0a|#1a1a1a" client/src/pages/Admin*.tsx client/src/pages/Login.tsx client/src/pages/Register.tsx` returns zero matches.
