"use client";

import { createContext, useContext } from "react";

/**
 * How one settings panel sends the user to a SIBLING settings section.
 *
 * A panel cannot do this with a link. The sections are a rail inside whatever surface is
 * hosting them — hub's `/settings` route, the User Settings overlay every site mounts, or
 * hub's workspace stack — and only two of those have a URL at all. `AccountPanel` learned
 * this the expensive way: it linked to `/<slug>/notifications` (404 on hub), then to
 * `/settings/notifications`, which exists in exactly ONE of the fleet's 48 site directories.
 * On the other 44 sites the click 404'd, destroying the modal AND the page underneath it.
 *
 * So the host publishes the move instead. {@link SettingsLayout} provides this with its own
 * section switcher, which already routes or switches in place as that host requires.
 *
 * Null outside a provider — a panel rendered somewhere with no sibling rail to move within
 * (hub's workspace-settings stack renders the same panels as levels of a different stack).
 * Callers must handle that; there is no safe no-op, because "the link did nothing" is the
 * failure mode this context exists to remove.
 */
export type SettingsNav = {
  /** Show the section with this id. No-ops for an id the host is not rendering. */
  goToTopic: (topicId: string) => void;
};

const SettingsNavContext = createContext<SettingsNav | null>(null);

export const SettingsNavProvider = SettingsNavContext.Provider;

/** The host's section switcher, or null when this panel has no sibling rail. */
export function useSettingsNav(): SettingsNav | null {
  return useContext(SettingsNavContext);
}
