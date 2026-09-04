// @vitest-environment jsdom
import { describe, it, expect } from "vitest";

import {
  OAUTH_STATE_FUTURE_SKEW_MS,
  OAUTH_STATE_TTL_MS,
  decodeOAuthStateClaims,
  isOAuthStateFresh,
} from "../integrations/integrations";

/**
 * The clear half of the signed `state` the hub mints, read back on the client.
 *
 * Nothing here is a security decision — the backend re-verifies the HMAC, the caller and the
 * ecosystem on every connect — but everything here is a CORRECTNESS decision, because these
 * values are echoed straight back to that endpoint. A claim decoded wrong does not fail here;
 * it fails as a 400 naming a provider or an ecosystem that does not exist, one page load and
 * one origin away from the code that mangled it.
 */

const b64url = (s: string) =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** base64url of the UTF-8 BYTES, which is what the backend writes — `btoa` alone throws on
 *  anything above U+00FF, so a test that used it could only ever carry ASCII. */
const b64urlUtf8 = (s: string) =>
  b64url(String.fromCharCode(...new TextEncoder().encode(s)));

const CLAIMS = {
  customerId: "cus-1",
  providerId: "github-app",
  serviceType: "code",
  ecosystemId: "eco-1",
  iat: 1_700_000_000_000,
};

const state = (payload: string, signature = "sig") => `${payload}.${signature}`;

describe("decodeOAuthStateClaims", () => {
  it("reads the claims out of a state in the shape the backend mints", () => {
    expect(decodeOAuthStateClaims(state(b64urlUtf8(JSON.stringify(CLAIMS))))).toEqual(CLAIMS);
  });

  it("decodes the payload as UTF-8, not as one byte per character", () => {
    // `atob` yields BYTES, one per code unit. Read as a string, every multi-byte character
    // arrives as separate Latin-1 characters — mojibake in exactly the fields that are then
    // echoed to the connect endpoint, where they match nothing. Today's ids are ASCII, which
    // is why this is a defect a customer would find and we would not.
    const claims = { ...CLAIMS, serviceType: "café", ecosystemId: "eco-Ωmega" };
    expect(decodeOAuthStateClaims(state(b64urlUtf8(JSON.stringify(claims))))).toEqual(claims);
  });

  it("survives the url-safe alphabet, which atob rejects on its own", () => {
    // `-` and `_` stand in for `+` and `/`. A payload that happens to encode either is the
    // only one that fails, so the bug would be intermittent rather than absent.
    const claims = { ...CLAIMS, ecosystemId: "eco-ÿþý" };
    const payload = b64urlUtf8(JSON.stringify(claims));
    expect(payload).toMatch(/[-_]/);
    expect(decodeOAuthStateClaims(state(payload))).toEqual(claims);
  });

  it.each([
    ["a string with no dot at all", "notastate"],
    ["a leading dot, so there is no payload", ".sig"],
    ["a trailing dot, so there is no signature", `${b64urlUtf8(JSON.stringify(CLAIMS))}.`],
    ["a payload that is not base64", state("!!!not base64!!!")],
    ["a payload that is not JSON", state(b64urlUtf8("not json"))],
    ["a payload that is JSON but not an object", state(b64urlUtf8('"a string"'))],
    ["null", state(b64urlUtf8("null"))],
  ])("returns null for %s", (_label, raw) => {
    expect(decodeOAuthStateClaims(raw)).toBeNull();
  });

  it.each(["customerId", "providerId", "serviceType", "ecosystemId"] as const)(
    "returns null when %s is missing",
    (field) => {
      const partial: Record<string, unknown> = { ...CLAIMS };
      delete partial[field];
      expect(decodeOAuthStateClaims(state(b64urlUtf8(JSON.stringify(partial))))).toBeNull();
    },
  );

  it.each(["customerId", "providerId", "serviceType", "ecosystemId"] as const)(
    "returns null when %s is blank",
    (field) => {
      const blank = { ...CLAIMS, [field]: "" };
      expect(decodeOAuthStateClaims(state(b64urlUtf8(JSON.stringify(blank))))).toBeNull();
    },
  );

  it("returns null when iat is not a finite number", () => {
    // A recovered context is driven off these claims, and an unusable `iat` would make every
    // freshness answer below meaningless rather than merely wrong.
    for (const iat of ["1700000000000", null, Number.NaN, Number.POSITIVE_INFINITY]) {
      const claims = { ...CLAIMS, iat };
      expect(decodeOAuthStateClaims(state(b64urlUtf8(JSON.stringify(claims))))).toBeNull();
    }
  });
});

describe("isOAuthStateFresh", () => {
  const now = 1_700_000_000_000;

  it("accepts a state minted just now", () => {
    expect(isOAuthStateFresh({ iat: now }, now)).toBe(true);
  });

  it("accepts one at the very edge of the window", () => {
    expect(isOAuthStateFresh({ iat: now - OAUTH_STATE_TTL_MS }, now)).toBe(true);
  });

  it("refuses one a millisecond past it", () => {
    // The case this exists for is not an edge: `setup_action=request` means an org owner has
    // to approve the installation, and an approval that lands eleven minutes later carries a
    // state the backend is certain to reject.
    expect(isOAuthStateFresh({ iat: now - OAUTH_STATE_TTL_MS - 1 }, now)).toBe(false);
  });

  it("tolerates an issuer clock a little ahead of ours", () => {
    expect(isOAuthStateFresh({ iat: now + OAUTH_STATE_FUTURE_SKEW_MS }, now)).toBe(true);
    expect(isOAuthStateFresh({ iat: now + OAUTH_STATE_FUTURE_SKEW_MS + 1 }, now)).toBe(false);
  });

  it("reads iat as milliseconds, the unit the backend stamps", () => {
    // A seconds epoch read as milliseconds dates to 1970, which is the whole TTL in the wrong
    // direction: every state would be refused as stale, and the connect flow would never
    // complete for anyone.
    expect(isOAuthStateFresh({ iat: Math.floor(now / 1000) }, now)).toBe(false);
  });
});
