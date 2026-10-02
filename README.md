# ScriptureSmart

## Deployment status - September 29, 2026

The AI Worker is deployed at https://scripturesmart-ai.jasonw79118.workers.dev. The local `.env.local` now points `VITE_AI_API_BASE_URL` to that Worker. Readiness returned HTTP 200 with `available: true`; anonymous generation returned 401; an unapproved origin returned 403; the local frontend preflight returned 204. A real signed-in inference request is still awaiting user verification. Configuration readiness does not prove model availability. The Appwrite community function deployment status is unchanged.

> **Current development status:** See [HANDOFF.md](HANDOFF.md) for church onboarding, member permissions, group recommendations, and Appwrite deployment status.

**Study deeply. Teach faithfully. Grow together.**

A responsive Bible research and collaboration workspace for individuals, pastors, study leaders, and churches. Appwrite authentication is configured; shared community data requires deployment of the supplied function. ScriptureSmart AI and Bible text retrieval use the existing Cloudflare Worker. Confirm the provider secrets and authorized API.Bible editions in Cloudflare before using licensed translations.

## Run locally

Use Node.js 22.12+ (Node 24 was used for this build) and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173. On Windows PowerShell with script execution disabled, use `npm.cmd` instead of `npm`.

```sh
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run preview
npm test
```

Browser tests use installed Microsoft Edge for desktop and mobile viewport projects. To use Playwright Chromium instead, remove `channel: 'msedge'` in `playwright.config.ts` and run `npx playwright install chromium`. Tests start a local development server automatically.

## Working features

- Responsive sidebar, mobile navigation, and shareable hash routes for all main areas.
- Dashboard with recent drafts, passage entry point, sample group study, local Table activity, and provider status.
- Passage workspace with CSB, NLT, NKJV, and public-domain KJV, translation comparison, source-specific research panels, interpretive approaches, and persistent personal notes.
- Structured sermon and Bible-study editors with editable sections, local autosave, and plain-text export.
- Discussion-guide editor with sermon text input and Opening, Read, Observe, Interpret, Discuss, Apply, and Pray sections. Optional built-in AI generates an editable draft for explicit review and insertion.
- Sample group and local Table: add questions, passages, resources, notes, and sermon excerpts; reply; mark and filter items for group night.
- Library and research search across local drafts and notes, including content-type filters.
- Built-in ScriptureSmart AI for passage study, sermons, Bible studies, and discussion guides; explicit context selection, cancellation, and draft review.
- Optional links to external AI websites and a rights-aware Bible research pipeline.
- Translation preferences, optional theology profile, and JSON workspace export.

Sample drafts and group content are labeled. Retrieved Bible text, word annotations, cross references, commentary, and AI synthesis carry separate source labels. Missing lexical or commentary data is reported instead of invented.

## Bible Research Pipeline

API.Bible discovers the editions authorized for the Cloudflare key through `/v1/bibles`; ScriptureSmart uses it for CSB, NLT, and NKJV. If an edition is not authorized, it is omitted from the available list and its passage request gives a safe access message. Public-domain KJV text comes from bible-api.com and does not use API.Bible. Licensed passage text is retrieved server-side for display and is not sent to Workers AI; public-domain KJV text may be included in study context.

The Free Use Bible API supplies a public-domain BSB comparison passage, OpenBible.info cross references, available commentary chapters, Theographic people/place/event data, and BSB word annotations where a chapter has them. Strong's IDs, lemma, morphology, and word anchors appear only when the endpoint supplies them. The current source does not provide a guaranteed original-script form, transliteration, or English gloss for every annotated word, so ScriptureSmart leaves those fields unavailable. Each provider can fail independently while other returned research remains available.

Bible research is gathered server-side and attached to passage-study answers. Retrieved resources remain separate from ScriptureSmart AI synthesis. Users can compare the selected edition with open BSB wording in the response. Commentary, reference lists, word annotations, and selected translation text are shown as retrieved source material, not AI-authored claims.

