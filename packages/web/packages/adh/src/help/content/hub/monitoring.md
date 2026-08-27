# Monitoring

At 2am something is wrong and the only question worth answering is *which
layer*. A status page that watches only your own site tells you it is down —
which you knew, because that is why you are awake. What you need is your site,
the service it calls, and the platform underneath both, on one page, so the
answer is a glance rather than an investigation.

## What it does

- **Dashboards** — register the sites and endpoints you want watched, and see
  uptime and current status in one view.
- **Status groups** — group what you registered, so a page reads as layers
  rather than as an unsorted list of URLs.
- **Metrics** — the numbers a shipped product produces: usage, engagement, and
  what your agents are spending.

## What you use it with

**A status group plus a [project](/hub/plan) is what scopes the page.** The
project names which group belongs to it, so the status view is about one product
instead of everything you own. A workspace with two products gets two pages, not
one long one.

**Your endpoints plus the Hub's own services is what makes the page answer the
question.** Register the service your product calls alongside your site, and the
Hub's status for the APIs your [persona](/hub/personas) depends on appears in
the same view. Three layers, one page — that is the difference between knowing
something is broken and knowing where.

**A dashboard plus [billing](/hub/products) is how usage becomes a decision.**
Suggestions served, conversion, and token spend against subscribers tells you
whether the paid tier is worth what it costs to run.

## In the demo

*Longtail Labs is the Agentic Developer Hub's documentation demo — a fictional
studio, not a real company.*

Dognamr's dashboard carries the numbers Casey actually checks: how many names
were suggested, how many got pinned, and what Bob cost to run:

![The Dognamr dashboard — daily suggestions, pin rate, and Bob's token spend](https://agenticdeveloperhub.com/screenshots/dashboards.png)

And the status view has three groups, deliberately: the Dognamr site itself, the
breed-classifier endpoint it calls, and the Hub APIs Bob depends on. When one is
red, Casey knows which one before opening anything else:

![Three status groups on one page — the site, the classifier endpoint, and the Hub APIs](https://agenticdeveloperhub.com/screenshots/monitoring-status.png)

## Where to go next

- [Plan](/hub/plan) — the project that names a status group.
- [Products](/hub/products) — the product a dashboard is about.
- [APIs & agents](/hub/apis) — reading status from your own code.
