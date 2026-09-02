/**
 * `shipr-config-export.json` — the file a workstation and this console both speak.
 *
 * A fleet's setup lives in two places on the machine that runs `shipr`, and NEITHER is in a
 * git repository: the LAYOUT is a directory tree somebody built by hand, and the CONFIG is
 * one `config.json` per repository under `~/.shipr/deployment/`, keyed by a slug and filed
 * nowhere near the checkout it describes. `shipr export` writes the two of them out together
 * as one file; `shipr import` reads it back. This module is the other end of that file:
 * {@link parseDocument} reads one the CLI wrote, {@link buildDocument} writes one it can
 * read.
 *
 * NO DOM AND NO REACT HERE, deliberately. Everything below is a function from data to data,
 * so the shape can be pinned by a test that renders nothing — which matters more than usual
 * for a format whose OTHER implementation is a Python file in a different repository, and
 * whose failure mode is a file that parses and means the wrong thing.
 *
 * THE SECOND IMPLEMENTATION IS THE POINT, AND ITS COST IS REAL. `tools/shipr/exchange.py` is
 * the format's author; this file follows it. That is a `dry` violation the two-runtime split
 * makes unavoidable — there is no shared artefact a Python CLI and a browser bundle can both
 * read at build time — so the mitigation is that every field name below is written where a
 * reader can see it beside the CLI's own, and `SCHEMA_VERSION` is checked rather than
 * assumed: a file from a newer shipr is REFUSED by name, not half-read.
 */

/** `exchange.SCHEMA`. A JSON object with plausible keys and no name is a file every reader
 *  has to guess at; this one answers "what am I" in its first field. */
export const SCHEMA = 'shipr-config-export';

/** `exchange.SCHEMA_VERSION`. Bumped only by a change the other side cannot read. */
export const SCHEMA_VERSION = 1;

/**
 * `gitrepo.CONFIG_VERSION` — the version of the PER-REPOSITORY config inside the document,
 * which is a different number from the schema around it and moves for different reasons.
 *
 * Stamped on every config this console writes into a document, because `shipr import` writes
 * what it is given straight into `~/.shipr/deployment/<site>/config.json`, and a config with
 * no version there is one a later shipr has to guess the age of.
 */
export const CONFIG_VERSION = 4;

/** What this console puts in `exported_by`. `shipr export` writes `shipr_version` instead —
 *  it IS a shipr build and can name itself; this is not, and inventing a version number for
 *  a field that answers "which build wrote this" would be the one lie in the file. */
export const EXPORTED_BY = 'shipr console';

export const DEFAULT_FILENAME = 'shipr-config-export.json';

/** One end of a project: `owner/name`, and the URL to fetch it from when the file knows one.
 *  `url` is optional on both ends — `shipr doctor` falls back to the slug on github.com, and
 *  a console that only ever saw a slug must not invent the rest. */
export interface ExportedRemote {
  slug?: string;
  url?: string;
}

/**
 * The host-local config, as the CLI stores it — snake_case, because these keys are written
 * verbatim into a file Python reads.
 *
 * The index signature is not laziness: a config carries whatever the shipr that wrote it put
 * there, and this console models a subset. Keys it does not know TRAVEL THROUGH a parse
 * unchanged so that reading a file and writing it back does not quietly drop them.
 */
export interface ExportedConfig {
  version?: number;
  main_branch?: string;
  prepared_branch?: string;
  ship_branch?: string;
  /** environment → the branch it deploys from. Absent environments are ones this repository
   *  does not deploy to, which is a different fact from an empty branch name. */
  environments?: Record<string, string>;
  ci?: { context?: string };
  [key: string]: unknown;
}

/** One project: a development repository, the deployment repository it ships through, and
 *  where the checkout of that deployment repository goes. */
export interface ExportedProject {
  /** The deployment directory with `-deployment` stripped — `projects.display_name`. */
  name: string;
  /** THE DIRECTORY `git clone` MAKES, which is the deployment repository's own name. It is
   *  the one required field: `shipr import` refuses an entry without it, because there is
   *  then nowhere to put the project. */
  directory: string;
  /** The folder it is filed under — ONE level, because that is the layout the CLI walks:
   *  a checkout directly below the root, or one inside a group directory. `null` is
   *  ungrouped, which is not the same as a group called "". */
  group: string | null;
  remotes: { dev: ExportedRemote; deployment: ExportedRemote };
  config: ExportedConfig;
}

