import { useEffect, useState } from 'react';
import {
  fanvueStatus, fanvueConnect, fanvueDisconnect, fanvueSaveCreds,
  fanvueAccount, fanvueChats, fanvueMessages, fanvueSendMessage,
  fanvueEarningsSummary, fanvueEarningsData, fanvueSubscribers, fanvueTopFans,
} from '../api';

type Sub = 'connect' | 'overview' | 'chats' | 'payments' | 'subscribers';

const SUBS: { id: Sub; label: string; icon: string }[] = [
  { id: 'overview',    label: 'Overview',    icon: '📊' },
  { id: 'chats',       label: 'Chats',       icon: '💬' },
  { id: 'payments',    label: 'Payments',    icon: '💰' },
  { id: 'subscribers', label: 'Subscribers', icon: '👥' },
  { id: 'connect',     label: 'Connection',  icon: '🔌' },
];

// Pull a value out of an object trying several likely key names.
const pick = (o: any, ...keys: string[]) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};
// Fanvue amounts are often in minor units (cents). Render defensively.
const money = (v: any) => {
  if (v == null) return '—';
  const n = typeof v === 'object' ? pick(v, 'amount', 'value', 'total') : v;
  if (n == null || isNaN(Number(n))) return String(n);
  const num = Number(n);
  const dollars = Math.abs(num) >= 1000 ? num / 100 : num; // heuristic: big = cents
  return '$' + dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const asArray = (d: any): any[] =>
  Array.isArray(d) ? d : (d?.data || d?.items || d?.results || d?.chats || d?.subscribers || d?.messages || []);

export default function AdminFanvue() {
  const [sub, setSub] = useState<Sub>('overview');
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try { setStatus(await fanvueStatus()); } catch { setStatus({ connected: false }); }
    setLoading(false);
  };

  useEffect(() => {
    loadStatus();
    // OAuth callback redirects back with ?fanvue=connected|error|denied|expired
    const p = new URLSearchParams(window.location.search).get('fanvue');
    if (p) {
      setFlash(
        p === 'connected' ? '✅ Fanvue connected!' :
        p === 'denied' ? '⚠️ Authorization was cancelled.' :
        p === 'expired' ? '⚠️ The connect link expired — try again.' :
        '⚠️ Connection failed — check your Client ID/Secret and redirect URL.',
      );
      if (p === 'connected') setSub('overview'); else setSub('connect');
      // clean the URL
      window.history.replaceState({}, '', window.location.pathname + '?tab=fanvue');
    } else if (!new URLSearchParams(window.location.search).get('tab')) {
      // default landing handled below after status loads
    }
  }, []);

  // If not connected, default to the Connection tab.
  useEffect(() => {
    if (status && !status.connected && sub !== 'connect') setSub('connect');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const connected = !!status?.connected;

  return (
    <div>
      <h1 className="title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>Fanvue</span>
        <span style={{
          fontSize: '0.6rem', fontWeight: 700, letterSpacing: 1, padding: '3px 10px', borderRadius: 999,
          background: connected ? 'var(--v3-success-bg)' : 'var(--v3-danger-bg)',
          color: connected ? 'var(--v3-success)' : 'var(--v3-danger)',
        }}>{connected ? 'CONNECTED' : 'NOT CONNECTED'}</span>
      </h1>
      <p className="welcome">Your Fanvue account — chats, earnings, subscribers, all in one place.</p>

      {flash && (
        <div className="v3-card" style={{ borderLeft: '3px solid var(--v3-terracotta)', marginBottom: 14 }}>
          {flash} <button onClick={() => setFlash(null)} style={{ float: 'right', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* sub-tab bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {SUBS.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)}
            className="v3-btn"
            style={{
              fontSize: '0.74rem', padding: '8px 16px',
              background: sub === s.id ? 'var(--v3-terracotta)' : '#fff',
              color: sub === s.id ? '#fff' : 'var(--v3-ink)',
              border: '1px solid var(--v3-line)',
            }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {loading ? <div className="v3-card">Loading…</div> : (
        <>
          {sub === 'connect'     && <ConnectTab status={status} onChange={loadStatus} />}
          {sub === 'overview'    && (connected ? <OverviewTab /> : <NeedConnect go={() => setSub('connect')} />)}
          {sub === 'chats'       && (connected ? <ChatsTab /> : <NeedConnect go={() => setSub('connect')} />)}
          {sub === 'payments'    && (connected ? <PaymentsTab /> : <NeedConnect go={() => setSub('connect')} />)}
          {sub === 'subscribers' && (connected ? <SubscribersTab /> : <NeedConnect go={() => setSub('connect')} />)}
        </>
      )}
    </div>
  );
}

function NeedConnect({ go }: { go: () => void }) {
  return (
    <div className="v3-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
      <p style={{ fontSize: '1.1rem', marginBottom: 8 }}>Connect your Fanvue account to see this.</p>
      <button className="v3-btn v3-btn-primary" onClick={go}>Go to Connection →</button>
    </div>
  );
}

// ─── Connection tab ─────────────────────────────────────────────────────────
function ConnectTab({ status, onChange }: { status: any; onChange: () => void }) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async (body: any, note: string) => {
    setBusy(true); setMsg(null);
    const r = await fanvueSaveCreds(body);
    setBusy(false);
    setMsg(r?.ok ? note : (r?.error || 'Save failed'));
    onChange();
  };

  const connect = async () => {
    setBusy(true); setMsg(null);
    const r = await fanvueConnect();
    setBusy(false);
    if (r?.authorizeUrl) window.location.href = r.authorizeUrl;
    else setMsg(r?.error || 'Could not start OAuth. Save Client ID + Secret first.');
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v3-line)',
    fontFamily: 'inherit', fontSize: '0.88rem', marginTop: 4, marginBottom: 12,
  };
  const label: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 700, color: 'var(--v3-ink-soft)' };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 620 }}>
      <div className="v3-card">
        <div className="v3-card-head"><h3>Status</h3></div>
        <p style={{ margin: 0 }}>
          {status?.connected
            ? <>Connected{status.handle ? <> as <b>@{status.handle}</b></> : ''}. {status.tokenExpiresAt && <span style={{ color: 'var(--v3-muted)', fontSize: '0.82rem' }}>Token renews automatically.</span>}</>
            : status?.hasCredentials
              ? 'Credentials saved — click “Connect with Fanvue” to authorize.'
              : 'Not connected. Add your Client ID + Secret below, then connect.'}
        </p>
        {status?.connected && (
          <button className="v3-btn" style={{ marginTop: 12, border: '1px solid var(--v3-line)' }}
            disabled={busy} onClick={async () => { await fanvueDisconnect(); onChange(); }}>
            Disconnect
          </button>
        )}
      </div>

      {/* OAuth app credentials */}
      <div className="v3-card">
        <div className="v3-card-head"><h3>1 · OAuth App (recommended)</h3></div>
        <p style={{ fontSize: '0.82rem', color: 'var(--v3-muted)', marginTop: 0 }}>
          From Fanvue → Settings → API/Builder. Register redirect URL <code>{`${location.origin.replace('members.', '').replace('5173', '5000')}/api/fanvue/callback`}</code> on your app.
        </p>
        <label style={label}>Client ID</label>
        <input style={input} value={clientId} onChange={e => setClientId(e.target.value)} placeholder={status?.hasCredentials ? '•••• saved ••••' : 'fa5dad1e-…'} />
        <label style={label}>Client Secret</label>
        <input style={input} type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder={status?.hasCredentials ? '•••• saved ••••' : 'secret'} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="v3-btn" style={{ border: '1px solid var(--v3-line)' }} disabled={busy || (!clientId && !clientSecret)}
            onClick={() => save({ clientId, clientSecret }, 'Saved. Now click Connect.')}>Save credentials</button>
          <button className="v3-btn v3-btn-primary" disabled={busy} onClick={connect}>Connect with Fanvue →</button>
        </div>
      </div>

      {/* Manual token */}
      <div className="v3-card">
        <div className="v3-card-head"><h3>2 · Paste a token (manual)</h3></div>
        <p style={{ fontSize: '0.82rem', color: 'var(--v3-muted)', marginTop: 0 }}>
          Optional. Access tokens expire ~1h; add a refresh token to keep it alive.
        </p>
        <label style={label}>Access token</label>
        <input style={input} value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="eyJ…" />
        <label style={label}>Refresh token (optional)</label>
        <input style={input} value={refreshToken} onChange={e => setRefreshToken(e.target.value)} placeholder="…" />
        <button className="v3-btn" style={{ border: '1px solid var(--v3-line)' }} disabled={busy || !accessToken}
          onClick={() => save({ accessToken, refreshToken }, 'Token saved.')}>Save token</button>
      </div>

      {msg && <div className="v3-card" style={{ borderLeft: '3px solid var(--v3-terracotta)' }}>{msg}</div>}
    </div>
  );
}

