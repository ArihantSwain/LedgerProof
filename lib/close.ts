import {closeRecordSchema,CloseRecord,CloseState,closeCommandSchema} from './contracts/close';
import {z} from 'zod';
// Imported charges are already recognized in processor clearing. Settlement
// clears that balance; it never recognizes the same sales twice.
export function reconcileClose(state:CloseState){
 const batches=[...new Set(state.records.filter(r=>r.kind!=='bank').map(r=>r.reference))].filter(Boolean).map(id=>{
  const records=state.records.filter(r=>r.kind!=='bank'&&r.reference===id);
  const total=(kind:CloseRecord['kind'])=>records.filter(r=>r.kind===kind).reduce((n,r)=>n+r.amountCents,0);
  return {id,records,grossCents:total('charge'),refundCents:total('refund'),feeCents:total('fee'),netCents:total('charge')-total('refund')-total('fee')};
 });
 const usedBatches=new Set(state.postings.map(p=>p.batchId));
 const banks=state.records.filter(r=>r.kind==='bank').map(bank=>{
  const posted=state.postings.find(p=>p.bankId===bank.id);
  const explicit=batches.filter(b=>b.id===bank.reference);
  const candidates=(explicit.length?explicit:batches.filter(b=>!bank.reference&&b.netCents===bank.amountCents)).filter(b=>!usedBatches.has(b.id)||b.id===posted?.batchId);
  const batch=candidates.length===1?candidates[0]:undefined;
  const competing=!!batch&&state.records.some(r=>r.kind==='bank'&&r.id!==bank.id&&!state.postings.some(p=>p.bankId===r.id)&&(r.reference===batch.id||(!r.reference&&r.amountCents===batch.netCents)));
  const varianceCents=batch?bank.amountCents-batch.netCents:null;
  const status=posted?'posted':!candidates.length?'unmatched':candidates.length>1||competing?'ambiguous':varianceCents!==0||!batch?.grossCents||batch.netCents<=0?'variance':'ready';
  const lines=batch?[
   {account:'cash' as const,debitCents:bank.amountCents,creditCents:0},
   ...(batch.feeCents?[{account:'processing_fees' as const,debitCents:batch.feeCents,creditCents:0}]:[]),
   ...(batch.refundCents?[{account:'customer_refunds' as const,debitCents:batch.refundCents,creditCents:0}]:[]),
   {account:'processor_clearing' as const,debitCents:0,creditCents:batch.grossCents},
  ]:[];
  return {bank,batch,candidateBatchIds:candidates.map(b=>b.id),status,varianceCents,lines,sourceIds:[bank.id,...(batch?.records.map(r=>r.id)??[])],explanation:status==='posted'?'Approved in the demo settlement subledger.':status==='ready'?'Gross charges − documented refunds − documented fees exactly equals the bank deposit.':status==='ambiguous'?'Multiple allocations are possible. Add the settlement reference; an amount match alone cannot prove the allocation.':status==='variance'?'The bank deposit differs from documented activity. Obtain the missing record; do not invent a fee to force a match.':'No available settlement evidence explains this deposit.'};
 });
 return {version:state.version,batches,banks,ready:banks.filter(b=>b.status==='ready').length,exceptions:banks.filter(b=>!['ready','posted'].includes(b.status)).length,posted:state.postings.length,disclosure:'Synthetic processor settlement subledger. Gross charges assumed previously recognized in processor clearing; sales are not booked twice. Separate from the agency forecast. No external accounting writes.'};
}
export function applyClose(state:CloseState,raw:z.infer<typeof closeCommandSchema>,now:number){
 const cmd=closeCommandSchema.parse(raw);const signature=JSON.stringify(cmd);const prior=state.requests[cmd.requestKey];
 if(prior){if(prior!==signature)throw Error('Idempotency key reused for a different close action');return false;}
 if(state.version!==cmd.expectedCloseVersion)throw Error('Close evidence changed; refresh before reviewing');
 if(cmd.type==='close_import'){
  const ids=new Set(cmd.records.map(r=>r.id));if(ids.size!==cmd.records.length)throw Error('Duplicate source record IDs');
  const oldIds=new Set(state.records.map(r=>r.id));if(cmd.records.some(r=>oldIds.has(r.id)))throw Error('Source already imported; duplicate ingestion blocked');
  if(state.records.length+cmd.records.length>100)throw Error('Settlement source limit reached');
  if(state.postings.some(p=>cmd.records.some(r=>p.batchId===r.reference&&r.kind!=='bank')))throw Error('Posted batch is immutable; reverse and investigate before adding new evidence');
  if(cmd.records.some(r=>r.kind!=='bank'&&!r.reference))throw Error('Settlement activity requires a batch reference');
  state.records.push(...cmd.records);
 }else{
  const item=reconcileClose(state).banks.find(b=>b.bank.id===cmd.bankId);
  if(!item||item.status!=='ready'||item.batch?.id!==cmd.batchId)throw Error('Settlement is not uniquely reconciled; approval blocked');
  const debit=item.lines.reduce((n,l)=>n+l.debitCents,0),credit=item.lines.reduce((n,l)=>n+l.creditCents,0);
  if(debit!==credit||!Number.isSafeInteger(debit)||item.lines.some(l=>l.debitCents<0||l.creditCents<0))throw Error('Journal must balance exactly in integer cents');
  state.postings.push({id:'settlement-'+cmd.bankId,bankId:cmd.bankId,batchId:cmd.batchId,sourceIds:item.sourceIds,sourceVersion:state.version,lines:item.lines,reason:cmd.reason,postedAt:now});
 }
 state.requests[cmd.requestKey]=signature;state.version++;return true;
}
export const demoCloseCsv=`id,kind,date,amountCents,reference
bank_oct27,bank,2026-10-27,967000,payout_101
charge_a,charge,2026-10-26,600000,payout_101
charge_b,charge,2026-10-26,400000,payout_101
refund_a,refund,2026-10-26,30000,payout_101
fee_a,fee,2026-10-27,3000,payout_101
bank_oct28,bank,2026-10-28,495000,payout_102
charge_c,charge,2026-10-27,500000,payout_102
bank_oct29,bank,2026-10-29,250000,
charge_d,charge,2026-10-28,250000,payout_103
charge_e,charge,2026-10-28,250000,payout_104`;
export function parseCloseCsv(csv:string):CloseRecord[]{
 if(new TextEncoder().encode(csv).length>40_000)throw Error('CSV exceeds 40 KB limit');
 const lines=csv.trim().replace(/^\uFEFF/,'').split(/\r?\n/);if(lines[0]!=='id,kind,date,amountCents,reference')throw Error('Expected columns: id,kind,date,amountCents,reference');
 if(lines.length<2||lines.length>101)throw Error('Import 1–100 source rows');
 return lines.slice(1).map((line,index)=>{const values=line.split(',');if(values.length!==5||values.some(v=>/["\r\n]/.test(v)))throw Error(`Row ${index+2}: use the documented simple CSV format without quoted fields`);const [id,kind,date,amount,reference]=values;if(!/^\d+$/.test(amount))throw Error(`Row ${index+2}: amountCents must be a positive integer`);return closeRecordSchema.parse({id,kind,date,amountCents:Number(amount),reference});});
}
