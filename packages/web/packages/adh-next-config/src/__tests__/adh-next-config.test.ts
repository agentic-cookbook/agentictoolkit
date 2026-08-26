import { describe, expect, it, vi, afterEach } from "vitest";
import { FONT_CACHE_HEADERS, PRERENDER_HEADERS, SECURITY_HEADERS } from "@agentic-toolkit/next-headers";

// BOTH are required, and `restoreAllMocks` alone is the trap. `vi.doMock` registers a
// mock for the NEXT import of a module, but a module already imported in an earlier test
// stays cached in the registry — so without `resetModules` the first test to import
// `../index.js` decides which version every later test sees, and the mocks in tests 1-2
// either leak into test 3 or never take effect at all. Either way the suite goes green
// while asserting nothing about the code under test. `unstubAllEnvs` cleans up
// `vi.stubEnv` calls the same way — env tests below stub `VERCEL`/`ADH_DIST_DIR`/etc,
// and a leaked stub would silently decide a LATER test's branch.
afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// `assertHoistableDeps` must be mocked in EVERY test that reaches it, not only where the
// assertion is the subject. Task 2 made a nonexistent siteDir THROW (it used to return
// silently), so a test pointing cwd at a fake path now fails inside the gate before the
// config is ever assembled.
//
// `materializeThemeFonts` must be mocked in EVERY test too (fix round finding 1a): it now
// runs unconditionally, and the real implementation writes real files under
// `<cwd>/public/`, which does not exist for any of these fake site directories — it would
// throw (or, worse, try to create directories outside the test sandbox) before the config
// is ever assembled.
//
// `assertLinkedDepsInstalled` must be mocked in EVERY test too: it reads the site's
// `package.json` off disk and walks its `link:` targets, none of which exist for these
// fake site directories. Stubbing it here — rather than letting the real one run and
// happen to be quiet — is what makes an omission a loud vitest error ("No export is
// defined on the mock") instead of a real filesystem call inside a unit test.
function mockDeps(
  overrides: {
    assertHoistableDeps?: () => void;
    assertAuthApiUrl?: (u: string | undefined, id: string) => string | undefined;
    assertLinkedDepsInstalled?: () => void;
    materializeThemeFonts?: () => void;
  } = {},
) {
  vi.doMock("@agentic-toolkit/next-preflight", () => ({
    assertHoistableDeps: overrides.assertHoistableDeps ?? (() => {}),
    assertAuthApiUrl: overrides.assertAuthApiUrl ?? ((u: string | undefined) => u),
    assertLinkedDepsInstalled: overrides.assertLinkedDepsInstalled ?? (() => {}),
  }));
  vi.doMock("@agenticdevelopertoolkit/themes/materialize-fonts", () => ({
    materializeThemeFonts: overrides.materializeThemeFonts ?? (() => {}),
  }));
}

// For tests asserting env/rewrites values precisely: the real `@agentic-toolkit/next-env`
// reads a real (nonexistent) VERSION file and shells out to `git rev-parse HEAD`, which is
// deterministic enough for the redirect-only tests above but not worth relying on here —
// mock it so the "version/SHA wiring resolves through next-env" claim is actually pinned
// to a controlled value, not to whatever this checkout's HEAD happens to be.
function mockNextEnv(overrides: {
  resolveBackendUrl?: () => string;
  readSiteVersion?: () => string;
  commitSha?: () => string;
} = {}) {
  vi.doMock("@agentic-toolkit/next-env", () => ({
    resolveBackendUrl: overrides.resolveBackendUrl ?? (() => "http://backend.example"),
    readSiteVersion: overrides.readSiteVersion ?? (() => "1.2.3"),
    commitSha: overrides.commitSha ?? (() => "abc123def456"),
  }));
}