// ─── Overview ───────────────────────────────────────────────────────────────
function OverviewTab() {
  const [d, setD] = useState<any>(undefined);
  useEffect(() => { fanvueAccount().then(setD).catch(() => setD(null)); }, []);
  if (d === undefined) return <div className="v3-card">Loading account…</div>;
  if (!d || d.error) return <ErrCard d={d} />;
  const earnings = pick(d, 'earnings', 'earningsTotals') || d;
  const stats = [
    { label: 'All-time earnings', value: money(pick(earnings, 'allTime', 'total', 'lifetime', 'gross')) , cls: 'dark' },
    { label: 'This month', value: money(pick(earnings, 'thisMonth', 'month', 'currentMonth')), cls: 'peach' },
    { label: 'Subscribers', value: pick(d, 'subscriberCount', 'subscribers', 'activeSubscribers') ?? '—', cls: 'pink' },
    { label: 'Followers', value: pick(d, 'followerCount', 'followers') ?? '—', cls: 'peach' },
  ];
  return (
    <>
      <div className="v3-stat-grid">
        {stats.map((s, i) => (
          <div key={i} className={`v3-stat ${s.cls}`}>
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
          </div>
        ))}
      </div>
      <RawPeek d={d} />
    </>
  );
}

// ─── Chats ──────────────────────────────────────────────────────────────────
function ChatsTab() {
  const [chats, setChats] = useState<any[] | undefined>(undefined);
  const [active, setActive] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { fanvueChats().then(d => setChats(asArray(d))).catch(() => setChats([])); }, []);
  const openChat = async (c: any) => {
    setActive(c);
    const uuid = pick(c, 'userUuid', 'uuid', 'id') || pick(c.user || {}, 'uuid', 'id');
    const d = await fanvueMessages(uuid);
    setMessages(asArray(d));
  };
  const send = async () => {
    if (!text.trim() || !active) return;
    setSending(true);
    const uuid = pick(active, 'userUuid', 'uuid', 'id') || pick(active.user || {}, 'uuid', 'id');
    await fanvueSendMessage(uuid, { text });
    setText('');
    const d = await fanvueMessages(uuid);
    setMessages(asArray(d));
    setSending(false);
  };

  if (chats === undefined) return <div className="v3-card">Loading chats…</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14, minHeight: 420 }}>
      <div className="v3-card" style={{ padding: 0, overflow: 'hidden', maxHeight: 560, overflowY: 'auto' }}>
        {chats.length === 0 && <p style={{ padding: 16, color: 'var(--v3-muted)' }}>No chats.</p>}
        {chats.map((c, i) => {
          const u = c.user || c;
          const name = pick(u, 'displayName', 'handle', 'username', 'name') || 'Fan';
          return (
            <button key={i} onClick={() => openChat(c)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', borderBottom: '1px solid var(--v3-line)', background: active === c ? 'var(--v3-cream-deep)' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--v3-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pick(c, 'lastMessage', 'preview') ? String(pick(c, 'lastMessage', 'preview')) : ''}
              </div>
            </button>
          );
        })}
      </div>
      <div className="v3-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
        {!active ? <p style={{ color: 'var(--v3-muted)' }}>Select a conversation.</p> : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12, maxHeight: 440 }}>
              {messages.length === 0 && <p style={{ color: 'var(--v3-muted)' }}>No messages.</p>}
              {messages.map((m, i) => {
                const mine = !!pick(m, 'isCreator', 'fromCreator', 'isSelf', 'sentByMe');
                return (
                  <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '70%', padding: '8px 12px', borderRadius: 14, background: mine ? 'var(--v3-terracotta)' : 'var(--v3-cream-deep)', color: mine ? '#fff' : 'var(--v3-ink)', fontSize: '0.88rem' }}>
                    {pick(m, 'text', 'content', 'body', 'message') || <i>(media)</i>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--v3-line)', paddingTop: 10 }}>
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Type a message…" style={{ flex: 1, padding: '10px 12px', borderRadius: 999, border: '1px solid var(--v3-line)', fontFamily: 'inherit' }} />
              <button className="v3-btn v3-btn-primary" disabled={sending || !text.trim()} onClick={send}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Payments ───────────────────────────────────────────────────────────────
function PaymentsTab() {
  const [summary, setSummary] = useState<any>(undefined);
  const [rows, setRows] = useState<any[] | undefined>(undefined);
  useEffect(() => {
    fanvueEarningsSummary().then(setSummary).catch(() => setSummary(null));
    fanvueEarningsData().then(d => setRows(asArray(d))).catch(() => setRows([]));
  }, []);
  return (
    <>
      {summary === undefined ? <div className="v3-card">Loading earnings…</div> : summary?.error ? <ErrCard d={summary} /> : (
        <div className="v3-stat-grid">
          <div className="v3-stat dark"><div className="label">All-time</div><div className="value">{money(pick(summary, 'allTime', 'total', 'gross', 'lifetime'))}</div></div>
          <div className="v3-stat peach"><div className="label">This month</div><div className="value">{money(pick(summary, 'thisMonth', 'month', 'currentMonth'))}</div></div>
          <div className="v3-stat pink"><div className="label">Last month</div><div className="value">{money(pick(summary, 'lastMonth', 'previousMonth'))}</div></div>
        </div>
      )}
      <div className="v3-card" style={{ marginTop: 14 }}>
        <div className="v3-card-head"><h3>Recent invoices</h3></div>
        {rows === undefined ? 'Loading…' : rows.length === 0 ? <p style={{ color: 'var(--v3-muted)' }}>No invoices.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--v3-muted)' }}>
                <th style={{ padding: '6px 8px' }}>Date</th><th style={{ padding: '6px 8px' }}>Type</th><th style={{ padding: '6px 8px' }}>Fan</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
              </tr></thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--v3-line)' }}>
                    <td style={{ padding: '6px 8px' }}>{(pick(r, 'createdAt', 'date', 'created') || '').toString().slice(0, 10)}</td>
                    <td style={{ padding: '6px 8px' }}>{pick(r, 'type', 'source', 'kind') || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{pick(r.user || r.fan || {}, 'displayName', 'handle', 'username') || pick(r, 'fanHandle') || '—'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{money(pick(r, 'amount', 'gross', 'net', 'total'))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Subscribers ────────────────────────────────────────────────────────────
function SubscribersTab() {
  const [subs, setSubs] = useState<any[] | undefined>(undefined);
  const [top, setTop] = useState<any[]>([]);
  useEffect(() => {
    fanvueSubscribers().then(d => setSubs(asArray(d))).catch(() => setSubs([]));
    fanvueTopFans().then(d => setTop(asArray(d))).catch(() => setTop([]));
  }, []);
  const Card = ({ title, list }: { title: string; list: any[] }) => (
    <div className="v3-card">
      <div className="v3-card-head"><h3>{title}</h3></div>
      {list.length === 0 ? <p style={{ color: 'var(--v3-muted)' }}>None.</p> : list.slice(0, 50).map((f, i) => {
        const u = f.user || f;
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i ? '1px solid var(--v3-line)' : 'none' }}>
            <span>{pick(u, 'displayName', 'handle', 'username', 'name') || 'Fan'}</span>
            <span style={{ color: 'var(--v3-muted)', fontWeight: 700 }}>{pick(f, 'totalSpent', 'spent', 'lifetimeSpend') !== undefined ? money(pick(f, 'totalSpent', 'spent', 'lifetimeSpend')) : ''}</span>
          </div>
        );
      })}
    </div>
  );
  if (subs === undefined) return <div className="v3-card">Loading subscribers…</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Card title="Subscribers" list={subs} />
      <Card title="Top spenders" list={top} />
    </div>
  );
}

// ─── shared bits ────────────────────────────────────────────────────────────
function ErrCard({ d }: { d: any }) {
  return (
    <div className="v3-card" style={{ borderLeft: '3px solid var(--v3-danger)' }}>
      <b>Couldn’t load.</b> {d?.error || 'Unknown error'}
      {d?.needsConnect && <div style={{ marginTop: 6, fontSize: '0.84rem', color: 'var(--v3-muted)' }}>Your token may have expired — reconnect on the Connection tab.</div>}
    </div>
  );
}
function RawPeek({ d }: { d: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(o => !o)} style={{ border: 'none', background: 'none', color: 'var(--v3-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>
        {open ? '▾ hide raw data' : '▸ raw data'}
      </button>
      {open && <pre style={{ background: 'var(--v3-cream-deep)', padding: 12, borderRadius: 8, fontSize: '0.72rem', overflowX: 'auto', maxHeight: 300 }}>{JSON.stringify(d, null, 2)}</pre>}
    </div>
  );
}
