/**
 * Pure Save-gate for the feature-flags create/edit dialog.
 *
 * TWO apps render a flag dialog against the same endpoint — admin's
 * `app/(admin)/feature-flags/page.tsx` (`NewFlagDialog`, create-only) and hub's
 * `src/components/settings/feature-flags/FeatureFlagsPane.tsx` (`FlagDialog`, create + edit) —
 * and they had drifted: hub blocked a key that collides with an existing flag, admin did not, so
 * admin shipped a Save that looked perfectly valid and could only ever produce a 409.
 *
 * One gate, both dialogs. Nothing here touches React or the DOM.
 */
export interface FlagFormState {
  key: string;
  description: string;
  enabled: boolean;
}

export interface FlagFormContext {
  /** True when editing an existing flag (key is fixed, no collision to check). */
  editingMode: boolean;
  /** Keys already taken — a create must not collide (surfaced before the 409). */
  existingKeys: string[];
}

/** The all-blank starting point a create dialog opens on; the baseline its `dirty` measures from. */
export const PRISTINE_FLAG_FORM: FlagFormState = { key: "", description: "", enabled: false };

export const FLAG_KEY_REQUIRED_MESSAGE = "A key is required.";
export const duplicateFlagKeyMessage = (key: string) => `A flag named “${key}” already exists.`;

/**
 * Diverged from the loaded (or, in create mode, `PRISTINE_FLAG_FORM`) baseline.
 *
 * Key and description compare TRIMMED because that is what the submit path sends: comparing raw
 * would light Save up for a trailing space and then send a byte-identical body — the no-op write
 * this gate exists to prevent — and the user loses nothing by it not counting, since saving it
 * would have stored the trimmed value anyway.
 */
export function isFlagFormDirty(form: FlagFormState, initial: FlagFormState): boolean {
  return (
    form.key.trim() !== initial.key.trim() ||
    form.description.trim() !== initial.description.trim() ||
    form.enabled !== initial.enabled
  );
}

/**
 * WHY Save can't fire, or null when nothing is blocking. A reason rather than a boolean
 * because the gate disables the button, which is exactly what makes the submit path's
 * `throw new Error(...)` unreachable — a greyed-out Save has to say what it is waiting on, and a
 * colliding key (which *looks* perfectly fine) is precisely the case a bare boolean leaves mute.
 * Checks run in handleSubmit's order (blank key, then key collision).
 */
export function flagFormBlockedReason(
  form: FlagFormState,
  ctx: FlagFormContext,
): string | null {
  if (ctx.editingMode) return null;
  const trimmedKey = form.key.trim();
  if (!trimmedKey) return FLAG_KEY_REQUIRED_MESSAGE;
  if (ctx.existingKeys.includes(trimmedKey)) return duplicateFlagKeyMessage(trimmedKey);
  return null;
}
