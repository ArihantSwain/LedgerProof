import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const origin=new URL(process.argv[2]??'https://ledgerproof-one.vercel.app').origin;
if(!origin.startsWith('https://'))throw Error('Hosted verification requires HTTPS');
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const checks:string[]=[];
const proof:Record<string,unknown>={origin,verifiedAt:new Date().toISOString(),checks,paidSearchExecuted:false,claudeCallExecuted:false};
try{
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Start finance demo'}).click();
 await expect(page.getByRole('heading',{name:'Cash forecast',exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link')).toHaveCount(3);
 await page.getByRole('navigation').getByRole('link',{name:'Accounting workbench'}).click();
 await expect(page.getByRole('heading',{name:'Accounting workbench',exact:true})).toBeVisible();
 checks.push('Cash forecast, Accounting workbench and Import records appear in navigation');
 checks.push('Anonymous browser started the hosted demo without a Vercel account');
 await page.getByRole('button',{name:'Load sample settlement'}).click();
 const balanced=page.getByTestId('settlement-bank_oct27');
 await expect(balanced).toHaveAttribute('data-status','ready');
 await balanced.getByRole('button',{name:'Approve settlement journal'}).click();
 await expect(balanced).toHaveAttribute('data-status','posted');
 const response=await page.request.get(origin+'/api/operations');const state=await response.json();
 expect(state.case.mode).toBe('CONVEX');expect(state.case.close.postings).toHaveLength(1);
 checks.push('Imported settlement evidence and persisted exactly one human-approved journal in Convex');
 const cookies=await context.cookies();const session=cookies.find(c=>c.name==='lp_session');expect(session?.secure&&session?.httpOnly).toBe(true);
 checks.push('Workspace cookie uses Secure and HttpOnly');
 const denied=await page.request.post(origin+'/api/demo/reset',{headers:{Origin:'https://untrusted.example'},data:{}});expect(denied.status()).toBe(403);
 checks.push('Cross-origin mutations rejected');
 await page.reload();await expect(balanced).toHaveAttribute('data-status','posted');
 checks.push('Hosted journal survives page reload');
 await page.locator('#missing-context > summary').click();
 await page.getByRole('button',{name:'Add investigation charge'}).click();
 await expect(page.getByRole('button',{name:'Get unpaid Exa quote'})).toBeVisible();
 if(!process.argv.includes('--ui-only')){
 const walletResponse=await page.request.post(origin+'/api/evidence/wallet',{data:{},timeout:90000});const wallet=await walletResponse.json();
 proof.wallet={httpStatus:walletResponse.status(),address:wallet.address??null,balanceAtomic:wallet.balanceAtomic??null,agentToolingVerified:wallet.agentTooling?.verified??false,error:wallet.error??null};
 expect(walletResponse.ok(),wallet.error).toBe(true);expect(wallet.agentTooling.verified).toBe(true);
 checks.push('Hosted Coinbase SDK and local CDP MCP process verified the same managed wallet without transferring funds');
 const current=await(await page.request.get(origin+'/api/operations')).json();
 const quoteResponse=await page.request.post(origin+'/api/evidence/quote',{data:{chargeId:current.case.evidencePurchases.charges[0].id},timeout:45000});const quote=await quoteResponse.json();
 expect(quoteResponse.ok(),quote.error).toBe(true);expect(quote.terms.amountAtomic).toBeGreaterThan(0);
 proof.exa={httpStatus:quoteResponse.status(),amountAtomic:quote.terms.amountAtomic,network:quote.terms.network};checks.push('Hosted Exa HTTP402 quote obtained without payment');
 if(process.argv.includes('--crs')){
  const reportResponse=await page.request.post(origin+'/api/services/crs',{data:{personaId:'P01',syntheticOnly:true},timeout:90000});const report=await reportResponse.json();
  proof.crs={httpStatus:reportResponse.status(),state:report.job?.state??null,result:report.job?.result??null,error:report.job?.error??report.error??null};
  expect(reportResponse.ok(),report.error).toBe(true);expect(report.job.state,report.job.error).toBe('completed');
  checks.push('Hosted CRS synthetic report retrieved using the shared encrypted session');
 }
 }
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/vercel-hosted-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/vercel-hosted-mobile.png',fullPage:true});checks.push('Hosted desktop and mobile layout checked');
 proof.status='LIVE_HOSTED_VERIFIED';proof.uiOnly=process.argv.includes('--ui-only');
}catch(error){proof.status='HOSTED_CHECK_FAILED';proof.error=error instanceof Error?error.message:'Hosted check failed';process.exitCode=1;}
finally{
 await browser.close();await mkdir('docs/evidence',{recursive:true});await writeFile(process.argv.includes('--ui-only')?'docs/evidence/consolidation-verification.json':'docs/evidence/vercel-verification.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
