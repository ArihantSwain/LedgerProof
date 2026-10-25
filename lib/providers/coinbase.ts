import {NextRequest,NextResponse} from 'next/server';
import {CdpClient} from '@coinbase/cdp-sdk';
import {createX402Server,CdpX402Client} from '@coinbase/cdp-sdk/x402';
import {withX402FromHTTPServer} from '@x402/next';
import {wrapFetchWithPayment} from '@x402/fetch';
import {decodePaymentResponseHeader} from '@x402/core/http';
import {Case} from '../contracts';
import {reconcileClose} from '../close';
import {Access,readCase} from '../store';
import {acquireJob,finishJob,jobKey} from './jobs';
const NETWORK='eip155:84532';
const USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e';
export function coinbaseConfigured(){return process.env.LEDGERPROOF_OFFLINE_REHEARSAL!=='true'&&!!(process.env.CDP_API_KEY_ID&&process.env.CDP_API_KEY_SECRET&&process.env.CDP_WALLET_SECRET);}
export function closePacket(c:Case){
 if(!c.close.records.length)throw Error('Import settlement evidence before purchasing an accounting packet');
 const packet={product:'Source-bound settlement reconciliation packet',generation:c.generation,closeVersion:c.close.version,records:c.close.records,postings:c.close.postings,reconciliation:reconcileClose(c.close),disclosure:'Synthetic accounting service delivery. Testnet funds only. This packet is deterministic; purchasing it does not invoke Claude or change agency cash.'};
 return {fingerprint:jobKey('close-packet',c.id,packet),packet};
}
let serverPromise:ReturnType<typeof createX402Server>|undefined;
async function server(){
 if(!coinbaseConfigured())throw Error('Coinbase needs CDP_API_KEY_ID, CDP_API_KEY_SECRET and CDP_WALLET_SECRET');
 serverPromise??=createX402Server({environment:'development',payToConfig:process.env.X402_PAY_TO?{type:'address',evm:process.env.X402_PAY_TO as `0x${string}`}:{type:'eoa',accountName:'ledgerproof-seller-sepolia'},routes:{'GET /api/commerce/report':{price:'$0.01',networks:[NETWORK],description:'Source-bound accounting close packet; synthetic Base Sepolia demo'}}});
 return serverPromise;
}
export async function paidCloseReport(req:NextRequest,a:Access,c:Case){
 const snapshot=closePacket(c);if(req.nextUrl.searchParams.get('fingerprint')!==snapshot.fingerprint)return NextResponse.json({error:'Source snapshot changed; request a fresh packet'},{status:409});
 const wrapped=withX402FromHTTPServer<unknown>(async()=>{
  const current=closePacket(await readCase(a));if(current.fingerprint!==snapshot.fingerprint)return NextResponse.json({error:'Evidence changed before fulfillment; settlement blocked'},{status:409});
  return NextResponse.json(current,{headers:{'Cache-Control':'no-store'}});
 },await server());
 return wrapped(req);
}
export function validateSettlementReceipt(raw:{success?:boolean;network?:string;transaction?:string},fingerprint:string,delivered:unknown){
 if(!raw.success||raw.network!==NETWORK||!/^0x[a-fA-F0-9]{64}$/.test(raw.transaction??''))throw Error('No verified testnet settlement receipt; delivery must be reconciled before retry');
 if(!delivered||typeof delivered!=='object'||!('fingerprint' in delivered)||delivered.fingerprint!==fingerprint)throw Error('Delivered packet does not match purchased source snapshot');
 return {success:true,network:NETWORK,transaction:raw.transaction!,explorerUrl:'https://sepolia.basescan.org/tx/'+raw.transaction};
}
export async function buyClosePacket(a:Access,c:Case,origin:string){
 const base=new URL(origin);const configured=new URL(process.env.APP_ORIGIN??'http://localhost:3000');
 if(base.origin!==configured.origin||!['http:','https:'].includes(base.protocol))throw Error('Purchase destination must be this application’s configured origin');
 const snapshot=closePacket(c);const key=jobKey('coinbase',c.id,{generation:c.generation,fingerprint:snapshot.fingerprint,network:NETWORK,atomic:'10000'});
 if(!coinbaseConfigured())throw Error('Coinbase credentials unavailable');
 const claim=await acquireJob('coinbase',c.id,key,10_000);if(!claim.owner)return {...claim.job,cached:true};
 try{
  const payTo=(await server()).payToEvmAddress;if(!payTo)throw Error('Seller testnet address unavailable');
  const buyer=new CdpX402Client({environment:'development',walletConfig:{type:'eoa',accountName:'ledgerproof-buyer-sepolia'},networkSchemes:[{network:'base-sepolia',scheme:{exact:true,upto:false,authCapture:false,batchSettlement:false}}],spendControls:{allowedNetworks:[NETWORK],allowedAssets:[USDC],allowedPayees:[payTo],maxAmountPerPayment:{atomic:'10000',asset:USDC},maxCumulativeSpend:{atomic:'10000',asset:USDC}}});
  const {evmAddress}=await buyer.getAddresses();
  const safeFetch:typeof fetch=async(input,init)=>{
   const url=new URL(input instanceof Request?input.url:String(input));if(url.origin!==base.origin||url.pathname!=='/api/commerce/report'||url.searchParams.get('fingerprint')!==snapshot.fingerprint)throw Error('Payment URL outside the fixed accounting service');
   return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(45_000),headers:{...Object.fromEntries(new Headers(init?.headers)),Cookie:`lp_session=${a.caseId}.${a.token}`}});
  };
  const paidFetch=wrapFetchWithPayment(safeFetch,buyer);
  const response=await paidFetch(base.origin+'/api/commerce/report?fingerprint='+snapshot.fingerprint);
  if(!response.ok)throw Error(`Accounting service HTTP ${response.status}; do not repeat a payment until its outcome is reconciled`);
  const header=response.headers.get('PAYMENT-RESPONSE');if(!header)throw Error('Service did not return a settlement receipt');
  const delivered=await response.json();const receipt=validateSettlementReceipt(decodePaymentResponseHeader(header),snapshot.fingerprint,delivered);
  return await finishJob(key,'completed',{chargedMicros:10_000,result:{receipt,delivery:delivered,buyerAddress:evmAddress,sellerAddress:payTo,testnet:true,price:'0.01 test USDC',disclosure:'Both buyer and seller are project-owned demo agents. This exercises paid service delivery; no real business revenue or agency cash is recorded.'}});
 }catch(error){return await finishJob(key,'unknown',{error:error instanceof Error?error.message:'Payment outcome unknown; do not retry blindly'});}
}
export async function fundDemoBuyer(){
 if(!coinbaseConfigured())throw Error('Coinbase credentials unavailable');
 const key=jobKey('coinbase','global-faucet',{purpose:'base-sepolia-test-USDC',account:'ledgerproof-buyer-sepolia'});const claim=await acquireJob('coinbase','global-faucet',key,0);if(!claim.owner)return {...claim.job,cached:true};
 try{const cdp=new CdpClient();const account=await cdp.evm.getOrCreateAccount({name:'ledgerproof-buyer-sepolia'});const result=await cdp.evm.requestFaucet({address:account.address,network:'base-sepolia',token:'usdc'});return await finishJob(key,'completed',{chargedMicros:0,result:{address:account.address,transaction:result.transactionHash,network:NETWORK,testnet:true}});}catch(error){return await finishJob(key,'unknown',{chargedMicros:0,error:error instanceof Error?error.message:'Testnet faucet failed'});}
}