API.Bible display requests include its required FUMS v3 token. ScriptureSmart reports the token only after showing that passage. The API.Bible key must be stored as the Cloudflare Worker runtime secret `API_BIBLE_KEY`. A GitHub repository secret is available only to workflows that explicitly map it; the current GitHub Pages workflow does not deploy the Worker and does not forward secrets. See [Worker setup](server/ai/README.md#operator-setup).

## Architecture

React + TypeScript with Vite, plain CSS, Oxlint, Prettier, and Playwright. The frontend uses React and the Appwrite client SDK. The AI Worker uses a Workers AI binding. TypeScript strict mode is enabled.

Vite fits the first milestone: a lightweight, deployable client prototype with no server rendering requirement. Hash navigation works on static hosting without rewrite rules. A future authenticated backend can be added without coupling translations or domain entities to a vendor.

```text
src/
  App.tsx                 Application shell, navigation, workspace state, dashboard
  Screens.tsx             Screen exports
  screens/                Passage, editors, Table, search, connections, settings
  components.tsx          Shared presentation primitives
  App.css / index.css     Responsive visual system
  data/seed.ts            Explicitly labeled sample drafts and Table item
  data/storage.ts         Versioned browser-storage boundary and failure reporting
  data/validation.ts      Validation before loading stored workspace data
  domain/models.ts        Users, churches, memberships, documents, sources, discussions
  domain/providers.ts     Translation catalog and provider/authentication contracts
  domain/ai.ts            AI requests, responses, source context, and safe error types
  ai/                    Provider registry, HTTP adapter, assistant panel and status card
server/
  ai/                     Authenticated Cloudflare Worker, validation, instructions and adapter
  README.md               Trusted backend implementation requirements
  contracts.ts            Server-only credential and authorization contracts
 tests/workspace.spec.ts  Browser workflow and layout checks
```

The UI is deliberately independent of network providers. Scripture adapters resolve a translation through approved provider mappings; there are no active mappings yet. The AI provider registry routes to a trusted HTTP backend; future adapters and credential-vault contracts are retained. Public Appwrite endpoint, project ID, and community function ID are read by the frontend; server secrets are never included.

### Data and privacy

Drafts, notes, Table items, and preferences are stored under versioned `ss.*.v1` keys in this browser's localStorage. Clearing browser data removes them. This is not a backup or an access-control system. Use text export or the JSON workspace export to keep a copy. JSON import is not implemented yet. Avoid sensitive pastoral information until real authentication, encryption, and server-side access controls are available.

The current passage and selected editor section are session UI state. Drafts can be reopened from their list after reload. Shared church/group roles are enforced by the supplied Appwrite function when deployed. The local planning preview is a single-device demonstration, not an access-control boundary.

### Source integrity

The model distinguishes Scripture, original-language data, primary historical sources, commentary, sermons, user notes, and AI synthesis. Future quotation ingestion must require a verifiable citation and exact source text. AI wording must remain synthesis, with citations checked independently. Councils and creeds remain historical sources; modern pastoral/theological voices are not treated as interchangeable verse commentators. Theology preferences must never remove access to other interpretations.

## Environment and integrations

`.env.example` contains backend-only placeholders for existing provider integrations. Never prefix credentials with `VITE_`: those values are embedded in browser bundles. `.env` and `.env.*` are ignored, with `.env.example` explicitly allowed.

Credentials must be accepted only by an authenticated server over TLS, encrypted using a managed key/vault, scoped to the owner, redacted from logs, and never returned to the browser. Stored connection metadata should contain only a vault reference. Do not ask for normal AI or Bible account passwords. Consumer subscriptions do not establish API access.

Planned integrations (availability and licensing must be verified before implementation):

- AI: OpenAI, Anthropic Claude, xAI Grok; later Gemini, Azure OpenAI, Bedrock, Ollama/local models.
- Scripture: API.Bible for CSB, NLT, and NKJV; public-domain KJV source; approved YouVersion developer access; Bible Brain research sources. Translation availability is not assumed.
- Official OAuth/OpenID only where supported; YouVersion highlights only if explicitly supported and user-authorized.
- Church content: YouTube, Google Drive, Dropbox, Planning Center, Church Center, podcast RSS.
- Document/media parsing: DOCX, PDF, audio, video, and YouTube imports.

Built-in AI requests run through the authenticated Worker once configured. No live inference or deployment was performed during implementation; automated tests mock inference.

## Next milestone

Implement the first approved Bible provider, preserving licensing, translation identifiers, attribution, and real source text in AI context. Also complete live deployment verification and durable AI allowances before broader use.

## Repository status at start

The requested local folder was empty: no Git metadata, branch, package, or README. The linked remote returned no refs. This implementation does not create commits or push to GitHub.

## Stack reference

The [official Vite guide](https://vite.dev/guide/) documents setup, supported Node versions, and production builds.

## Church onboarding and group finder

See [HANDOFF.md](HANDOFF.md) for current implementation and deployment status. Members request church membership after sign-in. Church admins approve access and enable modules; group leaders manage discussion, meals, and kids permissions within church limits. The group finder ranks optional family/schedule preferences and can use a consented browser location for a five-mile filter. Private home addresses stay out of directory results.

The Appwrite community function is implemented but not deployed. With its public function ID blank, the site uses a clearly labeled local community preview. Leader contacts and neighborhood coordinates must be confirmed before publishing.

## Mobile and desktop support

Layouts are checked at 320, 390, 768, 820, 1024, and 1440 CSS pixels. Phone navigation supports touch, keyboard focus containment, Escape dismissal, and rotation. Form controls use 16px text on phones, and primary touch controls have a 44px minimum height. Group tabs scroll horizontally when needed.

Run `npm.cmd test -- --workers=1` for desktop and emulated phone checks using installed Microsoft Edge. These checks cover onboarding, group matching, meals, attendance, discussion, and study tools. They do not substitute for testing on physical iOS/Android devices or prove Firefox/Safari compatibility.

For a phone on the same trusted Wi-Fi network, run `npm.cmd run dev -- --host 0.0.0.0` and open the computer's LAN address and printed port on the phone. `localhost` on a phone refers to the phone itself. Browser location access needs a secure HTTPS origin on real phones; use HTTPS hosting for shared use. Appwrite must allow the deployed hostname, and the community function must be deployed for shared persistence. This session has not published the site to the public internet.

## Optional AI websites with existing subscriptions

Connections now opens ChatGPT, Claude, or Grok in a separate tab. Members sign in directly with the provider and use their existing account and plan. ScriptureSmart does not request AI passwords or API keys, detect provider login status, send prompts automatically, or import answers. Members can edit and copy the starter study prompt, paste it into their preferred service, and manually bring useful answers back into their notes. The prompt is not persisted. Clipboard failures show instructions for manual copying. Bible-provider integrations remain separately planned.

## ScriptureSmart AI

**ScriptureSmart AI** is the built-in default assistant. Members sign in to ScriptureSmart; they do not need a paid external AI subscription or API credentials. The site operator must configure and deploy the Cloudflare Worker before live generation is available. The Connections card checks service readiness and reports unavailable service honestly instead of simulating a connection. Settings selects ScriptureSmart AI by default; unconfigured external providers cannot be selected for built-in generation.

### How it works

The passage workspace and sermon, Bible-study, and discussion-guide editors use a reusable assistant panel. Requests go through a generic provider registry and HTTP adapter to an authenticated Cloudflare Worker, which invokes Workers AI through an `AI` binding. The configurable default model is `@cf/google/gemma-4-26b-a4b-it`. An optional fallback can be configured; it is disabled initially. Model details appear only in advanced response information.

Only the prompt, visible passage/translation references, and explicitly selected context are sent. Notes and manuscript sections are unchecked by default and can be previewed before sending. No entire workspace, church discussion, or private-note collection is automatically included. AI responses appear as editable synthesis drafts. Insert appends content; Replace selected section requires confirmation. Guide generation validates and returns Opening, Read, Observe, Interpret, Discuss, Apply, and Pray. Existing content stays intact until the user acts.

The server instruction layer distinguishes Scripture, original-language information, historical sources, commentary, sermons, notes, and AI synthesis. It prohibits invented quotations and retrieval claims, identifies translation boundaries, acknowledges missing sources, and asks for meaningful interpretive differences. These instructions do not guarantee accuracy: review generated material before using it. WEB Bible retrieval is connected in passage study. Commentary retrieval and automatic verification of generated citations are not connected. Supplied source claims are treated as unverified.

### Local Worker setup

See [the complete Worker setup guide](server/ai/README.md) for authentication, bindings, limits, manual deployment, and production routing.

```powershell
npm.cmd install
npx wrangler login
# Terminal 1: uses the remote Workers AI binding; submitted requests may incur charges.
npm.cmd run dev:worker
# Terminal 2: Vite proxies /api/ai to the Worker on port 8787.
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Use a verified Appwrite account to sign in. The configured Appwrite project must allow the frontend hostname. The Worker must allow the frontend origin in `ALLOWED_ORIGINS`. Leave the public `VITE_AI_API_BASE_URL` blank for local Vite proxying; use the public HTTPS Worker origin when deploying a separate frontend.

Cloudflare secrets never go in `VITE_*`, frontend code, browser storage, or committed files. The Worker binding supplies inference access; Wrangler authentication stays outside app source. Requests use short-lived, user-scoped Appwrite JWTs, verified on the server. No privileged Cloudflare or Appwrite key is sent to the browser. Rate limits, bounded payloads/output, timeouts, and sanitized errors protect the endpoint. Rate-limit bindings are approximate abuse controls, not a billing system.

### Checks and current limits

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run test:domain
npm.cmd run build
npm.cmd run build:worker  # Local dry-run bundle only; does not deploy.
npm.cmd test -- --workers=1
```

Automated tests mock Appwrite verification and AI inference. The Worker is deployed, and operator live checks have exercised model inference and WEB retrieval. Browser checks use Edge desktop and phone emulation, not physical Safari/Firefox devices. Cancellation stops waiting and prevents late insertion but may not cancel already-running provider work. The next AI milestones are broader topical passage discovery, durable user/church allowances, and licensed commentary retrieval.

## Cross-passage Bible study

In Study, open Ask ScriptureSmart and enter a question in ordinary language. Bible retrieval is enabled there with a visible, editable passage list. The adoption example suggests Ephesians 1:3-14, Romans 8:14-30, Romans 9:1-5, and Galatians 4:1-7. This is a curated topic connection, not an exhaustive semantic Bible search. Other questions use full book/chapter references in the prompt, or the current passage; users can enter up to six references separated by semicolons.

The authenticated Worker retrieves actual World English Bible (WEB) text from the fixed bible-api.com endpoint. It sends only references to that provider, never the question, JWT, notes, or church data. WEB is explicitly identified even when another translation is selected in the workspace. Other translation display and commentary/lexicon retrieval remain unconnected.

Responses include expandable source passages with verse numbers and links. AI comparisons distinguish direct textual evidence, interpretive summaries, and unresolved questions. For adoption and predestination, the prompt asks for fair treatment of Reformed, Arminian/Wesleyan, and corporate-election readings. These are AI summaries, not retrieved scholarly commentary. Source retrieval does not verify every generated claim; review answers against the shown text.

Retrieval fails closed on unavailable, malformed, mismatched, or partial verse-range responses. Redirects are not followed. Public text has a bounded 128-entry, 24-hour isolate-local cache. Provider requests share a 12-second deadline; total retrieved text is limited to 32,000 characters. The public service has rate limits and no uptime guarantee; production growth should use a hosted licensed/public-domain corpus with durable caching.

Sources: [Bible API documentation](https://bible-api.com/) and [WEB public-domain permissions](https://ebible.org/engwebp/copyright.htm).

## Study follow-up questions

After an answer, use **Ask a follow-up** below the editable draft. It sends the latest question with up to four prior exchanges (32,000 characters total), including edits to the current answer, plus the currently selected context and Bible passage list. Earlier answers remain unverified AI synthesis. The Worker validates history as data and never accepts system roles or source verification from it.

Failed or cancelled follow-ups keep the prior draft and question available for retry. **Start new conversation** clears this conversation without deleting saved notes. Conversations live only in the current Study view; navigating away, changing the passage/translation, or refreshing clears them. Save important answers to notes before leaving. Earlier exchanges can be expanded for review; older exchanges beyond the request limit remain visible but are not sent to the model.
