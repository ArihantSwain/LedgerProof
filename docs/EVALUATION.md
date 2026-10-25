# Evaluation

Executed October 24, 2026. None of these checks establishes live provider readiness.

| Check | Actual result |
| --- | --- |
| `npm test` | 20/20 passing finance, workflow, PDF/CSV parser, capability, concurrent local-store and mock-provider contract tests |
| `npm run typecheck` | Passed |
| `npm run build` | Passed with Next.js 16.4.3, static page and dynamic scoped API |
| `npm run fixtures` | Generated 10 invoice PDFs, credit PDF, bank/ledger/obligations CSVs |
| `npm run test:e2e` | 3/3 passing in 6.8 s on final autonomous pass against production build: credit upload → rehearsal → review → forecast; shared browser updates and unrelated isolation; blocked CREAO + simulated timeout resume; mobile fit/navigation |
| `node --import tsx scripts/evaluate.ts` | 3/3 authored anomalies detected, 0 missed, 0 false-positive anomalies; 1 benign partial payment finding; validation failures 0; local elapsed 1.541 ms |
| npm dependency audit at installation | 0 reported vulnerabilities |
| `npm run fixtures:creao` | Generated two-document $8,000/$6,000 credit evidence bundles and exact JSON result schema, with no provider calls |
| `npm run doctor` | Reported missing CREAO/Convex/account environment actions without printing secrets or making network calls |
| `npm run docs:build` / `docs:export` | Generated five SVG/PNG diagrams, a 10-section offline HTML briefing and a 26-page PDF; navigation/search/empty-state/mobile checks passed |

Browser screenshots were inspected for desktop dashboard and mobile review. Browser artifacts are ignored under test-results/. Initial browser attempt exposed a test synchronization issue (navigation before upload completion); corrected by waiting for the upload response and testing the production build. Disk exhaustion during install left a damaged compiler, which was replaced before successful checks.

Declared synthetic evaluation set: 10 invoices with normal fully matched receipts, one partial payment, one unmatched receipt, one duplicated ledger entry, plus an optional uploaded issued credit. Expected results live independently in fixtures/expected.json. This small authored set is not production performance evidence.

Required checks: exact cash transitions; date boundaries/rollover; balance/account enforcement; overpayment exceptions; preview separation; amount changes; timing preserves revenue; no risk write-off; duplicate and competing decisions; stale/reset behavior; scoped sessions; citation/enum rejection; prompt injection remains data; explicit blocked provider status; source-upload browser path. Browser test source is in tests/browser.

Measured offline rule sample: one authored synthetic agency, 10 invoices, 7 clean negative invoices after credit introduction, three seeded anomalies (credit, unmatched receipt, duplicate posting), and one legitimate partial payment. See evaluation-results.json. This is a small deterministic rule check, not a general accuracy benchmark or evidence of CREAO quality. The explicit 1.541 ms measurement excludes network/model/extraction time.

Live CREAO extraction/matching accuracy, missed errors, false positives, model latency, share links, Claude trace, Convex concurrency/subscriptions, and sponsor sandbox evidence: **not measured**. Customer interviews: none. No fabricated customer feedback or benchmark percentage.

Autonomous architecture review added regression tests for dated newly posted receipts and fractional-dollar display, plus mock HTTP tests for explicit CREAO API-family separation, mismatched base rejection, structured text parsing, wrong-run rejection, stale result rejection and unavailable credentials. These are offline contract checks, not successful provider calls. Malformed terminal results now escalate to review rather than repeating retrieval indefinitely. A GitHub Actions workflow was prepared but has not executed remotely because source has not been pushed.
