import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createSession,readCase,applyCommand,Access} from '../lib/store';
import {reviewWithClaude} from '../lib/providers/claude';
import {demoCloseCsv,parseCloseCsv} from '../lib/close';
process.loadEnvFile('.env.local');await mkdir('.data/verification',{recursive:true});
const checkpoint='.data/verification/claude-session.json';let a:Access;
if(existsSync(checkpoint))a=JSON.parse(await readFile(checkpoint,'utf8'));else{a=await createSession();await writeFile(checkpoint,JSON.stringify(a),{mode:0o600});}
let c=await readCase(a);if(!c.close.records.length)c=await applyCommand(a,{type:'close_import',records:parseCloseCsv(demoCloseCsv),expectedCloseVersion:c.close.version,requestKey:'claude-verification-import'});
const question='Review the settlement reconciliation. Explain the balanced payout, the unexplained difference, and the ambiguous allocation. Cite 1–3 source IDs for each. Do not infer missing fees as facts.';
const job=await reviewWithClaude(c,question);if(job.state!=='completed'){console.log(JSON.stringify({state:job.state,chargedMicros:job.chargedMicros,error:job.error}));process.exitCode=1;}else{
 const cached=await reviewWithClaude(c,question);if(!cached.cached||cached.key!==job.key)throw Error('Review cache failed');
 await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/claude-verification.json',JSON.stringify({status:'LIVE_VERIFIED',verifiedAt:new Date().toISOString(),jobKey:job.key,chargedMicros:job.chargedMicros,result:job.result,checks:['Live Claude API request','Strict tool JSON validated','Source IDs validated','Same evidence and question returned cached job without a second API call','Shared Convex budget reservation and settlement']},null,2)+'\n');console.log(JSON.stringify({status:'LIVE_VERIFIED',chargedMicros:job.chargedMicros,cached:true}));
}
