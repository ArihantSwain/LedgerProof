import type {Case} from './contracts';
import {parseCloseCsv} from './close';

export function amountInCents(value:string,allowZero=false,max=100_000_000_000){
 if(!/^(?:\d+|\d*\.\d{1,2})$/.test(value.trim()))return null;
 const amount=Math.round(Number(value)*100);
 return Number.isSafeInteger(amount)&&amount<=(max)&&amount>=(allowZero?0:1)?amount:null;
}
export function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export function inForecast(value:string,start:string){return validDate(value)&&value>=start&&Date.parse(value)<Date.parse(start)+91*86400000;}
export function humanMessage(error:unknown):string{
 const raw=error instanceof Error?error.message:typeof error==='string'?error:'';
 if(/^(Add settlement records|These records are|This demo session|The records changed|An investigation is already|This amount is larger|This file refers|Choose a |Use a one-receipt|Check the settlement|This settlement has|The demo allowance|This live service|The buyer wallet|Please wait|Check the amount|This deposit needs|We could not confirm)/.test(raw))return raw;
 if(/^(Each converted|Each invoice|Each uploaded|Each bill|Choose the source|A payment or credit|A receipt or credit|An invoice number|Check every|This workspace supports)/.test(raw))return raw;
 if(/already imported|duplicate ingestion|duplicate source record/i.test(raw))return 'These records are already in this workspace. Choose a different file, or reset the demo to start again.';
 if(/session unavailable|session expired|demo session expired/i.test(raw))return 'This demo session has ended. Start a new demo to continue.';
 if(/ledger changed|inputs changed|evidence changed|stale|changed; refresh/i.test(raw))return 'The records changed during this review. Refresh the workspace and review the latest figures before approving.';
 if(/already active|submission outcome is unknown/i.test(raw))return 'An investigation is already in progress. Check its status before starting another.';
 if(/Overpayment\/over-credit|exceeds outstanding|exceeds receivable/i.test(raw))return 'This amount is larger than the invoice balance. Check the invoice and amount before importing it.';
 if(/Unknown invoice/i.test(raw))return 'This file refers to an invoice outside the sample business. Choose an example for INV-A or INV-003.';
 if(/Maximum 5|5 PDF pages/i.test(raw))return 'Choose a text-based PDF with five pages or fewer.';
 if(/1 MB|between 1 byte|supported file/i.test(raw))return 'Choose a nonempty credit-note PDF or one-receipt CSV smaller than 1 MB.';
 if(/Type: credit_note|Currency: USD/i.test(raw))return 'Choose a supported USD credit-note PDF. The sample pack includes files ready to upload.';
 if(/exactly one receipt|documented CSV header|bank CSV row/i.test(raw))return 'Use a one-payment CSV here, or use Import records for multiple files.';
 if(/Expected columns|quoted|positive integer|duplicate source|40 KB|settlement activity requires/i.test(raw))return 'Check the settlement CSV format: id, kind, date, amountCents, reference. Amounts use whole cents. A sample CSV is available to download.';
 if(/immutable/i.test(raw))return 'This settlement has already been approved. Start a fresh demo to try another version of that batch.';
 if(/request cap|spending.*cap|credit.*cap/i.test(raw))return 'The demo allowance for new requests has been reached. Previously saved results are still available.';
 if(/requires|credentials|API key|unavailable|disabled in offline|shared Convex/i.test(raw))return 'This live service is not available in this workspace. You can continue with the sample accounting workflow.';
 if(/Insufficient|needs USDC|fund.*wallet/i.test(raw))return 'The buyer wallet needs enough USDC before a purchase. You can inspect the quote without paying.';
 if(/limit reached|too many requests/i.test(raw))return 'Please wait a moment before trying another action.';
 if(/invalid PDF|supported inputs/i.test(raw))return 'Choose a supported credit-note PDF or bank receipt CSV from the example pack.';
 if(/Zod|\[\s*\{|invalid input|ISO date|NaN|too small|too big/i.test(raw))return 'Check the amount, date and required fields. The sample pack shows the supported format.';
 if(/not uniquely/i.test(raw))return 'This deposit needs more evidence before it can be approved.';
 return 'We could not confirm this action. Refresh the workspace to check its status before trying again.';
}
export function settlementInputIssue(c:Case,csv:string){
 if(!csv.trim())return 'Choose a settlement CSV or paste its source rows before importing.';
 try{
  const rows=parseCloseCsv(csv),ids=rows.map(r=>r.id);
  if(new Set(ids).size!==ids.length)return 'Each source row needs a unique ID.';
  if(rows.some(r=>c.close.records.some(old=>old.id===r.id)))return 'These source rows are already imported. Choose another file or reset the demo.';
  if(rows.length+c.close.records.length>100)return 'This workspace supports 100 settlement rows. Reset the demo to try this dataset.';
  if(rows.some(r=>r.kind!=='bank'&&!r.reference))return 'Add a batch reference to each charge, fee and refund.';
  if(rows.some(r=>r.kind!=='bank'&&c.close.postings.some(p=>p.batchId===r.reference)))return 'This batch is already approved. Reset the demo before trying a different version.';
  return '';
 }catch(error){return humanMessage(error);}
}
export function hasReviewEvidence(c:Case){return c.close.records.length>0||c.inputVersion>1||c.evidencePurchases.charges.length>0;}
export function runLabel(state:string){return ({queued:'Waiting to start',submitted:'Investigation started',running:'Investigating',validating:'Checking sources',needs_review:'Needs your review',completed:'Completed',retry_scheduled:'Waiting for the saved result',failed:'Could not complete',blocked:'Service unavailable',unknown:'Awaiting confirmation',stale:'Records have changed'} as Record<string,string>)[state]??state;}
