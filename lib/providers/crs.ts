import {z} from 'zod';
import personas from '../../fixtures/crs-personas.json';
import {acquireJob,finishJob,jobKey,serviceHistory} from './jobs';
import {readProviderSession,saveProviderToken,openProviderToken} from './session-vault';
const BASE='https://api-sandbox.stitchcredit.com/api';
export function crsConfigured(){return process.env.LEDGERPROOF_OFFLINE_REHEARSAL!=='true'&&!!(process.env.CRS_USERNAME&&process.env.CRS_PASSWORD);}
export const crsPersonas=personas.personas.map(p=>({id:p.id,name:p.name}));
export function crsCredentialKey(){return jobKey('crs','global-auth',{username:process.env.CRS_USERNAME,password:process.env.CRS_PASSWORD});}
async function getCrsToken(){
 const credentialKey=crsCredentialKey(),session=await readProviderSession(credentialKey);
 if(session){const token=openProviderToken(session,credentialKey,process.env.LEDGERPROOF_BACKEND_SECRET!);if(token)return token;}
 // Preserve the original bad-password guard when upgrading from disk caching.
 const history=await serviceHistory('global-auth');
 const legacy=history.jobs.find((j:{key:string})=>j.key===credentialKey);
 if(legacy&&legacy.state!=='completed')throw Error('A prior CRS login is unresolved or failed; no automatic retry. Verify credentials with CRS.');
 const key=jobKey('crs','global-auth',{credentialKey,previousExpiry:session?.expiresAt??0,contract:2});
 const claim=await acquireJob('crs','global-auth',key,0);
 if(!claim.owner){
  const saved=await readProviderSession(credentialKey);
  const token=saved&&openProviderToken(saved,credentialKey,process.env.LEDGERPROOF_BACKEND_SECRET!);
  if(token)return token;
  throw Error('CRS login already attempted for this session. No repeated login or automatic retry.');
 }
 try{
  const r=await fetch(BASE+'/users/login',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20_000),headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.CRS_USERNAME,password:process.env.CRS_PASSWORD})});
  if(!r.ok){await finishJob(key,'failed',{chargedMicros:0,error:'CRS login failed; automatic retries disabled to prevent account lockout'});throw Error('CRS login failed. Ask CRS to verify sandbox credentials; no automatic retry.');}
  const auth=z.object({token:z.string().min(10).max(10000)}).parse(await r.json());
  let expiresAt=Date.now()+3_600_000;
  try{const jwt=JSON.parse(Buffer.from(auth.token.split('.')[1],'base64url').toString('utf8'));if(typeof jwt.exp==='number')expiresAt=Math.min(expiresAt,Math.floor(jwt.exp*1000)-30000);}catch{}
  if(expiresAt<=Date.now())throw Error('CRS returned an expired session; no automatic login retry.');
  await saveProviderToken(credentialKey,auth.token,expiresAt);
  await finishJob(key,'completed',{chargedMicros:0,result:{authenticated:true}});
  return auth.token;
 }catch(error){await finishJob(key,'unknown',{chargedMicros:0,error:'CRS authentication did not complete; no automatic retry.'});throw error;}
}
export function summarizeCredit(raw:unknown){
 const report=z.object({errorMessages:z.array(z.unknown()).nullish(),responseDetail:z.object({creditPullType:z.string().optional(),referenceNumber:z.string().optional()}).passthrough().optional(),creditFiles:z.array(z.object({creditFileDetail:z.unknown()}).passthrough()).optional(),scores:z.array(z.object({modelName:z.string().nullish(),scoreValue:z.union([z.number(),z.string()]).nullish(),noScoreReasonType:z.string().nullish()}).passthrough()).optional(),tradelines:z.array(z.unknown()).optional()}).passthrough().parse(raw);
 if(report.errorMessages?.length)throw Error('CRS returned report errors despite HTTP success; report withheld. Check account product/config access.');
 if(!report.creditFiles?.length)throw Error('CRS response contains no credit file; no score or approval inferred');
 return {creditPullType:report.responseDetail?.creditPullType??'unspecified',creditFiles:report.creditFiles.map(f=>f.creditFileDetail),scores:(report.scores??[]).map(s=>({modelName:s.modelName??'unspecified',scoreValue:s.scoreValue??null,noScoreReasonType:s.noScoreReasonType??null})),tradelineCount:report.tradelines?.length??0,disclosure:'Official synthetic consumer test subject. A score is not a business default probability or a lending approval. No agency receivable, reserve or ledger balance changed.'};
}
export async function runCrs(caseId:string,personaId:string){
 if(!crsConfigured())throw Error('CRS requires sandbox CRS_USERNAME and CRS_PASSWORD');
 const persona=personas.personas.find(p=>p.id===personaId);if(!persona)throw Error('Select an official CRS sandbox persona; arbitrary personal data is not accepted');
 const request=persona.requests.find(r=>r.product==='credit_report'&&r.variant==='TransUnion')!;
 const key=jobKey('crs',caseId,{personaId,product:'TransUnion',contract:1});const claim=await acquireJob('crs',caseId,key,0);if(!claim.owner)return {...claim.job,cached:true};
 let requestId:string|null=null;
 try{
  const token=await getCrsToken();
  const path=request.path.replace('{config}',request.config!);
  if(path!=='/transunion/credit-report/standard/tu-prequal-fico9')throw Error('Unapproved CRS product path');
  const response=await fetch(BASE+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(25_000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(request.body)});
  requestId=response.headers.get('RequestID');
  if(!response.ok)throw Error(`CRS product returned HTTP ${response.status}; no automatic retry or alternate vendor pull`);
  const text=await response.text();if(text.length>300_000)throw Error('CRS response exceeds bounded output');
  const report=summarizeCredit(JSON.parse(text));
  return await finishJob(key,'completed',{chargedMicros:0,result:{subject:{id:persona.id,name:persona.name,kind:'official synthetic consumer'},requestId:response.headers.get('RequestID'),report,source:'CRS sandbox API',product:'TransUnion prequalification sandbox'}});
 }catch(error){return await finishJob(key,'unknown',{chargedMicros:0,...(requestId?{result:{requestId,personaId,product:'TransUnion prequalification sandbox',deliveryVerified:false}}:{}),error:error instanceof Error?error.message:'CRS request interrupted; no automatic retry'});}
}
