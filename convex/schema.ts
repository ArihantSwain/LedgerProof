import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
// One transactional aggregate per bounded judge workspace. Domain entities are
// runtime-validated by caseSchema before every write; never accept opaque client state.
export default defineSchema({
  cases:defineTable({caseId:v.string(),tokenHash:v.string(),expiresAt:v.number(),revision:v.number(),state:v.any()}).index('by_case',['caseId']).index('by_expiry',['expiresAt']),
  files:defineTable({caseId:v.string(),documentId:v.string(),storageId:v.id('_storage')}).index('by_case_document',['caseId','documentId']),
});
