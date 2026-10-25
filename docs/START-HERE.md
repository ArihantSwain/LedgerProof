# LedgerProof: start here

Live demo: **https://ledgerproof-one.vercel.app**. Click **Start finance demo**. Judges need no account.

Fresh checkout: use Node 22, run `npm ci` then `npm run demo`, and open http://localhost:3000. No keys are required for sample investigations. Live services are clearly disabled when unavailable.

[Download 90 judging documents](https://ledgerproof-one.vercel.app/examples/ledgerproof-judge-pack.zip) · [Example workflows and expected outcomes](../public/examples/README.md)

LedgerProof helps a small business explain its money, review accounting corrections, and understand what cash it can count on.

There are two pages:

- **Cash forecast** — the landing page. Thirteen weeks of cash, payroll coverage, and a week-by-week cash bridge. Expand **Test a cash disruption** to model a delayed payment or unexpected expense.
- **Accounting workbench** — reconcile deposits, investigate receivables, inspect sources, and approve entries in one place. AI review, vendor context, payment-term checks, and follow-up plans expand only when needed.

## Short demonstration

1. Start on **Cash forecast** and explain the expected cash after week two.
2. Open **Accounting workbench** and click **Load sample settlement**. Explain $10,000 charges − $300 refunds − $30 fees = $9,670. The other deposits retain their missing-evidence and ambiguous-match exceptions.
3. Inspect the journal and approve it. Open **Receivables and corrections** for the credit-note → **Utilize our agent** → human approval flow. For local practice, **Run sample investigation** provides an explicitly simulated result. **Accounting review** asks Claude for a source-based explanation.
4. Return to **Cash forecast**. Expand **Test a cash disruption** and model a late customer payment and an unexpected expense.
5. Open **Compare a recovery plan** to return to the workbench. Prepare and approve a conditional plan, then inspect its unsent follow-up draft.

Optional checks remain in the same workbench:

- **Find missing vendor context**: Exa supplies public vendor documentation; Coinbase CDP and x402 handle an approved purchase. Inspect the live wallet and unpaid quote. A real paid delivery still awaits wallet funding; do not claim settlement.
- **Check payment terms**: CRS returns official synthetic consumer reports, separately from Cedar’s business customers. It never automatically approves credit or changes an invoice.
- **How the tools help with this work**: short provider responsibilities and limitations. Convex persists the shared record and provider budgets.

The accounting engine calculates amounts; agents interpret evidence. Financial changes require human review. Draft approvals never send messages. Scenario changes do not rewrite posted transactions.

Legacy `/ledger` and `/operations` links redirect into the two-page experience. Current service evidence is in [integration status](integration-status.md).
