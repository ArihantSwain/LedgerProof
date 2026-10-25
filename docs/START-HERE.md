# LedgerProof — return briefing

Prepared October 24, 2026, America/Los_Angeles. This is the index for the autonomous work package.

LedgerProof checks whether the invoices behind a cash forecast are trustworthy. The demo agency looks comfortable at $16,000 after two payrolls; an approved credit reduces that to $8,000, and a collection delay reveals a $4,000 shortfall. The useful product is the chain from source evidence to a reviewed correction to an understandable cash decision.

**Current state:** working local rehearsal; mandatory hosted CREAO execution and Convex deployment are still blocked by account setup. Code and diagrams do not establish live integration or sponsor eligibility.

## Read or open these first

| Artifact | What you get |
| --- | --- |
| [Interactive briefing](briefing.html) | Self-contained offline guide, diagrams, service search, and roadmap tabs; no account or server required |
| [Printable briefing](LedgerProof-Briefing.pdf) | Portable report for reviewing or sharing after checking its contents |
| [Architecture atlas](ARCHITECTURE-DIAGRAMS.md) | Editable Mermaid plus standalone SVG/PNG architecture, lifecycle, ownership, and roadmap diagrams |
| [How it works](HOW-IT-WORKS.md) | Full user flow, cash calculations, code paths, design choices, failure behavior, and service responsibilities |
| [Service register](SERVICE-REGISTER.md) | Exactly what is built, configured, tested, blocked, and deliberately excluded for each service |
| [Future development](FUTURE-DEVELOPMENT.md) | Sequenced technical/product roadmap, new expansion paths, metrics, commercial hypotheses, and stop conditions |
| [Event strategy](EVENT-STRATEGY.md) | Updated guide interpretation, newly discovered tracks, fit ranking, evidence gaps, and schedule |
| [Your action list](ACTION-ITEMS.md) | Prioritized actions that need your accounts, eligibility information, or publishing/submission decisions |
| [Evaluation](EVALUATION.md) | Actual executed checks; offline evaluation separated from live provider verification |

## Local use

```sh
npm ci
npm run fixtures
npm run dev
```

Open http://localhost:3000 in LedgerProof. Start demo → upload the generated credit → open Investigation activity → explicitly select local rehearsal → run → inspect evidence → approve credit → move collection to November 9. Select weeks 2 and 3 to trace exact cash movements. Reset only your own workspace. See DEMO.md.

For the briefing alone, open docs/briefing.html directly. Diagrams are under docs/diagrams. Rebuild documentation assets with `npm run docs:build`; export PDF/PNG with `npm run docs:export` after installing Playwright Chromium.

## Autonomous changes made in this pass

Added the architecture atlas, service inventory, operating explanation, development strategy, event/source register, stage log, submission checklist, and an offline navigable/printable briefing. Reviewed the user-supplied event guide and retrieved the linked Coinbase and Figma challenge content through Google Drive.

Hardened CREAO configuration: one explicitly selected API family, no automatic cross-family fallback, family-specific request/response validation, structured text handling, bounded payloads, wrong-run rejection, and malformed outputs escalated to review. Both adapters are contract-tested with mock HTTP responses, **not live verified**.

Corrected a finance edge case found during architecture review: newly posted receipts now enter the forecast in their actual date bucket, rather than all being added to opening cash. Source amounts with fractional dollars now retain cents in the display. The exact judge cash story remains unchanged.

No sponsor was added merely to claim another track. No paid service was purchased, real money moved, customer contacted, public deployment made, or Devpost submission sent. Missing account access is summarized in ACTION-ITEMS.md, so you do not need to reconstruct the conversation.

Final verification: 20 unit/backend/provider-contract tests, 3 browser tests, typecheck and production build pass. Five diagrams, offline navigation/search/mobile behavior, and the 26-page PDF were checked. A local-only configuration doctor, changed-input test bundles, and an offline GitHub Actions workflow are prepared. Remote CI has not run; no source push occurred.
