import { type ReactElement } from 'react';
/** The whole family is a pre-launch preview, and every header says so in the strip
 *  above the bar. A DEFAULT, not a fixture — `previewNotice` overrides it, so the words
 *  are reachable from the host rather than sealed into this package.
 *
 *  The default earns its place under the same carve-out the package's default
 *  accessible names get: 46 sites all saying the same sentence should not each restate
 *  it, and a header that rendered nothing until every host was updated would ship 46
 *  sites with no notice at all. What must not happen is the words being UNREACHABLE
 *  from the host — the package owns the UI, the host owns the words.
 *
 *  This replaced a `Preview Release` BADGE under the site name. A badge sat inside
 *  the bar's lead slot, so it competed with the brand for the one part of the header
 *  that has to survive a 390px phone; a full-width strip above the bar costs the bar
 *  no horizontal room at all, and reads as a property of the site rather than of its
 *  name. */
export declare const DEFAULT_PREVIEW_NOTICE = "Developer Preview Release";
/** What the strip says when you ask it what "preview" means — the panel behind the
 *  caret. Same host-owns-the-words carve-out as {@link DEFAULT_PREVIEW_NOTICE}, and a
 *  default for the same reason: the sentence is true of the whole family, so 46 hosts
 *  should not each restate it. */
export declare const DEFAULT_PREVIEW_DETAIL = "We are in very early stages, and are only taking requests to join.";
export type PreviewNoticeProps = {
    /** The strip's headline words. */
    notice?: string;
    /** The sentence the caret reveals. */
    detail?: string;
};
/**
 * The family-wide preview strip: a caution-flanked headline that doubles as a
 * disclosure trigger for a one-sentence panel explaining what "preview" means here.
 *
 * Its own module rather than markup inside {@link AdhHeader} because it now holds
 * state and three dismissal paths; the header composes it as a leaf.
 */
export declare function PreviewNotice({ notice, detail, }: PreviewNoticeProps): ReactElement;
//# sourceMappingURL=PreviewNotice.d.ts.map