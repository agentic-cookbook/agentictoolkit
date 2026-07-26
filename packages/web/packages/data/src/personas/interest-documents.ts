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

/** A `content.markdown` row as the rows plane returns it — the WHOLE row.
 *
 *  The route selects untyped (`tx.select().from(target.table)` in routes/bucketsData.ts) and
 *  JSON-encodes whatever Drizzle hands back, so every column of `markdownInContent`
 *  (backend/src/adh/src/db/schema/content.ts) is on the wire, not just the handful this feature
 *  reads. Declaring the real shape rather than a convenient subset is deliberate: the previous
 *  five-field version is what made a hand-written array fixture look like the wire and hid the
 *  envelope bug below. The UI uses `id`, `title` and `content`; the rest are declared so a caller
 *  reaching for one gets the truth about its type (and its nullability) from here. */
export interface InterestDocumentRow {
  id: string;
  /** The CREATOR/author stamp — the rows plane stamps it to the calling principal. */
  customerId: string;
  deletedAt: string | null;
  ecosystemId: string;
  /** The workspace principal the doc belongs to: `customer` or `organization`. */
  ownerKind: string;
  ownerId: string;
  title: string;
  /** Raw markdown, byte-exact. This is what the persona searches. */
  content: string;
  frontmatter: Record<string, unknown> | null;
  visibility: "private" | "public";
  stage: "draft" | "final";
  publicRoute: string | null;
  contentHash: string;
  sizeBytes: number;
  currentVersion: number;
  latestVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  syncVersion: number;
  syncStampedAt: string | null;
  syncTxid: number;
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
  /** The FIRST PAGE of this interest's corpus, oldest id first.
   *
   *  The verbs on this plane do NOT agree on their response shape: only the list wraps, as
   *  `c.json({ rows })` (routes/bucketsData.ts), while create and update answer with a bare row.
   *  So this one unwraps and its siblings must not.
   *
   *  Paging is real and this client does not do it: the route's page size defaults to AND is
   *  capped at `ROW_LIMIT` = 500 (`clampPageSize`, routes/bucketsData.ts), and no `limit`/`offset`
   *  is sent here, so an interest holding more than 500 documents returns its first 500 and the
   *  rest are simply not in this array. That is fine for an author-curated corpus and wrong for a
   *  bulk reader — the ingest script pages with limit+offset until it gets a short page. */
  list: async (
    bucketId: string,
    typeId: string,
    personaId: string,
  ): Promise<InterestDocumentRow[]> =>
    (
      await authedJson<{ rows: InterestDocumentRow[] }>(
        `${base(bucketId, typeId)}${actingAs(personaId)}`,
      )
    ).rows,
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
