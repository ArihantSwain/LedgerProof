# How LedgerProof works

## The problem and intended user

A bookkeeper or fractional CFO serving a small creative agency wants to know whether payroll is covered. A spreadsheet can forecast a collection that is overstated, already partly paid, duplicated in the books, or subject to an unapplied issued credit. LedgerProof investigates those source facts and shows the consequence of a reviewed correction. It does not certify accounts, predict defaults, move funds, or automatically change an external accounting system.

The initial named community is independent bookkeepers and fractional CFOs serving small creative agencies. This is a product hypothesis, not validated customer research. No interviews or traction are claimed.

## The complete user journey

1. **Start a workspace.** The server creates a random case ID and a high-entropy session token. The browser receives an HttpOnly, same-site cookie; the store retains a hash of the token. Workspaces expire after 24 hours and use synthetic records. Anyone given a workspace share link can review that case; this is a collaboration capability, not a production permission hierarchy.
2. **Inspect the original baseline.** The deterministic engine computes 13 explicit weeks from imported invoices, historical receipt allocations, opening cash, and dated obligations. Source dates and cents are authoritative; no language model calculates cash.
3. **Add evidence.** A bounded text-based credit-note PDF or one-row receipt CSV is parsed. The server checks the schema, invoice reference, amount, currency, document hash, size, and page limits. It stores the original and extracted text, increments the input version, and invalidates pending findings based on older evidence.
4. **Investigate.** The intended investigator is the hosted CREAO agent. The backend passes a complete versioned bundle of records and evidence. The agent identifies discrepancies, cites IDs, requests missing information, and returns findings. The app exposes no approval or posting tool to it. While credentials are unavailable, the user may explicitly choose local deterministic rehearsal. That branch is labeled and is not CREAO evidence.
5. **Validate the result.** Runtime schemas reject unexpected types, stale versions, unknown evidence, and record IDs outside the current case. Provider status/result IDs must match the stored provider run. Complete JSON output is required; prose is not silently interpreted as financial authority.
6. **Construct a correction proposal.** A supported credit-note finding can create a proposed debit to sales returns and credit to receivables. Receipt and duplicate findings use similarly narrow transaction templates. Source amounts are recalculated from normalized records; the agent cannot manufacture a numerical impact. Duplicate proposals reverse a source entry and preserve the original.
7. **Review the evidence.** The reviewer opens extracted text and the original PDF or CSV. Preview cash is labeled unapproved. The reviewer enters a reason and approves or rejects a specific proposal against the expected ledger version.
8. **Post atomically.** The state transition checks the version and idempotency key, validates balanced permitted accounts, updates the matching source status, writes the journal entry, records the decision, and appends an application event. In Convex this is intended to execute in a database transaction. In local rehearsal a single-process queue serializes file writes. Repeated or competing decisions cannot post the same correction twice in the tested local store.
9. **Change a scenario.** The reviewer may move an expected collection date. This changes cash timing without reversing revenue. An explicit reduced collection assumption is possible through the scoped API; it is a scenario, not a write-off or calibrated prediction.
10. **Explain and export.** The cash bridge lists a selected week's opening cash, receipts, obligations, and closing cash. The report export includes forecast, findings, run modes/references, and review events. JSON export is implemented; a customer-facing financial report PDF/XLSX is future work. The briefing PDF documents the product and is not a case accounting report.

## The exact demonstration math

| State | Week 1 | Week 2 | Week 3 |
| --- | --- | --- | --- |
| Original baseline | $20,000 opening + $20,000 invoice − $12,000 payroll = $28,000 | $28,000 − $12,000 payroll = $16,000 | $16,000 |
| Approved $8,000 credit | $20,000 + $12,000 receivable − $12,000 payroll = $20,000 | $20,000 − $12,000 payroll = $8,000 | $8,000 |
| Collection moves to week 3 | $20,000 − $12,000 payroll = $8,000 | $8,000 − $12,000 payroll = −$4,000 | −$4,000 + $12,000 receipt = $8,000 |

Other unpaid example balances collect outside the forecast horizon. Later studio/software obligations are displayed in their real weeks. A deliberate duplicate ledger posting is represented separately from normalized invoices, so it does not cause the forecast to collect a second invoice. This is an intentional distinction between a messy source ledger and economic invoice identity.

