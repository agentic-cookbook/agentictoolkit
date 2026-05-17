# Adopting `agentic-web-toolkit`

This doc is for the **decision** and the **operational hazards** —
specifically the runaway-`node`-process trap that the conversion to a
real `dist/` build was meant to defuse. For wiring instructions go to
[`next-js-consumer.md`](next-js-consumer.md); for moving off the old
umbrella `file:` dep, [`migrate-consumer.md`](migrate-consumer.md).

---

## Should you adopt?

Adopt when **all** of these are true:

- You're shipping a **Next.js 15 + React 19 + TypeScript + Tailwind v4**
  app (App Router). Older Next.js, CRA, plain Vite SPAs are not target
  consumers — wiring may work but isn't validated.
- You either control the consumer repo enough to make it a pnpm
  workspace, **or** you're willing to consume the toolkit via published
  GitHub Packages (when Phase 6 is enabled).
- You're comfortable pinning to a submodule SHA and bumping it
  intentionally — `workspace:*` has no semver, and the toolkit will
  evolve. You get reproducibility, not auto-updates.

Don't adopt when:

- You need a stable, externally-published, semver-versioned library on
  npm today. Phase 6 publishing is optional and deferred.
- You can't switch the consumer repo from npm to pnpm. The
  submodule-federation pattern requires pnpm; the published-package
  pattern (Phase 6, future) can use any package manager, but that's the
  trade.
- Your app is not Next.js 15+. The toolkit's `"use client"` boundaries
  and SSR-safe layout effects assume App Router semantics.

## Adoption checklist

1. **Decide the integration pattern.**
   - **Submodule + workspace federation** (preferred): you control the
     consumer repo and can adopt pnpm. Toolkit lives at
     `external/agentic-web-toolkit/`; pinned by SHA.
   - **Published packages from GitHub Packages**: external consumer or
     you can't restructure as a workspace. Requires Phase 6 to have
     shipped first; the toolkit isn't on a registry by default.
2. **Pick the surface area.** Don't add every `@agentic-web-toolkit/*`
   package to `dependencies`. Add only what you actually import. The
   typical consumer needs `themes`, `ui`, and one or two of
   `chat`/`controls`/`content`.
3. **Wire the root layout once.** `ColorModeProvider` + `ThemeStyle` go
   in `app/layout.tsx`; theme CSS is `@import`-ed in `globals.css`. See
   [`next-js-consumer.md`](next-js-consumer.md) for the exact snippets.
4. **Point Tailwind v4 at `dist/`, not source.** Use `@source` directive
   in your CSS entry. Tailwind needs to scan compiled JSX, not the
   library's `.tsx`.
5. **Run from the workspace root, not inside the submodule.** The
   submodule is a sibling workspace package; you don't `cd` into it to
   build. `pnpm install` at consumer root is enough.
6. **Bump intentionally.** When you want a newer toolkit:
   ```bash
   git -C external/agentic-web-toolkit checkout <ref>
   pnpm install
   ```
   Commit the SHA bump and lockfile together.

---

## Cautions: runaway `npm`/`node` processes

The conversion to a real `dist/` build (this repo) plus a proper
workspace runner at the consumer (your repo, e.g. `pnpm -r`) is the
**structural fix** for a class of bug that has, in production,
exhausted a developer machine's process budget hard enough to require
a force-restart. This section is about not re-introducing it.

### The incident

A consumer workspace had this `app/package.json` build script:

```json
"build": "cd ../external/agentic-web-toolkit && npm install && cd ../../app && npm install && npm run build && cd ../../external/agentic-web-toolkit && npm run build"
```

When `npm run build` was killed mid-flight (Ctrl-C, OOM, IDE crash),
shells in the chain detached but their child `npm install` and
`node`/`tsc`/`esbuild` processes did not. Each invocation could spawn
50–200 child processes. Stuck shells were reissued. Over a few minutes
the machine accumulated **hundreds of orphan `node` processes**, ran
out of file descriptors, and required a forced restart.

Two enablers had to combine:

1. **Chained shells through `cd && cmd`.** Bash sequences don't form a
   single process tree the parent can signal cleanly. Each `cd && npm`
   spawns a separate subshell whose children outlive a `SIGINT` to the
   top-level shell.
2. **No real `dist/` build.** Because the library shipped raw `.ts`,
   every consumer build retranspiled everything. The work amount per
   invocation was huge — long enough for orphans to pile up before
   anyone noticed.

The conversion in this PR removes enabler #2. You, the consumer, are
responsible for not re-introducing enabler #1.

### Hard rules

1. **Never nest `npm install` (or `pnpm install`) inside a build
   script.** Install happens once, at workspace root, before the build
   starts. If the install needs to run, the human should run it.
   ```jsonc
   // BAD
   "build": "cd ../lib && npm install && npm run build && cd ../app && npm install && next build"

   // GOOD
   "build": "next build"
   ```
2. **No `cd && cmd && cd && cmd` chains for builds.** If you have
   multiple packages, let pnpm orchestrate from one process tree:
   ```json
   "build": "pnpm -r build"
   ```
   That runs as a single supervised process tree; killing the parent
   kills the children.
3. **Don't `&` background long-running build steps from scripts.**
   Detached subprocesses are the same orphan trap by a different name.
4. **No `transpilePackages: ['@agentic-web-toolkit/*']`** in
   `next.config.ts`. The packages now ship pre-built ESM with
   directives intact; re-transpiling them not only strips the
   directives but also adds the per-build work that made the orphan
   pile-up severe.
5. **Run dev servers from the workspace root, in one shell each.** Not
   from inside the submodule. Not chained. If you need both the
   toolkit watch and a Next.js dev server, use two separate terminal
   panes (`pnpm -r --parallel --if-present run dev` in one, your app
   in the other).

### Signs you have a runaway

- `ps -axo pid,ppid,command | awk '$2 == 1 && /node/' | wc -l` returns
  anything above single digits. Orphaned `node` processes adopted by
  PID 1 are the giveaway.
- `lsof | wc -l` climbing without ever falling.
- Builds get progressively slower across consecutive runs in the same
  session.
- VS Code / Cursor / your IDE becomes unresponsive after a Ctrl-C on a
  build script.

### Recovery

When you spot orphans, before they multiply:

```bash
# List orphans owned by you
ps -axo pid,ppid,command | awk '$2 == 1 && /node/'

# Kill everything node-related you own
pkill -9 -u "$USER" -f node
pkill -9 -u "$USER" -f esbuild
pkill -9 -u "$USER" -f tsc
```

If the machine is already past the point of being able to run `pkill`
reliably (descriptor exhaustion), force-restart. There is no graceful
path back from a few hundred orphans.

### Validating the structural fix

After adopting, do this sanity check once:

```bash
pnpm build
# wait until it's clearly mid-build
^C
# immediately:
ps -axo pid,ppid,command | awk '$2 == 1 && /node/'
```

Expected: empty output. `pnpm -r` runs children inside its own
process tree and forwards signals on Ctrl-C. If you see orphans,
something in your consumer's scripts is re-introducing chained shells
— find and remove it.

---

## See also

- [`next-js-consumer.md`](next-js-consumer.md) — integration guide
  (both consumer patterns, layout wiring, Tailwind config).
- [`migrate-consumer.md`](migrate-consumer.md) — 8-step checklist for
  consumers moving off the old `"@agentic-cookbook/agentic-web-toolkit":
  "file:..."` dep.
- [`monorepo-conversion.md`](monorepo-conversion.md) — what changed in
  the toolkit itself and why.
