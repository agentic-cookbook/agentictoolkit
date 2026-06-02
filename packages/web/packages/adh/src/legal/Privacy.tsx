import type { ReactElement } from 'react'
import { LegalPageShell, LEGAL_CONTACT_EMAIL } from './LegalPageShell'

export function Privacy(): ReactElement {
  return (
    <LegalPageShell prefix="Privacy" title="Policy">
      <p>
        This Privacy Policy explains how Mike Fullerton (&ldquo;<strong>we</strong>&rdquo;,
        &ldquo;<strong>us</strong>&rdquo;, or &ldquo;<strong>our</strong>&rdquo;) collects,
        uses, and shares information when you use{' '}
        <a href="https://agenticdeveloperhub.com">agenticdeveloperhub.com</a> and related
        services (the &ldquo;<strong>Service</strong>&rdquo;). By using the Service, you
        agree to the practices described here.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>Account information</h3>
      <p>
        When you create an account, we collect the information you provide, which may
        include your email address, display name, profile slug, and avatar URL.
      </p>

      <h3>Content you submit</h3>
      <p>
        We collect content you submit through the Service, including form submissions,
        profile settings, and any data you choose to associate with your account.
      </p>

      <h3>Automatically collected information</h3>
      <p>
        When you visit the Service, we (and our service providers) may automatically
        collect technical information such as IP address, browser type and version,
        device and operating-system information, referring URLs, pages viewed, and
        timestamps. This information is collected through server logs and standard
        web technologies.
      </p>

      <h3>Cookies and local storage</h3>
      <p>
        We use cookies and browser local storage to keep you signed in, remember your
        preferences, and operate core features of the Service. You can control cookies
        through your browser settings; disabling them may break parts of the Service.
      </p>

      <h2>2. How We Use Information</h2>
      <ul>
        <li>To provide, maintain, and improve the Service.</li>
        <li>To authenticate you and secure your account.</li>
        <li>
          To communicate with you about your account, updates, security notices, and
          requests you make.
        </li>
        <li>
          To analyze usage patterns and diagnose technical problems, including
          aggregated and de-identified analytics.
        </li>
        <li>To prevent fraud, abuse, and violations of our Terms of Service.</li>
        <li>To comply with legal obligations and enforce our agreements.</li>
      </ul>

      <h2>3. How We Share Information</h2>
      <p>We do not sell your personal information. We share information only as follows:</p>
      <ul>
        <li>
          <strong>Service providers.</strong> We share information with vendors who
          operate the Service on our behalf — for example, hosting, authentication,
          email delivery, and analytics providers. These providers are bound by
          confidentiality obligations and may only use the information to provide
          services to us.
        </li>
        <li>
          <strong>Legal and safety.</strong> We may disclose information to comply
          with legal process, enforce our agreements, or protect the rights, property,
          or safety of users or the public.
        </li>
        <li>
          <strong>Business transfers.</strong> If the Service or its assets are
          transferred to another party, your information may be transferred as part of
          that transaction, subject to this Policy.
        </li>
        <li>
          <strong>With your consent.</strong> We may share information for any other
          purpose disclosed to you and with your consent.
        </li>
      </ul>

      <h2>4. Public Profile Information</h2>
      <p>
        If you publish a profile on the Service, information you mark public (such as
        your display name, slug, and avatar) may be visible to anyone who visits your
        profile. Do not include information in public fields that you wish to keep
        private.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain personal information for as long as your account is active or as
        needed to provide the Service, comply with legal obligations, resolve
        disputes, and enforce our agreements. When information is no longer required,
        we delete or de-identify it.
      </p>

      <h2>6. Security</h2>
      <p>
        We use reasonable administrative, technical, and physical safeguards to
        protect information. No method of transmission or storage is fully secure,
        and we cannot guarantee absolute security. You are responsible for keeping
        your account credentials confidential.
      </p>

      <h2>7. Your Choices</h2>
      <ul>
        <li>
          <strong>Access &amp; update.</strong> You can review and update your account
          information through your settings page.
        </li>
        <li>
          <strong>Delete.</strong> You may request deletion of your account by emailing{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. We may retain
          limited information as required by law or for legitimate business purposes.
        </li>
        <li>
          <strong>Email.</strong> Transactional emails (e.g., security and account
          notices) cannot be opted out of while you maintain an account.
        </li>
      </ul>

      <h2>8. California Privacy Rights</h2>
      <p>
        If you are a California resident, the California Consumer Privacy Act, as
        amended by the California Privacy Rights Act (&ldquo;CCPA/CPRA&rdquo;), gives
        you the right to:
      </p>
      <ul>
        <li>
          Know what personal information we collect, use, disclose, and (if
          applicable) sell or share.
        </li>
        <li>Request access to and a copy of your personal information.</li>
        <li>Request correction of inaccurate personal information.</li>
        <li>Request deletion of your personal information.</li>
        <li>
          Opt out of any &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of personal
          information for cross-context behavioral advertising. We do not sell or
          share personal information in this sense.
        </li>
        <li>
          Limit the use of sensitive personal information. We do not use sensitive
          personal information except as necessary to provide the Service.
        </li>
        <li>Be free from discrimination for exercising these rights.</li>
      </ul>
      <p>
        To exercise these rights, email{' '}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. We will verify your
        request using information associated with your account. You may also
        designate an authorized agent to make a request on your behalf.
      </p>

      <h2>9. International Users</h2>
      <p>
        The Service is operated from the United States. If you access the Service
        from outside the United States, you understand that your information may be
        transferred to, stored, and processed in the United States and other
        countries where our service providers operate. We rely on appropriate legal
        mechanisms for any such transfers as required by applicable law.
      </p>

      <h2>10. Children&rsquo;s Privacy</h2>
      <p>
        The Service is not directed to children under 13, and we do not knowingly
        collect personal information from children under 13. If you believe a child
        has provided us with personal information, please contact us so we can delete
        it.
      </p>

      <h2>11. Third-Party Links</h2>
      <p>
        The Service may link to third-party websites or services that we do not
        operate. We are not responsible for the privacy practices of those third
        parties; review their policies before sharing information with them.
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we do, we will
        revise the &ldquo;Effective&rdquo; date above and, when appropriate, notify
        you through the Service or by other reasonable means. Your continued use of
        the Service after changes take effect constitutes acceptance of the updated
        Policy.
      </p>

      <h2>13. Contact</h2>
      <p>
        Privacy questions, requests, or concerns? Email{' '}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    </LegalPageShell>
  )
}
