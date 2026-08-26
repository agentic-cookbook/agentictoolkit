"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { Field, FieldGroup } from "@agenticdevelopertoolkit/ui/blocks";
import { Badge } from "@agenticdevelopertoolkit/ui/components/badge";
import { EmptyState } from "@agenticdevelopertoolkit/ui/components/empty-state";
import { List, ListItem } from "@agenticdevelopertoolkit/ui/components/list";
import { bucketAccessApi } from "@agentic-toolkit/data/security";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import {
  MEMBER_TYPES,
  MEMBER_TYPE_LABEL,
  type AccessGroupMember,
  type MemberType,
  type Principal,
} from "./access-model";

/** Whether a member type can be picked from a loaded list, or needs a raw id. */
function principalsFor(
  type: MemberType,
  principals: { users: Principal[]; apps: Principal[] },
): Principal[] | null {
  if (type === "user") return principals.users;
  if (type === "app") return principals.apps;
  return null; // organization / persona — no list endpoint, enter the id directly
}

function memberLabel(
  member: AccessGroupMember,
  principals: { users: Principal[]; apps: Principal[] },
): string {
  const list = principalsFor(member.memberType, principals);
  return list?.find((p) => p.id === member.memberId)?.label ?? member.memberId;
}

/**
 * Members subsection of an access list. Lists current principals and adds/removes
 * them. user/app are pickable from the ecosystem's lists (filtered to those not
 * already in the list, with manual-id fallback when the list is empty);
 * organization/persona are entered by id. Hidden by the parent for "everyone".
 */
export function GroupMembersEditor({
  groupId,
  members,
  principals,
  onChanged,
  readOnly = false,
}: {
  groupId: string;
  members: AccessGroupMember[];
  principals: { users: Principal[]; apps: Principal[] };
  onChanged: () => void | Promise<void>;
  /** The members on screen are not known to be the server's yet (a cached copy being
   *  revalidated), so they can be READ but not changed: a remove aimed at a stale row could
   *  target a member the server no longer has. */
  readOnly?: boolean;
}) {
  const [addType, setAddType] = useState<MemberType>("user");
  const [pickId, setPickId] = useState("");
  const [rawId, setRawId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One gate for both reasons a change must not start: a write of our own is in flight, or what
  // is painted isn't known to be current.
  const locked = busy || readOnly;

  const pickable = principalsFor(addType, principals);
  const addedIds = new Set(
    members.filter((m) => m.memberType === addType).map((m) => m.memberId),
  );
  const options = pickable?.filter((p) => !addedIds.has(p.id)) ?? null;
  // Fall back to manual id entry when there's nothing to pick from — either the
  // type has no list endpoint (organization/persona) or the ecosystem's list is
  // empty / failed to load (so a user/app can still be added by id).
  const useRawInput = !options || options.length === 0;
  const memberId = useRawInput ? rawId.trim() : pickId;
  const canAdd = !locked && memberId.length > 0 && memberId.length <= 36;

  async function add() {
    if (!canAdd) return;
    setBusy(true);
    setError(null);
    try {
      await bucketAccessApi.addMember(groupId, { memberType: addType, memberId });
      setPickId("");
      setRawId("");
      await onChanged();
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "bucket-access", step: "add-member" });
      setError(err instanceof Error ? err.message : "Failed to add member.");
    } finally {
      setBusy(false);
    }
  }

  // `busy` for the same reason `add` holds it: every control here — including this trash button —
  // is `disabled={locked}`, so without it a remove leaves the whole editor live for the length of
  // the request and a second click fires a second DELETE.
  async function remove(member: AccessGroupMember) {
    setBusy(true);
    setError(null);
    try {
      await bucketAccessApi.removeMember(groupId, member.id);
      await onChanged();
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "bucket-access", step: "remove-member" });
      setError(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FieldGroup
      title="Members"
      trailing={members.length > 0 ? <Badge variant="neutral">{members.length}</Badge> : undefined}
    >
      {members.length === 0 ? (
        <EmptyState
          title="No members yet."
          description="Add a user, organization, persona, or application below."
        />
      ) : (
        <List>
          {members.map((member) => {
            const label = memberLabel(member, principals);
            return (
              <ListItem key={member.id} className="justify-between">
                <span className="flex min-w-0 items-center gap-2">
                  <Badge variant="neutral" className="shrink-0">
                    {MEMBER_TYPE_LABEL[member.memberType]}
                  </Badge>
                  <span className="truncate text-sm text-apt-text">{label}</span>
                </span>
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="icon"
                  onClick={() => remove(member)}
                  disabled={locked}
                  title="Remove member"
                  aria-label={`Remove ${label}`}
                >
                  <Trash2 />
                </Button>
              </ListItem>
            );
          })}
        </List>
      )}

      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[10rem_1fr_auto]">
        <Field label="Type">
          <Select
            value={addType}
            onChange={(e) => {
              setAddType(e.target.value as MemberType);
              setPickId("");
              setRawId("");
            }}
          >
            {MEMBER_TYPES.map((t) => (
              <option key={t} value={t}>
                {MEMBER_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={useRawInput ? `${MEMBER_TYPE_LABEL[addType]} id` : MEMBER_TYPE_LABEL[addType]}
          error={error ?? undefined}
        >
          {!useRawInput ? (
            <Select value={pickId} onChange={(e) => setPickId(e.target.value)}>
              <option value="">Select…</option>
              {options!.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              value={rawId}
              placeholder="principal id"
              maxLength={36}
              onChange={(e) => setRawId(e.target.value)}
            />
          )}
        </Field>

        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!canAdd}>
          Add member
        </Button>
      </div>
    </FieldGroup>
  );
}
