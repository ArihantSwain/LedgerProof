import {existsSync} from 'node:fs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const env=process.env;
const family=env.CREAO_API_FAMILY??'developer-v2';
const expected=family==='agent-v1'?'https://agent.creao.ai/api/v1':'https://developer.creao.ai/v2';
const checks=[
 {name:'Claude API key',ok:!!env.ANTHROPIC_API_KEY,action:'Add server-only ANTHROPIC_API_KEY. App cap is $5 / 50 reservations.'},
 {name:'CRS sandbox account',ok:!!(env.CRS_USERNAME&&env.CRS_PASSWORD),action:'Add sandbox CRS_USERNAME and quoted CRS_PASSWORD from the CRS team.'},
 {name:'Coinbase CDP credentials',ok:!!(env.CDP_API_KEY_ID&&env.CDP_API_KEY_SECRET&&env.CDP_WALLET_SECRET),action:'Add the three CDP server credentials from portal.cdp.coinbase.com.'},
 {name:'Real x402 evidence purchasing enabled',ok:env.LEDGERPROOF_X402_EVIDENCE_ENABLED==='true',action:'Prepare/fund the buyer wallet, then enable bounded real purchases. Unpaid Exa quotes need no key.'},
 {name:'Local environment file',ok:existsSync('.env.local'),action:'Copy .env.example to .env.local and configure it securely.'},
 {name:'CREAO agent ID',ok:!!env.CREAO_AGENT_ID,action:'Save the hosted investigator and obtain its actual ID.'},
 {name:'CREAO server key',ok:!!env.CREAO_API_KEY,action:'Configure the account-supported key locally; do not paste it into chat.'},
 {name:'CREAO explicit API family/base',ok:['agent-v1','developer-v2'].includes(family)&&(env.CREAO_API_BASE||expected)===expected,action:'Confirm one account API family and matching base; never mix them.'},
 {name:'CREAO account contract confirmed',ok:env.CREAO_CONTRACT_VERIFIED==='true',action:'Confirm API/form/result contract, then set verification flag; this flag is not execution proof.'},
 {name:'Convex URL',ok:!!env.CONVEX_URL,action:'Configure the intended Convex deployment URL.'},
 {name:'Convex backend secret',ok:(env.LEDGERPROOF_BACKEND_SECRET?.length??0)>=32,action:'Set a strong shared server/backend secret of at least 32 characters.'},
 {name:'Exact app origin',ok:!!env.APP_ORIGIN,action:'Set APP_ORIGIN to the real local or authorized hosted origin.'},
 {name:'Fixture credit PDF',ok:existsSync('public/fixtures/credit-note-INV-A.pdf'),action:'Run npm run fixtures.'},
 {name:'Architecture briefing',ok:existsSync('docs/briefing.html')&&existsSync('docs/LedgerProof-Briefing.pdf'),action:'Run npm run docs:build and npm run docs:export.'},
];
for(const c of checks)console.log(`${c.ok?'READY':'ACTION'} | ${c.name}${c.ok?'':' | '+c.action}`);
console.log('\nConfiguration inspection only. No secrets printed, no provider calls, no LIVE_VERIFIED claim.');
console.log('Next: docs/ACTION-ITEMS.md. Live execution evidence must be captured separately.');
