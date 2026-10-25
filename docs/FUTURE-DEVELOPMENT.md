# Future development: from judge demo to a receivables control product

## Product direction

The strongest initial product is an evidence-to-cash workbench for independent bookkeepers and fractional CFOs who serve small creative agencies. It should earn a narrow seat: check whether receivables supporting a forecast are correct, prepare defensible adjustments, and let an accountable human decide. “Autonomous CFO” would overstate the scope and permissions of the present system.

The defensible asset is a traceable connection between source documents, normalized facts, corrections, reviewer decisions, and forecast effects. A generic finance chat interface is easy to replace. A reliable review workflow integrated into month-end close and weekly cash planning may be useful; that value still needs customer validation.

No timeline below is a delivery promise. Effort is an initial engineering estimate assuming one experienced builder and available accounts. Existing blocked integrations must be proved before expanding them. Do not add integrations to increase a sponsor count.

## Phase gates

| Phase | Intended outcome | Work | Exit evidence | Approximate effort |
| --- | --- | --- | --- | --- |
| A: credible event core | Real investigator, honest live demo | Save CREAO agent, confirm API family/form, changed-input round trip, deployed Convex, exact judge path | Agent ID/run share link, two different outputs, source citations, hosted test receipts | 3–8 focused hours after access; provider latency/account issues may extend |
| B: complete narrow imports | New judge inputs work without rewriting fixture | Opening balances, invoices, batch bank CSV, ledger and obligations import with explicit schema/mapping/preview | Balanced opening trial balance, atomic import, no duplicated IDs, parser rejection tests, one new independent case | 3–6 builder days |
| C: dependable pilot | Bookkeeper can repeat weekly workflow | Workspace auth/roles, native sync, durable polling, data retention, parser isolation, monitoring | Reconnect/restart/concurrency tests, role denial tests, restore drill, documented operational runbook | 1–3 builder weeks |
| D: useful accounting workflow | Reduce real review effort | Read-only accounting connector, review packets, historical statements, close checklist | Accountant-reviewed mappings, representative customer cases with consent, measured review-time improvement | 3–6 builder weeks |
| E: repeatable product | Safe multi-client operation | Organization tenancy, quotas/billing, connector lifecycle, permissions, support tooling | Retained pilot users, cost/error budgets, end-to-end tenant isolation and deletion proof | 6–12+ builder weeks |

## Immediate engineering priorities

**Prove CREAO before elaborating it.** Create one saved investigator with a clearly named bundle input. Confirm whether the actual account uses agent-v1 or developer-v2, then choose that family explicitly. Retain real status envelopes, model metadata if available, input/output, and share links with secrets removed. Show changed credit amounts and an evidence-bound challenge. No automatic fallback between API families. If the account cannot invoke externally, record the exact blocker rather than replace CREAO with local chat.

**Make execution durable.** Introduce a Convex Workflow or equivalent persisted scheduler for retrieval, validation and review pauses. Store bounded input hashes, provider IDs, attempts, deadlines and next retry time. Separate retryable retrieval from unknown submission outcome. Keep external actions idempotent where documented; otherwise reconcile. A workflow framework does not make an external non-idempotent call safe to repeat. Use notifications only with explicit user authority.

**Finish imports before broadening finance.** Build a staging area with field mapping, validation errors, cross-record reconciliation, and an all-or-nothing commit. Preserve originals and parser versions. Require explicit opening cash cutoffs, allocated receipt identity, and dated obligations. Handle partial allocations, credit-note identity, invoice aliases, duplicates, and overpayments as modeled exceptions. Support a deliberately limited USD service-business schema first; reject unsupported inventory or currency semantics.

**Normalize persistence when aggregate limits matter.** Move business entities to scoped indexed Convex tables without losing atomic approval semantics. Keep decisions, journal lines, source links and event appends in one transaction. Snapshot the exact forecast inputs/results used for a review. Add migrations, pagination, file cleanup, expiry cleanup, and cost/size bounds. Do not market an application event log as immutable cryptographic evidence.

