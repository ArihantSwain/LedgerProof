import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {probeExa,prepareEvidenceWallet} from '../lib/providers/paid-evidence';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
await mkdir('docs/evidence',{recursive:true});
const quote=await probeExa({id:'github-investigation-example',date:'2026-10-24',description:'GITHUB.COM · second charge this month',amountCents:7234,merchantId:'github',localEvidence:''});
await writeFile('docs/evidence/exa-x402-quote.json',JSON.stringify({verifiedAt:new Date().toISOString(),status:'LIVE_QUOTE_VERIFIED',paymentExecuted:false,documentation:['https://exa.ai/docs/integrations/payments/x402/quickstart','https://www.coinbase.com/developer-platform/discover/launches/exa'],quote},null,2)+'\n');
console.log(JSON.stringify({status:quote.status,provider:quote.provider,costAtomic:quote.terms.amountAtomic,network:quote.terms.network,paymentExecuted:false}));
if(process.argv.includes('--prepare-wallet')){const wallet=await prepareEvidenceWallet();await mkdir('.data/verification',{recursive:true});await writeFile('.data/verification/evidence-wallet.json',JSON.stringify(wallet,null,2),{mode:0o600});console.log(JSON.stringify(wallet));}
