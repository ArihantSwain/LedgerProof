# Architecture

Next.js App Router + React + TypeScript; Zod runtime contracts; pure integer-cent finance engine; Convex transactional case aggregates and document storage; one CREAO interface with explicitly selected developer-v2 or agent-v1 contracts. The custom UI has cash outlook, sources, run activity, and review queue. No sponsor keys enter browser bundles.

Browser → same-origin scoped API → session capability validation → state store → deterministic command transition. Upload → bounded PDF/CSV extraction → normalized source records → input-version increment → CREAO evidence bundle → authenticated status retrieval → citation validation → deterministic proposals → reviewer CAS decision → atomic posting/event/decision → recalculated forecast.

## Persistence boundary

Convex is the selected hosted backend. `convex/cases.ts` performs all transitions inside a transaction; `caseSchema` validates entities before commit. A bounded aggregate per workspace intentionally replaces the brief's suggested normalized tables for the first vertical slice. Sessions, business, documents, invoices, receipts, credits, ledger, obligations, assumptions, investigations, findings, proposals, events, and idempotent decisions live inside that aggregate. Ownership is inherited from the aggregate and checked before access. No cross-workspace queries are exposed. Case IDs and expirations are indexed.

This is a schema scope cut: separate normalized entity tables, persistent forecast snapshots, counterparties/field-coordinate tables, providerEvidence, and reportOrders are not implemented. Aggregate document size and transcript growth need monitoring; keep fewer than 30 sources/runs and bounded text. Source files use Convex storage when configured. A storage upload followed by failed metadata commit can leave an orphan; add scheduled cleanup before production.

Local fallback uses ignored JSON files, atomic rename, hashed bearer tokens, and a single-process promise queue. It is visibly LOCAL_REHEARSAL and not advertised as Convex. Multiple Node workers are unsupported. Reset increments a generation, discards previous run references, and prevents late results affecting the reset state. Expiration blocks access; physical cleanup is not yet scheduled.

UI polls scoped state every 2.5 seconds. Sharing a session links the same backend aggregate; unrelated sessions receive separate capabilities. Native Convex subscriptions and Workflow component remain work items, not claimed integrations.

## Provider execution and recovery

Agent input is a complete bounded evidence bundle. No approval/posting/payment endpoint is exposed as a tool. Public CREAO v2 contracts were checked October 24, 2026; actual account execution is blocked. Hosted agent/model selection/share links require account actions.

Submission intent is persisted as unknown before the network request; returned provider ID is persisted before retrieval. Ambiguous submissions are blocked from automatic repeat. Existing provider IDs can be polled after a server/browser restart. A failed status retrieval resumes against the same run ID. There is no automatic server-side scheduler yet: retrieval resumes on an authorized browser/API poll. Unknown submissions require manual account reconciliation; no administrative reconciliation endpoint is exposed. No webhook is enabled. Result-schema failures remain review/retry states; one-shot model repair is not implemented.

Evidence updates increment inputVersion. Late results become stale and cannot overwrite current findings. Decisions check expected ledger version, preserve source entries, validate balanced permitted accounts, post once, and append an event in the same store transaction. One approval invalidates other pending ledger proposals; rerun investigation to refresh them.

## Deployment preparation

1. Verify CREAO with changed inputs and retain actual evidence.
2. Configure/deploy Convex and test concurrent decisions, storage, restart recovery, expiry, and cross-session isolation live.
3. Replace development process rate limits with durable distributed limits; add payload streaming limits, parser isolation, data retention, CSP, accessibility focus management, and aggregate size guardrails.
4. Run offline + browser tests and host-specific checks. Set APP_ORIGIN to the exact HTTPS origin.
5. Obtain public deployment authorization, then deploy Next.js with server secrets. Never use an edge-only static host for these Node routes.

No public deployment, paid subscription, messages, Devpost submission, or funds movement has been performed.

## Expanded architecture package

See ARCHITECTURE-DIAGRAMS.md for five diagrams, HOW-IT-WORKS.md for the full runtime explanation, SERVICE-REGISTER.md for per-service implementation/evidence, and FUTURE-DEVELOPMENT.md for migration and product gates. The v1 contract comes from a public CREAO technical page for another event; it is a discovery contract only, never account or Cal Hacks eligibility proof. Invalid terminal outputs now escalate to human review rather than indefinite retrieval retries.
