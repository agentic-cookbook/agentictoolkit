// Its own entry, not a re-export from `profile.ts`, and that is a build constraint rather
// than taste: `esbuild-plugin-preserve-directives` propagates a chunk's `'use client'` to
// every entry that imports it, so folding this component into the server-safe profile barrel
// would turn `RegistryProfile` itself into a Client Component for every consumer — legal, so
// nothing would fail, and the entry pages would stop server-rendering the markup they exist
// to put in front of a crawler. See the toolkit's own notes on the landing extraction.
export { EntryProfileView, type EntryProfileViewProps } from './EntryProfileView';
