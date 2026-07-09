"use client";

import { useCallback, useEffect, useState } from "react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { Field, FieldGroup } from "@agentic-toolkit/ui/blocks";
import { bucketAccessApi } from "@agentic-toolkit/data/security";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { DetailSection } from "@agentic-toolkit/resource";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
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

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!groupId) return;
    setLoadError(null);
    try {
      setDetail(await bucketAccessApi.getGroup(groupId));
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "bucket-access", step: "load-group" });
      setLoadError(err instanceof Error ? err.message : "Failed to load access list.");
    }
  }, [groupId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

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
      ) : !groupId ? null : loadError ? (
        <ErrorText error={loadError} />
      ) : detail === null ? (
        <p className="text-sm text-apt-text-muted">Loading…</p>
      ) : (
        <>
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
              onChanged={loadDetail}
            />
          )}

          <GroupGrantsEditor
            groupId={groupId}
            bucketId={bucketId}
            grants={detail.grants}
            bucketTypes={bucketTypes}
            onChanged={loadDetail}
          />
        </>
      )}
    </DetailSection>
  );
}
