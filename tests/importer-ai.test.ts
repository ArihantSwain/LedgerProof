import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createFixture} from '../fixtures/agency';
import {enrichImport,importCandidates,parseImportExtraction} from '../lib/providers/importer-ai';
import type {ImportRow} from '../lib/contracts/import';
import type {ProviderJob} from '../lib/providers/jobs';
const text='INVOICE INV-44\nCustomer: Local Foods LLC\nInvoice date: October 24, 2026\nDue: November 23, 2026\nTotal: USD 1,200.25';
const bytes=new TextEncoder().encode(text);
const source={id:'source-44',filename:'invoice.txt',mime:'text/plain',sha256:createHash('sha256').update(bytes).digest('hex'),text};
const files=[{name:source.filename,bytes,type:source.mime}];
const input={rows:[] as ImportRow[],sources:[source],issues:[] as string[]};
const extraction={rows:[{sourceId:source.id,kind:'invoice',number:'INV-44',counterparty:'Local Foods LLC',date:'2026-10-24',dueDate:'2026-11-23',amountCents:120025,currency:'USD',reference:'',description:'Invoice total',evidence:{number:'INVOICE INV-44',counterparty:'Customer: Local Foods LLC',date:'October 24, 2026',dueDate:'November 23, 2026',amount:'USD 1,200.25',reference:''}}],issues:[]};
const job:ProviderJob={key:'mock',provider:'anthropic',caseId:'import-test',state:'pending',reservedMicros:100000,chargedMicros:0,createdAt:0};
const c=createFixture('import-test',Date.now());
test('AI extraction retains verified source-backed fields and rejects unknown source IDs',()=>{
 const result=parseImportExtraction(extraction,[source]);assert.equal(result.rows[0].amountCents,120025);assert.equal(result.rows[0].number,'INV-44');assert.equal(result.rows[0].date,'2026-10-24');assert.equal(result.rows[0].dueDate,'2026-11-23');
 assert.throws(()=>parseImportExtraction({...extraction,rows:[{...extraction.rows[0],sourceId:'invented'}]},[source]),/Unknown/);
});
test('unsubstantiated values, wrong currency, guessed dates and amounts stay unresolved',()=>{
 const tampered=structuredClone(extraction);Object.assign(tampered.rows[0],{number:'INV-999',counterparty:'Invented customer',date:'2026-10-25',amountCents:120026});
 const row=parseImportExtraction(tampered,[source]).rows[0];assert.equal(row.number,'');assert.equal(row.counterparty,'');assert.equal(row.date,'');assert.equal(row.amountCents,0);
 assert.equal(parseImportExtraction(extraction,[{...source,text:source.text+'\nCurrency: CAD'}]).rows[0].amountCents,0);
 const unsupported=structuredClone(extraction);unsupported.rows[0].currency='other';assert.equal(parseImportExtraction(unsupported,[source]).rows[0].amountCents,0);
});
test('CSV conversion never triggers AI, and absent credentials keep a usable preview',async()=>{
 let calls=0;const output=await enrichImport(c,{...input,sources:[{...source,filename:'receivables.csv'}]},files,{configured:()=>true,request:async()=>{calls++;throw Error('Must not request');}});
 assert.equal(calls,0);assert.equal(output.rows.length,0);
 const fallback=await enrichImport(c,input,files,{configured:()=>false});assert.equal(fallback.rows.length,0);assert.match(fallback.issues.join(' '),/enter the missing fields/);
});
test('one explicit upload reserves the bounded shared budget and performs one structured Haiku request',async()=>{
 let calls=0,finishes=0;
 const output=await enrichImport(c,input,files,{configured:()=>true,acquire:async(provider,caseId,key,reserve)=>{assert.equal(provider,'anthropic');assert.equal(caseId,c.id);assert.equal(reserve,100000);return {owner:true,job:{...job,key}};},request:async(_url,init)=>{
  calls++;const body=JSON.parse(String(init?.body));assert.equal(body.model,'claude-haiku-4-5-20251001');assert.equal(body.max_tokens,2500);assert.equal(body.tool_choice.name,'return_import');assert.match(body.system,/untrusted/);assert.match(body.system,/never use today's date/);
  return Response.json({usage:{input_tokens:1000,output_tokens:100},stop_reason:'tool_use',content:[{type:'tool_use',name:'return_import',input:extraction}]});
 },finish:async(_key,state,extra)=>{finishes++;assert.equal(state,'completed');assert.equal(extra?.chargedMicros,1800);return {...job,state};}});
 assert.equal(calls,1);assert.equal(finishes,1);assert.equal(output.rows[0].counterparty,'Local Foods LLC');assert.match(output.issues.join(' '),/review before importing/);
});
test('cached extraction reuses the saved result without a new model request',async()=>{
 let calls=0;const output=await enrichImport(c,input,files,{configured:()=>true,acquire:async()=>({owner:false,job:{...job,state:'completed',result:{extraction}}}),request:async()=>{calls++;throw Error('Unexpected request');}});
 assert.equal(calls,0);assert.equal(output.rows[0].amountCents,120025);
});
test('an interrupted model call is never retried and retains the original preview',async()=>{
 let calls=0;let finalState='';const output=await enrichImport(c,input,files,{configured:()=>true,acquire:async()=>({owner:true,job}),request:async()=>{calls++;throw Error('Network interrupted');},finish:async(_key,state,extra)=>{finalState=state;assert.equal(extra?.chargedMicros,undefined);return {...job,state};}});
 assert.equal(calls,1);assert.equal(finalState,'unknown');assert.deepEqual(output.rows,input.rows);assert.match(output.issues.join(' '),/preview is still available/);
});
test('unstructured reading is capped at three sources and complete parsed rows are preserved',()=>{
 const many={...input,sources:Array.from({length:5},(_,i)=>({...source,id:'source-'+i}))};assert.equal(importCandidates(many,files).length,3);
 const full=parseImportExtraction(extraction,[source]).rows[0];assert.equal(importCandidates({...input,rows:[full]},files).length,0);
});
