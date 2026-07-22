import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

// Timestamps are stored as INTEGER unix-seconds (`integer({ mode: "timestamp" })`),
// so Drizzle-typed reads/writes still see JS `Date`s while raw SQL does plain
// integer math (`unixepoch()`, `checked_at / 3600 * 3600`, …). UUID primary keys
// are app-generated (`randomUUID()`) since SQLite has no uuid/gen function.
const now = sql`(unixepoch())`;
const uuid = () => randomUUID();

// Deploy-platform integrations (config, not hardcoded). A connection to a
// Vercel team / Railway account / Cloudflare account that the fetchers poll and
// Phase 1 enumerates projects from — so the status site holds the connection,
// never a hand-listed set of projects. `config` is platform-specific NON-secret
// connection info (e.g. { teamId } / { accountId }). The API TOKEN is a secret:
// read from env for now (`tokenEnvVar`); `secretRef` is reserved for moving it
// into the backend's encrypted secret store once auth exists. Never store the
// token value here while the CRUD API is unauthenticated.
export const deployIntegrations = sqliteTable(
  "deploy_integrations",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    platform: text("platform").notNull(), // vercel | railway | cloudflare
    label: text("label").notNull(),
    config: text("config", { mode: "json" }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
    tokenEnvVar: text("token_env_var"), // interim: which env var holds the token
    secretRef: text("secret_ref"), // later: reference into the backend secret store
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [uniqueIndex("uniq_integration_platform_label").on(t.platform, t.label)],
);

// Per-project metadata captured from the platform's projects API (Vercel today) —
// the config info shown in the project browser: configured domain, git repo +
// production branch, the deployment Root Directory, framework. Refreshed by the
// sync; keyed by (platform, project_name). Not the correlation key (that's the
// endpoint's explicit platform+project) — purely descriptive.
export const deployProjectMeta = sqliteTable(
  "deploy_project_meta",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    platform: text("platform").notNull(),
    projectName: text("project_name").notNull(),
    domain: text("domain"),                 // configured custom domain
    gitRepo: text("git_repo"),              // "owner/repo"
    gitBranch: text("git_branch"),          // production branch
    rootDirectory: text("root_directory"),  // deployment Root Directory
    framework: text("framework"),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [uniqueIndex("uniq_project_meta").on(t.platform, t.projectName)],
);

// Deploy projects the operator has explicitly chosen NOT to monitor. A seen
// project that is neither wired to an endpoint nor listed here counts as
// "unconfigured" and raises the configure warning; ignoring one silences it
// without wiring it. Keyed by (platform, project_name) using the CANONICAL
// platform (platformCanon: cloudflare-pages → cloudflare) so this key space
// matches the `wired` check in app/api/deploy-projects.
export const ignoredDeployProjects = sqliteTable(
  "ignored_deploy_projects",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    platform: text("platform").notNull(),
    projectName: text("project_name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [uniqueIndex("uniq_ignored_project").on(t.platform, t.projectName)],
);

export type DeployIntegrationRow = typeof deployIntegrations.$inferSelect;
export type DeployProjectMetaRow = typeof deployProjectMeta.$inferSelect;
export type IgnoredDeployProjectRow = typeof ignoredDeployProjects.$inferSelect;
