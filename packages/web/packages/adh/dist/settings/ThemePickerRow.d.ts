import { type ReactElement } from "react";
/**
 * Dev-only theme picker. Switching is the alt-block media flip (applyBaseTheme) for the
 * live page plus the cookie write (persistTheme) so the choice survives a reload and
 * carries across the family's subdomains.
 *
 * Reads the DOM in an effect rather than during render: the blocks are server-rendered but
 * WHICH one is active is decided by the pre-paint script, so reading it during SSR would
 * both crash (no document) and hydrate to the wrong answer.
 */
export default function ThemePickerRow(): ReactElement | null;
//# sourceMappingURL=ThemePickerRow.d.ts.map