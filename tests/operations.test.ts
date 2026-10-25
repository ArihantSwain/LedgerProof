process.env.LEDGERPROOF_OFFLINE_REHEARSAL='true';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../fixtures/agency';
import {transition} from '../lib/workflow';
import {caseSchema,type Case} from '../lib/contracts';
import {operationsCommandSchema} from '../lib/contracts/operations';
import {projectOperations,recoveryOptions,operationsSummary,planIsCurrent} from '../lib/operations';
import {createSession,readCase,applyCommand} from '../lib/store';
let sequence=0;
function command(c:Case,body:Record<string,unknown>){return operationsCommandSchema.parse({requestKey:'ops-request-'+(++sequence),expectedOperationsVersion:c.operations.version,expectedInputVersion:c.inputVersion,expectedLedgerVersion:c.ledgerVersion,...body});}
function apply(c:Case,body:Record<string,unknown>){return transition(c,command(c,body));}
function disrupted(){let c=createFixture('ops',Date.now());c=apply(c,{type:'ops_shock',kind:'collection_delay',invoiceId:'invoice-0',date:'2026-11-09',label:'Customer late'});return apply(c,{type:'ops_shock',kind:'unexpected_expense',date:'2026-10-29',amountCents:300000,label:'Emergency repair'});}

test('disruptions expose payroll risk without changing actual ledger or original scenario',()=>{
 const base=createFixture('base',Date.now());const c=disrupted();const p=projectOperations(c);
 assert.equal(p.weeks[1].closingCents,-700000);assert.equal(p.payroll[1].covered,false);
 assert.equal(projectOperations(base).weeks[1].closingCents,1600000);
 assert.deepEqual(c.entries,base.entries);assert.deepEqual(c.scenarios,base.scenarios);
 assert.equal(c.obligations.length,base.obligations.length);assert.equal(c.inputVersion,1);assert.equal(c.ledgerVersion,1);
});
test('partial recovery conserves total collections and leaves remaining balance at original date',()=>{
 const c=disrupted();const option=recoveryOptions(c).find(o=>o.id==='split-collection')!;
 assert.equal(option.actions[0].kind,'collect');assert.equal(option.resolvesGap,true);
 const cash=option.projected.weeks.flatMap(w=>w.contributions).filter(f=>f.id==='invoice-0');
 assert.equal(cash.reduce((s,f)=>s+f.amountCents,0),2000000);assert.equal(cash.length,2);
 assert.ok(cash.some(f=>f.date==='2026-11-09'));assert.ok(option.projected.payroll.every(p=>p.covered));
 assert.equal(option.projected.minimumCashCents,0);
});
test('vendor timing keeps the full bill, never delays payroll, and flags incomplete spending-only plan',()=>{
 const c=disrupted();const options=recoveryOptions(c);const vendor=options.find(o=>o.id==='vendor-and-collection')!;
 const shock=c.operations.shocks.find(s=>s.kind==='unexpected_expense')!;
 assert.equal(vendor.projected.weeks.flatMap(w=>w.contributions).filter(f=>f.id===shock.id).reduce((s,f)=>s+f.amountCents,0),-300000);
 assert.equal(options.find(o=>o.id==='reduce-discretionary')!.resolvesGap,false);
 assert.throws(()=>projectOperations(c,[{kind:'defer_expense',obligationId:'payroll-1',date:'2026-11-09'}]),/Payroll/);
 assert.throws(()=>projectOperations(c,[{kind:'reduce_expense',obligationId:'payroll-2',amountCents:1}]),/Payroll/);
});
test('daily payroll checks detect a shortfall hidden by a later receipt in the same week',()=>{
 const c=createFixture('daily',Date.now());c.invoices[0].expectedDate='2026-11-08';
 const p=projectOperations(c);assert.equal(p.weeks[1].closingCents,1600000);
 assert.equal(p.payroll[1].covered,false);assert.equal(p.minimumCashCents,-400000);assert.ok(recoveryOptions(c).length>0);
});
test('plan approval prepares drafts, preserves history, repeats idempotently and rejects stale drafts',()=>{
 let c=disrupted();const ledger=structuredClone(c.entries);c=apply(c,{type:'ops_save_plan',optionId:'split-collection'});
 const p=c.operations.plans[0];assert.equal(c.operations.drafts.length,0);
 const approve=command(c,{type:'ops_plan_decision',planId:p.id,status:'approved',reason:'Checked the assumptions'});
 c=transition(c,approve);assert.equal(c.operations.drafts.length,1);assert.equal(c.operations.drafts[0].status,'draft');
 assert.match(c.operations.drafts[0].body,/not a statement that you have agreed/);assert.deepEqual(c.entries,ledger);
 assert.equal(transition(c,approve).operations.drafts.length,1);assert.equal(operationsSummary(c).activePlanId,p.id);
 c=apply(c,{type:'ops_shock',kind:'unexpected_expense',date:'2026-11-05',amountCents:10000,label:'New fact to model'});
 assert.equal(planIsCurrent(c,c.operations.plans[0]),false);assert.equal(operationsSummary(c).activePlanId,null);
 assert.throws(()=>apply(c,{type:'ops_draft_decision',draftId:c.operations.drafts[0].id,status:'approved',reason:'Stale'}),/stale/);
});
test('draft edits and approvals remain local and a withdrawn plan invalidates prepared work',()=>{
 let c=apply(disrupted(),{type:'ops_save_plan',optionId:'collect-full'});const p=c.operations.plans[0];
 c=apply(c,{type:'ops_plan_decision',planId:p.id,status:'approved',reason:'Review complete'});
 const draft=c.operations.drafts[0];c=apply(c,{type:'ops_edit_draft',draftId:draft.id,recipient:'Aster finance contact',subject:'Payment timing',body:'Please confirm the arrangement.'});
 c=apply(c,{type:'ops_draft_decision',draftId:draft.id,status:'approved',reason:'Ready for manual follow-up'});
 assert.equal(c.operations.drafts[0].status,'approved');assert.equal('sentAt' in c.operations.drafts[0],false);
 c=apply(c,{type:'ops_plan_decision',planId:p.id,status:'rejected',reason:'Vendor/customer did not agree'});
 assert.equal(c.operations.drafts[0].status,'rejected');assert.equal(operationsSummary(c).activePlanId,null);
});
test('changed amounts recompute options and reserve thresholds; collection cannot exceed available cash',()=>{
 let c=disrupted();const first=recoveryOptions(c).find(o=>o.id==='split-collection')!.actions[0];assert.ok(first.kind==='collect');assert.equal(first.amountCents,700000);
 c=apply(c,{type:'ops_reserve',amountCents:500000});const next=recoveryOptions(c).find(o=>o.id==='split-collection')!.actions[0];assert.ok(next.kind==='collect');assert.equal(next.amountCents,1200000);
 assert.throws(()=>projectOperations(c,[{kind:'collect',invoiceId:'invoice-0',amountCents:2000001,date:'2026-11-06'}]),/allocation/);
 assert.throws(()=>projectOperations(c,[{kind:'collect',invoiceId:'invoice-0',amountCents:100,date:'2026-11-06'},{kind:'collect',invoiceId:'invoice-0',amountCents:100,date:'2026-11-06'}]),/duplicate/);
});
test('planning version, source version and request-key guards prevent stale or replayed intent',()=>{
 let c=disrupted();const save=command(c,{type:'ops_save_plan',optionId:'split-collection'});c=apply(c,{type:'ops_reserve',amountCents:1});assert.throws(()=>transition(c,save),/Planning inputs/);
 const stale=command(c,{type:'ops_save_plan',optionId:'split-collection'});c=transition(c,{type:'edit_invoice',invoiceId:'invoice-0',amountCents:2100000});assert.throws(()=>transition(c,stale),/Evidence or ledger/);
 const note=command(c,{type:'ops_comment',role:'owner',text:'Do not send until confirmed'});c=transition(c,note);assert.equal(transition(c,note).operations.comments.length,1);
 assert.throws(()=>transition(c,operationsCommandSchema.parse({...note,text:'Changed'})),/idempotency/);
});
test('legacy cases migrate to empty operations; reset discards planning state',()=>{
 const old:Record<string,unknown>={...createFixture('legacy',Date.now())};delete old.operations;
 let c=caseSchema.parse(old);assert.equal(c.operations.version,1);c=apply(c,{type:'ops_comment',role:'bookkeeper',text:'Untrusted <script> text stays data'});
 c=transition(c,{type:'reset'});assert.equal(c.operations.comments.length,0);assert.equal(c.operations.plans.length,0);
});
test('concurrent competing plan approvals select one plan and scope decision-room notes',async()=>{
 const a=await createSession(),b=await createSession();let c=await readCase(a);
 c=await applyCommand(a,command(c,{type:'ops_shock',kind:'collection_delay',invoiceId:'invoice-0',date:'2026-11-09',label:'Late customer'}));
 c=await applyCommand(a,command(c,{type:'ops_save_plan',optionId:'collect-full'}));c=await applyCommand(a,command(c,{type:'ops_save_plan',optionId:'split-collection'}));
 const results=await Promise.allSettled(c.operations.plans.map(p=>applyCommand(a,command(c,{type:'ops_plan_decision',planId:p.id,status:'approved',reason:'Reviewed'}))));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);c=await readCase(a);assert.equal(c.operations.plans.filter(p=>p.status==='approved').length,1);
 await applyCommand(a,command(c,{type:'ops_comment',role:'owner',text:'Scoped note'}));assert.equal((await readCase(b)).operations.comments.length,0);
});
