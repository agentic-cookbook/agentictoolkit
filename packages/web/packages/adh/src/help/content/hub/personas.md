# Personas

You want an agent that behaves the same way every time — same voice, same
knowledge, same limits — whether someone meets it inside your product, on a page
you can send a link to, or through an API call your own code makes. Writing that
behaviour into each of those places separately means three copies to keep in
step, and they will not stay in step.

## What it does

A persona is that behaviour, written down once and versioned:

- **Identity** — name, bio, avatar, and the slug that becomes a public address.
- **Character and voice** — the traits, stances, and special interests that go
  verbatim into the system prompt, so the prompt is something you edit rather
  than something you assemble by hand.
- **Worked examples and canned exchanges** — sample conversations that show a
  visitor how the agent behaves before they type anything.
- **Model preferences** — which model this persona runs on, chosen from what its
  service actually offers rather than typed from memory.
- **Visibility** — `private` to your workspace, `hub` to signed-in Hub users, or
  `public` to anyone with the link.
- **Version history** — every revision inspectable, diffable, and pinnable.

**Persona Services** are the other half of the page: one service is one
connection to one provider account. It holds the credentials, reports whether the
connection is live, and publishes the list of models that provider actually
offers. Services are created from **LLM provider templates** — the catalogue of
providers the Hub knows how to talk to — so connecting an account is filling in a
form, not writing a client.

## What you use it with

**A persona plus a service is what makes it able to talk.** This is the one
combination nothing else works without. The persona holds the behaviour; the
service holds the provider connection and the credentials. On its own a persona
is a specification nobody has run — it renders, it diffs, and it cannot answer a
question. Point it at a service and the same wiring serves four surfaces at once:
chat inside your product, the persona's public profile on the Persona Registry,
the [REST API](/hub/apis), and the [MCP server](/mcp). You configure the provider
once, in one place, and all four follow. Change the model on the persona and all
four change together.

**A persona plus a [Persona Data Store](/hub/storage) is what makes it
informed.** The store holds the prompts, reference material, and memory the agent
reasons from, scoped to one project. Without it the agent knows only what its
character fields say; with it, it knows what you have given it.

**A persona plus a [Knowledge Base](/hub/storage) is what makes it citable.** A
knowledge base is documents ingested into a searchable store the agent can ground
an answer in and point back at. Character makes an agent sound right; a knowledge
base makes it *be* right.

**A persona plus a [team](/hub/teams) is what makes it a colleague.** Team
membership is not restricted to humans — a persona joins a team the same way a
person does, appears in the member list beside them, and inherits the team's
access.

**A persona plus a [project](/hub/plan) is what your application points at.** An
application does not name a persona directly; it names a project, and the project
names the persona, its store, and everything else that ships together.

**A `public` persona plus a slug is a place people can go.** Publishing puts the
agent at `agenticpersonaregistry.com/<slug>`, where its character fields stop
being configuration and become the page — bio, worked examples, and a chat box
that talks to it through the service you configured. This is why the character
fields are worth writing properly: on a public persona, they are the product.

## In the demo

*Longtail Labs is the Agentic Developer Hub's documentation demo — a fictional
studio, not a real company.*

The studio runs three personas, one per visibility tier:

![Three personas in the Longtail Labs workspace — Bob public, Scout hub, Margo private](https://agenticdeveloperhub.com/screenshots/personas-list.png)

**Bob** is `public`. He suggests names for dogs and cannot do it without
explaining where the name came from — which is a character trait Casey wrote, not
a behaviour that emerged. His three worked examples and his canned opening
exchange are authored in the editor, not captured from a session:

![Bob's persona editor on the character tab, showing his traits and worked examples](https://agenticdeveloperhub.com/screenshots/persona-bob-editor.png)

**Scout** is `hub` — internal only. Scout writes the studio's release notes and
posts status updates, and never meets a customer. A workspace with exactly one
persona in it teaches the wrong lesson: personas are not only for the
customer-facing agent.

**Margo** is `private`, drafts adoption listings for Shelterly, and runs on the
studio's second provider — which is a fact about her service, not about her.

Casey created one service per provider. Both report a live connection, and each
carries its own credentials:

![Two persona services — an Anthropic connection and an OpenAI connection, both live](https://agenticdeveloperhub.com/screenshots/persona-services.png)

Both were instantiated from the provider catalogue rather than configured from
scratch:

![The LLM provider templates the two connections were created from](https://agenticdeveloperhub.com/screenshots/llm-providers.png)

Because Bob points at the Anthropic service, his model picker lists the models
that service actually offers. The list is fetched from the connection, so a model
that provider has retired cannot be selected here:

![Bob's model picker, listing models fetched from his service](https://agenticdeveloperhub.com/screenshots/persona-bob-model.png)

And that is the whole chain, ending somewhere a stranger can reach. Bob is
public, so the same persona and the same service produce a profile page with a
usable chat box on it — no additional configuration, and no second copy of his
character to maintain:

![Bob's public profile on the Persona Registry, with his bio, examples, and a chat box](https://agenticdeveloperhub.com/screenshots/persona-bob-profile.png)

## Where to go next

- [Storage & data](/hub/storage) — the two kinds of store a persona uses, and why
  they are different things.
- [Plan](/hub/plan) — the project that binds a persona to its data, and the
  narratives feature where authored exchanges live.
- [Teams](/hub/teams) — putting a persona in a member list beside people.
- [APIs & agents](/hub/apis) — reaching a persona from your own code, and over
  MCP.
