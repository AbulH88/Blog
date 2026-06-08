import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import {
  fanvueStatus, fanvueConnect, fanvueDisconnect, fanvueSaveCreds,
  fanvueAccount, fanvueChats, fanvueMessages, fanvueSendMessage,
  fanvueEarningsSummary, fanvueEarningsData, fanvueSubscribers, fanvueTopFans,
  fanvueGet, fanvuePost, fanvuePatch, fanvueDelete, fanvueUnread,
} from '../api';

// Run a write call, surface errors, then refresh. Keeps the write controls terse.
async function run(p: Promise<any>, onDone?: () => void) {
  const r = await p;
  if (r && r.error) { alert('Fanvue error: ' + r.error); return false; }
  onDone?.(); return true;
}
const ask = (label: string, def = '') => { const v = window.prompt(label, def); return v == null ? null : v.trim(); };
const sure = (label: string) => window.confirm(label);
const btn: React.CSSProperties = { fontSize: '0.72rem', padding: '6px 12px', border: '1px solid var(--v3-line)', borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' };

type Sub =
  | 'overview' | 'chats' | 'posts' | 'subscribers' | 'earnings' | 'broadcast'
  | 'vault' | 'lists' | 'media' | 'tracking' | 'notifications' | 'connect';

const SUBS: { id: Sub; label: string; icon: string }[] = [
  { id: 'overview',      label: 'Overview',      icon: '📊' },
  { id: 'chats',         label: 'Chats',         icon: '💬' },
  { id: 'broadcast',     label: 'Broadcast',     icon: '📣' },
  { id: 'posts',         label: 'Posts',         icon: '📝' },
  { id: 'subscribers',   label: 'Fans',          icon: '👥' },
  { id: 'earnings',      label: 'Earnings',      icon: '💰' },
  { id: 'vault',         label: 'Vault',         icon: '🔒' },
  { id: 'lists',         label: 'Fan Lists',     icon: '🗂' },
  { id: 'media',         label: 'Media',         icon: '🖼' },
  { id: 'tracking',      label: 'Tracking',      icon: '🔗' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'connect',       label: 'Connection',    icon: '🔌' },
];

const pick = (o: any, ...keys: string[]) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};
const money = (v: any) => {
  if (v == null) return '—';
  const n = typeof v === 'object' ? pick(v, 'amount', 'value', 'total') : v;
  if (n == null || isNaN(Number(n))) return String(n);
  const num = Number(n);
  const dollars = Math.abs(num) >= 1000 ? num / 100 : num;
  return '$' + dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const asArray = (d: any): any[] =>
  Array.isArray(d) ? d : (d?.data || d?.items || d?.results || d?.members || d?.folders || []);
const dateOf = (v: any) => (v ? String(v).slice(0, 10) : '');
const nameOf = (o: any) => pick(o?.user || o, 'displayName', 'handle', 'username', 'name') || 'User';

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
    const p = new URLSearchParams(window.location.search).get('fanvue');
    if (p) {
      setFlash(
        p === 'connected' ? '✅ Fanvue connected!' :
        p === 'denied' ? '⚠️ Authorization was cancelled.' :
        p === 'expired' ? '⚠️ The connect link expired — try again.' :
        '⚠️ Connection failed — check Client ID/Secret and the redirect URL.',
      );
      setSub(p === 'connected' ? 'overview' : 'connect');
      window.history.replaceState({}, '', window.location.pathname + '?tab=fanvue');
    }
  }, []);

  useEffect(() => {
    if (status && !status.connected && sub !== 'connect') setSub('connect');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const connected = !!status?.connected;
  const gate = (el: ReactElement) => (connected ? el : <NeedConnect go={() => setSub('connect')} />);

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
      <p className="welcome">Your Fanvue account — chats, posts, earnings, fans and more.</p>

      {flash && (
        <div className="v3-card" style={{ borderLeft: '3px solid var(--v3-terracotta)', marginBottom: 14 }}>
          {flash} <button onClick={() => setFlash(null)} style={{ float: 'right', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {SUBS.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} className="v3-btn"
            style={{
              fontSize: '0.74rem', padding: '8px 14px',
              background: sub === s.id ? 'var(--v3-terracotta)' : '#fff',
              color: sub === s.id ? '#fff' : 'var(--v3-ink)', border: '1px solid var(--v3-line)',
            }}>{s.icon} {s.label}</button>
        ))}
      </div>

      {loading ? <div className="v3-card">Loading…</div> : (
        <>
          {sub === 'connect'       && <ConnectTab status={status} onChange={loadStatus} />}
          {sub === 'overview'      && gate(<OverviewTab />)}
          {sub === 'chats'         && gate(<ChatsTab />)}
          {sub === 'broadcast'     && gate(<BroadcastTab />)}
          {sub === 'posts'         && gate(<PostsTab />)}
          {sub === 'subscribers'   && gate(<FansTab />)}
          {sub === 'earnings'      && gate(<EarningsTab />)}
          {sub === 'vault'         && gate(<VaultTab />)}
          {sub === 'lists'         && gate(<ListsTab />)}
          {sub === 'media'         && gate(<MediaTab />)}
          {sub === 'tracking'      && gate(<TrackingTab />)}
          {sub === 'notifications' && gate(<NotificationsTab />)}
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

// ─── Connection ───────────────────────────────────────────────────────────
function ConnectTab({ status, onChange }: { status: any; onChange: () => void }) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (body: any, note: string) => {
    setBusy(true); setMsg(null);
    const r = await fanvueSaveCreds(body); setBusy(false);
    setMsg(r?.ok ? note : (r?.error || 'Save failed')); onChange();
  };
  const connect = async () => {
    setBusy(true); setMsg(null);
    const r = await fanvueConnect(); setBusy(false);
    if (r?.authorizeUrl) window.location.href = r.authorizeUrl;
    else setMsg(r?.error || 'Save Client ID + Secret first.');
  };
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v3-line)', fontFamily: 'inherit', fontSize: '0.88rem', marginTop: 4, marginBottom: 12 };
  const label: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 700, color: 'var(--v3-ink-soft)' };
  const redirect = `${location.origin.replace('members.', '').replace('5173', '5000')}/api/fanvue/callback`;
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 620 }}>
      <div className="v3-card">
        <div className="v3-card-head"><h3>Status</h3></div>
        <p style={{ margin: 0 }}>
          {status?.connected
            ? <>Connected{status.handle ? <> as <b>@{status.handle}</b></> : ''}. <span style={{ color: 'var(--v3-muted)', fontSize: '0.82rem' }}>Token auto-renews.</span></>
            : status?.hasCredentials ? 'Credentials saved — click “Connect with Fanvue”.' : 'Add your Client ID + Secret, then connect.'}
        </p>
        {status?.connected && <button className="v3-btn" style={{ marginTop: 12, border: '1px solid var(--v3-line)' }} disabled={busy} onClick={async () => { await fanvueDisconnect(); onChange(); }}>Disconnect</button>}
      </div>
      <div className="v3-card">
        <div className="v3-card-head"><h3>1 · OAuth App (recommended)</h3></div>
        <p style={{ fontSize: '0.82rem', color: 'var(--v3-muted)', marginTop: 0 }}>From Fanvue → Settings/Builder. Register redirect URL <code>{redirect}</code> on your app.</p>
        <label style={label}>Client ID</label>
        <input style={input} value={clientId} onChange={e => setClientId(e.target.value)} placeholder={status?.hasCredentials ? '•••• saved ••••' : 'fa5dad1e-…'} />
        <label style={label}>Client Secret</label>
        <input style={input} type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder={status?.hasCredentials ? '•••• saved ••••' : 'secret'} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="v3-btn" style={{ border: '1px solid var(--v3-line)' }} disabled={busy || (!clientId && !clientSecret)} onClick={() => save({ clientId, clientSecret }, 'Saved. Now click Connect.')}>Save credentials</button>
          <button className="v3-btn v3-btn-primary" disabled={busy} onClick={connect}>Connect with Fanvue →</button>
        </div>
      </div>
      <div className="v3-card">
        <div className="v3-card-head"><h3>2 · Paste a token (manual)</h3></div>
        <p style={{ fontSize: '0.82rem', color: 'var(--v3-muted)', marginTop: 0 }}>Optional. Access tokens expire ~1h; add a refresh token to keep it alive.</p>
        <label style={label}>Access token</label>
        <input style={input} value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="eyJ…" />
        <label style={label}>Refresh token (optional)</label>
        <input style={input} value={refreshToken} onChange={e => setRefreshToken(e.target.value)} placeholder="…" />
        <button className="v3-btn" style={{ border: '1px solid var(--v3-line)' }} disabled={busy || !accessToken} onClick={() => save({ accessToken, refreshToken }, 'Token saved.')}>Save token</button>
      </div>
      {msg && <div className="v3-card" style={{ borderLeft: '3px solid var(--v3-terracotta)' }}>{msg}</div>}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const [d, setD] = useState<any>(undefined);
  const [unread, setUnread] = useState<any>(null);
  useEffect(() => {
    fanvueAccount().then(setD).catch(() => setD(null));
    fanvueUnread().then(setUnread).catch(() => {});
  }, []);
  if (d === undefined) return <div className="v3-card">Loading account…</div>;
  if (!d || d.error) return <ErrCard d={d} />;
  const e = pick(d, 'earnings', 'earningsTotals') || d;
  const stats = [
    { label: 'All-time earnings', value: money(pick(e, 'allTime', 'total', 'lifetime', 'gross')), cls: 'dark' },
    { label: 'This month', value: money(pick(e, 'thisMonth', 'month', 'currentMonth')), cls: 'peach' },
    { label: 'Subscribers', value: pick(d, 'subscriberCount', 'subscribers', 'activeSubscribers') ?? '—', cls: 'pink' },
    { label: 'Unread chats', value: pick(unread || {}, 'unreadChats', 'chats', 'unread') ?? '—', cls: 'peach' },
  ];
  return (<>
    <div className="v3-stat-grid">{stats.map((s, i) => (
      <div key={i} className={`v3-stat ${s.cls}`}><div className="label">{s.label}</div><div className="value">{s.value}</div></div>
    ))}</div>
    <RawPeek d={d} />
  </>);
}

