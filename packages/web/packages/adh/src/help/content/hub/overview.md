# Hub Features

You are building something that has an agent in it, and the agent needs a place
to live. Not a folder in your repo — a place with an address, a version history,
credentials it can use, data it can read, and a way for your code to reach it
that is not a secret pasted into an environment variable. That place has to be
separate from your product, because your product will be rewritten and the agent
should survive it.

## What it does

The Hub is that place, and everything in it hangs off one idea: a **workspace**.

- **A workspace is who the work belongs to.** Your personal one, or an
  organization you own or belong to. You are always inside exactly one, and the
  switcher at the top-left is how you move.
- **Everything else is scoped to a workspace** — personas, products, storage,
  projects, teams, tokens. Nothing floats loose. Two organizations can both have
  a persona called Bob and never collide.
- **A product inside a workspace scopes it further.** Applications, tokens,
  buckets, flags, and dashboards all belong to one product, so a token minted for
  one cannot read another's data.
- **Members are people in the workspace; customers are people in your product.**
  These are different populations with different sign-in flows, and confusing
  them is the single most common mistake new readers make.

> [!NOTE]
> New here? Start with the [Quickstart](/quickstart) to register an app, mint a
> token, and make your first call.

## What you use it with

**A workspace plus an organization is what makes it shared.** A personal
workspace is a workspace with one member. Create an organization and the same
surfaces gain a [member roster](/hub/workspaces), invitations, and teams — the
features do not change, only who can reach them.

**A workspace plus a [product](/hub/products) is what gives your work a
boundary.** Without a product, everything you create sits at workspace level and
every token you mint reaches all of it. A product is how you say *this
application may read this data and nothing else*.

**A workspace plus a [project](/hub/plan) is what binds the pieces together.** A
persona, the store it reads, the store your users write to, and a status group
are four unrelated objects until a project names them as one thing. The project
is what an application points at.

## In the demo

*Longtail Labs is the Agentic Developer Hub's documentation demo — a fictional
studio, not a real company. It exists so every screen in these pages has
something real on it.*

Casey Rowan has two workspaces: a personal one, and the organization Casey owns.
The switcher shows both, which is the clearest statement of what an organization
is — a place you go, not a setting you toggle:

![The workspace switcher open, showing Casey's personal workspace above Longtail Labs](https://agenticdeveloperhub.com/screenshots/workspace-switcher.png)

Inside Longtail Labs, the workspace home is a summary of what the studio is
building — two products at opposite ends of their lives, Dognamr live and
Shelterly in early access:

![The Longtail Labs workspace home, listing Dognamr and Shelterly](https://agenticdeveloperhub.com/screenshots/workspace-home.png)

Every page that follows is a screen inside this workspace, signed in as Casey.

## Where to go next

- [Workspaces & account](/hub/workspaces) — settings, members, invitations, and
  the tokens that reach your data.
- [Personas](/hub/personas) — the agent itself. Most people start here.
- [Products](/hub/products) — the boundary everything else is scoped inside.
- [APIs & agents](/hub/apis) — every screen in this section, reachable from code.
