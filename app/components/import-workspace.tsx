'use client';

import {useMemo, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import type {WorkspaceView} from './finance-workspace';
import './import-workspace.css';

type RowKind = 'invoice'|'receipt'|'credit'|'obligation'|'bank'|'charge'|'refund'|'fee';
type ImportRow = {id:string;kind:RowKind;sourceId:string;number?:string;counterparty?:string;date?:string;dueDate?:string;amountCents:number;reference?:string;description?:string};
type ImportSource = {id:string;filename:string;mime:string;sha256:string;text:string};
type Preview = {rows:ImportRow[];sources:ImportSource[];issues:unknown[]};
type Props = {api:(path:string,body?:unknown)=>Promise<any>;run:(fn:()=>Promise<unknown>)=>Promise<void>;busy:boolean;view?:WorkspaceView;onImported:(view:WorkspaceView)=>void};
const kinds:{value:RowKind;label:string}[]=[{value:'invoice',label:'Customer invoice'},{value:'receipt',label:'Customer payment'},{value:'credit',label:'Customer credit'},{value:'obligation',label:'Bill / expense due'},{value:'bank',label:'Bank deposit'},{value:'charge',label:'Processor sale'},{value:'refund',label:'Processor refund'},{value:'fee',label:'Processor fee'}];
const accepted=/\.(csv|tsv|txt|json|xlsx|xls|pdf|docx|png|jpe?g|webp)$/i;
function dollars(cents:number){return Number.isFinite(cents)?(cents/100).toFixed(2):'';}
function cents(value:string){if(!/^-?\d+(?:\.\d{1,2})?$/.test(value.trim()))return undefined;const amount=Math.round(Number(value)*100);return Number.isSafeInteger(amount)?amount:undefined;}
function validDate(value?:string){return !!value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function issueText(issue:unknown){if(typeof issue==='string')return issue;if(issue&&typeof issue==='object'){const item=issue as Record<string,unknown>;const message=String(item.message??item.reason??item.error??'Please check this source before importing.');return item.filename?`${item.filename}: ${message}`:message;}return 'Please check this source before importing.';}

export function ImportWorkspace({api,run,busy,view,onImported}:Props){
 const router=useRouter();
 const picker=useRef<HTMLInputElement>(null);
 const [preview,setPreview]=useState<Preview>();
 const [fileMessage,setFileMessage]=useState('');
 const [businessName,setBusinessName]=useState(view?.case.business.displayName??'');
 const [openingCash,setOpeningCash]=useState(view?dollars(view.case.business.openingCashCents):'');
 const [startDate,setStartDate]=useState(view?.case.business.startDate??new Date().toISOString().slice(0,10));
 const [mode,setMode]=useState<'replace'|'append'>('replace');
 const [acknowledged,setAcknowledged]=useState(false);
 const [dragging,setDragging]=useState(false);
 const [amountEdits,setAmountEdits]=useState<Record<string,string>>({});
 const [workingStep,setWorkingStep]=useState<'preview'|'commit'>();
 const rows=preview?.rows??[];
 const sources=preview?.sources??[];
 const existingNumbers=useMemo(()=>new Set(mode==='append'?(view?.case.invoices??[]).map(invoice=>invoice.number):[]),[view,mode]);
 const invoiceNumbers=new Set([...existingNumbers,...rows.filter(row=>row.kind==='invoice').map(row=>row.number?.trim()).filter(Boolean)]);
 const rowErrors=rows.map(row=>{
  const errors:string[]=[];
  const amount=amountEdits[row.id]!==undefined?cents(amountEdits[row.id]):row.amountCents;
  if(!Number.isSafeInteger(amount)||amount===undefined||amount<=0)errors.push('Enter a positive amount with up to two decimal places.');
  if(!validDate(row.date))errors.push('Choose a transaction date.');
  if(row.kind==='invoice'){
   if(!row.number?.trim())errors.push('Add the invoice number.');
   if(!row.counterparty?.trim())errors.push('Add the customer name.');
   if(!validDate(row.dueDate))errors.push('Choose the invoice due date.');
   if(row.number&&rows.filter(other=>other.kind==='invoice'&&other.number?.trim()===row.number?.trim()).length>1)errors.push('Use each invoice number once.');
  }
  if(['receipt','credit'].includes(row.kind)&&(!row.reference?.trim()||!invoiceNumbers.has(row.reference.trim())))errors.push('Match the reference to an invoice number in this import or workspace.');
  if(['bank','charge','refund','fee'].includes(row.kind)&&!row.reference?.trim())errors.push('Add the payout reference shared by related transactions.');
  if(row.kind==='obligation'&&!row.description?.trim())errors.push('Describe this bill or expense.');
  return errors;
 });
 const invalidRows=rowErrors.some(errors=>errors.length>0);
 const openingCents=cents(openingCash);
 const canCommit=!!preview&&rows.length>0&&!invalidRows&&!!businessName.trim()&&openingCents!==undefined&&openingCents>=0&&validDate(startDate)&&(!view||mode==='append'||acknowledged)&&!busy;
 const sourceName=(id:string)=>sources.find(source=>source.id===id)?.filename??'Uploaded source';
 const update=(id:string,patch:Partial<ImportRow>)=>setPreview(current=>current?{...current,rows:current.rows.map(row=>row.id===id?{...row,...patch}:row)}:current);
 const remove=(id:string)=>setPreview(current=>current?{...current,rows:current.rows.filter(row=>row.id!==id)}:current);
 async function convert(files:File[]){
  setFileMessage('');
  if(!files.length)return;
  if(files.length>10){setFileMessage('Choose up to 10 files at a time.');return;}
  const unsupported=files.find(file=>!accepted.test(file.name));
  if(unsupported){setFileMessage(`${unsupported.name}: choose a CSV, spreadsheet, PDF, Word document, photo, JSON or text file.`);return;}
  if(files.some(file=>file.size>2*1024*1024)){setFileMessage('Each file needs to be 2 MB or smaller.');return;}
  if(files.reduce((sum,file)=>sum+file.size,0)>3*1024*1024){setFileMessage('Choose files totaling 3 MB or less.');return;}
  await run(async()=>{
   setWorkingStep('preview');
   try{
    const body=new FormData();files.forEach(file=>body.append('files',file));
    const result=await api('imports/preview',body);
    if(!Array.isArray(result?.rows)||!Array.isArray(result?.sources))throw Error('We could not read these files. Try a CSV or text-based document.');
    setPreview({rows:result.rows,sources:result.sources,issues:Array.isArray(result.issues)?result.issues:[]});
    setAmountEdits({});setAcknowledged(false);
   }finally{setWorkingStep(undefined);}
  });
 }
 async function sample(){
  await run(async()=>{
   setWorkingStep('preview');setFileMessage('');
   try{
    const names=['receivables.csv','receipts.csv','bills.csv'];
    const files=await Promise.all(names.map(async name=>{const response=await fetch('/examples/import-ready/'+name);if(!response.ok)throw Error('The sample files could not be loaded. Download a template and upload it instead.');return new File([await response.blob()],name,{type:'text/csv'});}));
    const body=new FormData();files.forEach(file=>body.append('files',file));
    const result=await api('imports/preview',body);
    if(!Array.isArray(result?.rows)||!Array.isArray(result?.sources))throw Error('We could not read the sample files.');
    setPreview({rows:result.rows,sources:result.sources,issues:Array.isArray(result.issues)?result.issues:[]});setAmountEdits({});setAcknowledged(false);
    if(!businessName.trim())setBusinessName('My sample business');
    if(!openingCash.trim())setOpeningCash('12000.00');
   }finally{setWorkingStep(undefined);}
  });
 }
 async function commit(){
  if(!canCommit)return;
  await run(async()=>{
   setWorkingStep('commit');
   try{
    const normalized=rows.map(row=>({...row,number:row.number??'',counterparty:row.counterparty??'',date:row.date??'',dueDate:row.dueDate??'',reference:row.reference??'',description:row.description??'',amountCents:amountEdits[row.id]!==undefined?cents(amountEdits[row.id]):row.amountCents}));
    const result=await api('imports/commit',{rows:normalized,sources,businessName:businessName.trim(),openingCashCents:openingCents,startDate,mode,expectedRevision:view?.case.revision});
    onImported(result);router.push('/workbench');
   }finally{setWorkingStep(undefined);}
  });
 }
 return <div className="import-workspace">
  <div className="import-intro"><p>Bring your customer invoices, payments, credits, bills and settlement records together. We convert common exports into reviewable rows before adding them to your books.</p><ol className="import-steps" aria-label="Import steps"><li className="active"><b>1</b> Upload your files</li><li className={preview?'active':''}><b>2</b> Check the conversion</li><li><b>3</b> Open your workspace</li></ol></div>
  <section className="import-card" aria-labelledby="upload-files-heading"><div className="import-section-heading"><div><div className="eyebrow">STEP 1</div><h2 id="upload-files-heading">Upload your business records</h2></div><span className="import-meta">USD records</span></div>
   <div className={'import-dropzone'+(dragging?' dragging':'')} onDragOver={event=>{event.preventDefault();if(!busy)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);if(!busy)void convert(Array.from(event.dataTransfer.files));}}>
    <span className="import-upload-icon" aria-hidden="true">↥</span><h3>Drop a set of files here</h3><p>CSV, TSV, Excel, PDF, Word, photos, JSON or text.<br/>Up to 10 files · 2 MB each · 3 MB total.</p>
    <button className="primary" disabled={busy} onClick={()=>picker.current?.click()}>{busy&&workingStep==='preview'?'Converting your files…':'Choose files to convert'}</button><input ref={picker} type="file" multiple accept=".csv,.tsv,.txt,.json,.xlsx,.xls,.pdf,.docx,.png,.jpg,.jpeg,.webp" aria-label="Upload business records" hidden disabled={busy} onChange={event=>{const files=Array.from(event.target.files??[]);event.currentTarget.value='';void convert(files);}}/>
   </div>
   <p className="import-help">Upload invoices or an accounts-receivable export to establish what customers owe. Add payment receipts and credit notes to explain reductions. Scans and photos use AI extraction when available. Check the preview; every converted row stays editable.</p>
   {fileMessage&&<p className="import-message" role="alert">{fileMessage}</p>}
   <div className="import-template-row"><button disabled={busy} onClick={()=>void sample()}>Try sample business files</button><span>Or download a starting point:</span><a href="/examples/import-ready/receivables.csv" download>Receivables CSV ↓</a><a href="/examples/import-ready/receipts.csv" download>Payments CSV ↓</a><a href="/examples/import-ready/bills.csv" download>Bills CSV ↓</a></div>
  </section>
  {preview&&<>
   <section className="import-card" aria-labelledby="review-conversion-heading"><div className="import-section-heading"><div><div className="eyebrow">STEP 2</div><h2 id="review-conversion-heading">Check the converted records</h2><p>{rows.length} {rows.length===1?'record':'records'} from {sources.length} {sources.length===1?'file':'files'}. Confirm amounts, dates and invoice references before importing.</p></div><span className="import-meta">Nothing imported yet</span></div>
    {!!preview.issues.length&&<div className="import-source-issues" role="status"><b>Files that need attention</b><ul>{preview.issues.map((issue,index)=><li key={index}>{issueText(issue)}</li>)}</ul></div>}
    <div className="import-sources">{sources.map(source=><details key={source.id}><summary>{source.filename}<span>{rows.filter(row=>row.sourceId===source.id).length} records</span></summary><pre>{source.text?.trim()||'No readable text was found. Check the conversion below, or add a record manually using this file as its source.'}</pre></details>)}</div>
    {!rows.length?<p className="import-empty">No financial records were detected. You can add a record below, use a clearer document, or try a template above.</p>:<div className="import-records">{rows.map((row,index)=><article className={'import-record'+(rowErrors[index].length?' needs-attention':'')} key={row.id} aria-label={'Converted record '+(index+1)}><div className="import-record-heading"><b>Record {index+1}</b><span title={sourceName(row.sourceId)}>{sourceName(row.sourceId)}</span><button disabled={busy} onClick={()=>remove(row.id)} aria-label={'Remove record '+(index+1)}>Remove</button></div><div className="import-fields">
      <label>Source file<select aria-label={'Record '+(index+1)+' source'} value={row.sourceId} disabled={busy} onChange={event=>update(row.id,{sourceId:event.target.value})}>{sources.map(source=><option key={source.id} value={source.id}>{source.filename}</option>)}</select></label>
      <label>Record type<select aria-label={'Record '+(index+1)+' type'} value={row.kind} disabled={busy} onChange={event=>update(row.id,{kind:event.target.value as RowKind})}>{kinds.map(kind=><option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
      <label>Amount (USD)<input aria-label={'Record '+(index+1)+' amount'} inputMode="decimal" value={amountEdits[row.id]??dollars(row.amountCents)} disabled={busy} placeholder="0.00" onChange={event=>setAmountEdits(current=>({...current,[row.id]:event.target.value}))}/></label>
      <label>{row.kind==='obligation'?'Payment due date':'Transaction date'}<input aria-label={'Record '+(index+1)+' date'} type="date" value={(row.kind==='obligation'?row.dueDate||row.date:row.date)??''} disabled={busy} onChange={event=>update(row.id,row.kind==='obligation'?{date:event.target.value,dueDate:event.target.value}:{date:event.target.value})}/></label>
      {row.kind==='invoice'&&<><label>Invoice number<input value={row.number??''} disabled={busy} maxLength={120} onChange={event=>update(row.id,{number:event.target.value})}/></label><label>Customer name<input value={row.counterparty??''} disabled={busy} maxLength={100} onChange={event=>update(row.id,{counterparty:event.target.value})}/></label><label>Invoice due date<input type="date" value={row.dueDate??''} disabled={busy} onChange={event=>update(row.id,{dueDate:event.target.value})}/></label></>}
      {['receipt','credit'].includes(row.kind)&&<label>Invoice number this applies to<input value={row.reference??''} list="import-invoice-numbers" disabled={busy} placeholder="e.g. INV-101" maxLength={120} onChange={event=>update(row.id,{reference:event.target.value})}/></label>}
      {['bank','charge','refund','fee'].includes(row.kind)&&<label>Payout / settlement reference<input value={row.reference??''} disabled={busy} placeholder="Same reference for related rows" maxLength={180} onChange={event=>update(row.id,{reference:event.target.value})}/></label>}
      <label className="import-description">{row.kind==='obligation'?'Bill / expense description':'Description (optional)'}<input value={row.description??''} disabled={busy} maxLength={500} onChange={event=>update(row.id,{description:event.target.value})}/></label>
     </div>{!!rowErrors[index].length&&<ul className="import-row-errors">{rowErrors[index].map(message=><li key={message}>{message}</li>)}</ul>}</article>)}</div>}
    {sources.length>0&&<button className="import-add-row" disabled={busy||rows.length>=100} onClick={()=>setPreview(current=>current?{...current,rows:[...current.rows,{id:"manual_"+crypto.randomUUID(),kind:"invoice",sourceId:current.sources[0].id,number:"",counterparty:"",date:startDate,dueDate:startDate,amountCents:0,reference:"",description:""}]}:current)}>Add a record manually</button>}
    <datalist id="import-invoice-numbers">{[...invoiceNumbers].map(number=><option key={number} value={number}/>)}</datalist>
   </section>
   <section className="import-card" aria-labelledby="open-workspace-heading"><div className="import-section-heading"><div><div className="eyebrow">STEP 3</div><h2 id="open-workspace-heading">Set up your books</h2><p>Opening cash is your bank balance at the start of the forecast. Invoices and bills above supply expected money in and out.</p></div></div>
    <div className="import-fields import-business-fields"><label>Business name<input aria-label="Business name" maxLength={100} value={businessName} disabled={busy} placeholder="Your business name" onChange={event=>setBusinessName(event.target.value)}/></label><label>Opening cash balance (USD)<input aria-label="Opening cash balance (USD)" inputMode="decimal" value={openingCash} disabled={busy||mode==='append'} placeholder="e.g. 12000.00" onChange={event=>setOpeningCash(event.target.value)}/></label><label>Forecast start date<input aria-label="Forecast start date" type="date" value={startDate} disabled={busy||mode==='append'} onChange={event=>setStartDate(event.target.value)}/></label></div>
    {view&&<div className="import-mode"><label><input type="radio" name="import-mode" checked={mode==='replace'} disabled={busy} onChange={()=>{setMode('replace');setAcknowledged(false);}}/><span><b>Start with these records</b><small>Replace the current workspace’s sample or imported records.</small></span></label><label><input type="radio" name="import-mode" checked={mode==='append'} disabled={busy} onChange={()=>{setMode('append');if(view){setOpeningCash(dollars(view.case.business.openingCashCents));setStartDate(view.case.business.startDate);}}}/><span><b>Add to this workspace</b><small>Keep existing invoices and records, then add these rows.</small></span></label></div>}
    {view&&mode==='replace'&&<label className="import-acknowledgment"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event=>setAcknowledged(event.target.checked)}/><span>I understand these records will replace the current workspace.</span></label>}
    <div className="import-commit"><button className="primary large" disabled={!canCommit} onClick={()=>void commit()}>{busy&&workingStep==='commit'?'Importing your records…':'Import records and open workbench'} <span aria-hidden="true">↗</span></button><p>{invalidRows?'Complete the highlighted records above to continue.':!businessName.trim()||openingCents===undefined||openingCents<0||!validDate(startDate)?'Enter your business name, opening cash balance and forecast start date.':view&&mode==='replace'&&!acknowledged?'Confirm replacement above to continue.':'Invoices establish reviewed opening receivable balances. Imported payments and credits await investigation and approval; do not include payments already deducted from an outstanding balance.'}</p></div>
   </section>
  </>}
 </div>;
}
