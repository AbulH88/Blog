/**
 * Terms of Service — required for adult payment processor approval
 * (Segpay, CCBill, Epoch all review this page during onboarding).
 *
 * The content here is a reasonable starting template. The creator MUST
 * customize it with their legal name, jurisdiction, and have it reviewed
 * by counsel before going to production with real payments.
 */
const Terms = ({ config }: { config: any }) => {
  const brand = config?.siteTitle || 'this Site';
  const year = new Date().getFullYear();

  return (
    <div className="v3-legal">
      <div className="v3-legal-inner">
        <h1>Terms of Service</h1>
        <p className="updated">Last updated · {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="callout">
          Please read these Terms of Service carefully. By accessing or using {brand},
          you agree to be legally bound by them. If you do not agree, you may not use the Site.
        </div>

        <h2>1. Eligibility</h2>
        <p>
          You must be at least <strong>18 years of age</strong> (or the age of majority in your
          jurisdiction, whichever is higher) to access or use {brand}. By using the Site you
          represent that you meet this requirement.
        </p>
        <p>
          The Site is not available in jurisdictions where adult content is prohibited.
          You are solely responsible for compliance with the laws of your jurisdiction.
        </p>

        <h2>2. Account Registration</h2>
        <ul>
          <li>You must provide accurate, current information when creating an account.</li>
          <li>You are responsible for keeping your password confidential and for all activity on your account.</li>
          <li>You may not transfer, sell, or share your account with anyone.</li>
          <li>We may suspend or terminate accounts that violate these Terms.</li>
        </ul>

        <h2>3. Content &amp; Conduct</h2>
        <p>By using {brand} you agree NOT to:</p>
        <ul>
          <li>Post or share content that depicts minors, non-consensual acts, or any illegal activity.</li>
          <li>Record, capture, screenshot, redistribute, or repost any content from {brand}.</li>
          <li>Use the Site for harassment, stalking, threats, hate speech, or impersonation.</li>
          <li>Attempt to circumvent payments, paywalls, or technical protections.</li>
          <li>Use bots, scrapers, or automated tools to access the Site.</li>
        </ul>
        <p>
          We reserve the right to remove any content and terminate accounts that violate these rules.
        </p>

        <h2>4. Purchases &amp; Payments</h2>
        <ul>
          <li>All purchases are final at the time of payment and content is delivered immediately upon successful transaction.</li>
          <li>Prices are listed in USD unless otherwise stated.</li>
          <li>Charges on your bank statement will appear as the discreet billing descriptor configured for your transaction (e.g. <em>CRISTINA</em>) and never reveal the nature of the content.</li>
          <li>Payment processors may require additional verification (such as 3D Secure) before approving a transaction.</li>
        </ul>

        <h2>5. Refund Policy</h2>
        <p>
          Due to the digital nature of the content delivered, all sales are <strong>final and non-refundable</strong> once the content has been viewed or unlocked.
        </p>
        <p>
          Refund requests for the following limited cases will be reviewed in good faith:
        </p>
        <ul>
          <li>Duplicate charges for the same content</li>
          <li>Technical failures that prevented you from accessing purchased content</li>
          <li>Unauthorized charges (report within 7 days of the transaction)</li>
        </ul>
        <p>
          Contact <a href="#">support@{(config?.slug || 'cristina')}.com</a> with your order details.
          Chargebacks initiated without first contacting us may result in permanent account termination.
        </p>

        <h2>6. Cancellation</h2>
        <p>
          You can cancel your account at any time from your <a href="/dashboard">Account Settings</a>.
          Cancellation stops future charges immediately. Any content you have already paid to unlock
          remains accessible from your account.
        </p>

        <h2>7. Intellectual Property</h2>
        <p>
          All content on {brand} — including photos, videos, text, designs, and branding — is
          owned by the creator and is protected by copyright law. You receive a limited,
          non-transferable, revocable license to view content for personal, non-commercial use only.
        </p>

        <h2>8. DMCA &amp; Copyright</h2>
        <p>
          If you believe content on {brand} infringes your copyright, send a written notice to
          <a href="#"> dmca@{(config?.slug || 'cristina')}.com</a> including: your contact info, the
          allegedly infringing material, your original work, and a sworn statement.
        </p>

        <h2>9. Privacy</h2>
        <p>
          Your use of {brand} is also governed by our <a href="/privacy">Privacy Policy</a>,
          which explains how we collect, use, and protect your data.
        </p>

        <h2>10. Disclaimer &amp; Limitation of Liability</h2>
        <p>
          {brand} is provided "as is" without warranty of any kind. To the maximum extent permitted
          by law, the creator and platform are not liable for indirect, incidental, or consequential
          damages arising from your use of the Site.
        </p>

        <h2>11. Termination</h2>
        <p>
          We may suspend or terminate your access at any time for any reason, including
          violation of these Terms. You may close your own account at any time from your
          dashboard.
        </p>

        <h2>12. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be announced on the Site
          and will take effect 14 days after posting. Continued use of {brand} after that date
          constitutes acceptance of the revised Terms.
        </p>

        <h2>13. Governing Law</h2>
        <p>
          These Terms are governed by the laws of your operator's place of incorporation, without
          regard to conflict-of-laws principles. The specific governing law and venue will be
          updated here once {brand}'s legal entity is finalized. By using the Site, you agree to
          resolve disputes informally first by contacting us at the email below.
        </p>

        <h2>14. Contact</h2>
        <p>
          Questions? Email <a href="mailto:support@thecristinaadam.com">support@thecristinaadam.com</a>.
          DMCA notices: see our <a href="/dmca" style={{ color: 'var(--v3-terracotta)' }}>DMCA page</a>.
        </p>

        <hr />
        <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
          &copy; {year} {brand}. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Terms;
