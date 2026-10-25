import { randomBytes,createHash,randomUUID } from 'node:crypto';
import { mkdir,readFile,writeFile,rename } from 'node:fs/promises';
import path from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { Case,Command,caseSchema } from './contracts';
import { createRecordingFixture as createFixture } from '../fixtures/agency';
import { transition } from './workflow';
export type Access={caseId:string;token:string};
const root=path.join(process.cwd(),'.data');
const globalStore=globalThis as typeof globalThis & {ledgerproofQueue?:Promise<unknown>};
export function tokenHash(token:string){return createHash('sha256').update(token).digest('hex');}
function localAllowed(){if(process.env.NODE_ENV==='production'&&process.env.LEDGERPROOF_ALLOW_LOCAL!=='true')throw Error('Configure Convex before hosting. Local rehearsal persistence is disabled in production unless explicitly enabled.');}
function convex(){if(process.env.LEDGERPROOF_OFFLINE_REHEARSAL==='true')return null;const url=process.env.CONVEX_URL||process.env.NEXT_PUBLIC_CONVEX_URL;if(!url)return null;if(!process.env.LEDGERPROOF_BACKEND_SECRET)throw Error('Convex backend secret is missing; run npm run setup:convex after account setup');return new ConvexHttpClient(url);}
async function rpc(name:string,a:Access,extra:Record<string,unknown>={},mutation=false){const client=convex()!;const args={secret:process.env.LEDGERPROOF_BACKEND_SECRET!,caseId:a.caseId,tokenHash:tokenHash(a.token),...extra};return mutation?client.mutation(makeFunctionReference<'mutation'>(`cases:${name}`),args):client.query(makeFunctionReference<'query'>(`cases:${name}`),args);}
function validateAccess(a:Access){if(!/^[a-f0-9-]{36}$/.test(a.caseId)||! /^[a-f0-9]{64}$/.test(a.token))throw Error('Session unavailable');}
async function locked<T>(fn:()=>Promise<T>){const previous=globalStore.ledgerproofQueue??Promise.resolve();const next=previous.catch(()=>{}).then(fn);globalStore.ledgerproofQueue=next.catch(()=>{});return next;}
async function localRead(a:Access){validateAccess(a);localAllowed();const raw=JSON.parse(await readFile(path.join(root,a.caseId+'.json'),'utf8'));if(raw.tokenHash!==tokenHash(a.token)||raw.state.expiresAt<Date.now())throw Error('Session unavailable');return caseSchema.parse(raw.state);}
async function localWrite(a:Access,state:Case){await mkdir(root,{recursive:true,mode:0o700});const dest=path.join(root,a.caseId+'.json');const temp=dest+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify({tokenHash:tokenHash(a.token),state}),{mode:0o600});await rename(temp,dest);}
export async function createSession(){const a={caseId:randomUUID(),token:randomBytes(32).toString('hex')};if(convex())await rpc('create',a,{now:Date.now()},true);else {localAllowed();await locked(()=>localWrite(a,createFixture(a.caseId,Date.now())));}return a;}
export async function readCase(a:Access):Promise<Case>{validateAccess(a);return convex()?caseSchema.parse(await rpc('read',a)):locked(()=>localRead(a));}
export async function applyCommand(a:Access,command:Command):Promise<Case>{validateAccess(a);if(convex())return caseSchema.parse(await rpc('apply',a,{command},true));return locked(async()=>{const c=transition(await localRead(a),command);await localWrite(a,c);return c;});}
export async function saveOriginal(a:Access,bytes:Uint8Array,mime:string){validateAccess(a);await readCase(a);if(convex()){const url=await rpc('uploadUrl',a,{},true);const response=await fetch(String(url),{method:'POST',headers:{'Content-Type':mime},body:Buffer.from(bytes)});if(!response.ok)throw Error('Document storage unavailable');return (await response.json()).storageId as string;}const ref=randomUUID();await mkdir(path.join(root,'files'),{recursive:true});await writeFile(path.join(root,'files',a.caseId+'-'+ref),bytes,{mode:0o600});return ref;}
export async function readOriginal(a:Access,documentId:string){const c=await readCase(a);const d=c.documents.find(d=>d.id===documentId);if(!d?.storageRef)return null;if(convex()){const url=await rpc('fileUrl',a,{documentId,storageId:d.storageRef});if(!url)throw Error('Original file unavailable');const r=await fetch(String(url));if(!r.ok)throw Error('Original file unavailable');return new Uint8Array(await r.arrayBuffer());}return new Uint8Array(await readFile(path.join(root,'files',a.caseId+'-'+d.storageRef)));}
