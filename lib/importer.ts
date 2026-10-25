import {createHash} from 'node:crypto';
import {extractText,getDocumentProxy} from 'unpdf';
import * as XLSX from 'xlsx';
import {unzipSync} from 'fflate';
import type {ImportRow} from './contracts/import';

type InputFile={name:string;bytes:Uint8Array;type:string};
type Source={id:string;filename:string;mime:string;sha256:string;text:string};
type Cells=Record<string,unknown>;
const MAX_FILE=2*1024*1024,MAX_TOTAL=3*1024*1024,MAX_ROWS=200;
const key=(x:unknown)=>String(x??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases:Record<string,string[]>={
 kind:['kind','type','recordtype','transactiontype','entrytype'],
 number:['number','invoicenumber','invoiceno','invoicenum','invoiceid','invoice','documentnumber','docnumber','billnumber','billno','creditnotenumber','creditnumber'],
 counterparty:['counterparty','customer','customername','client','clientname','company','companyname','vendor','vendorname','supplier','suppliername','name','payer','payee','issuedby'],
 date:['date','invoicedate','issuedate','transactiondate','posteddate','postingdate','paymentdate','depositdate','settlementdate','creditdate'],
 dueDate:['duedate','paymentdue','expecteddate','expecteddeliverydate','expectedpaymentdate','expectedreceiptdate'],
 cents:['amountcents','balancecents','outstandingcents','remainingcents','totalcents','grosscents','netcents'],
 balance:['balance','openbalance','outstanding','amountdue','balancedue','outstandingbalance','remainingbalance','unpaidamount','openamount','remainingamount'],
 amount:['amount','total','invoicetotal','invoiceamount','totalamount','netamount','grossamount','gross','net','paymentamount','creditamount','depositamount','value'],
 currency:['currency','currencycode','ccy'],
 reference:['reference','invoicereference','invoiceappliedto','appliedinvoice','relatedinvoice','payout','payoutid','payoutreference','batch','batchid','settlementid'],
 externalId:['externalid','id','transactionid','paymentid','receiptid','recordid'],
 description:['description','memo','details','note','notes','reason','itemdescription'],
 debit:['debit','withdrawal','withdrawals','moneyout','debitamount'],
 credit:['credit','deposit','deposits','moneyin','creditamount'],
};
function lookup(row:Cells,field:string):unknown {for(const a of aliases[field]??[])if(row[a]!==undefined&&row[a]!==null&&String(row[a]).trim()!=='')return row[a];return '';}
function textValue(value:unknown,max=180){return String(value??'').trim().slice(0,max);}
function dateValue(value:unknown):string {
 if(value instanceof Date)return Number.isFinite(value.valueOf())?value.toISOString().slice(0,10):'';
 if(typeof value==='number'&&Number.isFinite(value)&&value>=1&&value<100000){const d=XLSX.SSF.parse_date_code(value);if(d)return validDate(`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`);}
 const s=String(value??'').trim();
 if(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(s))return validDate(s.slice(0,10));
 // US dates are accepted only when their order is unambiguous. 03/04/2026 needs human confirmation.
 const m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
 if(m){const month=Number(m[1]),day=Number(m[2]);if(day>12&&month<=12)return validDate(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`);return '';}
 const named=s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);if(named){const names=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];const n=names.indexOf(named[1].slice(0,3).toLowerCase());if(n>=0)return validDate(`${named[3]}-${String(n+1).padStart(2,'0')}-${named[2].padStart(2,'0')}`);}
 return '';
}
function validDate(s:string){const d=new Date(`${s}T00:00:00Z`);return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===s?s:'';}
function money(value:unknown,cents=false):number {
 let s=String(value??'').trim();if(!s)return 0;
 if(/\b(?:EUR|GBP|CAD|AUD|JPY|CNY|INR)\b|[€£¥₹]/i.test(s))return 0;
 s=s.replace(/\bUSD\b/ig,'').replace(/[$\s]/g,'');if(/^\(.*\)$/.test(s))s=`-${s.slice(1,-1)}`;
 if(s.includes(',')&&!/^-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(s))return 0;
 s=s.replace(/,/g,'');
 if(!(cents?/^-?\d+$/:/^-?\d+(?:\.\d{1,2})?$/).test(s))return 0;
 const amount=Math.round(Number(s)*(cents?1:100));return Number.isSafeInteger(amount)&&Math.abs(amount)<=100_000_000_000?amount:0;
}
function inferKind(row:Cells,context:string):ImportRow['kind']|undefined {
 const raw=key(lookup(row,'kind'));const kinds:Record<string,ImportRow['kind']>={invoice:'invoice',receivable:'invoice',accountsreceivable:'invoice',bill:'obligation',obligation:'obligation',payable:'obligation',expense:'obligation',payment:'receipt',receipt:'receipt',bankreceipt:'receipt',customerpayment:'receipt',creditnote:'credit',creditmemo:'credit',credit:'credit',bank:'bank',bankdeposit:'bank',deposit:'bank',payout:'bank',charge:'charge',sale:'charge',sales:'charge',refund:'refund',fee:'fee',processingfee:'fee'};
 if(kinds[raw])return kinds[raw];
 const hint=key(context);
 if(/creditnote|creditmemo/.test(hint))return 'credit';
 if(/obligation|payable|bills|expenses|vendorbill/.test(hint))return 'obligation';
 if(/receipt|customerpayment|bankreceipt|payments/.test(hint)||('paymentid'in row)||('posteddate'in row&&Boolean(lookup(row,'number'))))return 'receipt';
 if(lookup(row,'number')||/invoice|receivable|aging|agedreceivables/.test(hint))return 'invoice';
 if(/refund/.test(hint))return 'refund';if(/processingfees|processorfees/.test(hint))return 'fee';
 if(/bankstatement|banktransactions|bankdeposit|payout/.test(hint)||lookup(row,'credit')||lookup(row,'debit'))return 'bank';
 return undefined;
}
function normalizeRow(raw:Cells,source:Source,line:string,context:string,issues:string[]):ImportRow|undefined {
 const row:Cells={};for(const [k,v] of Object.entries(raw))row[key(k)]=v;
 if(Object.values(row).every(v=>v===undefined||v===null||String(v).trim()===''))return;
 const kind=inferKind(row,context);const prefix=`${source.filename} · ${line}`;
 if(!kind){issues.push(`${prefix}: could not identify the record type. Add a Kind column (invoice, receipt, credit, obligation, bank, charge, refund or fee) and upload again.`);return;}
 const balanceCents=row.balancecents??row.outstandingcents??row.remainingcents;
 const balance=lookup(row,'balance');
 let amountRaw=balanceCents??(balance?balance:lookup(row,'cents')),isCents=balanceCents!==undefined||(!balance&&Boolean(String(amountRaw)));
 if(!isCents&&!balance)amountRaw=lookup(row,'amount')||lookup(row,'credit')||lookup(row,'debit');
 if((kind==='invoice'||kind==='obligation')&&(balance||balanceCents!==undefined))issues.push(`${prefix}: imported the current outstanding balance, not the original gross invoice total. Do not also apply historical payments already included in this balance.`);
 const currency=textValue(lookup(row,'currency')).toUpperCase();let amountCents=money(amountRaw,isCents);
 if(amountCents<0){if(kind==='credit'||kind==='refund'||kind==='fee'){amountCents=Math.abs(amountCents);issues.push(`${prefix}: normalized a negative ${kind} to its positive magnitude; its record type carries the direction.`);}else{amountCents=0;issues.push(`${prefix}: a negative amount cannot be interpreted safely as a ${kind}. Confirm its accounting direction and amount manually.`);}}
 if(kind==='bank'&&lookup(row,'debit')&&!lookup(row,'credit')&&!lookup(row,'amount')&&!lookup(row,'cents')){amountCents=0;issues.push(`${prefix}: a bank withdrawal is not a settlement deposit. Classify its accounting purpose and enter a verified amount manually.`);}
 if(currency&&currency!=='USD'&&currency!=='US$'&&currency!=='$'){amountCents=0;issues.push(`${prefix}: ${currency} is not supported. Convert the amount to USD and enter the verified USD amount; no exchange rate was assumed.`);}
 if(!amountCents)issues.push(`${prefix}: confirm a positive USD amount. Missing, ambiguous or unsupported amounts were left at 0.`);
 if(!currency&&!/\$|USD/i.test(String(amountRaw))&&amountCents)issues.push(`${prefix}: no currency was supplied; confirm the draft amount is USD before importing.`);
 const date=dateValue(lookup(row,'date'));if(!date)issues.push(`${prefix}: enter a valid date. Ambiguous dates such as 03/04/2026 are left blank.`);
 const dueRaw=lookup(row,'dueDate'),dueDate=dateValue(dueRaw);if((kind==='invoice'||kind==='obligation')&&!dueDate)issues.push(`${prefix}: enter the due or expected payment date${dueRaw?' (the source date was ambiguous)':''}.`);
 let number=textValue(lookup(row,'number')||lookup(row,'externalId'),100),reference=textValue(lookup(row,'reference'),100);
 if(kind==='receipt'||kind==='credit'){reference=reference||textValue(lookup(row,'number'),100);number=textValue(lookup(row,'externalId')||lookup(row,'number'),100);if(!reference)issues.push(`${prefix}: enter the invoice number this ${kind} applies to.`);}
 if(!number)issues.push(`${prefix}: enter a unique document or transaction number.`);
 const counterparty=textValue(lookup(row,'counterparty'),100);if((kind==='invoice'||kind==='obligation')&&!counterparty)issues.push(`${prefix}: enter the customer or vendor name.`);
 if((kind==='bank'||kind==='charge'||kind==='refund'||kind==='fee')&&!reference)issues.push(`${prefix}: enter the shared payout reference to match settlement records.`);
 const description=[textValue(lookup(row,'description'),300),`Source: ${source.filename}, ${line}`].filter(Boolean).join(' · ').slice(0,500);
 const id=`row_${createHash('sha256').update(`${source.id}:${line}`).digest('hex').slice(0,20)}`;
 return {id,kind,sourceId:source.id,number,counterparty,date,dueDate,amountCents,reference,description};
}
export function parseDelimited(text:string,delimiter?:string):string[][] {
 const first=text.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0]??'';
 const sep=delimiter??(['\t',';',','].sort((a,b)=>first.split(b).length-first.split(a).length)[0]);
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell.trim()===''){quoted=!quoted;}else cell+=c;}else if(c===sep&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';if(rows.length>10000)throw Error('The table has more than 10,000 rows. Split it into smaller files.');}else cell+=c;}
 if(quoted)throw Error('A CSV quoted field is not closed. Export the CSV again.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
function tableRows(table:unknown[][],source:Source,context:string,issues:string[],label:string):ImportRow[]{
 // Processor and bookkeeping exports often have a company title before their real header.
 const known=new Set(Object.values(aliases).flat());let headerAt=-1;
 for(let i=0;i<Math.min(table.length,25);i++){const hits=table[i].filter(x=>known.has(key(x))).length;if(hits>=2){headerAt=i;break;}}
 if(headerAt<0){issues.push(`${source.filename}${label?` · ${label}`:''}: no recognizable table header. Include columns such as Invoice Number, Customer, Date, Due Date and Amount.`);return [];}
 const headers=table[headerAt].map(x=>String(x??'').trim());const out:ImportRow[]=[];
 for(let i=headerAt+1;i<table.length&&out.length<=MAX_ROWS;i++){const cells:Cells={};for(let c=0;c<headers.length;c++)if(headers[c])cells[headers[c]]=table[i][c];const row=normalizeRow(cells,source,`${label?`${label}, `:''}row ${i+1}`,context,issues);if(row)out.push(row);}
 return out;
}
function jsonRows(value:unknown,source:Source,issues:string[],context=source.filename,depth=0):ImportRow[]{
 if(depth>3)return [];
 if(Array.isArray(value)){if(value.every(x=>Array.isArray(x)))return tableRows(value as unknown[][],source,context,issues,'JSON table');return value.slice(0,MAX_ROWS+1).flatMap((x,i)=>x&&typeof x==='object'&&!Array.isArray(x)?normalizeRow(x as Cells,source,`JSON row ${i+1}`,context,issues)??[]:[]);}
 if(value&&typeof value==='object'){const entries=Object.entries(value);const groups=entries.filter(([,v])=>Array.isArray(v));if(groups.length)return groups.flatMap(([k,v])=>jsonRows(v,source,issues,k,depth+1));const nested=entries.filter(([,v])=>v&&typeof v==='object');if(nested.length)return nested.flatMap(([k,v])=>jsonRows(v,source,issues,k,depth+1));const r=normalizeRow(value as Cells,source,'JSON record',context,issues);return r?[r]:[];}
 issues.push(`${source.filename}: JSON must contain records or an array of records.`);return [];
}
function textRows(text:string,source:Source,issues:string[]):ImportRow[]{
 const lines=text.split(/\r?\n/);const first=lines.findIndex(x=>/\t|,|;|\|/.test(x)&&Object.values(aliases).flat().some(a=>key(x).includes(a)));
 if(first>=0){const sample=lines[first],separator=sample.includes('\t')?'\t':sample.includes('|')?'|':undefined;const rows=tableRows(parseDelimited(lines.slice(first).join('\n'),separator),source,source.filename,issues,'text table');if(rows.length)return rows;}
 const records:Cells[]=[];let fields:Cells={};
 for(const line of lines){const m=line.match(/^\s*([A-Za-z][A-Za-z _#/-]{0,50})\s*:\s*(.*?)\s*$/);if(!m)continue;const k=key(m[1]);if(!Object.values(aliases).some(list=>list.includes(k)))continue;if(k in fields&&(k==='type'||aliases.number.includes(k))&&Object.keys(fields).length>=3){records.push(fields);fields={};}fields[k]=m[2];}
 if(Object.keys(fields).length)records.push(fields);
 if(records.some(r=>Object.keys(r).length>=2))return records.filter(r=>Object.keys(r).length>=2).flatMap((r,i)=>normalizeRow(r,source,`document record ${i+1}`,source.filename,issues)??[]);
 // Basic printed invoice layouts use spaces rather than colon-separated labels.
 const textFields:Cells={};
 const invoice=text.match(/\b(?:invoice|bill)\s*(?:number|no\.?|#)?\s*[:#-]?\s+([A-Za-z0-9][A-Za-z0-9_/-]{1,70})/i);if(invoice&&!/^(date|total|amount|due)$/i.test(invoice[1]))textFields.invoicenumber=invoice[1];
 for(const [field,pattern] of [['date',/^\s*(?:invoice\s+date|issued?\s+date|date)\s*[:#]?\s+(.+)$/im],['duedate',/^\s*(?:due\s+date|payment\s+due)\s*[:#]?\s+(.+)$/im],['customer',/^\s*(?:bill\s+to|customer|client)\s*:?\s+(.+)$/im],['amount',/^\s*(?:amount\s+due|balance\s+due|total)\s*:?\s+((?:USD\s*)?[$€£₹]?\s*[\d,.]+(?:\s*USD)?)\s*$/im]] as const){const m=text.match(pattern);if(m)textFields[field]=m[1];}
 if(Object.keys(textFields).length>=2){const row=normalizeRow(textFields,source,'document text',source.filename,issues);return row?[row]:[];}
 issues.push(`${source.filename}: text was extracted but no reliable accounting table or labeled record was found. Use the extracted source preview to enter the rows manually, or export a CSV/XLSX table.`);return [];
}
function checkedZip(bytes:Uint8Array,docx=false){let total=0,count=0;return unzipSync(bytes,{filter:file=>{count++;if(count>3000||file.originalSize>8*1024*1024||(total+=file.originalSize)>16*1024*1024)throw Error('This archive expands beyond the safe document size. Export a smaller file.');return !docx||file.name==='word/document.xml';}});}
function xmlText(xml:string){return xml.replace(/<w:tab\b[^>]*\/>/g,'\t').replace(/<\/w:tc>/g,'\t').replace(/<\/w:tr>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<[^>]*>/g,'').replace(/&#x([0-9a-f]+);/ig,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');}

export async function convertFiles(files:InputFile[]):Promise<{rows:ImportRow[];sources:Source[];issues:string[]}>{
 if(!files.length)throw Error('Choose at least one document.');if(files.length>10)throw Error('Choose up to 10 files at a time.');if(files.reduce((n,f)=>n+f.bytes.byteLength,0)>MAX_TOTAL)throw Error('Choose files totaling 3 MB or less.');
 const rows:ImportRow[]=[],sources:Source[]=[],issues:string[]=[],seenFiles=new Set<string>(),seenRows=new Set<string>();
 for(const file of files){
  const filename=file.name.replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,160)||'document';if(file.bytes.byteLength>MAX_FILE){issues.push(`${filename}: exceeds 2 MB. Export or split the file and try again.`);continue;}
  const sha256=createHash('sha256').update(file.bytes).digest('hex');if(seenFiles.has(sha256)){issues.push(`${filename}: identical file already included; it was skipped.`);continue;}seenFiles.add(sha256);
  const source:Source={id:`src_${sha256.slice(0,24)}`,filename,mime:(file.type||'application/octet-stream').slice(0,150),sha256,text:''};sources.push(source);
  try{
   let extracted:ImportRow[]=[];const ext=filename.split('.').pop()?.toLowerCase()??'';
   if(ext==='xlsx'||ext==='xls'){
    if(ext==='xlsx')checkedZip(file.bytes);const workbook=XLSX.read(file.bytes,{type:'array',cellDates:true,sheetRows:10001});
    for(const sheetName of workbook.SheetNames.slice(0,20)){const table=XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName],{header:1,raw:true,defval:''});source.text+=`Sheet: ${sheetName}\n${table.map(row=>row.map(v=>v instanceof Date?v.toISOString().slice(0,10):String(v)).join('\t')).join('\n')}\n`;extracted.push(...tableRows(table,source,`${filename} ${sheetName}`,issues,`sheet ${sheetName}`));}
   }else if(ext==='docx'){
    const files=checkedZip(file.bytes,true),document=files['word/document.xml'];if(!document)throw Error('No readable Word document body was found.');const xml=new TextDecoder().decode(document);source.text=xmlText(xml);
    for(const [index,match] of [...xml.matchAll(/<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/g)].entries()){const table=[...match[1].matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)].map(row=>[...row[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)].map(cell=>xmlText(cell[1]).replace(/\s+/g,' ').trim()));if(table.length)extracted.push(...tableRows(table,source,filename,issues,`Word table ${index+1}`));}
    if(!extracted.length)extracted=textRows(source.text,source,issues);
   }else if(ext==='pdf'||file.type==='application/pdf'){
    if(new TextDecoder().decode(file.bytes.subarray(0,5))!=='%PDF-')throw Error('This is not a valid PDF file.');const proxy=await getDocumentProxy(file.bytes.slice());try{if(proxy.numPages>20)throw Error('PDFs must contain 20 pages or fewer. Split this PDF.');source.text=(await extractText(proxy,{mergePages:true})).text;}finally{await proxy.loadingTask.destroy();}
    if(source.text.trim().length<10)issues.push(`${filename}: this appears to be a scanned PDF. Automatic reading or manual transcription is needed; upload a text-based PDF or spreadsheet if reading is unavailable.`);else extracted=textRows(source.text,source,issues);
   }else if(['csv','tsv','txt','text','md','json','jsonl'].includes(ext)||file.type.startsWith('text/')){
    source.text=new TextDecoder('utf-8',{fatal:true}).decode(file.bytes).replace(/^\uFEFF/,'');
    if(ext==='json')extracted=jsonRows(JSON.parse(source.text),source,issues);
    else if(ext==='jsonl')extracted=jsonRows(source.text.split(/\r?\n/).filter(x=>x.trim()).map(x=>JSON.parse(x)),source,issues);
    else if(ext==='csv'||ext==='tsv')extracted=tableRows(parseDelimited(source.text,ext==='tsv'?'\t':undefined),source,filename,issues,'');
    else extracted=textRows(source.text,source,issues);
   }else if(['png','jpg','jpeg','webp'].includes(ext)){issues.push(`${filename}: an image needs automatic reading or manual transcription. No local OCR was performed.`);
   }else {issues.push(`${filename}: unsupported file type. Use CSV, TSV, XLSX, XLS, JSON, TXT, DOCX or text-based PDF. Images need transcription or OCR before uploading.`);}
   source.text=source.text.slice(0,100_000);
   for(const row of extracted){const signature=JSON.stringify([row.kind,row.number,row.counterparty,row.date,row.dueDate,row.amountCents,row.reference]);if(seenRows.has(signature)){issues.push(`${filename}: repeated ${row.kind} ${row.number||'(without a number)'} was included only once. Confirm this was a duplicate, not a separate transaction.`);continue;}seenRows.add(signature);if(rows.length<MAX_ROWS)rows.push(row);else if(!issues.includes('Only the first 200 candidate records are shown. Split larger files before importing.'))issues.push('Only the first 200 candidate records are shown. Split larger files before importing.');}
  }catch(error){issues.push(`${filename}: ${error instanceof Error?error.message:'could not read this document'}`);}
 }
 return {rows,sources,issues:[...new Set(issues)].slice(0,600)};
}
