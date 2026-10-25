import {EvidenceState,ResearchCharge,evidenceCommandSchema} from './contracts/evidence';
import {z} from 'zod';
export const researchMerchants={github:{name:'GitHub',domain:'docs.github.com'},figma:{name:'Figma',domain:'help.figma.com'},paddle:{name:'Paddle',domain:'paddle.com'}} as const;
export function evidenceNeed(charge:ResearchCharge){return charge.localEvidence.trim()?{needsPurchase:false,reason:'Local evidence is attached. Review it before buying additional context.'}:{needsPurchase:true,reason:'No local receipt or billing explanation is attached. Public vendor documentation can guide the investigation; it cannot prove this specific charge is valid.'};}
export function researchRequest(charge:ResearchCharge){const merchant=researchMerchants[charge.merchantId];return {query:`${merchant.name} official billing documentation bank statement charges invoices subscription metered usage refunds`,type:'auto',numResults:3,includeDomains:[merchant.domain],contents:{text:{maxCharacters:1500}}};}
export function applyEvidence(state:EvidenceState,raw:z.infer<typeof evidenceCommandSchema>,now:number){
 const cmd=evidenceCommandSchema.parse(raw),signature=JSON.stringify(cmd),prior=state.requests[cmd.requestKey];if(prior){if(prior!==signature)throw Error('Idempotency key reused for another evidence action');return false;}
 if(cmd.expectedEvidenceVersion!==state.version)throw Error('Evidence changed; refresh the purchase authorization');
 if(cmd.type==='evidence_add_charge'){if(state.charges.length>=30)throw Error('Investigation charge limit reached');if(state.charges.some(c=>c.id===cmd.charge.id))throw Error('Charge already imported');state.charges.push(cmd.charge);}
 else if(cmd.type==='evidence_attach_local'){const charge=state.charges.find(c=>c.id===cmd.chargeId);if(!charge)throw Error('Unknown charge');charge.localEvidence=cmd.text;}
 else{
  const charge=state.charges.find(c=>c.id===cmd.chargeId);if(!charge||!evidenceNeed(charge).needsPurchase)throw Error('Review local evidence before authorizing a paid investigation');
  if(cmd.expiresAt<=now||cmd.expiresAt>now+300_000)throw Error('Purchase authorization must expire within five minutes');
  if(state.authorizations.some(a=>a.id===cmd.id))throw Error('Purchase authorization already exists');
  if(state.authorizations.length>=30)throw Error('Authorization limit reached');
  state.authorizations.push({id:cmd.id,chargeId:cmd.chargeId,amountAtomic:cmd.amountAtomic,sourceVersion:state.version+1,expiresAt:cmd.expiresAt,reason:cmd.reason,createdAt:now});
 }
 state.requests[cmd.requestKey]=signature;state.version++;return true;
}
export function nativeExpense(amountAtomic:number,transaction:string){
 if(!Number.isSafeInteger(amountAtomic)||amountAtomic<=0||amountAtomic>10000)throw Error('Expense exceeds approved atomic USDC amount');
 if(!/^0x[a-fA-F0-9]{64}$/.test(transaction))throw Error('Expense requires a verified transaction reference');
 return {asset:'USDC',decimals:6,unit:'atomic USDC',sourceTransaction:transaction,lines:[{account:'investigation_expense',debitAtomic:amountAtomic,creditAtomic:0},{account:'agent_usdc_wallet',debitAtomic:0,creditAtomic:amountAtomic}],disclosure:'Native-asset investigation expense subledger. USD valuation and external accounting sync require separate review. No per-request cent rounding.'};
}
