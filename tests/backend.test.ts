process.env.LEDGERPROOF_OFFLINE_REHEARSAL='true';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSession,readCase,applyCommand} from '../lib/store';
import {parseUpload,documentPdf} from '../lib/documents';
import {localRehearsal} from '../lib/investigation';
import {createFixture} from '../fixtures/agency';
import {forecast} from '../lib/finance';

test('actual PDF and CSV extraction, limited schema, unsupported formats/currency',async()=>{
 const c=createFixture('parse',Date.now());const bytes=await documentPdf('Type: credit_note\nInvoice: INV-A\nCurrency: USD\nAmountCents: 800000\nDate: 2026-10-26');
 const r=await parseUpload(bytes,'credit.pdf','application/pdf',c);assert.equal(r.credit?.amountCents,800000);assert.equal(r.credit?.approved,false);assert.ok(r.document.text.includes('INV-A'));assert.ok(bytes.length>0);
 const csv=new TextEncoder().encode('externalId,invoiceNumber,postedDate,amountCents\nnew-123,INV-003,2026-10-26,50000');const receipt=await parseUpload(csv,'receipt.csv','text/csv',c);assert.equal(receipt.receipt?.amountCents,50000);
 await assert.rejects(()=>parseUpload(bytes,'evil.exe','application/pdf',c),/Supported/);
 await assert.rejects(()=>parseUpload(awaitableBytes(),'bad.pdf','application/pdf',c),/Invalid PDF/);
 const eur=await documentPdf('Type: credit_note\nInvoice: INV-A\nCurrency: EUR\nAmountCents: 800000\nDate: 2026-10-26');await assert.rejects(()=>parseUpload(eur,'eur.pdf','application/pdf',c),/USD/);
});
function awaitableBytes(){return new Uint8Array([1,2,3]);}
test('store rejects wrong capability, serializes competing approvals, persists same shared state',async()=>{
 const a=await createSession();const b=await createSession();let c=await readCase(a);await assert.rejects(()=>readCase({...a,token:b.token}),/Session unavailable/);
 const parsed=await parseUpload(await documentPdf('Type: credit_note\nInvoice: INV-A\nCurrency: USD\nAmountCents: 800000\nDate: 2026-10-26'),'credit.pdf','application/pdf',c);
 c=await applyCommand(a,{type:'upload_credit',document:parsed.document,credit:parsed.credit!});
 c=await applyCommand(a,{type:'start_run',run:{id:'test-run',inputVersion:c.inputVersion,generation:c.generation,mode:'LOCAL_REHEARSAL',state:'queued',startedAt:Date.now()}});
 c=await applyCommand(a,{type:'apply_result',runId:'test-run',generation:c.generation,result:localRehearsal(c)});
 const p=c.proposals.find(p=>p.kind==='credit')!;const decision={type:'decision' as const,proposalId:p.id,status:'approved' as const,expectedLedgerVersion:c.ledgerVersion,requestKey:'reviewer-one',reason:'Verified source'};
 const attempts=await Promise.allSettled([applyCommand(a,decision),applyCommand(a,{...decision,requestKey:'reviewer-two'})]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
 c=await readCase(a);assert.equal(c.entries.filter(e=>e.id===p.entry.id).length,1);assert.equal(forecast(c).weeks[1].closingCents,800000);assert.equal((await readCase(b)).credits.length,0);assert.equal((await applyCommand(a,decision)).entries.length,c.entries.length);
 const prior=c.generation;await applyCommand(a,{type:'reset'});const late=await applyCommand(a,{type:'apply_result',runId:'test-run',generation:prior,result:localRehearsal(c)});assert.equal(late.credits.length,0);assert.equal(late.generation,prior+1);
});