Week boundaries are local date-only values, start-inclusive and end-exclusive. Calendar arithmetic avoids DST-hour errors. The shortfall indicator tests closing weekly cash below zero; it is not a guarantee that cash stays positive every day within the week. New matched receipts respect their transaction dates. New pre-horizon receipts explicitly reconcile opening cash; future receipts do not silently increase it.

## Why three views of cash exist

**Baseline** preserves original imported collection assumptions and excludes newly approved credit corrections and scenarios. **Revised** reflects approved corrections and selected explicit scenario assumptions. **Preview** shows the effect of pending supported credits and remains separate from posted history. Each correction must pass review before it enters revised cash.

The model records historical invoice/receipt facts separately from collection assumptions. A credit changes the collectible invoice amount and the ledger after approval. A payment delay changes a forecast assumption only. A credit score or risk signal, if ever integrated legitimately, cannot automatically establish a write-off.

## What each technical layer does

| Layer | Goal | Actual implementation | Why the boundary matters |
| --- | --- | --- | --- |
| React interface | Make sources, review, and cash understandable | app/page.tsx, app/globals.css | Model findings do not bypass reviewer actions |
| Next.js server routes | Authenticate workspace, validate requests, keep secrets server-side | app/api/[...path]/route.ts | Browser never calls a sponsor with a secret |
| Runtime contracts | Validate uploaded, stored, and provider data | lib/contracts/index.ts | An apparently plausible JSON result is not automatically trusted |
| Document extraction | Convert supported sources to explicit facts | lib/documents.ts, unpdf, pdf-lib | Extraction coordinates are not invented; scans are rejected |
| Finance engine | Compute balances, allowed journal entries, forecast buckets | lib/finance/index.ts | Money stays integer cents, independent of an LLM |
| Transition engine | Enforce approvals, versioning, idempotency, reset behavior | lib/workflow.ts | One coherent mutation controls posting and decisions |
| Store | Persist scoped state and originals | lib/store.ts, convex/cases.ts | Local files are not mislabeled as Convex |
| Investigator | Interpret evidence and choose discrepancy findings | lib/providers/creao.ts | CREAO is substantive when verified; local rehearsal is separately labeled |
| Evidence/register docs | Tie claims to working execution and source requirements | docs/integration-status.md, SPONSOR-EVIDENCE.md | Configured code is not a successful integration |

See SERVICE-REGISTER.md for every provider, including services not yet integrated.

## State, ownership, and failure behavior

The current bounded workspace is one aggregate with nested typed entities. It contains business, invoices, receipt allocations, credits, sources, obligations, entries, scenarios, runs, findings, proposals, decisions, and events. Convex indexes locate the case and expiry. This makes approval atomicity easy to reason about for a small judge case. It is not a claim that the normalized schema in the full specification has been completed.

Evidence changes increment inputVersion. Approval increments ledgerVersion. Every mutation increments a workspace revision. Reset increments a generation. A result from an old generation is ignored; a result from old evidence is stale. A second reviewer must act against the same expected ledger version, preventing a decision based on obsolete balances.

Submission intent becomes unknown before calling CREAO. If the request times out before a provider run ID is safely saved, the application does not blindly submit another run. Account reconciliation is needed. If a run ID is saved, retrieval can resume against that same ID. Retrieval outages are retryable; malformed terminal results become needs_review. No webhook is enabled. Scheduled polling and bounded model-output repair remain unfinished; the present browser/API polling drives retrieval.

The agent instructions exclude document-borne commands. The code escapes source text and accepts only supported structured fields. Offline prompt-injection tests confirm that uploaded text cannot itself authorize posting; they do not establish that an untested hosted LLM will resist all injection attacks.

## What has and has not been proved

Local tests cover exact forecast values, partial receipts, excess-credit exceptions, journal balance/account checks, competing decisions, session capabilities, reset/stale handling, actual PDF/CSV parsing, and provider-contract mocks. Browser tests exercise the full local review path, shared polling updates, unavailable CREAO, timeout rehearsal, and mobile layout. See EVALUATION.md for current counts.

Live verified: hosted CREAO investigations, Claude accounting reviews, deployed Convex transactions and subscriptions, official CRS sandbox reports, Coinbase API/wallet authentication, and an unpaid Exa x402 quote. The public demo is https://ledgerproof-one.vercel.app. See [integration status](integration-status.md) for the execution evidence. A real paid Exa delivery, Convex workflow components, customer value, sponsor eligibility, production security and accounting completeness remain unproved. No external accounting system has been altered.
