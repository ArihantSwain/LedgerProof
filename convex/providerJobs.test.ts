/// <reference types="vite/client" />
import {test,expect,beforeEach} from 'vitest';
import {convexTest} from 'convex-test';
import schema from './schema';
import {api} from './_generated/api';
const modules=import.meta.glob('./**/*.ts');
const secret='test-only-provider-budget-secret';
beforeEach(()=>{process.env.LEDGERPROOF_BACKEND_SECRET=secret;});
test('service readiness exposes the request allowance and reusable official synthetic CRS reports only',async()=>{
 const t=convexTest(schema,modules);
 await t.run(async ctx=>{
  await ctx.db.insert('providerBudgets',{provider:'crs',chargedMicros:0,reservedMicros:0,calls:5});
  for(const [key,kind] of [['a','official synthetic consumer'],['b','private consumer']] as const)await ctx.db.insert('providerJobs',{key:key.repeat(64),provider:'crs',caseId:'another-case',state:'completed',reservedMicros:0,chargedMicros:0,createdAt:100,result:{subject:{id:'P01',kind},report:{scores:[]}}});
 });
 const status=await t.query(api.providerJobs.status,{secret,caseId:'case-a'});expect(status.crsBudget.calls).toBe(5);expect(status.savedCrsReports).toHaveLength(1);expect(status.savedCrsReports[0].result.subject.kind).toBe('official synthetic consumer');expect(status.jobs).toHaveLength(0);
});
test('parallel job acquisition reserves once and repeated settlement charges once',async()=>{
 const t=convexTest(schema,modules);const args={secret,provider:'anthropic' as const,caseId:'case-a',key:'a'.repeat(64),reserve:100000};
 const claims=await Promise.all(Array.from({length:6},()=>t.mutation(api.providerJobs.acquire,args)));expect(claims.filter(c=>c.owner)).toHaveLength(1);
 let status=await t.query(api.providerJobs.status,{secret,caseId:'case-a'});expect(status.claudeBudget.reservedMicros).toBe(100000);expect(status.claudeBudget.calls).toBe(1);
 await Promise.all(Array.from({length:3},()=>t.mutation(api.providerJobs.finish,{secret,key:args.key,state:'completed',chargedMicros:13318,result:{verified:true}})));
 status=await t.query(api.providerJobs.status,{secret,caseId:'case-a'});expect(status.claudeBudget.chargedMicros).toBe(13318);expect(status.claudeBudget.reservedMicros).toBe(0);expect(status.jobs).toHaveLength(1);
 expect((await t.query(api.providerJobs.status,{secret,caseId:'case-b'})).jobs).toHaveLength(0);
 await expect(t.mutation(api.providerJobs.acquire,{...args,caseId:'case-b'})).rejects.toThrow('ownership');
 await expect(t.query(api.providerJobs.status,{secret:'wrong',caseId:'case-a'})).rejects.toThrow('Unauthorized');
});
test('credit cap rejects a new reservation atomically without creating an executable job',async()=>{
 const t=convexTest(schema,modules);await t.run(async ctx=>{await ctx.db.insert('providerBudgets',{provider:'anthropic',chargedMicros:4_950_000,reservedMicros:0,calls:10});});
 await expect(t.mutation(api.providerJobs.acquire,{secret,provider:'anthropic',caseId:'case-a',key:'b'.repeat(64),reserve:100000})).rejects.toThrow('cap reached');
 const status=await t.query(api.providerJobs.status,{secret,caseId:'case-a'});expect(status.jobs).toHaveLength(0);expect(status.claudeBudget.calls).toBe(10);expect(status.claudeBudget.chargedMicros).toBe(4_950_000);
});
test('unknown provider outcome keeps the full reservation charged and is never acquired again',async()=>{
 const t=convexTest(schema,modules);const args={secret,provider:'anthropic' as const,caseId:'case-a',key:'c'.repeat(64),reserve:100000};await t.mutation(api.providerJobs.acquire,args);
 await t.mutation(api.providerJobs.finish,{secret,key:args.key,state:'unknown',error:'Transport interrupted; provider charge unknown'});
 const retry=await t.mutation(api.providerJobs.acquire,args);expect(retry.owner).toBe(false);expect(retry.job.state).toBe('unknown');
 const status=await t.query(api.providerJobs.status,{secret,caseId:'case-a'});expect(status.claudeBudget.chargedMicros).toBe(100000);expect(status.claudeBudget.reservedMicros).toBe(0);expect(status.claudeBudget.calls).toBe(1);
});
test('verified evidence payment produces one exact expense journal; the chain receipt cannot be booked into another case',async()=>{
 const t=convexTest(schema,modules),transaction='0x'+'d'.repeat(64),receiptKey=`eip155:8453:${transaction}:0`;
 const first={secret,provider:'x402_evidence' as const,caseId:'case-a',key:'d'.repeat(64),reserve:10000};await t.mutation(api.providerJobs.acquire,first);
 await t.mutation(api.providerJobs.finish,{secret,key:first.key,state:'unknown',result:{receipt:{transaction}}});
 const settled=await t.mutation(api.providerJobs.finishEvidence,{secret,key:first.key,receiptKey,transaction,amountAtomic:7000,result:{chainVerified:true,sources:[{id:'source'}]},delivered:true});
 expect(settled.result.accounting.lines[0].debitAtomic).toBe(7000);let status=await t.query(api.providerJobs.status,{secret,caseId:'case-a'});expect(status.evidenceBudget.chargedAtomic).toBe(7000);expect(status.evidenceBudget.reservedAtomic).toBe(0);
 await t.mutation(api.providerJobs.finishEvidence,{secret,key:first.key,receiptKey,transaction,amountAtomic:7000,result:{chainVerified:true},delivered:true});
 const second={...first,caseId:'case-b',key:'e'.repeat(64)};await t.mutation(api.providerJobs.acquire,second);
 await expect(t.mutation(api.providerJobs.finishEvidence,{secret,key:second.key,receiptKey,transaction,amountAtomic:7000,result:{chainVerified:true},delivered:true})).rejects.toThrow('another accounting case');
 status=await t.query(api.providerJobs.status,{secret,caseId:'case-a'});expect(status.evidenceBudget.chargedAtomic).toBe(7000);expect(status.evidenceBudget.reservedAtomic).toBe(10000);
 expect(await t.run(async ctx=>(await ctx.db.query('paymentReceipts').collect()).length)).toBe(1);
});
