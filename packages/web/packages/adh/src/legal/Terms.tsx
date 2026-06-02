import type { ReactElement } from 'react'
import { LegalPageShell, LEGAL_CONTACT_EMAIL } from './LegalPageShell'

export function Terms(): ReactElement {
  return (
    <LegalPageShell prefix="Terms of" title="Service">
      <p>
        These Terms of Service (&ldquo;<strong>Terms</strong>&rdquo;) govern your access to and
        use of the websites, applications, and services published at{' '}
        <a href="https://agenticdeveloperhub.com">agenticdeveloperhub.com</a> and related
        subdomains (collectively, the &ldquo;<strong>Service</strong>&rdquo;), which are
        operated by Mike Fullerton (&ldquo;<strong>we</strong>&rdquo;, &ldquo;
        <strong>us</strong>&rdquo;, or &ldquo;<strong>our</strong>&rdquo;). By accessing or
        using the Service, you agree to be bound by these Terms. If you do not agree,
        do not use the Service.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 13 years old to use the Service. If you are under the age
        of majority in your jurisdiction, you may only use the Service with the
        involvement of a parent or legal guardian. By using the Service, you represent
        that you meet these requirements.
      </p>

      <h2>2. Accounts</h2>
      <p>
        Some features require an account. You agree to provide accurate information,
        keep your credentials secure, and notify us promptly at{' '}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> of any unauthorized
        use. You are responsible for activity that occurs under your account. We may
        suspend or terminate accounts that violate these Terms.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service in violation of any law or third-party right.</li>
        <li>Probe, scan, or test the vulnerability of the Service without permission.</li>
        <li>Interfere with, disrupt, or impose an unreasonable load on the Service.</li>
        <li>Attempt to gain unauthorized access to accounts, systems, or data.</li>
        <li>Use automated means to scrape, harvest, or extract data at scale.</li>
        <li>Upload or transmit malware, spam, or unlawful, harassing, or infringing content.</li>
        <li>
          Use the Service to train machine-learning models in a manner that violates
          these Terms or applicable law.
        </li>
      </ul>

      <h2>4. User Content</h2>
      <p>
        You retain ownership of content you submit to the Service (&ldquo;
        <strong>User Content</strong>&rdquo;). By submitting User Content, you grant us
        a worldwide, non-exclusive, royalty-free license to host, store, reproduce,
        and display that content solely as needed to operate and improve the Service.
        You represent that you have the rights necessary to grant this license and
        that your User Content does not violate the rights of any third party.
      </p>

      <h2>5. Open Source &amp; Third-Party Services</h2>
      <p>
        Portions of the Service are open source and made available under their
        respective licenses, including the repositories at{' '}
        <a href="https://github.com/agentic-cookbook">github.com/agentic-cookbook</a>.
        Those licenses govern your use of that code. The Service also relies on
        third-party providers (for example, hosting, authentication, and analytics
        providers) whose terms apply to their respective portions of the offering.
      </p>

      <h2>6. Intellectual Property</h2>
      <p>
        Except for User Content and open-source components, the Service and all
        related content, trademarks, and materials are owned by us or our licensors
        and are protected by applicable intellectual property laws. We grant you a
        limited, revocable, non-transferable license to use the Service for its
        intended purpose, subject to these Terms.
      </p>

      <h2>7. Beta &amp; Experimental Features</h2>
      <p>
        The Service is provided primarily for research, education, and
        experimentation. Features may be added, removed, or changed without notice.
        Output produced by agent-based or generative features may be inaccurate,
        incomplete, or unsuitable for your purpose; you are responsible for
        evaluating it before relying on it.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;
        WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY,
        INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
        NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE
        OF TRADE. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE,
        OR ERROR-FREE.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL WE BE LIABLE FOR ANY
        INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY
        LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO
        YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR
        RELATED TO THESE TERMS OR THE SERVICE WILL NOT EXCEED ONE HUNDRED U.S.
        DOLLARS (US$100).
      </p>

      <h2>10. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold us harmless from and against any
        claims, liabilities, damages, losses, and expenses (including reasonable
        attorneys&rsquo; fees) arising out of or related to your use of the Service,
        your User Content, or your breach of these Terms.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate your
        access at any time, with or without notice, including for violations of these
        Terms. Sections that by their nature should survive termination will survive,
        including ownership provisions, warranty disclaimers, limitations of
        liability, and dispute-resolution terms.
      </p>

      <h2>12. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. When we do, we will revise the
        &ldquo;Effective&rdquo; date above. Material changes will be communicated
        through the Service or by other reasonable means. Your continued use of the
        Service after changes take effect constitutes acceptance of the revised Terms.
      </p>

      <h2>13. Governing Law &amp; Disputes</h2>
      <p>
        These Terms are governed by the laws of the State of California, United
        States, without regard to its conflict-of-laws rules. You and we agree that
        any dispute arising out of or relating to these Terms or the Service will be
        brought exclusively in the state or federal courts located in California, and
        you consent to personal jurisdiction and venue there.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms? Email{' '}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    </LegalPageShell>
  )
}
