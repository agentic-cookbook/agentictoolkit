import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveBackendUrl } from "../index.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * The throw is a conjunction of three things — no `API_BACKEND_URL`, `requireExplicit`,
 * and `VERCEL_ENV` — and each conjunct is load-bearing for a different reason. So the
 * cases below are the truth table, not a sample: every row exists to kill one specific
 * mutation, because dropping any single conjunct still leaves a function that looks
 * correct and passes a happy-path test.
 *
 * This branch exists to stop a build being green locally and red (or worse, green and
 * broken) on Vercel, and this function is one of the two places that judgement is made.
 */
describe("resolveBackendUrl", () => {
  it("falls back to localhost when the variable is unset", () => {
    vi.stubEnv("API_BACKEND_URL", undefined);
    vi.stubEnv("VERCEL_ENV", undefined);
    expect(resolveBackendUrl()).toBe("http://localhost:3000");
  });

  it("throws on a hosted build when the site requires the variable", () => {
    vi.stubEnv("API_BACKEND_URL", undefined);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(() => resolveBackendUrl({ requireExplicit: true })).toThrowError(
      /API_BACKEND_URL is not set/,
    );
  });

  // The message names the environment it saw. A build log that says only "not set"
  // cannot distinguish a missing production variable from a missing preview one, which
  // are different mistakes with different fixes.
  it("names the environment in the failure", () => {
    vi.stubEnv("API_BACKEND_URL", undefined);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => resolveBackendUrl({ requireExplicit: true })).toThrowError(/production/);
  });

  // Kills the "drop the VERCEL_ENV conjunct" mutation. Without this, an opted-in site
  // could no longer be built or dev'd locally at all — bitbag and personaregistry would
  // fail `next dev` on every developer's machine.
  it("does not throw off Vercel, even when the site requires the variable", () => {
    vi.stubEnv("API_BACKEND_URL", undefined);
    vi.stubEnv("VERCEL_ENV", undefined);
    expect(resolveBackendUrl({ requireExplicit: true })).toBe("http://localhost:3000");
  });

  // Kills the "make requireExplicit the default" mutation — the tempting simplification,
  // and the one that breaks the most. ~45 sites have been deploying without the variable;
  // flipping this fleet-wide fails all of their next builds at once.
  it("does not throw on a hosted build for a site that has not opted in", () => {
    vi.stubEnv("API_BACKEND_URL", undefined);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(resolveBackendUrl()).toBe("http://localhost:3000");
  });

  // Whitespace is not a value: `?.trim()` runs before the emptiness test, so a variable
  // set to " " must fail exactly as an unset one does. An env var set to an empty-looking
  // string is a routine copy-paste artifact in a dashboard.
  it("treats a whitespace-only value as unset", () => {
    vi.stubEnv("API_BACKEND_URL", "   ");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => resolveBackendUrl({ requireExplicit: true })).toThrowError(
      /API_BACKEND_URL is not set/,
    );
  });

  // The origin is concatenated with "/api/..." paths downstream, so a trailing slash
  // would produce "//api" — the defect the docstring says this function was extracted to
  // make impossible.
  it("strips trailing slashes from an explicit origin", () => {
    vi.stubEnv("API_BACKEND_URL", "https://api.example.com///");
    expect(resolveBackendUrl()).toBe("https://api.example.com");
  });

  it("returns an explicit origin on a hosted build without complaint", () => {
    vi.stubEnv("API_BACKEND_URL", "https://api.example.com");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(resolveBackendUrl({ requireExplicit: true })).toBe("https://api.example.com");
  });
});
