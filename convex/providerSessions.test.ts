/// <reference types="vite/client" />
import {test,expect,beforeEach} from 'vitest';
import {convexTest} from 'convex-test';
import schema from './schema';
import {api} from './_generated/api';
const modules=import.meta.glob('./**/*.ts');
const secret='test-only-provider-vault-backend-secret';
beforeEach(()=>{process.env.LEDGERPROOF_BACKEND_SECRET=secret;});
test('provider sessions survive independent callers and stay out of case history; wrong backend secret is rejected',async()=>{
 const t=convexTest(schema,modules),key='f'.repeat(64),sealed='opaque-test-ciphertext'.repeat(3),expiresAt=Date.now()+120000;
 await t.mutation(api.providerSessions.save,{secret,key,sealed,expiresAt});
 expect(await t.query(api.providerSessions.read,{secret,key})).toEqual({sealed,expiresAt});
 await expect(t.query(api.providerSessions.read,{secret:'wrong',key})).rejects.toThrow('Unauthorized');
 await expect(t.mutation(api.providerSessions.save,{secret:'wrong',key,sealed,expiresAt})).rejects.toThrow('Unauthorized');
 const history=await t.query(api.providerJobs.status,{secret,caseId:'global-auth'});expect(JSON.stringify(history)).not.toContain(sealed);
 await t.mutation(api.providerSessions.save,{secret,key,sealed:'older'.repeat(10),expiresAt:expiresAt-60000});
 expect((await t.query(api.providerSessions.read,{secret,key}))?.sealed).toBe(sealed);
});
test('session storage rejects expired, oversized and excessive-lifetime values',async()=>{
 const t=convexTest(schema,modules),base={secret,key:'a'.repeat(64),sealed:'opaque'.repeat(8),expiresAt:Date.now()+60000};
 for(const bad of [{expiresAt:Date.now()-1},{expiresAt:Date.now()+7200000},{sealed:'x'.repeat(20001)},{key:'invalid'}])await expect(t.mutation(api.providerSessions.save,{...base,...bad})).rejects.toThrow();
 expect(await t.query(api.providerSessions.read,{secret,key:base.key})).toBeNull();
});
