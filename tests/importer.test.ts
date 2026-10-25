import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import * as XLSX from 'xlsx';
import {strToU8,zipSync} from 'fflate';
import {convertFiles,parseDelimited} from '../lib/importer';
const csv=(name:string,text:string)=>({name,type:'text/csv',bytes:new TextEncoder().encode(text)});

test('ordinary receivables CSV maps aliases, quoted names and outstanding balances without inventing dates',async()=>{
 const data=await convertFiles([csv('aged-receivables.csv','Invoice No,Customer Name,Invoice Date,Due Date,Invoice Total,Balance,Currency\r\nINV-1,"Cedar, Inc.",2026-10-01,2026-10-29,1500,900,USD\r\nINV-2,Small Store,03/04/2026,2026-11-12,200,200,USD')]);
 assert.equal(data.rows.length,2);assert.equal(data.rows[0].kind,'invoice');assert.equal(data.rows[0].counterparty,'Cedar, Inc.');assert.equal(data.rows[0].amountCents,90000);assert.equal(data.rows[0].number,'INV-1');assert.equal(data.rows[1].date,'');assert.match(data.rows[0].description,/row 2/);assert.ok(data.issues.some(x=>x.includes('Ambiguous dates')));
});

test('canonical settlements and payment CSV keep payout versus invoice references',async()=>{
 const result=await convertFiles([csv('processor.csv','id,kind,date,amountCents,reference\nbank_1,bank,2026-10-27,967000,payout_1\nsale_1,charge,2026-10-26,1000000,payout_1\nfee_1,fee,2026-10-27,33000,payout_1'),csv('payments.csv','Payment ID,Invoice Number,Posted Date,Amount,Currency\npay_001,INV-1,10/25/2026,"$1,234.56",USD')]);
 assert.equal(result.rows.length,4);assert.equal(result.rows[0].amountCents,967000);assert.equal(result.rows[3].kind,'receipt');assert.equal(result.rows[3].reference,'INV-1');assert.equal(result.rows[3].number,'pay_001');assert.equal(result.rows[3].amountCents,123456);assert.equal(result.rows[3].date,'2026-10-25');
});

test('foreign currency and malformed amounts remain editable and duplicate files/rows are identified',async()=>{
 const a=csv('invoices.csv','Invoice,Customer,Date,Due Date,Amount,Currency\nINV-1,A,2026-10-25,2026-11-01,300,EUR\nINV-1,A,2026-10-25,2026-11-01,300,EUR\nINV-2,B,2026-10-25,2026-11-01,1.234,USD\nINV-3,C,2026-10-25,2026-11-01,"12,34",USD');
 const result=await convertFiles([a,{...a,name:'copy.csv'}]);assert.equal(result.rows.length,3);assert.equal(result.rows[2].amountCents,0);assert.equal(result.rows[0].amountCents,0);assert.equal(result.rows[1].amountCents,0);assert.ok(result.issues.some(x=>x.includes('EUR is not supported')));assert.ok(result.issues.some(x=>x.includes('repeated invoice')));assert.ok(result.issues.some(x=>x.includes('identical file')));
});

