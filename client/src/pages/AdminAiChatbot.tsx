import { useEffect, useRef, useState } from 'react';
import {
  getAiSettings, updateAiSettings, getAiStarterTemplate, testAiReply,
  verifyTelegramBot, sendTelegramTest,
} from '../api';
import type { AiSettings } from '../api';

const MODEL_OPTIONS = [
  { value: 'sao10k/l3.3-euryale-70b',           label: 'Euryale 70B L3.3 (recommended — NSFW-tuned, ~$0.70/M)' },
  { value: 'sao10k/l3.1-euryale-70b',           label: 'Euryale 70B L3.1 (older, similar voice)' },
  { value: 'anthracite-org/magnum-v4-72b',      label: 'Magnum 72B (premium quality, ~$4/M)' },
  { value: 'thedrummer/rocinante-12b',          label: 'Rocinante 12B (fast & cheap, ~$0.20/M)' },
  { value: 'thedrummer/unslopnemo-12b',         label: 'UnslopNemo 12B (cheap alternative)' },
];

type ChatTurn = { role: 'user' | 'assistant'; content: string };

const AdminAiChatbot = ({ isDark }: { isDark: boolean }) => {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [savingMsg, setSavingMsg] = useState('');
  const [sandboxHistory, setSandboxHistory] = useState<ChatTurn[]>([]);
  const [sandboxInput, setSandboxInput] = useState('');
  const [sandboxBusy, setSandboxBusy] = useState(false);
  const [sandboxErr, setSandboxErr] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAiSettings().then(setSettings).catch(() => setSettings(null));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sandboxHistory, sandboxBusy]);

  if (!settings) return <div style={{ padding: 24, color: isDark ? '#888' : '#666' }}>Loading…</div>;

  const C = {
    bg:       isDark ? '#0a0a0a' : '#fff',
    panel:    isDark ? '#111'    : '#fafafa',
    border:   isDark ? '#1a1a1a' : '#e8e8e8',
    text:     isDark ? '#fff'    : '#111',
    muted:    isDark ? '#888'    : '#777',
    inputBg:  isDark ? '#050505' : '#fff',
    fanBubble:    isDark ? '#1a1a1a' : '#f0e8df',
    creatorBubble: '#c45c3a',
  };

  const save = async () => {
    setSavingMsg('Saving…');
    const payload: any = {
      aiPersonaPrompt: settings.aiPersonaPrompt,
      aiModel: settings.aiModel,
      aiNsfwLevel: settings.aiNsfwLevel,
      aiPpvEnabled: settings.aiPpvEnabled,
      aiPpvCadence: settings.aiPpvCadence,
      aiApprovalRequired: settings.aiApprovalRequired,
      aiApprovalTimeoutSec: settings.aiApprovalTimeoutSec,
      telegramChatId: settings.telegramChatId,
    };
    // Only send token if user just typed a new one (held in _newToken)
    const newToken = (settings as any)._newToken;
    if (newToken) payload.telegramBotToken = newToken;
    await updateAiSettings(payload);
    // Refetch to clear _newToken and re-read masked state
    const fresh = await getAiSettings();
    setSettings(fresh);
    setSavingMsg('Saved ✓');
    setTimeout(() => setSavingMsg(''), 1800);
  };

  const loadStarter = async () => {
    const { template } = await getAiStarterTemplate();
    setSettings({ ...settings, aiPersonaPrompt: template });
  };

  const sendSandbox = async () => {
    const text = sandboxInput.trim();
    if (!text || sandboxBusy) return;
    setSandboxErr('');
    const nextHistory: ChatTurn[] = [...sandboxHistory, { role: 'user', content: text }];
    setSandboxHistory(nextHistory);
    setSandboxInput('');
    setSandboxBusy(true);
    try {
      const res = await testAiReply(nextHistory);
      if (res.error) {
        setSandboxErr(res.detail || res.error);
      } else {
        const reply = (res.text || '').trim() || '(empty reply)';
        const withPpv = res.collectionId ? `${reply}\n\n📎 [PPV attached: collection #${res.collectionId}]` : reply;
        setSandboxHistory([...nextHistory, { role: 'assistant', content: withPpv }]);
      }
    } catch (e: any) {
      setSandboxErr(e.message || 'Request failed');
    }
    setSandboxBusy(false);
  };

  const resetSandbox = () => { setSandboxHistory([]); setSandboxErr(''); };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 24, alignItems: 'start' }}>
      {/* LEFT — settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <h2 style={{ margin: 0, color: C.text, fontSize: '1.4rem' }}>AI Chatbot</h2>
          <p style={{ margin: '6px 0 0', color: C.muted, fontSize: '0.85rem' }}>
            Auto-reply to fan DMs in your voice. Turn on per-thread from the Messages tab.
          </p>
        </div>

        {/* Persona */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontWeight: 700, color: C.text, fontSize: '0.85rem' }}>Persona / voice prompt</label>
            <button onClick={loadStarter} style={{
              fontSize: '0.74rem', padding: '5px 10px', borderRadius: 6,
              border: `1px solid ${C.border}`, background: 'transparent', color: C.text, cursor: 'pointer',
            }}>Use starter template</button>
          </div>
          <textarea
            value={settings.aiPersonaPrompt || ''}
            onChange={(e) => setSettings({ ...settings, aiPersonaPrompt: e.target.value })}
            placeholder="Describe how you talk, your vibe, your interests. Example: I'm a 19yo NYC girl who's into vintage shopping and matcha. I text in lowercase, use 'ngl' and 'fr' a lot…"
            rows={8}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: 12, borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.inputBg, color: C.text, fontSize: '0.85rem',
              fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5,
            }}
          />
          <p style={{ margin: '6px 0 0', color: C.muted, fontSize: '0.74rem' }}>
            This is the script the AI uses to act like you. Edit anytime — changes apply instantly to the next reply.
          </p>
        </div>

        {/* Model + NSFW */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontWeight: 700, color: C.text, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>Model</label>
            <select
              value={MODEL_OPTIONS.some(m => m.value === settings.aiModel) ? settings.aiModel : '__custom'}
              onChange={(e) => {
                if (e.target.value === '__custom') return;
                setSettings({ ...settings, aiModel: e.target.value });
              }}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${C.border}`, background: C.inputBg, color: C.text, fontSize: '0.82rem' }}
            >
              {MODEL_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              <option value="__custom">Custom (paste slug below)</option>
            </select>
            <input
              type="text"
              value={settings.aiModel}
              onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 6, borderRadius: 6, border: `1px solid ${C.border}`, background: C.inputBg, color: C.muted, fontSize: '0.74rem', fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 700, color: C.text, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>NSFW level</label>
            {(['off', 'flirty', 'explicit'] as const).map(lvl => (
              <label key={lvl} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: '0.82rem', color: C.text, textTransform: 'capitalize' }}>
                <input
                  type="radio"
                  checked={settings.aiNsfwLevel === lvl}
                  onChange={() => setSettings({ ...settings, aiNsfwLevel: lvl })}
                  style={{ accentColor: '#c45c3a' }}
                />
                {lvl}
              </label>
            ))}
          </div>
        </div>

        {/* PPV */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={!!settings.aiPpvEnabled}
              onChange={(e) => setSettings({ ...settings, aiPpvEnabled: e.target.checked })}
              style={{ accentColor: '#c45c3a' }}
            />
            <span style={{ fontWeight: 700, color: C.text, fontSize: '0.85rem' }}>Allow AI to attach PPV from vault</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 26, opacity: settings.aiPpvEnabled ? 1 : 0.4 }}>
            <span style={{ color: C.muted, fontSize: '0.78rem' }}>Min fan messages between PPVs:</span>
            <input
              type="number" min={1} max={50}
              value={settings.aiPpvCadence}
              onChange={(e) => setSettings({ ...settings, aiPpvCadence: parseInt(e.target.value, 10) || 8 })}
              disabled={!settings.aiPpvEnabled}
              style={{ width: 70, padding: 6, borderRadius: 6, border: `1px solid ${C.border}`, background: C.inputBg, color: C.text, fontSize: '0.82rem' }}
            />
          </div>
        </div>

        {/* PPV Approval flow */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={!!settings.aiApprovalRequired}
              onChange={(e) => setSettings({ ...settings, aiApprovalRequired: e.target.checked })}
              style={{ accentColor: '#c45c3a' }}
            />
            <span style={{ fontWeight: 700, color: C.text, fontSize: '0.85rem' }}>Require my approval before AI sends PPV</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 26, opacity: settings.aiApprovalRequired ? 1 : 0.4 }}>
            <span style={{ color: C.muted, fontSize: '0.78rem' }}>Auto-send if no decision in:</span>
            <input
              type="number" min={60} max={3600} step={60}
              value={settings.aiApprovalTimeoutSec || 600}
              onChange={(e) => setSettings({ ...settings, aiApprovalTimeoutSec: parseInt(e.target.value, 10) || 600 })}
              disabled={!settings.aiApprovalRequired}
              style={{ width: 90, padding: 6, borderRadius: 6, border: `1px solid ${C.border}`, background: C.inputBg, color: C.text, fontSize: '0.82rem' }}
            />
            <span style={{ color: C.muted, fontSize: '0.78rem' }}>seconds ({Math.round((settings.aiApprovalTimeoutSec || 600) / 60)} min)</span>
          </div>
          <p style={{ margin: '10px 0 0', color: C.muted, fontSize: '0.72rem', lineHeight: 1.5 }}>
            Plain chat replies always auto-send instantly. Only PPV attaches wait for you. Approve from this panel's Messages tab OR via Telegram (set up below).
          </p>
        </div>

        {/* Telegram setup */}
        <TelegramSection settings={settings} setSettings={setSettings} C={C} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={save} style={{
            padding: '10px 22px', borderRadius: 8, border: 'none',
            background: '#c45c3a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem',
          }}>Save settings</button>
          <span style={{ color: C.muted, fontSize: '0.8rem' }}>{savingMsg}</span>
        </div>
      </div>

      {/* RIGHT — sandbox */}
      <div style={{ position: 'sticky', top: 16, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', maxHeight: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, color: C.text, fontSize: '0.95rem' }}>🧪 Test Chat</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowRaw(s => !s)} title="Toggle raw vs formatted view"
              style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer' }}>
              {showRaw ? 'Hide raw' : 'Raw'}
            </button>
            <button onClick={resetSandbox} style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer' }}>Reset</button>
          </div>
        </div>
        <p style={{ margin: '0 0 10px', color: C.muted, fontSize: '0.74rem' }}>
          Stateless preview using your current saved settings. Save first, then test.
        </p>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
          {sandboxHistory.length === 0 && !sandboxBusy && (
            <p style={{ color: C.muted, fontSize: '0.82rem', textAlign: 'center', margin: 'auto 0' }}>Type a message below to test the AI's reply.</p>
          )}
          {sandboxHistory.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '8px 12px',
                borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: m.role === 'user' ? C.creatorBubble : C.fanBubble,
                color: m.role === 'user' ? '#fff' : C.text,
                fontSize: '0.85rem', lineHeight: 1.45, whiteSpace: showRaw ? 'pre-wrap' : 'pre-wrap',
                wordBreak: 'break-word',
              }}>{m.content}</div>
            </div>
          ))}
          {sandboxBusy && (
            <div style={{ alignSelf: 'flex-start', color: C.muted, fontSize: '0.8rem', padding: '4px 12px', fontStyle: 'italic' }}>
              typing…
            </div>
          )}
          {sandboxErr && (
            <div style={{ background: '#3a1818', color: '#ff9090', padding: 10, borderRadius: 6, fontSize: '0.78rem' }}>
              ⚠ {sandboxErr}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <input
            type="text"
            value={sandboxInput}
            onChange={(e) => setSandboxInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendSandbox(); }}
            placeholder="hey beautiful…"
            disabled={sandboxBusy}
            style={{ flex: 1, padding: 10, borderRadius: 6, border: `1px solid ${C.border}`, background: C.inputBg, color: C.text, fontSize: '0.85rem' }}
          />
          <button onClick={sendSandbox} disabled={sandboxBusy || !sandboxInput.trim()}
            style={{ padding: '0 16px', borderRadius: 6, border: 'none', background: '#c45c3a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: (sandboxBusy || !sandboxInput.trim()) ? 0.5 : 1 }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Telegram setup sub-component ──────────────────────────────────
function TelegramSection({ settings, setSettings, C }: { settings: AiSettings; setSettings: (s: AiSettings) => void; C: any }) {
  const [tokenInput, setTokenInput] = useState('');
  const [verifyMsg, setVerifyMsg] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const verifyAndSet = async () => {
    setVerifyMsg('Verifying…');
    const r = await verifyTelegramBot(tokenInput.trim());
    if (r.ok) {
      setVerifyMsg(`✅ @${r.username} — token valid. Click Save below.`);
      // Stash the unsaved token in settings; will be sent on Save
      (setSettings as any)({ ...settings, telegramBotTokenSet: true, _newToken: tokenInput.trim() });
      setTokenInput('');
    } else {
      setVerifyMsg(`❌ ${r.detail || r.error}`);
    }
  };

  const sendTest = async () => {
    setTestMsg('Sending…');
    const r = await sendTelegramTest();
    setTestMsg(r.ok ? '✅ Sent — check your Telegram' : `❌ ${r.detail || r.error}`);
  };

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: C.text, fontSize: '0.95rem' }}>📱 Telegram approval bot</span>
        <button onClick={() => setShowHelp(s => !s)} style={{
          fontSize: '0.72rem', padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
          background: 'transparent', color: C.muted, cursor: 'pointer',
        }}>{showHelp ? 'Hide setup' : 'How to set up'}</button>
      </div>
      <p style={{ margin: '4px 0 12px', color: C.muted, fontSize: '0.78rem' }}>
        Get phone notifications when AI wants approval. Tap Send/Reject from the notification.
      </p>

      {showHelp && (
        <ol style={{ margin: '4px 0 14px', paddingLeft: 18, fontSize: '0.78rem', color: C.text, lineHeight: 1.7 }}>
          <li>Open Telegram → search <b>@BotFather</b> → start chat</li>
          <li>Send <code style={{ background: C.inputBg, padding: '1px 6px', borderRadius: 4 }}>/newbot</code> → pick a name (e.g. "Cristina AI") → pick a username (must end in <code>_bot</code>)</li>
          <li>Copy the <b>token</b> BotFather gives you and paste below ↓</li>
          <li>Click Verify, then Save</li>
          <li>Open Telegram → find your new bot by its username → send <code>/start</code> → it will reply with your <b>Chat ID</b></li>
          <li>Paste the Chat ID below ↓, then Save again</li>
          <li>Click "Send test message" to verify it works</li>
        </ol>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.76rem', color: C.muted }}>
            Bot Token {settings.telegramBotTokenSet && <span style={{ color: '#3a9d3a' }}>· ✓ configured</span>}
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="password"
              placeholder={settings.telegramBotTokenSet ? '••••••••••••••• (saved — paste new to replace)' : '123456789:ABC-DEF...'}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              style={{ flex: 1, padding: 8, borderRadius: 6, border: `1px solid ${C.border}`, background: C.inputBg, color: C.text, fontSize: '0.82rem', fontFamily: 'monospace' }}
            />
            <button onClick={verifyAndSet} disabled={!tokenInput.trim()}
              style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, cursor: 'pointer', fontSize: '0.78rem', opacity: tokenInput.trim() ? 1 : 0.4 }}>
              Verify
            </button>
          </div>
          {verifyMsg && <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: C.muted }}>{verifyMsg}</p>}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.76rem', color: C.muted }}>Chat ID</label>
          <input
            type="text"
            placeholder="e.g. 123456789"
            value={settings.telegramChatId || ''}
            onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
            style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 6, border: `1px solid ${C.border}`, background: C.inputBg, color: C.text, fontSize: '0.82rem', fontFamily: 'monospace' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={sendTest} disabled={!settings.telegramBotTokenSet || !settings.telegramChatId}
            style={{ padding: '8px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, cursor: 'pointer', fontSize: '0.8rem', opacity: (settings.telegramBotTokenSet && settings.telegramChatId) ? 1 : 0.4 }}>
            Send test message
          </button>
          <span style={{ fontSize: '0.74rem', color: C.muted }}>{testMsg}</span>
        </div>
      </div>
    </div>
  );
}

export default AdminAiChatbot;
