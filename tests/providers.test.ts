import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../fixtures/agency';
import {localRehearsal} from '../lib/investigation';
import {startInvestigation,getInvestigation,ProviderResultError} from '../lib/providers/creao';

test('explicit CREAO families are isolated, structured text is validated, errors never fabricate output',async()=>{
 const saved={...process.env};const fetchOriginal=globalThis.fetch;
 const c=createFixture('provider-test',Date.now());const result=localRehearsal(c);const uuid='11111111-1111-4111-8111-111111111111';
 try{
  process.env.CREAO_API_KEY='test-only-not-a-real-key';process.env.CREAO_AGENT_ID='test-agent';process.env.CREAO_CONTRACT_VERIFIED='true';process.env.CREAO_API_FAMILY='developer-v2';process.env.CREAO_API_BASE='https://developer.creao.ai/v2';
  globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://developer.creao.ai/v2/runs');const b=JSON.parse(String(init?.body));assert.equal(b.agent_id,'test-agent');assert.equal(b.input.inputVersion,1);assert.equal(b.appId,undefined);return Response.json({run_id:uuid,status:'pending'});};
  assert.equal(await startInvestigation(c),uuid);
  process.env.CREAO_API_BASE='https://agent.creao.ai/api/v1';await assert.rejects(()=>startInvestigation(c),/does not match/);
  process.env.CREAO_API_FAMILY='agent-v1';process.env.CREAO_INPUT_FIELD='bundle';
  globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://agent.creao.ai/api/v1/runs');const b=JSON.parse(String(init?.body));assert.equal(b.appId,'test-agent');assert.equal(JSON.parse(b.inputs.bundle).inputVersion,1);assert.equal(b.agent_id,undefined);return Response.json({id:'agent-run-123',status:'pending'});};
  assert.equal(await startInvestigation(c),'agent-run-123');
  globalThis.fetch=async()=>Response.json({runId:'agent-run-123',status:'completed',result:{text:'```json\n'+JSON.stringify(result)+'\n```'}});
  assert.deepEqual((await getInvestigation('agent-run-123',c)).result,result);
  globalThis.fetch=async()=>Response.json({runId:'agent-run-123',status:'completed',result:{text:'Here is a guessed report'}});
  await assert.rejects(()=>getInvestigation('agent-run-123',c),ProviderResultError);
  globalThis.fetch=async()=>Response.json({runId:'another-run',status:'completed',result});await assert.rejects(()=>getInvestigation('agent-run-123',c),/another run/);
  globalThis.fetch=async()=>Response.json({runId:'agent-run-123',status:'completed',result:{...result,inputVersion:99}});await assert.rejects(()=>getInvestigation('agent-run-123',c),ProviderResultError);
  delete process.env.CREAO_API_KEY;await assert.rejects(()=>startInvestigation(c),/unavailable/);
 }finally{globalThis.fetch=fetchOriginal;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
