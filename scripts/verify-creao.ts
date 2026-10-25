import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createFixture} from '../fixtures/agency';
import {startInvestigation,getInvestigation,ProviderResultError} from '../lib/providers/creao';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const amount=process.argv.includes('--changed-input')?600000:800000;
const c=createFixture('creao-live-verification',Date.now());c.inputVersion=2;
c.invoices=c.invoices.slice(0,1);c.receipts=[];c.entries=c.entries.filter(e=>['opening','entry-invoice-0'].includes(e.id));c.documents=c.documents.filter(d=>d.id==='doc-inv-0');
c.documents.push({id:'test-credit-document',filename:'issued-credit.pdf',mime:'application/pdf',sha256:'synthetic-verification',uploadedAt:c.createdAt,kind:'credit_note',text:`Type: credit_note\nInvoice: INV-A\nCurrency: USD\nAmountCents: ${amount}\nDate: 2026-10-26`});
c.credits=[{id:'test-credit',invoiceId:'invoice-0',amountCents:amount,date:'2026-10-26',evidenceId:'test-credit-document',approved:false}];
await mkdir('.data/verification',{recursive:true});
const file=`.data/verification/creao-${amount}.json`;
let checkpoint:{agentId:string;runId:string;amountCents:number;startedAt:string;status:string};
if(existsSync(file)){
 checkpoint=JSON.parse(await readFile(file,'utf8'));
 if(checkpoint.agentId!==process.env.CREAO_AGENT_ID)throw Error('Existing verification belongs to another agent; reconcile it manually');
}else{
 const runId=await startInvestigation(c);checkpoint={agentId:process.env.CREAO_AGENT_ID!,runId,amountCents:amount,startedAt:new Date().toISOString(),status:'submitted'};await writeFile(file,JSON.stringify(checkpoint,null,2));
}
c.runs.push({id:'verification-run',inputVersion:c.inputVersion,generation:c.generation,mode:'CREAO',state:'submitted',startedAt:Date.parse(checkpoint.startedAt),providerRunId:checkpoint.runId,sourceVersions:{ledgerVersion:c.ledgerVersion,operationsVersion:c.operations.version,closeVersion:c.close.version}});
console.log(JSON.stringify({provider:'CREAO',runId:checkpoint.runId,creditCents:amount,status:checkpoint.status}));
for(let i=0;i<32;i++){
 try{
  const state=await getInvestigation(checkpoint.runId,c);
  if(state.status==='completed'){
   if(!state.result?.findings.some(f=>f.type==='unapplied_credit_note'&&f.affectedRecordIds.includes('test-credit')&&f.evidenceRefs.includes('test-credit-document')))throw Error('Completed run missed the required source-bound credit finding');
   await mkdir('docs/evidence',{recursive:true});
   await writeFile(`docs/evidence/creao-${amount}.json`,JSON.stringify({...checkpoint,status:'LIVE_VERIFIED',completedAt:new Date().toISOString(),model:state.model??null,result:state.result,shareLink:null},null,2)+'\n');
   checkpoint.status='completed';await writeFile(file,JSON.stringify(checkpoint,null,2));console.log(JSON.stringify({status:'LIVE_VERIFIED',runId:checkpoint.runId,findings:state.result.findings.length}));process.exit(0);
  }
  if(state.status==='failed'||state.status==='cancelled')throw Error('Provider terminal state: '+state.status);
  console.log('CREAO status: '+state.status+' · same run retained');
 }catch(error){if(error instanceof ProviderResultError)throw error;console.error('Retrieval interrupted; retrying the same saved run ID. No resubmission.');}
 await new Promise(resolve=>setTimeout(resolve,15000));
}
throw Error('Verification deadline reached; checkpoint retains the provider ID. Rerun this script to retrieve the same run, never blindly resubmit.');
