import { Case } from '../lib/contracts';
export function createFixture(id:string,now:number,generation=1,mode:Case['mode']='LOCAL_REHEARSAL'):Case {
  const docs:Case['documents']=[];const invoices:Case['invoices']=[];const receipts:Case['receipts']=[];
  const names=['Aster Advisory','Juniper Studio','Northline Partners','Morrow Design','Fieldwork Co.','Oriel Consulting','Tandem Works','Coast & Pine','Civic Studio','Sable Agency'];
  for(let i=0;i<10;i++){const num=i===0?'INV-A':`INV-${String(i+1).padStart(3,'0')}`;const amount=i===0?2_000_000:(i+1)*100_000;const doc='doc-inv-'+i;
    invoices.push({id:'invoice-'+i,number:num,counterparty:names[i],amountCents:amount,issueDate:'2026-10-01',dueDate:i===0?'2026-11-01':'2027-02-01',expectedDate:i===0?'2026-10-28':'2027-02-01',evidenceId:doc});
    docs.push({id:doc,filename:num+'.pdf',mime:'application/pdf',sha256:'fixture-generated',uploadedAt:now,kind:'invoice',text:`LedgerProof synthetic invoice\nInvoice: ${num}\nCounterparty: ${names[i]}\nCurrency: USD\nAmountCents: ${amount}\nIssueDate: 2026-10-01\nDueDate: ${i===0?'2026-11-01':'2027-02-01'}`});
    if(i>0){const partial=i===2;receipts.push({id:'receipt-'+i,invoiceId:'invoice-'+i,amountCents:partial?100_000:amount,date:'2026-10-20',posted:true,evidenceId:'doc-bank'});}
  }
  receipts.push({id:'receipt-unmatched',invoiceId:'invoice-2',amountCents:50_000,date:'2026-10-21',posted:false,evidenceId:'doc-bank'});
  docs.push({id:'doc-bank',filename:'bank.csv',mime:'text/csv',sha256:'fixture-generated',uploadedAt:now,kind:'bank',text:'externalId,invoiceNumber,postedDate,amountCents\n'+receipts.map(r=>`${r.id},${invoices.find(x=>x.id===r.invoiceId)!.number},${r.date},${r.amountCents}`).join('\n')});
  const entries:Case['entries']=[{id:'opening',sourceReference:'doc-ledger',effectiveDate:'2026-10-01',lines:[{account:'cash',debitCents:2_000_000,creditCents:0},{account:'opening_equity',debitCents:0,creditCents:2_000_000}]}];
  for(const inv of invoices)entries.push({id:'entry-'+inv.id,sourceReference:inv.evidenceId,effectiveDate:inv.issueDate,lines:[{account:'accounts_receivable',debitCents:inv.amountCents,creditCents:0},{account:'service_revenue',debitCents:0,creditCents:inv.amountCents}]});
  entries.push({...structuredClone(entries[5]),id:'entry-duplicate',reversalReference:undefined});
  // Imported historical receipts are explicitly offset by distributions in the opening cash snapshot.
  for(const r of receipts.filter(r=>r.posted))entries.push({id:'entry-'+r.id,sourceReference:r.evidenceId,effectiveDate:r.date,lines:[{account:'cash',debitCents:r.amountCents,creditCents:0},{account:'accounts_receivable',debitCents:0,creditCents:r.amountCents}]});
  const distributed=receipts.filter(r=>r.posted).reduce((s,r)=>s+r.amountCents,0);
  entries.push({id:'historical-distribution',sourceReference:'doc-ledger',effectiveDate:'2026-10-23',lines:[{account:'opening_equity',debitCents:distributed,creditCents:0},{account:'cash',debitCents:0,creditCents:distributed}]});
  docs.push({id:'doc-ledger',filename:'ledger.csv',mime:'text/csv',sha256:'fixture-generated',uploadedAt:now,kind:'ledger',text:'entryId,sourceReference,date,account,debitCents,creditCents\n'+entries.flatMap(e=>e.lines.map(l=>`${e.id},${e.sourceReference},${e.effectiveDate},${l.account},${l.debitCents},${l.creditCents}`)).join('\n')});
  return {id,generation,createdAt:now,expiresAt:now+24*60*60*1000,mode,business:{id:'agency',displayName:'Cedar & Co. Creative',currency:'USD',timezone:'America/Los_Angeles',openingCashCents:2_000_000,startDate:'2026-10-26'},inputVersion:1,ledgerVersion:1,revision:1,invoices,receipts,credits:[],documents:docs,obligations:[{id:'payroll-1',date:'2026-10-30',amountCents:1_200_000,category:'payroll',description:'Week 1 payroll'},{id:'payroll-2',date:'2026-11-06',amountCents:1_200_000,category:'payroll',description:'Week 2 payroll'},{id:'expense-1',date:'2026-11-18',amountCents:150_000,category:'expense',description:'Studio lease'},{id:'expense-2',date:'2026-11-20',amountCents:50_000,category:'expense',description:'Software subscriptions'}],entries,scenarios:[],findings:[],proposals:[],runs:[],events:[],decisions:{}};
}
