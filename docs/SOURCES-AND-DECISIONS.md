# Sources, decisions, and confidence

Retrieved/reviewed October 24, 2026. Facts from source documents are distinct from implementation evidence. No account capability is inferred from a documentation page. No event eligibility is inferred from a technical integration alone.

| Source | What was actually available | How used / limitation |
| --- | --- | --- |
| User LedgerProof specification | Complete pasted implementation brief, preserved as BUILD-SPECIFICATION.md | Scope, exact forecast values, mandatory CREAO, accounting/approval rules and provider gates |
| User Cal Hacks 13.0 guide | Complete pasted plain text, preserved at sources/cal-hacks-13-guide.txt | Sunday schedule, live/in-person judging, sponsor summaries; some embedded links/images lost in paste |
| [Cal Hacks official site](https://www.calhacks.io/) | Public page retrieved | In-person, team maximum and event-start implementation requirements; no authenticated Devpost countdown |
| [CREAO CalHacks2026 pack](https://community.creao.ai/CalHacks2026) | Search-indexed official page retrieved; direct open failed | Core hosted agent / actual ID and share link / visible run; track fit. Page dates differ from Sunday guide context |
| [CREAO developer v2 create](https://developer.creao.ai/docs/v2/runs/create) and [get](https://developer.creao.ai/docs/v2/runs/get) | Public indexed documentation | Prepared developer-v2 adapter contract; live account and exact successful output not verified |
| [CREAO API Trigger technical page](https://community.creao.ai/AI_hackathon_UCLA2026/tech) | Public indexed documentation for another event | Prepared optional agent-v1 contract only; **not a Cal Hacks eligibility authority**, no automatic endpoint fallback |
| [Convex Node client](https://docs.convex.dev/client/javascript/node), [mutations](https://docs.convex.dev/functions/mutation-functions), [workflows](https://docs.convex.dev/agents/workflows) | Official technical pages retrieved | Backend design and future durability/subscription direction; no deployment receipt |
| [Coinbase CalHacks PDF](https://drive.google.com/file/d/12TnPLguduV3gh1zY_TJ176XmVDz2RGW9/view) | Connected Drive readable text, title Coinbase CalHacks Challenge 2026.pdf, modified October 21, 2026 | Primary Payment Agents/submission/eligibility source. No Coinbase account or SDK execution inferred |
| [Figma challenge](https://docs.google.com/document/d/1HjzThDGveSLiilIdEPEHq12ZVLZ5eS0T8CQC5_m_-rg/edit) | Connected Drive readable text, title Cal Hacks <> Figma, modified October 24, 2026 | Replaced TBD with actual stage-log/slides/prototype/video/Edu requirements; no actual Figma use |
| [Fetch.ai CalHacks page](https://www.fetch.ai/events/calhacks-13-0) | Public official event page | New conditional agent-discovery path; prize/address details differ from supplied guide, so no payout forecast |
| [CRS sandbox entry](https://calhacks.crscreditapi.com/) | Direct page open unsuccessful; guide provides description | Catalog/test identities remain unavailable; no field or identity-type assumptions |
| [Factory docs](https://docs.factory.ai/) | Official plans page discoverable; guessed SDK overview route unsuccessful | No SDK contract or execution claimed. Only guide-grounded conditional worker design |
| Repository code/tests | Local inspected source and executed checks | Source of actual implementation/status claims; see EVALUATION.md |

## Architecture decisions

**One investigator boundary:** preserve CREAO for substantive investigation; local rules are explicitly rehearsal. Do not use another provider to pretend the mandatory dependency works.

**One selected hosted database:** Convex remains central by design. Do not add Spacetime just to collect a track. The local filesystem is an offline rehearsal implementation of the store interface and is disabled by default for production hosting.

**Money stays deterministic:** source-backed amounts, integer cents, dated obligations, narrow balanced entries, explicit exceptions. The investigator supplies cited interpretations rather than authoritative cash numbers.

**Human authority is explicit:** interpretation, proposal creation, approval, posting and scenario change remain distinct operations. Approval persists with its entry and event. No external book writes or payments are exposed to the agent.

**Provider families are explicit:** support developer-v2 and agent-v1 as separate selected adapters behind one interface. Never mix casing, forms, IDs, bases or result assumptions. Account confirmation still gates live calls.

**Failed verification changes the claim:** a malformed terminal result becomes needs_review; a failed retrieval retries the same ID; an ambiguous submission requires reconciliation. Public documentation, credentials, and mock responses never set LIVE_VERIFIED.

**New paths must earn their place:** the guide reveals possible Factory, Fetch.ai and Figma paths. They remain conditional because no meaningful runtime/tool workflow has been executed. Optional research/voice/commerce must not displace the receivables core.

## Unknowns deliberately preserved

Actual CREAO agent ID/share link/API family/input form; model trace; Convex project/deployment; current Devpost countdown and participant eligibility; full linked Hyphenate/Atlassian briefs; CRS catalog/test identities; sponsor stacking limits; customer feedback; hosting account/region; real provider costs/latencies. These are ACTION-ITEMS, not missing values to fabricate.
