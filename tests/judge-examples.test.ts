process.env.LEDGERPROOF_OFFLINE_REHEARSAL='true';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {judgeSamples,fixtureTime,type JudgeSample} from '../fixtures/judge-scenarios';
import {createFixture} from '../fixtures/agency';
import {parseUpload} from '../lib/documents';
import {transition} from '../lib/workflow';
import {localRehearsal} from '../lib/investigation';
import {outstanding,forecast,validateEntry} from '../lib/finance';
import {parseCloseCsv,reconcileClose} from '../lib/close';
const root='public/examples/';
const fresh=()=>createFixture('judge-pack-verification',fixtureTime);
async function parsed(sample:JudgeSample,c=fresh()){
 return parseUpload(new Uint8Array(await readFile(root+sample.path)),sample.path.split('/').at(-1)!,sample.path.endsWith('.pdf')?'application/pdf':'text/csv',c);
}
function imported(c:ReturnType<typeof fresh>,result:Awaited<ReturnType<typeof parseUpload>>){
 return result.credit?transition(c,{type:'upload_credit',document:result.document,credit:result.credit},fixtureTime):transition(c,{type:'upload_receipt',document:result.document,receipt:result.receipt!},fixtureTime);
}
test('judge pack manifest matches every generated example and its checksum; archive is complete and valid',async()=>{
 const manifest=JSON.parse(await readFile(root+'manifest.json','utf8'));
 assert.equal(manifest.synthetic,true);assert.equal(manifest.providerOutputsFabricated,false);assert.equal(manifest.counts.examples,judgeSamples.length);assert.ok(judgeSamples.length>=80);
 assert.equal(new Set(judgeSamples.map(s=>s.path)).size,judgeSamples.length);
 for(const sample of judgeSamples){const entry=manifest.entries.find((e:{path:string})=>e.path===sample.path);assert.ok(entry,sample.path);const bytes=await readFile(root+sample.path);assert.equal(bytes.length,entry.bytes,sample.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,sample.path);}
 const zipped=spawnSync('python3',['-c',`from zipfile import ZipFile
from pathlib import Path
with ZipFile('public/examples/ledgerproof-judge-pack.zip') as z:
 assert z.testzip() is None
 for p in Path('public/examples').rglob('*'):
  if p.is_file() and p.suffix!='.zip':
   assert z.read('ledgerproof-judge-pack/'+p.relative_to('public/examples').as_posix())==p.read_bytes()
`],{encoding:'utf8'});assert.equal(zipped.status,0,zipped.stderr);
});
for(const use of ['credit-upload','receipt-upload'] as const)test(`all supported ${use} examples produce independently specified remaining balances and week-two cash only after approval`,async()=>{
 for(const sample of judgeSamples.filter(s=>s.use===use&&s.expected.outcome==='review')){
  let c=fresh();const before=c.entries.length;const result=await parsed(sample,c);c=imported(c,result);assert.equal(c.entries.length,before,sample.path);
  const runId='judge-example-run';c=transition(c,{type:'start_run',run:{id:runId,inputVersion:c.inputVersion,generation:c.generation,mode:'LOCAL_REHEARSAL',state:'queued',startedAt:fixtureTime}},fixtureTime);
  c=transition(c,{type:'apply_result',runId,generation:c.generation,result:localRehearsal(c)},fixtureTime);
  assert.equal(c.entries.length,before,sample.path+' must not auto-post');
  const targetId=result.credit?.id??result.receipt!.id;const proposal=c.proposals.find(p=>p.targetId===targetId);assert.ok(proposal,sample.path);assert.equal(proposal.status,'pending');
  c=transition(c,{type:'decision',proposalId:proposal.id,status:'approved',expectedLedgerVersion:c.ledgerVersion,requestKey:'judge-approved-example',reason:'Inspected this synthetic example source.'},fixtureTime);
  const invoice=c.invoices.find(i=>i.number===sample.expected.invoiceNumber)!;
  assert.equal(outstanding(c,invoice.id),sample.expected.remainingCents,sample.path);assert.equal(forecast(c).weeks[1].closingCents,sample.expected.week2Cents,sample.path);validateEntry(c.entries.at(-1)!);
  await assert.rejects(async()=>imported(c,await parsed(sample,c)),/already imported|Overpayment\/over-credit/,sample.path+' duplicate ingestion');
 }
});
test('all settlement sets preserve their expected ambiguity or reconcile into balanced source-linked journals without changing agency cash',async()=>{
 for(const sample of judgeSamples.filter(s=>s.use==='settlement-import'&&s.expected.outcome==='reconcile')){
  let c=fresh();
  for(const path of [...(sample.prerequisites??[]),sample.path])c=transition(c,{type:'close_import',records:parseCloseCsv(await readFile(root+path,'utf8')),expectedCloseVersion:c.close.version,requestKey:'import-'+path},fixtureTime);
  const result=reconcileClose(c.close);assert.deepEqual(Object.fromEntries(result.banks.map(b=>[b.bank.id,b.status])),sample.expected.bankStatuses,sample.path);
  for(const bank of result.banks){
   const decision={type:'close_approve' as const,bankId:bank.bank.id,batchId:bank.batch?.id??bank.candidateBatchIds[0]??'missing',expectedCloseVersion:c.close.version,requestKey:'approve-'+bank.bank.id,reason:'Reviewed source rows.'};
   if(bank.status!=='ready'){assert.throws(()=>transition(c,decision,fixtureTime),/not uniquely/,sample.path);continue;}
   c=transition(c,decision,fixtureTime);const journal=c.close.postings.at(-1)!;assert.equal(journal.lines.reduce((s,l)=>s+l.debitCents-l.creditCents,0),0,sample.path);assert.ok(journal.sourceIds.length>=2);
  }
  assert.equal(forecast(c).weeks[1].closingCents,1600000,sample.path+' does not alter the separate agency forecast');
 }
});
test('all intentional failures reject at the documented stage before any source or journal is accepted',async()=>{
 for(const sample of judgeSamples.filter(s=>s.expected.outcome==='reject')){
  const c=fresh(),before=JSON.stringify(c),error=new RegExp(sample.expected.error!,'i');
  if(sample.use==='settlement-import'){
   if(sample.expected.stage==='transition'){const records=parseCloseCsv(await readFile(root+sample.path,'utf8'));assert.throws(()=>transition(c,{type:'close_import',records,expectedCloseVersion:1,requestKey:'rejected-settlement'},fixtureTime),error,sample.path);}
   else assert.throws(()=>parseCloseCsv(sample.content),error,sample.path);
  }else if(sample.expected.stage==='transition'){const result=await parsed(sample,c);assert.throws(()=>imported(c,result),error,sample.path);}
  else await assert.rejects(()=>parsed(sample,c),error,sample.path);
  assert.equal(JSON.stringify(c),before,sample.path+' must not mutate the original case');
 }
});
