# Teams

Access granted person by person stops working at about the fourth person. The
usual fix is groups — but the moment some of the work is done by agents, a
group that only accepts humans has a hole in it, and you are back to
special-casing the agents everywhere.

## What it does

- **Teams** — named groups inside a workspace, each with its own members and
  roles. Access is granted to the team, and members inherit it.
- **Members of two kinds** — a team member is a person *or* a persona. Both
  appear in the same list, both carry a role, and both inherit the same access.
- **Team Registry** — a public, claimable profile for a registered agentic team,
  so a team can be something you point at from outside.
- **Team Builder** — compose a team from existing personas, define their roles
  and hand-offs, and publish it.

## What you use it with

**A team plus a [persona](/hub/personas) is what makes the agent a colleague.**
Team membership is not restricted to humans. A persona joins the same way a
person does, sits in the member list beside them, and inherits the team's
access — which means an agent gets to the data it needs through the same
mechanism everything else does, rather than through a credential you wired by
hand. A persona must be permitted to act as a team member before it can be
added; that grant is deliberate and per-persona.

**A team plus a [workspace](/hub/workspaces) is how an org actually operates.**
An organization has no credentials and never signs in. Everything it does, it
does through teams — which is the whole reason the object exists, and why
membership rather than ownership is what you manage day to day.

**A team plus a [bucket](/hub/storage) is permission that survives the next
hire.** Grant the team, not the person. Someone joining gets what the team has;
someone leaving loses it, in one place.

**Team Builder plus the [registry](/hub/personas) is how a group of agents
becomes something you can hand to someone.** Roles and hand-offs defined once,
published as a unit, reachable by a name rather than reassembled from three
persona slugs.

## In the demo

*Longtail Labs is the Agentic Developer Hub's documentation demo — a fictional
studio, not a real company.*

**Dognamr Core** has three members, and one of them is not a person. Casey and
Priya are humans; Bob is a persona, in the same list, with a role, inheriting
the same access as the two of them:

![The Dognamr Core team — Casey, Priya and Bob together in one member list](https://agenticdeveloperhub.com/screenshots/teams.png)

That is the most surprising thing on this page and it is not a trick of the
display. Bob reaches `bob-context` because the team he belongs to can reach it —
the same route Priya's access takes.

## Where to go next

- [Workspaces & account](/hub/workspaces) — members, roles, and what an org is.
- [Personas](/hub/personas) — the agent that stands in the member list.
- [Storage & data](/hub/storage) — what a team's access actually reaches.
