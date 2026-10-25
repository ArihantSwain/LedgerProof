# LedgerProof — submission draft (NOT_READY)

LedgerProof helps bookkeepers, fractional CFOs, and small service-business owners verify the receivables behind their cash forecasts. An issued credit note can turn a comfortable payroll outlook into a shortfall once collection timing is made explicit.

Intended agent job: receivables controller assistant with read-only investigation, evidence citations, reviewable journal proposals, and human approval. Named target community: independent bookkeepers and fractional CFOs serving small creative agencies. Customer assumptions remain unvalidated; no interviews or testimonials have been obtained.

Implemented local path: isolated synthetic workspace; generated invoice/credit PDFs and CSVs; bounded source parsing; deterministic cash forecast; source drilldown; local rules rehearsal; proposed vs approved corrections; idempotent review; scoped export; scenario changes; explicit timeout rehearsal. CREAO hosted execution remains mandatory and blocked, so this draft does not claim a completed CREAO-powered product.

Architecture: Next.js/React/TypeScript, runtime Zod validation, integer-cent accounting, Convex transaction source, and a server-side CREAO interface with explicitly selected developer-v2 or agent-v1 contracts. Local rehearsal is file-backed and distinct from a live Convex deployment. No competing sponsor databases.

Demonstration: $16,000 baseline after two payrolls → $8,000 after an approved $8,000 credit → −$4,000 when remaining $12,000 collection moves to week 3. See docs/DEMO.md. Test results: docs/EVALUATION.md. Security: no agent posting/payment powers, scoped sessions, version guards, source escaping, server-only secrets, human approvals. Production controls and remaining scope cuts: README and ARCHITECTURE.

Repo: https://github.com/ArihantSwain/LedgerProof (local implementation not yet pushed).

Hosted demo: **not deployed**. CREAO agent ID: **missing**. Shared run: **missing**. Sponsor-ready tracks: **none**. Real data: **none**. Synthetic: all business records. Simulated: local rules investigation and injected timeout. Unverified: all live providers.

Coinbase builder feedback: no implementation trial yet; no firsthand feedback claimed. Biggest current blocker is provider/account verification and missing event source rules. Proposed workaround: keep commerce out of the core flow until an authentic test buyer and seller can execute. Missing capability to evaluate: documented test credentials/tooling and recoverable payment/delivery reconciliation. This is planning feedback, not measured builder experience.

Before submission: verify mandatory hosted CREAO execution with changed inputs and share link; deploy/test Convex; finish required import paths and native live updates; run browser tests; measure declared synthetic evaluation; verify official rules; obtain publication/submission authorization; capture actual evidence. No prize, interview, traction, or stacking guarantee.

Architecture and development package: docs/ARCHITECTURE-DIAGRAMS.md, docs/SERVICE-REGISTER.md, docs/FUTURE-DEVELOPMENT.md and docs/LedgerProof-Briefing.pdf. Current event strategy and new conditional track paths are in docs/EVENT-STRATEGY.md; personal account/submission actions in docs/ACTION-ITEMS.md. Source-only work and contract mocks remain distinct from live sponsor execution.
