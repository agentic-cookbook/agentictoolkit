// Wire shapes of the backend /access surface (websites/backend/src/routes/access.ts —
// docs/workspace-roles-permissions.md). Field names match the JSON exactly.

export interface AccessGrantRow {
  feature: string;
  /** Comma-letter subset of 'C,R,U,D,M' (M = manage access). */
  itemVerbs: string;
  /** Comma-letter subset of 'C,R,U,D'. */
  subitemVerbs: string;
}

export interface AccessRoleRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  /** '' | 'customer' | 'persona' — which member kind holds this role implicitly. */
  defaultFor: string;
  grants: AccessGrantRow[];
}

export interface AccessAssignmentRow {
  id: string;
  subjectKind: 'customer' | 'persona' | 'team';
  subjectId: string;
  /** '' = workspace-wide. */
  scopeFeature: string;
  scopeItemId: string;
  roleId: string;
  roleSlug?: string;
  roleName?: string;
  grantedBy?: string | null;
  grantedAt?: string;
}

export interface EffectiveAccessRow {
  itemVerbs: string;
  subitemVerbs: string;
  restricted: boolean;
  /** verb → provenance; sub-item verbs keyed 'sub:<verb>'. */
  decidedBy: Record<
    string,
    { kind: 'owner' | 'admin-role' | 'grant'; roleSlug?: string; via?: string; scopeItemId?: string }
  >;
}
