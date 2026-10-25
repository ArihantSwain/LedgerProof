import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
// One transactional aggregate per bounded judge workspace. Domain entities are
// runtime-validated by caseSchema before every write; never accept opaque client state.
export default defineSchema({
  providerSessions:defineTable({key:v.string(),provider:v.literal('crs'),sealed:v.string(),expiresAt:v.number()}).index('by_key',['key']),
  paymentReceipts:defineTable({receiptKey:v.string(),jobKey:v.string(),caseId:v.string(),amountAtomic:v.number(),asset:v.string(),transaction:v.string(),createdAt:v.number()}).index('by_receiptKey',['receiptKey']),
  providerBudgets:defineTable({provider:v.string(),chargedMicros:v.number(),reservedMicros:v.number(),calls:v.number()}).index('by_provider',['provider']),
  providerJobs:defineTable({key:v.string(),provider:v.string(),caseId:v.string(),state:v.union(v.literal('pending'),v.literal('completed'),v.literal('failed'),v.literal('unknown')),reservedMicros:v.number(),chargedMicros:v.number(),createdAt:v.number(),result:v.optional(v.any()),error:v.optional(v.string())}).index('by_key',['key']).index('by_caseId',['caseId']).index('by_provider',['provider']),
  cases:defineTable({caseId:v.string(),tokenHash:v.string(),expiresAt:v.number(),revision:v.number(),state:v.any()}).index('by_case',['caseId']).index('by_expiry',['expiresAt']),
  files:defineTable({caseId:v.string(),documentId:v.string(),storageId:v.id('_storage')}).index('by_case_document',['caseId','documentId']),
});
