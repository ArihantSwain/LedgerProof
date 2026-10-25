import { z } from 'zod';
import { operationsSchema, operationsCommands, emptyOperations } from './operations';
import {closeStateSchema,closeCommands,emptyClose} from './close';
import {evidenceStateSchema,evidenceCommands,emptyEvidence} from './evidence';

export const cents = z.number().int().safe().min(0).max(1_000_000_000_00);
export const date = z.iso.date();
const id = z.string().min(1).max(120);
export const invoiceSchema = z.object({id, number:id, counterparty:z.string().max(100), amountCents:cents, issueDate:date, dueDate:date, expectedDate:date, evidenceId:id});
export const documentSchema = z.object({id, filename:z.string().max(160), mime:z.string(), sha256:z.string(), text:z.string().max(100_000), uploadedAt:z.number(), kind:z.enum(['invoice','credit_note','bank','ledger']), storageRef:z.string().optional()});
export const receiptSchema = z.object({id, invoiceId:id, amountCents:cents, date, evidenceId:id, posted:z.boolean()});
export const creditSchema = z.object({id, invoiceId:id, amountCents:cents.positive(), date, evidenceId:id, approved:z.boolean()});
export const obligationSchema = z.object({id, date, amountCents:cents, category:z.enum(['payroll','expense']), description:z.string()});
export const account = z.enum(['cash','accounts_receivable','service_revenue','sales_returns','payroll_expense','operating_expense','opening_equity']);
export const lineSchema = z.object({account, debitCents:cents, creditCents:cents});
export const entrySchema = z.object({id, sourceReference:id, effectiveDate:date, lines:z.array(lineSchema).min(2), reversalReference:z.string().optional()});
export const findingSchema = z.object({id:id.optional(), type:z.enum(['duplicate_invoice','unapplied_credit_note','unmatched_receipt','partial_payment','inconsistent_amount','collection_risk_evidence','insufficient_evidence']), affectedRecordIds:z.array(id).min(1).max(30), evidenceRefs:z.array(id).min(1).max(30), explanation:z.string().min(1).max(3000), certaintyLabel:z.enum(['supported','possible','insufficient']), proposedAction:z.enum(['review_duplicate','review_credit_application','review_receipt_match','review_collection_scenario','request_evidence']), needsHumanReview:z.literal(true)});
export const resultSchema = z.object({schemaVersion:z.literal('1'), inputVersion:z.number().int().positive(), findings:z.array(findingSchema).max(50), missingEvidence:z.array(z.string().max(500)).max(50), summary:z.string().max(5000)}).strict();
export type Finding = z.infer<typeof findingSchema> & {id:string};
export type AgentResult = z.infer<typeof resultSchema>;
export type Entry = z.infer<typeof entrySchema>;
export const runSchema = z.object({id, inputVersion:z.number(), generation:z.number(), state:z.enum(['queued','submitted','running','validating','needs_review','completed','retry_scheduled','failed','blocked','unknown','stale']), mode:z.enum(['CREAO','LOCAL_REHEARSAL']), sourceVersions:z.object({ledgerVersion:z.number().int(),operationsVersion:z.number().int(),closeVersion:z.number().int()}).optional(), providerRunId:z.string().optional(), startedAt:z.number(), error:z.string().optional(), result:resultSchema.optional(), challenge:z.string().optional()});
export const proposalSchema = z.object({id, findingId:id, targetId:id, kind:z.enum(['credit','receipt','duplicate']), amountCents:cents, baseLedgerVersion:z.number(), status:z.enum(['pending','approved','rejected']), entry:entrySchema});
export const eventSchema = z.object({id, action:z.string(), targetId:z.string(), timestamp:z.number(), beforeVersion:z.number(), afterVersion:z.number(), reason:z.string(), actor:z.literal('demo-reviewer')});
export const caseSchema = z.object({
  evidencePurchases:evidenceStateSchema.default(emptyEvidence()),
  close: closeStateSchema.default(emptyClose()),
  operations: operationsSchema.default(emptyOperations()),
  id, generation:z.number().int(), createdAt:z.number(), expiresAt:z.number(), mode:z.enum(['LOCAL_REHEARSAL','CONVEX']), business:z.object({id, displayName:z.string(), currency:z.literal('USD'), timezone:z.literal('America/Los_Angeles'), openingCashCents:cents, startDate:date}),
  inputVersion:z.number().int(), ledgerVersion:z.number().int(), revision:z.number().int(), invoices:z.array(invoiceSchema), receipts:z.array(receiptSchema), credits:z.array(creditSchema), documents:z.array(documentSchema), obligations:z.array(obligationSchema), entries:z.array(entrySchema),
  scenarios:z.array(z.object({invoiceId:id, expectedDate:date, expectedAmountCents:cents.optional(), reason:z.string().max(500)})),
  findings:z.array(findingSchema.extend({id})), proposals:z.array(proposalSchema), runs:z.array(runSchema), events:z.array(eventSchema),
  decisions:z.record(z.string(),z.object({proposalId:id,status:z.enum(['approved','rejected']),reason:z.string()})),
});
export type Case = z.infer<typeof caseSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Run = z.infer<typeof runSchema>;
export const commandSchema = z.discriminatedUnion('type',[
  ...evidenceCommands,
  ...closeCommands,
  ...operationsCommands,
  z.object({type:z.literal('reset')}),
  z.object({type:z.literal('edit_invoice'),invoiceId:id,amountCents:cents.positive()}),
  z.object({type:z.literal('scenario'),invoiceId:id,expectedDate:date,expectedAmountCents:cents.optional(),reason:z.string().min(1).max(500)}),
  z.object({type:z.literal('upload_credit'),document:documentSchema,credit:creditSchema}),
  z.object({type:z.literal('upload_receipt'),document:documentSchema,receipt:receiptSchema}),
  z.object({type:z.literal('decision'),proposalId:id,status:z.enum(['approved','rejected']),expectedLedgerVersion:z.number().int(),requestKey:z.string().min(8).max(120),reason:z.string().min(1).max(500)}),
  z.object({type:z.literal('start_run'),run:runSchema}),
  z.object({type:z.literal('update_run'),runId:id,generation:z.number(),patch:runSchema.partial()}),
  z.object({type:z.literal('apply_result'),runId:id,generation:z.number(),result:resultSchema}),
]);
export type Command = z.infer<typeof commandSchema>;
