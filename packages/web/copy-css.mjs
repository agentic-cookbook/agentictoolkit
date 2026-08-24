#!/usr/bin/env node
// Mirror <src>/**/*.css → <dest>/**/*.css preserving directory structure.
// Run from a package root. Defaults are src → dist; pass --src/--dest for a package whose
// stylesheets are published under a different name than they are authored under (persona
// authors src/styles/** and publishes dist/css/**).
//
// It MIRRORS rather than copies: a .css file under <dest> with no counterpart under <src> is
// deleted. That is what lets every tsup.config.ts negate CSS out of its `clean` — the clean used
// to be the only thing pruning dist, and it pruned by deleting every stylesheet at the START of
// a build and leaving the package unresolvable until this script ran at the END of it. Mirroring
// here means the pruning happens in the one step that knows which files are still real, with no
// window in which the package's `./css/*` exports point at nothing.
import { mkdir, copyFile, readdir, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const SRC = flag("src", "src");
const DEST = flag("dest", "dist");

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return out;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      out.push(full);
    }
  }
  return out;
}

const files = await walk(SRC);
if (files.length === 0) {
  process.exit(0);
}

const wanted = new Set();
let copied = 0;
for (const file of files) {
  const rel = relative(SRC, file);
  const target = join(DEST, rel);
  wanted.add(target);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(file, target);
  copied++;
}

// Orphans: a stylesheet this package used to publish and no longer authors. Left behind, it
// keeps resolving, so a consumer's stale `@import` of a deleted file goes on working here and
// breaks in a fresh checkout.
let pruned = 0;
for (const existing of await walk(DEST)) {
  if (wanted.has(existing)) continue;
  await rm(existing);
  pruned++;
}

const prunedNote = pruned === 0 ? "" : `, ${pruned} orphan${pruned === 1 ? "" : "s"} pruned`;
console.log(`copy-css: ${copied} file${copied === 1 ? "" : "s"} → ${DEST}/${prunedNote}`);
