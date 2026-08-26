// UI model + helpers for bucket ACCESS LISTS (the backend calls them access
// groups). An access list belongs to a bucket and is a named set of principals
// (members) plus CRUD grants on the bucket / a bucket type / a row. Persisted via
// @agentic-toolkit/data/security's bucketAccessApi. This feature is decoupled from
// the bucket editor — it has its own Ecosystems "Access" topic (AccessPane).

import type {
  AccessGrant,
  AccessGroup,
  AccessGroupDetail,
  AccessGroupMember,
} from "@agentic-toolkit/data/security";
import { CRUD_KEYS, CRUD_LETTER, type Crud } from "@agenticdevelopertoolkit/ui/components/crud";

export type { AccessGrant, AccessGroup, AccessGroupDetail, AccessGroupMember };

export type MemberType = AccessGroupMember["memberType"]; // user | organization | persona | app
export type GrantTargetType = AccessGrant["targetType"]; // bucket | bucket_type | row

/** A bucket the access lists are scoped to (id + display name + its types). */
export interface BucketRef {
  id: string;
  name: string;
  types: { id: string; name: string }[];
}

/** A row in the cross-bucket access-list master list: a group + its bucket name. */
export interface AccessItem {
  group: AccessGroup;
  bucketName: string;
}

/** A pickable principal (user/app) for the member editor: id + display label. */
export interface Principal {
  id: string;
  label: string;
}

/** Fields the user edits when creating/renaming an access list. */
export interface AccessGroupInput {
  /** The bucket the list belongs to — chosen on create, fixed thereafter. */
  bucketId: string;
  name: string;
  description: string;
}

// --- the seeded "everyone" list -------------------------------------------------------

/** Backend kind for the auto-seeded, undeletable list that targets all principals. */
const EVERYONE_KIND = "everyone";

export function isEveryone(group: { kind: string }): boolean {
  return group.kind === EVERYONE_KIND;
}

// --- member types ---------------------------------------------------------------------

export const MEMBER_TYPE_LABEL: Record<MemberType, string> = {
  user: "User",
  organization: "Organization",
  persona: "Persona",
  app: "Application",
  token: "Token",
};

// Derived from the label record (Record<MemberType,…> fails to compile if the
// backend union grows), so a new member type can't silently miss the picker.
export const MEMBER_TYPES = Object.keys(MEMBER_TYPE_LABEL) as MemberType[];

// --- grant targets --------------------------------------------------------------------

export const GRANT_TARGET_LABEL: Record<GrantTargetType, string> = {
  bucket: "Whole bucket",
  bucket_type: "Bucket type",
  row: "Single row",
};

// --- CRUD <-> comma-letters -----------------------------------------------------------
// The backend stores grants as a comma-separated subset of C,R,U,D (or "" = none),
// matching auth.permissions. Convert to/from the Crud booleans PermissionToggles uses
// (letters come from the shared CRUD_LETTER map).

export function parseCrud(crud: string): Crud {
  const set = new Set(
    crud
      .split(",")
      .map((part) => part.trim().toUpperCase())
      .filter(Boolean),
  );
  return {
    create: set.has("C"),
    read: set.has("R"),
    update: set.has("U"),
    delete: set.has("D"),
  };
}

export function formatCrud(value: Crud): string {
  return CRUD_KEYS.filter((key) => value[key])
    .map((key) => CRUD_LETTER[key])
    .join(",");
}
