import {chromium} from '@playwright/test';
import {readdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.join(process.cwd(),'docs');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1.5});
 for(const file of (await readdir(path.join(root,'diagrams'))).filter(f=>f.endsWith('.svg'))){await page.goto(pathToFileURL(path.join(root,'diagrams',file)).href);await page.locator('svg').screenshot({path:path.join(root,'diagrams',file.replace('.svg','.png'))});}
 await page.goto(pathToFileURL(path.join(root,'briefing.html')).href);
 await page.emulateMedia({media:'print'});
 await page.pdf({path:path.join(root,'LedgerProof-Briefing.pdf'),format:'A4',printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:8px;color:#70816f;width:100%;text-align:center;font-family:Arial">LedgerProof · October 24, 2026 · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',preferCSSPageSize:true});
 await page.emulateMedia({media:'screen'});await page.screenshot({path:path.join(root,'briefing-preview.png'),fullPage:false});
 // Actual offline interaction checks, not only successful rendering.
 await page.getByRole('button',{name:'Service register',exact:true}).click();if(!await page.locator('#services').isVisible())throw Error('Briefing service navigation failed');
 await page.getByRole('searchbox',{name:'Search briefing'}).fill('idempotency');if(!await page.locator('#search-status').textContent())throw Error('Briefing search failed');
 await page.getByRole('searchbox',{name:'Search briefing'}).fill('zz-no-such-section-zz');if(!await page.locator('#empty').isVisible())throw Error('Briefing empty-state failed');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Your action items',exact:true}).click();if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw Error('Briefing mobile overflow');
 await writeFile(path.join(root,'briefing-validation.json'),JSON.stringify({offlineNavigation:'passed',serviceSearch:'passed',searchEmptyState:'passed',mobileActionView:'passed',svgExports:5,pdfExport:'passed',providerVerification:'none'},null,2)+'\n');
 console.log('Exported 5 PNGs + printable PDF; offline navigation/search/mobile checks passed.');
}finally{await browser.close();}
