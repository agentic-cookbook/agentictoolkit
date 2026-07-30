# Errors

The API returns JSON error responses with a consistent shape. The HTTP
status code is the primary signal; the body provides a machine-readable
`code` and a human-readable `message`.

## Response shape

```json
{
  "code": "validation_error",
  "message": "redirect_uri must be one of the URIs registered for this client",
  "field": "redirect_uri"
}
```

| Field     | Type     | Notes                                                |
| --------- | -------- | ---------------------------------------------------- |
| `code`    | `string` | Stable machine-readable identifier (snake_case)       |
| `message` | `string` | Human-readable explanation, may change between versions |
| `field`   | `string?`| Set on `400` validation errors; identifies the offending field |

Always switch on `code`, not `message`.

## Common status codes

| HTTP | Meaning                  | What to do                            |
| ---- | ------------------------ | -------------------------------------- |
| 400  | Validation / bad request | Fix the request and retry              |
| 401  | Missing / invalid auth   | Refresh the token, or re-authorize     |
| 403  | Authenticated but no permission | Don't retry; user needs the right scope or role |
| 404  | Resource not found        | Confirm the ID; don't retry            |
| 409  | Conflict (e.g., duplicate) | Inspect the error and adapt            |
| 429  | Rate limited              | Back off; check `Retry-After`          |
| 500  | Server error              | Retry with exponential backoff; if persistent, report it |

## Retry guidance

- **Idempotent verbs** (`GET`, `PUT`, `DELETE`) — retry safely on 5xx and
  network errors.
- **`POST`** — retry only if you set `Idempotency-Key` (see the
  [API reference](https://api.agenticdeveloperhub.com)) or you can otherwise
  guarantee the operation is idempotent.
- **Rate limits** — honour `Retry-After` (seconds). Don't retry faster than
  the server tells you to.

## Reporting bugs

If the response looks like a server-side bug (5xx without a clear cause,
unexpected `400`), include the `code`, the request ID from the
`X-Request-Id` response header, and a minimal repro in your report.
