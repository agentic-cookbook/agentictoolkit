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

/** `?asType=persona&asId=<persona rdid or uuid>` — the act-as principal every call on this plane
 *  needs. Either form works: `loadTarget` (routes/bucketsData.ts) resolves an rdid through
 *  `assertActAsOwned` and returns the act-as principal carrying the RESOLVED uuid, which is what
 *  the grant check then matches against `access.group_members.member_id` — the persona uuid
 *  `ensurePersonaReader` stamped into the access group. Pass the rdid: it is what
 *  `GET /persona/personas` returns, and no API surface exposes the uuid at all. */
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
