import {test,expect} from './fixtures';

test('missing inputs, repeated imports and unavailable tools disable their actions before a request',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Start finance demo'}).click();await page.getByText('Test a cash disruption',{exact:true}).click();
 await page.getByLabel('Delayed collection date').fill('');await expect(page.getByRole('button',{name:'Model customer delay'})).toBeDisabled();
 await page.getByLabel('Unexpected expense · USD').fill('');await expect(page.getByRole('button',{name:'Model unexpected expense'})).toBeDisabled();
 await page.getByLabel('Delayed collection date').fill('2026-11-09');await page.getByRole('button',{name:'Model customer delay'}).click();await expect(page.getByRole('button',{name:'Model customer delay'})).toBeDisabled();
 await page.getByRole('navigation').getByRole('link',{name:'Accounting workbench'}).click();await page.locator('#accounting-review > summary').click();await expect(page.getByRole('button',{name:'Request accounting review'})).toBeDisabled();
 await page.locator('#missing-context > summary').click();await page.getByText('Add another charge',{exact:true}).click();await page.getByLabel('Investigation charge amount').fill('');await expect(page.getByRole('button',{name:'Add investigation charge'})).toBeDisabled();
 await expect(page.locator('.error[role=alert]')).toHaveCount(0);
});
test('a temporary server response is readable and clears on navigation',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Start finance demo'}).click();await page.getByText('Test a cash disruption',{exact:true}).click();await page.route('**/api/operations',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'text/html',body:'<html>Temporary outage</html>'}):route.continue());await page.getByRole('button',{name:'Model unexpected expense'}).click();await expect(page.locator('.error[role=alert]')).toContainText('could not confirm');await expect(page.locator('.error[role=alert]')).not.toContainText('Unexpected token');await page.getByRole('navigation').getByRole('link',{name:'Accounting workbench'}).click();await expect(page.locator('.error[role=alert]')).toHaveCount(0);
});
test('an old polling response cannot erase an updated forecast',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Start finance demo'}).click();await page.getByText('Test a cash disruption',{exact:true}).click();const old=await(await page.request.get('/api/operations')).json();let replayed=false;await page.route('**/api/operations',async route=>{if(route.request().method()==='GET'&&!replayed){replayed=true;await route.fulfill({json:old});}else await route.continue();});await page.getByRole('button',{name:'Model unexpected expense'}).click();await expect(page.locator('.forecast-kpis article').nth(1)).toContainText('$13,000');await expect.poll(()=>replayed,{timeout:6000}).toBe(true);await expect(page.locator('.forecast-kpis article').nth(1)).toContainText('$13,000');
});
test('approving one correction disables stale proposals until the evidence is investigated again',async({page})=>{
 await page.goto('/workbench');await page.getByRole('button',{name:'Start finance demo'}).click();await page.locator('#receivables > summary').click();
 await page.getByLabel('Upload evidence').setInputFiles('SAMPLES/01-credit-notes/INV-A-credit-8000-USD.pdf');
 await page.getByRole('button',{name:'Run sample investigation',exact:true}).click();const credit=page.locator('.proposal').filter({hasText:'Apply issued credit note'});await credit.getByRole('button',{name:'Approve correction'}).click();
 const receipt=page.locator('.proposal').filter({hasText:'Match and post receipt'});await expect(receipt.getByRole('button',{name:'Approve correction'})).toBeDisabled();await expect(receipt).toContainText('The books changed');await expect(page.locator('.error[role=alert]')).toHaveCount(0);
});
test('duplicate documents give local guidance and reset starts clean inputs and records',async({page})=>{
 await page.goto('/workbench');await page.getByRole('button',{name:'Start finance demo'}).click();await page.locator('#receivables > summary').click();
 await page.getByLabel('Upload evidence').setInputFiles('SAMPLES/01-credit-notes/INV-A-credit-8000-USD.pdf');await expect.poll(async()=>((await(await page.request.get('/api/operations')).json()).case.credits.length)).toBe(1);
 let writes=0;page.on('request',request=>{if(request.url().endsWith('/api/documents')&&request.method()==='POST')writes++;});
 await page.getByLabel('Upload evidence').setInputFiles('SAMPLES/01-credit-notes/INV-A-credit-8000-USD.pdf');await expect(page.locator('#receivables')).toContainText('already in your workspace');expect(writes).toBe(0);
 await page.getByRole('button',{name:'Reset workspace'}).click();await expect(page.locator('#receivables')).not.toContainText('already in your workspace');const state=await(await page.request.get('/api/operations')).json();expect(state.case.credits).toHaveLength(0);
 await page.getByRole('navigation').getByRole('link',{name:'Cash forecast'}).click();await expect(page.locator('.forecast-kpis article').nth(1)).toContainText('$16,000');
});

test('an incomplete successful response keeps the valid workspace and offers recovery',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Start finance demo'}).click();await page.getByText('Test a cash disruption',{exact:true}).click();await page.route('**/api/operations',route=>route.request().method()==='POST'?route.fulfill({status:200,json:{error:'Unexpected upstream response'}}):route.continue());await page.getByRole('button',{name:'Model unexpected expense'}).click();await expect(page.locator('.error[role=alert]')).toContainText('could not confirm');await expect(page.getByRole('heading',{name:'Cash forecast',exact:true})).toBeVisible();await page.getByRole('button',{name:'Refresh workspace'}).click();await expect(page.locator('.error[role=alert]')).toHaveCount(0);await expect(page.locator('.forecast-kpis article').nth(1)).toContainText('$16,000');
});

test('navigation keeps the same workspace shell without flashing the landing page while requests are slow',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Start finance demo'}).click();await expect(page.getByRole('heading',{name:'Cash forecast',exact:true})).toBeVisible();
 await page.evaluate(()=>{
  const state=window as typeof window & {savedWorkspaceShell?:Element|null;landingFlashed?:boolean};state.savedWorkspaceShell=document.querySelector('.shell');state.landingFlashed=false;
  new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof Element&&(node.matches('.welcome')||node.querySelector('.welcome')))state.landingFlashed=true;}).observe(document.body,{childList:true,subtree:true});
 });
 await page.route('**/api/operations',async route=>{await new Promise(resolve=>setTimeout(resolve,1500));await route.continue().catch(()=>{});});
 for(let index=0;index<2;index++){
  await page.getByRole('navigation').getByRole('link',{name:'Accounting workbench'}).click();await expect(page.getByRole('heading',{name:'Accounting workbench',exact:true})).toBeVisible();
  await page.getByRole('navigation').getByRole('link',{name:'Cash forecast'}).click();await expect(page.getByRole('heading',{name:'Cash forecast',exact:true})).toBeVisible();
 }
 const result=await page.evaluate(()=>{const state=window as typeof window & {savedWorkspaceShell?:Element|null;landingFlashed?:boolean};return {sameShell:state.savedWorkspaceShell===document.querySelector('.shell'),landingFlashed:state.landingFlashed};});expect(result).toEqual({sameShell:true,landingFlashed:false});
});
test('an existing workspace reload shows a neutral loading state instead of the landing page',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Start finance demo'}).click();await expect(page.getByRole('heading',{name:'Cash forecast',exact:true})).toBeVisible();
 await page.route('**/api/operations',async route=>{await new Promise(resolve=>setTimeout(resolve,1200));await route.continue().catch(()=>{});});
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByText('Opening your workspace…')).toBeVisible();await expect(page.locator('.welcome')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Cash forecast',exact:true})).toBeVisible();
});
