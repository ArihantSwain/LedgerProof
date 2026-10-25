# Service-by-service implementation register

As of October 24, 2026. WORKING_LOCAL refers to observed local execution; it is not a sponsor integration status. UNTESTED means no successful provider execution, not implicit approval to claim a track. No paid account or subscription was created.

## Runtime and infrastructure

| Service/component | Goal | What I implemented | Evidence/status | Next gate |
| --- | --- | --- | --- | --- |
| Next.js | Serve UI and secret-bearing API from one app | App Router page and scoped Node routes, same-origin mutations, private responses | WORKING_LOCAL; production build and browser tests | Choose hosting account/region, configure environment, authorize public deployment |
| React | Interactive judge flow | Four sections, source drawer, review reason, chart/cash bridge, scenario controls, sharing/reset | WORKING_LOCAL; desktop/mobile browser checks | Accessibility audit and real-user usability sessions |
| Convex | Central hosted persistence and atomic state transitions | Cases schema/indexes, guarded read/create/apply functions, file upload/read integration | BLOCKED; source typechecked, no deployment | Account project, URL and backend secret; deploy and verify transactions/storage |
| Convex live queries | Push case changes to collaborators | Not yet implemented; UI currently polls scoped HTTP state | NOT IMPLEMENTED; shared local polling is tested | Native subscription with real auth; two-session/reconnect proof |
| Convex Workflow | Durable scheduled execution and retries | Not installed/configured | NOT IMPLEMENTED | Add component only after runtime contract/account verification; never retry ambiguous non-idempotent submission |
| Local filesystem | Offline persistence while accounts are unavailable | Ignored .data JSON/originals, token hashes, single-process queue, atomic rename | WORKING_LOCAL; competing decisions and wrong-token tests | Keep a rehearsal tool; do not scale to multiple workers |
| Identity/session layer | Scope judge access without signup | Random bearer capability, HttpOnly cookie, share-link exchange, 24-hour access expiration | WORKING_LOCAL; isolation/share/reset tests | Production membership, role policy, revocation and retention cleanup |

## Core investigation and evidence

| Service/component | Goal | What I implemented | Evidence/status | Next gate |
| --- | --- | --- | --- | --- |
| CREAO | Core evidence investigation and evidence-bound challenges | Hosted-agent instructions, complete bundle, explicit developer-v2 or agent-v1 adapter, status retrieval, result validation | BLOCKED live; mock contract tests only | Create/save hosted agent, confirm account/API family and form fields, run changed evidence, retain ID/share link |
| Local investigation rules | Exercise review/forecast offline | Deterministic duplicate, partial, unmatched-receipt and credit rules | SIMULATED relative to hosted agent; local counts measured | Never use as CREAO submission proof |
| Anthropic/Claude | Meaningful extraction or reasoning with traceable model | No direct SDK call; possible account-supported selection inside CREAO | BLOCKED; no model trace | Verify model selection/output and evaluate actual benefit; only add direct extraction if necessary |
| Zod | Reject malformed data and unsupported output | Contracts shared by provider, state machine, parsers and store | WORKING_LOCAL; invalid enum/citation/version tests | Version migrations and explicit return schemas for expanded APIs |
| unpdf | Extract text from supported source PDFs | Signature/page/size checks, text extraction, resource cleanup | WORKING_LOCAL; generated PDF parser test | Process-isolated parsing, time/memory budgets, OCR gate for scans |
| pdf-lib | Produce internally consistent source fixtures | Invoice/credit PDFs generated from fixture definition; editable credit control | WORKING_LOCAL | Separate customer case-report PDF with proper metadata and disclosure |
| Finance engine | Reliable cash and posting calculations | Integer-cent outstanding balance, narrow entries, dated 13-week forecast, baseline/revised/preview | WORKING_LOCAL; exact cash/edge-case tests | General trial-balance/import support and accountant validation |

