# ScriptureSmart handoff

## Deployment status - September 29, 2026

The AI Worker is deployed at https://scripturesmart-ai.jasonw79118.workers.dev. The local `.env.local` now points `VITE_AI_API_BASE_URL` to that Worker. Readiness returned HTTP 200 with `available: true`; anonymous generation returned 401; an unapproved origin returned 403; the local frontend preflight returned 204. A real signed-in inference request is still awaiting user verification. Configuration readiness does not prove model availability. The Appwrite community function deployment status is unchanged.

## Current implementation

React/TypeScript/Vite app in `C:\Users\jason\ScriptureSmart`. Appwrite is the selected backend. No Git repository or deployment was created in this session.

- Church identity and custom terminology; Redeemer Christian Church uses Gospel Community Groups. Its community screens take light visual cues from the church website's charcoal, white space, and bold headings.
- Email OTP sign-in redirects to church onboarding. A verified member searches for a church and requests membership; church administrators approve requests and select enabled modules. A trusted group invitation can establish approved church membership.
- Church administrators control member access. Group leaders control discussion, meals, and kids capabilities within those church limits. The function filters reads and validates writes. Personal study drafts still live locally; their navigation controls do not turn localStorage into secure shared storage.
- Group finder asks optional household stage, children, and meeting day. Explicit browser geolocation can filter within five straight-line miles of a published neighborhood point. Answers and location are not saved. Unknown coordinates never produce guessed distances.
- Leaders publish directory listings and consented contact details/preferred method. Unjoined church members see sanitized listings, not group addresses or discussions.
- Existing gatherings, attendance, discussion/replies, kids ideas, meal suggestions, dish assignments, and consented dietary disclosures remain implemented.

## Confirmed seed

Redeemer Christian Church, Amarillo TX. Williams Group: Jason Williams leads; Jason and Ryanne Williams host; Sundays at 4 p.m.; families with children 0�14. The confirmed home address is in the development seed only and is excluded from the group finder. Production bundles do not seed the private address.

Jason's contact email, phone, preferred contact method, and approximate neighborhood coordinates have not been provided. Leave these blank until confirmed; set them under Groups ? Group details ? Help people find this group.

## Appwrite status and remaining work

Public configuration: endpoint `https://nyc.cloud.appwrite.io/v1`, project `6abacdae000fc71c85c8`. `VITE_APPWRITE_COMMUNITY_FUNCTION_ID` remains blank. Community data is currently a clearly marked local planning preview. Real email delivery, shared persistence, cross-device behavior, and transactional concurrency have not been verified against Appwrite.

Deploy `server/community` with entrypoint `main.mjs` and install command `npm ci`. Run `setup.mjs` with appropriately scoped server credentials available through environment variables to create the TablesDB schema. Configure function execution for authenticated users, required database/transaction scopes, endpoint/project runtime variables, and web platform hostnames. Then set the public function ID and rebuild. Never place a server key in `VITE_*` or chat.

After deployment verify two real accounts: church approval, invitation, capability revocation, cross-church isolation, meal concurrency, and dietary visibility. Church search currently scans at most 500 workspace rows and returns 20 matches; introduce an indexed directory before wider rollout. One state row per church also needs scale review before large churches use it.

## Verification

Domain tests cover authorization, invitations, disclosure consent, pending/suspended church membership, capability overrides, directory privacy, matching and distance calculations. Browser tests cover desktop/mobile workflows using intercepted authentication responses; they do not prove real email or backend deployment. See the latest run summary in the task response.

Playwright uses a fresh server on port 5180 with one worker recommended for this Windows environment. Port conflicts now fail clearly instead of silently reusing a stale server. Ordinary development can use port 5173 or a free port.

```powershell
npm.cmd run dev -- --host 127.0.0.1
npm.cmd run build
npm.cmd run lint
npm.cmd run test:domain
npm.cmd test -- --workers=1
```

## Main files

- `src/community/Onboarding.tsx`, `AccessControls.tsx`, `GroupFinder.tsx`, `DirectoryEditor.tsx`, `matching.ts`
- `src/community/CommunityContext.tsx`, `models.ts`, `GroupsPage.tsx`
- `server/community/policy.mjs`: shared pure policy helpers, no secrets
- `server/community/domain.mjs`: trusted validation and state transitions
- `server/community/main.mjs`: authenticated Appwrite function
- `tests/community.test.mjs`, `matching.test.mjs`, `community.spec.ts`, `finder.spec.ts`

### Latest verification (2026-09-28)

Production build and lint pass; all 16 domain tests pass. All 12 existing workspace browser cases passed, and the 6 community plus 4 new finder/onboarding cases passed across focused reruns on desktop and mobile. Browser authentication was mocked. Windows Playwright web-server teardown remained running after cases completed and was stopped manually; a clean full-suite process exit is still unverified. Desktop finder and mobile group screens were visually reviewed. The local dev preview is running at http://127.0.0.1:5181/.

## Mobile/desktop follow-up (2026-09-29)

Added accessible mobile drawer focus handling, Escape dismissal, hidden-drawer inertness, rotation handling, scroll locking, touch target sizing, and 16px mobile form inputs. Added `tests/responsive.spec.ts` covering nine routes across six widths plus narrow-phone group forms and navigation. All 28 Edge desktop/emulated-mobile browser assertions passed; production build passed. Firefox/WebKit installation did not complete, so those engines and physical devices remain unverified. The Windows test-runner teardown issue remains separate from passing assertions. No public internet deployment was performed.

