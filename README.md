# LedgerProof

Live demo: **https://ledgerproof-one.vercel.app** — click **Start finance demo**. No judge login required.

Start with **Upload your business records** or visit [/import](https://ledgerproof-one.vercel.app/import). Upload a set of CSVs, Excel workbooks, PDFs, Word documents, photos, JSON or text; check the editable conversion before importing your own invoices, payments, credits and bills. [Try these ordinary business files](public/examples/import-ready). Missing or ambiguous fields need confirmation. Text/table conversion runs locally; scans and photos can use a bounded Claude extraction within the existing app budget.

**Cash forecast** for the cash outlook and **Accounting workbench** for source records, reconciliation, investigations, review and follow-up. Optional external checks expand inside the workbench.

An accounting team for small businesses: reconcile messy transactions, investigate discrepancies, prepare balanced entries, and retain the evidence behind every decision.

The **Evidence Buyer** uses Coinbase CDP and x402 to purchase public vendor billing context from the real Exa API. It checks local evidence first, enforces a small spending budget, verifies the USDC Transfer on Base, and records its own investigation expense without losing sub-cent amounts.

**Current verification:** Convex, Claude and CREAO have live evidence. Exa has a verified live HTTP402 quote. Coinbase API authentication is verified; the named buyer wallet is created and verified through CDP MCP; funding and a real paid Exa delivery remain pending. CRS sandbox credit reports are verified, including from the hosted app. See [integration status](docs/integration-status.md).

## Run

Node 22:

```sh
npm ci
npm run demo
```

Open http://localhost:3000 and click **Start finance demo**. No API keys, account setup, or `.env` file is needed. This command uses local storage and clearly labeled sample investigations; unavailable live services stay disabled.

For live integrations, configure the services in `.env.example` and run `npm run dev`. Keep credentials in ignored `.env.local`; do not overwrite existing credentials. The hosted demo uses the configured live services.

- **Cash forecast:** inspect the 13-week outlook and test a cash disruption.
- **Accounting workbench:** reconcile deposits, upload credit notes or receipts, investigate with CREAO, review with Claude, and approve entries. Vendor evidence, CRS sandbox checks, recovery plans and drafts expand in the same workbench.

## Judging documents

[Download the complete judging pack](https://ledgerproof-one.vercel.app/examples/ledgerproof-judge-pack.zip) · [Browse the examples in this repo](public/examples/README.md) · [Printable judge guide](public/examples/JUDGE-GUIDE.pdf)

The pack includes alternative credit-note PDFs, one-row bank receipts, settlement datasets, intentional failure cases, and clearly labeled reference-only originals. Each scenario includes independently specified expected outcomes. Reset the synthetic workspace between alternatives. For settlements, choose the CSV under **Import settlement CSV**; credit PDFs and one-row receipts use **Receivables and corrections**.

Regenerate with `npm run examples:build` (Node 22 and Python 3); verify without provider calls using `npm run examples:verify`.

## Try a complete accounting flow

1. Open **Accounting workbench** and click **Load sample settlement**. Inspect the balanced $9,670 deposit, the $50 difference, and the ambiguous allocation. Approve only the balanced deposit.
2. Expand **Receivables and corrections**. Upload [the $8,000 credit PDF](public/examples/01-credit-notes/INV-A-credit-8000-USD.pdf). Use **Run sample investigation** locally, or **Utilize our agent** for the hosted investigation. Review the source and approve only that credit.
3. Open **Cash forecast**: cash after week two changes from $16,000 to $8,000. Expand **Test a cash disruption**, model the default customer delay, then the default expense: it becomes −$4,000, then −$7,000.
4. Return to the workbench to compare recovery plans and review an unsent follow-up draft. Reset the demo before trying an alternative document.

The example pack contains 90 fictional documents, including the judge guide, with expected outcomes. CSV receipts and settlement CSVs have separate import controls; the guide explains each.

## Limits

Claude uses a fixed Haiku 4.5 model, at most 2,000 output tokens, a bounded input, saved-result reuse, no automatic retries, and a Convex-backed **$5 / 50-reservation lifetime app cap**. This does not meter other clients using the same Anthropic account.

Real Exa purchases allow only the fixed HTTPS endpoint, curated official vendor domains, exact Base-USDC payments to the verified provider address, **0.01 USDC per purchase and 0.10 USDC / 10 reservations per deployment**. Purchasing is disabled until `LEDGERPROOF_X402_EVIDENCE_ENABLED=true`. No bank records are included in the search query. Failed/unknown purchases cannot be blindly repeated; saved receipts can be reconciled separately.

Public vendor documentation provides context. It cannot establish that a particular bank charge is valid, replace its receipt, or authorize a business payment. Native USDC investigation expenses, processor settlement entries and the synthetic agency forecast are separate subledgers. Production accounting exports, fiat valuation and authenticated business roles remain future work.

## Verification

```sh
npm test
npm run test:convex
npm run build
npm run test:e2e
npm run doctor
```

Offline tests disable providers and never spend credits. Explicit live checks:

```sh
npm run verify:x402                         # unpaid live quote only
npm run verify:x402 -- --prepare-wallet    # provision/read buyer; no transfer
npm run verify:convex
npm run verify:creao                       # resume saved run ID
npm run verify:creao -- --changed-input
npm run verify:claude                      # can spend credits; explicit only
```

[Start here](docs/START-HERE.md) · [Remaining account actions](docs/ACTION-ITEMS.md) · [Architecture](docs/ARCHITECTURE-DIAGRAMS.md)

## Recording scenario

Open https://ledgerproof-one.vercel.app/?recording=1 to create a fresh Cedar Kitchen case. Add the default $3,000 emergency repair ($13,000 remains in week two), investigate receivables, inspect the returned-payment source and update its collection timing (week two becomes -$7,000). Inspect the duplicate ledger proposal and the two $149 Paddle charges. Check official vendor context without claiming fraud. Payment terms reuses the actual CRS P05 sandbox report, score 540. Prepare and approve a partial-collection recovery plan, inspect its unsent draft, and record the phone-call decision. A live investigation uses CREAO; the separate Run sample investigation button is explicitly simulated and instant.
