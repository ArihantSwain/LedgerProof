import {z} from 'zod';
export const importKindSchema=z.enum(['invoice','receipt','credit','obligation','bank','charge','refund','fee']);
export const importRowSchema=z.object({id:z.string().min(1).max(80),kind:importKindSchema,sourceId:z.string().min(1).max(120),number:z.string().max(120),counterparty:z.string().max(100),date:z.string().max(30),dueDate:z.string().max(30),amountCents:z.number().int().safe().min(0).max(100_000_000_000),reference:z.string().max(120),description:z.string().max(500)});
export type ImportRow=z.infer<typeof importRowSchema>;
export const importSourceSchema=z.object({id:z.string().min(1).max(120),filename:z.string().max(160),mime:z.string().max(150),sha256:z.string().regex(/^[a-f0-9]{64}$/),text:z.string().max(100_000),storageRef:z.string().max(200).optional(),proof:z.string().regex(/^[a-f0-9]{64}$/).optional()});
export const importPayloadSchema=z.object({rows:z.array(importRowSchema).min(1).max(200),sources:z.array(importSourceSchema).min(1).max(10),businessName:z.string().trim().min(1).max(100),openingCashCents:z.number().int().safe().nonnegative().max(100_000_000_000),startDate:z.iso.date(),mode:z.enum(['replace','append']),expectedRevision:z.number().int().positive().optional()});
export const importCommandSchema=importPayloadSchema.extend({type:z.literal('import_workspace'),expectedRevision:z.number().int().positive(),requestKey:z.string().regex(/^[a-f0-9]{64}$/)});
export type ImportCommand=z.infer<typeof importCommandSchema>;
