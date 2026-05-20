const Privacy = ({ config }: { config: any }) => {
  const brand = config?.siteTitle || 'this Site';
  const year = new Date().getFullYear();

  return (
    <div className="v3-legal">
      <div className="v3-legal-inner">
        <h1>Privacy Policy</h1>
        <p className="updated">Last updated · {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="callout">
          Your privacy matters. This policy explains what data {brand} collects, how it is used,
          how it is protected, and the choices you have.
        </div>

        <h2>1. Information We Collect</h2>
        <h3>Account information</h3>
        <ul>
          <li>Email address, username, and password (hashed — we never store your plaintext password).</li>
          <li>Profile photo and bio if you choose to add them.</li>
          <li>Age confirmation timestamp.</li>
        </ul>
        <h3>Payment information</h3>
        <p>
          <strong>We never see or store your full credit card number.</strong> Card data is collected
          directly by our payment processors (e.g. Segpay, CCBill, NOWPayments) via PCI-DSS compliant
          iframes. We receive only a token, the last 4 digits, the brand (Visa/MC/etc.), and
          transaction status.
        </p>
        <h3>Usage data</h3>
        <ul>
          <li>Pages visited, content viewed/unlocked, messages sent/received.</li>
          <li>Device type, browser, IP address, and approximate location.</li>
          <li>Referrer (which site linked you to us).</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To operate the Site and provide the content you've paid for.</li>
          <li>To process payments and prevent fraud.</li>
          <li>To communicate with you about your account (transaction receipts, security alerts).</li>
          <li>To improve the Site and develop new features.</li>
          <li>To comply with legal obligations.</li>
        </ul>

        <h2>3. Discreet Billing</h2>
        <p>
          Charges from {brand} will appear on your bank or card statement with a discreet billing
          descriptor (e.g. <em>CRISTINA</em>) and will <strong>not</strong> reveal the nature of the
          content. Your privacy in this regard is one of our top priorities.
        </p>

        <h2>4. Cookies</h2>
        <p>We use cookies and similar technologies for:</p>
        <ul>
          <li><strong>Essential</strong> — keep you signed in and remember age verification.</li>
          <li><strong>Analytics</strong> — understand how the Site is used so we can improve it.</li>
          <li><strong>Functional</strong> — remember your preferences (theme, language).</li>
        </ul>
        <p>You can disable cookies in your browser, but parts of the Site may stop working.</p>

        <h2>5. How We Share Your Data</h2>
        <p>We share your information ONLY with:</p>
        <ul>
          <li><strong>Payment processors</strong> (Segpay, CCBill, NOWPayments) — solely to process your transactions.</li>
          <li><strong>Hosting &amp; infrastructure providers</strong> (e.g. AWS, Cloudflare) — solely to serve the Site.</li>
          <li><strong>Email service providers</strong> — solely to send transactional emails.</li>
          <li><strong>Legal authorities</strong> — when required by valid legal process (subpoena, court order).</li>
        </ul>
        <p>
          <strong>We do not sell your personal information.</strong> Ever.
        </p>

        <h2>6. Data Retention</h2>
        <ul>
          <li>Account info: kept while your account is active and for 90 days after deletion.</li>
          <li>Transaction records: kept for 7 years for tax and accounting purposes.</li>
          <li>Age verification logs: kept indefinitely for legal compliance.</li>
        </ul>

        <h2>7. Your Rights</h2>
        <p>Depending on where you live, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Request correction or deletion of your data.</li>
          <li>Object to or restrict certain processing.</li>
          <li>Request a copy of your data in a portable format.</li>
        </ul>
        <p>
          To exercise any of these rights, email <a href="#">privacy@{(config?.slug || 'cristina')}.com</a>.
          We'll respond within 30 days.
        </p>

        <h2>8. Security</h2>
        <p>
          We use industry-standard encryption (TLS 1.3) for data in transit and bcrypt for password
          hashing. We never store full card numbers. Our payment processors are PCI-DSS certified.
        </p>
        <p>
          No system is 100% secure. If we ever discover a data breach affecting your account, we
          will notify you within 72 hours.
        </p>

        <h2>9. Children</h2>
        <p>
          {brand} is for adults 18+ only. We do not knowingly collect data from anyone under 18.
          If you believe we have collected data from a minor, contact us immediately at
          <a href="#"> privacy@{(config?.slug || 'cristina')}.com</a> and we will delete it.
        </p>

        <h2>10. International Users</h2>
        <p>
          {brand} is operated from the United States. If you are accessing the Site from outside
          the U.S., your data will be transferred to and processed in the U.S., which may have
          different data protection laws than your country.
        </p>

        <h2>11. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be announced
          on the Site. Continued use after the changes take effect constitutes acceptance of the
          revised Policy.
        </p>

        <h2>12. Contact</h2>
        <p>
          Questions about your privacy? Email <a href="mailto:privacy@thecristinaadam.com">privacy@thecristinaadam.com</a>.
          For data export or deletion requests, see the Privacy section of your account settings.
        </p>

        <hr />
        <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
          &copy; {year} {brand}. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Privacy;