// ─── Chats ────────────────────────────────────────────────────────────────
function ChatsTab() {
  const [chats, setChats] = useState<any[] | undefined>(undefined);
  const [active, setActive] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => { fanvueChats().then(d => setChats(asArray(d))).catch(() => setChats([])); }, []);
  const uuidOf = (c: any) => pick(c, 'userUuid', 'counterpartUserUuid', 'uuid', 'id') || pick(c.user || {}, 'uuid', 'id');
  const open = async (c: any) => { setActive(c); setMessages(asArray(await fanvueMessages(uuidOf(c)))); };
  const send = async () => {
    if (!text.trim() || !active) return; setSending(true);
    await fanvueSendMessage(uuidOf(active), { text }); setText('');
    setMessages(asArray(await fanvueMessages(uuidOf(active)))); setSending(false);
  };
  if (chats === undefined) return <div className="v3-card">Loading chats…</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14, minHeight: 420 }}>
      <div className="v3-card" style={{ padding: 0, overflow: 'hidden', maxHeight: 560, overflowY: 'auto' }}>
        {chats.length === 0 && <p style={{ padding: 16, color: 'var(--v3-muted)' }}>No chats.</p>}
        {chats.map((c, i) => (
          <button key={i} onClick={() => open(c)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', borderBottom: '1px solid var(--v3-line)', background: active === c ? 'var(--v3-cream-deep)' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{nameOf(c)}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--v3-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(pick(c, 'lastMessage', 'preview') || '')}</div>
          </button>
        ))}
      </div>
      <div className="v3-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
        {!active ? <p style={{ color: 'var(--v3-muted)' }}>Select a conversation.</p> : (<>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12, maxHeight: 440 }}>
            {messages.length === 0 && <p style={{ color: 'var(--v3-muted)' }}>No messages.</p>}
            {messages.map((m, i) => {
              const mine = !!pick(m, 'isCreator', 'fromCreator', 'isSelf', 'sentByMe');
              return <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '70%', padding: '8px 12px', borderRadius: 14, background: mine ? 'var(--v3-terracotta)' : 'var(--v3-cream-deep)', color: mine ? '#fff' : 'var(--v3-ink)', fontSize: '0.88rem' }}>{pick(m, 'text', 'content', 'body', 'message') || <i>(media)</i>}</div>;
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--v3-line)', paddingTop: 10 }}>
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message…" style={{ flex: 1, padding: '10px 12px', borderRadius: 999, border: '1px solid var(--v3-line)', fontFamily: 'inherit' }} />
            <button className="v3-btn v3-btn-primary" disabled={sending || !text.trim()} onClick={send}>Send</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ─── Posts (+ likes / tips / comments) ──────────────────────────────────────
function PostsTab() {
  const [posts, setPosts] = useState<any[] | undefined>(undefined);
  const [sel, setSel] = useState<any>(null);
  const [detail, setDetail] = useState<{ likes: any[]; tips: any[]; comments: any[] } | null>(null);
  const loadPosts = () => fanvueGet('/posts').then(d => setPosts(asArray(d))).catch(() => setPosts([]));
  useEffect(() => { loadPosts(); }, []);
  const idOf = (p: any) => pick(p, 'uuid', 'id');
  const open = async (p: any) => {
    setSel(p); setDetail(null); const id = idOf(p);
    const [likes, tips, comments] = await Promise.all([
      fanvueGet(`/posts/${id}/likes`), fanvueGet(`/posts/${id}/tips`), fanvueGet(`/posts/${id}/comments`),
    ]);
    setDetail({ likes: asArray(likes), tips: asArray(tips), comments: asArray(comments) });
  };
  const newPost = async () => {
    const text = ask('Post caption / text:'); if (text == null) return;
    const priceStr = ask('Price in USD (blank = free):', '');
    const body: any = { text };
    if (priceStr) body.price = Number(priceStr);
    await run(fanvuePost('/posts', body), loadPosts);
  };
  const editPost = async (p: any) => { const t = ask('New caption:', pick(p, 'text', 'caption') || ''); if (t == null) return; await run(fanvuePatch(`/posts/${idOf(p)}`, { text: t }), () => { loadPosts(); setSel(null); }); };
  const delPost = async (p: any) => { if (!sure('Delete this post?')) return; await run(fanvueDelete(`/posts/${idOf(p)}`), () => { loadPosts(); setSel(null); }); };
  const pin = async (p: any) => { await run(fanvuePost(`/posts/${idOf(p)}/pin`, {}), loadPosts); };
  const repost = async (p: any) => { await run(fanvuePost(`/posts/${idOf(p)}/repost`, {}), loadPosts); };
  const addComment = async (p: any) => { const t = ask('Comment:'); if (!t) return; await run(fanvuePost(`/posts/${idOf(p)}/comments`, { text: t }), () => open(p)); };
  const delComment = async (p: any, c: any) => { if (!sure('Delete comment?')) return; await run(fanvueDelete(`/posts/${idOf(p)}/comments/${pick(c, 'uuid', 'id')}`), () => open(p)); };
  if (posts === undefined) return <div className="v3-card">Loading posts…</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div className="v3-card" style={{ maxHeight: 560, overflowY: 'auto' }}>
        <div className="v3-card-head"><h3>Posts</h3><button style={btn} onClick={newPost}>+ New post</button></div>
        {posts.length === 0 ? <p style={{ color: 'var(--v3-muted)' }}>No posts.</p> : posts.map((p, i) => (
          <button key={i} onClick={() => open(p)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 8px', border: 'none', borderTop: i ? '1px solid var(--v3-line)' : 'none', background: sel === p ? 'var(--v3-cream-deep)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
            <div style={{ fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pick(p, 'text', 'caption', 'title') || '(no caption)'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--v3-muted)' }}>{dateOf(pick(p, 'createdAt', 'publishedAt', 'date'))} · ❤ {pick(p, 'likeCount', 'likes') ?? 0} · 💝 {pick(p, 'tipCount', 'tips') ?? 0}</div>
          </button>
        ))}
      </div>
      <div className="v3-card">
        {!sel ? <p style={{ color: 'var(--v3-muted)' }}>Select a post to see engagement & manage it.</p> :
          !detail ? 'Loading…' : (<>
            <div className="v3-card-head"><h3>Manage post</h3></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <button style={btn} onClick={() => editPost(sel)}>✏️ Edit</button>
              <button style={btn} onClick={() => pin(sel)}>📌 Pin</button>
              <button style={btn} onClick={() => repost(sel)}>🔁 Repost</button>
              <button style={{ ...btn, color: 'var(--v3-danger)' }} onClick={() => delPost(sel)}>🗑 Delete</button>
            </div>
            <Section title={`❤ Likes (${detail.likes.length})`} rows={detail.likes} render={(l, i) => <Row key={i} main={nameOf(l)} />} />
            <Section title={`💝 Tips (${detail.tips.length})`} rows={detail.tips} render={(t, i) => <Row key={i} main={nameOf(t)} right={money(pick(t, 'amount', 'total', 'value'))} />} />
            <div className="v3-card-head" style={{ marginTop: 4 }}><h3 style={{ fontSize: '0.78rem' }}>💬 Comments ({detail.comments.length})</h3><button style={btn} onClick={() => addComment(sel)}>+ Comment</button></div>
            {detail.comments.length === 0 ? <p style={{ color: 'var(--v3-muted)', fontSize: '0.82rem' }}>None.</p> :
              detail.comments.slice(0, 30).map((c, i) => <Row key={i} main={nameOf(c)} sub={pick(c, 'text', 'content', 'body')} right="✕" onClick={() => delComment(sel, c)} />)}
          </>)}
      </div>
    </div>
  );
}

// ─── Fans (subscribers / followers / top spenders) ──────────────────────────
function FansTab() {
  const [subs, setSubs] = useState<any[] | undefined>(undefined);
  const [followers, setFollowers] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);
  useEffect(() => {
    fanvueSubscribers().then(d => setSubs(asArray(d))).catch(() => setSubs([]));
    fanvueGet('/followers').then(d => setFollowers(asArray(d))).catch(() => {});
    fanvueTopFans().then(d => setTop(asArray(d))).catch(() => {});
  }, []);
  if (subs === undefined) return <div className="v3-card">Loading fans…</div>;
  const Card = ({ title, list, spend }: { title: string; list: any[]; spend?: boolean }) => (
    <div className="v3-card">
      <div className="v3-card-head"><h3>{title} ({list.length})</h3></div>
      {list.length === 0 ? <p style={{ color: 'var(--v3-muted)' }}>None.</p> :
        list.slice(0, 60).map((f, i) => <Row key={i} main={nameOf(f)} right={spend ? money(pick(f, 'totalSpent', 'spent', 'lifetimeSpend')) : undefined} />)}
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Card title="Subscribers" list={subs} spend />
      <Card title="Top spenders" list={top} spend />
      <Card title="Followers" list={followers} />
    </div>
  );
}

// ─── Earnings ───────────────────────────────────────────────────────────────
function EarningsTab() {
  const [summary, setSummary] = useState<any>(undefined);
  const [rows, setRows] = useState<any[] | undefined>(undefined);
  useEffect(() => {
    fanvueEarningsSummary().then(setSummary).catch(() => setSummary(null));
    fanvueEarningsData().then(d => setRows(asArray(d))).catch(() => setRows([]));
  }, []);
  return (<>
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
            <thead><tr style={{ textAlign: 'left', color: 'var(--v3-muted)' }}><th style={{ padding: '6px 8px' }}>Date</th><th style={{ padding: '6px 8px' }}>Type</th><th style={{ padding: '6px 8px' }}>Fan</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{rows.slice(0, 50).map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--v3-line)' }}>
                <td style={{ padding: '6px 8px' }}>{dateOf(pick(r, 'createdAt', 'date', 'created'))}</td>
                <td style={{ padding: '6px 8px' }}>{pick(r, 'type', 'source', 'kind') || '—'}</td>
                <td style={{ padding: '6px 8px' }}>{nameOf(r)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{money(pick(r, 'amount', 'gross', 'net', 'total'))}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  </>);
}

// ─── Vault (folders → media) ────────────────────────────────────────────────
function VaultTab() {
  const [folders, setFolders] = useState<any[] | undefined>(undefined);
  const [sel, setSel] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const load = () => fanvueGet('/vault/folders').then(d => setFolders(asArray(d))).catch(() => setFolders([]));
  useEffect(() => { load(); }, []);
  const nameOfF = (f: any) => pick(f, 'name', 'folderName', 'id');
  const open = async (f: any) => { setSel(f); setMedia(asArray(await fanvueGet(`/vault/folders/${encodeURIComponent(nameOfF(f))}/media`))); };
  const create = async () => { const n = ask('Folder name:'); if (!n) return; await run(fanvuePost('/vault/folders', { name: n }), load); };
  const rename = async (f: any) => { const n = ask('Rename folder:', nameOfF(f)); if (!n) return; await run(fanvuePatch(`/vault/folders/${encodeURIComponent(nameOfF(f))}`, { name: n }), () => { load(); setSel(null); }); };
  const del = async (f: any) => { if (!sure('Delete folder? (media is kept)')) return; await run(fanvueDelete(`/vault/folders/${encodeURIComponent(nameOfF(f))}`), () => { load(); setSel(null); }); };
  if (folders === undefined) return <div className="v3-card">Loading vault…</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14 }}>
      <div className="v3-card">
        <div className="v3-card-head"><h3>Folders</h3><button style={btn} onClick={create}>+ Folder</button></div>
        {folders.length === 0 ? <p style={{ color: 'var(--v3-muted)' }}>No folders.</p> :
          folders.map((f, i) => <Row key={i} onClick={() => open(f)} active={sel === f} main={pick(f, 'name', 'folderName') || 'Folder'} right={String(pick(f, 'mediaCount', 'count') ?? '')} />)}
      </div>
      <div className="v3-card">
        <div className="v3-card-head"><h3>{sel ? nameOfF(sel) : 'Media'}</h3>
          {sel && <span style={{ display: 'flex', gap: 6 }}><button style={btn} onClick={() => rename(sel)}>Rename</button><button style={{ ...btn, color: 'var(--v3-danger)' }} onClick={() => del(sel)}>Delete</button></span>}
        </div>
        {!sel ? <p style={{ color: 'var(--v3-muted)' }}>Pick a folder.</p> : <MediaGrid items={media} />}
      </div>
    </div>
  );
}

