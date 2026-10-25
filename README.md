# LedgerProof

[Open LedgerProof](https://ledgerproof-one.vercel.app)

An accounting team for small businesses. See what you can pay, find missing payments and duplicate entries, and keep your next steps with the evidence.

please use these samples to test out the product

The [SAMPLES](SAMPLES) folder contains fictional business records. Start with the three CSVs in [import-ready](SAMPLES/import-ready), or click **Try sample business files** on the upload page. Amounts are in USD. Use a fresh demo between alternative credit or payment files.

- **Cash forecast:** see your next 13 weeks and add a late payment or expense.
- **Accounting workbench:** investigate payments, review corrections, check vendor context and payment terms, and save suggested actions or notes.
- **Import records:** upload files, check the conversion, then add them to your books.

For the built-in story, start the finance demo, add the kitchen repair, investigate the returned customer payment, and update its collection date. Review the two similar vendor charges, look up the fictional customer, then save a next step. Reset restores the original demo.

## Run locally

Use Node 22:

```sh
npm ci
npm run demo
```

Open http://localhost:3000. Sample investigations work without API keys. For live services, configure the server-only values in `.env.example` inside an ignored `.env.local`, then use `npm run dev`. Visitors to the hosted app use its server configuration; keys are never sent to their browser.

Built with CREAO, Claude, Convex, Coinbase CDP/x402, CRS, Next.js, React and TypeScript. Exa provides public vendor documentation; a funded USDC wallet is required for paid delivery, which remains unverified. Sample investigations and synthetic credit reports are labeled. Corrections require approval; saved action drafts do not contact a bank or move money.

```sh
npm test
npm run test:convex
npm run build
npm run test:e2e
```
