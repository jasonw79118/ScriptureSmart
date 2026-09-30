# Trusted server boundary

This folder includes the Appwrite community function in `community/` as well as future integration contracts. The community function is not yet deployed. Only the pure, secret-free `community/policy.mjs` helpers are shared with the frontend. Do not enable credential inputs until a real service meets these requirements.

1. Establish authenticated sessions with an established identity provider and secure cookies. Validate CSRF protection on cookie-authenticated writes.
2. Resolve user identity server-side; never trust a submitted owner ID or role. Check church/group membership on every read and write. Private notes and private responses require separate visibility enforcement.
3. Accept API keys only over TLS. Encrypt using a managed vault/KMS with key rotation and revocation. Return metadata only. Never log credentials or include them in error messages.
4. Verify official API access, entitlement, licensing, and allowed storage/caching separately for every provider and translation. OAuth requires approved endpoints, state, PKCE where applicable, and secure token storage.
5. AI requests must include user consent, model/provider choices, estimated usage, timeouts, rate limits, and per-user budget controls. Fan-out to multiple models is opt-in.
6. Validate source categories, citations, quotations, and AI synthesis labels at ingestion. Treat imported material as untrusted content.
7. Validate uploaded file types and limits, scan uploads, and process media in isolated workers. No arbitrary remote URL fetches without SSRF protection.
8. Add database migrations, ownership tests, audit events without secret content, deletion/export flows, and deployment configuration before production use.

The first vertical slice should cover authentication, persistent personal drafts, and group membership checks. There is no placeholder endpoint that reports successful authentication or connection.

## Built-in AI Worker

See [AI Worker setup](ai/README.md) for the implemented Appwrite JWT verification and Cloudflare Workers AI integration. The Worker has not been deployed. Durable usage budgets and Bible source retrieval remain outstanding.
