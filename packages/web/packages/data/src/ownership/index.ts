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

export interface TransferRequest {
  /** A transfer plan key: "persona", "ecosystem", "application", "bucket", "project", "site-group". */
  entityType: string;
  /** rdid or UUID. */
  entityId: string;
  /** Target workspace slug. */
  target: string;
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
    });
    return authedJson<TransferPreview>(`/api/ownership/transfer/preview?${q.toString()}`);
  },

  transfer: (req: TransferRequest): Promise<TransferResult> =>
    authedJson<TransferResult>("/api/ownership/transfer", {
      method: "POST",
      body: JSON.stringify(req),
    }),
};
