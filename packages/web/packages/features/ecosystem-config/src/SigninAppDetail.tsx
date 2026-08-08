"use client";

import { useState } from "react";

import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Switch } from "@agentic-toolkit/ui/components/switch";
import { Plus, Trash2 } from "lucide-react";
import { DetailSection } from "@agentic-toolkit/resource";
import type { SigninApp, SigninAppInput } from "@agentic-toolkit/data/ecosystem-config";

// A NEW leaf is a single lowercase token (no dots — the ecosystem scope is the prefix).
const LEAF_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export function signinAppBlank(): SigninAppInput {
  return { slug: "", name: "", allowedReturnOrigins: [""], githubEnabled: true };
}

export function signinAppToInput(a: SigninApp): SigninAppInput {
  return {
    slug: a.slug,
    name: a.name,
    allowedReturnOrigins: a.allowedReturnOrigins.length ? a.allowedReturnOrigins : [""],
    githubEnabled: a.githubEnabled,
  };
}

/**
 * Canonicalize a return origin to `new URL(o).origin` — lowercased host, default port
 * dropped, no path — MIRRORING what the backend stores (the backend is authoritative for
 * the canonical form). Submitting the exact shape the server persists prevents an
 * "origin saved but sign-in 400s" mismatch. Falls back to the trimmed input when it can't
 * be parsed (signinAppValidate rejects those before a save ever reaches here).
 */
