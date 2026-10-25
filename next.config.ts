import type {NextConfig} from 'next';

const config:NextConfig={
 serverExternalPackages:['@coinbase/cdp-sdk','@modelcontextprotocol/sdk'],
 outputFileTracingIncludes:{'/api/*':['./node_modules/@coinbase/cdp-cli/dist/**/*','./node_modules/@coinbase/cdp-cli/package.json']},
 outputFileTracingExcludes:{'/*':['./.data/**/*','./.env*','./.vercel/**/*','./.agents/**/*','./.claude/**/*']},
};
export default config;
