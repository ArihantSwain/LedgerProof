import {spawn} from 'node:child_process';
const args=process.argv.slice(2),portFlag=args.findIndex(arg=>arg==='--port'||arg==='-p');
const port=portFlag>=0?args[portFlag+1]:'3000';
if(!/^\d{1,5}$/.test(port??'')||Number(port)>65535||Number(port)<1)throw Error('Choose a port between 1 and 65535.');
console.log(`LedgerProof sample demo: http://localhost:${port}. No service accounts or API keys are required.`);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',...args],{stdio:'inherit',env:{...process.env,LEDGERPROOF_OFFLINE_REHEARSAL:'true',LEDGERPROOF_ALLOW_LOCAL:'true',APP_ORIGIN:`http://localhost:${port}`}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>{process.exitCode=code??1;});
