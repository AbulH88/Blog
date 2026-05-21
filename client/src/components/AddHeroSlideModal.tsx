/**
 * Modal that asks the creator which image(s) to upload for a new hero slide:
 *   - Desktop only (16:5 landscape — used on PCs/tablets, fallback for mobile)
 *   - Mobile only  (4:5 portrait — used on phones, no desktop fallback yet)
 *   - Both         (one pair — desktop + mobile, perfectly matched per slide)
 *
 * Calls back with the URLs the parent should add to the active album's slides
 * array. The parent handles the actual upload (uses uploadImage).
 */
import { useState } from 'react';
import { uploadImage } from '../api';

type Kind = 'desktop' | 'mobile' | 'both';

interface Props {
  onClose: () => void;
  onAdd: (slide: { desktop?: string; mobile?: string }) => void;
}

export default function AddHeroSlideModal({ onClose, onAdd }: Props) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const ready = (() => {
    if (kind === 'desktop') return !!desktopFile;
    if (kind === 'mobile') return !!mobileFile;
    if (kind === 'both') return !!desktopFile && !!mobileFile;
    return false;
  })();

  const submit = async () => {
    if (!ready || uploading) return;
    setUploading(true);
    setError('');
    try {
      const slide: { desktop?: string; mobile?: string } = {};
      if (desktopFile) {
        const r = await uploadImage(desktopFile);
        if (!r?.url) throw new Error('Desktop upload failed');
        slide.desktop = r.url;
      }
      if (mobileFile) {
        const r = await uploadImage(mobileFile);
        if (!r?.url) throw new Error('Mobile upload failed');
        slide.mobile = r.url;
      }
      onAdd(slide);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2200,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16,
          width: '100%', maxWidth: 520,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          padding: 26,
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: -0.3 }}>
            Add a new hero slide
          </h2>
          <button onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--v3-muted)', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--v3-muted)', lineHeight: 1.5 }}>
          Pick how this slide should be displayed. Mobile uses a portrait crop so faces don't get cut off on phones.
        </p>

        {/* Kind picker */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
          {([
            { id: 'desktop', label: 'Desktop only', hint: '16:5 wide', emoji: '🖥' },
            { id: 'mobile',  label: 'Mobile only',  hint: '4:5 portrait', emoji: '📱' },
            { id: 'both',    label: 'Both',         hint: 'Recommended', emoji: '🖥📱' },
          ] as Array<{ id: Kind; label: string; hint: string; emoji: string }>).map((opt) => {
            const picked = kind === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => { setKind(opt.id); setError(''); }}
                style={{
                  padding: '14px 8px',
                  border: picked ? '2px solid var(--v3-terracotta)' : '1px solid var(--v3-rose-100)',
                  background: picked ? 'var(--v3-rose-50)' : '#fff',
                  borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                <span style={{ fontSize: '1.2rem' }}>{opt.emoji}</span>
                <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--v3-ink)' }}>{opt.label}</span>
                <span style={{ fontSize: '0.66rem', color: 'var(--v3-muted)' }}>{opt.hint}</span>
              </button>
            );
          })}
        </div>

        {/* File pickers — appear after kind selection */}
        {(kind === 'desktop' || kind === 'both') && (
          <FileInput
            label="Desktop image (16:5 landscape · 2400×750 ideal)"
            file={desktopFile}
            onPick={setDesktopFile}
          />
        )}
        {(kind === 'mobile' || kind === 'both') && (
          <FileInput
            label="Mobile image (4:5 portrait · 1080×1350 ideal)"
            file={mobileFile}
            onPick={setMobileFile}
          />
        )}

        {error && (
          <div style={{
            padding: '10px 12px', background: 'rgba(220,38,38,0.10)', color: 'var(--v3-danger)',
            borderRadius: 8, fontSize: '0.82rem', marginTop: 12,
          }}>⚠️ {error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            onClick={submit}
            disabled={!ready || uploading}
            style={{
              flex: 1, background: 'var(--v3-terracotta)', color: '#fff',
              border: 'none', borderRadius: 10, padding: '12px 0',
              fontWeight: 700, fontSize: '0.92rem',
              cursor: (!ready || uploading) ? 'not-allowed' : 'pointer',
              opacity: (!ready || uploading) ? 0.5 : 1,
              fontFamily: 'inherit',
            }}>
            {uploading ? 'Uploading…' : 'Add slide'}
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', color: 'var(--v3-ink-soft)',
              border: '1px solid var(--v3-rose-100)', borderRadius: 10, padding: '12px 18px',
              fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function FileInput({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File | null) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--v3-muted)', fontWeight: 700, marginBottom: 6, letterSpacing: 0.3 }}>
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        border: '1px solid var(--v3-rose-100)', borderRadius: 8,
        padding: '8px 10px', background: 'var(--v3-cream)',
      }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onPick(e.target.files?.[0] || null)}
          style={{ fontSize: '0.84rem', flex: 1, minWidth: 0 }}
        />
        {file && (
          <span style={{ fontSize: '0.74rem', color: 'var(--v3-muted)' }}>
            {Math.round(file.size / 1024)} KB
          </span>
        )}
      </div>
    </div>
  );
}
