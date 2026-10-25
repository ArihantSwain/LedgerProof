import {mutation,query} from './_generated/server';
import {v} from 'convex/values';

function authorize(secret:string,key:string){
 if(!process.env.LEDGERPROOF_BACKEND_SECRET||secret!==process.env.LEDGERPROOF_BACKEND_SECRET)throw Error('Unauthorized backend');
 if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid provider session key');
}
// These server-to-server functions expose only ciphertext. No browser endpoint
// forwards them or returns a provider session in case history or exports.
export const read=query({args:{secret:v.string(),key:v.string()},handler:async(ctx,args)=>{
 authorize(args.secret,args.key);
 const session=await ctx.db.query('providerSessions').withIndex('by_key',q=>q.eq('key',args.key)).unique();
 return session?{sealed:session.sealed,expiresAt:session.expiresAt}:null;
}});
export const save=mutation({args:{secret:v.string(),key:v.string(),sealed:v.string(),expiresAt:v.number()},handler:async(ctx,args)=>{
 authorize(args.secret,args.key);
 if(args.sealed.length>20000||args.sealed.length<32||!Number.isSafeInteger(args.expiresAt)||args.expiresAt<=Date.now()||args.expiresAt>Date.now()+3_600_000)throw Error('Invalid provider session');
 const prior=await ctx.db.query('providerSessions').withIndex('by_key',q=>q.eq('key',args.key)).unique();
 if(prior&&prior.expiresAt>=args.expiresAt)return null;
 const value={key:args.key,provider:'crs' as const,sealed:args.sealed,expiresAt:args.expiresAt};
 if(prior)await ctx.db.replace(prior._id,value);else await ctx.db.insert('providerSessions',value);
 return null;
}});
