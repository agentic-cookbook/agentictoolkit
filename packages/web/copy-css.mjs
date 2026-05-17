#!/usr/bin/env node
// Mirror src/**/*.css → dist/**/*.css preserving directory structure.
// Run from a package root (cwd has src/ and dist/).
import { mkdir, copyFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const SRC = "src";
const DEST = "dist";

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

let copied = 0;
for (const file of files) {
  const rel = relative(SRC, file);
  const target = join(DEST, rel);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(file, target);
  copied++;
}

console.log(`copy-css: ${copied} file${copied === 1 ? "" : "s"} → ${DEST}/`);