test('XLSX supports title rows, multiple sheets and numeric Excel dates',async()=>{
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Company ledger'],['Invoice Number','Customer','Invoice Date','Due Date','Balance','Currency'],['INV-77','June Cafe',new Date('2026-10-25T00:00:00Z'),new Date('2026-11-05T00:00:00Z'),75.2,'USD']]),'Receivables');
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Bill Number','Vendor','Date','Due Date','Amount','Currency'],['B-12','Rent','2026-10-25','2026-11-01',1000,'USD']]),'Payables');
 const result=await convertFiles([{name:'book.xlsx',type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',bytes:XLSX.write(book,{type:'buffer',bookType:'xlsx'})}]);
 assert.equal(result.rows.length,2);assert.equal(result.rows[0].date,'2026-10-25');assert.equal(result.rows[0].dueDate,'2026-11-05');assert.equal(result.rows[0].amountCents,7520);assert.equal(result.rows[1].kind,'obligation');assert.match(result.rows[1].description,/sheet Payables/);
});

test('text-based PDF credit notes and DOCX labeled records preserve source evidence',async()=>{
 const pdf=await PDFDocument.create(),page=pdf.addPage(),font=await pdf.embedFont(StandardFonts.Helvetica);page.drawText('Type: credit_note\nInvoice: INV-1\nCurrency: USD\nAmountCents: 80000\nDate: 2026-10-25',{x:30,y:750,font,size:12,lineHeight:18});
 const body='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+['Type: invoice','Invoice Number: INV-2','Customer: A &amp; B','Date: 2026-10-25','Due Date: 2026-11-01','Amount: $250.00','Currency: USD'].map(x=>`<w:p><w:r><w:t>${x}</w:t></w:r></w:p>`).join('')+'</w:body></w:document>';
 const result=await convertFiles([{name:'credit.pdf',type:'application/pdf',bytes:await pdf.save()},{name:'invoice.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',bytes:zipSync({'word/document.xml':strToU8(body)})}]);
 assert.equal(result.rows.length,2);assert.equal(result.rows[0].kind,'credit');assert.equal(result.rows[0].reference,'INV-1');assert.equal(result.rows[0].amountCents,80000);assert.equal(result.rows[1].counterparty,'A & B');assert.equal(result.rows[1].amountCents,25000);assert.equal(result.sources.length,2);assert.equal(result.sources[0].sha256.length,64);
});

test('JSON groups infer kinds and scans report that transcription is needed',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage();
 const result=await convertFiles([{name:'accounting.json',type:'application/json',bytes:strToU8(JSON.stringify({invoices:[{number:'INV-9',customer:'A',date:'2026-10-25',dueDate:'2026-11-01',amount:20,currency:'USD'}],payments:[{id:'pay9',invoice:'INV-9',date:'2026-10-25',amount:5,currency:'USD'}]}))},{name:'scan.pdf',type:'application/pdf',bytes:await pdf.save()}]);
 assert.equal(result.rows.length,2);assert.equal(result.rows[1].kind,'receipt');assert.equal(result.rows[1].reference,'INV-9');assert.ok(result.issues.some(x=>x.includes('scanned PDF')));
});

test('bounded conversion returns first 200 rows, handles broken files independently, and parses quoted newlines',async()=>{
 assert.deepEqual(parseDelimited('a,b\n"line 1\nline 2","a""b"'),[['a','b'],['line 1\nline 2','a"b']]);
 const result=await convertFiles([csv('broken.csv','Invoice,Amount\n"not closed,20'),csv('invoices.csv','Invoice,Customer,Date,Due Date,Amount,Currency\n'+Array.from({length:205},(_,i)=>`INV-${i},Customer,2026-10-25,2026-11-01,10,USD`).join('\n'))]);
 assert.equal(result.rows.length,200);assert.ok(result.issues.some(x=>x.includes('quoted field')));assert.ok(result.issues.some(x=>x.includes('first 200')));await assert.rejects(convertFiles([]),/Choose at least/);
});


test('negative receivables and bank withdrawals are never silently turned into positive assets',async()=>{
 const result=await convertFiles([csv('invoices.csv','Invoice,Customer,Date,Due Date,Amount,Currency\nINV-CREDIT,A,2026-10-25,2026-11-01,-100,USD'),csv('bank-transactions.csv','ID,Date,Debit,Credit,Currency\nw1,2026-10-25,250,,USD'),csv('refunds.csv','id,kind,date,amount,reference,currency\nr1,refund,2026-10-25,-25,pay1,USD')]);
 assert.equal(result.rows[0].amountCents,0);assert.equal(result.rows[1].amountCents,0);assert.equal(result.rows[2].amountCents,2500);assert.ok(result.issues.some(x=>x.includes('withdrawal')));assert.ok(result.issues.some(x=>x.includes('negative amount')));
});
