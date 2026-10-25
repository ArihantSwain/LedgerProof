import {z} from 'zod';
import {CdpX402Client} from '@coinbase/cdp-sdk/x402';
import {CdpClient} from '@coinbase/cdp-sdk';
import {wrapFetchWithPayment} from '@x402/fetch';
import {decodePaymentRequiredHeader,decodePaymentResponseHeader} from '@x402/core/http';
import {createPublicClient,http,parseEventLogs} from 'viem';
import {base} from 'viem/chains';
import {ResearchCharge} from '../contracts/evidence';
import {Case} from '../contracts';
import {researchMerchants,researchRequest,evidenceNeed} from '../evidence';
import {readCase,applyCommand,Access} from '../store';
import {acquireJob,finishJob,finishEvidenceJob,jobKey,serviceHistory} from './jobs';
import {coinbaseConfigured} from './coinbase';
import {verifyManagedEvidenceWallet} from './cdp-mcp';
export const EXA_URL='https://api.exa.ai/search';
export const EXA_PAY_TO='0x6d6E695b09861467c7d462f5AAF31cF3540B9192';
export const BASE_USDC='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const EVIDENCE_NETWORK='eip155:8453';
const quoteSchema=z.object({scheme:z.literal('exact'),network:z.literal(EVIDENCE_NETWORK),amount:z.string().regex(/^\d+$/),payTo:z.string(),asset:z.string(),maxTimeoutSeconds:z.number().int().positive().max(120)});
export function paidEvidenceConfigured(){return coinbaseConfigured()&&process.env.LEDGERPROOF_X402_EVIDENCE_ENABLED==='true';}
export function selectExaQuote(raw:unknown){
 const required=z.object({x402Version:z.literal(2),resource:z.object({url:z.literal(EXA_URL)}),accepts:z.array(z.unknown()).max(20)}).parse(raw);
 for(const option of required.accepts){const parsed=quoteSchema.safeParse(option);if(!parsed.success)continue;const q=parsed.data;const amount=Number(q.amount);
  if(q.asset.toLowerCase()===BASE_USDC.toLowerCase()&&q.payTo.toLowerCase()===EXA_PAY_TO.toLowerCase()&&Number.isSafeInteger(amount)&&amount>0&&amount<=10000)return {...q,amountAtomic:amount};
 }throw Error('Exa offers no approved exact Base-USDC quote within 0.01 USDC. No payment authorized.');
}
export async function probeExa(charge:ResearchCharge){
 if(process.env.LEDGERPROOF_OFFLINE_REHEARSAL==='true')throw Error('Provider requests are disabled in offline rehearsal');
 if(!evidenceNeed(charge).needsPurchase)throw Error('Local evidence is available; review it before buying context');
 const request=researchRequest(charge);const response=await fetch(EXA_URL,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
 if(response.status!==402)throw Error('Exa did not return an x402 quote; no payment attempted');
 const header=response.headers.get('PAYMENT-REQUIRED');if(!header||header.length>40000)throw Error('Missing or oversized x402 payment requirements');
 const terms=selectExaQuote(decodePaymentRequiredHeader(header));
 const fingerprint=jobKey('exa-quote',charge.id,{charge,request,terms});
 return {provider:'Exa',status:'LIVE_QUOTE_VERIFIED',fingerprint,chargeId:charge.id,terms,request,createdAt:Date.now(),expiresAt:Date.now()+300000,disclosure:'Unpaid live x402 quote. Searches disclose only a public vendor name and official domain. Public documentation is context, not proof of this bank charge or a replacement for its receipt.'};
}
const sourceSchema=z.object({title:z.string().min(1).max(500),url:z.string().url().max(2000),text:z.string().max(20000)});
export function validateExaDelivery(raw:unknown,charge:ResearchCharge,key:string){
 const data=z.object({results:z.array(sourceSchema).min(1).max(10),requestId:z.string().max(200).optional()}).parse(raw);const domain=researchMerchants[charge.merchantId].domain;
 const sources=data.results.slice(0,3).map((r,i)=>{
  const url=new URL(r.url);if(url.protocol!=='https:'||url.username||url.password||!(url.hostname===domain||url.hostname.endsWith('.'+domain)))throw Error('Exa delivered a source outside the approved vendor domain');
  if(!r.text.trim())throw Error('Exa delivered an empty source');
  return {id:`exa_${key.slice(0,12)}_${i}`,title:r.title,url:r.url,text:r.text.slice(0,4000),provider:'Exa',retrievedAt:Date.now()};
 });return {sources,requestId:data.requestId??null};
}
const transferAbi=[{type:'event',name:'Transfer',inputs:[{indexed:true,name:'from',type:'address'},{indexed:true,name:'to',type:'address'},{indexed:false,name:'value',type:'uint256'}]}] as const;
const balanceAbi=[{type:'function',name:'balanceOf',stateMutability:'view',inputs:[{name:'account',type:'address'}],outputs:[{name:'balance',type:'uint256'}]}] as const;
export async function prepareEvidenceWallet(){
 if(!coinbaseConfigured())throw Error('Add CDP_API_KEY_ID, CDP_API_KEY_SECRET and CDP_WALLET_SECRET first');
 const account=await new CdpClient().evm.getOrCreateAccount({name:'ledgerproof-evidence-buyer'});
 const agentTooling=await verifyManagedEvidenceWallet(account.address);
 const rpc=createPublicClient({chain:base,transport:http('https://mainnet.base.org',{retryCount:0,timeout:15000})});
 const balance=await rpc.readContract({address:BASE_USDC,abi:balanceAbi,functionName:'balanceOf',args:[account.address]});
 return {address:account.address,network:EVIDENCE_NETWORK,asset:BASE_USDC,balanceAtomic:balance.toString(),agentTooling,suggestedFunding:'0.10 USDC on Base mainnet',disclosure:'Public receiving address only. No transfer or signing performed.'};
}
export function verifyTransfer(logs:Parameters<typeof parseEventLogs>[0]['logs'],buyer:string,approvedAmount:number){
 const matches=parseEventLogs({abi:transferAbi,eventName:'Transfer',logs,strict:true}).filter(log=>log.address.toLowerCase()===BASE_USDC.toLowerCase()&&log.args.from.toLowerCase()===buyer.toLowerCase()&&log.args.to.toLowerCase()===EXA_PAY_TO.toLowerCase());
 if(matches.length!==1)throw Error('Chain receipt does not uniquely prove payment from the buyer to Exa');
 const amount=Number(matches[0].args.value);if(!Number.isSafeInteger(amount)||amount<=0||amount>approvedAmount)throw Error('On-chain expense exceeds owner authorization');
 return {amountAtomic:amount,logIndex:matches[0].logIndex};
}
async function chainProof(transaction:string,buyer:string,approvedAmount:number){
 if(!/^0x[a-fA-F0-9]{64}$/.test(transaction))throw Error('Missing settlement transaction');
 const client=createPublicClient({chain:base,transport:http('https://mainnet.base.org',{retryCount:0,timeout:15000})});
 const receipt=await client.getTransactionReceipt({hash:transaction as `0x${string}`});if(receipt.status!=='success')throw Error('On-chain settlement failed');
 return verifyTransfer(receipt.logs,buyer,approvedAmount);
}
export async function buyEvidence(a:Access,c:Case,chargeId:string,quoteFingerprint:string,reason:string){
 if(!paidEvidenceConfigured())throw Error('Configure CDP credentials and LEDGERPROOF_X402_EVIDENCE_ENABLED=true for bounded real evidence purchases. Buyer needs USDC on Base.');
 const charge=c.evidencePurchases.charges.find(x=>x.id===chargeId);if(!charge)throw Error('Unknown investigation charge');
 const request=researchRequest(charge);const key=jobKey('x402_evidence',c.id,{generation:c.generation,request});
 const history=await serviceHistory(c.id);const prior=history.jobs.find((j:{key:string})=>j.key===key);if(prior)return {...prior,cached:true};
 const quote=await probeExa(charge);if(quote.fingerprint!==quoteFingerprint)throw Error('Source or live quote changed. Review a fresh quote before authorizing.');
 const wallet=await prepareEvidenceWallet();if(BigInt(wallet.balanceAtomic)<BigInt(quote.terms.amountAtomic))throw Error(`Evidence wallet is unfunded. Fund ${wallet.address} with USDC on Base; no purchase was reserved or signed.`);
 // Durable approval precedes signing. The same native-unit cap also runs inside
 // the SDK and in the deployment-wide Convex reservation transaction.
 c=await applyCommand(a,{type:'evidence_authorize',id:quote.fingerprint,chargeId,amountAtomic:quote.terms.amountAtomic,expiresAt:quote.expiresAt,reason,expectedEvidenceVersion:c.evidencePurchases.version,requestKey:quote.fingerprint});
 const claim=await acquireJob('x402_evidence',c.id,key,10000);if(!claim.owner)return {...claim.job,cached:true};
 let pending:Record<string,unknown>={generation:c.generation,charge,quote,sourceVersion:c.evidencePurchases.version,authorizationId:quote.fingerprint,buyerAddress:wallet.address,agentTooling:wallet.agentTooling};
 try{
  const buyer=new CdpX402Client({environment:'production',walletConfig:{type:'eoa',accountName:'ledgerproof-evidence-buyer'},networkSchemes:[{network:'base',scheme:{exact:true,upto:false,authCapture:false,batchSettlement:false}}],spendControls:{allowedNetworks:[EVIDENCE_NETWORK],allowedAssets:[BASE_USDC],allowedPayees:[EXA_PAY_TO],maxAmountPerPayment:{atomic:String(quote.terms.amountAtomic),asset:BASE_USDC},maxCumulativeSpend:{atomic:String(quote.terms.amountAtomic),asset:BASE_USDC}}});
  const {evmAddress}=await buyer.getAddresses();if(evmAddress?.toLowerCase()!==wallet.address.toLowerCase())throw Error('Payment signer does not match the funded evidence wallet');
  const safeFetch:typeof fetch=async(input,init)=>{
   if(String(input)!==EXA_URL||init?.method!=='POST')throw Error('Unapproved paid evidence destination or method');
   const current=await readCase(a);if(current.generation!==c.generation||current.evidencePurchases.version!==c.evidencePurchases.version||Date.now()>quote.expiresAt)throw Error('Evidence authorization is stale; no payment request dispatched');
   return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(45000)});
  };
  const response=await wrapFetchWithPayment(safeFetch,buyer)(EXA_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(quote.request)});
  const paymentHeader=response.headers.get('PAYMENT-RESPONSE');if(!paymentHeader)throw Error('Paid response has no settlement receipt; reconcile before another purchase');
  const receipt=decodePaymentResponseHeader(paymentHeader);if(!receipt.success||receipt.network!==EVIDENCE_NETWORK||receipt.payer?.toLowerCase()!==evmAddress?.toLowerCase())throw Error('Exa settlement receipt failed buyer/network validation');
  pending={...pending,receipt};
  const text=await response.text();if(text.length>100000)throw Error('Evidence response exceeds storage bound');
  const delivery=response.ok?validateExaDelivery(JSON.parse(text),charge,key):null;pending={...pending,delivery,httpStatus:response.status};
  const proof=await chainProof(receipt.transaction,evmAddress!,quote.terms.amountAtomic);
  return await finishEvidenceJob({key,transaction:receipt.transaction,receiptKey:`${EVIDENCE_NETWORK}:${receipt.transaction}:${proof.logIndex}`,amountAtomic:proof.amountAtomic,delivered:!!delivery,result:{...pending,sources:delivery?.sources??[],chainVerified:true,settledAt:Date.now(),disclosure:'Real Exa evidence purchased via x402. Public vendor documentation guides human review; it does not substantiate a particular charge, approve payment, or change the agency ledger.'}});
 }catch(error){return await finishJob(key,'unknown',{result:{...pending,chainVerified:false},error:error instanceof Error?error.message:'Evidence purchase outcome unknown. Reservation retained; no automatic repurchase.'});}
}
export async function reconcileEvidence(a:Access,key:string){
 const history=await serviceHistory(a.caseId),job=history.jobs.find((j:{key:string;provider:string})=>j.key===key&&j.provider==='x402_evidence');
 if(!job)throw Error('Evidence purchase unavailable');if(job.state==='completed'||job.state==='failed')return job;
 const pending=job.result as Record<string,any>|null;if(!pending?.receipt?.transaction||!pending?.buyerAddress)throw Error('No saved payment receipt. Reconcile against wallet history; never repurchase blindly.');
 const proof=await chainProof(pending.receipt.transaction,pending.buyerAddress,pending.quote.terms.amountAtomic);
 return finishEvidenceJob({key,transaction:pending.receipt.transaction,receiptKey:`${EVIDENCE_NETWORK}:${pending.receipt.transaction}:${proof.logIndex}`,amountAtomic:proof.amountAtomic,delivered:!!pending.delivery,result:{...pending,sources:pending.delivery?.sources??[],chainVerified:true,settledAt:Date.now()}});
}
