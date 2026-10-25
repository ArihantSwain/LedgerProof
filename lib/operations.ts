import type { Case } from './contracts';
import { emptyOperations, type RecoveryAction, type OperationsCommand, type RecoveryPlan } from './contracts/operations';
import { forecast, outstanding, plusDays, dayNumber, money } from './finance';

export function stressedCase(original: Case): Case {
  const c = structuredClone(original);
  for (const shock of (c.operations ?? emptyOperations()).shocks) {
    if (shock.kind === 'collection_delay') {
      if (!c.invoices.some(i => i.id === shock.invoiceId)) throw Error('Shock invoice no longer exists');
      c.scenarios = c.scenarios.filter(s => s.invoiceId !== shock.invoiceId);
      c.scenarios.push({ invoiceId: shock.invoiceId!, expectedDate: shock.date, reason: 'Hypothetical disruption: ' + shock.label });
    } else c.obligations.push({ id: shock.id, date: shock.date, amountCents: shock.amountCents!, category: 'expense', description: 'Hypothetical: ' + shock.label });
  }
  return c;
}

export function projectOperations(original: Case, actions: RecoveryAction[] = []) {
  const c = stressedCase(original);
  const collections = new Map<string, Extract<RecoveryAction, {kind:'collect'}>>();
  const changedExpenses = new Set<string>();
  for (const action of actions) {
    if (action.kind === 'collect') {
      const inv = c.invoices.find(i => i.id === action.invoiceId);
      if (!inv || collections.has(inv.id) || action.amountCents > outstanding(c, inv.id)) throw Error('Invalid or duplicate collection allocation');
      const currentDate = c.scenarios.find(s => s.invoiceId === inv.id)?.expectedDate ?? inv.expectedDate;
      if (action.date >= currentDate || action.date < c.business.startDate) throw Error('Recovery collection must be inside the horizon and earlier than the current assumption');
      collections.set(inv.id, action);
    } else {
      const ob = c.obligations.find(o => o.id === action.obligationId);
      if (!ob || ob.category === 'payroll' || changedExpenses.has(ob.id)) throw Error('Payroll cannot be deferred or reduced; expense changes must be unique');
      changedExpenses.add(ob.id);
      if (action.kind === 'defer_expense') {
        if (action.date <= ob.date || action.date >= plusDays(c.business.startDate, 91)) throw Error('Expense deferral must be later and remain visible within the forecast');
        ob.date = action.date;
      } else {
        if (action.amountCents > ob.amountCents) throw Error('Expense reduction exceeds the actual obligation');
        ob.amountCents -= action.amountCents;
      }
    }
  }
  const result = forecast(c, 'revised', original.operations.reserveCents);
  for (const [invoiceId, action] of collections) {
    // Remove the old forecast allocation, then split it exactly once. The
    // remaining receivable stays at its old collection date; no cash is invented.
    const inv = c.invoices.find(i => i.id === invoiceId)!;
    const oldDate = c.scenarios.find(s => s.invoiceId === invoiceId)?.expectedDate ?? inv.expectedDate;
    const oldAmount = c.scenarios.find(s => s.invoiceId === invoiceId)?.expectedAmountCents ?? outstanding(c, invoiceId);
    if (action.amountCents > oldAmount) throw Error('Recovery exceeds the explicitly modeled collection amount');
    for (const w of result.weeks) {
      const removed = w.contributions.filter(x => x.id === invoiceId).reduce((s,x) => s+x.amountCents,0);
      w.receiptsCents -= removed; w.contributions = w.contributions.filter(x => x.id !== invoiceId);
    }
    result.outside = result.outside.filter(x => x.id !== invoiceId);
    for (const [date, amount, label] of [[action.date, action.amountCents, 'Conditional collection'], [oldDate, oldAmount-action.amountCents, 'Remaining collection']] as const) {
      if (!amount) continue;
      const idx = Math.floor((dayNumber(date)-dayNumber(c.business.startDate))/7);
      if (idx >= 13) result.outside.push({id: invoiceId, date, amountCents:amount, reason:label+' outside horizon'});
      else {
        const w = result.weeks[Math.max(0,idx)]; w.receiptsCents += amount;
        w.contributions.push({ id:invoiceId, label:label+' · '+inv.number, date:idx<0?c.business.startDate:date, amountCents:amount });
      }
    }
  }
  let cash = result.weeks[0].openingCents;
  for (const w of result.weeks) { w.openingCents=cash; cash+=w.receiptsCents-w.obligationsCents; w.closingCents=cash; }
  result.firstShortfallDate=result.weeks.find(w=>w.closingCents<result.reserveCents)?.start??null;
  const flows = result.weeks.flatMap(w=>w.contributions).map(flow=>({...flow,date:flow.date<c.business.startDate?c.business.startDate:flow.date})).sort((a,b)=>a.date.localeCompare(b.date));
  const days = [...new Set(flows.map(x=>x.date))]; let dailyCash=result.weeks[0].openingCents;
  const daily=days.map(date=>{const movements=flows.filter(x=>x.date===date);const openingCents=dailyCash;dailyCash+=movements.reduce((s,x)=>s+x.amountCents,0);return {date,openingCents,closingCents:dailyCash,movements};});
  const payroll=c.obligations.filter(o=>o.category==='payroll').map(o=>({id:o.id,date:o.date,amountCents:o.amountCents,cashAfterCents:daily.find(d=>d.date===o.date)?.closingCents??0,covered:(daily.find(d=>d.date===o.date)?.closingCents??0)>=original.operations.reserveCents}));
  return {...result,daily,payroll,minimumCashCents:Math.min(...result.weeks.map(w=>w.closingCents),...daily.map(d=>d.closingCents)),assumptionsOnly:true as const};
}

