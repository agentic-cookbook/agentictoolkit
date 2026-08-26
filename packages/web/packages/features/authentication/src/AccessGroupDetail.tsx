"use client";

import { useCallback } from "react";

import { Field, FieldGroup } from "@agenticdevelopertoolkit/ui/blocks";
import { bucketAccessApi } from "@agentic-toolkit/data/security";
import { Card, CardContent } from "@agenticdevelopertoolkit/ui/components/card";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { Textarea } from "@agenticdevelopertoolkit/ui/components/textarea";
import { DetailSection, useResourceItem } from "@agentic-toolkit/resource";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { GroupGrantsEditor } from "./GroupGrantsEditor";
import { GroupMembersEditor } from "./GroupMembersEditor";
import {
  isEveryone,
  type AccessGroupDetail as GroupDetail,
  type AccessGroupInput,
  type AccessItem,
  type BucketRef,
  type Principal,
} from "./access-model";

/**
 * Controlled access-list detail. The bucket/name/description are a draft saved by
 * the pane's button bar; members and grants are immediate-save sub-sections shown
 * once the list is saved (mirrors how ApplicationDetail hosts AccessTokensSection
 * inside a draft detail). Mount with `key={detailKey}` so it resets per list.
 */
export function AccessGroupDetail({
  title,
  draft,
  onChange,
  error,
  creating,
  group,
  buckets,
  principals,
}: {
  title: string;
  draft: AccessGroupInput;
  onChange: (next: AccessGroupInput) => void;
  error?: string | null;
  creating: boolean;
  /** The selected list (null while creating). */
  group: AccessItem | null;
  buckets: BucketRef[];
  principals: { users: Principal[]; apps: Principal[] };
}) {
  const everyone = group ? isEveryone(group.group) : false;
  const groupId = group?.group.id ?? null;
  const bucketId = group?.group.bucketId ?? draft.bucketId;
  const bucketTypes = buckets.find((b) => b.id === bucketId)?.types ?? [];

  // The members + grants, cached per group. Coming back to a list already visited paints them
  // with no read at all, and the re-read settles behind that paint. NO `seedFrom`: the rail row
  // this detail opens from carries neither array, so seeding from it would render "No members
  // yet." about a list that may well have members. The cache IS the seed here, on the second
  // visit onward.
  //
  // `useResourceItem` (not the bare query) because a 404 here means the access list was DELETED
  // out from under the user — the host owns the alert that says so and the pop that follows.
  const {
    item: detail,
    isSettled,
    error: loadError,
    reload,
  } = useResourceItem<GroupDetail>("bucket:access-groups", groupId, bucketAccessApi.getGroup);

  // The re-read after a member/grant change, deliberately swallowing: the WRITE succeeded, and
  // the editors report whatever `onChanged` throws as a failed save. A failed re-read belongs in
  // this detail's own banner, which `loadError` already carries.
  const reloadDetail = useCallback(() => reload().catch(() => {}), [reload]);

  return (
    <DetailSection title={title}>
      <Card>
        <CardContent className="flex flex-col gap-5">
          <Field label="Bucket" hint={creating ? "The bucket this access list controls." : undefined}>
            <Select
              value={draft.bucketId}
              disabled={!creating}
              onChange={(e) => onChange({ ...draft, bucketId: e.target.value })}
            >
              {creating && <option value="">Select a bucket…</option>}
              {buckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Name"
            hint={
              everyone
                ? "The built-in “everyone” list applies to every principal and can’t be renamed."
                : "Unique within the bucket."
            }
          >
            <Input
              value={draft.name}
              disabled={everyone}
              placeholder="Editors"
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
            />
          </Field>

          <Field label="Description">
            <Textarea
              rows={2}
              value={draft.description}
              disabled={everyone}
              placeholder="What this access list is for."
              onChange={(e) => onChange({ ...draft, description: e.target.value })}
            />
          </Field>

          {/* Form-level error (bucket OR name) — not bound to a single field. */}
          <ErrorText error={error} />
        </CardContent>
      </Card>

      {creating ? (
        <p className="text-xs text-apt-text-muted">
          Save this access list, then add its members and grants.
        </p>
      ) : !groupId ? null : detail === null ? (
        loadError ? (
          <ErrorText error={loadError} />
        ) : (
          <p className="text-sm text-apt-text-muted">Loading…</p>
        )
      ) : (
        <>
          {/* A failed RE-read over a cached copy: the banner says so and the copy stays, rather
              than the content vanishing because the revalidation behind it failed. */}
          <ErrorText error={loadError} />
          {everyone ? (
            <FieldGroup title="Members">
              <p className="text-sm text-apt-text-muted">
                Applies to everyone — every principal in this ecosystem. Choose what they can do
                with grants below.
              </p>
            </FieldGroup>
          ) : (
            <GroupMembersEditor
              groupId={groupId}
              members={detail.members}
              principals={principals}
              onChanged={reloadDetail}
              // Read-only until the server's answer for THIS group is on screen. What is painted
              // before then is the previous visit's copy, and a remove aimed at it could target a
              // member the server no longer has.
              readOnly={!isSettled}
            />
          )}

          <GroupGrantsEditor
            groupId={groupId}
            bucketId={bucketId}
            grants={detail.grants}
            bucketTypes={bucketTypes}
            onChanged={reloadDetail}
            readOnly={!isSettled}
          />
        </>
      )}
    </DetailSection>
  );
}
