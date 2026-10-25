import {z} from 'zod';
export const researchChargeSchema=z.object({id:z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),date:z.iso.date(),description:z.string().min(1).max(160),amountCents:z.number().int().positive().max(100_000_000),merchantId:z.enum(['github','figma','paddle']),localEvidence:z.string().max(3000).default('')}).strict();
export const evidenceAuthorizationSchema=z.object({id:z.string().length(64),chargeId:z.string(),amountAtomic:z.number().int().positive().max(10000),sourceVersion:z.number().int(),expiresAt:z.number(),reason:z.string().min(1).max(500),createdAt:z.number()});
export const evidenceStateSchema=z.object({version:z.number().int().positive(),charges:z.array(researchChargeSchema).max(30),authorizations:z.array(evidenceAuthorizationSchema).max(30),requests:z.record(z.string(),z.string())});
export const emptyEvidence=()=>evidenceStateSchema.parse({version:1,charges:[],authorizations:[],requests:{}});
export type ResearchCharge=z.infer<typeof researchChargeSchema>;
export type EvidenceState=z.infer<typeof evidenceStateSchema>;
const expected={expectedEvidenceVersion:z.number().int().positive(),requestKey:z.string().min(8).max(120)};
export const evidenceCommands=[
 z.object({type:z.literal('evidence_add_charge'),...expected,charge:researchChargeSchema}),
 z.object({type:z.literal('evidence_attach_local'),...expected,chargeId:z.string().max(100),text:z.string().min(1).max(3000)}),
 z.object({type:z.literal('evidence_authorize'),...expected,id:z.string().length(64).regex(/^[a-f0-9]+$/),chargeId:z.string().max(100),amountAtomic:z.number().int().positive().max(10000),expiresAt:z.number(),reason:z.string().min(1).max(500)}),
] as const;
export const evidenceCommandSchema=z.discriminatedUnion('type',evidenceCommands);
