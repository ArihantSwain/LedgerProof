import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {ConvexHttpClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
import {z} from 'zod';

export type SealedSession={sealed:string;expiresAt:number};
function config(){
 const url=process.env.CONVEX_URL||process.env.NEXT_PUBLIC_CONVEX_URL,secret=process.env.LEDGERPROOF_BACKEND_SECRET;
 if(process.env.LEDGERPROOF_OFFLINE_REHEARSAL==='true'||!url||!secret||secret.length<32)throw Error('Provider sessions require the configured shared backend');
 return {client:new ConvexHttpClient(url),secret};
}
function encryptionKey(secret:string){return createHash('sha256').update('ledgerproof-provider-session-v1\0').update(secret).digest();}
export function sealProviderToken(token:string,key:string,expiresAt:number,secret:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(secret),iv);
 cipher.setAAD(Buffer.from(`crs:${key}:${expiresAt}`));
 const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return JSON.stringify({iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),ciphertext:encrypted.toString('base64')});
}
export function openProviderToken(session:SealedSession,key:string,secret:string,now=Date.now()){
 if(session.expiresAt<=now)return null;
 const envelope=z.object({iv:z.string().regex(/^[a-f0-9]{24}$/),tag:z.string().regex(/^[a-f0-9]{32}$/),ciphertext:z.string().min(1).max(16000)}).strict().parse(JSON.parse(session.sealed));
 const decipher=createDecipheriv('aes-256-gcm',encryptionKey(secret),Buffer.from(envelope.iv,'hex'));
 decipher.setAAD(Buffer.from(`crs:${key}:${session.expiresAt}`));decipher.setAuthTag(Buffer.from(envelope.tag,'hex'));
 return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]).toString('utf8');
}
export async function readProviderSession(key:string):Promise<SealedSession|null>{
 const {client,secret}=config();return client.query(makeFunctionReference<'query'>('providerSessions:read'),{secret,key});
}
export async function saveProviderToken(key:string,token:string,expiresAt:number){
 const {client,secret}=config();
 await client.mutation(makeFunctionReference<'mutation'>('providerSessions:save'),{secret,key,sealed:sealProviderToken(token,key,expiresAt,secret),expiresAt});
}
