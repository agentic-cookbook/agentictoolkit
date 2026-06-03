// src/legal/LegalPageShell.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var LEGAL_EFFECTIVE_DATE = "May 19, 2026";
var LEGAL_CONTACT_EMAIL = "hello@agenticdeveloperhub.com";
function LegalPageShell({ prefix, title, children }) {
  return /* @__PURE__ */ jsxs("div", { className: "adh-legal", children: [
    /* @__PURE__ */ jsxs("div", { className: "adh-legal__hero", children: [
      /* @__PURE__ */ jsx("div", { className: "adh-legal__prefix", children: prefix }),
      /* @__PURE__ */ jsx("div", { className: "adh-legal__title", children: title }),
      /* @__PURE__ */ jsx("div", { className: "adh-legal__rule" })
    ] }),
    /* @__PURE__ */ jsxs("article", { className: "adh-legal-doc", children: [
      /* @__PURE__ */ jsxs("p", { className: "adh-legal-doc__meta", children: [
        "Effective ",
        LEGAL_EFFECTIVE_DATE
      ] }),
      children
    ] })
  ] });
}

// src/legal/Terms.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function Terms() {
  return /* @__PURE__ */ jsxs2(LegalPageShell, { prefix: "Terms of", title: "Service", children: [
    /* @__PURE__ */ jsxs2("p", { children: [
      "These Terms of Service (\u201C",
      /* @__PURE__ */ jsx2("strong", { children: "Terms" }),
      "\u201D) govern your access to and use of the websites, applications, and services published at",
      " ",
      /* @__PURE__ */ jsx2("a", { href: "https://agenticdeveloperhub.com", children: "agenticdeveloperhub.com" }),
      " and related subdomains (collectively, the \u201C",
      /* @__PURE__ */ jsx2("strong", { children: "Service" }),
      "\u201D), which are operated by Mike Fullerton (\u201C",
      /* @__PURE__ */ jsx2("strong", { children: "we" }),
      "\u201D, \u201C",
      /* @__PURE__ */ jsx2("strong", { children: "us" }),
      "\u201D, or \u201C",
      /* @__PURE__ */ jsx2("strong", { children: "our" }),
      "\u201D). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service."
    ] }),
    /* @__PURE__ */ jsx2("h2", { children: "1. Eligibility" }),
    /* @__PURE__ */ jsx2("p", { children: "You must be at least 13 years old to use the Service. If you are under the age of majority in your jurisdiction, you may only use the Service with the involvement of a parent or legal guardian. By using the Service, you represent that you meet these requirements." }),
    /* @__PURE__ */ jsx2("h2", { children: "2. Accounts" }),
    /* @__PURE__ */ jsxs2("p", { children: [
      "Some features require an account. You agree to provide accurate information, keep your credentials secure, and notify us promptly at",
      " ",
      /* @__PURE__ */ jsx2("a", { href: `mailto:${LEGAL_CONTACT_EMAIL}`, children: LEGAL_CONTACT_EMAIL }),
      " of any unauthorized use. You are responsible for activity that occurs under your account. We may suspend or terminate accounts that violate these Terms."
    ] }),
    /* @__PURE__ */ jsx2("h2", { children: "3. Acceptable Use" }),
    /* @__PURE__ */ jsx2("p", { children: "You agree not to:" }),
    /* @__PURE__ */ jsxs2("ul", { children: [
      /* @__PURE__ */ jsx2("li", { children: "Use the Service in violation of any law or third-party right." }),
      /* @__PURE__ */ jsx2("li", { children: "Probe, scan, or test the vulnerability of the Service without permission." }),
      /* @__PURE__ */ jsx2("li", { children: "Interfere with, disrupt, or impose an unreasonable load on the Service." }),
      /* @__PURE__ */ jsx2("li", { children: "Attempt to gain unauthorized access to accounts, systems, or data." }),
      /* @__PURE__ */ jsx2("li", { children: "Use automated means to scrape, harvest, or extract data at scale." }),
      /* @__PURE__ */ jsx2("li", { children: "Upload or transmit malware, spam, or unlawful, harassing, or infringing content." }),
      /* @__PURE__ */ jsx2("li", { children: "Use the Service to train machine-learning models in a manner that violates these Terms or applicable law." })
    ] }),
    /* @__PURE__ */ jsx2("h2", { children: "4. User Content" }),
    /* @__PURE__ */ jsxs2("p", { children: [
      "You retain ownership of content you submit to the Service (\u201C",
      /* @__PURE__ */ jsx2("strong", { children: "User Content" }),
      "\u201D). By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to host, store, reproduce, and display that content solely as needed to operate and improve the Service. You represent that you have the rights necessary to grant this license and that your User Content does not violate the rights of any third party."
    ] }),
    /* @__PURE__ */ jsx2("h2", { children: "5. Open Source & Third-Party Services" }),
    /* @__PURE__ */ jsxs2("p", { children: [
      "Portions of the Service are open source and made available under their respective licenses, including the repositories at",
      " ",
      /* @__PURE__ */ jsx2("a", { href: "https://github.com/agentic-cookbook", children: "github.com/agentic-cookbook" }),
      ". Those licenses govern your use of that code. The Service also relies on third-party providers (for example, hosting, authentication, and analytics providers) whose terms apply to their respective portions of the offering."
    ] }),
    /* @__PURE__ */ jsx2("h2", { children: "6. Intellectual Property" }),
    /* @__PURE__ */ jsx2("p", { children: "Except for User Content and open-source components, the Service and all related content, trademarks, and materials are owned by us or our licensors and are protected by applicable intellectual property laws. We grant you a limited, revocable, non-transferable license to use the Service for its intended purpose, subject to these Terms." }),
    /* @__PURE__ */ jsx2("h2", { children: "7. Beta & Experimental Features" }),
    /* @__PURE__ */ jsx2("p", { children: "The Service is provided primarily for research, education, and experimentation. Features may be added, removed, or changed without notice. Output produced by agent-based or generative features may be inaccurate, incomplete, or unsuitable for your purpose; you are responsible for evaluating it before relying on it." }),
    /* @__PURE__ */ jsx2("h2", { children: "8. Disclaimers" }),
    /* @__PURE__ */ jsx2("p", { children: "THE SERVICE IS PROVIDED \u201CAS IS\u201D AND \u201CAS AVAILABLE\u201D WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE." }),
    /* @__PURE__ */ jsx2("h2", { children: "9. Limitation of Liability" }),
    /* @__PURE__ */ jsx2("p", { children: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE WILL NOT EXCEED ONE HUNDRED U.S. DOLLARS (US$100)." }),
    /* @__PURE__ */ jsx2("h2", { children: "10. Indemnification" }),
    /* @__PURE__ */ jsx2("p", { children: "You agree to defend, indemnify, and hold us harmless from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys\u2019 fees) arising out of or related to your use of the Service, your User Content, or your breach of these Terms." }),
    /* @__PURE__ */ jsx2("h2", { children: "11. Termination" }),
    /* @__PURE__ */ jsx2("p", { children: "You may stop using the Service at any time. We may suspend or terminate your access at any time, with or without notice, including for violations of these Terms. Sections that by their nature should survive termination will survive, including ownership provisions, warranty disclaimers, limitations of liability, and dispute-resolution terms." }),
    /* @__PURE__ */ jsx2("h2", { children: "12. Changes to These Terms" }),
    /* @__PURE__ */ jsx2("p", { children: "We may update these Terms from time to time. When we do, we will revise the \u201CEffective\u201D date above. Material changes will be communicated through the Service or by other reasonable means. Your continued use of the Service after changes take effect constitutes acceptance of the revised Terms." }),
    /* @__PURE__ */ jsx2("h2", { children: "13. Governing Law & Disputes" }),
    /* @__PURE__ */ jsx2("p", { children: "These Terms are governed by the laws of the State of California, United States, without regard to its conflict-of-laws rules. You and we agree that any dispute arising out of or relating to these Terms or the Service will be brought exclusively in the state or federal courts located in California, and you consent to personal jurisdiction and venue there." }),
    /* @__PURE__ */ jsx2("h2", { children: "14. Contact" }),
    /* @__PURE__ */ jsxs2("p", { children: [
      "Questions about these Terms? Email",
      " ",
      /* @__PURE__ */ jsx2("a", { href: `mailto:${LEGAL_CONTACT_EMAIL}`, children: LEGAL_CONTACT_EMAIL }),
      "."
    ] })
  ] });
}

// src/legal/Privacy.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function Privacy() {
  return /* @__PURE__ */ jsxs3(LegalPageShell, { prefix: "Privacy", title: "Policy", children: [
    /* @__PURE__ */ jsxs3("p", { children: [
      "This Privacy Policy explains how Mike Fullerton (\u201C",
      /* @__PURE__ */ jsx3("strong", { children: "we" }),
      "\u201D, \u201C",
      /* @__PURE__ */ jsx3("strong", { children: "us" }),
      "\u201D, or \u201C",
      /* @__PURE__ */ jsx3("strong", { children: "our" }),
      "\u201D) collects, uses, and shares information when you use",
      " ",
      /* @__PURE__ */ jsx3("a", { href: "https://agenticdeveloperhub.com", children: "agenticdeveloperhub.com" }),
      " and related services (the \u201C",
      /* @__PURE__ */ jsx3("strong", { children: "Service" }),
      "\u201D). By using the Service, you agree to the practices described here."
    ] }),
    /* @__PURE__ */ jsx3("h2", { children: "1. Information We Collect" }),
    /* @__PURE__ */ jsx3("h3", { children: "Account information" }),
    /* @__PURE__ */ jsx3("p", { children: "When you create an account, we collect the information you provide, which may include your email address, display name, profile slug, and avatar URL." }),
    /* @__PURE__ */ jsx3("h3", { children: "Content you submit" }),
    /* @__PURE__ */ jsx3("p", { children: "We collect content you submit through the Service, including form submissions, profile settings, and any data you choose to associate with your account." }),
    /* @__PURE__ */ jsx3("h3", { children: "Automatically collected information" }),
    /* @__PURE__ */ jsx3("p", { children: "When you visit the Service, we (and our service providers) may automatically collect technical information such as IP address, browser type and version, device and operating-system information, referring URLs, pages viewed, and timestamps. This information is collected through server logs and standard web technologies." }),
    /* @__PURE__ */ jsx3("h3", { children: "Cookies and local storage" }),
    /* @__PURE__ */ jsx3("p", { children: "We use cookies and browser local storage to keep you signed in, remember your preferences, and operate core features of the Service. You can control cookies through your browser settings; disabling them may break parts of the Service." }),
    /* @__PURE__ */ jsx3("h2", { children: "2. How We Use Information" }),
    /* @__PURE__ */ jsxs3("ul", { children: [
      /* @__PURE__ */ jsx3("li", { children: "To provide, maintain, and improve the Service." }),
      /* @__PURE__ */ jsx3("li", { children: "To authenticate you and secure your account." }),
      /* @__PURE__ */ jsx3("li", { children: "To communicate with you about your account, updates, security notices, and requests you make." }),
      /* @__PURE__ */ jsx3("li", { children: "To analyze usage patterns and diagnose technical problems, including aggregated and de-identified analytics." }),
      /* @__PURE__ */ jsx3("li", { children: "To prevent fraud, abuse, and violations of our Terms of Service." }),
      /* @__PURE__ */ jsx3("li", { children: "To comply with legal obligations and enforce our agreements." })
    ] }),
    /* @__PURE__ */ jsx3("h2", { children: "3. How We Share Information" }),
    /* @__PURE__ */ jsx3("p", { children: "We do not sell your personal information. We share information only as follows:" }),
    /* @__PURE__ */ jsxs3("ul", { children: [
      /* @__PURE__ */ jsxs3("li", { children: [
        /* @__PURE__ */ jsx3("strong", { children: "Service providers." }),
        " We share information with vendors who operate the Service on our behalf \u2014 for example, hosting, authentication, email delivery, and analytics providers. These providers are bound by confidentiality obligations and may only use the information to provide services to us."
      ] }),
      /* @__PURE__ */ jsxs3("li", { children: [
        /* @__PURE__ */ jsx3("strong", { children: "Legal and safety." }),
        " We may disclose information to comply with legal process, enforce our agreements, or protect the rights, property, or safety of users or the public."
      ] }),
      /* @__PURE__ */ jsxs3("li", { children: [
        /* @__PURE__ */ jsx3("strong", { children: "Business transfers." }),
        " If the Service or its assets are transferred to another party, your information may be transferred as part of that transaction, subject to this Policy."
      ] }),
      /* @__PURE__ */ jsxs3("li", { children: [
        /* @__PURE__ */ jsx3("strong", { children: "With your consent." }),
        " We may share information for any other purpose disclosed to you and with your consent."
      ] })
    ] }),
    /* @__PURE__ */ jsx3("h2", { children: "4. Public Profile Information" }),
    /* @__PURE__ */ jsx3("p", { children: "If you publish a profile on the Service, information you mark public (such as your display name, slug, and avatar) may be visible to anyone who visits your profile. Do not include information in public fields that you wish to keep private." }),
    /* @__PURE__ */ jsx3("h2", { children: "5. Data Retention" }),
    /* @__PURE__ */ jsx3("p", { children: "We retain personal information for as long as your account is active or as needed to provide the Service, comply with legal obligations, resolve disputes, and enforce our agreements. When information is no longer required, we delete or de-identify it." }),
    /* @__PURE__ */ jsx3("h2", { children: "6. Security" }),
    /* @__PURE__ */ jsx3("p", { children: "We use reasonable administrative, technical, and physical safeguards to protect information. No method of transmission or storage is fully secure, and we cannot guarantee absolute security. You are responsible for keeping your account credentials confidential." }),
    /* @__PURE__ */ jsx3("h2", { children: "7. Your Choices" }),
    /* @__PURE__ */ jsxs3("ul", { children: [
      /* @__PURE__ */ jsxs3("li", { children: [
        /* @__PURE__ */ jsx3("strong", { children: "Access & update." }),
        " You can review and update your account information through your settings page."
      ] }),
      /* @__PURE__ */ jsxs3("li", { children: [
        /* @__PURE__ */ jsx3("strong", { children: "Delete." }),
        " You may request deletion of your account by emailing",
        " ",
        /* @__PURE__ */ jsx3("a", { href: `mailto:${LEGAL_CONTACT_EMAIL}`, children: LEGAL_CONTACT_EMAIL }),
        ". We may retain limited information as required by law or for legitimate business purposes."
      ] }),
      /* @__PURE__ */ jsxs3("li", { children: [
        /* @__PURE__ */ jsx3("strong", { children: "Email." }),
        " Transactional emails (e.g., security and account notices) cannot be opted out of while you maintain an account."
      ] })
    ] }),
    /* @__PURE__ */ jsx3("h2", { children: "8. California Privacy Rights" }),
    /* @__PURE__ */ jsx3("p", { children: "If you are a California resident, the California Consumer Privacy Act, as amended by the California Privacy Rights Act (\u201CCCPA/CPRA\u201D), gives you the right to:" }),
    /* @__PURE__ */ jsxs3("ul", { children: [
      /* @__PURE__ */ jsx3("li", { children: "Know what personal information we collect, use, disclose, and (if applicable) sell or share." }),
      /* @__PURE__ */ jsx3("li", { children: "Request access to and a copy of your personal information." }),
      /* @__PURE__ */ jsx3("li", { children: "Request correction of inaccurate personal information." }),
      /* @__PURE__ */ jsx3("li", { children: "Request deletion of your personal information." }),
      /* @__PURE__ */ jsx3("li", { children: "Opt out of any \u201Csale\u201D or \u201Csharing\u201D of personal information for cross-context behavioral advertising. We do not sell or share personal information in this sense." }),
      /* @__PURE__ */ jsx3("li", { children: "Limit the use of sensitive personal information. We do not use sensitive personal information except as necessary to provide the Service." }),
      /* @__PURE__ */ jsx3("li", { children: "Be free from discrimination for exercising these rights." })
    ] }),
    /* @__PURE__ */ jsxs3("p", { children: [
      "To exercise these rights, email",
      " ",
      /* @__PURE__ */ jsx3("a", { href: `mailto:${LEGAL_CONTACT_EMAIL}`, children: LEGAL_CONTACT_EMAIL }),
      ". We will verify your request using information associated with your account. You may also designate an authorized agent to make a request on your behalf."
    ] }),
    /* @__PURE__ */ jsx3("h2", { children: "9. International Users" }),
    /* @__PURE__ */ jsx3("p", { children: "The Service is operated from the United States. If you access the Service from outside the United States, you understand that your information may be transferred to, stored, and processed in the United States and other countries where our service providers operate. We rely on appropriate legal mechanisms for any such transfers as required by applicable law." }),
    /* @__PURE__ */ jsx3("h2", { children: "10. Children\u2019s Privacy" }),
    /* @__PURE__ */ jsx3("p", { children: "The Service is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us so we can delete it." }),
    /* @__PURE__ */ jsx3("h2", { children: "11. Third-Party Links" }),
    /* @__PURE__ */ jsx3("p", { children: "The Service may link to third-party websites or services that we do not operate. We are not responsible for the privacy practices of those third parties; review their policies before sharing information with them." }),
    /* @__PURE__ */ jsx3("h2", { children: "12. Changes to This Policy" }),
    /* @__PURE__ */ jsx3("p", { children: "We may update this Privacy Policy from time to time. When we do, we will revise the \u201CEffective\u201D date above and, when appropriate, notify you through the Service or by other reasonable means. Your continued use of the Service after changes take effect constitutes acceptance of the updated Policy." }),
    /* @__PURE__ */ jsx3("h2", { children: "13. Contact" }),
    /* @__PURE__ */ jsxs3("p", { children: [
      "Privacy questions, requests, or concerns? Email",
      " ",
      /* @__PURE__ */ jsx3("a", { href: `mailto:${LEGAL_CONTACT_EMAIL}`, children: LEGAL_CONTACT_EMAIL }),
      "."
    ] })
  ] });
}
export {
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  LegalPageShell,
  Privacy,
  Terms
};
//# sourceMappingURL=index.js.map