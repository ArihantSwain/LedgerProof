# Remaining account actions

Updated October 25, 2026. Keep secrets out of chat and source control.

1. **Fund the verified buyer:** the API key and wallet secret work. Named buyer address: `0xE2F668e5EFBA8F9197988Cf75aD57Ab1736c0B9C`. It is currently unfunded. Send a small amount of USDC on **Base mainnet**; 0.10 USDC covers the entire app spending cap. The first live Exa quote is 0.007 USDC. Test USDC cannot pay this real quote.
2. **Complete one live evidence purchase:** once funded, enable `LEDGERPROOF_X402_EVIDENCE_ENABLED=true` and use the Evidence Buyer authorization. `npm run verify:x402 -- --prepare-wallet` safely rechecks the public address and balance without a transfer. Current proof is `evidence/cdp-wallet-verification.json`.
3. **Public demo is deployed:** https://ledgerproof-one.vercel.app. Click **Start finance demo**; judges need no hosting account. CRS is configured and its synthetic report was also verified from Vercel. No Bitdeer or Render setup is needed.
4. **Hyphenate:** supply the complete track brief if it specifies a platform/API beyond the supplied workflow rubric. The accounting seats, source trail, human gates and interactive challenge flow are implemented; eligibility is not independently established.

Optional: the Finances connection was suggested for account insights in this chat. It is not required and is not confirmed connected. It does not grant the LedgerProof application bank access.

Convex, CREAO and direct Claude access are already configured. No further Anthropic keys or credits are needed for implementation. Public deployment and hosted verification are complete. Capture submission evidence from the public demo; do not claim a paid Exa settlement until the wallet is funded and the transaction is verified.