## AI account decision (2026-09-29)

The user chose existing subscriptions on provider websites, not member API setup. `src/screens/Connections.tsx` now provides external ChatGPT/Claude/Grok links plus an editable, copyable study prompt with a manual-copy fallback. No AI API credentials, OAuth connection, automatic sharing, or response sync is implemented or implied. Bible connection placeholders remain separate. Focused checks are in `tests/connections.spec.ts`.

AI follow-up validation: production build and lint passed. All four focused desktop/mobile assertions passed after changing the prompt-field test to use its accessible textbox role. Initial attempts timed out locating the implicitly labeled textarea. Windows test-runner teardown was stopped after the passing cases; clean process exit remains unverified.

## Built-in AI implementation

ScriptureSmart AI now supports passage notes, sermons, Bible studies, and seven-section discussion guides. Context is selected explicitly; responses are editable and insertion is a separate action. External AI website links remain available.

The authenticated Cloudflare Worker uses the configurable default model `@cf/google/gemma-4-26b-a4b-it`. Appwrite JWT verification, payload bounds, approximate rate limits, timeouts, and source-integrity instructions are implemented. No live inference or deployment has been performed. Bible retrieval and durable user budgets remain future work. See [Worker setup](server/ai/README.md).

Latest verification: all 28 domain tests and all 42 desktop/mobile browser cases passed. Type checking, lint, formatting, and production build passed; Worker dry-run bundling passed. The Windows browser runner stalled during teardown after all cases passed and was interrupted. No live model requests or deployment were performed. Desktop and mobile guide screenshots were reviewed. Local preview was verified with HTTP 200 at http://127.0.0.1:5173.

## AI sign-in status correction

The AI status card now follows the real Appwrite session instead of always showing Sign in to ask. AI errors only offer Member sign-in for authentication or verification errors. JWT creation and Worker account verification distinguish account-service failures from expired sessions. Authentication checks remain enforced.

Live Cloudflare inference succeeded both directly and through the application's model adapter using a generic diagnostic question. The user's reported signed-in failure still needs a reproduction with the exact error and frontend origin. Operator diagnostic: `node scripts/check-live-ai.mjs` (uses Wrangler login and incurs live model usage; not part of automated tests).

## September 30: account verification failure resolved

Root cause: the deployed Workers runtime rejected `redirect: 'error'` with an Invalid redirect value exception before contacting Appwrite. Reproduced in workerd. The Worker now uses `redirect: 'manual'` and rejects non-success responses, preventing JWT forwarding to redirect destinations. The fetch receiver is also explicitly bound. Safe diagnostics report only failure categories/status codes.

Deployed version: `95ca3d75-8392-4963-ac15-9306e601fce7`. Live invalid-token probe changed from 503 auth-unavailable to the expected 401 sign-in, verifying the Appwrite request now executes. Type checking and all 31 domain tests passed, including redirect rejection and fetch receiver regression checks. A real signed-in user retry is still needed to confirm the complete browser flow.

## September 30: AI response timeout

The model deadline is now 120 seconds, with a 150-second browser deadline to allow for authentication and transport. Interactive Gemma requests explicitly use `chat_template_kwargs.enable_thinking: false`; other models retain their own settings. No automatic timeout retry or duplicate inference was added. Output caps, cancellation, and source-integrity instructions remain in force.

A live request through the application adapter explaining John 1 and producing three discussion questions completed in 9.47 seconds. This is a measured test, not a latency guarantee for every request. All 33 domain tests, production build/type checking, and lint passed. Regression tests cover successful completion beyond 45 seconds and the bounded 120-second timeout.

## September 30: sourced cross-passage study deployed

Study's assistant now retrieves WEB Bible text from a visible editable list (up to six passages). The user's adoption question suggests Ephesians 1:3-14, Romans 8:14-30, Romans 9:1-5, and Galatians 4:1-7. Other topics use named references/current passage; exhaustive topic search and commentary retrieval remain future work. Replies include expandable verse text, translation labels, and fixed-provider source links. The Worker authenticates before retrieval and refuses generation on failed/partial/mismatched retrieval.

Deployed Worker version: `a7b1a05a-896d-487c-9244-470b4908690f`. The exact adoption question retrieved all four passages and produced an answer in 19.8 seconds of model time in the operator live check. All 37 domain tests and 14 desktop/mobile AI browser cases passed after correcting en-dash reference handling. Build/type checking, lint, and formatting passed. Mobile source display reviewed; local preview returned HTTP 200. Browser runner teardown was interrupted after the cases passed. See README Cross-passage Bible study for limits and provider licensing.

## Study follow-up conversations

The Study assistant now offers Ask a follow-up below its response, expandable earlier exchanges, and Start new conversation. Follow-ups include the current edited answer, recent conversation (up to four exchanges / 32,000 characters), current selected context, and the retained editable Bible-reference list. Failed or cancelled follow-ups preserve the draft and question. New conversation clears session context while saved notes remain intact. History lives only in the current view and is not persisted to the Worker or localStorage.

The server validates bounded question/answer pairs as untrusted conversation data. Previous AI answers never become verified Scripture or system messages. All 38 domain tests and all 16 desktop/mobile AI browser cases passed; production build/type checking and lint passed. Browser test teardown was stopped after all passing cases.
