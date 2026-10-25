import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {z} from 'zod';

// Only this fixed read tool is exposed to the application. An LLM never receives
// the generic MCP client or signing/transfer tools. Keys travel through the child
// environment, not arguments, tool inputs, browser responses or history files.
export async function verifyManagedEvidenceWallet(expectedAddress:string){
 if(process.env.LEDGERPROOF_OFFLINE_REHEARSAL==='true')throw Error('Coinbase MCP is disabled in offline rehearsal');
 if(!process.env.CDP_API_KEY_ID||!process.env.CDP_API_KEY_SECRET)throw Error('CDP API credentials unavailable');
 const client=new Client({name:'ledgerproof-evidence-buyer',version:'0.2.0'});
 const scratch=await mkdtemp(path.join(tmpdir(),'ledgerproof-cdp-'));
 try{
  await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(process.cwd(),'node_modules/@coinbase/cdp-cli/dist/index.js'),'mcp'],env:{PATH:process.env.PATH??'',HOME:scratch,XDG_CONFIG_HOME:scratch,CDP_ENV:'live',CDP_KEY_ID:process.env.CDP_API_KEY_ID,CDP_KEY_SECRET:process.env.CDP_API_KEY_SECRET,CDP_NO_HISTORY:'1',CDP_URL:'https://api.cdp.coinbase.com/platform/v2'},stderr:'pipe'}));
  const result=await client.callTool({name:'cdp_evm_accounts_by_name',arguments:{name:'ledgerproof-evidence-buyer'}},undefined,{timeout:20000});
  if(result.isError)throw Error('Coinbase MCP could not verify the managed buyer account');
  const text=z.object({content:z.array(z.object({type:z.string(),text:z.string().optional()}))}).parse(result).content.filter(b=>b.type==='text').map(b=>b.text??'').join('\n');
  if(text.length>20000)throw Error('Coinbase MCP output exceeded bound');const account=z.object({address:z.string().regex(/^0x[a-fA-F0-9]{40}$/)}).parse(JSON.parse(text));
  if(account.address.toLowerCase()!==expectedAddress.toLowerCase())throw Error('Coinbase MCP wallet identity differs from the payment signer');
  return {provider:'Coinbase CDP MCP',tool:'cdp_evm_accounts_by_name',accountName:'ledgerproof-evidence-buyer',address:account.address,verified:true};
 }finally{try{await client.close();}finally{await rm(scratch,{recursive:true,force:true});}}
}
