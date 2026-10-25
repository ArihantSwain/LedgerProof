import { Case, Command, commandSchema, caseSchema } from './contracts';
import { createFixture } from '../fixtures/agency';
import { outstanding, validateEntry, forecast } from './finance';
import { validateResult, findingId } from './investigation';
import { operationsCommandSchema } from './contracts/operations';
import { applyOperations } from './operations';
import {closeCommandSchema} from './contracts/close';
import {applyClose} from './close';
import {evidenceCommandSchema} from './contracts/evidence';
import {applyEvidence} from './evidence';

export function transition(original:Case,raw:Command,now=Date.now()):Case{
 const cmd=commandSchema.parse(raw);let c=structuredClone(original);
 if(c.expiresAt<now)throw Error('Demo session expired');
 const before=c.inputVersion;
 const event=(action:string,targetId:string,reason:string)=>c.events.push({id:`event-${c.revision+1}-${c.events.length}`,action,targetId,reason,timestamp:now,beforeVersion:before,afterVersion:c.inputVersion,actor:'demo-reviewer'});
 const evidenceCommand=evidenceCommandSchema.safeParse(cmd);
 if(evidenceCommand.success){if(!applyEvidence(c.evidencePurchases,evidenceCommand.data,now))return original;event(cmd.type,c.id,'reason' in evidenceCommand.data?evidenceCommand.data.reason:'Evidence procurement record updated');c.revision++;return caseSchema.parse(c);}
 const closeCommand=closeCommandSchema.safeParse(cmd);
 if(closeCommand.success){if(!applyClose(c.close,closeCommand.data,now))return original;event(cmd.type,c.id,'reason' in closeCommand.data?closeCommand.data.reason:'Imported settlement evidence');c.revision++;return caseSchema.parse(c);}
 const operation=operationsCommandSchema.safeParse(cmd);
 if(operation.success){
   if(!applyOperations(c,operation.data,now))return original;
   event(operation.data.type,c.id,'reason' in operation.data?operation.data.reason:'Finance operations planning / review; no external action executed');
   c.revision++;return caseSchema.parse(c);
 }
 if(cmd.type==='reset'){const reset=createFixture(c.id,now,c.generation+1,c.mode);reset.revision=c.revision+1;return reset;}
 if(cmd.type==='edit_invoice'){
   if(c.proposals.some(p=>p.status==='approved'))throw Error('Reset before changing imported invoice amounts after posting');
   const i=c.invoices.find(x=>x.id===cmd.invoiceId);if(!i)throw Error('Unknown invoice');if(i.id!=='invoice-0')throw Error('Editable import is limited to Invoice A');i.amountCents=cmd.amountCents;
   const e=c.entries.find(e=>e.id==='entry-'+i.id)!;e.lines[0].debitCents=cmd.amountCents;e.lines[1].creditCents=cmd.amountCents;
   const d=c.documents.find(d=>d.id===i.evidenceId)!;d.text=d.text.replace(/AmountCents: \d+/,`AmountCents: ${cmd.amountCents}`);delete d.storageRef;d.sha256='edited-normalized-record';
   c.inputVersion++;c.ledgerVersion++;c.findings=[];c.proposals=c.proposals.filter(p=>p.status!=='pending');event('import_edited',i.id,'Judge changed the synthetic source amount');
 }
 if(cmd.type==='scenario'){
   if(!c.invoices.some(i=>i.id===cmd.invoiceId))throw Error('Unknown invoice');if(cmd.expectedAmountCents!==undefined&&cmd.expectedAmountCents>outstanding(c,cmd.invoiceId))throw Error('Scenario amount exceeds receivable');
   c.scenarios=c.scenarios.filter(x=>x.invoiceId!==cmd.invoiceId);const {type,...assumption}=cmd;c.scenarios.push(assumption);event('scenario_changed',cmd.invoiceId,cmd.reason);
 }
 if(cmd.type==='upload_credit'||cmd.type==='upload_receipt'){
   if(c.documents.length>=30)throw Error('Demo document limit reached');if(c.documents.some(d=>d.sha256===cmd.document.sha256))throw Error('Document already imported');
   const item=cmd.type==='upload_credit'?cmd.credit:cmd.receipt;
   if(!c.invoices.some(i=>i.id===item.invoiceId))throw Error('Unknown invoice reference');if(item.evidenceId!==cmd.document.id)throw Error('Evidence mismatch');if(item.amountCents>outstanding(c,item.invoiceId))throw Error('Overpayment/over-credit exception requires manual review');
   c.documents.push(cmd.document);if(cmd.type==='upload_credit'){if(cmd.credit.approved)throw Error('Uploaded credit cannot be preapproved');c.credits.push(cmd.credit);}else{if(cmd.receipt.posted)throw Error('Uploaded receipt cannot be preposted');c.receipts.push(cmd.receipt);}
   c.inputVersion++;c.findings=[];c.proposals=c.proposals.filter(p=>p.status!=='pending');event('evidence_uploaded',item.id,cmd.document.filename);
 }
 if(cmd.type==='start_run'){
   if(c.runs.some(r=>r.inputVersion===c.inputVersion&&['queued','submitted','running','validating','unknown'].includes(r.state)))throw Error('An investigation is already active or its submission outcome is unknown');
   if(cmd.run.inputVersion!==c.inputVersion||cmd.run.generation!==c.generation)throw Error('Stale run');if(c.runs.length>=30)throw Error('Demo investigation limit reached');c.runs.push(cmd.run);event('investigation_started',cmd.run.id,cmd.run.mode);
 }
 if(cmd.type==='update_run'){
   const run=c.runs.find(r=>r.id===cmd.runId);if(!run||cmd.generation!==c.generation)return original;
   if(cmd.patch.id&&cmd.patch.id!==run.id)throw Error('Run identity cannot change');
   Object.assign(run,cmd.patch);if(run.inputVersion!==c.inputVersion)run.state='stale';event('investigation_status',run.id,run.state);
 }
 if(cmd.type==='apply_result'){
   const run=c.runs.find(r=>r.id===cmd.runId);if(!run||cmd.generation!==c.generation)return original;
   if(run.state==='completed'||run.state==='needs_review')return original;
   if(run.inputVersion!==c.inputVersion){run.state='stale';c.revision++;return c;}
   const result=validateResult(c,cmd.result);run.result=result;run.state=result.missingEvidence.length?'needs_review':'completed';
   c.findings=result.findings.map((f,i)=>({...f,id:findingId(run.id,i)}));c.proposals=c.proposals.filter(p=>p.status!=='pending');
   for(const f of c.findings){
     const base={findingId:f.id,baseLedgerVersion:c.ledgerVersion,status:'pending' as const};
     if(f.type==='unapplied_credit_note'&&f.proposedAction==='review_credit_application'&&['supported','possible'].includes(f.certaintyLabel))for(const cr of c.credits.filter(x=>f.affectedRecordIds.includes(x.id)&&f.affectedRecordIds.includes(x.invoiceId)&&f.evidenceRefs.includes(x.evidenceId)&&f.evidenceRefs.includes(c.invoices.find(i=>i.id===x.invoiceId)!.evidenceId)&&!x.approved)){
       if(c.proposals.some(p=>p.kind==='credit'&&p.targetId===cr.id&&p.status!=='rejected'))continue;
       const reserved=c.proposals.filter(p=>p.kind==='credit'&&p.status==='pending'&&c.credits.find(x=>x.id===p.targetId)?.invoiceId===cr.invoiceId).reduce((s,p)=>s+p.amountCents,0);
       if(cr.amountCents+reserved>outstanding(c,cr.invoiceId))continue;
       c.proposals.push({...base,id:`proposal:${run.id}:${cr.id}`,targetId:cr.id,kind:'credit',amountCents:cr.amountCents,entry:{id:'post:credit:'+cr.id,sourceReference:cr.evidenceId,effectiveDate:cr.date,lines:[{account:'sales_returns',debitCents:cr.amountCents,creditCents:0},{account:'accounts_receivable',debitCents:0,creditCents:cr.amountCents}]}});
     }
     if(f.type==='unmatched_receipt'&&f.proposedAction==='review_receipt_match')for(const r of c.receipts.filter(x=>f.affectedRecordIds.includes(x.id)&&f.evidenceRefs.includes(x.evidenceId)&&!x.posted)){
       if(c.proposals.some(p=>p.kind==='receipt'&&p.targetId===r.id&&p.status!=='rejected'))continue;
       c.proposals.push({...base,id:`proposal:${run.id}:${r.id}`,targetId:r.id,kind:'receipt',amountCents:r.amountCents,entry:{id:'post:receipt:'+r.id,sourceReference:r.evidenceId,effectiveDate:r.date,lines:[{account:'cash',debitCents:r.amountCents,creditCents:0},{account:'accounts_receivable',debitCents:0,creditCents:r.amountCents}]}});
     }
     if(f.type==='duplicate_invoice'&&f.proposedAction==='review_duplicate'){
       const pair=c.entries.filter(e=>f.affectedRecordIds.includes(e.id));if(pair.length!==2)continue;const [a,b]=pair;
       if(JSON.stringify([a.sourceReference,a.lines,a.effectiveDate])!==JSON.stringify([b.sourceReference,b.lines,b.effectiveDate])||!f.evidenceRefs.includes(b.sourceReference)||c.entries.some(e=>e.reversalReference===b.id))continue;
       c.proposals.push({...base,id:`proposal:${run.id}:${b.id}`,targetId:b.id,kind:'duplicate',amountCents:b.lines.reduce((s,l)=>s+l.debitCents,0),entry:{id:'post:duplicate:'+b.id,sourceReference:b.sourceReference,effectiveDate:b.effectiveDate,reversalReference:b.id,lines:b.lines.map(l=>({account:l.account,debitCents:l.creditCents,creditCents:l.debitCents}))}});
     }
   }
   event('result_validated',run.id,run.mode+' · citations validated');
 }
 if(cmd.type==='decision'){
   const prior=c.decisions[cmd.requestKey];if(prior){if(prior.proposalId!==cmd.proposalId||prior.status!==cmd.status||prior.reason!==cmd.reason)throw Error('Idempotency key reused for a different decision');return original;}
   const p=c.proposals.find(p=>p.id===cmd.proposalId);if(!p)throw Error('Unknown proposal');if(p.status!=='pending')throw Error('Proposal already decided');if(cmd.expectedLedgerVersion!==c.ledgerVersion||p.baseLedgerVersion!==c.ledgerVersion)throw Error('Ledger changed; rerun investigation before reviewing');
   if(cmd.status==='approved'){
     validateEntry(p.entry);if(c.entries.some(e=>e.id===p.entry.id))throw Error('Entry already posted');
     if(p.kind==='credit'){const cr=c.credits.find(x=>x.id===p.targetId)!;if(cr.approved||cr.amountCents>outstanding(c,cr.invoiceId))throw Error('Credit already applied or exceeds outstanding');cr.approved=true;}
     if(p.kind==='receipt'){const r=c.receipts.find(x=>x.id===p.targetId)!;if(r.posted||r.amountCents>outstanding(c,r.invoiceId))throw Error('Receipt already applied or exceeds outstanding');r.posted=true;}
     if(p.kind==='duplicate'&&c.entries.some(e=>e.reversalReference===p.targetId))throw Error('Duplicate already reversed');
     c.entries.push(p.entry);c.ledgerVersion++;c.inputVersion++;
   }
   p.status=cmd.status;c.decisions[cmd.requestKey]={proposalId:p.id,status:cmd.status,reason:cmd.reason};event('proposal_'+cmd.status,p.id,cmd.reason);
 }
 for(const i of c.invoices)outstanding(c,i.id);forecast(c);c.revision++;
 return caseSchema.parse(c);
}
