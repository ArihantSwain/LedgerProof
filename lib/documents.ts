import { PDFDocument, StandardFonts } from 'pdf-lib';
import { extractText,getDocumentProxy } from 'unpdf';
import { createHash,randomUUID } from 'node:crypto';
import { Case,date,cents } from './contracts';
export const MAX_BYTES=1_000_000;
export async function documentPdf(text:string){const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const lines=text.replace(/[^\x20-\x7E\n]/g,'?').split('\n').flatMap(l=>l.match(/.{1,95}/g)??['']);for(let n=0;n<lines.length;n+=45){const page=doc.addPage([612,792]);page.drawText(lines.slice(n,n+45).join('\n'),{x:45,y:740,size:11,font,lineHeight:15});}return doc.save();}
export async function parseUpload(bytes:Uint8Array,filename:string,mime:string,c:Case){
 if(bytes.length>MAX_BYTES||!bytes.length)throw Error('Upload must be between 1 byte and 1 MB');let text='';
 const pdf=filename.toLowerCase().endsWith('.pdf');const csv=filename.toLowerCase().endsWith('.csv');
 if(pdf){if(Buffer.from(bytes.subarray(0,5)).toString()!=='%PDF-')throw Error('Invalid PDF signature');const proxy=await getDocumentProxy(bytes.slice());try{if(proxy.numPages>5)throw Error('Maximum 5 PDF pages');const out=await extractText(proxy,{mergePages:true});text=out.text;}finally{await proxy.loadingTask.destroy();}}
 else if(csv)text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);else throw Error('Supported inputs: text-based credit-note PDFs and bank CSVs. Scanned PDFs and other formats need manual review.');
 if(text.length>100_000)throw Error('Extracted text limit exceeded');
 const evidenceId=randomUUID();const document={id:evidenceId,filename:filename.replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,160),mime:pdf?'application/pdf':'text/csv',sha256:createHash('sha256').update(bytes).digest('hex'),text,uploadedAt:Date.now(),kind:pdf?'credit_note' as const:'bank' as const};
 // Anchored, deliberately narrow grammar. Free prose is preserved as evidence, never executed.
 if(pdf){const field=(key:string)=>new RegExp(`^${key}:\\s*([^\\n\\r]+)$`,'m').exec(text)?.[1].trim();if(field('Type')!=='credit_note'||field('Currency')!=='USD')throw Error('Credit PDF requires Type: credit_note and Currency: USD');const invoice=c.invoices.find(i=>i.number===field('Invoice'));if(!invoice)throw Error('Unknown invoice number');const amount=cents.positive().parse(Number(field('AmountCents')));const issued=date.parse(field('Date'));return {document,credit:{id:randomUUID(),invoiceId:invoice.id,amountCents:amount,date:issued,evidenceId,approved:false}};}
 const lines=text.trim().split(/\r?\n/);if(lines.length!==2||lines[0]!=='externalId,invoiceNumber,postedDate,amountCents')throw Error('Bank upload supports exactly one receipt and the documented CSV header');const cells=lines[1].split(',');if(cells.length!==4)throw Error('Invalid bank CSV row');const [externalId,number,postedDate,amount]=cells;const invoice=c.invoices.find(i=>i.number===number);if(!invoice)throw Error('Unknown invoice number');if(!externalId||c.receipts.some(r=>r.id===externalId))throw Error('Receipt externalId missing or already imported');return {document,receipt:{id:externalId,invoiceId:invoice.id,amountCents:cents.positive().parse(Number(amount)),date:date.parse(postedDate),evidenceId,posted:false}};
}
