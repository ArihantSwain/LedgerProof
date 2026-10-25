import {mkdir,writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {createFixture} from '../fixtures/agency';
import {evidenceBundle} from '../lib/investigation';
import {resultSchema} from '../lib/contracts';
await mkdir('fixtures/creao',{recursive:true});
for(const amount of [800000,600000]){
 const c=createFixture('manual-creao-contract-test',Date.UTC(2026,9,24));c.inputVersion=2;
 c.invoices=c.invoices.slice(0,1);c.receipts=[];c.entries=c.entries.filter(e=>['opening','entry-invoice-0'].includes(e.id));c.documents=c.documents.filter(d=>d.id==='doc-inv-0');
 c.documents.push({id:'test-credit-document',filename:'issued-credit.pdf',mime:'application/pdf',sha256:'synthetic-manual-fixture',uploadedAt:c.createdAt,kind:'credit_note',text:`Type: credit_note\nInvoice: INV-A\nCurrency: USD\nAmountCents: ${amount}\nDate: 2026-10-26`});
 c.credits=[{id:'test-credit',invoiceId:'invoice-0',amountCents:amount,date:'2026-10-26',evidenceId:'test-credit-document',approved:false}];
 await writeFile(`fixtures/creao/input-credit-${amount/100}.json`,JSON.stringify(evidenceBundle(c),null,2)+'\n');
}
await writeFile('fixtures/creao/output-schema.json',JSON.stringify(z.toJSONSchema(resultSchema),null,2)+'\n');
await writeFile('fixtures/creao/README.md','# Manual CREAO changed-input test\n\nThese are **synthetic test inputs and acceptance expectations**, not provider output. No hosted run has been made. Each bundle has exactly two evidence documents: INV-A and an issued credit. Supply the JSON as the agent’s bundle input.\n\nCompare input-credit-8000.json and input-credit-6000.json. Expected: source-bound unapplied-credit finding with affected IDs test-credit / invoice-0 and evidence refs test-credit-document / doc-inv-0, schemaVersion 1 and inputVersion 2. The summary should reflect the supplied amount; no automatic approval or posting. App-calculated remaining balances are $12,000 and $14,000. The exact output schema is output-schema.json.\n\nSave actual sanitized outputs, provider IDs, model trace and share links separately after execution. Do not rename these inputs or expectations as successful run evidence.\n');
console.log('Prepared two bounded evidence bundles and the exact agent result JSON schema. No provider calls.');
