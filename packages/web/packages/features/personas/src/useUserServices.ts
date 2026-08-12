"use client";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { useResourceList, type ResourceList } from "@agentic-toolkit/data";
import { api, type UserService } from "@agentic-toolkit/data/personas";

/**
 * The caller's LLM services — ONE cache entry, read by both surfaces that show them.
 *
 * Two panes need this list: the Services section, which owns it, and the Personas section, whose
 * editor picks a service per ability. They used to read it through two different caches — a
 * `useResourceList` key here and a hand-rolled `useQuery(["persona-services", tenant])` there — so
 * one open Services pane and one open persona editor meant two requests for the same bytes, and
 * neither one's invalidation reached the other: creating a service left the persona editor's
 * picker missing it until something else happened to refetch. A shared hook is what makes "the
 * services" one fact rather than two copies that agree by luck.
 *
 * The key is exported because a caller that writes services WITHOUT going through this hook still
 * has to reach the entry — `revalidateResources((k) => k === PERSONA_SERVICES_CACHE_KEY)`.
 */
export const PERSONA_SERVICES_CACHE_KEY = "persona-services";

/** Reported here and RETHROWN, because this list IS the surface — the panes show the failure.
 *  `reportErrors: false` below is what keeps one failure from being reported twice under two
 *  different contexts. Module scope, which is what `useResourceList` requires of a fetcher: a new
 *  identity means "the scope changed, read again", so an inline closure would read every render. */
function loadUserServices(): Promise<UserService[]> {
  return api.services.list().catch((err) => {
    reportUnexpectedAuthError(err, { feature: "services", step: "list" });
    throw err;
  });
}

export function useUserServices(): ResourceList<UserService> {
  return useResourceList<UserService>(PERSONA_SERVICES_CACHE_KEY, loadUserServices, {
    reportErrors: false,
  });
}
