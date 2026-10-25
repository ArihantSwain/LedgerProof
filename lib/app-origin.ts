// Vercel supplies these hosts itself. Never trust a caller's forwarded host to
// choose a payment destination or expand the mutation origin allowlist.
export function appOrigins(){
 const origins=new Set<string>();
 if(process.env.APP_ORIGIN)origins.add(new URL(process.env.APP_ORIGIN).origin);
 if(process.env.VERCEL==='1'){
  for(const host of [process.env.VERCEL_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL])if(host)origins.add(new URL('https://'+host).origin);
 }
 if(!origins.size)origins.add('http://localhost:3000');
 return origins;
}
