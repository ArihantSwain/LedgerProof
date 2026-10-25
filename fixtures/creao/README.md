# Manual CREAO changed-input test

These are **synthetic test inputs and acceptance expectations**, not provider output. No hosted run has been made. Each bundle has exactly two evidence documents: INV-A and an issued credit. Supply the JSON as the agent’s bundle input.

Compare input-credit-8000.json and input-credit-6000.json. Expected: source-bound unapplied-credit finding with affected IDs test-credit / invoice-0 and evidence refs test-credit-document / doc-inv-0, schemaVersion 1 and inputVersion 2. The summary should reflect the supplied amount; no automatic approval or posting. App-calculated remaining balances are $12,000 and $14,000. The exact output schema is output-schema.json.

Save actual sanitized outputs, provider IDs, model trace and share links separately after execution. Do not rename these inputs or expectations as successful run evidence.
