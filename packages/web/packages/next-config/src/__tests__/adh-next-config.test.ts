import { describe, expect, it, vi, afterEach } from "vitest";

// BOTH are required, and `restoreAllMocks` alone is the trap. `vi.doMock` registers a
// mock for the NEXT import of a module, but a module already imported in an earlier test
// stays cached in the registry — so without `resetModules` the first test to import
// `../index.js` decides which version every later test sees, and the mocks in tests 1-2
// either leak into test 3 or never take effect at all. Either way the suite goes green
// while asserting nothing about the code under test.
afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

// `assertHoistableDeps` must be mocked in EVERY test that reaches it, not only where the
// assertion is the subject. Task 2 made a nonexistent siteDir THROW (it used to return
// silently), so a test pointing cwd at a fake path now fails inside the gate before the
// config is ever assembled.
const passthroughPreflight = () =>
  vi.doMock("@agentic-toolkit/next-preflight", () => ({
    assertHoistableDeps: () => {},
    assertAuthApiUrl: (u: string) => u,
  }));

describe("adhNextConfig", () => {
  it("runs the declared-deps assertion before returning a config", async () => {
    const spy = vi.fn();
    vi.doMock("@agentic-toolkit/next-preflight", () => ({
      assertHoistableDeps: spy,
      assertAuthApiUrl: (u: string) => u,
    }));
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    adhNextConfig();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("propagates the assertion's failure instead of returning a config", async () => {
    vi.doMock("@agentic-toolkit/next-preflight", () => ({
      assertHoistableDeps: () => {
        throw new Error("undeclared: @agenticdevelopertoolkit/chat");
      },
      assertAuthApiUrl: (u: string) => u,
    }));
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    expect(() => adhNextConfig()).toThrowError(/@agenticdevelopertoolkit\/chat/);
  });

  // EXACTLY ten, not "at least ten". `help` sets no `legacyHomePaths`, so ten is the whole
  // list — and a `toBeGreaterThanOrEqual` would keep passing if the legacy-home rules
  // leaked into a site that must not have them, which is the bug worth catching here.
  it("puts a site's registry redirects into the config", async () => {
    passthroughPreflight();
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    const redirects = await adhNextConfig().redirects!();
    expect(redirects).toHaveLength(10);
    expect(redirects.every((r) => r.permanent)).toBe(true);
  });

  // The exempt pair's path (Ruling T4-a). `hub` carries NO registry redirect data, so
  // everything here arrives through the parameter. Without this test the argument-free
  // signature looks correct and cookbook/hub lose their redirects silently at Task 6.
  it("accepts call-site options for a site the registry deliberately has no data for", async () => {
    passthroughPreflight();
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/hub");
    const { adhNextConfig } = await import("../index.js");
    const mine = { source: "/old", destination: "/new", permanent: false };
    const redirects = await adhNextConfig({ extraRedirects: [mine] }).redirects!();
    expect(redirects).toContainEqual(mine);
  });

  // Order is load-bearing: `marketing.next-config.mjs:68-69` emits extraRedirects BEFORE
  // the legacy-home rule, and Next matches redirects first-to-last. Reversing them lets
  // the broad `/home/:path+` rule swallow a specific `/home/...` redirect a site declared.
  it("emits extraRedirects before the legacy-home rules", async () => {
    passthroughPreflight();
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/hub");
    const { adhNextConfig } = await import("../index.js");
    const mine = { source: "/home/mine", destination: "/mine", permanent: false };
    const redirects = await adhNextConfig({
      extraRedirects: [mine],
      legacyHomePaths: true,
    }).redirects!();
    const mineAt = redirects.findIndex((r) => r.source === "/home/mine");
    const legacyAt = redirects.findIndex((r) => r.source.startsWith("/home/:"));
    expect(mineAt).toBeGreaterThanOrEqual(0);
    expect(legacyAt).toBeGreaterThan(mineAt);
  });
});
