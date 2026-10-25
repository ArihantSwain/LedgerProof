import {test as base,expect} from '@playwright/test';
const demoStarts:number[]=[];
export const test=base.extend<{browserErrors:string[]}>({browserErrors:[async({page},use,testInfo)=>{
 // The hosted API intentionally permits 20 demo starts per minute. Keep the
 // full browser suite below that real limit instead of weakening protection.
 while(demoStarts.length&&demoStarts[0]<Date.now()-61000)demoStarts.shift();
 if(demoStarts.length>=16){const delay=Math.max(0,demoStarts[0]+61000-Date.now());testInfo.setTimeout(testInfo.timeout+delay);await new Promise(resolve=>setTimeout(resolve,delay));}
 page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/demo/session')demoStarts.push(Date.now());});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await use(errors);expect(errors,'No uncaught browser exceptions').toEqual([]);
},{auto:true}]});
export {expect};