// ─── Fan Lists (custom + smart) ─────────────────────────────────────────────
function ListsTab() {
  const [custom, setCustom] = useState<any[]>([]);
  const [smart, setSmart] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const load = async () => {
    setCustom(asArray(await fanvueGet('/custom-lists').catch(() => null)));
    setSmart(asArray(await fanvueGet('/smart-lists').catch(() => null)));
    setLoaded(true);
  };
  useEffect(() => { load(); }, []);
  const idOf = (l: any) => pick(l, 'uuid', 'id');
  const create = async () => { const n = ask('New list name:'); if (!n) return; await run(fanvuePost('/custom-lists', { name: n }), load); };
  const rename = async (l: any) => { const n = ask('Rename list:', pick(l, 'name', 'title') || ''); if (!n) return; await run(fanvuePatch(`/custom-lists/${idOf(l)}`, { name: n }), load); };
  const del = async (l: any) => { if (!sure('Delete this list?')) return; await run(fanvueDelete(`/custom-lists/${idOf(l)}`), load); };
  if (!loaded) return <div className="v3-card">Loading lists…</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div className="v3-card">
        <div className="v3-card-head"><h3>Custom lists ({custom.length})</h3><button style={btn} onClick={create}>+ List</button></div>
        {custom.length === 0 ? <p style={{ color: 'var(--v3-muted)' }}>None.</p> :
          custom.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--v3-line)', padding: '8px 4px' }}>
              <span style={{ flex: 1 }}>{pick(l, 'name', 'title') || 'List'} <span style={{ color: 'var(--v3-muted)' }}>· {pick(l, 'memberCount', 'members', 'count') ?? 0}</span></span>
              <button style={btn} onClick={() => rename(l)}>Rename</button>
              <button style={{ ...btn, color: 'var(--v3-danger)' }} onClick={() => del(l)}>Delete</button>
            </div>
          ))}
      </div>
      <div className="v3-card"><div className="v3-card-head"><h3>Smart lists ({smart.length})</h3></div>
        {smart.length === 0 ? <p style={{ color: 'var(--v3-muted)' }}>None.</p> :
          smart.map((l, i) => <Row key={i} main={pick(l, 'name', 'title') || 'List'} right={String(pick(l, 'memberCount', 'members', 'count') ?? '')} />)}
        <p style={{ fontSize: '0.74rem', color: 'var(--v3-muted)', marginTop: 8 }}>Smart lists are auto-managed by Fanvue (read-only).</p>
      </div>
    </div>
  );
}

