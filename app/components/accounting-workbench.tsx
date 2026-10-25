'use client';
import {useEffect} from 'react';
import {reconcileClose} from '@/lib/close';
import {CloseWorkbench,ClaudeReview,CrsReview} from '../operations/accounting-panels';
import {EvidenceBuyer} from '../operations/evidence-buyer';
import {ReceivablesReview} from './receivables-review';
import {FollowUp} from './follow-up';
import type {WorkspaceProps} from './finance-workspace';

export function AccountingWorkbench(props:WorkspaceProps){
 const {view,api,run,onChange,busy}=props,c=view.case,close=reconcileClose(c.close);
 useEffect(()=>{const id=location.hash.slice(1);const target=id&&document.getElementById(id);if(target instanceof HTMLDetailsElement){target.open=true;target.scrollIntoView();}},[]);
 return <><div className="workbench-guide"><div><b>1</b><span>Bring in records<small>Deposits, invoices and receipts</small></span></div><div><b>2</b><span>Investigate differences<small>Find the evidence behind exceptions</small></span></div><div><b>3</b><span>Review the entries<small>You approve financial changes</small></span></div></div>
 <CloseWorkbench c={c} api={api} run={run} onChange={onChange} busy={busy}/>
 <ReceivablesReview {...props}/>
 <details className="panel padded workbench-fold" id="accounting-review"><summary><span>Accounting review<small>Claude explains the treatment and cites the source records.</small></span><span className="fold-tag">AI review</span></summary><ClaudeReview c={c} api={api} run={run} busy={busy}/></details>
 <details className="panel padded workbench-fold" id="missing-context"><summary><span>Find missing vendor context<small>Exa finds official documentation. Coinbase x402 pays only after approval.</small></span><span className="fold-tag">Optional evidence</span></summary><EvidenceBuyer c={c} api={api} run={run} onChange={onChange} busy={busy}/></details>
 <details className="panel padded workbench-fold" id="payment-terms"><summary><span>Check payment terms<small>CRS supplies a synthetic consumer credit report for this demonstration.</small></span><span className="fold-tag">Sandbox check</span></summary><CrsReview c={c} providers={view.providers} api={api} run={run} busy={busy}/></details>
 <details className="panel padded workbench-fold" id="follow-up" open={!!c.operations.plans.length||!!c.operations.drafts.length}><summary><span>Plan the follow-up<small>{view.operations.options.length?'Compare a response to the modeled cash gap, then review the drafts.':'Recovery plans, action drafts and decision notes stay with the accounting work.'}</small></span><span className="fold-tag">{c.operations.drafts.length?`${c.operations.drafts.length} drafts`:view.operations.options.length?`${view.operations.options.length} options`:'When needed'}</span></summary><FollowUp {...props}/></details>
 <details className="panel padded provider-explainer"><summary>How the tools help with this work</summary><dl><dt>Accounting engine</dt><dd>Calculates reconciliation, forecasts and balanced entries from your records. {close.posted} settlement entries approved.</dd><dt>CREAO · investigator</dt><dd>Examines receivables evidence and returns findings for review. {view.providers.creao==='BLOCKED'?'Hosted access is unavailable in this workspace.':'Available on request; run results appear with the receivables.'}</dd><dt>Claude · reviewer</dt><dd>Explains accounting treatment using checked source references. Runs only when you request a review.</dd><dt>Exa + Coinbase · evidence procurement</dt><dd>Exa supplies public vendor documentation. Coinbase CDP and x402 handle an approved, budgeted USDC purchase. Public documentation does not replace a receipt.</dd><dt>CRS · payment terms check</dt><dd>Official synthetic consumer reports only. A score does not automatically change a business invoice or approve credit.</dd><dt>Convex · shared record</dt><dd>Saves records, decisions and service results so the same workspace can be shared.</dd></dl></details>
 </>;
}
