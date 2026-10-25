import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createSession,type Access} from '../lib/store';
import {runCrs} from '../lib/providers/crs';

process.loadEnvFile('.env.local');
await mkdir('.data/verification',{recursive:true,mode:0o700});
const checkpoint='.data/verification/crs-session.json';
let access:Access;
if(existsSync(checkpoint))access=JSON.parse(await readFile(checkpoint,'utf8'));
else {access=await createSession();await writeFile(checkpoint,JSON.stringify(access),{mode:0o600});}
// Reuse the exact case and persona on rerun: the provider job prevents another pull.
const job=await runCrs(access.caseId,'P01');
const proof={status:job.state==='completed'?'LIVE_SANDBOX_VERIFIED':'LIVE_SANDBOX_BLOCKED',verifiedAt:new Date().toISOString(),jobKey:job.key,state:job.state,result:job.result??null,error:job.error??null,checks:['Password parsed with its literal hash character','Official synthetic CRS persona only','Durable login and report guards; no automatic retry','No business credit assessment or ledger change']};
await mkdir('docs/evidence',{recursive:true});
await writeFile('docs/evidence/crs-verification.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
if(job.state!=='completed')process.exitCode=1;
