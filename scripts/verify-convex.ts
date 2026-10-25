import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {ConvexClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
import {createSession,readCase,applyCommand,tokenHash} from '../lib/store';
import {operationsCommandSchema} from '../lib/contracts/operations';
import {operationsSummary} from '../lib/operations';
import type {Case} from '../lib/contracts';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
if(!process.env.CONVEX_URL||!process.env.LEDGERPROOF_BACKEND_SECRET)throw Error('Configure Convex first');
let seq=0;
const command=(c:Case,body:Record<string,unknown>)=>operationsCommandSchema.parse({requestKey:'live-convex-'+Date.now()+'-'+(++seq),expectedOperationsVersion:c.operations.version,expectedInputVersion:c.inputVersion,expectedLedgerVersion:c.ledgerVersion,...body});
const a=await createSession(),b=await createSession();let c=await readCase(a);assert.equal(c.mode,'CONVEX');
await assert.rejects(()=>readCase({...a,token:b.token}));
c=await applyCommand(a,command(c,{type:'ops_shock',kind:'collection_delay',invoiceId:'invoice-0',date:'2026-11-09',label:'Live sandbox customer delay'}));
c=await applyCommand(a,command(c,{type:'ops_shock',kind:'unexpected_expense',date:'2026-10-29',amountCents:300000,label:'Live synthetic repair'}));
assert.equal(operationsSummary(c).stressed.weeks[1].closingCents,-700000);
c=await applyCommand(a,command(c,{type:'ops_save_plan',optionId:'split-collection'}));c=await applyCommand(a,command(c,{type:'ops_save_plan',optionId:'collect-full'}));
const attempts=await Promise.allSettled(c.operations.plans.map(p=>applyCommand(a,command(c,{type:'ops_plan_decision',planId:p.id,status:'approved',reason:'Live synthetic verification'}))));
assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);c=await readCase(a);
assert.equal(c.operations.plans.filter(p=>p.status==='approved').length,1);assert.equal(c.operations.drafts.length,1);
const clients=[new ConvexClient(process.env.CONVEX_URL),new ConvexClient(process.env.CONVEX_URL)];
try{
 const expected=c.revision+1;
 const updates=clients.map(client=>new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Native subscription deadline')),20000);
  client.onUpdate(makeFunctionReference<'query'>('cases:read'),{secret:process.env.LEDGERPROOF_BACKEND_SECRET!,caseId:a.caseId,tokenHash:tokenHash(a.token)},(value:unknown)=>{if((value as Case).revision>=expected){clearTimeout(timer);resolve();}},error=>{clearTimeout(timer);reject(error);});
 }));
 c=await applyCommand(a,command(c,{type:'ops_comment',role:'bookkeeper',text:'Native two-client sync verification'}));
 await Promise.all(updates);
}finally{await Promise.all(clients.map(client=>client.close()));}
assert.equal((await readCase(b)).operations.comments.length,0);
await mkdir('docs/evidence',{recursive:true});
await writeFile('docs/evidence/convex-verification.json',JSON.stringify({provider:'Convex',status:'LIVE_VERIFIED',verifiedAt:new Date().toISOString(),deploymentURL:process.env.CONVEX_URL,checks:{createRead:true,wrongCapabilityDenied:true,conditionalRecoveryMath:true,concurrentPlanApprovalOnce:true,draftPersisted:true,twoNativeSubscriptionClients:true,unrelatedCaseIsolated:true},limitations:['Browser UI currently polls; native subscriptions were verified with two Node clients.','Synthetic records only.','Workflow component and file-storage roundtrip are not verified by this script.']},null,2)+'\n');
console.log('Convex LIVE_VERIFIED: persisted synthetic cases, concurrent approval, draft, isolation, two native subscriptions. No session secrets printed.');
