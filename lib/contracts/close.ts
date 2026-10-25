import {z} from 'zod';
const id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const closeRecordSchema=z.object({id,kind:z.enum(['bank','charge','refund','fee']),date:z.iso.date(),amountCents:z.number().int().positive().max(100_000_000),reference:z.string().max(100)}).strict();
export const closeLineSchema=z.object({account:z.enum(['cash','processor_clearing','processing_fees','customer_refunds']),debitCents:z.number().int().nonnegative(),creditCents:z.number().int().nonnegative()});
export const closeStateSchema=z.object({version:z.number().int().positive(),records:z.array(closeRecordSchema).max(100),postings:z.array(z.object({id:z.string(),bankId:id,batchId:z.string(),sourceIds:z.array(id),sourceVersion:z.number(),lines:z.array(closeLineSchema),reason:z.string(),postedAt:z.number()})).max(50),requests:z.record(z.string(),z.string())});
export type CloseState=z.infer<typeof closeStateSchema>;
export type CloseRecord=z.infer<typeof closeRecordSchema>;
export function emptyClose():CloseState{return {version:1,records:[],postings:[],requests:{}};}
const expected={expectedCloseVersion:z.number().int().positive(),requestKey:z.string().min(8).max(120)};
export const closeCommands=[
 z.object({type:z.literal('close_import'),...expected,records:z.array(closeRecordSchema).min(1).max(100)}),
 z.object({type:z.literal('close_approve'),...expected,bankId:id,batchId:z.string().max(100),reason:z.string().min(1).max(500)}),
] as const;
export const closeCommandSchema=z.discriminatedUnion('type',closeCommands);