export interface ShiprDocument {
  schema: typeof SCHEMA;
  schema_version: number;
  /** The shipr build that wrote it. Absent on a document this console wrote — see
   *  {@link EXPORTED_BY}. */
  shipr_version?: string;
  /** What wrote it, when that was not a shipr build. */
  exported_by?: string;
  exported_at?: string;
  /** `~`-shortened directory the export walked. Informational, and absent here: this console
   *  has no directory, and `shipr import` lays the fleet out under the directory it is RUN
   *  in rather than the one named in the file. */
  root?: string;
  /** The group names present, in the order they first appear. */
  groups: string[];
  projects: ExportedProject[];
}

/** `owner/name` → `name`. The half of a slug that is a directory when it is cloned. */
export function repoName(slug: string): string {
  const at = slug.indexOf('/');
  return at === -1 ? slug : slug.slice(at + 1);
}

/** `owner/name` → `owner`. */
export function repoOwner(slug: string): string {
  const at = slug.indexOf('/');
  return at === -1 ? '' : slug.slice(0, at);
}

/** `const.DEPLOYMENT_SUFFIX`, and `projects.display_name`'s rule for taking it back off: a
 *  directory called exactly `-deployment` keeps its name, because the alternative is a
 *  project with none. */
const DEPLOYMENT_SUFFIX = '-deployment';

export function displayName(directory: string): string {
  return directory.endsWith(DEPLOYMENT_SUFFIX) && directory !== DEPLOYMENT_SUFFIX
    ? directory.slice(0, -DEPLOYMENT_SUFFIX.length)
    : directory;
}

// ── writing one ───────────────────────────────────────────────────────────────

/** What this console knows about one mirror, in the vocabulary the wire uses. Narrower than
 *  `RepoItem` so the builder can be called with a literal in a test, and so this file does
 *  not import the whole tree's types to read six fields off them. */
export interface ExportableRepo {
  /** The deployment repository — `owner/name`. */
  slug: string;
  shipBranch: string;
  ciContext: string;
  /** Values are optional because the wire's own type is a `Partial` — an environment this
   *  repository does not deploy to is an absent key, and a key whose value is `undefined`
   *  must reach the file as neither. */
  envBranches: Readonly<Record<string, string | undefined>>;
  groupId: string | null;
  devRepo: { slug: string; mainBranch: string; preparedBranch: string } | null;
}

export interface ExportableGroup {
  id: string;
  name: string;
}

export interface BuildOptions {
  groups: readonly ExportableGroup[];
  items: readonly ExportableRepo[];
  /** Overridable so a test can pin the whole document, including the field that is otherwise
   *  different on every run. */
  exportedAt?: string;
}

/**
 * The document, from what the tree already holds.
 *
 * NO REQUEST IS MADE. Everything in the file is in the tree the console has drawn — which is
 * also what makes the export honest about its own freshness: it is exactly the fleet on the
 * screen, not a second read that could disagree with it.
 *
 * ONE ENTRY PER DEPLOYMENT REPOSITORY, not per source. A monorepo of separately-deployed
 * directories is several mirrors behind one `.shipr`, and on a workstation it is several
 * checkouts — one directory each, each with its own config. Collapsing them to one entry
 * would export a fleet that cannot be laid out.
 *
 * A MIRROR WITH NO SOURCE ROW IS SKIPPED. `devRepo` is nullable on the wire (a caller may
 * reach a mirror without reaching what it was cut from), and a project whose development
 * remote is unknown is one `shipr import` could restore the config of but nothing could
 * ever re-register. Exporting it would put a hole in the file rather than in the console.
 */
export function buildDocument({ groups, items, exportedAt }: BuildOptions): ShiprDocument {
  const nameOfGroup = new Map(groups.map((g) => [g.id, g.name]));
  const projects: ExportedProject[] = [];
  const present: string[] = [];
  for (const item of items) {
    if (!item.devRepo) continue;
    const directory = repoName(item.slug);
    const group = item.groupId ? (nameOfGroup.get(item.groupId) ?? null) : null;
    if (group !== null && !present.includes(group)) present.push(group);
    projects.push({
      name: displayName(directory),
      directory,
      group,
      // Slugs only. `register` records a URL for the development repository because it had
      // one to hand — the argument it was given — and `doctor` falls back to the slug on
      // github.com when there is none. A URL built here would be that same fallback, written
      // down as though it had been observed.
      remotes: { dev: { slug: item.devRepo.slug }, deployment: { slug: item.slug } },
      config: {
        version: CONFIG_VERSION,
        main_branch: item.devRepo.mainBranch,
        prepared_branch: item.devRepo.preparedBranch,
        ship_branch: item.shipBranch,
        environments: environmentsOf(item.envBranches),
        ci: { context: item.ciContext },
      },
    });
  }
  return {
    schema: SCHEMA,
    schema_version: SCHEMA_VERSION,
    exported_by: EXPORTED_BY,
    exported_at: exportedAt ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    groups: present,
    projects,
  };
}