export function planIsCurrent(c:Case,p:RecoveryPlan) { return p.inputVersion===c.inputVersion&&p.ledgerVersion===c.ledgerVersion&&p.operationsVersion===c.operations.version; }
export function recoveryOptions(c:Case) {
  const stressed=projectOperations(c); const short=stressed.daily.find(d=>d.closingCents<c.operations.reserveCents);
  if(!short) return [];
  const targetDate=short.date;
  const gap=c.operations.reserveCents-stressed.minimumCashCents;
  const sc=stressedCase(c);
  const eligible=c.invoices.filter(i=>outstanding(c,i.id)>0&&(sc.scenarios.find(s=>s.invoiceId===i.id)?.expectedDate??i.expectedDate)>targetDate).sort((a,b)=>outstanding(c,b.id)-outstanding(c,a.id));
  const inv=eligible[0];
  type Option={id:string;title:string;description:string;tradeoff:string;actions:RecoveryAction[]};
  const options:Option[]=[];
  if(inv){
    const allowed=sc.scenarios.find(s=>s.invoiceId===inv.id)?.expectedAmountCents??outstanding(c,inv.id);
    if(allowed>0){
      options.push({id:'collect-full',title:'Bring forward the full collection',description:`Request ${money(allowed)} from ${inv.counterparty} by ${targetDate}.`,tradeoff:'Requires customer agreement. No cash is guaranteed, and the contractual due date is unchanged.',actions:[{kind:'collect',invoiceId:inv.id,amountCents:allowed,date:targetDate}]});
      options.push({id:'split-collection',title:'Negotiate a partial collection',description:`Request ${money(Math.min(gap,allowed))} now and leave the remainder at its existing expected date.`,tradeoff:'Less immediate customer pressure, but the plan only works if that installment arrives.',actions:[{kind:'collect',invoiceId:inv.id,amountCents:Math.min(gap,allowed),date:targetDate}]});
    }
  }
  const expense=sc.obligations.filter(o=>o.category==='expense'&&o.date<=targetDate&&o.amountCents>0).sort((a,b)=>b.amountCents-a.amountCents)[0];
  if(expense){
    const defer:RecoveryAction={kind:'defer_expense',obligationId:expense.id,date:plusDays(expense.date,21)};
    if(defer.date<plusDays(c.business.startDate,91)){
      const deferred=projectOperations(c,[defer]);const residual=Math.max(0,c.operations.reserveCents-deferred.minimumCashCents);
      const actions:RecoveryAction[]=[defer];
      if(inv&&residual>0){const available=sc.scenarios.find(s=>s.invoiceId===inv.id)?.expectedAmountCents??outstanding(c,inv.id);if(available>0)actions.push({kind:'collect',invoiceId:inv.id,amountCents:Math.min(residual,available),date:targetDate});}
      options.push({id:'vendor-and-collection',title:'Negotiate vendor timing + collect less',description:`Request a later date for ${expense.description.toLowerCase()}, with a smaller customer installment where needed.`,tradeoff:'Vendor consent is required. The bill remains owed and stays visible later in the forecast; payroll is never deferred.',actions});
    }
  }
  const software=sc.obligations.find(o=>o.category==='expense'&&/software|subscription/i.test(o.description)&&o.amountCents>0);
  if(software)options.push({id:'reduce-discretionary',title:'Reduce discretionary spending',description:`Model cancelling ${money(software.amountCents)} of software spend.`,tradeoff:'May affect operations and may not solve the immediate payroll gap. Cancellation/refund terms are unverified.',actions:[{kind:'reduce_expense',obligationId:software.id,amountCents:software.amountCents}]});
  return options.map(o=>{const projected=projectOperations(c,o.actions);return {...o,projected,improvementCents:projected.minimumCashCents-stressed.minimumCashCents,resolvesGap:projected.minimumCashCents>=c.operations.reserveCents};});
}