CREAO owns interpretation; the finance engine owns amounts; the reviewer owns approval. Convex owns persistence when configured. The UI owns presentation. Maintaining those boundaries prevents an agent's plausible explanation from becoming an unauthorized accounting fact.

## Conditional and adjacent providers

| Provider | Potential job | What actually exists | Status | Fit/activation condition |
| --- | --- | --- | --- | --- |
| CRS | Supported identity discrepancy investigation or a transparent collection scenario | No adapter/request/response | UNTESTED | Inspect sandbox catalog, provided identity type, and actual fields. No fictional business credit inference from consumer data |
| Coinbase for Agents + x402 | Buyer agent purchases a bounded completed report from seller | Explicit unavailable commerce route; challenge reviewed | UNTESTED | Verify supported test tooling, buyer budget, payment validation, one receipt, recoverable delivery; separate from agency forecast |
| Bright Data | Essential current public counterparty evidence | No scraping code | NOT_TARGETED | Core must truly depend on permitted live public data; synthetic-ledger-only story does not satisfy that requirement |
| Factory Droid SDK | Independent reconciliation regression/evidence-pack worker | No SDK call | NOT_TARGETED currently; new conditional path | Meaningful runtime trigger/output with bounded access, after core works; developer use alone is insufficient |
| Fetch.ai | Discoverable bounded analysis agent for other agents | No agent registration or SDK | NOT_TARGETED currently; new conditional path | Genuine agent-to-agent request/result flow plus verified challenge rules |
| Figma | Real design iteration and traceable workflow | No Figma files, Make prototype, or Slides | NOT_TARGETED currently; full criteria retrieved | Actual intentional Figma use, accessible artifacts, required slides/stage log/embedded prototype, Edu verification |
| Microsoft | Production-minded agent evaluation track | Architecture, controls and roadmap documents | Eligibility UNTESTED; not an API integration | Actual end-to-end agent, measurable usefulness and customer evidence; Azure not inferred as required |
| Hyphenate | Controller-seat judging lens | Reviewable receivables workflow, honest failure modes and demo script | Eligibility UNTESTED | Real CREAO-powered flow and defensible evidence, plus event rules |
| SpacetimeDB | Alternative central shared state | No implementation | NOT_TARGETED | Only reconsider as an intentional Convex replacement, never a duplicate sponsor database |

Additional guide sponsors are assessed in EVENT-STRATEGY.md. None has been added as a superficial dependency.

## Engineering services and developer tools

GitHub repository: cloned from ArihantSwain/LedgerProof. Local source is the reviewable deliverable; no external repository publication is assumed. Git records and development provenance should remain honest about implementation dates and tool use.

Node/npm: dependency installation and lockfile; build toolchain. Playwright: actual headless Chromium checks and documentation rendering. Node test runner/tsx: finance, store, parser, and provider-contract tests. Python standard library: reproducible vector diagram generation. No Figma use is implied by hand-built SVG diagrams, and no sponsor SDK use is implied by generic tooling.

Google Drive connector: read the Coinbase challenge and Figma brief linked in the supplied guide. This was **research during development**, not a runtime LedgerProof data integration. No Drive files were edited, shared, or sent. Browser/search reads were used for public technical/event verification. They are not evidence of Bright Data, Apify, or a connected runtime web-research feature.

## Secrets, cost, and failure ownership

CREAO_API_KEY, selected API family/base, agent ID, and actual input field belong on the server. Convex URL and backend secret are required together; the same secret must be configured in the backend environment. No key is present in .env.local because that file does not exist yet. A configured key does not change integration status to LIVE_VERIFIED automatically.

Every hosted provider call may consume credits or create an external effect. No paid subscriptions or real-money transfers have been initiated. Future cost controls should bound runs per case, bundle size, retries, concurrency, extraction pages, storage retention, and report generation. Cost targets must be measured from real provider receipts; there is no verified per-case cost today.
