import {existsSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';

if(existsSync('.env.local'))process.loadEnvFile('.env.local');
if(!process.env.CONVEX_DEPLOYMENT){
  console.error('First run npx convex dev --once, sign in, and select/create your LedgerProof development project. Then rerun npm run setup:convex.');
  process.exitCode=1;
}else{
  const url=process.env.CONVEX_URL||process.env.NEXT_PUBLIC_CONVEX_URL;
  if(!url)throw Error('Convex CLI has not written a deployment URL. Finish npx convex dev --once first.');
  const secret=process.env.LEDGERPROOF_BACKEND_SECRET||randomBytes(32).toString('hex');
  if(secret.length<32)throw Error('Existing backend secret is too short; configure at least 32 random characters.');
  let text=existsSync('.env.local')?await readFile('.env.local','utf8'):'';
  for(const [key,value] of Object.entries({CONVEX_URL:url,LEDGERPROOF_BACKEND_SECRET:secret})){
    const line=new RegExp('^'+key+'=.*$','m');text=line.test(text)?text.replace(line,key+'='+value):text+'\n'+key+'='+value;
  }
  await writeFile('.env.local',text.trimEnd()+'\n',{mode:0o600});
  // The secret goes only through stdin, never the shell, command arguments or logs.
  const configured=spawnSync('npx',['convex','env','set','LEDGERPROOF_BACKEND_SECRET'],{input:secret,encoding:'utf8',stdio:['pipe','pipe','pipe']});
  if(configured.status!==0){console.error('Convex environment setup failed. Verify CLI login and the selected development project, then rerun. Secret and provider response withheld.');process.exitCode=1;}
  else{
    console.log('Local URL configured and backend secret synchronized. Secret value withheld.');
    const deployed=spawnSync('npx',['convex','dev','--once'],{stdio:'inherit'});
    if(deployed.status!==0)process.exitCode=1;
    else console.log('Development functions deployed. Restart Next.js and verify shared state and approvals. This is configuration, not a LIVE_VERIFIED claim.');
  }
}
