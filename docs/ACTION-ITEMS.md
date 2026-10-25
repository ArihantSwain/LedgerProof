# Core actions for your return

Everything possible without account decisions was handled locally. No response is required while you are away. Start with the two account tasks below; optional sponsor tasks should not delay the core.

## P0 — make the mandatory agent real

**Where:** agent.creao.ai, using your event-upgraded account. **Estimated human interaction:** 10–20 minutes plus provider execution time; not a guarantee.

1. Finish the fresh build of **LedgerProof Receivables Investigator**. Use CREAO-AGENT.md. Its job is evidence-backed reconciliation; it must not send email, approve corrections, post entries or transfer funds.
2. Save it as a reusable hosted agent, not just an unsaved conversation. If using the agent-v1 form, add a text input named **bundle** that accepts the serialized JSON evidence bundle. Retain the exact field name.
3. Locate external invocation settings. Confirm **which API family this account actually supports**. The app now supports explicit `agent-v1` or `developer-v2`; it never switches families automatically. If agent-v1 is supported, use base `https://agent.creao.ai/api/v1`; if developer-v2, use `https://developer.creao.ai/v2`. An agent ID/key from one family is not presumed compatible with the other.
4. Put the key and agent ID in LedgerProof/.env.local through your secure local/hosting environment. Never paste the key into chat or commit it. Set CREAO_API_FAMILY, CREAO_API_BASE and, for agent-v1, CREAO_INPUT_FIELD to match the confirmed account. Set CREAO_CONTRACT_VERIFIED=true only after checking that contract.
5. If supported, select a traceable Claude model and retain the actual model ID. Do not claim Anthropic otherwise.
6. Run the opt-in smoke script only with authorized event credits/account access: `node --env-file=.env.local --import tsx scripts/smoke-creao.ts`. Confirm changed $8,000/$6,000 credit inputs produce source-bound results, and run the UI flow with CREAO selected.
7. Capture the actual **agent ID and successful run share link**. Add them to README, SPONSOR-EVIDENCE.md and SUBMISSION.md. A run ID alone is not a shared run link. If the form/output differs, keep the real sanitized response and adjust the adapter explicitly.

Manual test inputs are ready in fixtures/creao/input-credit-8000.json and input-credit-6000.json. The exact machine-readable result contract is fixtures/creao/output-schema.json. These are fixtures and expectations, not live outputs. `npm run doctor` checks the current shell configuration; use Node's `--env-file=.env.local` form to load a local file.

**Done when:** hosted CREAO actually investigates changed inputs, valid cited findings enter the review queue, and the shared successful run is accessible to judges. Current status remains BLOCKED until then.

## P0 — activate the real persistent backend

**Where:** your Convex account/project.

1. Run `npx convex dev` from LedgerProof and select/create the intended project using available event credits. Stop before any paid subscription or unintended project change.
2. Configure server-only CONVEX_URL in .env.local and the same strong random LEDGERPROOF_BACKEND_SECRET in .env.local and the Convex deployment environment. Keep secrets out of source/chat.
3. Deploy the prepared schema/functions to the authorized development deployment. Test create/read, original-file storage, changed evidence, concurrent decisions, reset and retrieval resume.
4. Verify shared updates in two browser contexts against the actual backend. Current UI uses polling; native subscriptions and a Workflow component are still not implemented and must not be claimed.

**Done when:** test receipts prove the hosted backend is central, durable and scoped. Local filesystem tests alone do not prove Convex behavior.

## P0 — event participation and submission

Check the actual Devpost countdown. The supplied guide says Sunday 9:00 AM submission and 10:30 AM–12:30 PM in-person judging; the current weekend maps Sunday to **October 25, 2026, Pacific time**. Verify that mapping/countdown with the event site/app. Confirm participant eligibility, registration, teammates (maximum four), and actual implementation chronology. Be present for the full judging window as required by the guide.

The draft is docs/SUBMISSION.md; the two-minute story is docs/DEMO.md; source and evidence are indexed in START-HERE.md. A Saturday draft is recommended by the guide. **No Devpost submission has been made.** Source publication, a public deployment, video recording/public sharing, and submission still need your concrete account decisions/authorization. “Any command” was used for local work; it was not interpreted as permission to spend money, contact people, trade, or submit on your behalf.

## P1 — only if the core is already working

| Action | What only you can supply | What would make it useful |
| --- | --- | --- |
| Confirm real user problem | Your lived experience or a consenting independent bookkeeper/fractional CFO serving creative agencies | Observed workflow/task feedback; no fabricated interview |
| CRS capability gate | Event sandbox credentials, provided test identity, catalog access | Supported fields and identity type genuinely inform a visible investigation/scenario |
| Coinbase test tooling | Eligible account confirmation, authorized test keys/tooling, environment choice | Actual bounded buyer-agent/x402 report purchase with recoverable delivery; no real funds needed |
| Figma path | Edu verification and access to Design/Make/Slides | Real iteration reflected in code, accessible artifacts, honest stage log and demo video |
| Factory/Fetch.ai | Verified event SDK access only if pursuing a real runtime role | Independent evaluation worker or genuine agent-to-agent exchange; never replace CREAO core |
| Hosting | Preferred existing account/domain and publishing decision | Deploy a tested build with real backend and exact APP_ORIGIN; record real URL |

## What you do not need to supply now

No real bank credentials, customer financial records, personal credit identity, payment authority, broad email access, or paid subscription is needed for the synthetic judge core. Bright Data, Spacetime, voice, hardware and other extra tracks are not blockers.

## Copyable handoff after account work

Tell the next coding run: “CREAO is saved. The nonsecret API family is ___, agent ID is ___, input field is ___, and the run share link is ___. Secrets are configured locally, not in chat. Convex project/URL is configured. Verify actual execution, update integration-status, finish outstanding core gaps, then rerun the full judge flow.” Do not say the integration works until the execution artifacts support it.
