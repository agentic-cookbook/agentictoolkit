// Bucket access-list API client — wired to the real backend access-group routes
// (websites/backend/src/routes/bucketGroups.ts). An access list = a named group
// of principals (members) plus CRUD grants per target. Groups are bucket-scoped.
//
//   GET/POST   /api/bucket/buckets/{bucketId}/access-groups   list / create
//   GET/PATCH/DELETE /api/bucket/access-groups/{groupId}      detail / rename / delete
//   POST/DELETE      .../{groupId}/members[/{memberRowId}]    add / remove a member
//   PUT/DELETE       .../{groupId}/grants[/{grantId}]         upsert / remove a grant
//
// The seeded "everyone" group is undeletable (delete → 409); the backend also
// enforces grant-target validity and the bucket ≥ type ≥ row ceiling.

import { authedJson, authedRequest, rethrowConflict } from "../http";
import { enc } from "../client-helpers";
import type {
  AccessGrantPutBody,
  AccessGrantRow,
  AccessGroupCreateBody,
  AccessGroupDetailRow,
  AccessGroupListRow,
  AccessGroupMemberAddBody,
  AccessGroupMemberRow,
  AccessGroupPatchBody,
  AccessGroupRow,
  GrantTargetType,
  MemberType,
} from "./wire";

export type AccessGroup = AccessGroupRow;
export type AccessGroupDetail = AccessGroupDetailRow;
export type AccessGroupMember = AccessGroupMemberRow;
export type AccessGrant = AccessGrantRow;
export type { GrantTargetType, MemberType };

const BUCKETS = "/api/bucket/buckets";
const GROUPS = "/api/bucket/access-groups";

export const bucketAccessApi = {
  // Every access group the caller can see, across buckets — one call for the
  // cross-bucket Access pane (vs a listGroups fan-out per bucket). The caller joins
  // bucket names locally and filters to the ecosystem it's showing.
  async listAllGroups(): Promise<AccessGroup[]> {
    const body = await authedJson<AccessGroupListRow>(GROUPS);
    return body.accessGroups;
  },

  async getGroup(groupId: string): Promise<AccessGroupDetail> {
    return authedJson<AccessGroupDetail>(`${GROUPS}/${enc(groupId)}`);
  },

  async createGroup(
    bucketId: string,
    input: { name: string; description?: string },
  ): Promise<AccessGroup> {
    const name = input.name.trim();
    const body: AccessGroupCreateBody = {
      name,
      ...(input.description ? { description: input.description } : {}),
    };
    try {
      return await authedJson<AccessGroup>(`${BUCKETS}/${enc(bucketId)}/access-groups`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (err) {
      rethrowConflict(err, `An access list named "${name}" already exists.`);
    }
  },

  async updateGroup(
    groupId: string,
    patch: { name?: string; description?: string },
  ): Promise<AccessGroup> {
    const body: AccessGroupPatchBody = {};
    if (patch.name !== undefined) body.name = patch.name.trim();
    if (patch.description !== undefined) body.description = patch.description;
    try {
      return await authedJson<AccessGroup>(`${GROUPS}/${enc(groupId)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    } catch (err) {
      rethrowConflict(err, `An access list named "${(patch.name ?? "").trim()}" already exists.`);
    }
  },

  async deleteGroup(groupId: string): Promise<void> {
    await authedRequest(`${GROUPS}/${enc(groupId)}`, { method: "DELETE" });
  },

  async addMember(
    groupId: string,
    input: { memberType: MemberType; memberId: string },
  ): Promise<AccessGroupMember> {
    const body: AccessGroupMemberAddBody = {
      memberType: input.memberType,
      memberId: input.memberId,
    };
    try {
      return await authedJson<AccessGroupMember>(`${GROUPS}/${enc(groupId)}/members`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (err) {
      rethrowConflict(err, "That member is already in this access list.");
    }
  },

  // `memberRowId` is the membership row's id (AccessGroupMember.id), not the
  // principal id — the backend DELETE matches on the row id.
  async removeMember(groupId: string, memberRowId: string): Promise<void> {
    await authedRequest(`${GROUPS}/${enc(groupId)}/members/${enc(memberRowId)}`, {
      method: "DELETE",
    });
  },

  async upsertGrant(
    groupId: string,
    input: { targetType: GrantTargetType; targetId: string; crud: string },
  ): Promise<AccessGrant> {
    const body: AccessGrantPutBody = {
      targetType: input.targetType,
      targetId: input.targetId,
      crud: input.crud,
    };
    return authedJson<AccessGrant>(`${GROUPS}/${enc(groupId)}/grants`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  async deleteGrant(groupId: string, grantId: string): Promise<void> {
    await authedRequest(`${GROUPS}/${enc(groupId)}/grants/${enc(grantId)}`, {
      method: "DELETE",
    });
  },
};
