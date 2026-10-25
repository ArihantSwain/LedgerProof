import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reserveBudget} from '../lib/providers/budget';
import {parseClaudeReview,reviewSchema,strictToolSchema,reviewInput} from '../lib/providers/claude';
import {summarizeCredit} from '../lib/providers/crs';
import {validateSettlementReceipt,closePacket} from '../lib/providers/coinbase';
import {normalizeNativeCreao,getInvestigation} from '../lib/providers/creao';
import {evidenceBundle} from '../lib/investigation';
import {createFixture} from '../fixtures/agency';
import {z} from 'zod';
import {sealProviderToken,openProviderToken} from '../lib/providers/session-vault';
import {appOrigins} from '../lib/app-origin';
test('provider token encryption rejects another credential, secret, expiry or tampered ciphertext; expired sessions are not used',()=>{
 const secret='test-only-backend-secret-long-enough',key='a'.repeat(64),expiresAt=Date.now()+60000;
 const session={sealed:sealProviderToken('synthetic-session-token',key,expiresAt,secret),expiresAt};
 assert.ok(!session.sealed.includes('synthetic-session-token'));
 assert.equal(openProviderToken(session,key,secret),'synthetic-session-token');
 assert.equal(openProviderToken(session,key,secret,expiresAt),null);
 assert.throws(()=>openProviderToken(session,'b'.repeat(64),secret));
 assert.throws(()=>openProviderToken(session,key,'another-secret'));
 assert.throws(()=>openProviderToken({...session,expiresAt:expiresAt+1},key,secret));
 const envelope=JSON.parse(session.sealed);envelope.tag=(envelope.tag[0]==='a'?'b':'a')+envelope.tag.slice(1);
 assert.throws(()=>openProviderToken({...session,sealed:JSON.stringify(envelope)},key,secret));
});
test('hosted origins include only explicit configuration and trusted Vercel hosts',()=>{
 const keys=['APP_ORIGIN','VERCEL','VERCEL_URL','VERCEL_PROJECT_PRODUCTION_URL'] as const;
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  for(const k of keys)delete process.env[k];assert.deepEqual([...appOrigins()],['http://localhost:3000']);
  process.env.APP_ORIGIN='https://ledgerproof.example';process.env.VERCEL='1';process.env.VERCEL_URL='deployment.vercel.app';process.env.VERCEL_PROJECT_PRODUCTION_URL='ledgerproof.vercel.app';
  assert.deepEqual([...appOrigins()],['https://ledgerproof.example','https://deployment.vercel.app','https://ledgerproof.vercel.app']);
  assert.equal(appOrigins().has('https://attacker.example'),false);
 }finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
test('Claude budget counts unresolved reservations, caps lifetime usage and limits request count',()=>{
 assert.throws(()=>reserveBudget({chargedMicros:4_900_001,reservedMicros:0,calls:1},'anthropic',100000),/cap reached/);
 assert.throws(()=>reserveBudget({chargedMicros:0,reservedMicros:4_950_000,calls:1},'anthropic',100000),/cap reached/);
 assert.throws(()=>reserveBudget({chargedMicros:0,reservedMicros:0,calls:50},'anthropic',100000),/cap reached/);
 const r=reserveBudget({chargedMicros:1234,reservedMicros:100000,calls:2},'anthropic',100000);assert.equal(r.reservedMicros,200000);assert.equal(r.chargedMicros,1234);assert.equal(r.calls,3);
 assert.throws(()=>reserveBudget(r,'anthropic',NaN),/Invalid/);
});
test('Claude review rejects invented citations and unsupported JSON; strict API schema retains required object structure',()=>{
 const review={summary:'Check the settlement',checks:[{title:'Cash',assessment:'supported',sourceIds:['bank_1'],explanation:'Source reconciles'}],nextSteps:['Review before posting']};
 assert.equal(parseClaudeReview(review,['bank_1']).checks.length,1);assert.throws(()=>parseClaudeReview(review,['other']),/unknown source/);
 assert.throws(()=>parseClaudeReview({...review,approved:true},['bank_1']));
 const schema=JSON.stringify(strictToolSchema(z.toJSONSchema(reviewSchema)));assert.ok(!schema.includes('"maxLength":'));assert.ok(!schema.includes('"maxItems":'));assert.ok(schema.includes('"additionalProperties":false'));
 const c=createFixture('review-input',Date.now());assert.equal(reviewInput(c,'Review').sourceIds.includes(c.invoices[0].id),true);assert.equal(JSON.stringify(reviewInput(c,'Review')).includes('storageRef'),false);
});
test('CRS HTTP-success error body and missing files never become valid scores; model names and absent score preserved',()=>{
 assert.throws(()=>summarizeCredit({errorMessages:[{creditErrorMessageCode:'E1005'}]}),/report errors/);
 assert.throws(()=>summarizeCredit({errorMessages:null,scores:[{modelName:'X',scoreValue:700}]}),/no credit file/);
 const r=summarizeCredit({errorMessages:null,creditFiles:[{creditFileDetail:{status:'NoFileReturnedCreditFreeze'}}],scores:[{modelName:'Actual provider model',scoreValue:null,noScoreReasonType:'CreditFreeze'}]});assert.equal(r.scores[0].scoreValue,null);assert.equal(r.scores[0].modelName,'Actual provider model');assert.equal(r.scores[0].noScoreReasonType,'CreditFreeze');
});
test('Coinbase delivery requires a successful Base Sepolia receipt bound to the purchased evidence snapshot',()=>{
 const receipt={success:true,network:'eip155:84532',transaction:'0x'+'a'.repeat(64)};assert.equal(validateSettlementReceipt(receipt,'snapshot',{fingerprint:'snapshot'}).network,'eip155:84532');
 assert.throws(()=>validateSettlementReceipt({...receipt,network:'eip155:8453'},'snapshot',{fingerprint:'snapshot'}),/No verified/);
 assert.throws(()=>validateSettlementReceipt({...receipt,success:false},'snapshot',{fingerprint:'snapshot'}),/No verified/);
 assert.throws(()=>validateSettlementReceipt(receipt,'snapshot',{fingerprint:'another'}),/does not match/);assert.throws(()=>closePacket(createFixture('empty',Date.now())),/Import settlement/);
});
test('CREAO native artifacts bind actual submitted inputs, retain uncertainty and reject invented references',()=>{
 const c=createFixture('native-creao',Date.now()),bundle=evidenceBundle(c);const raw={bundle_version:'1',findings:[{category:'evidence_conflict',evidence_ids:['doc-inv-0'],affected_record_ids:['invoice-0'],title:'Review the date',facts:'Date as supplied',discrepancy:'Period uncertain',proposed_review_step:'Confirm the period',review_status:'needs_human_review'}]};
 const result=normalizeNativeCreao(c,raw,bundle);assert.equal(result.findings[0].certaintyLabel,'possible');assert.equal(result.inputVersion,c.inputVersion);
 assert.throws(()=>normalizeNativeCreao(c,raw,{...bundle,inputVersion:99}),/does not match/);
 assert.throws(()=>normalizeNativeCreao(c,{...raw,findings:[{...raw.findings[0],evidence_ids:['invented']}]},bundle),/Unknown/);
});

test('completed CREAO artifact envelopes are retrieved without treating artifacts as malformed prose',async()=>{
 const keys=['LEDGERPROOF_OFFLINE_REHEARSAL','CREAO_API_KEY','CREAO_AGENT_ID','CREAO_CONTRACT_VERIFIED','CREAO_API_FAMILY','CREAO_API_BASE'];const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const originalFetch=globalThis.fetch;
 try{Object.assign(process.env,{LEDGERPROOF_OFFLINE_REHEARSAL:'false',CREAO_API_KEY:'test-only',CREAO_AGENT_ID:'test-agent',CREAO_CONTRACT_VERIFIED:'true',CREAO_API_FAMILY:'agent-v1',CREAO_API_BASE:'https://agent.creao.ai/api/v1'});const c=createFixture('artifact-check',Date.now());const id='test-run';const raw={bundle_version:'1',findings:[{category:'evidence_conflict',evidence_ids:['doc-inv-0'],affected_record_ids:['invoice-0'],title:'Check receipt',facts:'No confirmed receipt',discrepancy:'Collection uncertain',proposed_review_step:'Request evidence',review_status:'needs_human_review'}]};globalThis.fetch=async input=>{const url=new URL(String(input));if(url.pathname.endsWith('/artifacts/download'))return Response.json(url.searchParams.get('name')==='bundle.json'?evidenceBundle(c):raw);return Response.json({id,status:'completed',result:{artifacts:['bundle.json','ledgerproof_findings.json'].map(name=>({title:name,url:'https://agent.creao.ai/api/v1/runs/'+id+'/artifacts/download?name='+name}))}});};const result=await getInvestigation(id,c);assert.equal(result.status,'completed');assert.equal(result.result?.findings.length,1);
 }finally{globalThis.fetch=originalFetch;for(const key of keys)if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}
});
