/**
 * Dashboard CTA inviting fans to use the creator's Fanvue link as an alt
 * checkout (e.g. for card payments while crypto is the only option in-app).
 *
 * Renders nothing if `fanvueUrl` is empty — the creator can hide this entire
 * card by clearing the URL in the admin profile editor.
 */
interface Props {
  fanvueUrl?: string | null;
  creatorName?: string;
}

export default function FanvueCard({ fanvueUrl, creatorName = 'her' }: Props) {
  if (!fanvueUrl) return null;

  return (
    <a
      href={fanvueUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'linear-gradient(135deg, #2C3E5C 0%, #4A6FA5 100%)',
        color: '#fff',
        textDecoration: 'none',
        padding: '14px 18px',
        borderRadius: 14,
        marginBottom: 14,
        boxShadow: '0 4px 14px rgba(44,62,92,0.25)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 6px 18px rgba(44,62,92,0.35)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = '';
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 14px rgba(44,62,92,0.25)';
      }}
    >
      <div style={{
        background: 'rgba(255,255,255,0.15)',
        width: 44, height: 44, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.4rem', flexShrink: 0,
      }}>
        💎
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          Watch {creatorName} on Fanvue
          <span style={{
            fontSize: '0.62rem',
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: 99,
            fontWeight: 700,
            letterSpacing: 0.4,
          }}>
            ✓ VERIFIED · CARD OK
          </span>
        </div>
        <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: 2 }}>
          Pay with credit/debit card instead — same creator, alt checkout
        </div>
      </div>
      <span style={{ fontSize: '1.4rem', opacity: 0.9 }}>→</span>
    </a>
  );
}
