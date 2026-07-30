import { describe, expect, it } from "vitest";
import { isLocalHostname } from "@agentic-toolkit/auth";
import { detectEnv } from "@agentic-toolkit/adh-registry";

// `@agentic-toolkit/auth`'s isLocalHostname is a deliberate MIRROR of
// `@agentic-toolkit/adh-registry`'s detectEnv 'local' branch: auth is generic and must not
// know about the adh site registry, so it re-states the rule instead of importing it. This
// test pins the two, so a new local form (a dev TLD, a LAN convention) added to one side
// fails CI instead of producing environment-dependent silent-SSO behavior between sites.
//
// Home: `@agentic-toolkit/adh`, because it is the only package that depends on BOTH halves.
// Neither half can host it: putting it in `auth` would give the generic package a dependency
// on adh vocabulary — the exact coupling the mirror exists to avoid — and `adh-registry` has
// no runtime dependencies at all, deliberately. Nothing in this package imports
// isLocalHostname; this test is the only thing here that names it. That is the point — the
// guard lives wherever the two sides can meet, not wherever either one is used.
//
// It rode in the @adh-shared auth shim until Task 6.4 deleted that package. The reason it
// landed HERE has changed since: the registry was adh-owned app code the toolkit was
// forbidden to import (frontend/tools/verify_toolkit_boundary.py), so this was the nearest
// suite that could see both. Now the registry is a toolkit package too, and what keeps the
// test here is the dependency shape above rather than a boundary.
describe("isLocalHostname mirrors detectEnv's local branch", () => {
  const CASES = [
    "localhost",
    "LOCALHOST",
    "localhost:3000",
    "127.0.0.1",
    "127.1.2.3:8080",
    "::1",
    "dev.local",
    "hub.dev.local",
    "hub-shared-refactor.dev.local",
    "foo.localhost",
    "agenticdeveloperhub.com",
    "www.agenticdeveloperhub.com",
    "staging.agenticdeveloperhub.com",
    "testing.agenticdeveloperhub.com",
    "vercel.app",
    "my-site.vercel.app",
    "10.0.0.5",
    "192.168.1.10:5173",
    "example.localdomain",
    "notlocal.com",
  ];

  for (const hostname of CASES) {
    it(`agrees on ${hostname}`, () => {
      expect(isLocalHostname(hostname)).toBe(detectEnv(hostname) === "local");
    });
  }
});
