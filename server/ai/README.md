# ScriptureSmart AI backend

## Deployment status - September 29, 2026

The AI Worker is deployed at https://scripturesmart-ai.jasonw79118.workers.dev. The local `.env.local` now points `VITE_AI_API_BASE_URL` to that Worker. Readiness returned HTTP 200 with `available: true`; anonymous generation returned 401; an unapproved origin returned 403; the local frontend preflight returned 204. A real signed-in inference request is still awaiting user verification. Configuration readiness does not prove model availability. The Appwrite community function deployment status is unchanged.

This Worker supplies the built-in assistant. It is deployed; **live signed-in inference verification is pending**. Users need a verified ScriptureSmart/Appwrite account, not a separate AI subscription. The operator supplies Cloudflare infrastructure and pays any applicable Workers AI charges.

## Request path

UI → generic AI service → ScriptureSmart HTTP provider → authenticated Worker → Workers AI binding.

The browser sends a short-lived Appwrite user JWT to the Worker. The Worker verifies it using the configured Appwrite project's `/account` endpoint and requires an active, email-verified account. It never trusts a submitted user ID. JWTs are kept in memory for the request and sent only to Appwrite for verification, not to the model. Cloudflare credentials never enter the frontend.

- `GET /api/ai/status`: reports configuration readiness without making an inference call. It is not proof the configured model is currently available.
- `POST /api/ai/generate`: verified-user generation; JSON response or sanitized error.
- `OPTIONS`: exact-origin CORS preflight. No wildcard origins or cookie authentication.

No deployment, external AI connection, or unauthenticated development bypass is included in the test workflow.

## Operator setup

1. Install dependencies with `npm.cmd install` (Node 24 recommended).
2. Authenticate the official Cloudflare CLI yourself: `npx wrangler login`.
3. Select the Cloudflare account that will host the Worker and Workers AI. If you have multiple accounts, set the correct `account_id` in `wrangler.jsonc`. Confirm model access, applicable license terms, and account spending controls in Cloudflare before real requests.
4. Review `wrangler.jsonc`:
   - `AI` is the Workers AI binding, with `remote: true` for local development. Local generation uses Cloudflare and can incur charges.
   - `SCRIPTURESMART_AI_MODEL` defaults to `@cf/google/gemma-4-26b-a4b-it`.
   - `SCRIPTURESMART_AI_FALLBACK_MODEL` is empty by default. Optional value: `@cf/zai-org/glm-4.7-flash`. Fallback is attempted only for an explicitly identified model-not-found failure. There is no automatic retry for timeouts or rate limits.
   - `APPWRITE_ENDPOINT` and `APPWRITE_PROJECT_ID` identify the existing ScriptureSmart project. No Appwrite server API key is needed for this Worker.
   - `ALLOWED_ORIGINS` must contain exact browser origins, comma-separated. Replace the local entries with your HTTPS frontend origin for production.
   - `AI_USER_LIMIT`: six requests per user per minute. `AI_GLOBAL_LIMIT`: sixty requests per minute across the Worker, including failed authentication attempts. Choose namespace IDs unused by unrelated rate-limit bindings in your Cloudflare account.
5. In Appwrite, enable the intended account login method and add the frontend hostname as a Web platform. Test account verification and `account.createJWT()`.

### Bible provider runtime secret

The current GitHub Actions workflow deploys only GitHub Pages. A repository secret is not automatically available to this Cloudflare Worker, and this workflow does not transfer it. The Worker expects the existing secret name `API_BIBLE_KEY`.

To configure it without placing the value in source or a command argument, open the Cloudflare dashboard, select the `scripturesmart-ai` Worker, then go to **Settings → Variables and Secrets → Add → Secret**. Enter `API_BIBLE_KEY` as the name and paste the value into the masked value field, then save and redeploy the Worker. You can also run `npx wrangler secret put API_BIBLE_KEY` in an authenticated terminal; Wrangler prompts for the value. Never put it in `VITE_*`, `.env.example`, a committed file, or a build log. No GitHub workflow currently deploys or updates this Worker.

## Local development

In separate terminals:

```powershell
npm.cmd run dev:worker
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Vite proxies `/api/ai` to `http://127.0.0.1:8787`. Leave `VITE_AI_API_BASE_URL` blank for this workflow. Sign in to ScriptureSmart, open a passage or editor, and choose Ask ScriptureSmart. Only requests deliberately submitted by the user invoke inference; status checks do not.

The site works without the Worker: editing and community previews remain available, while AI generation shows an availability error. Tests mock authentication and inference and never call Cloudflare. No special fake-auth mode can be enabled in the deployed Worker.

## Build and manual deployment

```powershell
npm.cmd run build:worker
```

This performs `wrangler deploy --dry-run`, validates configuration, and bundles locally. It does **not** publish the Worker.

When the owner is ready to deploy, run manually:

```powershell
npx wrangler deploy
```

For a separately hosted frontend, set `VITE_AI_API_BASE_URL` to the public HTTPS Worker origin, add that frontend's origin to `ALLOWED_ORIGINS`, and rebuild/redeploy the frontend. Alternatively, configure an HTTPS same-origin `/api/ai/*` route and leave the public variable blank. Vite's local proxy is not a production route.

