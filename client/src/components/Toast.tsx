import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Toast notification system — replaces window.alert / inline ad-hoc banners.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success('Saved!');
 *   toast.error('Could not save — try again.');
 *   toast.info('Verification email sent.');
 *
 * Toasts stack bottom-right (desktop) / bottom-center (mobile), auto-dismiss
 * after 4 seconds, can be manually dismissed. Accessibility: role="status"
 * for non-error, role="alert" for error.
 */

type Kind = 'success' | 'error' | 'info';
type ToastItem = { id: number; kind: Kind; message: string };

interface ToastApi {
  success: (msg: string) => void;
  error:   (msg: string) => void;
  info:    (msg: string) => void;
}

const Ctx = createContext<{ toast: ToastApi } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: Kind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((arr) => [...arr, { id, kind, message }]);
    // Auto-dismiss
    setTimeout(() => {
      setItems((arr) => arr.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const api: ToastApi = {
    success: (m) => push('success', m),
    error:   (m) => push('error',   m),
    info:    (m) => push('info',    m),
  };

  return (
    <Ctx.Provider value={{ toast: api }}>
      {children}
      <ToastStack items={items} onDismiss={(id) => setItems((a) => a.filter((t) => t.id !== id))} />
    </Ctx.Provider>
  );
}

export function useToast(): { toast: ToastApi } {
  const v = useContext(Ctx);
  if (!v) {
    // Graceful: if a component renders outside the provider (shouldn't happen,
    // but possible during tests / errors), silently no-op rather than crash.
    return {
      toast: { success: () => {}, error: () => {}, info: () => {} },
    };
  }
  return v;
}

function ToastStack({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        right: 16, left: 16,
        zIndex: 5000,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
        alignItems: 'flex-end',
      }}>
      {items.map((t) => <Toast key={t.id} item={t} onDismiss={() => onDismiss(t.id)} />)}
    </div>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [enter, setEnter] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEnter(true), 10);
    return () => clearTimeout(t);
  }, []);

  const palette =
    item.kind === 'success' ? { bg: '#e8f5e9', border: '#7cb988', fg: '#1f4a25', icon: '✓' } :
    item.kind === 'error'   ? { bg: '#fdeceb', border: '#e09595', fg: '#742020', icon: '⚠' } :
                              { bg: '#fff5ec', border: '#e6b48a', fg: '#5a3a1f', icon: 'ℹ' };

  return (
    <div
      role={item.kind === 'error' ? 'alert' : 'status'}
      onClick={onDismiss}
      style={{
        pointerEvents: 'auto',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        padding: '12px 16px',
        borderRadius: 14,
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        fontSize: '0.92rem',
        fontWeight: 500,
        display: 'flex', alignItems: 'flex-start', gap: 10,
        maxWidth: 380,
        minWidth: 240,
        cursor: 'pointer',
        transform: enter ? 'translateY(0)' : 'translateY(20px)',
        opacity:   enter ? 1                : 0,
        transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s',
      }}>
      <span style={{
        flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
        background: palette.border, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.78rem', fontWeight: 800,
      }}>{palette.icon}</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{item.message}</span>
    </div>
  );
}
