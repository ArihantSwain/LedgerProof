process.env.LEDGERPROOF_OFFLINE_REHEARSAL='true';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../fixtures/agency';
import {transition} from '../lib/workflow';
import {demoCloseCsv,parseCloseCsv,reconcileClose} from '../lib/close';
import {createSession,applyCommand,readCase} from '../lib/store';
function imported(){const c=createFixture('close-test',Date.now());return transition(c,{type:'close_import',records:parseCloseCsv(demoCloseCsv),expectedCloseVersion:1,requestKey:'import-test'});}
test('net settlement reconciles gross charges, refunds and fees without duplicating revenue',()=>{
 const c=imported(),r=reconcileClose(c.close);assert.equal(r.ready,1);assert.equal(r.exceptions,2);
 const item=r.banks.find(b=>b.bank.id==='bank_oct27')!;assert.equal(item.batch?.grossCents,1000000);assert.equal(item.batch?.refundCents,30000);assert.equal(item.batch?.feeCents,3000);assert.equal(item.varianceCents,0);
 assert.equal(item.lines.reduce((s,l)=>s+l.debitCents-l.creditCents,0),0);assert.equal(item.lines.find(l=>l.account==='processor_clearing')?.creditCents,1000000);assert.equal(item.sourceIds.length,5);
 const posted=transition(c,{type:'close_approve',bankId:item.bank.id,batchId:item.batch!.id,expectedCloseVersion:c.close.version,requestKey:'approve-test',reason:'Verified source settlement'});assert.equal(posted.close.postings.length,1);assert.deepEqual(posted.entries,c.entries);assert.equal(posted.ledgerVersion,c.ledgerVersion);
});
test('missing fees never get invented; new source evidence changes the reconciliation and invalidates old reviews',()=>{
 let c=imported();const item=reconcileClose(c.close).banks.find(b=>b.bank.id==='bank_oct28')!;assert.equal(item.status,'variance');assert.equal(item.varianceCents,-5000);
 assert.throws(()=>transition(c,{type:'close_approve',bankId:item.bank.id,batchId:'payout_102',expectedCloseVersion:c.close.version,requestKey:'bad-approval',reason:'Force balance'}),/not uniquely/);
 c=transition(c,{type:'close_import',records:[{id:'fee_missing',kind:'fee',amountCents:5000,date:'2026-10-28',reference:'payout_102'}],expectedCloseVersion:c.close.version,requestKey:'new-fee-evidence'});
 assert.equal(reconcileClose(c.close).banks.find(b=>b.bank.id==='bank_oct28')?.status,'ready');
 assert.throws(()=>transition(c,{type:'close_approve',bankId:'bank_oct28',batchId:'payout_102',expectedCloseVersion:2,requestKey:'stale-review',reason:'Old inputs'}),/changed/);
});
test('ambiguous equal-amount batches and competing bank deposits cannot be approved',()=>{
 let c=imported();assert.equal(reconcileClose(c.close).banks.find(b=>b.bank.id==='bank_oct29')?.status,'ambiguous');
 assert.throws(()=>transition(c,{type:'close_approve',bankId:'bank_oct29',batchId:'payout_103',expectedCloseVersion:2,requestKey:'ambiguous-review',reason:'Guess'}),/not uniquely/);
 c=transition(c,{type:'close_import',records:[{id:'competing_bank',kind:'bank',amountCents:967000,date:'2026-10-27',reference:'payout_101'}],expectedCloseVersion:2,requestKey:'competing-source'});assert.equal(reconcileClose(c.close).banks.find(b=>b.bank.id==='bank_oct27')?.status,'ambiguous');
});
test('approved batch is immutable, decisions idempotent, malformed and duplicate imports rejected',()=>{
 let c=imported();const decision={type:'close_approve' as const,bankId:'bank_oct27',batchId:'payout_101',expectedCloseVersion:2,requestKey:'approve-test',reason:'Sources checked'};c=transition(c,decision);assert.deepEqual(transition(c,decision),c);
 assert.throws(()=>transition(c,{...decision,reason:'Different intent'}),/Idempotency/);
 assert.throws(()=>transition(c,{type:'close_import',records:[{id:'new_fee',kind:'fee',amountCents:1,date:'2026-10-27',reference:'payout_101'}],expectedCloseVersion:3,requestKey:'amend-posted'}),/immutable/);
 assert.throws(()=>transition(imported(),{type:'close_import',records:parseCloseCsv(demoCloseCsv),expectedCloseVersion:2,requestKey:'duplicate-import'}),/already imported/);
 for(const amount of ['1.01','-1','0','NaN','1e4'])assert.throws(()=>parseCloseCsv('id,kind,date,amountCents,reference\na,fee,2026-10-27,'+amount+',batch'));
 assert.throws(()=>parseCloseCsv('bad,columns\na,b'),/Expected columns/);
});
test('competing persisted close approvals create exactly one source-linked journal and preserve case isolation',async()=>{
 const a=await createSession(),b=await createSession();let c=await readCase(a);c=await applyCommand(a,{type:'close_import',records:parseCloseCsv(demoCloseCsv),expectedCloseVersion:1,requestKey:'parallel-import'});
 const decision={type:'close_approve' as const,bankId:'bank_oct27',batchId:'payout_101',expectedCloseVersion:c.close.version,reason:'Source review'};
 const attempts=await Promise.allSettled([applyCommand(a,{...decision,requestKey:'parallel-one'}),applyCommand(a,{...decision,requestKey:'parallel-two'})]);assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1);assert.equal((await readCase(a)).close.postings.length,1);assert.equal((await readCase(b)).close.records.length,0);
});