export function operationsSummary(c:Case) {
  const stressed=projectOperations(c);const active=c.operations.plans.find(p=>p.status==='approved'&&planIsCurrent(c,p));
  const current=active?projectOperations(c,active.actions):stressed;
  const invoices=c.invoices.map(i=>({...i,outstandingCents:outstanding(c,i.id),daysPastDue:Math.max(0,dayNumber(c.business.startDate)-dayNumber(i.dueDate)),sourceLinked:c.documents.some(d=>d.id===i.evidenceId)}));
  const issues:{type:string;label:string;targetId:string;evidenceIds:string[]}[]=[];
  for(const r of c.receipts.filter(r=>!r.posted))issues.push({type:'unmatched_receipt',label:`Unmatched receipt: ${money(r.amountCents)}`,targetId:r.id,evidenceIds:[r.evidenceId]});
  for(const cr of c.credits.filter(cr=>!cr.approved))issues.push({type:'unapplied_credit',label:`Unapplied credit: ${money(cr.amountCents)}`,targetId:cr.id,evidenceIds:[cr.evidenceId]});
  for(const i of invoices.filter(i=>!i.sourceLinked))issues.push({type:'missing_source',label:`Missing source for ${i.number}`,targetId:i.id,evidenceIds:[]});
  const seen=new Map<string,string>();for(const e of c.entries){if(e.reversalReference)continue;const sig=JSON.stringify([e.sourceReference,e.effectiveDate,e.lines]);if(seen.has(sig)&&!c.entries.some(r=>r.reversalReference===e.id))issues.push({type:'duplicate_posting',label:'Repeated ledger posting requires review',targetId:e.id,evidenceIds:[e.sourceReference]});seen.set(sig,e.id);}
  return {stressed,current,activePlanId:active?.id??null,options:recoveryOptions(c),invoices,issues,
    outstandingCents:invoices.reduce((s,i)=>s+i.outstandingCents,0),
    obligations:stressedCase(c).obligations,
    draftsPending:c.operations.drafts.filter(d=>d.status==='draft').length,
    seats:[{name:'Controller',job:'Reconcile source records and prepare reviewable corrections',mode:'DETERMINISTIC_DIAGNOSTICS + CREAO_WHEN_CONFIGURED'},{name:'Treasury planner',job:'Calculate payroll exposure and compare conditional recovery plans',mode:'DETERMINISTIC'},{name:'Collections coordinator',job:'Prepare source-linked collection and negotiation drafts',mode:'TEMPLATED_DRAFTS'},{name:'Owner / bookkeeper',job:'Challenge, approve and track decisions',mode:'HUMAN_REVIEW'}]};
}

