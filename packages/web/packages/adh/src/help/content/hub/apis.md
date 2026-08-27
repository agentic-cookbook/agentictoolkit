# APIs & agents

Everything you configured by clicking has to be reachable by something that
does not click. Your product's code needs to talk to it at runtime, and — more
often now — so does the coding agent you are building it with. A control panel
that is the only way in is a control panel you will end up scripting badly.

## What it does

Every screen in the Hub is a resource, and there are two ways to reach it:

- **[REST API](/rest-api)** — an OpenAPI 3.1 surface covering every resource,
  described well enough to generate a client from.
- **[MCP server](/mcp)** — the same platform over the Model Context Protocol,
  as a curated tool set an AI agent can be handed. Not a mechanical mirror of
  the REST surface: the tools are chosen so an agent can accomplish something
  rather than enumerate everything.
- **[OAuth](/quickstart/oauth/overview)** — authorize on behalf of a user, for
  when your code is acting for someone rather than as itself.
- **Application tokens** — a bearer credential minted against one application,
  reaching one product's project and nothing beyond it.
- **Tools** — reusable, typed capabilities you define once and expose to any
  persona, over both REST and MCP.

## What you use it with

**A token plus an [application](/hub/products) plus a [project](/hub/plan) is
the whole access story, in that order.** The token belongs to the application,
the application belongs to the product, and the project is what it reaches. Each
link narrows the last, which is why a leaked token is a bad afternoon rather
than a bad quarter — it reaches one project, and nothing else you own.

**MCP plus your coding agent is how the setup happens without you.** Creating a
[persona](/hub/personas), wiring its service, minting a token, binding a
project: all of it is a tool call. The Hub is built to be operated by an agent,
which is a claim it has to make good on for its own configuration first.

**A tool plus a persona is how an agent does something rather than says
something.** Define the capability once with its types, expose it to the persona,
and it is available in chat, on the public profile, and to anything calling the
API — the same four surfaces the persona itself reaches.

**OAuth plus a [sign-in app](/hub/products) is how you act for your customer.**
Your product signs its own users in through the Hub, then calls on their behalf
with their consent — rather than with a token that can reach everything.

## In the demo

*Longtail Labs is the Agentic Developer Hub's documentation demo — a fictional
studio, not a real company.*

Dognamr has two applications, and each holds its own token. The scope column is
the point of the screenshot: each one names exactly one project, so the token in
Casey's CLI cannot read what the public site's token reads, and neither can see
Shelterly at all:

![Each token's scope naming exactly one project](https://agenticdeveloperhub.com/screenshots/tokens.png)

Everything else in this documentation — Bob, his service, both stores, the
project binding them — is a REST resource Casey could have created without
opening a single screen.

## Where to go next

- [REST API](/rest-api) — the full resource surface.
- [MCP server](/mcp) — the curated tool set for agents.
- [Products](/hub/products) — the application a token belongs to.
- [Plan](/hub/plan) — the project a token reaches.
