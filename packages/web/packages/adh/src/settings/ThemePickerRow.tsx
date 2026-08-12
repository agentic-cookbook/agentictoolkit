"use client";

import { useEffect, useState, type ReactElement } from "react";

import {
  applyBaseTheme,
  persistTheme,
  readStoredTheme,
} from "@agentic-toolkit/adh/themes/theme-preview";
import { Select } from "@agentic-toolkit/ui/components/select";

import { SettingRow } from "@agentic-toolkit/account";

/**
 * The dev-only theme picker, in its OWN module — and its OWN tsup entry
 * (`settings/ThemePickerRow`, `@agentic-toolkit/adh/settings/ThemePickerRow` in
 * tsup.config.ts's `external`) — so it can be gated out of production bundles.
 * AppearancePanel reaches it through a `next/dynamic` behind inlined
 * `process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === '…'` comparisons; it used to be a
 * function in that file behind `DEV_BUILD ? … : null`, which hid the row but shipped
 * this code — and `@agentic-toolkit/adh/themes/theme-preview` with it — to all ~45
 * production sites. `DEV_BUILD` is an identifier, and webpack will not fold past one
 * (the reasoning is written out in adh-registry's src/deployment-env.ts).
 *
 * The `theme-preview` import above is the PACKAGE PATH, unchanged by this file's move:
 * it is one of tsup.config.ts's load-bearing self-references (the "dev-only theme trio"),
 * kept un-inlined so a production build can tree-shake it once AppearancePanel's folded
 * gate leaves it unreferenced. See that entry's comment for the fuller rule.
 *
 * The gate's OWN import (in AppearancePanel.tsx) is the package path too, now that both
 * files live inside the adh package: adh's tsup builds with `splitting: false`, and a
 * relative `import('./ThemePickerRow')` would be inlined into AppearancePanel's entry
 * behind a lazy-init wrapper instead of code-split. This module used to sit in hub's own
 * Next-built app code, where the relative form was the right one — see the git history on
 * this file's move for that version of the comment.
 */

type AltTheme = { key: string; label: string };

/**
 * The selectable themes, read off the `<style data-adh-theme-alt>` blocks AdhThemeStyle
 * emitted — the same nodes the picker then switches between, so the menu cannot offer a
 * theme that isn't there or miss one that is.
 *
 * Deliberately NOT the theme manifest: every entry in that record carries a whole
 * stylesheet as a string, so importing it here would ship all ~37 themes' CSS text into
 * this site's JS bundle on top of the copies already in the markup. The labels ride on
 * the nodes for exactly this reason (see AdhThemeStyle).
 */
function readAltThemes(): AltTheme[] {
  const nodes = document.querySelectorAll<HTMLStyleElement>("style[data-adh-theme-alt]");
  return [...nodes]
    .map((el) => {
      const key = el.getAttribute("data-adh-theme-alt") ?? "";
      return { key, label: el.getAttribute("data-adh-theme-label") || key };
    })
    .filter((t) => t.key !== "")
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** The theme currently painting — the one alt-block the pre-paint left enabled. */
function activeAltTheme(): string | null {
  const el = document.querySelector<HTMLStyleElement>(
    'style[data-adh-theme-alt][media="all"]',
  );
  return el?.getAttribute("data-adh-theme-alt") ?? null;
}

/** The base block's key — what paints when no alt-block has been flipped on. */
function baseTheme(): string | null {
  const el = document.querySelector<HTMLStyleElement>("style[data-adh-theme]");
  return el?.getAttribute("data-adh-theme") ?? null;
}

/**
 * Dev-only theme picker. Switching is the alt-block media flip (applyBaseTheme) for the
 * live page plus the cookie write (persistTheme) so the choice survives a reload and
 * carries across the family's subdomains.
 *
 * Reads the DOM in an effect rather than during render: the blocks are server-rendered but
 * WHICH one is active is decided by the pre-paint script, so reading it during SSR would
 * both crash (no document) and hydrate to the wrong answer.
 */
export default function ThemePickerRow(): ReactElement | null {
  const [themes, setThemes] = useState<AltTheme[]>([]);
  const [current, setCurrent] = useState<string>("");

  useEffect(() => {
    const alts = readAltThemes();
    setThemes(alts);
    // Seed from the first candidate that actually has an <option>. A controlled <select>
    // whose value matches no option renders showing the FIRST one, so seeding with a bare
    // `?? ""` (or with a stored cookie naming a theme this site doesn't emit — the cookie
    // is shared across every site on the domain) made the picker display a theme that was
    // not the one painting, with nothing to indicate it.
    const known = new Set(alts.map((t) => t.key));
    const seed = [activeAltTheme(), readStoredTheme(), baseTheme()].find(
      (k): k is string => k != null && known.has(k),
    );
    setCurrent(seed ?? "");
  }, []);

  // Production emits no alt-blocks, so this is empty there even if the gate above it
  // were removed — and it is also what the first render (pre-effect) shows.
  if (themes.length === 0) return null;

  const select = (key: string): void => {
    applyBaseTheme(key);
    persistTheme(key);
    setCurrent(key);
  };

  return (
    <SettingRow
      label="Theme"
      description="Preview a theme on this device. Development builds only."
    >
      <Select
        aria-label="Theme"
        className="sm:w-56"
        value={current}
        onChange={(e) => select(e.target.value)}
      >
        {current === "" ? (
          <option value="" disabled>
            (theme in use is not listed)
          </option>
        ) : null}
        {themes.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </Select>
    </SettingRow>
  );
}