function prepareDrafts(c:Case,p:RecoveryPlan,now:number) {
  return p.actions.flatMap<Case['operations']['drafts'][number]>((a,index)=>{
    const common={id:`draft-${p.id}-${index}`,planId:p.id,status:'draft' as const,createdAt:now};
    if(a.kind==='collect'){
      const inv=c.invoices.find(i=>i.id===a.invoiceId)!;const remaining=outstanding(c,inv.id)-a.amountCents;
      return [{...common,kind:remaining>0?'payment_plan' as const:'collection_message' as const,recipient:inv.counterparty+' (contact not connected)',subject:`Payment timing request · ${inv.number}`,body:`Hello ${inv.counterparty},\n\nOur records show ${money(outstanding(c,inv.id))} outstanding on ${inv.number}. Could you confirm whether ${money(a.amountCents)} can be collected by ${a.date}?${remaining>0?` The remaining ${money(remaining)} would stay on the existing collection assumption until we agree otherwise.`:''}\n\nPlease let us know if a remittance or credit is missing so we can reconcile it. This is a proposed arrangement, not a statement that you have agreed.\n\nThank you,\nCedar & Co. finance team`,sourceIds:[inv.evidenceId]}];
    }
    const ob=stressedCase(c).obligations.find(o=>o.id===a.obligationId)!;
    return [{...common,kind:a.kind==='defer_expense'?'vendor_request' as const:'internal_task' as const,recipient:a.kind==='defer_expense'?'Vendor contact (not connected)':'Bookkeeper / owner',subject:a.kind==='defer_expense'?`Payment-date discussion · ${ob.description}`:`Review discretionary spend · ${ob.description}`,body:a.kind==='defer_expense'?`Please review a request to move ${money(ob.amountCents)} for ${ob.description} from ${ob.date} to ${a.date}. No change is agreed until the vendor confirms; the full obligation remains in the forecast. Do not delay payroll or send this without review.`:`Check cancellation terms and operational impact before reducing ${money(a.amountCents)} of ${ob.description}. This task does not cancel a service or alter an actual bill.`,sourceIds:[ob.id]}];
  });
}

