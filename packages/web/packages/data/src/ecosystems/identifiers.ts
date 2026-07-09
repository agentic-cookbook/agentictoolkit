// Identifiers API client — rename + availability for reverse-domain ids (rdids).
//
// An rdid lives in `registry.identifiers`, which maps the *mutable* rdid string to
// the *immutable* UUID primary key of the entity it names. Renaming an rdid is a
// PATCH on this route (NOT the entity's own PUT — the entity `id` is server-managed
// and can't be re-keyed there); the UUID and every UUID foreign-key reference are
// left untouched. The route is generic across entity types (ecosystem, application,
// persona, namespace, organization).
//
// Route: /api/registry/identifiers/{rdid} (PATCH rename)

import { authedJson, rethrowConflict } from "../http";
import { enc } from "../client-helpers";
import type { IdentifierRenameBody } from "./wire";

const BASE = "/api/registry/identifiers";

export const identifiersApi = {
  /**
   * Rename an rdid in place. The entity/UUID stays put — only the rdid string
   * changes. Surfaces a 409 (rdid already taken) as a friendly, named error.
   */
  async rename(currentRdid: string, nextRdid: string): Promise<void> {
    const body: IdentifierRenameBody = {
      rdid: nextRdid,
    };
    try {
      await authedJson<unknown>(
        `${BASE}/${enc(currentRdid)}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
    } catch (err) {
      rethrowConflict(err, `The identifier "${nextRdid}" is already in use.`);
    }
  },
};
