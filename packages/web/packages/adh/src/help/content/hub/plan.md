# Plan

You have an agent, a couple of stores, a status group, and a piece of software
that has to point at all of them. Naming each one individually in your
application's configuration means the configuration is where the wiring lives —
and the wiring is then something you redeploy to change, and something no
teammate can read.

You also have the work itself: what is being built, what was decided, and why.

## What it does

- **Projects** — the binding. A project names a persona, the data stores it
  uses, and a status group, as one thing with a name. It is also where the work
  lives, with **Plans** and **Tasks**; agents read and update those work items
  over the [REST API](/rest-api) and [MCP](/mcp).
- **Statuses** — every project starts with a default set, so a task has
  somewhere to be before you have configured anything.
- **Narratives** — a shareable story synthesized from your git history, docs,
  and notes. It is also where a persona's authored exchanges live: the canned
  opening a first-time visitor sees before typing.
- **Research** — a shared, searchable notebook of markdown documents, versioned
  the way the rest of the Hub versions things.

## What you use it with

**A project plus an [application](/hub/products) is what your code points at.**
An application never names a persona directly. It names a project, and the
project names everything that ships together — so changing which persona a
product runs is a change here rather than a redeploy there.

**A project plus a [persona](/hub/personas) and its
[stores](/hub/storage) is what makes the persona reachable.** A bucket outside a
project is invisible to the agent that needs it; a persona outside a project has
no way for your code to find it. The project is the join.

**A project plus a status group is what makes the [status page](/hub/monitoring)
about something.** The group names which endpoints belong to this product, so
the monitoring view is scoped rather than a flat list of everything you own.

**Narratives plus a `public` [persona](/hub/personas) is what a visitor sees
first.** The canned exchange authored here renders on the persona's public
profile before the visitor types anything — so the agent demonstrates itself
rather than presenting an empty box.

**Research plus a [knowledge base](/hub/storage) is how a note becomes something
an agent can cite.** Research is where you write; a knowledge base is where an
agent reads. Documents move from one to the other when they are ready to be
answered from.

## In the demo

*Longtail Labs is the Agentic Developer Hub's documentation demo — a fictional
studio, not a real company.*

**Dognamr Production** is the project that makes the rest of the workspace
composable: it names Bob, both data stores, and the status group, and it is what
the Dognamr Web application points at. Shelterly's project sits beside it,
deliberately thinner — an early-access product has less wired up, and that is
what an early-access product looks like:

![Dognamr Production binding Bob, both stores and the status group, with Shelterly's thinner project beside it](https://agenticdeveloperhub.com/screenshots/projects.png)

Bob's opening exchange is authored, not captured from a session. It is what a
stranger arriving at his profile reads before deciding whether to type:

![Bob's canned opening exchange, as authored](https://agenticdeveloperhub.com/screenshots/narratives.png)

Casey's working notes on naming heuristics live in Research — searchable, shared
with Priya, and the raw material the Breed Encyclopedia was built from:

![Casey's research notes on naming heuristics](https://agenticdeveloperhub.com/screenshots/research.png)

## Where to go next

- [Personas](/hub/personas) — the agent a project binds.
- [Storage & data](/hub/storage) — the stores a project binds.
- [Products](/hub/products) — the application that points at a project.
- [Monitoring](/hub/monitoring) — the status group a project names.
