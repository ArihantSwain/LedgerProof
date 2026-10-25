import { z } from 'zod';
import { AgentResult, Case } from '../contracts';
import { evidenceBundle,validateResult } from '../investigation';
const status=z.enum(['pending','running','completed','failed','cancelled']);
const developerEnvelope=z.object({run_id:z.string().uuid(),status,result:z.unknown().optional(),model:z.string().nullable().optional()});
const agentEnvelope=z.object({id:z.string().min(1).max(150).optional(),runId:z.string().min(1).max(150).optional(),status,result:z.unknown().optional(),chatModelId:z.string().nullable().optional()});
export class ProviderResultError extends Error {}
export function creaoConfigured(){return !!(process.env.CREAO_API_KEY&&process.env.CREAO_AGENT_ID&&process.env.CREAO_CONTRACT_VERIFIED==='true');}
function config(){
 if(!creaoConfigured())throw Error('CREAO unavailable: configure hosted agent, API key, and verify the account API contract');
 const family=process.env.CREAO_API_FAMILY??'developer-v2';
 if(!['developer-v2','agent-v1'].includes(family))throw Error('Unsupported CREAO_API_FAMILY');
 const expected=family==='developer-v2'?'https://developer.creao.ai/v2':'https://agent.creao.ai/api/v1';
 const base=process.env.CREAO_API_BASE||expected;
 if(base!==expected)throw Error('CREAO API base does not match the explicitly selected API family');
 const field=process.env.CREAO_INPUT_FIELD||'bundle';
 if(!/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(field))throw Error('Invalid CREAO form field');
 return {family,base,field,key:process.env.CREAO_API_KEY!,agent:process.env.CREAO_AGENT_ID!};
}
async function request(path:string,body?:unknown){
 const c=config();
 const response=await fetch(c.base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${c.key}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20_000),cache:'no-store',redirect:'error'});
 if(!response.ok)throw Error(`CREAO returned HTTP ${response.status}; inspect account configuration. Response body withheld.`);
 const text=await response.text();if(new TextEncoder().encode(text).length>300_000)throw new ProviderResultError('CREAO response exceeds bounded output size');
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw new ProviderResultError('CREAO returned malformed JSON');}
 try{
  if(c.family==='developer-v2'){const r=developerEnvelope.parse(raw);return {id:r.run_id,status:r.status,result:r.result,model:r.model};}
  const r=agentEnvelope.parse(raw);if(r.id&&r.runId&&r.id!==r.runId)throw Error('Conflicting provider IDs');const id=r.id??r.runId;if(!id)throw Error('Missing provider ID');return {id,status:r.status,result:r.result,model:r.chatModelId};
 }catch{throw new ProviderResultError('CREAO envelope does not match selected account contract');}
}
function structuredResult(raw:unknown){
 if(raw&&typeof raw==='object'&&'schemaVersion' in raw)return raw;
 const text=typeof raw==='string'?raw:raw&&typeof raw==='object'&&'text' in raw?(raw as {text:unknown}).text:undefined;
 if(typeof text!=='string')throw new ProviderResultError('CREAO result has no supported structured output');
 const cleaned=text.trim().replace(/^```(?:json)?\s*\n?/,'').replace(/\n?```$/,'').trim();
 try{return JSON.parse(cleaned);}catch{throw new ProviderResultError('Agent result must be a complete JSON document, without surrounding prose');}
}
export async function startInvestigation(c:Case,question?:string){
 const cfg=config();const input=evidenceBundle(c,question);
 if(new TextEncoder().encode(JSON.stringify(input)).length>230_000)throw Error('Evidence bundle exceeds bounded payload');
 const body=cfg.family==='developer-v2'?{agent_id:cfg.agent,input}:{appId:cfg.agent,inputs:{[cfg.field]:JSON.stringify(input)}};
 const r=await request('/runs',body);return r.id;
}
export async function getInvestigation(providerRunId:string,c:Case):Promise<{status:string;result?:AgentResult;model?:string|null}>{
 if(!/^[a-zA-Z0-9_-]{1,150}$/.test(providerRunId))throw Error('Invalid provider run ID');
 const r=await request('/runs/'+encodeURIComponent(providerRunId));if(r.id!==providerRunId)throw new ProviderResultError('Provider returned another run ID');
 let result:AgentResult|undefined;
 if(r.status==='completed')try{result=validateResult(c,structuredResult(r.result));}catch(e){if(e instanceof ProviderResultError)throw e;throw new ProviderResultError('CREAO result failed schema, version, or source validation; human review required');}
 return {status:r.status,result,model:r.model};
}
