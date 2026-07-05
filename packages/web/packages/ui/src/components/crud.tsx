// Generic C/R/U/D capability model — shared by every permission UI on the
// platform (application→schema grants, bucket access grants). The four
// capabilities as independent booleans, the most-restrictive defaults, and the
// parent-clamp that keeps a child from ever exceeding its parent.

/** The four CRUD capabilities, as independent booleans. */
export interface Crud {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export const CRUD_KEYS = ["create", "read", "update", "delete"] as const;
export type CrudKey = (typeof CRUD_KEYS)[number];

/** The canonical single-letter label for each capability (C/R/U/D). */
export const CRUD_LETTER: Record<CrudKey, string> = {
  create: "C",
  read: "R",
  update: "U",
  delete: "D",
};

/** Most-restrictive default: no access at all. */
export function noAccess(): Crud {
  return { create: false, read: false, update: false, delete: false };
}

/** Read-only default. */
export function readOnly(): Crud {
  return { create: false, read: true, update: false, delete: false };
}

/**
 * Clamp `child` so it can never be more permissive than `parent`: a capability
 * is allowed only if the parent also allows it.
 */
export function clampToParent(child: Crud, parent: Crud): Crud {
  return {
    create: child.create && parent.create,
    read: child.read && parent.read,
    update: child.update && parent.update,
    delete: child.delete && parent.delete,
  };
}
