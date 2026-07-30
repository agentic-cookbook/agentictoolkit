/**
 * Pure Save-gate for the server-bags create/edit dialog.
 *
 * TWO apps render that dialog against the same endpoint — admin's
 * `app/(admin)/server-bags/page.tsx` and hub's
 * `src/components/settings/server-bags/ServerBagsPane.tsx` — and each carried its own copy of
 * these predicates and message strings, byte-for-byte identical and kept that way by hand.
 * "What makes a bag savable" is one piece of knowledge, so it gets one authoritative home; the
 * hand-mirrored second copy is what made the gate measured in one app and unmeasured in the other.
 *
 * Nothing here touches React or the DOM, so both consumers unit-test the gate directly and both
 * read the SAME sentence for the disabled button and the thrown error.
 */
export interface BagFormState {
    key: string;
    valueText: string;
    description: string;
}
export interface BagFormContext {
    /** True when editing an existing bag (key is fixed, no collision to check). */
    editingMode: boolean;
    /** Keys already taken — a create must not collide (surfaced before the 409). */
    existingKeys: string[];
}
export declare const INVALID_JSON_MESSAGE = "Value must be valid JSON \u2014 e.g. true, 42, \"text\", or {\"a\": 1}.";
export declare const BAG_KEY_REQUIRED_MESSAGE = "A key is required.";
export declare const duplicateBagKeyMessage: (key: string) => string;
/**
 * Diverged from the loaded (or, in create mode, blank) baseline.
 *
 * Key and description compare TRIMMED because that is what the submit path sends
 * (`key.trim()`, `description.trim()`): comparing raw would light Save up for a trailing space and
 * then send a byte-identical body — the no-op write this whole gate exists to prevent — and the
 * user loses nothing by it not counting, since saving it would have stored the trimmed value
 * anyway.
 *
 * `valueText` compares as TEXT, so re-indenting JSON reads as dirty even though the parsed value
 * the server stores is identical. Deliberate: `dirty` also drives the unsaved-work guard, and
 * silently discarding a reformat the user typed is worse than an occasional no-op PUT.
 */
export declare function isBagFormDirty(form: BagFormState, initial: BagFormState): boolean;
/**
 * WHY Save can't fire, or null when nothing is blocking. A reason rather than a boolean
 * because the gate disables the button, which is exactly what makes the submit path's
 * `throw new Error(...)` unreachable — a greyed-out Save has to say what it is waiting on.
 * Checks run in handleSubmit's order (bad JSON, then blank key, then key collision), so the
 * displayed sentence is the one the click would have produced.
 *
 * That order puts the JSON parse AHEAD of the `editingMode` branch, deliberately: JSON validity
 * is the one requirement an EDIT can also fail. Both dialogs seed `valueText` from
 * `JSON.stringify(bag.value, null, 2)`, so an edit opens quiet exactly when the loaded bag
 * round-trips — not because edits are exempt. A bag with NO value (the field is typed `unknown`)
 * stringifies to the non-string `undefined`, which `JSON.parse` rejects, so the untouched edit
 * dialog reports INVALID_JSON_MESSAGE and Save stays dead. That is the honest answer: the submit
 * path's own `JSON.parse` would throw the very same sentence, so a silent grey button would be
 * the bug.
 */
export declare function bagFormBlockedReason(form: BagFormState, ctx: BagFormContext): string | null;
//# sourceMappingURL=bag-dialog-state.d.ts.map