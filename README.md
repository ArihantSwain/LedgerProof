# LedgerProof

Verify the invoices behind a small agency's cash forecast, review evidence-backed corrections, and see whether payroll is covered. Built for bookkeepers, fractional CFOs, and service-business owners. This is accounting investigation and decision support, not a certified audit.

**Readiness: tested local rehearsal; mandatory CREAO hosted execution BLOCKED. No sponsor integration is LIVE_VERIFIED. No hosted URL or public deployment.**

## Local setup

Node 22+, npm. Clone https://github.com/ArihantSwain/LedgerProof.

```sh
npm ci
cp .env.example .env.local
npm run fixtures
npm run dev
```

Open http://localhost:3000. Start demo creates an isolated 24-hour synthetic workspace; Reset my demo affects only that workspace. Share workspace creates a bearer-capability link; anyone with the link can review that synthetic workspace. Local rehearsal persists under ignored `.data/`, with serialization within a single Node process and atomic file replacement. It is deliberately not a multi-process production database. Use Convex for hosted operation. Production fails closed without Convex unless LEDGERPROOF_ALLOW_LOCAL=true is explicitly set for a single-process rehearsal.

The UI labels offline investigation **LOCAL REHEARSAL**. It runs deterministic rules; it is never represented as CREAO. To exercise the full local flow, upload a credit, open Investigation activity, check local rehearsal, run, inspect and approve the credit, then move collection to week 3.

## CREAO account setup

Follow [the complete agent setup](docs/CREAO-AGENT.md). Create/save the hosted investigator, confirm its actual API family (`developer-v2` or `agent-v1`), configure the matching base/key/agent ID and actual form field in `.env.local`, and verify that account contract before setting CREAO_CONTRACT_VERIFIED=true. Both explicit adapters use server-side Bearer authentication and authenticated retrieval; they never automatically fall back across API families. Contract mocks pass, but real account/output execution remains blocked. Browser receives no API keys.

```sh
node --env-file=.env.local --import tsx scripts/smoke-creao.ts
```

This opt-in command executes real provider calls and may consume provider credits; run only with a suitable authorized account. Retain real run IDs and share links. None are currently available. Never put secrets in commits or chat.

## Convex setup

```sh
npx convex dev
```

Complete account/project selection. Set server-only CONVEX_URL in `.env.local`. Generate a random LEDGERPROOF_BACKEND_SECRET, set it in `.env.local` and the Convex deployment environment. Functions require this secret plus a hashed session token; all browser operations go through scoped server routes. Deploy only after authorization. Core workspace aggregates use Convex transactions for compare-and-set decisions, durable provider IDs, and document storage; see [architecture](docs/ARCHITECTURE.md). Convex runtime behavior has not been verified. UI currently polls scoped state rather than using a native browser subscription. Workflow component not integrated.

## Formats

Generated originals and templates are under public/fixtures. Ten invoice PDFs, issued credit PDF, ledger, bank CSV, and obligations CSV come from fixtures/agency.ts. This MVP starts from that fixed chart of accounts and synthetic imported ledger. Arbitrary opening-trial-balance, invoice, ledger, and obligations uploads are **not implemented**.

Supported runtime uploads: UTF-8 single-receipt bank CSV, or text-based issued credit-note PDF (≤1 MB, ≤5 pages). No OCR. PDF fields must each be on their own line:

```text
Type: credit_note
Invoice: INV-A
Currency: USD
AmountCents: 800000
Date: 2026-10-26
```

```csv
externalId,invoiceNumber,postedDate,amountCents
new-receipt-001,INV-003,2026-10-26,50000
```

Unknown invoice numbers, duplicate hashes/external IDs, unsupported currencies, oversized documents, and overpayment/credit amounts are rejected. Unsupported scans need manual review. Source text is escaped; no source instructions are executed. Parser is bounded but not process-isolated: add parser sandboxing before accepting untrusted production documents.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests require a prior build and Playwright Chromium (`npx playwright install chromium --only-shell`). Offline tests do not prove hosted provider execution. Verified: 20 unit/backend/provider-contract tests, 3 browser tests, typecheck, and production build. Results and limits: [evaluation](docs/EVALUATION.md). Judge walkthrough: [demo](docs/DEMO.md). Reproduce the small declared rule evaluation with `node --import tsx scripts/evaluate.ts`.

## Provider status

| Provider | Status |
| --- | --- |
| CREAO | BLOCKED: account credentials, hosted agent, real run/share link missing |
| Convex | BLOCKED: backend prepared; deployment and runtime tests missing |
| Anthropic | BLOCKED: actual Claude use not traced |
| CRS | UNTESTED: no catalog or test identity; capability gate unopened |
| Coinbase | UNTESTED: purchase workflow unimplemented; no x402 or settlement claim |
| Bright Data / Spacetime / Figma | NOT_TARGETED |

See [integration status](docs/integration-status.md), [sponsor evidence](docs/SPONSOR-EVIDENCE.md), [submission draft](docs/SUBMISSION.md), and the preserved [build specification](docs/BUILD-SPECIFICATION.md).

Limitations: no real user interviews, hosted readiness, live CREAO verification, direct Claude extraction, arbitrary import pipeline, native Convex subscription, signed callbacks, automated malformed-result repair, calibrated risk model, three-statement model, sponsor eligibility validation, or real funds movement. Missing core requirements remain visible; this is not submission-ready.

## Architecture and development briefing

Start at [the return briefing](docs/START-HERE.md), open [the offline interactive guide](docs/briefing.html), or read [the printable PDF](docs/LedgerProof-Briefing.pdf). Five architecture diagrams are available as SVG, PNG and editable Mermaid. Detailed [service responsibilities](docs/SERVICE-REGISTER.md), [future development](docs/FUTURE-DEVELOPMENT.md), [event opportunities](docs/EVENT-STRATEGY.md), and [your core action list](docs/ACTION-ITEMS.md) are included.

`npm run doctor` checks configuration without printing secrets or calling providers. To load your configured environment: `node --env-file=.env.local --import tsx scripts/doctor.ts`. `npm run fixtures:creao` prepares two-document changed-input bundles and the exact JSON output schema for manual hosted-agent testing. `npm run docs:build` rebuilds the offline briefing; `npm run docs:export` regenerates PDF/PNG assets and tests offline navigation/search/mobile.
