"use client";

import type { SiteGroupView } from "@agentic-toolkit/data/monitored-sites";
import { validateSlug } from "@agentic-toolkit/ui/lib/slug";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { DetailSection } from "@agentic-toolkit/resource";

export interface GroupDraft {
  name: string;
  slug: string;
  retentionDays: string;
}

export function groupBlank(): GroupDraft {
  return { name: "", slug: "", retentionDays: "30" };
}

export function groupToInput(g: SiteGroupView): GroupDraft {
  return { name: g.name, slug: g.slug, retentionDays: String(g.retentionDays) };
}

/** Returns an error message, or null when the draft is valid. */
export function groupValidate(draft: GroupDraft, takenSlugs: string[]): string | null {
  if (!draft.name.trim()) return "Group name is required.";
  const slug = draft.slug.trim();
  const slugError = validateSlug(slug);
  if (slugError) return slugError;
  if (takenSlugs.includes(slug)) return `Slug "${slug}" is already in use.`;
  const days = parseInt(draft.retentionDays, 10);
  if (!Number.isFinite(days) || days <= 0) return "Retention must be a positive number of days.";
  return null;
}

/**
 * Controlled group form — fields only. Save/Cancel/Delete live in the MasterDetailLayout button bar
 * (inline editor); the section owns the draft + dirty/validity state. With a `title` it wraps in a
 * DetailSection (inline editor); WITHOUT one it renders just the Card, for the "New group" popup
 * (which supplies its own heading) — mirroring EcosystemDetail.
 */
export function GroupDetail({
  title,
  draft,
  onChange,
  error,
}: {
  title?: string;
  draft: GroupDraft;
  onChange: (next: GroupDraft) => void;
  error?: string | null;
}) {
  function set<K extends keyof GroupDraft>(key: K, value: string) {
    onChange({ ...draft, [key]: value });
  }

  const card = (
    <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="grp-name">Name</Label>
            <Input
              id="grp-name"
              placeholder="Core APIs"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="grp-slug">Slug</Label>
            <Input
              id="grp-slug"
              placeholder="core-apis"
              value={draft.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase())}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="grp-retention">Retention (days)</Label>
            <Input
              id="grp-retention"
              type="number"
              min={1}
              value={draft.retentionDays}
              onChange={(e) => set("retentionDays", e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-apt-red">{error}</p>}
        </CardContent>
      </Card>
  );

  return title ? <DetailSection title={title}>{card}</DetailSection> : card;
}
