import {mutation,query} from './_generated/server';
import {v} from 'convex/values';
import {reserveBudget,CLAUDE_CAP_MICROS,CLAUDE_CALL_CAP} from '../lib/providers/budget';
import {nativeExpense} from '../lib/evidence';
function authorize(secret:string){if(!process.env.LEDGERPROOF_BACKEND_SECRET||secret!==process.env.LEDGERPROOF_BACKEND_SECRET)throw Error('Unauthorized backend');}
export const acquire=mutation({args:{secret:v.string(),key:v.string(),caseId:v.string(),provider:v.union(v.literal('anthropic'),v.literal('crs'),v.literal('coinbase'),v.literal('x402_evidence')),reserve:v.number()},handler:async(ctx,args)=>{
 authorize(args.secret);if(!/^[a-f0-9]{64}$/.test(args.key))throw Error('Invalid job key');
 const prior=await ctx.db.query('providerJobs').withIndex('by_key',q=>q.eq('key',args.key)).unique();
 if(prior){if(prior.caseId!==args.caseId||prior.provider!==args.provider)throw Error('Job ownership mismatch');return {owner:false,job:prior};}
 const priorBudget=await ctx.db.query('providerBudgets').withIndex('by_provider',q=>q.eq('provider',args.provider)).unique();
 const budget=reserveBudget(priorBudget??{chargedMicros:0,reservedMicros:0,calls:0},args.provider,args.reserve);
 if(priorBudget)await ctx.db.patch(priorBudget._id,{chargedMicros:budget.chargedMicros,reservedMicros:budget.reservedMicros,calls:budget.calls});else await ctx.db.insert('providerBudgets',{provider:args.provider,...budget});
 const job={key:args.key,caseId:args.caseId,provider:args.provider,state:'pending' as const,reservedMicros:args.reserve,chargedMicros:0,createdAt:Date.now()};await ctx.db.insert('providerJobs',job);return {owner:true,job};
}});
export const finish=mutation({args:{secret:v.string(),key:v.string(),state:v.union(v.literal('completed'),v.literal('failed'),v.literal('unknown')),chargedMicros:v.optional(v.number()),result:v.optional(v.any()),error:v.optional(v.string())},handler:async(ctx,args)=>{
 authorize(args.secret);const job=await ctx.db.query('providerJobs').withIndex('by_key',q=>q.eq('key',args.key)).unique();if(!job)throw Error('Missing provider reservation');if(job.state!=='pending')return job;
 const budget=await ctx.db.query('providerBudgets').withIndex('by_provider',q=>q.eq('provider',job.provider)).unique();if(!budget)throw Error('Budget unavailable');
 const charge=args.chargedMicros??job.reservedMicros;if(!Number.isSafeInteger(charge)||charge<0)throw Error('Invalid provider charge');
 if(args.result&&JSON.stringify(args.result).length>100_000)throw Error('Provider result exceeds storage limit');
 await ctx.db.patch(budget._id,{reservedMicros:budget.reservedMicros-job.reservedMicros,chargedMicros:budget.chargedMicros+charge});
 const patch={state:args.state,chargedMicros:charge,...(args.result!==undefined?{result:args.result}:{}),...(args.error?{error:args.error.slice(0,500)}:{})};await ctx.db.patch(job._id,patch);return {...job,...patch};
}});
export const status=query({args:{secret:v.string(),caseId:v.string()},handler:async(ctx,args)=>{
 authorize(args.secret);const jobs=await ctx.db.query('providerJobs').withIndex('by_caseId',q=>q.eq('caseId',args.caseId)).order('desc').take(30);const budget=await ctx.db.query('providerBudgets').withIndex('by_provider',q=>q.eq('provider','anthropic')).unique();
 const evidenceBudget=await ctx.db.query('providerBudgets').withIndex('by_provider',q=>q.eq('provider','x402_evidence')).unique();
 const crsBudget=await ctx.db.query('providerBudgets').withIndex('by_provider',q=>q.eq('provider','crs')).unique();
 const crsJobs=await ctx.db.query('providerJobs').withIndex('by_provider',q=>q.eq('provider','crs')).order('desc').take(30);
 // Only official fake consumer reports are reusable; never share a case's private sources.
 const savedCrsReports=crsJobs.filter(j=>j.state==='completed'&&j.result?.subject?.kind==='official synthetic consumer').map(j=>({key:j.key,createdAt:j.createdAt,result:j.result}));
 return {savedCrsReports,crsBudget:{callCap:5,calls:crsBudget?.calls??0},evidenceBudget:{capAtomic:100000,chargedAtomic:evidenceBudget?.chargedMicros??0,reservedAtomic:evidenceBudget?.reservedMicros??0,calls:evidenceBudget?.calls??0,asset:'USDC on Base'},jobs:jobs.map(({key,provider,state,createdAt,result,error,chargedMicros})=>({key,provider,state,createdAt,result:result??null,error:error??null,chargedMicros})),claudeBudget:{capMicros:CLAUDE_CAP_MICROS,callCap:CLAUDE_CALL_CAP,chargedMicros:budget?.chargedMicros??0,reservedMicros:budget?.reservedMicros??0,calls:budget?.calls??0,scope:'This Convex deployment only; other API clients and provider billing are outside this counter.'}};
}});
export const finishEvidence=mutation({args:{secret:v.string(),key:v.string(),receiptKey:v.string(),transaction:v.string(),amountAtomic:v.number(),result:v.any(),delivered:v.boolean()},handler:async(ctx,args)=>{
 authorize(args.secret);const job=await ctx.db.query('providerJobs').withIndex('by_key',q=>q.eq('key',args.key)).unique();if(!job||job.provider!=='x402_evidence')throw Error('Missing evidence purchase');
 if(job.state==='completed'||job.state==='failed')return job;
 if(!/^eip155:8453:0x[a-fA-F0-9]{64}:\d+$/.test(args.receiptKey)||!args.receiptKey.includes(args.transaction))throw Error('Invalid chain receipt identity');
 const prior=await ctx.db.query('paymentReceipts').withIndex('by_receiptKey',q=>q.eq('receiptKey',args.receiptKey)).unique();if(prior&&prior.jobKey!==job.key)throw Error('Chain payment already assigned to another accounting case');
 const accounting=nativeExpense(args.amountAtomic,args.transaction);if(args.amountAtomic>job.reservedMicros)throw Error('Settlement exceeds purchase reservation');
 const budget=await ctx.db.query('providerBudgets').withIndex('by_provider',q=>q.eq('provider','x402_evidence')).unique();if(!budget)throw Error('Missing evidence spending ledger');
 if(!prior)await ctx.db.insert('paymentReceipts',{receiptKey:args.receiptKey,jobKey:job.key,caseId:job.caseId,amountAtomic:args.amountAtomic,asset:'USDC on Base',transaction:args.transaction,createdAt:Date.now()});
 await ctx.db.patch(budget._id,{reservedMicros:budget.reservedMicros-(job.state==='pending'?job.reservedMicros:0),chargedMicros:budget.chargedMicros-job.chargedMicros+args.amountAtomic});
 const result={...args.result,accounting};if(JSON.stringify(result).length>100_000)throw Error('Evidence result exceeds limit');
 const patch={state:args.delivered?'completed' as const:'failed' as const,chargedMicros:args.amountAtomic,result};await ctx.db.patch(job._id,patch);return {...job,...patch};
}});
