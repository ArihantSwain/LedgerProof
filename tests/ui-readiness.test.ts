import {test} from 'node:test';
import assert from 'node:assert/strict';
import {amountInCents,validDate,inForecast,humanMessage,settlementInputIssue,hasReviewEvidence} from '../lib/ui-readiness';
import {createFixture} from '../fixtures/agency';
import {demoCloseCsv,parseCloseCsv} from '../lib/close';

test('blank, negative, fractional-cent and out-of-range inputs cannot enable money or date actions',()=>{
 for(const value of ['', '-1','NaN','1.001','1e4','Infinity'])assert.equal(amountInCents(value),null,value);
 assert.equal(amountInCents('0'),null);assert.equal(amountInCents('0',true),0);assert.equal(amountInCents('72.34'),7234);assert.equal(amountInCents('100.01',false,10000),null);
 assert.equal(validDate('2026-10-32'),false);assert.equal(validDate(''),false);assert.equal(inForecast('2026-10-26','2026-10-26'),true);assert.equal(inForecast('2027-01-25','2026-10-26'),false);
});
test('CSV readiness distinguishes absent data, duplicates and actual ready-to-import records',()=>{
 const c=createFixture('readiness',Date.now());assert.match(settlementInputIssue(c,''),/Choose/);assert.equal(settlementInputIssue(c,demoCloseCsv),'');
 c.close.records=parseCloseCsv(demoCloseCsv);assert.match(settlementInputIssue(c,demoCloseCsv),/already imported/);assert.equal(settlementInputIssue(c,'id,kind,date,amountCents,reference\nnew_fee,fee,2026-10-28,5000,payout_102'),'');
 assert.equal(hasReviewEvidence(createFixture('empty-review',Date.now())),false);assert.equal(hasReviewEvidence(c),true);
});
test('expected failures become stable human-readable guidance without stack traces or implied retry safety',()=>{
 for(const raw of ['Document already imported','Ledger changed; rerun investigation','Credit PDF requires Type: credit_note and Currency: USD','Unexpected token < in JSON','Server Error RequestID private-debug']){
  const message=humanMessage(Error(raw));assert.equal(humanMessage(message),message);assert.ok(!/RequestID|Unexpected token|stack/i.test(message));
 }
 assert.match(humanMessage(Error('fetch failed')),/could not confirm/);assert.match(humanMessage(Error('Overpayment/over-credit exception')),/larger than/);
});