**Harden extraction.** Run untrusted PDF parsing outside the request process with time/memory/page budgets. Add OCR only after evaluating scans, and retain field provenance and uncertainty. A structured Claude extraction step is justified only if it improves the supported document cases and is actually measured. Make model/provider versions observable. Conflicting fields must remain review items rather than guessed “best” values.

## New product paths worth exploring

| Path | Customer job and why it fits | Smallest useful experiment | Success gate / stop condition |
| --- | --- | --- | --- |
| Read-only close assistant | Bookkeeper finds discrepancies before month-end close | Import one period, reconcile invoice/receipt/credit links, produce review packet | Accountant confirms findings and mappings; stop if data access produces more cleanup than benefit |
| Accountant–owner review portal | Owner approves understandable corrections while bookkeeper retains control | Separate preparer/reviewer roles and source-bound comments | Users complete review with fewer clarification rounds; stop if access or audit expectations exceed controls |
| Payroll reserve planning | CFO needs more than a zero-cash threshold | Reserve selector, daily/weekly cash bridge, transparent delay/expense grid | Decisions can be traced to selected assumptions; no probability/calibration claims |
| Evidence completeness monitor | Missing source documents delay close | Deterministic list of unsupported/unverified balances and requested documents | Fewer unsupported decisions, no false assertion that a missing item proves fraud |
| Counterparty identity checks | Conflicting legal/payment identity requires investigation | Only verified supported sandbox fields, source age, discrepancies and escalation | CRS product/identity type fits; stop if consumer fields must be misrepresented as business facts |
| Client remittance portal | Receipts arrive without invoice allocation | User uploads remittance advice and proposes allocation for review | Matching improves on representative evidence; no payment initiation or automatic posting |
| Dispute and credit-note workflow | Agency tracks why an issued credit changes collections | Credit identity, effective date, source chain, reviewer decision, scenario impact | Source-backed adjustment stays distinct from collection hypothesis |
| Cash sensitivity laboratory | Owner wants to understand several independent delays | Deterministic grid across amounts/dates/obligations with exact contributions | Values match engine invariants and clearly state assumptions; no unearned risk scores |
| Financial evidence API | Other tools need bounded, cited findings | Scoped read-only bundle/result API with schema versions and report hashes | Consumers can verify scope/citations and handle stale results; no arbitrary SQL or provider-secret exposure |
| Report-as-a-service commerce | A buyer agent needs one completed evidence packet | Fixed-price test report, bounded agent budget, verified x402 flow, order/delivery reconciliation | Authentic tooling and test receipt, no duplicate fulfillment; stop if it distracts from core readiness |
| Public-source collections research | A real investigation needs current public counterparty information | Permitted source retrieval tied to a specific evidence question | Bright Data/Apify is essential and live; stop if removing retrieval leaves the product equally useful |
| Accessibility-first cash briefing | Reviewer cannot comfortably use dense tables | Keyboard-first review and plain-language/source-linked briefing; voice only after user research | Task completion improves in observed use; do not add voice solely for a track |
| Reconciliation regression worker | Teams need repeatable proof after mappings change | Trigger bounded evaluation suite; independent worker assembles test diffs/evidence pack | Factory SDK actually executes runtime work; no book-writing permission and no replacement of CREAO investigation |
| Discoverable analysis agent | Another agent can discover and request the service | Fetch.ai discovery/message path around a bounded case bundle and reply | Working agent-to-agent exchange has a user need, verified SDK/runtime, and no duplicate backend |

These are opportunities, not implemented features. The top expansion bets are imports, a read-only close assistant, payroll reserve planning, and an accountant review portal. Commerce, voice, and public web research should follow demonstrated demand.

## Customer validation plan

Start with five independent bookkeepers or fractional CFOs who serve small creative agencies. Recruit only through authorized outreach; none has been contacted. Ask them to describe their last receivables discrepancy and payroll planning workflow before showing the demo. Record current tools, frequency, review duration, source availability, error cost, and approval responsibilities. Obtain consent before recording or handling real records.

