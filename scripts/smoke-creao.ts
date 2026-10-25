import {createFixture} from '../fixtures/agency';
import {startInvestigation,getInvestigation,creaoConfigured} from '../lib/providers/creao';
if(!creaoConfigured())throw Error('CREAO BLOCKED: configure account-verified API family/environment first');
for(const amount of [800000,600000]){
 const c=createFixture('smoke',Date.now());c.inputVersion=2;
 c.documents.push({id:'smoke-credit-document',filename:'credit.pdf',mime:'application/pdf',sha256:'synthetic',uploadedAt:Date.now(),kind:'credit_note',text:`Type: credit_note\nInvoice: INV-A\nCurrency: USD\nAmountCents: ${amount}\nDate: 2026-10-26`});
 c.credits.push({id:'smoke-credit',invoiceId:'invoice-0',amountCents:amount,date:'2026-10-26',evidenceId:'smoke-credit-document',approved:false});
 const id=await startInvestigation(c);console.log(JSON.stringify({provider:'CREAO',runId:id,creditCents:amount}));
 let done=false;for(let i=0;i<30;i++){const r=await getInvestigation(id,c);if(r.status==='completed'){console.log(JSON.stringify({runId:id,status:r.status,model:r.model,findings:r.result?.findings,summary:r.result?.summary}));done=true;break;}if(['failed','cancelled'].includes(r.status))throw Error('Provider run failed: '+id);await new Promise(resolve=>setTimeout(resolve,2000));}
 if(!done)throw Error('Polling deadline reached. Retrieve the same run ID; do not blindly resubmit: '+id);
}