// ─── Media library ──────────────────────────────────────────────────────────
function MediaTab() {
  const [d, setD] = useState<any>(undefined);
  useEffect(() => { fanvueGet('/user/media').then(setD).catch(() => setD(null)); }, []);
  if (d === undefined) return <div className="v3-card">Loading media…</div>;
  if (d?.error) return <ErrCard d={d} />;
  return <div className="v3-card"><div className="v3-card-head"><h3>Media</h3></div><MediaGrid items={asArray(d)} /><RawPeek d={d} /></div>;
}

// ─── Tracking links ─────────────────────────────────────────────────────────
function TrackingTab() {
  const [d, setD] = useState<any>(undefined);
  const load = () => fanvueGet('/tracking-links').then(setD).catch(() => setD(null));
  useEffect(() => { load(); }, []);
  const create = async () => { const n = ask('Tracking link name:'); if (!n) return; await run(fanvuePost('/tracking-links', { name: n }), load); };
  const del = async (r: any) => { if (!sure('Delete this tracking link?')) return; await run(fanvueDelete(`/tracking-links/${pick(r, 'uuid', 'id')}`), load); };
  if (d === undefined) return <div className="v3-card">Loading tracking links…</div>;
  if (d?.error) return <ErrCard d={d} />;
  const rows = asArray(d);
  return <div className="v3-card">
    <div className="v3-card-head"><h3>Tracking links</h3><button style={btn} onClick={create}>+ New link</button></div>
    {rows.length === 0 ? <p style={{ color: 'var(--v3-muted)' }}>None.</p> :
      rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--v3-line)', padding: '8px 4px' }}>
          <span style={{ flex: 1, minWidth: 0 }}><b>{pick(r, 'name', 'label', 'slug') || 'Link'}</b><span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--v3-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pick(r, 'url', 'shortUrl') || ''}</span></span>
          <span style={{ color: 'var(--v3-muted)', fontSize: '0.78rem' }}>{pick(r, 'clicks', 'impressions', 'userCount') ?? 0}</span>
          <button style={{ ...btn, color: 'var(--v3-danger)' }} onClick={() => del(r)}>Delete</button>
        </div>
      ))}
    <RawPeek d={d} />
  </div>;
}

