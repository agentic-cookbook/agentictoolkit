# Webhooks

> [!NOTE]
> The public webhooks API is on the roadmap. The backend already serves
> internal webhook receivers at `/api/webhooks/*` (Postmark, Stripe, etc.) —
> those are intentionally hidden from the public API reference because the
> sender is the third party, not your application.

## What will be available

When the outbound webhooks ship, you'll be able to:

- Register webhook subscriptions per OAuth app (one or more URLs).
- Filter events by type (e.g., `discussion.thread.created`,
  `integration.connected`).
- Verify deliveries with an HMAC signature in the
  `X-AgenticDeveloperHub-Signature` header.
- Replay recent deliveries from the dashboard.

## Until then

If your use case needs realtime updates, the WebSocket endpoint at
`/ws/discussions` already broadcasts most user-facing events (replies,
reactions, notifications, DMs, presence). It is documented in the
description block of the [API reference](https://api.agenticdeveloperhub.com).
