import type {NextConfig} from 'next';

const config:NextConfig={
 async redirects(){return [{source:'/examples/ledgerproof-judge-pack.zip',destination:'/SAMPLES/samples.zip',permanent:false},{source:'/examples/JUDGE-GUIDE.pdf',destination:'/SAMPLES/samples.zip',permanent:false},{source:'/examples/:path*',destination:'/SAMPLES/:path*',permanent:false}];},
 serverExternalPackages:['@coinbase/cdp-sdk','@modelcontextprotocol/sdk'],
 outputFileTracingIncludes:{'/api/*':['./node_modules/@coinbase/cdp-cli/dist/**/*','./node_modules/@coinbase/cdp-cli/package.json']},
 outputFileTracingExcludes:{'/*':['./.data/**/*','./.env*','./.vercel/**/*','./.agents/**/*','./.claude/**/*']},
};
export default config;
