# OAuth overview

Use OAuth when your application acts **on behalf of a user** — reading their
data, posting on their behalf, or otherwise needing their explicit consent.

If you only need to authenticate your own server-to-server traffic, use a
personal [API token](/quickstart) instead.

## The flow at a glance

The Agentic Developer Hub uses the standard OAuth 2.0 **Authorization Code**
flow with **PKCE**. Four steps:

1. **[Register your app](/quickstart/oauth/register-app)** — get a `client_id`
   and configure a `redirect_uri`.
2. **[Send the user to authorize](/quickstart/oauth/authorize)** — redirect the
   user to `/api/oauth/signin/start`. They sign in and approve scopes.
3. **[Exchange the code for tokens](/quickstart/oauth/token-exchange)** — your
   server POSTs the returned code to `/api/oauth/signin/exchange` and receives an
   access token + refresh token.
4. **[Refresh when the token expires](/quickstart/oauth/refresh)** — exchange a
   refresh token for a new access token at `/api/auth/refresh`.

```text
┌──────┐                ┌─────────┐               ┌──────────────┐
│ User │                │ Your    │               │ Agentic      │
│      │                │ App     │               │ Developer    │
│      │                │         │               │ Hub          │
└──┬───┘                └────┬────┘               └──────┬───────┘
   │                         │                            │
   │  1. Click "Connect"     │                            │
   │ ───────────────────────►│                            │
   │                         │                            │
   │                         │ 2. Redirect to /auth/start │
   │ ◄───────────────────────┤                            │
   │                                                      │
   │  3. Sign in & approve scopes                         │
   │ ────────────────────────────────────────────────────►│
   │                                                      │
   │  4. Redirect back to your redirect_uri with ?code=…  │
   │ ◄────────────────────────────────────────────────────│
   │                         │                            │
   │                         │ 5. POST /auth/exchange     │
   │                         │     {code, code_verifier}  │
   │                         │ ──────────────────────────►│
   │                         │                            │
   │                         │ 6. {access_token,          │
   │                         │     refresh_token,         │
   │                         │     expires_in}            │
   │                         │ ◄──────────────────────────│
   │                         │                            │
```

## What you'll need before you start

- A registered application with a `client_id`. See
  [Register an app](/quickstart/oauth/register-app).
- A `redirect_uri` you control (an HTTPS URL on your domain, or
  `http://localhost:<port>/callback` during development).
- A backend that can keep your `client_secret` server-side. The OAuth flow
  itself uses PKCE so the secret never travels through the user's browser,
  but anything you do post-token (refresh, revoke) must run server-side.

## Common pitfalls

- **The redirect_uri must match exactly.** Including the trailing slash, the
  port, the scheme. The mismatch is the #1 reason `/auth/exchange` returns
  `400`.
- **PKCE `code_verifier` is required.** This API rejects non-PKCE flows. See
  [Step 2](/quickstart/oauth/authorize) for how to generate the verifier and
  challenge.
- **Access tokens expire.** Always handle the
  `401 token_expired` response by refreshing — see
  [Step 4](/quickstart/oauth/refresh).
