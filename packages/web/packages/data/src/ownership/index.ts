import { authedJson } from "../http";

/** A principal who loses reach over the object when it moves. */
export interface RevokedSubject {
  kind: 'user' | 'team' | 'persona';
  id: string;
  name: string;
  via: "role" | "team" | "direct";
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
 * TWO, not six. The previous doc comment listed `application`, `bucket`, `project` and
 * `site-group` alongside these; all four are planned but unregistered, and the server 400s them.
 * Documenting a capability the API refuses is worse than documenting none — it reads as a working
 * call site. The union GROWS as plans are registered (server: `TransferableEntityType`, derived
 * from the registry itself), and this list moves in the same commit.
 */
export type TransferEntityType = "persona" | "ecosystem";

/** Which NAMESPACE a workspace slug is drawn from — see {@link TransferRequest.targetKind}. */
export type TransferTargetKind = "customer" | "organization";

export interface TransferRequest {
  entityType: TransferEntityType;
  /** rdid or UUID. */
  entityId: string;
  /** Target workspace slug. */
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