export function applyOperations(c:Case,cmd:OperationsCommand,now:number) {
  const op=c.operations;const signature=JSON.stringify(cmd);
  if(op.requests[cmd.requestKey]){if(op.requests[cmd.requestKey]!==signature)throw Error('Operations idempotency key reused');return false;}
  if(Object.keys(op.requests).length>=250)throw Error('Workspace operation limit reached; reset the demo');
  if('expectedOperationsVersion' in cmd&&cmd.expectedOperationsVersion!==op.version)throw Error('Planning inputs changed; refresh before deciding');
  if('expectedInputVersion' in cmd&&(cmd.expectedInputVersion!==c.inputVersion||cmd.expectedLedgerVersion!==c.ledgerVersion))throw Error('Evidence or ledger changed; refresh before deciding');
  if(cmd.type==='ops_shock'){
    if(op.shocks.length>=20)throw Error('Shock limit reached');
    if(cmd.date<c.business.startDate||cmd.date>=plusDays(c.business.startDate,91))throw Error('Shock date must be within the 13-week horizon');
    if(cmd.kind==='collection_delay'){
      const i=c.invoices.find(i=>i.id===cmd.invoiceId);if(!i)throw Error('Unknown invoice');
      const prior=stressedCase(c).scenarios.find(s=>s.invoiceId===i.id)?.expectedDate??i.expectedDate;
      if(cmd.date<=prior)throw Error('A collection delay must be later than the existing collection assumption');
      op.shocks=op.shocks.filter(s=>!(s.kind==='collection_delay'&&s.invoiceId===i.id));
    }else if(!cmd.amountCents)throw Error('Unexpected expense needs a positive amount');
    op.shocks.push({id:`shock-${c.generation}-${c.revision}`,kind:cmd.kind,invoiceId:cmd.invoiceId,amountCents:cmd.amountCents,date:cmd.date,label:cmd.label,createdAt:now});op.version++;
  }
  if(cmd.type==='ops_clear_shocks'){op.shocks=[];op.version++;}
  if(cmd.type==='ops_reserve'){op.reserveCents=cmd.amountCents;op.version++;}
  if(cmd.type==='ops_save_plan'){
    if(op.plans.length>=30)throw Error('Plan limit reached');
    const option=recoveryOptions(c).find(o=>o.id===cmd.optionId);if(!option)throw Error('Recovery option is no longer available');
    op.plans.push({id:`plan-${c.generation}-${c.revision}`,optionId:option.id,title:option.title,description:option.description,tradeoff:option.tradeoff,actions:option.actions,inputVersion:c.inputVersion,ledgerVersion:c.ledgerVersion,operationsVersion:op.version,status:'proposed',createdAt:now});
  }
  if(cmd.type==='ops_plan_decision'){
    const p=op.plans.find(p=>p.id===cmd.planId);if(!p)throw Error('Unknown plan');
    if(!planIsCurrent(c,p))throw Error('Plan is stale; regenerate it against current evidence and shocks');
    if(p.status==='rejected'||p.status===cmd.status)throw Error('Plan already decided');
    if(cmd.status==='approved'){
      if(op.plans.some(other=>other.id!==p.id&&other.status==='approved'&&planIsCurrent(c,other)))throw Error('A recovery plan is already active; withdraw it first');
      projectOperations(c,p.actions);if(op.drafts.length+p.actions.length>100)throw Error('Draft limit reached');op.drafts.push(...prepareDrafts(c,p,now));
    } else for(const d of op.drafts.filter(d=>d.planId===p.id)){d.status='rejected';d.reason='Plan withdrawn: '+cmd.reason;}
    p.status=cmd.status;p.reason=cmd.reason;
  }
  if(cmd.type==='ops_draft_decision'){
    const d=op.drafts.find(d=>d.id===cmd.draftId);if(!d)throw Error('Unknown action draft');
    const p=op.plans.find(p=>p.id===d.planId);if(!p||p.status!=='approved'||!planIsCurrent(c,p))throw Error('Draft belongs to a stale or inactive recovery plan');
    if(d.status!=='draft')throw Error('Draft already decided');d.status=cmd.status;d.reason=cmd.reason;
  }
  if(cmd.type==='ops_edit_draft'){
    const d=op.drafts.find(d=>d.id===cmd.draftId);if(!d||d.status!=='draft')throw Error('Only a pending draft can be edited');
    const p=op.plans.find(p=>p.id===d.planId);if(!p||p.status!=='approved'||!planIsCurrent(c,p))throw Error('Draft plan is stale or inactive');
    d.recipient=cmd.recipient;d.subject=cmd.subject;d.body=cmd.body;
  }
  if(cmd.type==='ops_comment'){
    if(op.comments.length>=100)throw Error('Decision room message limit reached');
    op.comments.push({id:`comment-${c.generation}-${c.revision}`,role:cmd.role,text:cmd.text,createdAt:now});
  }
  op.requests[cmd.requestKey]=signature;return true;
}
