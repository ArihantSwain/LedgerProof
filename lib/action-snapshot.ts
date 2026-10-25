import type {Case} from './contracts';
export function actionSnapshot(c:Case){return {generation:c.generation,inputVersion:c.inputVersion,ledgerVersion:c.ledgerVersion,operationsVersion:c.operations.version,evidenceVersion:c.evidencePurchases.version,lastRunId:c.runs.filter(r=>r.result).at(-1)?.id??null};}
export function actionSnapshotMatches(raw:unknown,c:Case){if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;return Object.entries(actionSnapshot(c)).every(([key,value])=>(raw as Record<string,unknown>)[key]===value);}