describe("adhNextConfig", () => {
  it("runs the declared-deps assertion before returning a config", async () => {
    const spy = vi.fn();
    mockDeps({ assertHoistableDeps: spy });
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    adhNextConfig();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("propagates the assertion's failure instead of returning a config", async () => {
    mockDeps({
      assertHoistableDeps: () => {
        throw new Error("undeclared: @agenticdevelopertoolkit/chat");
      },
    });
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    expect(() => adhNextConfig()).toThrowError(/@agenticdevelopertoolkit\/chat/);
  });

  // Fix round finding 4: `next-config-base.mjs:429-431` ran the auth check FIRST,
  // deliberately ("Before anything else: ..."), and a prior draft of this package
  // reversed it. Only the surfaced error changes when both would fail, but the order
  // was a documented choice — this pins it so a future edit can't silently re-reverse it.
  //
  // `linked` sits between them for two reasons, both recorded at the call site: it is a
  // pure filesystem walk where the hoistable-deps gate forks python3, and a stale install
  // is the cheaper explanation for a package that gate would then also fail to find.
  it("asserts NEXT_PUBLIC_AUTH_API_URL, then linked deps, then the hoistable-deps gate, then materializes fonts, in that order", async () => {
    const calls: string[] = [];
    mockDeps({
      assertAuthApiUrl: (u) => {
        calls.push("auth");
        return u;
      },
      assertLinkedDepsInstalled: () => {
        calls.push("linked");
      },
      assertHoistableDeps: () => {
        calls.push("deps");
      },
      materializeThemeFonts: () => {
        calls.push("fonts");
      },
    });
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    adhNextConfig();
    expect(calls).toEqual(["auth", "linked", "deps", "fonts"]);
  });

  // CI deleted its own stale-install guard on the grounds that the check "moved into
  // @agentic-toolkit/next-preflight". That is only honest if something calls the moved
  // code with the right argument — the site directory, not the repo root, not the
  // workspace root. These two tests are what makes it honest.
  it("runs the stale-install check against the site directory", async () => {
    const spy = vi.fn();
    mockDeps({ assertLinkedDepsInstalled: spy });
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    adhNextConfig();
    expect(spy).toHaveBeenCalledExactlyOnceWith("/repo/frontend/src/sites/help");
  });

  it("propagates a stale-install failure instead of returning a config", async () => {
    mockDeps({
      assertLinkedDepsInstalled: () => {
        throw new Error("linked dep not installed — run `pnpm build:shared`");
      },
    });
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    expect(() => adhNextConfig()).toThrowError(/build:shared/);
  });

  // EXACTLY ten, not "at least ten". `help` sets no `legacyHomePaths`, so ten is the whole
  // list — and a `toBeGreaterThanOrEqual` would keep passing if the legacy-home rules
  // leaked into a site that must not have them, which is the bug worth catching here.
  it("puts a site's registry redirects into the config", async () => {
    mockDeps();
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
    mockDeps();
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
    mockDeps();
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

  // Fix round finding 2: `headers()` had zero coverage. Assert the REAL header sets from
  // `@agentic-toolkit/next-headers` (not a re-derived literal), at the sources
  // `mergeHeaders` is documented to use, in order — including PRERENDER_HEADERS (fix
  // round finding 1b), which the review found silently dropped.
  it("merges the security, font-cache, and prerender header baselines", async () => {
    mockDeps();
    // The prerender baseline is emitted off-Vercel only (next-headers/prerender.ts), so
    // this pins the branch it names rather than inheriting whatever the runner had set.
    vi.stubEnv("VERCEL", "");
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    const rules = await adhNextConfig().headers!();
    expect(rules).toEqual([
      { source: "/(.*)", headers: SECURITY_HEADERS },
      { source: "/fonts/:path*", headers: FONT_CACHE_HEADERS },
      { source: "/:path*", headers: PRERENDER_HEADERS },
    ]);
  });

  // The other branch, asserted through `adhNextConfig` rather than through `mergeHeaders`
  // alone: the gate lives in next-headers, but this is the call every one of the 47 sites
  // actually makes, and it is what a deployed site's response headers come from.
  it("emits no credentialed-prerender opt-in on a hosted build", async () => {
    mockDeps();
    vi.stubEnv("VERCEL", "1");
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    const rules = await adhNextConfig().headers!();
    expect(rules).toEqual([
      { source: "/(.*)", headers: SECURITY_HEADERS },
      { source: "/fonts/:path*", headers: FONT_CACHE_HEADERS },
    ]);
  });

  // Fix round finding 2: `env` had zero coverage beyond the auth-url wiring test above.
  // Assert all four keys, with version/SHA resolving through the (mocked)
  // `@agentic-toolkit/next-env`, and the auth url resolving through `assertAuthApiUrl`.
  it("wires all four env keys, with version/SHA resolving through next-env", async () => {
    mockDeps();
    mockNextEnv({ readSiteVersion: () => "1.2.3", commitSha: () => "abc123def456" });
    vi.stubEnv("DEPLOYMENT_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_URL", "https://auth.example.com");
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    const config = adhNextConfig();
    expect(config.env).toEqual({
      NEXT_PUBLIC_DEPLOYMENT_ENV: "preview",
      NEXT_PUBLIC_AUTH_API_URL: "https://auth.example.com",
      NEXT_PUBLIC_ADH_SITE_VERSION: "1.2.3",
      NEXT_PUBLIC_ADH_RELEASE: "abc123def456",
    });
  });

  // Fix round finding 2: `rewrites()` had zero coverage, and finding 3 removed the dead
  // `/api/system/:path*` duplicate — assert the SURVIVING rule's exact value AND that the
  // dead one is gone, so a regression that re-adds it fails loudly.
  it("emits only the general BFF proxy rewrite (the /api/system duplicate is dead code)", async () => {
    mockDeps();
    mockNextEnv({ resolveBackendUrl: () => "http://backend.example" });
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    const rewrites = await adhNextConfig().rewrites!();
    expect(rewrites).toEqual([{ source: "/api/:path*", destination: "http://backend.example/:path*" }]);
  });

  // Fix round finding 2: `staleTimes`, `distDir`, `devIndicators` had zero coverage.
  it("sets devIndicators, distDir, and staleTimes to their fixed values", async () => {
    mockDeps();
    mockNextEnv();
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    const config = adhNextConfig();
    expect(config.devIndicators).toBe(false);
    expect(config.distDir).toBe(".next");
    expect(config.experimental).toEqual({ staleTimes: { dynamic: 30 } });
  });

  it("lets ADH_DIST_DIR override distDir", async () => {
    mockDeps();
    mockNextEnv();
    vi.stubEnv("ADH_DIST_DIR", ".next-e2e");
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    expect(adhNextConfig().distDir).toBe(".next-e2e");
  });

  // Fix round finding 2: the off-Vercel turbopack/outputFileTracingRoot pin had zero
  // coverage in either direction.
  it("pins turbopack.root and outputFileTracingRoot off Vercel", async () => {
    mockDeps();
    mockNextEnv();
    vi.stubEnv("VERCEL", "");
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    const config = adhNextConfig();
    expect(config.turbopack).toEqual({ root: "/repo/frontend/src" });
    expect(config.outputFileTracingRoot).toBe("/repo/frontend/src");
  });

  it("skips the turbopack/outputFileTracingRoot pin on Vercel", async () => {
    mockDeps();
    mockNextEnv();
    vi.stubEnv("VERCEL", "1");
    vi.spyOn(process, "cwd").mockReturnValue("/repo/frontend/src/sites/help");
    const { adhNextConfig } = await import("../index.js");
    const config = adhNextConfig();
    expect(config.turbopack).toBeUndefined();
    expect(config.outputFileTracingRoot).toBeUndefined();
  });
});
