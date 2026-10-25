import {test,expect} from './fixtures';
test('uploaded credit moves through investigation and human approval into the same cash forecast',async({page,browser})=>{
 await page.goto('/');await page.getByRole('button',{name:'Start finance demo'}).click();await expect(page.locator('.forecast-kpis article').nth(1)).toContainText('$16,000');
 await page.getByRole('navigation').getByRole('link',{name:'Accounting workbench'}).click();await page.locator('#receivables > summary').click();
 const uploadResponse=page.waitForResponse(r=>r.url().endsWith('/api/documents')&&r.request().method()==='POST');await page.getByLabel('Upload evidence').setInputFiles('public/examples/01-credit-notes/INV-A-credit-8000-USD.pdf');expect((await uploadResponse).ok()).toBeTruthy();
 await page.getByText('Investigation settings and challenge',{exact:true}).click();await page.getByLabel('Use local deterministic rehearsal').check();await page.getByRole('button',{name:'Utilize our agent',exact:true}).click();await expect(page.getByText('Local rules rehearsal',{exact:true})).toBeVisible();
 await page.locator('.proposal').filter({hasText:'Apply issued credit note'}).getByRole('button',{name:'Approve correction'}).click();
 await page.getByRole('navigation').getByRole('link',{name:'Cash forecast'}).click();await expect(page.locator('.forecast-kpis article').nth(1)).toContainText('$8,000');
 await page.getByText('Test a cash disruption',{exact:true}).click();await page.getByRole('button',{name:'Model customer delay'}).click();await expect(page.locator('.forecast-kpis article').nth(1)).toContainText('-$4,000');
 const unrelated=await browser.newContext();const stranger=await unrelated.newPage();await stranger.goto('/');await expect(stranger.getByRole('button',{name:'Start finance demo'})).toBeVisible();await unrelated.close();
 await page.getByRole('button',{name:'Share workspace'}).click();const link=await page.getByLabel('Shared workspace link').inputValue();const shared=await browser.newContext();const reviewer=await shared.newPage();await reviewer.goto(link);await expect(reviewer.locator('.forecast-kpis article').nth(1)).toContainText('-$4,000');
 await page.getByRole('button',{name:'Clear disruptions'}).click();await expect(reviewer.locator('.forecast-kpis article').nth(1)).toContainText('$8,000');await shared.close();
});
test('unavailable hosted investigations stay disabled and the sample flow can resume safely',async({page})=>{
 await page.goto('/workbench');await page.getByRole('button',{name:'Start finance demo'}).click();await page.locator('#receivables > summary').click();
 await expect(page.getByRole('button',{name:'Utilize our agent',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Run sample investigation',exact:true}).click();await expect(page.locator('.run .status')).toHaveText('Completed');
 await page.getByText('Investigation settings and challenge',{exact:true}).click();await page.getByRole('button',{name:'Inject simulated timeout'}).click();await expect(page.locator('.run').first()).toContainText('Practice interruption');await page.getByRole('button',{name:'Resume same run'}).click();await expect(page.locator('.run').first().locator('.status')).toHaveText('Completed');await expect(page.locator('.run')).toHaveCount(2);await expect(page.locator('.error[role=alert]')).toHaveCount(0);
});
test('legacy receivables link now opens the forecast with no separate navigation tree',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/ledger');await page.getByRole('button',{name:'Start finance demo'}).click();await expect(page).toHaveURL(/\/$/);await expect(page.getByRole('heading',{name:'Cash forecast',exact:true})).toBeVisible();await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.screenshot({path:'test-results/consolidated-forecast-mobile.png',fullPage:true});
});