export function canonicalizeReturnOrigin(raw: string): string {
  const trimmed = raw.trim();
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

/** Returns an error message, or null when valid. A SAVED app's slug (contains a dot) is fixed;
 *  only a NEW leaf (no dot) is validated for shape + uniqueness. */
export function signinAppValidate(draft: SigninAppInput, takenLeaves: string[]): string | null {
  if (!draft.name.trim()) return "Name is required.";
  const saved = draft.slug.includes(".");
  if (!saved) {
    const leaf = draft.slug.trim().toLowerCase();
    if (!leaf) return "App id is required.";
    if (!LEAF_RE.test(leaf)) return "App id must be a lowercase token, e.g. my-app.";
    if (takenLeaves.includes(leaf)) return `App id "${leaf}" is already in use.`;
  }
  for (const o of draft.allowedReturnOrigins.map((x) => x.trim()).filter(Boolean)) {
    let url: URL;
    try {
      url = new URL(o);
    } catch {
      return `Return origin "${o}" is not a valid URL.`;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:")
      return `Return origin "${o}" must be http(s).`;
    if (url.username || url.password)
      return `Return origin "${o}" must not include credentials.`;
    if (url.pathname !== "/" || url.search || url.hash)
      return `Return origin "${o}" must be just a scheme + host (no path).`;
  }
  return null;
}

/**
 * The allowed-return-origins editor. The origins live in the SigninAppInput as a plain
 * `string[]`, but a column of text inputs needs a STABLE key per row so removing a middle
 * row doesn't churn the focus/caret of the rows below (array-index keys would). So this
 * editor holds an id-annotated mirror as its own source of truth and projects back to
 * `string[]` on every edit. It is remounted (via a `key` on the persisted origins in the
 * parent) whenever the server re-hydrates a different canonical set — the React-blessed way
 * to reset derived state — so nothing is synced from props during render.
 */
type OriginRow = { id: number; value: string };

function OriginsEditor({
  origins,
  onChange,
}: {
  /** Current origins; also the initial row values (read only at mount — see the parent `key`). */
  origins: string[];
  onChange: (next: string[]) => void;
}) {
  const [rows, setRows] = useState<OriginRow[]>(() =>
    origins.map((value, i) => ({ id: i, value })),
  );
  const emit = (next: OriginRow[]) => {
    setRows(next);
    onChange(next.map((r) => r.value));
  };
  const setOrigin = (id: number, value: string) =>
    emit(rows.map((r) => (r.id === id ? { ...r, value } : r)));
  // New ids are max(existing)+1 so they never collide with a surviving row.
  const addOrigin = () =>
    emit([...rows, { id: rows.reduce((m, r) => Math.max(m, r.id), -1) + 1, value: "" }]);
  const removeOrigin = (id: number) => emit(rows.filter((r) => r.id !== id));

  return (
    <div className="flex flex-col gap-2">
      <Label>Allowed return origins</Label>
      <p className="text-xs text-apt-text-muted">
        The origins your app may finish sign-in on, e.g. <code>https://myapp.com</code>.
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <Input
              value={row.value}
              placeholder="https://myapp.com"
              onChange={(e) => setOrigin(row.id, e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeOrigin(row.id)}
              title="Remove origin"
            >
              <Trash2 className="text-apt-red" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addOrigin}>
          <Plus data-icon="inline-start" />
          Add origin
        </Button>
      </div>
    </div>
  );
}

/**
 * Controlled sign-in-app form: name, client id (leaf-only while creating; read-only + copyable
 * once saved), a GitHub sign-in toggle, and the allowed return origins. Save/Cancel/Delete live
 * in the pane's button bar. No secret is shown — the sign-in rail is a public client.
 */
export function SigninAppDetail({
  title,
  draft,
  onChange,
  error,
  app,
  ecoSlug,
  authApiHint,
}: {
  title: string;
  draft: SigninAppInput;
  onChange: (next: SigninAppInput) => void;
  error?: string | null;
  /** The saved app when editing an existing one (null while creating). */
  app: SigninApp | null;
  /** Ecosystem slug, to preview the composed client id while creating (empty ⇒ free leaf field). */
  ecoSlug: string;
  /** Placeholder auth host for the copy-paste start-URL snippet. */
  authApiHint: string;
}) {
  const startUrl =
    `${authApiHint}/oauth/signin/start` +
    `?clientId=${encodeURIComponent(app?.slug ?? "")}&providerId=github` +
    `&return=<your-app-origin>/auth/callback`;

  return (
    <>
      <DetailSection title={title}>
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="signin-app-name">Name</Label>
              <Input
                id="signin-app-name"
                value={draft.name}
                placeholder="My app"
                onChange={(e) => onChange({ ...draft, name: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="signin-app-id">Client id</Label>
              {app ? (
                <div className="flex items-center gap-2">
                  <Input
                    id="signin-app-id"
                    readOnly
                    value={app.slug}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void navigator.clipboard?.writeText(app.slug)}
                  >
                    Copy
                  </Button>
                </div>
              ) : (
                // Creating: an editable leaf field, prefixed by the ecosystem slug when known.
                <div className="flex items-center gap-1">
                  {ecoSlug && (
                    <code className="shrink-0 text-sm text-apt-text-muted">{ecoSlug}.</code>
                  )}
                  <Input
                    id="signin-app-id"
                    value={draft.slug}
                    placeholder="my-app"
                    onChange={(e) =>
                      onChange({ ...draft, slug: e.target.value.toLowerCase().replace(/\./g, "") })
                    }
                  />
                </div>
              )}
              <p className="text-xs text-apt-text-muted">
                The client id your app sends as <code>clientId</code>. The ecosystem prefix is fixed;
                only the final name is yours to pick.
              </p>
            </div>

            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <Label htmlFor="signin-app-github" className="text-sm font-medium text-apt-text">
                  GitHub sign-in
                </Label>
                <p className="mt-0.5 text-xs text-apt-text-muted">
                  Let customers sign in with GitHub, brokered through ADH.
                </p>
              </div>
              <Switch
                id="signin-app-github"
                checked={draft.githubEnabled}
                onCheckedChange={(githubEnabled) => onChange({ ...draft, githubEnabled })}
              />
            </div>

            <OriginsEditor
              key={app ? JSON.stringify(app.allowedReturnOrigins) : "new"}
              origins={draft.allowedReturnOrigins}
              onChange={(allowedReturnOrigins) => onChange({ ...draft, allowedReturnOrigins })}
            />

            {error && <p className="text-sm text-apt-red">{error}</p>}
          </CardContent>
        </Card>
      </DetailSection>

      {app && (
        <DetailSection title="Connect your app">
          <Card>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-apt-text-muted">
                Point your app&apos;s “Sign in with GitHub” button at:
              </p>
              <Input readOnly value={startUrl} onFocus={(e) => e.currentTarget.select()} />
              <p className="text-xs text-apt-text-muted">
                Set <code>NEXT_PUBLIC_OAUTH_CLIENT_ID={app.slug}</code> in your app, and swap{" "}
                <code>&lt;your-adh-auth-host&gt;</code> / <code>&lt;your-app-origin&gt;</code> for
                real values.
              </p>
            </CardContent>
          </Card>
        </DetailSection>
      )}
    </>
  );
}
