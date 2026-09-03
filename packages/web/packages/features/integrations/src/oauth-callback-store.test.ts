// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  currentReturnTo,
  stashPendingConnect,
  readPendingConnect,
  clearPendingConnect,
  type PendingOAuthConnect,
} from "./oauth-callback-store";

/**
 * The stash is the ONLY thing that survives the provider round-trip, so everything the
 * callback needs it either finds here or does without. That makes this module's failure mode
 * silent by construction: a value that is present but blank reads as "found", travels to
 * `POST /integrations/connect` as an empty `providerId`, and comes back a 4xx that names the
 * request rather than the write that produced it — one page load and one origin ago.
 *
 * So the cases below are almost all about REFUSING, not about reading. A stash the callback
 * cannot finish must come back `null`, which is the one answer the callback already has an
 * honest screen for.
 */

const GITHUB_APP: PendingOAuthConnect = {
  authMethod: "github_app",
  providerId: "github-app",
  serviceType: "code",
  ecosystemId: "eco-1",
  returnTo: "/acme/repos?tab=all#connections",
};

const OAUTH: PendingOAuthConnect = {
  authMethod: "oauth",
  providerId: "slack",
  serviceType: "messaging",
  ecosystemId: "eco-1",
  returnTo: "/settings/integrations",
  redirectUri: "https://app.example.test/integrations/oauth-callback",
};

const STATE = "state-token";
const KEY = `int-oauth-connect:${STATE}`;

beforeEach(() => sessionStorage.clear());

describe("the pending-connect stash", () => {
  it("round-trips a github_app context, hash and query intact", () => {
    stashPendingConnect(STATE, GITHUB_APP);
    // The returnTo survives verbatim: its `?tab=` and `#connections` are the only record
    // that the operator was inside a dialog when they left.
    expect(readPendingConnect(STATE)).toEqual(GITHUB_APP);
  });

  it("round-trips an oauth context with its redirect_uri", () => {
    stashPendingConnect(STATE, OAUTH);
    expect(readPendingConnect(STATE)).toEqual(OAUTH);
  });

  it("keys by state, so two in-flight connects don't clobber each other", () => {
    stashPendingConnect("a", GITHUB_APP);
    stashPendingConnect("b", OAUTH);
    expect(readPendingConnect("a")).toEqual(GITHUB_APP);
    expect(readPendingConnect("b")).toEqual(OAUTH);
  });

  it("returns null for a state nothing was stashed under", () => {
    expect(readPendingConnect("never-seen")).toBeNull();
  });

  it("returns null rather than throwing on a corrupt entry", () => {
    sessionStorage.setItem(KEY, "{not json");
    expect(readPendingConnect(STATE)).toBeNull();
  });

  it("refuses an auth method that does not use the redirect round-trip", () => {
    sessionStorage.setItem(KEY, JSON.stringify({ ...GITHUB_APP, authMethod: "api_key" }));
    expect(readPendingConnect(STATE)).toBeNull();
  });

  // The regression this file exists for. `typeof x === "string"` accepts "", and every one
  // of these fields is sent verbatim to the connect endpoint or handed to `router.replace`.
  it.each(["providerId", "serviceType", "ecosystemId", "returnTo"] as const)(
    "refuses a stash whose %s is blank",
    (field) => {
      sessionStorage.setItem(KEY, JSON.stringify({ ...GITHUB_APP, [field]: "" }));
      expect(readPendingConnect(STATE)).toBeNull();
    },
  );

  it.each(["providerId", "serviceType", "ecosystemId", "returnTo"] as const)(
    "refuses a stash whose %s is missing",
    (field) => {
      const partial: Record<string, unknown> = { ...GITHUB_APP };
      delete partial[field];
      sessionStorage.setItem(KEY, JSON.stringify(partial));
      expect(readPendingConnect(STATE)).toBeNull();
    },
  );

  it("refuses an oauth stash with no redirect_uri to echo", () => {
    const { redirectUri: _dropped, ...withoutUri } = OAUTH;
    sessionStorage.setItem(KEY, JSON.stringify(withoutUri));
    expect(readPendingConnect(STATE)).toBeNull();
  });

  it("refuses an oauth stash whose redirect_uri is blank", () => {
    // A token exchange echoing "" is a mismatch at the provider, not a defaulted value.
    sessionStorage.setItem(KEY, JSON.stringify({ ...OAUTH, redirectUri: "" }));
    expect(readPendingConnect(STATE)).toBeNull();
  });

  it("does not demand a redirect_uri of github_app, which never sent one", () => {
    sessionStorage.setItem(KEY, JSON.stringify(GITHUB_APP));
    expect(readPendingConnect(STATE)?.authMethod).toBe("github_app");
  });

  it("clears a consumed entry so a replayed callback can't re-fire it", () => {
    stashPendingConnect(STATE, GITHUB_APP);
    clearPendingConnect(STATE);
    expect(readPendingConnect(STATE)).toBeNull();
  });

  it("clears a state that was never stashed without throwing", () => {
    expect(() => clearPendingConnect("never-seen")).not.toThrow();
  });
});

describe("currentReturnTo", () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
  });

  function atLocation(parts: { pathname: string; search: string; hash: string }) {
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, ...parts },
    });
    restore = () =>
      Object.defineProperty(window, "location", { configurable: true, value: original });
  }

  it("keeps the query and the hash, which are where a host records an open dialog", () => {
    atLocation({ pathname: "/acme/repos", search: "?workspace=acme", hash: "#connections" });
    expect(currentReturnTo()).toBe("/acme/repos?workspace=acme#connections");
  });

  it("is just the path when there is nothing else to carry", () => {
    atLocation({ pathname: "/settings/integrations", search: "", hash: "" });
    expect(currentReturnTo()).toBe("/settings/integrations");
  });

  it("is origin-relative, so it can never send the visitor to another site", () => {
    atLocation({ pathname: "/home", search: "?a=1", hash: "" });
    expect(currentReturnTo().startsWith("/")).toBe(true);
  });
});
