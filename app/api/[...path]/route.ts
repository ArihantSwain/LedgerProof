import { NextRequest,NextResponse } from 'next/server';
import { randomUUID,createHash,createHmac,timingSafeEqual } from 'node:crypto';
import {convertFiles} from '@/lib/importer';
import {enrichImport} from '@/lib/providers/importer-ai';
import {importPayloadSchema} from '@/lib/contracts/import';
import { z } from 'zod';
import {suggestActionsWithClaude,prepareSuggestedAction} from '@/lib/providers/suggested-actions';
import { createSession,readCase,applyCommand,saveOriginal,readOriginal,Access } from '@/lib/store';
import { forecast } from '@/lib/finance';
import { documentPdf,parseUpload,MAX_BYTES } from '@/lib/documents';
import { localRehearsal,evidenceBundle } from '@/lib/investigation';
import { creaoConfigured,startInvestigation,getInvestigation,investigationDigest,ProviderResultError } from '@/lib/providers/creao';
import { Case,Run } from '@/lib/contracts';
import { operationsSummary } from '@/lib/operations';
import { operationsCommandSchema } from '@/lib/contracts/operations';
import {reconcileClose,parseCloseCsv} from '@/lib/close';
import {closeCommandSchema} from '@/lib/contracts/close';
import {claudeConfigured,reviewWithClaude} from '@/lib/providers/claude';
import {caseServiceHistory as serviceHistory,liveBackendConfigured} from '@/lib/providers/jobs';
import {humanMessage,hasReviewEvidence} from '@/lib/ui-readiness';
import {transition} from '@/lib/workflow';
import {crsConfigured,crsPersonas,runCrs} from '@/lib/providers/crs';
import {coinbaseConfigured,paidCloseReport,buyClosePacket,fundDemoBuyer} from '@/lib/providers/coinbase';
import {probeExa,buyEvidence,reconcileEvidence,paidEvidenceConfigured,prepareEvidenceWallet} from '@/lib/providers/paid-evidence';
import {evidenceCommandSchema} from '@/lib/contracts/evidence';
import {appOrigins} from '@/lib/app-origin';
export const runtime='nodejs';
export const maxDuration=120;
export const dynamic='force-dynamic';
const globalRate=globalThis as typeof globalThis & {lpRate?:Map<string,{n:number;until:number}>};
function limit(key:string,max=60){const map=globalRate.lpRate??=new Map();const now=Date.now();for(const [k,v] of map)if(v.until<now)map.delete(k);const v=map.get(key)??{n:0,until:now+60_000};v.n++;map.set(key,v);if(v.n>max)throw Error('Request limit reached; try again in a minute');}
function access(req:NextRequest):Access{const raw=req.cookies.get('lp_session')?.value;if(!raw)throw Error('Session unavailable');const [caseId,token]=raw.split('.');return {caseId,token};}
function response(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
function sessionResponse(a:Access,data:unknown={caseId:a.caseId}){const r=response(data);r.cookies.set('lp_session',a.caseId+'.'+a.token,{httpOnly:true,sameSite:'strict',secure:process.env.VERCEL==='1'||(process.env.APP_ORIGIN?.startsWith('https:')??false),path:'/',maxAge:86400});return r;}
async function body(req:NextRequest){const text=await req.text();if(text.length>(req.nextUrl.pathname==='/api/imports/commit'?800000:60000))throw Error('Request body too large');return JSON.parse(text);}
function view(c:Case){
 const live=c.mode==='CONVEX'&&liveBackendConfigured();
 const capabilities={hostedInvestigation:live&&creaoConfigured(),accountingReview:live&&claudeConfigured(),creditReport:live&&crsConfigured(),wallet:live&&coinbaseConfigured(),quote:live,paidEvidence:live&&paidEvidenceConfigured()};
 return {close:reconcileClose(c.close),operations:operationsSummary(c),case:c,baseline:forecast(c,'baseline'),revised:forecast(c,'revised'),preview:forecast(c,'preview'),capabilities,providers:{creao:c.runs.some(r=>r.mode==='CREAO'&&r.result)?'LIVE_VERIFIED':capabilities.hostedInvestigation?'CONFIGURED':'BLOCKED',convex:c.mode==='CONVEX'?'LIVE_CONNECTED':'LOCAL_REHEARSAL',anthropic:capabilities.accountingReview?'CONFIGURED':'BLOCKED',crs:capabilities.creditReport?'CONFIGURED':'BLOCKED',coinbase:capabilities.wallet?'CONFIGURED':'BLOCKED',brightdata:'NOT_TARGETED'}};
}
async function poll(a:Access,c:Case){
 for(const run of c.runs.filter(r=>r.mode==='CREAO'&&r.providerRunId&&['submitted','running','retry_scheduled'].includes(r.state))){
   if(run.inputVersion!==c.inputVersion)continue;
   try{const state=await getInvestigation(run.providerRunId!,c);if(state.status==='completed'&&state.result)c=await applyCommand(a,{type:'apply_result',runId:run.id,generation:run.generation,result:state.result});else c=await applyCommand(a,{type:'update_run',runId:run.id,generation:run.generation,patch:{state:state.status==='failed'||state.status==='cancelled'?'failed':'running'}});}
   catch(error){c=await applyCommand(a,{type:'update_run',runId:run.id,generation:run.generation,patch:{state:error instanceof ProviderResultError?'needs_review':'retry_scheduled',error:error instanceof ProviderResultError?error.message:'Provider retrieval failed. Resume retrieves the same run; no resubmission or fabricated result.'}});}
 }return c;
}
export async function GET(req:NextRequest){try{
 const p=req.nextUrl.pathname.slice(5).split('/').map(decodeURIComponent);const a=access(req);let c=await readCase(a);limit(a.caseId+':read',180);
 if(p[0]==='state'||p[0]==='operations')return response(view(c));
 if(p[0]==='services')return response({providers:view(c).providers,capabilities:view(c).capabilities,paidEvidenceEnabled:view(c).capabilities.paidEvidence,crsPersonas,...await serviceHistory(c)});
 if(p[0]==='commerce'&&p[1]==='report')return paidCloseReport(req,a,c);
 if(p[0]==='investigations') {c=await poll(a,c);return response(view(c));}
 if(p[0]==='cases'&&p[1]===c.id&&p[2]==='bundle')return response(evidenceBundle(c));
 if(p[0]==='share')return response({fragment:`session=${a.caseId}.${a.token}`});
 if(p[0]==='documents'&&p[1]){const d=c.documents.find(d=>d.id===p[1]);if(!d)throw Error('Document unavailable');const bytes=await readOriginal(a,d.id)??(d.mime==='application/pdf'?await documentPdf(d.text):new TextEncoder().encode(d.text));return new NextResponse(Buffer.from(bytes),{headers:{'Content-Type':d.mime,'Content-Disposition':`inline; filename="${d.filename}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});}
 if(p[0]==='reports')return new NextResponse(JSON.stringify({label:'Synthetic accounting investigation and decision support',mode:c.mode,business:c.business,forecast:forecast(c),evidenceProcurement:c.evidencePurchases,serviceEvidence:await serviceHistory(c),settlementClose:c.close,financeOperations:operationsSummary(c),recoveryPlans:c.operations.plans,actionDrafts:c.operations.drafts,decisionRoom:c.operations.comments,executionDisclosure:'All recovery plans are conditional scenarios. Approved drafts are not sent. No money moved or external books changed.',findings:c.findings,reviewEvents:c.events,providerRuns:c.runs.map(r=>({id:r.id,mode:r.mode,providerRunId:r.providerRunId,state:r.state})),limitations:'Provider status requires actual job evidence; credential configuration alone is not verification. Sponsor eligibility and production suitability are unverified. This is not a certified audit.'},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="ledgerproof-report.json"','Cache-Control':'no-store'}});
 return response({error:'Route not found'},404);
 }catch(error){return response({error:humanMessage(error)},400);}}
export async function POST(req:NextRequest){try{
 const origin=req.headers.get('origin');if(origin&&!appOrigins().has(origin))return response({error:'Origin rejected'},403);
 const length=Number(req.headers.get('content-length')??0);if(length>(req.nextUrl.pathname.startsWith('/api/imports/')?3*1024*1024+100000:MAX_BYTES+10_000))throw Error('Request body too large');
 const p=req.nextUrl.pathname.slice(5).split('/').map(decodeURIComponent);
 if(p[0]==='demo'&&p[1]==='session'){limit('create',20);return sessionResponse(await createSession());}
 if(p[0]==='demo'&&p[1]==='join'){limit('join',30);const b=z.object({session:z.string().max(110)}).parse(await body(req));const [caseId,token]=b.session.split('.');const a={caseId,token};await readCase(a);return sessionResponse(a);}
 if(p[0]==='imports'&&p[1]==='preview'){
  let a:Access;try{a=access(req);await readCase(a);}catch{limit('import-create',20);a=await createSession();}
  const c=await readCase(a);limit(a.caseId+':import',12);const form=await req.formData();const uploads=form.getAll('files').filter((file):file is File=>file instanceof File);
  if(!uploads.length||uploads.length>10)throw Error('Choose between one and ten files.');
  if(uploads.some(file=>!file.size||file.size>2*1024*1024)||uploads.reduce((sum,file)=>sum+file.size,0)>3*1024*1024)throw Error('Choose nonempty files up to 2 MB each and 3 MB total.');
  const files=await Promise.all(uploads.map(async file=>({name:file.name,type:file.type,bytes:new Uint8Array(await file.arrayBuffer())})));
  let preview=await convertFiles(files);preview=await enrichImport(c,preview,files);
  const sources=await Promise.all(preview.sources.map(async source=>{const file=files.find(file=>createHash('sha256').update(file.bytes).digest('hex')===source.sha256);if(!file)throw Error('Choose a supported source file.');const storageRef=await saveOriginal(a,file.bytes,source.mime);const ext=source.filename.toLowerCase().split('.').pop()??'';const mime=({pdf:'application/pdf',csv:'text/csv',tsv:'text/tab-separated-values',txt:'text/plain',json:'application/json',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'} as Record<string,string>)[ext]??'application/octet-stream';const signed={...source,mime,text:source.text.slice(0,20000),storageRef};return {...signed,proof:createHmac('sha256',a.token).update(JSON.stringify(signed)).digest('hex')};}));
  return sessionResponse(a,{...preview,sources});
 }
 const a=access(req);limit(a.caseId+':write',40);let c=await readCase(a);
 if(p[0]==='imports'&&p[1]==='commit'){
  const input=importPayloadSchema.parse(await body(req));
  for(const source of input.sources){const {proof,...signed}=source;const expected=createHmac('sha256',a.token).update(JSON.stringify(signed)).digest('hex');if(!proof||proof.length!==64||!timingSafeEqual(Buffer.from(proof,'hex'),Buffer.from(expected,'hex')))throw Error('Choose your files again to confirm their source records.');}
  const requestKey=createHash('sha256').update(JSON.stringify({...input,expectedRevision:undefined})).digest('hex');
  return response(view(await applyCommand(a,{...input,type:'import_workspace',expectedRevision:input.expectedRevision??c.revision,requestKey})));
 }
 if(p[0]==='evidence'){
  if(p[1]==='wallet')return response(await prepareEvidenceWallet());
  if(p[1]==='quote'){const b=z.object({chargeId:z.string().max(100)}).parse(await body(req));const charge=c.evidencePurchases.charges.find(x=>x.id===b.chargeId);if(!charge)throw Error('Unknown investigation charge');return response(await probeExa(charge));}
  if(p[1]==='buy'){const b=z.object({chargeId:z.string().max(100),quoteFingerprint:z.string().length(64),reason:z.string().min(1).max(500)}).parse(await body(req));const job=await buyEvidence(a,c,b.chargeId,b.quoteFingerprint,b.reason);return response({job,...await serviceHistory(c)});}
  if(p[1]==='reconcile'){const b=z.object({key:z.string().length(64)}).parse(await body(req));const job=await reconcileEvidence(a,b.key);return response({job,...await serviceHistory(c)});}
  return response(view(await applyCommand(a,evidenceCommandSchema.parse(await body(req)))));
 }
 if(p[0]==='close'){
  const raw=await body(req);const command=raw.type==='close_import_csv'?closeCommandSchema.parse({...raw,type:'close_import',records:parseCloseCsv(z.string().max(40000).parse(raw.csv))}):closeCommandSchema.parse(raw);
  return response(view(await applyCommand(a,command)));
 }
 if(p[0]==='services'&&p[1]==='actions'){
  if(p[2]==='record'){const b=z.object({jobKey:z.string().length(64),actionId:z.string().min(1).max(60),contact:z.string().max(120)}).parse(await body(req));const history=await serviceHistory(c);const job=history.jobs.find((job:{key:string})=>job.key===b.jobKey);if(!job)throw Error('Choose a suggestion from this workspace.');const packet=prepareSuggestedAction(c,{...job,caseId:c.id},b.actionId,b.contact);const updated=await applyCommand(a,{type:'ops_comment',role:'owner',text:packet.text,requestKey:packet.requestKey});return response({...view(updated),reference:packet.reference});}
  const job=await suggestActionsWithClaude(c);return response({job,...await serviceHistory(c)});
 }
 if(p[0]==='services'&&p[1]==='claude'){if(!hasReviewEvidence(c))throw Error('Add settlement records, a credit note or a bank receipt before asking for an accounting review.');const {question}=z.object({question:z.string().min(1).max(800)}).parse(await body(req));const job=await reviewWithClaude(c,question);return response({job,...await serviceHistory(c)});}
 if(p[0]==='services'&&p[1]==='crs'){const {personaId}=z.object({personaId:z.string().max(10),syntheticOnly:z.literal(true)}).parse(await body(req));const job=await runCrs(c.id,personaId);return response({job,...await serviceHistory(c)});}
 if(p[0]==='commerce'&&p[1]==='buy'){z.object({testnetOnly:z.literal(true)}).parse(await body(req));const job=await buyClosePacket(a,c,req.nextUrl.origin);return response({job,...await serviceHistory(c)});}
 if(p[0]==='commerce'&&p[1]==='faucet'){z.object({testnetOnly:z.literal(true)}).parse(await body(req));return response({job:await fundDemoBuyer()});}
 if(p[0]==='operations'){const command=operationsCommandSchema.parse(await body(req));return response(view(await applyCommand(a,command)));}
 if(p[0]==='demo'&&p[1]==='reset')return response(view(await applyCommand(a,{type:'reset'})));
 if(p[0]==='scenarios'){const b=z.object({invoiceId:z.string(),expectedDate:z.iso.date(),expectedAmountCents:z.number().int().nonnegative().optional(),reason:z.string().min(1).max(500)}).parse(await body(req));return response(view(await applyCommand(a,{type:'scenario',...b})));}
 if(p[0]==='invoices'&&p[1]){const b=z.object({amountCents:z.number().int().positive()}).parse(await body(req));return response(view(await applyCommand(a,{type:'edit_invoice',invoiceId:p[1],...b})));}
 if(p[0]==='documents'){
  const form=await req.formData();const f=form.get('file');if(!(f instanceof File)||f.size>MAX_BYTES)throw Error('Choose a supported file up to 1 MB');const bytes=new Uint8Array(await f.arrayBuffer());const parsed=await parseUpload(bytes,f.name,f.type,c);
  transition(c,parsed.credit?{type:'upload_credit',document:parsed.document,credit:parsed.credit}:{type:'upload_receipt',document:parsed.document,receipt:parsed.receipt!});
  const storageRef=await saveOriginal(a,bytes,parsed.document.mime);const document={...parsed.document,storageRef};
  if(parsed.credit)c=await applyCommand(a,{type:'upload_credit',document,credit:parsed.credit});else c=await applyCommand(a,{type:'upload_receipt',document,receipt:parsed.receipt!});return response(view(c));
 }
 if(p[0]==='proposals'&&p[1]&&['approve','reject'].includes(p[2])){const b=z.object({reason:z.string().min(1).max(500),requestKey:z.string().min(8).max(120),expectedLedgerVersion:z.number().int()}).parse(await body(req));return response(view(await applyCommand(a,{type:'decision',proposalId:p[1],status:p[2]==='approve'?'approved':'rejected',...b})));}
 if(p[0]==='investigations'||p[0]==='findings'){
  const b=z.object({mode:z.enum(['CREAO','LOCAL_REHEARSAL']).default('CREAO'),question:z.string().max(1000).optional(),injectTimeout:z.boolean().optional(),resumeRunId:z.string().optional()}).parse(await body(req));
  if(b.resumeRunId){const r=c.runs.find(r=>r.id===b.resumeRunId);if(!r)throw Error('Run unavailable');if(r.mode==='CREAO'&&r.providerRunId&&r.state==='needs_review'&&!r.result)c=await applyCommand(a,{type:'update_run',runId:r.id,generation:r.generation,patch:{state:'submitted'}});if(r.mode==='LOCAL_REHEARSAL'&&r.state==='retry_scheduled')c=await applyCommand(a,{type:'apply_result',runId:r.id,generation:r.generation,result:localRehearsal(c)});else c=await poll(a,c);return response(view(c));}
  const run:Run={id:randomUUID(),inputVersion:c.inputVersion,generation:c.generation,mode:b.mode,sourceVersions:{ledgerVersion:c.ledgerVersion,operationsVersion:c.operations.version,closeVersion:c.close.version},inputDigest:investigationDigest(c,b.question),state:b.mode==='CREAO'&&!view(c).capabilities.hostedInvestigation?'blocked':'queued',startedAt:Date.now(),challenge:b.question};
  if(run.state==='blocked')run.error='CREAO hosted execution unavailable. Configure agent ID, API key, and verify the v2 contract. Local rehearsal is separate and does not satisfy the mandatory integration.';
  c=await applyCommand(a,{type:'start_run',run});
  if(run.state==='blocked')return response(view(c));
  if(b.mode==='LOCAL_REHEARSAL'){
   if(b.question){c=await applyCommand(a,{type:'update_run',runId:run.id,generation:run.generation,patch:{state:'needs_review',error:'Free-form challenges require CREAO; local rehearsal cannot answer your question.'}});}
   else if(b.injectTimeout)c=await applyCommand(a,{type:'update_run',runId:run.id,generation:run.generation,patch:{state:'retry_scheduled',error:'SIMULATED retrieval timeout. Resume the same local run.'}});
   else c=await applyCommand(a,{type:'apply_result',runId:run.id,generation:run.generation,result:localRehearsal(c)});
  }else{
   // Persist submission intent first. An interrupted/ambiguous submission is never blindly repeated.
   c=await applyCommand(a,{type:'update_run',runId:run.id,generation:run.generation,patch:{state:'unknown',error:'Submission outcome unknown until a provider run ID is saved; reconcile in CREAO before another run.'}});
   try{const providerRunId=await startInvestigation(c,b.question);c=await applyCommand(a,{type:'update_run',runId:run.id,generation:run.generation,patch:{providerRunId,state:'submitted',error:undefined}});}catch{c=await applyCommand(a,{type:'update_run',runId:run.id,generation:run.generation,patch:{state:'unknown',error:'Submission outcome unknown. Do not retry blindly; reconcile against CREAO account history.'}});}
  }
  return response(view(c));
 }
 return response({error:'Route not found'},404);
 }catch(error){return response({error:humanMessage(error)},400);}}
