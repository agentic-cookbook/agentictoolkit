// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  CONNECTIONS_HASH,
  FALLBACK_RETURN_TO,
  currentReturnTo,
  stashPendingConnect,
  readPendingConnect,
  hasPendingConnect,
  markPendingConnectConsumed,
  wasPendingConnectConsumed,
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

  /**
   * The WRITE side of the same check the read side has always made.
   *
   * `pathname` looks like it cannot be anything but a path, and a leading-slash assertion
   * passes on every value it ever holds — including this one. A browser at
   * `https://shipr.example//evil.example/pwned` reports `pathname` as `//evil.example/pwned`,
   * which starts with a slash, is stashed verbatim, survives the read-side check that only
   * inspects what is already stored, and becomes a PROTOCOL-RELATIVE `router.replace` at the
   * end of a connect the visitor was asked to trust. So the address is run through the same
   * `safeReturnTo` the stash is read back through, and a value it cannot vouch for is
   * replaced by the family fallback rather than carried.
   */
  it("refuses a protocol-relative pathname, which a leading-slash check accepts", () => {
    atLocation({ pathname: "//evil.example/pwned", search: "", hash: "" });
    expect(currentReturnTo()).toBe(FALLBACK_RETURN_TO);
  });

  it("is origin-relative, so it can never send the visitor to another site", () => {
    atLocation({ pathname: "/home", search: "?a=1", hash: "" });
    expect(currentReturnTo().startsWith("/")).toBe(true);
    expect(currentReturnTo().startsWith("//")).toBe(false);
  });
});

describe("the returnTo is a navigation, so it is validated as one", () => {
  // `sessionStorage` is writable by anything running on this origin, and this is the one
  // stashed field that becomes `router.replace()`. Everything else is echoed to an API that
  // authorizes it; a foreign URL here is an open redirect at the end of a flow the visitor
  // has already been asked to trust, arriving as the last step of a successful connect.
  it.each([
    ["an absolute URL on another origin", "https://evil.example/pwned"],
    ["a protocol-relative URL", "//evil.example/pwned"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html,<script>alert(1)</script>"],
  ])("refuses %s", (_label, returnTo) => {
    sessionStorage.setItem(KEY, JSON.stringify({ ...GITHUB_APP, returnTo }));
    expect(readPendingConnect(STATE)).toBeNull();
  });

  it("keeps a same-origin absolute URL, reduced to the part below the origin", () => {
    // Not a refusal: it names this very page. `safeReturnTo` returns the relative remainder,
    // which is what `router.replace` wants and what makes the two forms indistinguishable
    // downstream.
    const returnTo = `${window.location.origin}/acme/repos?tab=all#connections`;
    sessionStorage.setItem(KEY, JSON.stringify({ ...GITHUB_APP, returnTo }));
    expect(readPendingConnect(STATE)?.returnTo).toBe("/acme/repos?tab=all#connections");
  });
});

describe("telling 'nothing was stashed' from 'the stash is unusable'", () => {
  // The two are one `null` from `readPendingConnect` and want opposite handling: the first is
  // the ordinary case a GitHub App's single Setup URL guarantees, and is recoverable from the
  // signed state; the second is not, and reporting it as the first sends the operator round a
  // rebuilt flow that fails again the same way with nothing new to see.
  it("is true for a key that was written but cannot be read back", () => {
    sessionStorage.setItem(KEY, "{not json");
    expect(readPendingConnect(STATE)).toBeNull();
    expect(hasPendingConnect(STATE)).toBe(true);
  });

  it("is true for a stash rejected only by the returnTo check", () => {
    sessionStorage.setItem(KEY, JSON.stringify({ ...GITHUB_APP, returnTo: "https://evil.example" }));
    expect(readPendingConnect(STATE)).toBeNull();
    expect(hasPendingConnect(STATE)).toBe(true);
  });

  it("is false for a state this origin never stashed anything under", () => {
    expect(hasPendingConnect("never-seen")).toBe(false);
  });

  it("is false again once the entry is cleared", () => {
    stashPendingConnect(STATE, GITHUB_APP);
    clearPendingConnect(STATE);
    expect(hasPendingConnect(STATE)).toBe(false);
  });
});

describe("the tombstone a spent state leaves behind", () => {
  it("outlives the stash it replaces, which is what makes a replay recognizable", () => {
    // A refresh of the callback URL is the ordinary way to arrive here twice. Without the
    // tombstone the second visit is indistinguishable from a first one on an origin that
    // stashed nothing, so it re-POSTs a one-shot credential and shows the operator the 409
    // — and Sentry an event — for reloading a page that had already succeeded.
    stashPendingConnect(STATE, GITHUB_APP);
    markPendingConnectConsumed(STATE);
    clearPendingConnect(STATE);
    expect(readPendingConnect(STATE)).toBeNull();
    expect(hasPendingConnect(STATE)).toBe(false);
    expect(wasPendingConnectConsumed(STATE)).toBe(true);
  });

  it("is false for a state that was never spent", () => {
    stashPendingConnect(STATE, GITHUB_APP);
    expect(wasPendingConnectConsumed(STATE)).toBe(false);
  });

  it("is per state, so one spent connect does not silence another in flight", () => {
    markPendingConnectConsumed("a");
    expect(wasPendingConnectConsumed("a")).toBe(true);
    expect(wasPendingConnectConsumed("b")).toBe(false);
  });
});

describe("the address a rebuilt context comes back to", () => {
  it("names the family entry point and the fragment that reopens the surface", () => {
    // Both halves matter: `/home` is the one path every site in the family mounts and
    // resolves a workspace from, and the fragment is what a console reads to reopen the
    // dialog the connect was started from. A site whose /home has no such surface simply
    // ignores it, which is the right way for a fragment to fail.
    expect(FALLBACK_RETURN_TO).toBe(`/home${CONNECTIONS_HASH}`);
    expect(FALLBACK_RETURN_TO.startsWith("/")).toBe(true);
  });
});
