"use client";

import type { SiteGroupView, SiteView } from "@agentic-toolkit/data/monitored-sites";
import { validateSlug } from "@agentic-toolkit/ui/lib/slug";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Select } from "@agentic-toolkit/ui/components/select";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { DetailSection } from "@agentic-toolkit/resource";
import { EndpointsEditor } from "./EndpointsEditor";

export interface SiteDraft {
  name: string;
  slug: string;
  /** The single group this site belongs to (required). */
  groupId: string;
}

export function siteBlank(): SiteDraft {
  return { name: "", slug: "", groupId: "" };
}

export function siteToInput(s: SiteView): SiteDraft {
  return { name: s.name, slug: s.slug, groupId: s.groupId };
}

/** Returns an error message, or null when the draft is valid. */
export function siteValidate(draft: SiteDraft, takenSlugs: string[]): string | null {
  if (!draft.name.trim()) return "Site name is required.";
  const slug = draft.slug.trim();
  const slugError = validateSlug(slug);
  if (slugError) return slugError;
  if (takenSlugs.includes(slug)) return `Slug "${slug}" is already in use.`;
  if (!draft.groupId) return "Select a group for this site.";
  return null;
}

/**
 * The site FIELDS (name, slug, group) — no button bar, no endpoints. Shared by the inline editor
 * ({@link SiteDetail}) and the "New site" popup (CreateResourceDialog), so both surfaces validate
 * and present the group requirement identically. When no groups exist, the group field guides the
 * user to create one first (and `siteValidate` blocks Save with a visible reason, not a silent
 * disable).
 */
export function SiteFields({
  draft,
  onChange,
  groups,
  error,
}: {
  draft: SiteDraft;
  onChange: (next: SiteDraft) => void;
  groups: SiteGroupView[];
  error?: string | null;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="site-name">Name</Label>
          <Input
            id="site-name"
            placeholder="Marketing Site"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="site-slug">Slug</Label>
          <Input
            id="site-slug"
            placeholder="marketing-site"
            value={draft.slug}
            onChange={(e) => onChange({ ...draft, slug: e.target.value.toLowerCase() })}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="site-group">Group</Label>
          {groups.length === 0 ? (
            <p className="text-xs text-apt-text-muted">
              No groups defined yet. Add a group first, then assign this site.
            </p>
          ) : (
            <Select
              id="site-group"
              value={draft.groupId}
              onChange={(e) => onChange({ ...draft, groupId: e.target.value })}
            >
              <option value="">Select a group…</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        {error && <p className="text-sm text-apt-red">{error}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Controlled site editor for an EXISTING site — the fields ({@link SiteFields}) plus the endpoints
 * sub-section (its own CRUD, not part of the site save). Save/Cancel/Delete live in the
 * MasterDetailLayout button bar. New sites are created through the "New site" popup instead.
 */
export function SiteDetail({
  title,
  draft,
  onChange,
  groups,
  siteId,
  error,
}: {
  title: string;
  draft: SiteDraft;
  onChange: (next: SiteDraft) => void;
  groups: SiteGroupView[];
  /** Persisted site id, or null when creating (endpoints unavailable until saved). */
  siteId: string | null;
  error?: string | null;
}) {
  return (
    <>
      <DetailSection title={title}>
        <SiteFields draft={draft} onChange={onChange} groups={groups} error={error} />
      </DetailSection>

      <DetailSection title="Endpoints">
        {siteId ? (
          <EndpointsEditor siteId={siteId} />
        ) : (
          <EmptyState className="min-h-0 px-4 py-6" title="Save the site first, then add endpoints to probe." />
        )}
      </DetailSection>
    </>
  );
}
