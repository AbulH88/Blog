const Compliance2257 = ({ config }: { config: any }) => {
  const brand = config?.siteTitle || 'this Site';
  const year = new Date().getFullYear();
  const supportEmail = `support@${(config?.siteTitle || 'thecristinaadam').toLowerCase().replace(/\s+/g, '')}.com`;

  return (
    <div className="v3-legal">
      <div className="v3-legal-inner">
        <h1>Content Disclosure</h1>
        <p className="updated">Statement on Content Production &amp; 18 U.S.C. § 2257</p>

        <div className="callout">
          <strong>All visual content on {brand} is computer-generated using artificial
          intelligence (AI).</strong> No real human beings are depicted in any image, video, or
          other visual content on this site.
        </div>

        <h2>Content Production Method</h2>
        <p>
          {brand} uses generative AI models to create all visual content on this site. The
          persona known as "{brand}" is a fictional AI-generated character — not a real person.
          Any resemblance to actual persons, living or deceased, is unintentional and
          coincidental.
        </p>
        <p>
          No human models, performers, or photographers participate in the production of any
          visual content on this site. All images and videos are synthetic outputs of
          machine-learning systems.
        </p>

        <h2>Why 2257 Does Not Apply</h2>
        <p>
          <strong>18 U.S.C. § 2257</strong> and <strong>28 C.F.R. § 75</strong> impose
          record-keeping requirements on producers of <em>"visual depictions of actual sexually
          explicit conduct"</em> involving real human performers. Because no real persons are
          involved in the production of content on {brand}, these statutes do not impose
          record-keeping obligations on us.
        </p>
        <p>
          We nevertheless maintain technical records of all content generation — including the
          AI models used, generation prompts, dates, and model version identifiers — in good
          faith and to address any reasonable inquiries.
        </p>

        <h2>Age &amp; Likeness Policy</h2>
        <p>
          {brand} has <strong>zero tolerance</strong> for the following, and our content
          generation pipeline is configured to refuse such outputs:
        </p>
        <ul>
          <li>AI-generated content depicting persons (real or synthetic) who appear to be under
            the age of 18</li>
          <li>AI-generated likenesses of real, identifiable individuals without their consent</li>
          <li>Content depicting non-consensual acts, violence, abuse, or coercion</li>
          <li>Content involving animals in sexual situations</li>
          <li>Any content that violates U.S. federal law or applicable state law</li>
        </ul>
        <p>
          To report any content that may violate these policies, contact{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a> immediately. We respond to all
          such reports within 48 hours.
        </p>

        <h2>Technical Records</h2>
        <p>
          We retain the following technical records for all content generated and published on
          {brand}, available upon valid legal request:
        </p>
        <ul>
          <li>Date and time of generation</li>
          <li>AI model name and version</li>
          <li>Generation parameters and prompt categories (with personally-identifying details redacted where applicable)</li>
          <li>Content moderation logs confirming the output passed our age/likeness filters</li>
        </ul>

        <h2>Inquiries</h2>
        <p>
          For inquiries regarding content generation, age safeguards, or content removal,
          contact{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
        <p>
          Authorized law-enforcement requests should also be directed to this address and will
          be routed to our legal contact.
        </p>

        <hr />
        <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
          &copy; {year} {brand}. All rights reserved. This statement reflects our current
          content production methodology. It may be revised if our methodology changes
          (e.g., introduction of real-human content), at which point full 18 U.S.C. § 2257
          compliance procedures would be activated.
        </p>
      </div>
    </div>
  );
};

export default Compliance2257;
