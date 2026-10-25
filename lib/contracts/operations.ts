import { z } from 'zod';

const id = z.string().min(1).max(120);
const cents = z.number().int().safe().nonnegative().max(100_000_000_000);
const date = z.iso.date();
export const recoveryActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('collect'), invoiceId: id, amountCents: cents.positive(), date }),
  z.object({ kind: z.literal('defer_expense'), obligationId: id, date }),
  z.object({ kind: z.literal('reduce_expense'), obligationId: id, amountCents: cents.positive() }),
]);
export type RecoveryAction = z.infer<typeof recoveryActionSchema>;
export const shockSchema = z.object({
  id, kind: z.enum(['collection_delay', 'unexpected_expense']), label: z.string().min(1).max(160),
  invoiceId: id.optional(), amountCents: cents.optional(), date, createdAt: z.number(),
});
export const recoveryPlanSchema = z.object({
  id, optionId: id, title: z.string(), description: z.string(), tradeoff: z.string(),
  actions: z.array(recoveryActionSchema).min(1).max(12),
  inputVersion: z.number().int(), ledgerVersion: z.number().int(), operationsVersion: z.number().int(),
  status: z.enum(['proposed', 'approved', 'rejected']), createdAt: z.number(), reason: z.string().optional(),
});
export const actionDraftSchema = z.object({
  id, planId: id, kind: z.enum(['collection_message', 'payment_plan', 'vendor_request', 'internal_task']),
  recipient: z.string(), subject: z.string(), body: z.string(), sourceIds: z.array(id),
  status: z.enum(['draft', 'approved', 'rejected']), createdAt: z.number(), reason: z.string().optional(),
});
export const operationsSchema = z.object({
  version: z.number().int().positive().default(1), reserveCents: cents.default(0),
  shocks: z.array(shockSchema).max(20).default([]),
  plans: z.array(recoveryPlanSchema).max(30).default([]),
  drafts: z.array(actionDraftSchema).max(100).default([]),
  comments: z.array(z.object({ id, role: z.enum(['owner', 'bookkeeper']), text: z.string().min(1).max(2000), createdAt: z.number() })).max(100).default([]),
  requests: z.record(z.string(), z.string()).default({}),
});
export const emptyOperations = () => operationsSchema.parse({});
export type Operations = z.infer<typeof operationsSchema>;
export type RecoveryPlan = z.infer<typeof recoveryPlanSchema>;
const mutation = { requestKey: z.string().min(8).max(120), expectedOperationsVersion: z.number().int().positive(), expectedInputVersion: z.number().int().positive(), expectedLedgerVersion: z.number().int().positive() };
export const operationsCommands = [
  z.object({ type: z.literal('ops_shock'), ...mutation, kind: z.enum(['collection_delay', 'unexpected_expense']), invoiceId: id.optional(), amountCents: cents.positive().optional(), date, label: z.string().min(1).max(160) }),
  z.object({ type: z.literal('ops_clear_shocks'), ...mutation }),
  z.object({ type: z.literal('ops_reserve'), ...mutation, amountCents: cents }),
  z.object({ type: z.literal('ops_save_plan'), ...mutation, optionId: id }),
  z.object({ type: z.literal('ops_plan_decision'), ...mutation, planId: id, status: z.enum(['approved', 'rejected']), reason: z.string().min(1).max(500) }),
  z.object({ type: z.literal('ops_draft_decision'), ...mutation, draftId: id, status: z.enum(['approved', 'rejected']), reason: z.string().min(1).max(500) }),
  z.object({ type: z.literal('ops_edit_draft'), ...mutation, draftId: id, recipient: z.string().min(1).max(180), subject: z.string().min(1).max(180), body: z.string().min(1).max(4000) }),
  z.object({ type: z.literal('ops_comment'), role: z.enum(['owner', 'bookkeeper']), text: z.string().min(1).max(2000), requestKey: z.string().min(8).max(120) }),
] as const;
export const operationsCommandSchema = z.discriminatedUnion('type', operationsCommands);
export type OperationsCommand = z.infer<typeof operationsCommandSchema>;
