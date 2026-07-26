// The bucket ROWS plane for an interest's research corpus.
//
// Routes: /api/bucket/buckets/{bucketId}/types/{typeId}/rows (list/create),
//         /api/bucket/buckets/{bucketId}/types/{typeId}/rows/{rowId} (put/delete).
//
// Unlike every other client here this one names an ACT-AS principal: the rows plane authorizes
// through the bucket ACL, and the holder of the grant on an interest bucket is the PERSONA, not
// the user. So the author fills the corpus by acting as their own persona (`asType=persona`), and
// the backend checks that the persona is theirs. A call without asType/asId is a 400.
import { authedJson, authedRequest } from "../http";
import { enc } from "../client-helpers";

/** A `content.markdown` row as the rows plane returns it. */
export interface InterestDocumentRow {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterestDocumentBody {
  title: string;
  content: string;
}

/** `?asType=persona&asId=<persona uuid>` — the act-as principal every call on this plane needs.
 *
 *  `personaId` MUST be the persona's raw uuid, never its rdid, even though the persona-CRUD
 *  routes accept either. Backend bug (do not "fix" this by switching to an rdid): `loadTarget`
 *  (routes/bucketsData.ts:256-294) resolves an rdid to its uuid only inside a LOCAL variable
 *  in `assertActAsOwned` (routes/bucketsData.ts:203-234, see `id` at :213-214) and returns the
 *  caller-supplied `actAs` unmutated. Every `canBucketAccess` call site (routes/bucketsData.ts:362,
 *  428, 512, 564) then passes that raw, unresolved value through to `bucketAccessBits`
 *  (lib/bucket-permissions.ts:104-105), which compares it by exact STRING EQUALITY against the
 *  persona uuid `ensurePersonaReader` stamped into the access group. An rdid never equals that
 *  uuid, so it 403s. */
function actingAs(personaId: string): string {
  return `?asType=persona&asId=${enc(personaId)}`;
}

function base(bucketId: string, typeId: string): string {
  return `/api/bucket/buckets/${enc(bucketId)}/types/${enc(typeId)}/rows`;
}

export const interestDocumentsApi = {
  list: (bucketId: string, typeId: string, personaId: string) =>
    authedJson<InterestDocumentRow[]>(`${base(bucketId, typeId)}${actingAs(personaId)}`),
  create: (bucketId: string, typeId: string, personaId: string, body: InterestDocumentBody) =>
    authedJson<InterestDocumentRow>(`${base(bucketId, typeId)}${actingAs(personaId)}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (
    bucketId: string,
    typeId: string,
    personaId: string,
    rowId: string,
    body: Partial<InterestDocumentBody>,
  ) =>
    authedJson<InterestDocumentRow>(
      `${base(bucketId, typeId)}/${enc(rowId)}${actingAs(personaId)}`,
      { method: "PUT", body: JSON.stringify(body) },
    ),
  delete: (bucketId: string, typeId: string, personaId: string, rowId: string) =>
    authedRequest(`${base(bucketId, typeId)}/${enc(rowId)}${actingAs(personaId)}`, {
      method: "DELETE",
    }),
};