// ─── Broadcast (mass messages) ──────────────────────────────────────────────
function BroadcastTab() {
  const [text, setText] = useState('');
  const [sent, setSent] = useState<any[] | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const load = () => fanvueGet('/mass-messages').then(d => setSent(asArray(d))).catch(() => setSent([]));
  useEffect(() => { load(); }, []);
  const send = async () => {
    if (!text.trim()) return; setBusy(true);
    const ok = await run(fanvuePost('/mass-messages', { text }), () => { setText(''); load(); });
    setBusy(false); if (ok) alert('Broadcast sent.');
  };
  const del = async (m: any) => { if (!sure('Unsend / delete this broadcast?')) return; await run(fanvueDelete(`/mass-messages/${pick(m, 'uuid', 'id')}`), load); };
  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 720 }}>
      <div className="v3-card">
        <div className="v3-card-head"><h3>New broadcast</h3></div>
        <p style={{ fontSize: '0.82rem', color: 'var(--v3-muted)', marginTop: 0 }}>Sends a mass message to your audience on Fanvue.</p>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write your broadcast…" rows={4}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v3-line)', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }} />
        <button className="v3-btn v3-btn-primary" style={{ marginTop: 10 }} disabled={busy || !text.trim()} onClick={send}>Send broadcast</button>
      </div>
      <div className="v3-card">
        <div className="v3-card-head"><h3>Sent broadcasts</h3></div>
        {sent === undefined ? 'Loading…' : sent.length === 0 ? <p style={{ color: 'var(--v3-muted)' }}>None yet.</p> :
          sent.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--v3-line)', padding: '8px 4px' }}>
              <span style={{ flex: 1, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{pick(m, 'text', 'content', 'message') || '(media)'}</span><span style={{ fontSize: '0.74rem', color: 'var(--v3-muted)' }}>{dateOf(pick(m, 'createdAt', 'sentAt', 'scheduledAt'))}</span></span>
              <button style={{ ...btn, color: 'var(--v3-danger)' }} onClick={() => del(m)}>Delete</button>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Notifications ──────────────────────────────────────────────────────────
function NotificationsTab() {
  const [d, setD] = useState<any>(undefined);
  useEffect(() => { fanvueGet('/notifications').then(setD).catch(() => setD(null)); }, []);
  if (d === undefined) return <div className="v3-card">Loading…</div>;
  if (d?.error) return <ErrCard d={d} />;
  const rows = asArray(d);
  return <div className="v3-card"><div className="v3-card-head"><h3>Notifications</h3></div>
    {rows.length === 0 ? <p style={{ color: 'var(--v3-muted)' }}>Nothing new.</p> :
      rows.map((n, i) => <Row key={i} main={pick(n, 'title', 'type', 'kind') || 'Notification'} sub={pick(n, 'message', 'text', 'body')} right={dateOf(pick(n, 'createdAt', 'date'))} />)}
    <RawPeek d={d} />
  </div>;
}

// ─── shared bits ────────────────────────────────────────────────────────────
function Row({ main, sub, right, onClick, active }: { main: string; sub?: any; right?: string; onClick?: () => void; active?: boolean }) {
  const C: any = onClick ? 'button' : 'div';
  return (
    <C onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', textAlign: 'left', padding: '9px 6px', borderTop: '1px solid var(--v3-line)', background: active ? 'var(--v3-cream-deep)' : 'transparent', border: onClick ? 'none' : undefined, borderTopWidth: 1, cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: '0.86rem' }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>{main}</span>
        {sub && <span style={{ display: 'block', color: 'var(--v3-muted)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(sub)}</span>}
      </span>
      {right && <span style={{ color: 'var(--v3-muted)', fontWeight: 700, flexShrink: 0 }}>{right}</span>}
    </C>
  );
}
function Section({ title, rows, render }: { title: string; rows: any[]; render: (r: any, i: number) => ReactElement }) {
  return (<div style={{ marginBottom: 14 }}>
    <p style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--v3-ink-soft)', margin: '0 0 4px' }}>{title}</p>
    {rows.length === 0 ? <p style={{ color: 'var(--v3-muted)', fontSize: '0.82rem', margin: 0 }}>None.</p> : rows.slice(0, 30).map(render)}
  </div>);
}
function MediaGrid({ items }: { items: any[] }) {
  if (!items || items.length === 0) return <p style={{ color: 'var(--v3-muted)' }}>No media.</p>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
      {items.slice(0, 60).map((m, i) => {
        const url = pick(m, 'thumbnailUrl', 'thumbnail', 'url', 'previewUrl') || pick(m.media || {}, 'thumbnailUrl', 'url');
        return <div key={i} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--v3-cream-deep)' }}>
          {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--v3-muted)', fontSize: '0.7rem' }}>{pick(m, 'type', 'mimeType') || 'media'}</div>}
        </div>;
      })}
    </div>
  );
}
function ErrCard({ d }: { d: any }) {
  return <div className="v3-card" style={{ borderLeft: '3px solid var(--v3-danger)' }}>
    <b>Couldn’t load.</b> {d?.error || 'Unknown error'}
    {d?.needsConnect && <div style={{ marginTop: 6, fontSize: '0.84rem', color: 'var(--v3-muted)' }}>Token may have expired — reconnect on the Connection tab.</div>}
  </div>;
}
function RawPeek({ d }: { d: any }) {
  const [open, setOpen] = useState(false);
  return (<div style={{ marginTop: 12 }}>
    <button onClick={() => setOpen(o => !o)} style={{ border: 'none', background: 'none', color: 'var(--v3-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>{open ? '▾ hide raw data' : '▸ raw data'}</button>
    {open && <pre style={{ background: 'var(--v3-cream-deep)', padding: 12, borderRadius: 8, fontSize: '0.72rem', overflowX: 'auto', maxHeight: 300 }}>{JSON.stringify(d, null, 2)}</pre>}
  </div>);
}