`wrangler login` stores its credentials outside application source. Do not copy them into `.env`, `VITE_*`, browser storage, or this repository. `.wrangler/` and `.dev.vars*` are ignored. If a CI deployment later uses `CLOUDFLARE_API_TOKEN`, keep it in the CI secret store only.

## Boundaries and limits

- JSON body: at most 65,536 UTF-8 bytes, checked while reading, even without a Content-Length header.
- Prompt: 6,000 characters; selected context: 36,000 serialized characters. Individual sermon/study content: 30,000 characters. Source text: 24,000 characters per document; at most twelve documents in each category.
- Only the seven declared task types and known fields are accepted. Clients cannot choose a model, inject a system message, or increase the output cap above 2,048 tokens. Temperature is bounded to 0–1.
- Appwrite validation times out after eight seconds; inference after 120 seconds (browser wait: 150 seconds). Browser cancellation stops waiting and prevents late insertion, but may not stop already-running provider work or charges.
- Rate-limit bindings are approximate, per-location, eventually consistent abuse controls. They are **not monthly quotas, billing limits, or global financial guarantees**. `checkAllowance` is the extension point for a future durable user/church allowance service. A global limiter can also temporarily affect legitimate users during abuse.
- Access currently requires a verified Appwrite account. This personal assistant does not load church/group data or evaluate church-specific AI entitlements. Those policies must be added before offering church-funded allowances.

## Source integrity and privacy

`instructions.ts` is the server-owned instruction layer. It distinguishes Scripture, original-language data, historical sources, commentary, sermons, notes, and AI synthesis. It prohibits invented quotations, silently merged translations, unsupported source attributions, and claims of retrieval. It asks for major interpretations where Christians disagree and acknowledges missing material.

Context is explicitly selected in the UI. Passage references and translation names are not Scripture text. Source documents require text and typed provenance; Scripture documents require a translation identifier. Caller-supplied `isVerified` is reset to false, and URLs are not fetched. The WEB adapter separately supplies server-retrieved text and source links. No commentary database, lexicon, exhaustive search tool, or automatic verification of generated citations is implemented here.

The system prompt reduces risk; it cannot guarantee factual or theological correctness. All responses are labeled AI SYNTHESIS and require user review. Plain text is rendered without executing HTML. Discussion-guide output is rejected unless it contains all seven valid sections. Inserting guide sections appends to existing content; replacing a selected section requires confirmation. AI-derived content is labeled when inserted.

The Worker has no persistence for prompts or responses and does not log JWTs, content, or raw upstream errors. Cloudflare processes the selected content; consult the provider's current data-use terms before using sensitive material. Worker observability is disabled in the supplied configuration. Future logging must preserve these boundaries.

## References

- [Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/)
- [Gemma model](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/)
- [Optional GLM fallback](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/)
- [Rate-limit bindings and accuracy](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Appwrite account API and JWT creation](https://appwrite.io/docs/references/cloud/client-web/account)

## Bible retrieval

Study requests may include a `bible.references` list of one to six validated references. After authentication and rate limiting, `scripture.ts` retrieves WEB text from bible-api.com, validates translation/book/chapter/verse identity, and passes it separately as trusted retrieval provenance. The active translation choices are CSB, NLT, NKJV, and KJV. API.Bible supplies the licensed editions; public-domain KJV is retrieved separately from bible-api.com. Licensed selected text is returned for display but excluded from the Workers AI prompt. Public-domain KJV text may be included in model context.

The open research adapter queries Free Use Bible API chapter text, OpenBible.info cross references, commentary indexes/chapters, Theographic chapter entities, and BSB word annotations where available. It uses bounded isolate-local caching for public research data only, per-source timeouts, and independent failure handling. Returned original-language annotations can include Strong's IDs, lemma, morphology, and English-word anchors. The source does not guarantee original-script forms, transliterations, glosses, or annotations in every chapter; missing fields stay unavailable. Commentary excerpts are source data, separate from generated analysis.

The active Bible selectors are CSB, NLT, NKJV, and KJV. API.Bible authorization for CSB, NLT, and NKJV is discovered dynamically from `/v1/bibles`; only returned, licensed versions are listed. Bible IDs and metadata are not cached, avoiding cross-key license staleness and secret-derived cache keys. Licensed passage text remains request-scoped, is display-only, and is excluded from AI context. KJV is public-domain and uses a separate source with rights permitting display, caching, and AI context. Other YouVersion adapters remain available for legacy requests but are not offered as active study choices.

API.Bible passage calls request `fums-version=3` and return its FUMS token to the browser. The browser loads the official FUMS v3 tracker, configures the authenticated user ID for hashing by that tracker, and reports the token with `trackView` after the passage is displayed. See [API.Bible Fair Use documentation](https://docs.api.bible/guides/fair-use/).

Operator live check: `node scripts/check-live-bible-study.mjs` retrieves the four adoption passages and runs the example question through the model; it incurs model usage and is excluded from automated tests.

## Study conversation context

Requests may include `conversation`, an array of up to four `{question, answer}` pairs with at most 32,000 total characters. Unknown keys/roles and oversized history are rejected. History is sent as untrusted JSON data under `priorConversation`; it cannot replace the server system instructions or become verified Scripture. The Worker does not persist it. Bible passages are retrieved afresh or from the public-text cache using the selected reference list.
