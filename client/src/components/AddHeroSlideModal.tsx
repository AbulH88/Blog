/**
 * Modal that asks the creator which image(s) to upload for a new hero slide:
 *   - Desktop only (16:7 landscape) — multi-select supported: each file
 *                  becomes its own new slide (fast bulk upload)
 *   - Mobile only  (4:5 portrait)   — single image
 *   - Both         — one matched desktop + mobile pair (single slide)
 *
 * Calls back with an array of slides for the parent to append to the active
 * album. Single-slide modes return a 1-item array; multi-desktop returns N.
 */
import { useState } from 'react';
import { uploadImage } from '../api';

type Kind = 'desktop' | 'mobile' | 'both';

interface Props {
  onClose: () => void;
  onAdd: (slides: Array<{ desktop?: string; mobile?: string }>) => void;
}

export default function AddHeroSlideModal({ onClose, onAdd }: Props) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [desktopFiles, setDesktopFiles] = useState<File[]>([]);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');

  const ready = (() => {
    if (kind === 'desktop') return desktopFiles.length > 0;
    if (kind === 'mobile') return !!mobileFile;
    if (kind === 'both') return desktopFiles.length === 1 && !!mobileFile;
    return false;
  })();

  const submit = async () => {
    if (!ready || uploading) return;
    setUploading(true);
    setError('');
    try {
      const slides: Array<{ desktop?: string; mobile?: string }> = [];

      if (kind === 'desktop') {
        // Multi-file: each file becomes its own slide
        setProgress({ done: 0, total: desktopFiles.length });
        for (let i = 0; i < desktopFiles.length; i++) {
          const r = await uploadImage(desktopFiles[i]);
          if (!r?.url) throw new Error(`Desktop upload failed (file ${i + 1})`);
          slides.push({ desktop: r.url });
          setProgress({ done: i + 1, total: desktopFiles.length });
        }
      } else if (kind === 'mobile') {
        const r = await uploadImage(mobileFile!);
        if (!r?.url) throw new Error('Mobile upload failed');
        slides.push({ mobile: r.url });
      } else if (kind === 'both') {
        const slide: { desktop?: string; mobile?: string } = {};
        const dR = await uploadImage(desktopFiles[0]);
        if (!dR?.url) throw new Error('Desktop upload failed');
        slide.desktop = dR.url;
        const mR = await uploadImage(mobileFile!);
        if (!mR?.url) throw new Error('Mobile upload failed');
        slide.mobile = mR.url;
        slides.push(slide);
      }

      onAdd(slides);
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
            { id: 'desktop', label: 'Desktop only', hint: '16:7 · multi OK', emoji: '🖥' },
            { id: 'mobile',  label: 'Mobile only',  hint: '4:5 portrait', emoji: '📱' },
            { id: 'both',    label: 'Both',         hint: 'Matched pair', emoji: '🖥📱' },
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
        {kind === 'desktop' && (
          <FileInput
            label="Desktop image(s) — 16:7 landscape · 1920×840 ideal"
            files={desktopFiles}
            multiple
            onPick={setDesktopFiles}
            hint="Pick multiple files (Ctrl-click or Shift-click) to create several slides at once"
          />
        )}
        {kind === 'both' && (
          <FileInput
            label="Desktop image — 16:7 landscape · 1920×840 ideal"
            files={desktopFiles.slice(0, 1)}
            multiple={false}
            onPick={(fs) => setDesktopFiles(fs.slice(0, 1))}
          />
        )}
        {(kind === 'mobile' || kind === 'both') && (
          <FileInput
            label="Mobile image — 4:5 portrait · 1080×1350 ideal"
            files={mobileFile ? [mobileFile] : []}
            multiple={false}
            onPick={(fs) => setMobileFile(fs[0] || null)}
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
            {uploading
              ? (progress.total > 1
                  ? `Uploading ${progress.done}/${progress.total}…`
                  : 'Uploading…')
              : (kind === 'desktop' && desktopFiles.length > 1
                  ? `Add ${desktopFiles.length} slides`
                  : 'Add slide')}
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

function FileInput({
  label,
  files,
  multiple = false,
  onPick,
  hint,
}: {
  label: string;
  files: File[];
  multiple?: boolean;
  onPick: (files: File[]) => void;
  hint?: string;
}) {
  const totalKB = files.reduce((s, f) => s + Math.round(f.size / 1024), 0);
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
          multiple={multiple}
          onChange={(e) => onPick(Array.from(e.target.files || []))}
          style={{ fontSize: '0.84rem', flex: 1, minWidth: 0 }}
        />
        {files.length > 0 && (
          <span style={{ fontSize: '0.74rem', color: 'var(--v3-muted)', whiteSpace: 'nowrap' }}>
            {files.length > 1 ? `${files.length} files · ` : ''}{totalKB} KB
          </span>
        )}
      </div>
      {hint && (
        <p style={{ margin: '6px 2px 0', fontSize: '0.7rem', color: 'var(--v3-muted)', lineHeight: 1.4 }}>
          💡 {hint}
        </p>
      )}
    </div>
  );
}
