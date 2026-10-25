import {test as base,expect} from '@playwright/test';
export const test=base.extend<{browserErrors:string[]}>({browserErrors:[async({page},use)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await use(errors);expect(errors,'No uncaught browser exceptions').toEqual([]);
},{auto:true}]});
export {expect};
