/**
 * DMCA / abuse takedown page.
 *
 * Mandatory for any user-generated-content / adult platform under
 * 17 U.S.C. § 512 (DMCA safe harbor). Card processors (Verotel, Segpay,
 * CCBill, Centrobill) will ALL ask for this URL during onboarding.
 *
 * The contact email goes to your DMCA agent — for a one-person creator
 * site, that's you. If you ever grow large enough to register an agent
 * with the U.S. Copyright Office, update the address here.
 */
export default function DMCA() {
  return (
    <div style={{ minHeight: '60vh', padding: '40px 20px' }}>
      <article style={{
        maxWidth: 760, margin: '0 auto',
        background: '#fff', padding: '40px 36px', borderRadius: 18,
        border: '1px solid var(--v3-line)', boxShadow: 'var(--v3-shadow)',
        color: 'var(--v3-ink)', lineHeight: 1.7,
      }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: 2.5, color: 'var(--v3-terracotta)', fontWeight: 700, margin: '0 0 8px' }}>
          LEGAL · TAKEDOWN
        </p>
        <h1 style={{ fontFamily: 'var(--v3-heading)', fontSize: '2rem', margin: '0 0 8px', color: 'var(--v3-ink)' }}>
          DMCA &amp; Content Takedown
        </h1>
        <p style={{ fontSize: '0.86rem', color: 'var(--v3-muted)', margin: '0 0 28px' }}>
          17 U.S.C. § 512 — Digital Millennium Copyright Act
        </p>

        <h2 style={h2}>Reporting infringing content</h2>
        <p>
          We respect intellectual property rights and respond promptly to valid
          takedown notices. If you believe content on this site infringes your
          copyright, send a written notice (preferably by email) containing the
          information required under 17 U.S.C. § 512(c)(3):
        </p>
        <ol style={list}>
          <li>A physical or electronic signature of the copyright owner (or an authorized agent).</li>
          <li>Identification of the copyrighted work being infringed.</li>
          <li>The URL(s) of the allegedly infringing material on this site.</li>
          <li>Your full name, mailing address, phone number, and email.</li>
          <li>
            A statement that you have a good-faith belief the use is not authorized
            by the copyright owner, its agent, or the law.
          </li>
          <li>
            A statement, under penalty of perjury, that the information in the
            notice is accurate and that you are the owner (or authorized to act
            on behalf of the owner).
          </li>
        </ol>

        <div style={contactBox}>
          <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Designated DMCA Agent</h3>
          <p style={{ margin: '0 0 4px', fontSize: '0.92rem' }}>
            <strong>Email:</strong> <a href="mailto:dmca@thecristinaadam.com" style={link}>dmca@thecristinaadam.com</a>
          </p>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--v3-muted)' }}>
            Responses are typically within 24–48 hours. Incomplete notices may be
            rejected without action.
          </p>
        </div>

        <h2 style={h2}>Counter-notification</h2>
        <p>
          If your content was removed and you believe it was a mistake or
          misidentification, you can file a counter-notice under
          § 512(g) containing:
        </p>
        <ol style={list}>
          <li>Your physical or electronic signature.</li>
          <li>Identification of the material that was removed and where it appeared before removal.</li>
          <li>
            A statement, under penalty of perjury, that you have a good-faith belief
            the material was removed as a result of mistake or misidentification.
          </li>
          <li>
            Your name, address, phone number, and a statement consenting to the
            jurisdiction of the federal district court for your address.
          </li>
        </ol>

        <h2 style={h2}>Repeat-infringer policy</h2>
        <p>
          Accounts subject to repeated valid DMCA takedown notices will be
          terminated in accordance with our policy and applicable law.
        </p>

        <h2 style={h2}>Other content concerns</h2>
        <p>
          For complaints unrelated to copyright (impersonation, non-consensual
          content, harassment, CSAM, or anything illegal), email{' '}
          <a href="mailto:abuse@thecristinaadam.com" style={link}>abuse@thecristinaadam.com</a>.
          CSAM concerns are escalated to NCMEC immediately and the relevant
          authorities. We have zero tolerance.
        </p>

        <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)', marginTop: 32, marginBottom: 0 }}>
          This notice is informational and does not constitute legal advice.
        </p>
      </article>
    </div>
  );
}

const h2: React.CSSProperties = {
  fontFamily: 'var(--v3-heading)',
  fontSize: '1.15rem',
  margin: '28px 0 10px',
  color: 'var(--v3-ink)',
};

const list: React.CSSProperties = {
  margin: '0 0 16px', paddingLeft: 22,
  fontSize: '0.94rem',
};

const link: React.CSSProperties = {
  color: 'var(--v3-terracotta)', textDecoration: 'none', fontWeight: 700,
};

const contactBox: React.CSSProperties = {
  marginTop: 12, padding: '14px 18px',
  background: 'var(--v3-cream)',
  border: '1px solid var(--v3-rose-100)',
  borderRadius: 12,
};