/** The environments that are actually set. An empty object is a repository that deploys
 *  nowhere, which is a fact worth writing down; a key mapped to `undefined` is not. */
function environmentsOf(
  envBranches: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [env, branch] of Object.entries(envBranches)) if (branch) out[env] = branch;
  return out;
}

/** The document as the bytes that go in the file — trailing newline included, because
 *  `shipr export` writes one and a diff of the two files should be empty where the fleets
 *  agree. */
export function serializeDocument(document: ShiprDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

// ── reading one ───────────────────────────────────────────────────────────────

/** A file this console will not read, with the reason in a sentence — the CLI's own refusals,
 *  in the CLI's own words, because an operator who sees one of these here will see the other
 *  one there. */
export class DocumentError extends Error {}

/**
 * One `shipr-config-export.json`, or a refusal naming which of the four things went wrong.
 *
 * REFUSES A NEWER SCHEMA RATHER THAN READING WHAT IT RECOGNIZES. Half-reading a file whose
 * later version added a field is how a fleet ends up imported with one repository's
 * environments missing and nothing to say so — and this import writes to a forge.
 */
export function parseDocument(text: string): ShiprDocument {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new DocumentError(`That file is not JSON (${(e as Error).message}).`);
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new DocumentError(`That file is not a ${SCHEMA} file — it is not an object.`);
  }
  const doc = data as Record<string, unknown>;
  if (doc.schema !== SCHEMA) {
    throw new DocumentError(
      `That file is not a ${SCHEMA} file — its \`schema\` field says ${JSON.stringify(
        doc.schema ?? null,
      )}.`,
    );
  }
  const version = doc.schema_version;
  if (version !== SCHEMA_VERSION) {
    throw new DocumentError(
      `That file is schema version ${JSON.stringify(version ?? null)} and this console reads ` +
        `${SCHEMA_VERSION}${
          typeof version === 'number' && version > SCHEMA_VERSION
            ? ' — it was written by a newer shipr than this console knows about.'
            : '.'
        }`,
    );
  }
  if (!Array.isArray(doc.projects)) {
    throw new DocumentError('That file has no `projects` list.');
  }
  const projects = doc.projects.map((raw, i) => project(raw, i));
  return {
    schema: SCHEMA,
    schema_version: SCHEMA_VERSION,
    ...(typeof doc.shipr_version === 'string' ? { shipr_version: doc.shipr_version } : {}),
    ...(typeof doc.exported_by === 'string' ? { exported_by: doc.exported_by } : {}),
    ...(typeof doc.exported_at === 'string' ? { exported_at: doc.exported_at } : {}),
    ...(typeof doc.root === 'string' ? { root: doc.root } : {}),
    groups: Array.isArray(doc.groups) ? doc.groups.filter((g): g is string => typeof g === 'string') : [],
    projects,
  };
}

/** One entry, checked for the one field that has no default. Everything else is allowed to be
 *  missing: a config from an older shipr names fewer branches, and the import's job is to
 *  carry what the file says rather than to fill it in. */
function project(raw: unknown, index: number): ExportedProject {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new DocumentError(`Project ${index + 1} in that file is not an object.`);
  }
  const entry = raw as Record<string, unknown>;
  const directory = typeof entry.directory === 'string' ? entry.directory : '';
  if (!directory) {
    throw new DocumentError(
      `Project ${index + 1} in that file has no \`directory\`, so there is nothing to name it by.`,
    );
  }
  const remotes = (entry.remotes ?? {}) as Record<string, unknown>;
  return {
    name: typeof entry.name === 'string' && entry.name ? entry.name : displayName(directory),
    directory,
    group: typeof entry.group === 'string' && entry.group ? entry.group : null,
    remotes: { dev: remote(remotes.dev), deployment: remote(remotes.deployment) },
    config:
      typeof entry.config === 'object' && entry.config !== null && !Array.isArray(entry.config)
        ? (entry.config as ExportedConfig)
        : {},
  };
}

function remote(raw: unknown): ExportedRemote {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  return {
    ...(typeof value.slug === 'string' ? { slug: value.slug } : {}),
    ...(typeof value.url === 'string' ? { url: value.url } : {}),
  };
}

/** Which shipr wrote it, in one phrase, for the line that says so above the plan. Two fields
 *  answer it — a shipr build names its version, this console names itself — and a file that
 *  carries neither is still a file, so there is a third answer rather than a blank. */
export function writtenBy(document: ShiprDocument): string {
  if (document.shipr_version) return `shipr ${document.shipr_version}`;
  return document.exported_by || 'an unnamed tool';
}
