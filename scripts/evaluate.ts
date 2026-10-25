import {createFixture} from '../fixtures/agency';
import {localRehearsal,validateResult} from '../lib/investigation';
import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
const c=createFixture('evaluation',Date.UTC(2026,9,24));
c.credits.push({id:'eval-credit',invoiceId:'invoice-0',amountCents:800000,date:'2026-10-26',evidenceId:'eval-credit-doc',approved:false});
c.documents.push({id:'eval-credit-doc',filename:'credit.pdf',mime:'application/pdf',sha256:'synthetic-evaluation',text:'Type: credit_note\nInvoice: INV-A\nCurrency: USD\nAmountCents: 800000\nDate: 2026-10-26',uploadedAt:c.createdAt,kind:'credit_note'});
const started=performance.now();const result=validateResult(c,localRehearsal(c));const latency=performance.now()-started;
// Declared independently of rule code: known authored fixture errors and benign partial.
const expected=[['unapplied_credit_note','eval-credit'],['unmatched_receipt','receipt-unmatched'],['duplicate_invoice','entry-duplicate']];
const detected=expected.filter(([type,id])=>result.findings.some(f=>f.type===type&&f.affectedRecordIds.includes(id))).length;
const anomalies=result.findings.filter(f=>f.type!=='partial_payment');
const report={mode:'LOCAL_REHEARSAL',scope:'One authored synthetic agency; offline rule evaluation, no LLM/provider/extraction accuracy claim',invoiceCount:10,cleanNegativeInvoices:7,knownAnomalies:3,supportedAnomalies:detected,missedAnomalies:expected.length-detected,falsePositiveAnomalies:anomalies.filter(f=>!expected.some(([type,id])=>f.type===type&&f.affectedRecordIds.includes(id))).length,benignPartialPaymentFindings:result.findings.filter(f=>f.type==='partial_payment').length,validationFailures:0,localElapsedMs:Number(latency.toFixed(3)),liveProviderLatencyMs:null};
await writeFile('docs/evaluation-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
