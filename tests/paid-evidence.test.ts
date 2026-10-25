import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodePaymentRequiredHeader} from '@x402/core/http';
import {encodeAbiParameters,encodeEventTopics,type Log} from 'viem';
import {selectExaQuote,validateExaDelivery,verifyTransfer,probeExa,EXA_URL,EXA_PAY_TO,BASE_USDC} from '../lib/providers/paid-evidence';
import {evidenceNeed,researchRequest,nativeExpense} from '../lib/evidence';
import {createFixture} from '../fixtures/agency';
import {transition} from '../lib/workflow';
import {reserveBudget} from '../lib/providers/budget';
const charge={id:'charge-github',description:'PRIVATE BANK REFERENCE 12345',amountCents:7234,date:'2026-10-24',merchantId:'github' as const,localEvidence:''};
const terms={scheme:'exact',network:'eip155:8453' as const,amount:'7000',asset:BASE_USDC,payTo:EXA_PAY_TO,maxTimeoutSeconds:60,extra:{name:'USD Coin',version:'2'}};
const required={x402Version:2 as const,resource:{url:EXA_URL,description:'Exa search',mimeType:'application/json'},accepts:[terms]};
test('real-provider quote policy pins merchant, network, asset, exact scheme and sub-cent price ceiling',()=>{
 assert.equal(selectExaQuote(required).amountAtomic,7000);
 for(const changed of [{network:'eip155:84532'},{scheme:'upto'},{amount:'10001'},{amount:'-1'},{amount:'0'},{payTo:'0x'+'a'.repeat(40)},{asset:'0x'+'b'.repeat(40)},{maxTimeoutSeconds:604900}])assert.throws(()=>selectExaQuote({...required,accepts:[{...terms,...changed}]}),/no approved/);
 assert.throws(()=>selectExaQuote({...required,resource:{url:'https://other.example/search'}}));
 assert.throws(()=>reserveBudget({chargedMicros:95000,reservedMicros:0,calls:1},'x402_evidence',10000),/cap reached/);
});
test('unpaid HTTP402 probe discloses only public vendor context and never a bank description, amount or API credential',async()=>{
 const original=globalThis.fetch,saved=process.env.LEDGERPROOF_OFFLINE_REHEARSAL;delete process.env.LEDGERPROOF_OFFLINE_REHEARSAL;
 try{let count=0;globalThis.fetch=async(url,init)=>{count++;assert.equal(String(url),EXA_URL);const text=String(init?.body);assert.ok(!text.includes(charge.description));assert.ok(!text.includes(String(charge.amountCents)));assert.ok(!new Headers(init?.headers).has('x-api-key'));assert.equal(init?.redirect,'error');assert.deepEqual(JSON.parse(text).includeDomains,['docs.github.com']);return new Response(null,{status:402,headers:{'PAYMENT-REQUIRED':encodePaymentRequiredHeader(required)}});};
 const quote=await probeExa(charge);assert.equal(quote.terms.amountAtomic,7000);assert.equal(quote.status,'LIVE_QUOTE_VERIFIED');assert.equal(count,1);
 await assert.rejects(()=>probeExa({...charge,localEvidence:'Receipt already available'}),/Local evidence/);assert.equal(count,1);
 process.env.LEDGERPROOF_OFFLINE_REHEARSAL='true';await assert.rejects(()=>probeExa(charge),/disabled/);assert.equal(count,1);
 }finally{globalThis.fetch=original;if(saved===undefined)delete process.env.LEDGERPROOF_OFFLINE_REHEARSAL;else process.env.LEDGERPROOF_OFFLINE_REHEARSAL=saved;}
});
test('local evidence avoids buying context; approval binds a source version and expires',()=>{
 assert.equal(evidenceNeed(charge).needsPurchase,true);assert.equal(evidenceNeed({...charge,localEvidence:'Invoice attached'}).needsPurchase,false);assert.equal(JSON.stringify(researchRequest(charge)).includes('12345'),false);
 const now=Date.now();let c=createFixture('evidence-approvals',now);c=transition(c,{type:'evidence_add_charge',expectedEvidenceVersion:1,requestKey:'add-charge-test',charge},now);
 const auth={type:'evidence_authorize' as const,expectedEvidenceVersion:2,requestKey:'authorize-test',id:'a'.repeat(64),chargeId:charge.id,amountAtomic:7000,expiresAt:now+60000,reason:'Official billing context needed'};const approved=transition(c,auth,now);assert.equal(approved.evidencePurchases.authorizations[0].sourceVersion,3);assert.deepEqual(transition(approved,auth,now),approved);
 assert.throws(()=>transition(c,{...auth,expiresAt:now-1},now),/expire/);
 assert.throws(()=>transition(c,{...auth,expectedEvidenceVersion:1},now),/changed/);
 c=transition(c,{type:'evidence_attach_local',chargeId:charge.id,text:'Receipt is now available',expectedEvidenceVersion:2,requestKey:'attach-receipt'},now);
 assert.throws(()=>transition(c,{...auth,expectedEvidenceVersion:3},now),/local evidence/);
});
test('delivery must contain nonempty official vendor sources; search is never treated as proof of a charge',()=>{
 const raw={results:[{title:'GitHub billing documentation',url:'https://docs.github.com/en/billing',text:'Subscription and usage information'}],requestId:'provider-request'};const r=validateExaDelivery(raw,charge,'abc123');assert.equal(r.sources[0].id,'exa_abc123_0');assert.equal(r.requestId,'provider-request');
 for(const url of ['http://docs.github.com/en/billing','https://docs.github.com.evil.example/billing','https://evil.example/billing','https://user:password@docs.github.com/billing'])assert.throws(()=>validateExaDelivery({results:[{...raw.results[0],url}]},charge,'abc123'),/outside/);
 assert.throws(()=>validateExaDelivery({results:[]},charge,'abc123'));assert.throws(()=>validateExaDelivery({results:[{...raw.results[0],text:''}]},charge,'abc123'),/empty/);
});
test('chain Transfer binds asset, payer, payee and amount; exact atomic-unit accounting preserves sub-cent costs',()=>{
 const buyer='0x'+'1'.repeat(40) as `0x${string}`;const abi=[{type:'event',name:'Transfer',inputs:[{name:'from',type:'address',indexed:true},{name:'to',type:'address',indexed:true},{name:'value',type:'uint256',indexed:false}]}] as const;
 const log:Log={address:BASE_USDC,topics:encodeEventTopics({abi,eventName:'Transfer',args:{from:buyer,to:EXA_PAY_TO}}) as Log['topics'],data:encodeAbiParameters([{type:'uint256'}],[7000n]),logIndex:0,blockHash:null,blockNumber:null,transactionHash:('0x'+'a'.repeat(64)) as `0x${string}`,transactionIndex:0,removed:false};
 assert.equal(verifyTransfer([log],buyer,7000).amountAtomic,7000);assert.throws(()=>verifyTransfer([log],buyer,6999),/exceeds/);assert.throws(()=>verifyTransfer([log],'0x'+'2'.repeat(40),7000),/uniquely/);assert.throws(()=>verifyTransfer([log,log],buyer,7000),/uniquely/);assert.throws(()=>verifyTransfer([{...log,address:'0x'+'3'.repeat(40) as `0x${string}`}],buyer,7000),/uniquely/);
 const entries=[7000,7000,7000].map(n=>nativeExpense(n,log.transactionHash!));assert.equal(entries.flatMap(e=>e.lines).reduce((n,l)=>n+l.debitAtomic-l.creditAtomic,0),0);assert.equal(entries.reduce((n,e)=>n+e.lines[0].debitAtomic,0),21000);assert.equal((21000/1000000).toFixed(6),'0.021000');
});
