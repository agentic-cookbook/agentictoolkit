import { type MouseEvent } from 'react';
/** DOM ids of the footer's legal modals (opened by the footer's legal links, see openLegalModal). */
export declare const TERMS_DIALOG_ID = "adh-terms-dialog";
export declare const PRIVACY_DIALOG_ID = "adh-privacy-dialog";
/** The footer "Terms of Service" modal (the same shared content as /terms). */
export declare function TermsModal(): import("react").JSX.Element;
/** The footer "Privacy Policy" modal (the same shared content as /privacy). */
export declare function PrivacyModal(): import("react").JSX.Element;
/**
 * The click behaviour of a footer legal link, as a handler rather than a component:
 * when the browser supports the Popover API it opens the modal (preventing navigation);
 * otherwise it does nothing and the anchor's own href takes the user to the standalone
 * /terms or /privacy page — so the legal links are never dead.
 */
export declare function openLegalModal(dialogId: string): (e: MouseEvent<HTMLAnchorElement>) => void;
//# sourceMappingURL=LegalModals.d.ts.map