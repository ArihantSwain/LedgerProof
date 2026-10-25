# LedgerProof judging examples

**89 scenario/reference files plus a printable judge guide. All data is fictional.**

[Open the live app](https://ledgerproof-one.vercel.app) · [Download the complete ZIP](https://ledgerproof-one.vercel.app/examples/ledgerproof-judge-pack.zip) · [Printable judge guide](JUDGE-GUIDE.pdf)

## Start with these

1. Start a fresh demo and open **Accounting workbench**. Expand **Import settlement CSV**, choose [the main settlement set](03-settlements/00-main-demo.csv), then click **Import CSV records**. Show the balanced $9,670 deposit and both exceptions. Do not also click Load sample settlement: that imports the same IDs.
2. Expand **Receivables and corrections** and upload [the $8,000 INV-A credit](01-credit-notes/INV-A-credit-8000-USD.pdf). Investigate, inspect the source, and approve that credit only. Week-two cash changes from $16,000 to $8,000. Local deterministic rehearsal is an explicitly simulated, free practice option; it is not CREAO proof.
3. Return to **Cash forecast** and model the default payment delay. Week-two cash becomes -$4,000. Add the default $3,000 expense to reach -$7,000. Open the recovery comparison and review its unsent draft.

## Choose the right import

| Folder | Files | Where to use them |
| --- | --- | --- |
| 01-credit-notes | 17 credit PDFs | Workbench → Receivables and corrections → Upload credit PDF / bank CSV |
| 02-bank-receipts | 19 one-row receipt CSVs | The same receivables uploader; investigate and approve the matching receipt only |
| 03-settlements | 19 source sets | Workbench → Import settlement CSV → choose file → Import CSV records |
| 04-safety-cases | 17 safety scenarios | Named workflow in the manifest; most intentionally reject |
| 05-reference-only | 14 original records | Read only; already represented in the seeded business |
| 06-vendor-context | 3 fictional charge briefs | Manually enter in Find missing vendor context; not uploadable receipts |

**Reset between alternative files.** These files are a scenario library, not one cumulative dataset. Each workspace has a 30-document limit and a 100-row settlement limit. The high-volume settlement has 92 rows.

**One intentional sequence:** import [03-missing-fee.csv](03-settlements/03-missing-fee.csv), then append [04-missing-fee-evidence.csv](03-settlements/04-missing-fee-evidence.csv) without resetting. The authored source fee resolves the $20 difference. Importing the fee file alone produces no bank result.

## Expected outcomes and checks

[expected-results.csv](expected-results.csv) is a browsing index, not an import file. [manifest.json](manifest.json) contains exact amounts, anticipated bank statuses, rejection stages and SHA-256 hashes. Credit and receipt numbers assume only that file’s proposed adjustment is approved. Unrelated fixture proposals change the result.

Safety examples cover unknown invoices, unsupported currency, missing/negative amounts, invalid dates, over-crediting, duplicate receipt IDs, multi-row receipts, duplicate settlement source IDs, fractional cents, quoted fields, a six-page PDF, and untrusted instructions inside a valid source. Re-upload an accepted file to demonstrate duplicate-ingestion prevention.

**Provider limits:** documents are authored synthetic inputs, not live CREAO/Claude outputs, CRS reports, or payment receipts. CREAO/Claude results can vary. CRS uses its separate official synthetic personas. Coinbase purchases require a funded wallet; an unpaid Exa quote is not a settlement. No source file guarantees collection or counterparty agreement.

## Run locally

With Node 22, run `npm ci` then `npm run demo` and open http://localhost:3000. No API keys are required. Click **Run sample investigation** to practice without external calls.

## Regenerate and verify

From the repository root, with Node 22 and Python 3:

```sh
npm ci
npm run examples:build
npm run examples:verify
```

The build is deterministic. Verification exercises actual PDF extraction, CSV parsing, reconciliation and approval transitions offline. It never calls a provider or moves funds.
