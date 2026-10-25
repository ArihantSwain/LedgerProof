'use client';
import {useEffect} from 'react';
import Link from 'next/link';
import {ClaudeReview,CrsReview} from '../operations/accounting-panels';
import {EvidenceBuyer} from '../operations/evidence-buyer';
import {ReceivablesReview} from './receivables-review';
import {FollowUp} from './follow-up';
import type {WorkspaceProps} from './finance-workspace';

export function AccountingWorkbench(props:WorkspaceProps){
 const {view,api,run,onChange,busy}=props,c=view.case;
 useEffect(()=>{const id=location.hash.slice(1);const target=id&&document.getElementById(id);if(target instanceof HTMLDetailsElement){target.open=true;target.scrollIntoView();}},[]);
 return <fieldset className="workbench-fields" disabled={busy}><div className="workbench-guide"><div><b>1</b><span>Check the records<small>Invoices, payments and bills</small></span></div><div><b>2</b><span>Find the cause<small>Follow the money to its source</small></span></div><div><b>3</b><span>Choose a next step<small>Review changes and save actions</small></span></div></div>
 <section className="panel padded"><div className="import-records-heading"><div><h2>Add your own records</h2><p>Invoices, receipts, spreadsheets or documents. Preview before importing.</p></div><Link className="primary page-action" href="/import">Import business data ↗</Link></div></section>
 <ReceivablesReview {...props}/>
 <details className="panel padded workbench-fold" id="accounting-review"><summary><span>Accounting review<small>Understand the findings and proposed corrections.</small></span><span className="fold-tag">AI review</span></summary><ClaudeReview c={c} api={api} run={run} busy={busy}/></details>
 <details className="panel padded workbench-fold" id="missing-context"><summary><span>Find missing vendor context<small>Check an unfamiliar charge against official vendor information.</small></span><span className="fold-tag">Optional evidence</span></summary><EvidenceBuyer c={c} api={api} run={run} onChange={onChange} busy={busy}/></details>
 <details className="panel padded workbench-fold" id="payment-terms"><summary><span>Check payment terms<small>Look up a fictional customer’s credit report.</small></span><span className="fold-tag">Sandbox check</span></summary><CrsReview c={c} providers={view.providers} api={api} run={run} busy={busy}/></details>
 <details className="panel padded workbench-fold" id="follow-up" open={!!c.operations.comments.length}><summary><span>Notes and suggested actions<small>Get next steps and keep your decisions here.</small></span><span className="fold-tag">Next steps</span></summary><FollowUp {...props}/></details>
 <details className="panel padded provider-explainer"><summary>How the tools help with this work</summary><dl><dt>Accounting engine</dt><dd>Calculates balances, forecasts and balanced entries from your records.</dd><dt>Our investigator · powered by CREAO</dt><dd>Examines receivables evidence and returns findings for review. {view.providers.creao==='BLOCKED'?'Hosted access is unavailable in this workspace.':'Available on request; run results appear with the receivables.'}</dd><dt>Claude · reviewer</dt><dd>Explains accounting treatment using checked source references. Runs only when you request a review.</dd><dt>Exa + Coinbase · evidence procurement</dt><dd>Exa supplies public vendor documentation. Coinbase CDP and x402 handle an approved, budgeted USDC purchase. Public documentation does not replace a receipt.</dd><dt>CRS · payment terms check</dt><dd>Official synthetic consumer reports only. A score does not automatically change a business invoice or approve credit.</dd><dt>Convex · shared record</dt><dd>Saves records, decisions and service results so the same workspace can be shared.</dd></dl></details>
 </fieldset>;
}
