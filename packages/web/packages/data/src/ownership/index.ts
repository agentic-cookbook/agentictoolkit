import { authedJson } from "../http";

/** A principal who loses reach over the object when it moves.
 *
 *  `via` is the provenance of the access being taken away: an explicit grant in the roles layer
 *  (`role`), reach inherited through a team roster (`team`), a direct persona grant (`direct`), a
 *  seat on the subject project's participant list (`participant`), or a seat in a storage bucket's
 *  access group (`group`). They are separate because the admin confirming the dialog manages them
 *  on different surfaces — a `group` loss is managed on the bucket's Access Groups panel and
 *  nowhere else, and it is the WHOLE authorization story for a bucket, which carries no row-level
 *  security behind it.
 *
 *  `kind` spans both layers. `user`, `team` and `persona` are what the roles layer produces;
 *  `organization`, `app` and `token` appear only through a bucket access group, whose member list
 *  admits all five non-team principal types. Rendered as bare strings, so a new member here needs
 *  no rendering change. Mirrors the server's `RevokedSubject` (backend `src/lib/transfer-plans.ts`)
 *  and its OpenAPI enums, and moves in the same commit as those. */
export interface RevokedSubject {
  kind: 'user' | 'team' | 'persona' | 'organization' | 'app' | 'token';
  id: string;
  name: string;
  via: "role" | "team" | "direct" | "participant" | "group";
}

export interface TransferPreview {
  /** The rdid the object will take in the target workspace. */
  newId: string | null;
  previousId: string | null;
  /** API tokens bound to the object that will be revoked. */
  tokens: number;
  revoking: RevokedSubject[];
}

export interface TransferResult {
  id: string | null;
  previousId: string | null;
  /** Identifier rows rewritten by the cascade — the object plus every descendant. */
  rewritten: number;
  revoked: { tokens: number; subjects: RevokedSubject[] };
}

/**
 * The entity types the server's `TRANSFER_PLANS` registry actually implements.
 *
 * FOUR, not six. `project` and `site-group` are planned but unregistered, and the server 400s them.
 * Documenting a capability the API refuses is worse than documenting none — it reads as a working
 * call site. The union GROWS as plans are registered (server: `TransferableEntityType`, derived
 * from the registry itself), and this list moves in the same commit.
 *
 * `target` means something DIFFERENT for the last two. A persona or an ecosystem is transferred to
 * a WORKSPACE, so `target` is a workspace slug and `targetKind` disambiguates its namespace. An
 * application or a bucket hangs off an ecosystem, not off a workspace, so its `target` is a
 * PRODUCT rdid (`ecosystem.…`) and `targetKind` is meaningless — the authorized destination
 * workspace is whichever one owns that Product, which the server resolves.
 */
export type TransferEntityType = "persona" | "ecosystem" | "application" | "bucket";

/** Which NAMESPACE a workspace slug is drawn from — see {@link TransferRequest.targetKind}. */
export type TransferTargetKind = "customer" | "organization";

export interface TransferRequest {
  entityType: TransferEntityType;
  /** rdid or UUID. */
  entityId: string;
  /** Target workspace slug — or, for `application` and `bucket`, a Product rdid. */
  target: string;
  /**
   * Which namespace `target` names. OPTIONAL on the wire, but send it whenever you know: customer
   * slugs and organization slugs are unique only within their own table, so the same string can
   * name two different workspaces, and the server's resolver checks the caller's own personal
   * workspace FIRST. A user whose personal slug matches an org they belong to therefore cannot
   * address the org at all without this.
   */
  targetKind?: TransferTargetKind;
}

/**
 * Ownership transfer. The revoked set has exactly ONE definition, on the server — never
 * reconstruct it here. `preview` runs the real transfer inside a rolled-back transaction, so what
 * it reports is what `transfer` will do.
 */
export const ownershipApi = {
  preview: (req: TransferRequest): Promise<TransferPreview> => {
    const q = new URLSearchParams({
      entityType: req.entityType,
      entityId: req.entityId,
      target: req.target,
      // Omitted rather than sent empty when the caller has no kind: the server treats an ABSENT
      // targetKind as "use the default precedence" but validates a PRESENT one against an enum,
      // so `targetKind=` would turn a workable request into a 400.
      ...(req.targetKind ? { targetKind: req.targetKind } : {}),
    });
    return authedJson<TransferPreview>(`/api/ownership/transfer/preview?${q.toString()}`);
  },

  transfer: (req: TransferRequest): Promise<TransferResult> =>
    authedJson<TransferResult>("/api/ownership/transfer", {
      method: "POST",
      body: JSON.stringify(req),
    }),
};
