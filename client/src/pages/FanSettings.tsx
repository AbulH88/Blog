import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CREATOR_SLUG,
  getCreator, getMyTransactions, getMySubscriptions, unsubscribe,
  getPaymentMethods, removePaymentMethod, setDefaultPaymentMethod,
  updateMyProfile, changeMyPassword, deleteMyAccount,
  type SavedCard,
} from '../api';
import FanSidebar from '../components/FanSidebar';
import MobileBottomNav from '../components/MobileBottomNav';
import AddCardModal from '../components/AddCardModal';

type Section = 'account' | 'payments' | 'notifications' | 'privacy' | 'help';
type PaymentsTab = 'cards' | 'subscriptions' | 'history';

const sections: { key: Section; label: string; icon: string }[] = [
  { key: 'account',       label: 'Account',                  icon: '👤' },
  { key: 'payments',      label: 'Payments and subscriptions', icon: '💳' },
  { key: 'notifications', label: 'Notifications',            icon: '🔔' },
  { key: 'privacy',       label: 'Privacy and safety',       icon: '🔒' },
  { key: 'help',          label: 'Help, terms and support',  icon: 'ℹ️' },
];

const FanSettings = () => {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const active = (sections.find(s => s.key === section)?.key) || 'account';

  const [fanUser, setFanUser] = useState<any>(JSON.parse(localStorage.getItem('fanUser') || 'null'));
  const [creator, setCreator] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Account form
  const [editingName, setEditingName] = useState(fanUser?.username || '');
  const [editingEmail, setEditingEmail] = useState(fanUser?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Payments
  const [methods, setMethods] = useState<SavedCard[]>([]);
  const [paymentsTab, setPaymentsTab] = useState<PaymentsTab>('cards');
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!localStorage.getItem('fanToken')) { navigate('/login'); return; }
    (async () => {
      const [c, m, s, t] = await Promise.all([
        getCreator().catch(() => null),
        getPaymentMethods().then(r => r.methods || []).catch(() => []),
        getMySubscriptions().then(r => r.subscriptions || r || []).catch(() => []),
        getMyTransactions().catch(() => []),
      ]);
      setCreator(c);
      setMethods(m);
      setSubscriptions(Array.isArray(s) ? s : []);
      setTransactions(Array.isArray(t) ? t : []);
      setLoading(false);
    })();
  }, [navigate]);

  // ── Action handlers ───────────────────────────────────────────
  const reloadCards = async () => setMethods((await getPaymentMethods()).methods || []);

  const saveProfile = async () => {
    setProfileMsg(null);
    const username = editingName.trim();
    const email = editingEmail.trim();
    if (!username) { setProfileMsg({ type: 'err', text: 'Username cannot be empty' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setProfileMsg({ type: 'err', text: 'Invalid email format' }); return; }
    setSavingProfile(true);
    try {
      const res = await updateMyProfile({ username, email });
      if (res?.error) { setProfileMsg({ type: 'err', text: res.error }); return; }
      const updated = { ...fanUser, username, email };
      localStorage.setItem('fanUser', JSON.stringify(updated));
      setFanUser(updated);
      setProfileMsg({ type: 'ok', text: 'Profile updated ✓' });
    } finally { setSavingProfile(false); }
  };

  const changePassword = async () => {
    setProfileMsg(null);
    if (!currentPassword) { setProfileMsg({ type: 'err', text: 'Current password required' }); return; }
    if (newPassword.length < 8) { setProfileMsg({ type: 'err', text: 'New password must be at least 8 characters' }); return; }
    if (newPassword !== confirmPassword) { setProfileMsg({ type: 'err', text: "Passwords don't match" }); return; }
    setSavingProfile(true);
    try {
      const res = await changeMyPassword({ currentPassword, newPassword });
      if (res?.error) { setProfileMsg({ type: 'err', text: res.error }); return; }
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setProfileMsg({ type: 'ok', text: 'Password changed ✓' });
    } finally { setSavingProfile(false); }
  };

  const removeCard = async (id: number) => {
    if (!confirm('Remove this card?')) return;
    await removePaymentMethod(id); reloadCards();
  };

  const makeDefault = async (id: number) => {
    await setDefaultPaymentMethod(id); reloadCards();
  };

  const cancelSubscription = async (slug: string, name: string) => {
    if (!confirm(`Cancel your follow with ${name}?`)) return;
    await unsubscribe(slug);
    const r = await getMySubscriptions().catch(() => []);
    setSubscriptions(Array.isArray(r) ? r : (r?.subscriptions || []));
  };

  // ── Transaction history rows ──────────────────────────────────
  const txnRows = useMemo(() => [...transactions]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .map(t => ({
      id: t.id,
      date: t.createdAt,
      type: t.type === 'tip' ? 'Tip'
          : t.collectionId ? 'Bundle'
          : t.messageId ? 'PPV'
          : t.postId ? 'Post'
          : t.type || 'Purchase',
      label: t.description || t.collectionTitle || t.postTitle || (t.type === 'tip' ? 'Tip sent' : 'Unlock'),
      amount: parseFloat(t.amount || 0),
      status: t.status || 'completed',
    })),
  [transactions]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--v3-ink-soft)' }}>Loading…</p>
      </div>
    );
  }

  // ── Section renderers ─────────────────────────────────────────
  const renderAccount = () => (
    <>
      <h2 style={panelHeadStyle}>Account</h2>
      {profileMsg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          background: profileMsg.type === 'ok' ? 'rgba(46, 160, 86, 0.12)' : 'rgba(220, 38, 38, 0.10)',
          color: profileMsg.type === 'ok' ? '#1f7a3f' : 'var(--v3-danger)',
          fontSize: '0.9rem',
        }}>{profileMsg.text}</div>
      )}

      <div className="v3-card" style={{ marginBottom: 16 }}>
        <h3 style={cardHeadStyle}>Profile</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <Field label="Display name">
            <input value={editingName} onChange={e => setEditingName(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Email">
            <input type="email" value={editingEmail} onChange={e => setEditingEmail(e.target.value)} style={inputStyle} />
          </Field>
          <div>
            <button onClick={saveProfile} disabled={savingProfile} style={primaryBtn(savingProfile)}>
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </div>
      </div>

      <div className="v3-card" style={{ marginBottom: 16 }}>
        <h3 style={cardHeadStyle}>Change password</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <Field label="Current password">
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="New password (≥ 8 chars)">
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Confirm new password">
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />
          </Field>
          <div>
            <button onClick={changePassword} disabled={savingProfile} style={primaryBtn(savingProfile)}>
              {savingProfile ? 'Saving…' : 'Change password'}
            </button>
          </div>
        </div>
      </div>

      <div className="v3-card" style={{ borderColor: 'rgba(220,38,38,0.2)' }}>
        <h3 style={{ ...cardHeadStyle, color: 'var(--v3-danger)' }}>Danger zone</h3>
        <p style={{ fontSize: '0.86rem', color: 'var(--v3-ink-soft)', margin: '0 0 12px' }}>
          Cancel your account. Your unlocked content stays accessible until you log out.
        </p>
        <button
          onClick={async () => {
            const ok = window.confirm('Cancel your account? You will not be charged again. Continue?');
            if (!ok) return;
            try { await unsubscribe(CREATOR_SLUG); } catch { /* ignore */ }
            localStorage.removeItem('fanToken');
            localStorage.removeItem('fanUser');
            navigate('/');
          }}
          style={{
            background: 'transparent', color: 'var(--v3-danger)',
            border: '1px solid var(--v3-danger)', borderRadius: 18,
            padding: '8px 18px', fontWeight: 700, cursor: 'pointer',
          }}>
          Cancel my account
        </button>
      </div>
    </>
  );

  const renderPayments = () => (
    <>
      <h2 style={panelHeadStyle}>Payments and subscriptions</h2>
      <p style={{ color: 'var(--v3-ink-soft)', fontSize: '0.88rem', margin: '0 0 14px' }}>
        Add or remove payment cards, manage your subscriptions, or see the history of your transactions.
      </p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--v3-rose-100)' }}>
        {([
          { key: 'cards' as const,         label: 'Wallet & payments' },
          { key: 'subscriptions' as const, label: 'My subscriptions' },
          { key: 'history' as const,       label: 'Transaction history' },
        ]).map(t => (
          <button key={t.key} onClick={() => setPaymentsTab(t.key)}
            style={{
              background: 'none', border: 'none',
              padding: '10px 14px', cursor: 'pointer',
              fontSize: '0.88rem', fontFamily: 'inherit',
              color: paymentsTab === t.key ? 'var(--v3-terracotta)' : 'var(--v3-ink-soft)',
              fontWeight: paymentsTab === t.key ? 700 : 500,
              borderBottom: paymentsTab === t.key ? '2px solid var(--v3-terracotta)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {paymentsTab === 'cards' && (
        <div className="v3-card">
          <h3 style={cardHeadStyle}>Saved cards</h3>
          {methods.length === 0 ? (
            <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem' }}>No saved cards yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: 18 }}>
              {methods.map(m => (
                <li key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12, border: '1px solid var(--v3-rose-100)',
                  borderRadius: 10, marginBottom: 8,
                }}>
                  <span style={{ fontSize: 22 }}>💳</span>
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>
                    <strong>{m.brand}</strong> •••• {m.last4}{' '}
                    <small style={{ color: 'var(--v3-muted)' }}>
                      {String(m.expMonth).padStart(2, '0')}/{m.expYear}
                    </small>
                    {m.isDefault && (
                      <span style={{
                        marginLeft: 8, fontSize: 10, background: 'var(--v3-rose-100)',
                        color: 'var(--v3-terracotta)', padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                      }}>DEFAULT</span>
                    )}
                  </span>
                  {!m.isDefault && (
                    <button onClick={() => makeDefault(m.id)} style={secondaryBtn}>Make default</button>
                  )}
                  <button onClick={() => removeCard(m.id)} style={{ ...secondaryBtn, color: 'var(--v3-danger)' }}>Remove</button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setAddCardOpen(true)}
            style={{
              marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--v3-terracotta)', color: '#fff', border: 'none',
              borderRadius: 22, padding: '10px 20px', fontSize: '0.86rem', fontWeight: 700,
              cursor: 'pointer',
            }}>
            <span style={{ fontSize: '1.1rem' }}>＋</span>
            Add new card
          </button>
        </div>
      )}

      {paymentsTab === 'subscriptions' && (
        <div className="v3-card">
          <h3 style={cardHeadStyle}>My subscriptions</h3>
          {subscriptions.length === 0 ? (
            <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem' }}>You're not following anyone yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {subscriptions.map(s => {
                const name = s.creator?.displayName || s.creatorName || s.slug;
                const slug = s.creator?.slug || s.creatorSlug || CREATOR_SLUG;
                const tier = s.tier || 'free';
                const since = s.startDate ? new Date(s.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
                return (
                  <li key={s.id || slug} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 12, border: '1px solid var(--v3-rose-100)',
                    borderRadius: 10, marginBottom: 8,
                  }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '0.92rem' }}>{name}</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
                        Tier: {tier}{since ? ` · since ${since}` : ''}
                      </p>
                    </div>
                    <button onClick={() => cancelSubscription(slug, name)} style={{ ...secondaryBtn, color: 'var(--v3-danger)' }}>
                      Cancel
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {paymentsTab === 'history' && (
        <div className="v3-card">
          <h3 style={cardHeadStyle}>Transaction history</h3>
          {txnRows.length === 0 ? (
            <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem' }}>No transactions yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--v3-muted)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Item</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {txnRows.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--v3-rose-100)' }}>
                      <td style={{ padding: '10px 6px', color: 'var(--v3-ink-soft)' }}>
                        {r.date ? new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        <span style={{
                          background: 'var(--v3-rose-100)', color: 'var(--v3-terracotta)',
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.74rem', fontWeight: 700,
                        }}>{r.type}</span>
                      </td>
                      <td style={{ padding: '10px 6px', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280, whiteSpace: 'nowrap' }}>{r.label}</td>
                      <td style={{ padding: '10px 6px', fontSize: '0.78rem', color: 'var(--v3-ink-soft)' }}>{r.status}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700 }}>${r.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );

  const renderNotifications = () => (
    <>
      <h2 style={panelHeadStyle}>Notifications</h2>
      <div className="v3-card">
        <p style={{ color: 'var(--v3-ink-soft)', fontSize: '0.9rem' }}>
          Notification preferences coming soon. For now, in-app messages from {creator?.siteTitle || 'creators'} arrive in your chat inbox.
        </p>
      </div>
    </>
  );

  const renderPrivacy = () => (
    <>
      <h2 style={panelHeadStyle}>Privacy and safety</h2>

      <div className="v3-card" style={{ marginBottom: 16 }}>
        <h3 style={cardHeadStyle}>Our policies</h3>
        <p style={{ color: 'var(--v3-ink-soft)', fontSize: '0.9rem', marginBottom: 12 }}>
          Review how your data is handled and your rights as a user.
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Link to="/privacy" style={linkStyle}>Privacy Policy →</Link>
          <Link to="/terms" style={linkStyle}>Terms of Service →</Link>
          <Link to="/2257" style={linkStyle}>Content Disclosure →</Link>
        </div>
      </div>

      <div className="v3-card" style={{ borderColor: 'rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.03)' }}>
        <h3 style={{ ...cardHeadStyle, color: 'var(--v3-danger)' }}>Delete my account</h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--v3-ink-soft)', lineHeight: 1.5, margin: '0 0 12px' }}>
          Permanently delete your account, profile, and content access. Your transaction
          history is retained for tax/payment-processor compliance (required by law) but
          will be anonymized. <strong>This action cannot be undone.</strong>
        </p>
        <button
          onClick={async () => {
            const pwd = window.prompt(
              'To confirm account deletion, type your current password:\n\n' +
              '⚠️ This will permanently delete your account. You will lose access immediately.\n\n' +
              '(Cancel to abort)'
            );
            if (!pwd) return;
            const confirmAgain = window.confirm(
              'Are you absolutely sure? This cannot be undone.\n\n' +
              'Click OK to delete your account permanently.'
            );
            if (!confirmAgain) return;

            const res = await deleteMyAccount(pwd);
            if (res?.ok) {
              alert('Account deleted. Goodbye.');
              localStorage.removeItem('fanToken');
              localStorage.removeItem('fanUser');
              navigate('/');
            } else {
              alert(res?.error || 'Deletion failed');
            }
          }}
          style={{
            background: 'transparent', color: 'var(--v3-danger)',
            border: '1px solid var(--v3-danger)', borderRadius: 22,
            padding: '9px 20px', fontSize: '0.86rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          Delete my account permanently
        </button>
      </div>
    </>
  );

  const renderHelp = () => (
    <>
      <h2 style={panelHeadStyle}>Help, terms and support</h2>
      <div className="v3-card">
        <h3 style={cardHeadStyle}>Policies</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
          <li style={{ padding: '8px 0' }}><Link to="/terms" style={linkStyle}>Terms of Service →</Link></li>
          <li style={{ padding: '8px 0' }}><Link to="/privacy" style={linkStyle}>Privacy Policy →</Link></li>
          <li style={{ padding: '8px 0' }}><Link to="/2257" style={linkStyle}>Content Disclosure →</Link></li>
        </ul>
        <h3 style={cardHeadStyle}>Need help?</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--v3-ink-soft)' }}>
          Reach out via the chat with {creator?.siteTitle || 'the creator'}, or email support.
        </p>
      </div>
    </>
  );

  const sectionNav = (mobile = false) => (
    <nav style={{
      width: mobile ? '100%' : 260,
      flexShrink: 0,
      padding: mobile ? '14px 12px' : 18,
      borderRight: mobile ? 'none' : '1px solid var(--v3-rose-100)',
      borderBottom: mobile ? '1px solid var(--v3-rose-100)' : 'none',
      background: 'var(--v3-cream)',
      minHeight: mobile ? 'auto' : '100vh',
      boxSizing: 'border-box',
    }}>
      <h2 style={{ fontSize: '1.1rem', margin: '6px 8px 14px', letterSpacing: 2, textTransform: 'uppercase' }}>Settings</h2>
      <div style={{
        display: mobile ? 'grid' : 'block',
        gridTemplateColumns: mobile ? 'repeat(auto-fit, minmax(160px, 1fr))' : undefined,
        gap: mobile ? 6 : 0,
      }}>
        {sections.map(s => {
          const isActive = s.key === active;
          return (
            <Link key={s.key} to={`/dashboard/settings/${s.key}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                marginBottom: mobile ? 0 : 4, textDecoration: 'none',
                color: isActive ? 'var(--v3-terracotta)' : 'var(--v3-ink)',
                background: isActive ? 'var(--v3-rose-100)' : 'transparent',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.9rem',
              }}>
              <span style={{ width: 22, textAlign: 'center' }}>{s.icon}</span>
              <span style={{ flex: 1 }}>{s.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );

  const detailPanel = (
    <section style={{ flex: 1, padding: 24, minWidth: 0, boxSizing: 'border-box' }}>
      {active === 'account'       && renderAccount()}
      {active === 'payments'      && renderPayments()}
      {active === 'notifications' && renderNotifications()}
      {active === 'privacy'       && renderPrivacy()}
      {active === 'help'          && renderHelp()}
    </section>
  );

  // ── Layout ────────────────────────────────────────────────────
  return (
    <>
      {/* Desktop shell ≥ 900px */}
      <div className="v3-fan-shell">
        <FanSidebar creator={creator} />
        <main className="v3-fan-main" style={{ display: 'flex', gap: 0, padding: 0 }}>
          {sectionNav(false)}
          {detailPanel}
        </main>
      </div>

      {/* Mobile layout < 900px */}
      <div className="v3-fan-mobile" style={{ paddingBottom: 70 }}>
        {sectionNav(true)}
        {detailPanel}
        <MobileBottomNav />
      </div>

      {addCardOpen && (
        <AddCardModal
          onClose={() => setAddCardOpen(false)}
          onAdded={reloadCards}
        />
      )}
    </>
  );
};

// ── Small style helpers ───────────────────────────────────────
const panelHeadStyle: React.CSSProperties = {
  fontSize: '1.4rem', margin: '0 0 16px', letterSpacing: 1,
};
const cardHeadStyle: React.CSSProperties = {
  fontSize: '0.96rem', margin: '0 0 12px', color: 'var(--v3-ink)',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--v3-rose-100)', fontSize: '0.9rem',
  fontFamily: 'inherit', background: '#fff', color: 'var(--v3-ink)',
};
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  background: 'var(--v3-terracotta)', color: '#fff', border: 'none',
  borderRadius: 18, padding: '9px 20px', fontSize: '0.86rem', fontWeight: 700,
  cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.6 : 1,
});
const secondaryBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--v3-rose-100)',
  borderRadius: 14, padding: '5px 12px', fontSize: '0.78rem',
  cursor: 'pointer', fontFamily: 'inherit', color: 'var(--v3-ink-soft)',
};
const linkStyle: React.CSSProperties = {
  color: 'var(--v3-terracotta)', textDecoration: 'none', fontWeight: 700,
  fontSize: '0.92rem',
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label style={{ display: 'block' }}>
    <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--v3-muted)', marginBottom: 4 }}>{label}</span>
    {children}
  </label>
);

export default FanSettings;
