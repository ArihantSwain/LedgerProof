import { z } from 'zod';
import {createHash} from 'node:crypto';
import { AgentResult, Case } from '../contracts';
import { evidenceBundle,validateResult } from '../investigation';
const status=z.enum(['pending','running','completed','failed','cancelled']);
const developerEnvelope=z.object({run_id:z.string().uuid(),status,result:z.unknown().optional(),model:z.string().nullable().optional()});
const agentEnvelope=z.object({id:z.string().min(1).max(150).optional(),runId:z.string().min(1).max(150).optional(),status,result:z.unknown().optional(),chatModelId:z.string().nullable().optional()});
export class ProviderResultError extends Error {}
export function creaoConfigured(){return process.env.LEDGERPROOF_OFFLINE_REHEARSAL!=='true'&&!!(process.env.CREAO_API_KEY&&process.env.CREAO_AGENT_ID&&process.env.CREAO_CONTRACT_VERIFIED==='true');}
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
const artifactSchema=z.object({title:z.string(),url:z.string().url()});
async function artifact(result:unknown,title:string,runId:string){
 const artifacts=z.object({artifacts:z.array(artifactSchema).max(20)}).parse(result).artifacts;
 const selected=artifacts.filter(a=>a.title===title);if(selected.length!==1)throw new ProviderResultError('CREAO needs exactly one '+title+' artifact');
 const url=new URL(selected[0].url);
 if(url.origin!=='https://agent.creao.ai'||url.pathname!==`/api/v1/runs/${runId}/artifacts/download`||url.username||url.password)throw new ProviderResultError('Untrusted CREAO artifact URL');
 let response=await fetch(url,{headers:{Authorization:`Bearer ${config().key}`},redirect:'manual',signal:AbortSignal.timeout(20_000),cache:'no-store'});
 if(response.status===302){
  const target=new URL(response.headers.get('location')??'');
  if(target.protocol!=='https:'||target.hostname!=='storage-bucket-creao-user-upload-production.s3.us-west-2.amazonaws.com'||target.port||target.username||target.password)throw new ProviderResultError('Untrusted CREAO artifact storage host');
  // Provider-issued signed URL: never forward our bearer credential to S3.
  response=await fetch(target,{redirect:'error',signal:AbortSignal.timeout(20_000),cache:'no-store'});
 }
 if(!response.ok)throw Error('CREAO artifact retrieval HTTP '+response.status);
 if(Number(response.headers.get('content-length')??0)>300_000)throw new ProviderResultError('Oversized CREAO artifact');
 const text=await response.text();if(Buffer.byteLength(text)>300_000)throw new ProviderResultError('Oversized CREAO artifact');return JSON.parse(text) as unknown;
}
function canonical(raw:unknown):string{if(Array.isArray(raw))return '['+raw.map(canonical).join(',')+']';if(raw&&typeof raw==='object')return '{'+Object.entries(raw).filter(([k,v])=>k!=='uploadedAt'&&v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(raw);}
export function normalizeNativeCreao(c:Case,raw:unknown,submitted:unknown):AgentResult{
 const bundle=z.object({schemaVersion:z.literal('1'),inputVersion:z.number(),business:z.unknown(),invoices:z.unknown(),receipts:z.unknown(),creditNotes:z.unknown(),ledgerEntries:z.unknown(),evidence:z.unknown(),financeOperations:z.unknown()}).parse(submitted);
 const expected=evidenceBundle(c);
 for(const key of ['schemaVersion','inputVersion','business','invoices','receipts','creditNotes','ledgerEntries','evidence','financeOperations'] as const){if(canonical(bundle[key])!==canonical(expected[key]))throw new ProviderResultError('CREAO artifact input does not match current source and planning data');}
 return normalizeNativeFindings(c,raw,'1');
}
export function investigationDigest(c:Case,question?:string){return createHash('sha256').update(canonical(evidenceBundle(c,question))).digest('hex');}
function currentSubmission(c:Case,providerRunId:string){const run=c.runs.find(run=>run.providerRunId===providerRunId),stamp=run?.sourceVersions;if(!run||run.inputVersion!==c.inputVersion||run.generation!==c.generation||!stamp||stamp.ledgerVersion!==c.ledgerVersion||stamp.operationsVersion!==c.operations.version||stamp.closeVersion!==c.close.version)throw new ProviderResultError('The investigation sources changed. Run a new investigation.');return run;}
function referencedRecords(c:Case,f:{affected_record_ids?:string[];affectedRecordIds?:string[];title:string;facts:string;discrepancy:string;proposed_review_step:string;evidence_ids:string[]}){
 if(f.affected_record_ids||f.affectedRecordIds)return f.affected_record_ids??f.affectedRecordIds!;
 const text=[f.title,f.facts,f.discrepancy,f.proposed_review_step].join(' ');
 const token=(value:string)=>{const escaped=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(^|[^A-Za-z0-9_-])'+escaped+'($|[^A-Za-z0-9_-])','i').test(text);};
 // Resolve only literal references to existing records. Never infer an amount,
 // create a receipt, or accept a model-authored journal. Document targets remain
 // valid review items when the agent did not identify a financial record.
 const ids=[...c.invoices,...c.receipts,...c.credits,...c.entries,...c.obligations].filter(record=>/[-:]/.test(record.id)&&token(record.id)).map(record=>record.id);
 for(const inv of c.invoices)if(f.evidence_ids.includes(inv.evidenceId)&&token(inv.number))ids.push(inv.id);
 return [...new Set(ids.length?ids:f.evidence_ids.length?f.evidence_ids:[c.business.id])].slice(0,30);
}
function evidenceDocuments(c:Case,ids:string[]){return [...new Set(ids.map(id=>{if(c.documents.some(d=>d.id===id))return id;const source=c.invoices.find(record=>record.id===id)?.evidenceId??c.receipts.find(record=>record.id===id)?.evidenceId??c.credits.find(record=>record.id===id)?.evidenceId??c.entries.find(record=>record.id===id)?.sourceReference;if(!source||!c.documents.some(d=>d.id===source))throw new ProviderResultError('Unknown or cross-business evidence reference');return source;}))];}
export function normalizeNativeFindings(c:Case,raw:unknown,version:string):AgentResult{
 const versions=[version,`1/inputVersion-${c.inputVersion}`,`schemaVersion=1; inputVersion=${c.inputVersion}`];
 const native=z.object({bundle_version:z.union([z.string(),z.literal(1)]).transform(String).refine(value=>versions.includes(value),'Unexpected source version'),findings:z.array(z.object({category:z.enum(['duplicate_invoice_posting','unapplied_credit_note','unmatched_receipt','partial_payment','evidence_conflict','missing_evidence']),evidence_ids:z.array(z.string()),affected_record_ids:z.array(z.string()).min(1).optional(),affectedRecordIds:z.array(z.string()).min(1).optional(),title:z.string(),facts:z.string(),discrepancy:z.string(),proposed_review_step:z.string(),review_status:z.literal('needs_human_review')}).refine(f=>(f.category==='missing_evidence'||f.evidence_ids.length>0)&&(!f.affected_record_ids||!f.affectedRecordIds||JSON.stringify(f.affected_record_ids)===JSON.stringify(f.affectedRecordIds)),'Missing or conflicting record references')).max(50)}).parse(raw);
 const types={duplicate_invoice_posting:'duplicate_invoice',unapplied_credit_note:'unapplied_credit_note',unmatched_receipt:'unmatched_receipt',partial_payment:'partial_payment',evidence_conflict:'inconsistent_amount',missing_evidence:'insufficient_evidence'} as const;
 const actions={duplicate_invoice_posting:'review_duplicate',unapplied_credit_note:'review_credit_application',unmatched_receipt:'review_receipt_match',partial_payment:'request_evidence',evidence_conflict:'request_evidence',missing_evidence:'request_evidence'} as const;
 // The native contract supplies no confidence score. Preserve that uncertainty;
 // these conservative findings may prepare human review, never approve a credit.
 return validateResult(c,{schemaVersion:'1',inputVersion:c.inputVersion,findings:native.findings.filter(f=>f.evidence_ids.length>0).map(f=>({type:types[f.category],affectedRecordIds:referencedRecords(c,f).map(id=>id==='business'?c.business.id:id),evidenceRefs:evidenceDocuments(c,f.evidence_ids),explanation:[f.title,f.facts,f.discrepancy,f.proposed_review_step].join('\n').slice(0,3000),certaintyLabel:f.category==='missing_evidence'?'insufficient':'possible',proposedAction:actions[f.category],needsHumanReview:true})),missingEvidence:native.findings.filter(f=>f.category==='missing_evidence').map(f=>f.title.slice(0,500)),summary:`Found ${native.findings.length} items to review. Inspect the sources before approving a correction. No changes have been posted.`});
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
 if(r.status==='completed')try{
  const submitted=c.runs.find(run=>run.providerRunId===providerRunId);if(submitted?.inputDigest){currentSubmission(c,providerRunId);if(submitted.inputDigest!==investigationDigest(c,submitted.challenge))throw new ProviderResultError('The investigation sources changed. Run a new investigation.');}
  const structured=r.result&&typeof r.result==='object'&&'artifacts' in r.result?undefined:structuredResult(r.result);
  if(structured&&typeof structured==='object'&&'schemaVersion' in structured)result=validateResult(c,structured);
  else if(config().family==='agent-v1'){
   const native=await artifact(r.result,'ledgerproof_findings.json',providerRunId);
   const bound=c.runs.find(run=>run.providerRunId===providerRunId);
   if(bound?.inputDigest){
    const submitted=currentSubmission(c,providerRunId);
    if(submitted.inputDigest!==investigationDigest(c,submitted.challenge))throw new ProviderResultError('The investigation sources changed. Run a new investigation.');
    // The persisted request digest and provider run ID bind the source. An agent's
    // rewritten bundle artifact is not the original request and is never trusted.
    result=normalizeNativeFindings(c,native,'1');
   }else if(z.object({artifacts:z.array(artifactSchema)}).parse(r.result).artifacts.some(a=>a.title==='bundle.json'))result=normalizeNativeCreao(c,native,await artifact(r.result,'bundle.json',providerRunId));
   else{currentSubmission(c,providerRunId);result=normalizeNativeFindings(c,native,`1/inputVersion-${c.inputVersion}`);}
  }else throw new ProviderResultError('Unsupported CREAO output contract');
 }catch(e){if(e instanceof ProviderResultError)throw e;throw new ProviderResultError('CREAO result failed schema, version, or source validation; human review required');}
 return {status:r.status,result,model:r.model};
}
