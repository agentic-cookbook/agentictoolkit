"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { Field, FieldGroup } from "@agentic-toolkit/ui/blocks";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import { PermissionToggles } from "@agentic-toolkit/ui/components/permission-toggles";
import type { Crud } from "@agentic-toolkit/ui/components/crud";
import { bucketAccessApi } from "@agentic-toolkit/data/security";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Select } from "@agentic-toolkit/ui/components/select";
import {
  formatCrud,
  GRANT_TARGET_LABEL,
  parseCrud,
  type AccessGrant,
  type GrantTargetType,
} from "./access-model";

/** Default CRUD for a freshly added grant: read-only. */
const NEW_GRANT_CRUD = "R";

/**
 * Grants subsection of an access list. Each grant pairs a target (the whole
 * bucket, one bucket type, or a single row) with C/R/U/D toggles. The backend
 * enforces the bucket ≥ type ≥ row ceiling and target validity.
 */
export function GroupGrantsEditor({
  groupId,
  bucketId,
  grants,
  bucketTypes,
  onChanged,
}: {
  groupId: string;
  bucketId: string;
  grants: AccessGrant[];
  bucketTypes: { id: string; name: string }[];
  onChanged: () => void | Promise<void>;
}) {
  const [addTarget, setAddTarget] = useState<GrantTargetType>("bucket");
  const [addTypeId, setAddTypeId] = useState("");
  const [addRowId, setAddRowId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBucketGrant = grants.some((g) => g.targetType === "bucket");
  const grantedTypeIds = new Set(
    grants.filter((g) => g.targetType === "bucket_type").map((g) => g.targetId),
  );
  const addableTypes = bucketTypes.filter((t) => !grantedTypeIds.has(t.id));

  // Derive the available target kinds (never sync via effect): a bucket-wide
  // grant exists at most once; per-type only while ungranted types remain.
  const targetOptions: GrantTargetType[] = [
    ...(hasBucketGrant ? [] : (["bucket"] as const)),
    ...(addableTypes.length > 0 ? (["bucket_type"] as const) : []),
    "row" as const,
  ];
  // "row" is always present, so targetOptions is never empty (the ?? keeps the
  // type non-undefined under noUncheckedIndexedAccess).
  const effectiveTarget: GrantTargetType = targetOptions.includes(addTarget)
    ? addTarget
    : (targetOptions[0] ?? "row");

  const targetId =
    effectiveTarget === "bucket"
      ? bucketId
      : effectiveTarget === "bucket_type"
        ? addTypeId
        : addRowId.trim();
  const canAdd =
    !busy &&
    (effectiveTarget === "bucket"
      ? true
      : effectiveTarget === "bucket_type"
        ? addableTypes.some((t) => t.id === addTypeId)
        : targetId.length > 0 && targetId.length <= 36);

  function targetLabel(grant: AccessGrant): string {
    if (grant.targetType === "bucket") return "Whole bucket";
    if (grant.targetType === "bucket_type")
      return bucketTypes.find((t) => t.id === grant.targetId)?.name ?? grant.targetId;
    return `Row ${grant.targetId}`;
  }

  async function setGrant(
    targetType: GrantTargetType,
    target: string,
    crud: string,
    step: string,
  ) {
    setError(null);
    setBusy(true);
    try {
      await bucketAccessApi.upsertGrant(groupId, { targetType, targetId: target, crud });
      await onChanged();
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "bucket-access", step });
      setError(err instanceof Error ? err.message : "Failed to save grant.");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!canAdd) return;
    // setGrant owns the busy flag (which also gates the toggles below).
    await setGrant(effectiveTarget, targetId, NEW_GRANT_CRUD, "add-grant");
    setAddTypeId("");
    setAddRowId("");
  }

  async function remove(grant: AccessGrant) {
    setError(null);
    setBusy(true);
    try {
      await bucketAccessApi.deleteGrant(groupId, grant.id);
      await onChanged();
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "bucket-access", step: "remove-grant" });
      setError(err instanceof Error ? err.message : "Failed to remove grant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FieldGroup
      title="Grants"
      trailing={
        <span className="font-mono text-[0.7rem] normal-case tracking-normal text-apt-text-dim">
          bucket ≥ type ≥ row
        </span>
      }
    >
      {grants.length === 0 ? (
        <EmptyState title="No grants yet." description="Add one below to give this list access." />
      ) : (
        <List>
          {grants.map((grant) => (
            <ListItem key={grant.id} className="flex-wrap justify-between gap-3">
              <span className="truncate text-sm text-apt-text">{targetLabel(grant)}</span>
              <span className="flex items-center gap-2">
                <PermissionToggles
                  value={parseCrud(grant.crud)}
                  disabled={busy}
                  onChange={(next: Crud) => {
                    // Toggling every capability off means "no access" — remove the
                    // grant rather than persisting an empty, no-op grant row.
                    const crud = formatCrud(next);
                    return crud
                      ? setGrant(grant.targetType, grant.targetId, crud, "edit-grant")
                      : remove(grant);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(grant)}
                  title="Remove grant"
                  aria-label={`Remove grant on ${targetLabel(grant)}`}
                >
                  <Trash2 className="text-apt-red" />
                </Button>
              </span>
            </ListItem>
          ))}
        </List>
      )}

      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[12rem_1fr_auto]">
        <Field label="Target">
          <Select
            value={effectiveTarget}
            onChange={(e) => setAddTarget(e.target.value as GrantTargetType)}
          >
            {targetOptions.map((t) => (
              <option key={t} value={t}>
                {GRANT_TARGET_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>

        {effectiveTarget === "bucket" ? (
          <p className="pb-2 text-sm text-apt-text-muted">Applies to the entire bucket.</p>
        ) : effectiveTarget === "bucket_type" ? (
          <Field label="Bucket type">
            <Select value={addTypeId} onChange={(e) => setAddTypeId(e.target.value)}>
              <option value="">Select…</option>
              {addableTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Row id">
            <Input
              value={addRowId}
              placeholder="row id"
              maxLength={36}
              onChange={(e) => setAddRowId(e.target.value)}
            />
          </Field>
        )}

        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!canAdd}>
          Add grant
        </Button>
      </div>

      <ErrorText error={error} />
    </FieldGroup>
  );
}
