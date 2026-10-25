import { Entry, Case, entrySchema } from '../contracts';
const DAY=86_400_000;
export function dayNumber(date:string) { const time=Date.parse(date+'T00:00:00Z'); if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date) throw Error('Invalid calendar date'); return time/DAY; }
export function plusDays(date:string,days:number) {return new Date((dayNumber(date)+days)*DAY).toISOString().slice(0,10);}
export function money(cents:number) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(cents/100); }
export function validateEntry(raw:Entry) {
  const entry=entrySchema.parse(raw);let debit=0,credit=0;
  for(const line of entry.lines){if((line.debitCents>0)===(line.creditCents>0))throw Error('Each line must have exactly one positive side');debit+=line.debitCents;credit+=line.creditCents;}
  if(!Number.isSafeInteger(debit)||debit!==credit)throw Error('Journal entry is not balanced');
  return entry;
}
export function outstanding(c:Case,invoiceId:string,includeCredits=true){
  const inv=c.invoices.find(x=>x.id===invoiceId);if(!inv)throw Error('Unknown invoice');
  const credits=includeCredits?c.credits.filter(x=>x.invoiceId===invoiceId&&x.approved).reduce((s,x)=>s+x.amountCents,0):0;
  const receipts=c.receipts.filter(x=>x.invoiceId===invoiceId&&x.posted).reduce((s,x)=>s+x.amountCents,0);
  const result=inv.amountCents-credits-receipts;if(result<0)throw Error(`Overpayment/over-credit exception: ${inv.number}`);return result;
}
export type Week={index:number;start:string;end:string;openingCents:number;receiptsCents:number;obligationsCents:number;closingCents:number;contributions:{id:string;label:string;amountCents:number;date:string}[]};
export function forecast(c:Case,mode:'baseline'|'revised'|'preview'='revised',reserveCents=0){
  const input=structuredClone(c);
  if(mode==='baseline')for(const r of input.receipts)if(input.entries.some(e=>e.id==='post:receipt:'+r.id))r.posted=false;
  if(mode==='preview')for(const p of input.proposals.filter(p=>p.status==='pending'&&p.kind==='credit')){const cr=input.credits.find(x=>x.id===p.targetId);if(cr)cr.approved=true;}
  const weeks:Week[]=Array.from({length:13},(_,i)=>({index:i+1,start:plusDays(c.business.startDate,i*7),end:plusDays(c.business.startDate,(i+1)*7),openingCents:0,receiptsCents:0,obligationsCents:0,closingCents:0,contributions:[]}));
  const outside:{id:string;date:string;amountCents:number;reason:string}[]=[];
  for(const inv of input.invoices){const scenario=mode==='baseline'?undefined:input.scenarios.find(x=>x.invoiceId===inv.id);const amount=outstanding(input,inv.id,mode!=='baseline');const collect=scenario?.expectedAmountCents??amount;if(collect>amount)throw Error('Scenario collections exceed receivable');const date=scenario?.expectedDate??inv.expectedDate;let idx=Math.floor((dayNumber(date)-dayNumber(c.business.startDate))/7);if(idx<0){outside.push({id:inv.id,date,amountCents:collect,reason:'Overdue: placed in week 1 as an explicit assumption'});idx=0;}if(idx>=13){outside.push({id:inv.id,date,amountCents:collect,reason:'Outside 13-week horizon'});continue;}weeks[idx].receiptsCents+=collect;weeks[idx].contributions.push({id:inv.id,label:inv.number+' · '+inv.counterparty,amountCents:collect,date});}
  for(const ob of input.obligations){const idx=Math.floor((dayNumber(ob.date)-dayNumber(c.business.startDate))/7);if(idx<0||idx>=13){outside.push({id:ob.id,date:ob.date,amountCents:-ob.amountCents,reason:'Obligation outside horizon'});continue;}weeks[idx].obligationsCents+=ob.amountCents;weeks[idx].contributions.push({id:ob.id,label:ob.description,amountCents:-ob.amountCents,date:ob.date});}
  // Imported receipts are already in the opening snapshot. New postings follow
  // their real dates; a future receipt must never silently increase opening cash.
  let cash=c.business.openingCashCents;
  if(mode!=='baseline')for(const r of input.receipts.filter(r=>r.posted&&input.entries.some(e=>e.id==='post:receipt:'+r.id))){
    const idx=Math.floor((dayNumber(r.date)-dayNumber(c.business.startDate))/7);
    if(idx<0){cash+=r.amountCents;outside.push({id:r.id,date:r.date,amountCents:r.amountCents,reason:'New historical receipt reconciles opening cash'});}
    else if(idx>=13)outside.push({id:r.id,date:r.date,amountCents:r.amountCents,reason:'Posted receipt outside 13-week horizon'});
    else {weeks[idx].receiptsCents+=r.amountCents;weeks[idx].contributions.push({id:r.id,label:'Posted receipt · '+r.id,date:r.date,amountCents:r.amountCents});}
  }
  for(const w of weeks){w.openingCents=cash;cash+=w.receiptsCents-w.obligationsCents;w.closingCents=cash;}
  return {weeks,outside,reserveCents,firstShortfallDate:weeks.find(w=>w.closingCents<reserveCents)?.start??null};
}
