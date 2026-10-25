import {test,expect} from './fixtures';
test('optional evidence explains each provider and local context prevents a purchase',async({page})=>{
 await page.goto('/workbench');await page.getByRole('button',{name:'Start finance demo'}).click();
 await expect(page.getByRole('button',{name:'Add investigation charge'})).not.toBeVisible();
 await page.locator('#missing-context > summary').click();await expect(page.locator('#missing-context')).toContainText('Exa searches official vendor documentation');
 await page.getByRole('button',{name:'Add investigation charge'}).click();await expect(page.getByRole('heading',{name:'GITHUB.COM · second charge this month',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Get unpaid Exa quote'})).toBeDisabled();await expect(page.locator('#missing-context')).toContainText('Live vendor searches are unavailable');
 await page.getByLabel('Local billing evidence').fill('Vendor receipt is available locally. Review subscription and usage line items before paying for research.');await page.getByRole('button',{name:'Attach local evidence'}).click();
 await expect(page.getByRole('button',{name:'Get unpaid Exa quote'})).toBeDisabled();await expect(page.getByText('Local evidence is attached. Review it before buying additional context.',{exact:true})).toBeVisible();
 const state=await(await page.request.get('/api/operations')).json();expect(state.case.evidencePurchases.authorizations).toHaveLength(0);
 const forced=await page.request.post('/api/evidence/buy',{data:{chargeId:state.case.evidencePurchases.charges[0].id,quoteFingerprint:'a'.repeat(64),reason:'Test direct route'}});expect(forced.ok()).toBeFalsy();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});
