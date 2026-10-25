import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {judgeSamples,fixtureTime} from '../fixtures/judge-scenarios';

const root='SAMPLES';
const ascii=(s:string)=>s.replace(/[^\x20-\x7e\n]/g,'-');
async function pdf(title:string,content:string,pages?:number){
 const doc=await PDFDocument.create();doc.setTitle(title);doc.setAuthor('LedgerProof sample data');doc.setSubject('Fictional example; not a real invoice, payment, provider report or financial statement');doc.setProducer('LedgerProof samples');doc.setCreator('LedgerProof samples');doc.setCreationDate(new Date(fixtureTime));doc.setModificationDate(new Date(fixtureTime));
 const normal=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),mono=await doc.embedFont(StandardFonts.Courier);
 const lines=ascii(content).split('\n').flatMap(line=>line.match(/.{1,88}/g)??['']);
 const count=Math.max(pages??1,Math.ceil(lines.length/34));
 for(let n=0;n<count;n++){
  const p=doc.addPage([612,792]);p.drawRectangle({x:0,y:0,width:612,height:792,color:rgb(1,1,1)});p.drawRectangle({x:0,y:742,width:612,height:50,color:rgb(.16,.35,.28)});
  p.drawText('LEDGERPROOF / CEDAR & CO.',{x:42,y:761,size:12,font:bold,color:rgb(1,1,1)});
  p.drawText('FICTIONAL SAMPLE - NO REAL BUSINESS OR PERSONAL DATA',{x:42,y:716,size:8,font:bold,color:rgb(.45,.48,.43)});
  p.drawText(ascii(title).slice(0,73),{x:42,y:684,size:14,font:bold,color:rgb(.16,.25,.2)});
  const body=lines.slice(n*34,(n+1)*34);if(body.length)p.drawText(body.join('\n'),{x:42,y:650,size:10,font:mono,lineHeight:16});
  p.drawLine({start:{x:42,y:55},end:{x:570,y:55},color:rgb(.83,.86,.82)});
  p.drawText(`Fictional source record | Page ${n+1}/${count} | Sample data for testing`,{x:42,y:38,size:8,font:normal,color:rgb(.45,.48,.43)});
 }
 return doc.save();
}
await mkdir(root,{recursive:true});
const entries=[];
for(const sample of judgeSamples){
 const file=root+'/'+sample.path;await mkdir(file.slice(0,file.lastIndexOf('/')),{recursive:true});
 const bytes=sample.path.endsWith('.pdf')?await pdf(sample.title,sample.content,sample.pages):Buffer.from(sample.content);
 await writeFile(file,bytes);entries.push({path:sample.path,title:sample.title,use:sample.use,expected:sample.expected,instructions:sample.instructions,...(sample.prerequisites?{prerequisites:sample.prerequisites}:{}),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const counts={examples:entries.length,creditUploads:entries.filter(e=>e.use==='credit-upload'&&e.expected.outcome==='review').length,receiptUploads:entries.filter(e=>e.use==='receipt-upload'&&e.expected.outcome==='review').length,settlementSets:entries.filter(e=>e.use==='settlement-import'&&e.expected.outcome==='reconcile').length,intentionalRejections:entries.filter(e=>e.expected.outcome==='reject').length,referenceOnly:entries.filter(e=>e.use==='reference-only').length};
const manifest={schemaVersion:1,synthetic:true,preparedAt:'2026-10-25',counts,defaultFixture:{business:'Cedar & Co. Creative',openingCashCents:2000000,baselineWeek2Cents:1600000,invoiceAOutstandingCents:2000000,invoice003OutstandingCents:200000},resetBetweenAlternatives:true,providerOutputsFabricated:false,entries};
await writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const csvCell=(s:unknown)=>'"'+String(s??'').replaceAll('"','""')+'"';
await writeFile(root+'/expected-results.csv',[['file','workflow','expected_outcome','amount_cents','remaining_cents','week_2_cash_cents','bank_statuses','instructions'],...entries.map(e=>[e.path,e.use,e.expected.outcome,e.expected.amountCents,e.expected.remainingCents,e.expected.week2Cents,e.expected.bankStatuses?JSON.stringify(e.expected.bankStatuses):'',e.instructions])].map(row=>row.map(csvCell).join(',')).join('\n')+'\n');
// Stable ZIP metadata makes regenerated downloads and review hashes repeatable.
const zipped=spawnSync('python3',['-c',`from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
root=Path('SAMPLES')
with ZipFile(root/'samples.zip','w',compression=ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file() and p.suffix!='.zip':
   info=ZipInfo('SAMPLES/'+p.relative_to(root).as_posix(),date_time=(2026,10,25,0,0,0))
   info.compress_type=ZIP_DEFLATED
   info.external_attr=0o100644 << 16
   z.writestr(info,p.read_bytes())
`],{encoding:'utf8'});
if(zipped.status!==0)throw Error('Could not create the example ZIP; Python 3 is required.');
const archive=await readFile(root+'/samples.zip');
console.log(JSON.stringify({...counts,archiveBytes:archive.length,archiveSha256:createHash('sha256').update(archive).digest('hex')}));
