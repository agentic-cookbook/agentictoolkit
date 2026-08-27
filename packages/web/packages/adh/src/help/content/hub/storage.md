# Storage & data

Your agent needs to read something, and your users need their choices to still
be there next week. Those are two different problems, and solving them with one
pile of rows is the mistake that is cheap to make and expensive to undo — the
reference material you curate and the per-visitor state you must never leak into
a prompt end up in the same place, permissioned the same way.

## What it does

Storage is a set of named, permissioned collections and a browser over what is
in them:

- **Buckets** — named collections that expose selected tables and rows. Every
  ecosystem gets a default one, and buckets nest, so a product's data can have
  structure without a second database.
- **Bucket kinds** — what a bucket is *for*. A **persona data store** holds what
  the agent knows; a **user data store** holds what each of your end users
  chose. The difference is who has read access, not a naming convention.
- **Files** — upload, browse, and serve files, with signed reads so a URL you
  hand out expires.
- **Knowledge bases** — documents ingested into a searchable store an agent can
  ground an answer in and cite back at.
- **Access & usage** — the permission list for each bucket, and what has been
  reading it.
- **All Data** — a cross-schema browser that reads and edits the underlying
  records directly, for when you need to see the row rather than the feature.
- **Integrations** — third-party accounts (OAuth or Plaid) that sync data into
  your workspace on a schedule.

## What you use it with

**A persona data store plus a [persona](/hub/personas) is what makes the agent
informed.** Character fields tell an agent how to sound; the store tells it what
is true. Grant the persona read access to a bucket and everything in that bucket
is material it can reason from — the same for every visitor, and yours to
curate.

**A user data store plus your own end users is what makes your product
remember.** Keyed by the customer who signed in through your
[product's](/hub/products) sign-in app, so the pins, preferences, and progress
follow that person across devices. You get per-user persistence without running
a database, and — because the grant is on the user, not the persona — nothing in
it is visible to the agent unless you deliberately hand it over.

**A bucket plus a [project](/hub/plan) is what makes it reachable.** A bucket
outside a project is invisible to the application that needs it. The project is
what names which stores ship together with which persona, and an
[application's token](/hub/apis) reaches the project rather than the bucket.

**A knowledge base plus a persona is what makes an answer citable.** Ingested
documents are chunked and embedded, so the agent retrieves the passage rather
than being handed the whole corpus. Character makes an agent sound right; a
knowledge base makes it *be* right.

**Integrations plus a bucket is how outside data arrives.** A connected GitHub
or Stripe account syncs into a bucket you already permissioned, so the agent
reading that bucket picks it up without you writing an importer.

## In the demo

*Longtail Labs is the Agentic Developer Hub's documentation demo — a fictional
studio, not a real company.*

Dognamr has both kinds of store, and the pair is the clearest thing on this
page. `bob-context` is Bob's — breed dictionaries and naming guardrails.
`visitor-favorites` is the visitors' — the names each of them pinned:

![bob-context and visitor-favorites side by side, their kinds visibly different](https://agenticdeveloperhub.com/screenshots/storage-buckets.png)

Opening `bob-context` shows material Casey wrote and Bob reads. None of it is
per-visitor, and it is identical for everyone who talks to him:

![Inside bob-context — breed dictionaries and naming guardrails](https://agenticdeveloperhub.com/screenshots/storage-bob-context.png)

Both stores, and the rows inside them, in one cross-schema view — this is the
screen for when the feature UI is not showing you what you need:

![Both stores and their contents in the All Data browser](https://agenticdeveloperhub.com/screenshots/all-data.png)

The Breed Encyclopedia is a knowledge base rather than a bucket of loose rows,
and it names the persona consuming it. That column is the point: a knowledge
base nothing reads is a document dump:

![The Breed Encyclopedia knowledge base, showing Bob as its consumer](https://agenticdeveloperhub.com/screenshots/knowledgebases.png)

Longtail Labs has GitHub and Stripe connected, so release activity and payment
records arrive in the workspace rather than being copied in by hand:

![GitHub and Stripe, both connected](https://agenticdeveloperhub.com/screenshots/integrations.png)

## Where to go next

- [Personas](/hub/personas) — the agent that reads the store.
- [Plan](/hub/plan) — the project that binds stores to a persona.
- [Products](/hub/products) — the boundary the data sits inside.
- [APIs & agents](/hub/apis) — reading and writing a bucket from your own code.
