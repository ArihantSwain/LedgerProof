# Sponsor evidence register

Updated October 24, 2026. The current verification table is [integration-status.md](integration-status.md).

## Coinbase Payment Agents — primary Coinbase track

**User:** a small-business bookkeeper investigating unexplained charges. **Job:** buy missing public vendor billing context within a small approved budget, retain the evidence, and account for the investigation itself.

**Tools:** official Coinbase CDP MCP for managed-wallet identity checks; CDP SDK for managed signing; x402 exact Base-USDC payments to the real Exa API; viem for independent Transfer verification; Convex for durable reservations, receipts and native-unit journals. The application exposes a fixed read-only MCP operation, never generic model access to wallet tools.

**Working evidence:** authenticated CDP SDK account read, authenticated CDP MCP account-list call, and a real Exa HTTP402 quote for 7,000 atomic USDC. See `evidence/cdp-authentication.json`, `cdp-mcp-verification.json` and `exa-x402-quote.json`. The buyer wallet is created and CDP-MCP-verified; signing and a paid delivery are pending funding; no settlement is claimed yet.

**Demo:** add a charge → inspect local evidence → inspect actual 402 quote → authorize a bounded external purchase → inspect sources/transaction/expense journal → ask for a source-bound accounting review. A 0.007 USDC purchase stays exactly 7,000 atomic units. Reused vendor context does not trigger another payment in the same case generation. Unknown payments are reconciled from saved receipts.

**Controls:** fixed provider and curated domains; no private bank records in searches; 0.01 USDC per purchase and 0.10 across the deployment; source-version and expiry checks; unique receipt identity across cases; exact native-asset debits/credits; no business invoice payment or external bookkeeping writes.

**Builder feedback from this build:** the API key and wallet secret are separate and the wallet-secret location was hard to find. The retail Coinbase MCP currently documents x402 as coming soon; the official CDP MCP/SDK builder path supports this server-side design. Track wording should be clarified with the sponsor if they require the retail endpoint specifically. A first-class idempotent purchase-and-retrieve API with durable settlement/delivery status would simplify recovery after ambiguous transport failures.

The supplied challenge PDF requires project summary, working example, architecture and builder feedback. It says real-money transactions are not required. A verified Coinbase account and other eligibility requirements still apply; no eligibility or recruiter outcome is guaranteed.

## Other required integrations

- **CREAO:** real $8,000 and $6,000 credit-input runs, normalized native artifacts, source/version validation. Proof is in `evidence/creao-800000.json` and `creao-600000.json`. Share link remains uncaptured.
- **Hyphenate:** controller, investigator and bookkeeper duties, messy source data, human gates and interactive challenges are implemented. Full platform/eligibility brief remains unverified.
- **CRS:** official developer MCP connected and request schema retrieved. Runtime adapter and official synthetic personas are prepared; sandbox credentials and a real report remain pending.
- **Convex / Anthropic:** actual runtime proof is recorded separately from offline tests. No other sponsor is claimed merely because a dependency or diagram exists.