Then run a moderated task using synthetic data first: find the credit, inspect source, decide, explain the cash effect, and challenge a finding. Observe completion, misunderstanding, and time; do not lead the participant to the expected answer. A later pilot may use redacted records under an appropriate agreement. Keep time saved, acceptance rate, false positives and data-cleanup effort separate. A positive interview is not a paying customer or proof of retention.

## Measurement and evaluation

| Metric | Definition | Initial target hypothesis |
| --- | --- | --- |
| Task completion | Users complete source → review → explained forecast unaided | At least 4 of first 5 moderated users; revise based on observed friction |
| Supported-finding precision | Accountant-supported findings / all actionable findings on labeled cases | Set only after collecting a representative labeled dataset |
| Missed discrepancy rate | Known supported discrepancies not detected / labeled discrepancies | Stratify by type/document quality; do not hide misses in a single percentage |
| Review effort | Median minutes plus clarification rounds per case | Compare same case/workflow against actual baseline, not guessed labor cost |
| Correction integrity | Duplicate postings, stale approvals, cross-tenant mutations | Zero tolerated in required tests and observed pilot; incident process if violated |
| Agent usefulness | Reviewer can explain evidence and next action from findings | Qualitative rubric plus accepted/rejected reasons, independent of prose fluency |
| Runtime reliability | Terminal result or actionable failure within declared deadline | Measure queue, provider, validation and review latency separately |
| Cost per completed case | Actual provider + storage + compute costs including retries | Establish from receipts before pricing; no current measured figure |

Expand evaluation beyond the current authored fixture: clean invoices, partial allocations, real issued-credit variants, false duplicate candidates, stale imports, conflicting references, scans, timeout recovery, and injection attempts. Split examples into development/evaluation sets. Record exact provider/model/prompt/schema versions, counts and uncertainty. Human approval remains necessary even with a strong evaluation score.

## Production architecture direction

Use organization → business → case ownership, with viewer/preparer/reviewer/admin roles and a formal authorization matrix. Replace shared bearer editing links with revocable scoped invitations for production. Keep demo and customer environments separate. Add environment-specific keys, minimum data retention, encrypted storage managed by the selected platform, deletion workflows, original-file access controls, audit export and incident response. Security claims require verification; no certification is implied.

Operate with a Node-capable Next.js host and a genuine Convex deployment. Add native subscriptions or an authenticated server relay, background retrieval workers, limits per organization/provider, observability with sanitized request IDs, model cost budgets, and a deployment rollback plan. Test expiry and restore behavior. Avoid logging raw financial/identity responses or share tokens. A database transaction can make local posting atomic; it cannot make an external payment and local delivery globally atomic.

## Commercial angle and distribution hypotheses

Possible packaging: a per-case investigation tool for independent bookkeepers; a recurring multi-client workspace for fractional CFO firms; or an evidence API/report service. Pricing, willingness to pay, market size and channel performance are unvalidated. Do not invent an addressable-market number or an hourly savings figure.

For a per-case hypothesis, contribution margin equals price minus actual extraction, investigator, storage/compute, payment fees, support, and retry costs. For a subscription, model included cases and guard against one heavy user consuming the whole allowance. Measure completion, monthly reuse, churn, support burden and source-import effort before adding automated billing. Accounting firms may be a better initial channel than direct sales to every small agency, but interviews must test that hypothesis.

## Explicit stop conditions

Stop adding sponsor integrations if the mandatory live investigator or deterministic review path is not ready. Stop a credit-data path if supported fields do not fit the identity/business story. Stop scraping if evidence is non-public or behind a login/paywall. Stop autonomous posting/payment scope until a separately authorized design, identity policy and controls exist. Stop claiming statements are complete when the trial balance, cutoff or opening balances cannot be reconciled.

## Recommended next release

Release 0.2 should prove live CREAO + Convex, finish a narrow reusable import pipeline, produce a complete scoped case report, and add resilient polling. Release 0.3 should support a real read-only pilot with roles, explicit retention, and accountant-reviewed mappings. Reserve secondary statements and payment commerce for later gates. The current product deserves a reliable receivables seat before it asks for a broader finance seat.
