// Monetary reservations, not a rate limiter. Unknown outcomes keep their whole
// reservation. Limits are deliberately below the user's $50 available credits.
export const CLAUDE_CAP_MICROS=5_000_000;
export const CLAUDE_RESERVATION_MICROS=100_000;
export const CLAUDE_CALL_CAP=50;
export function reserveBudget(account:{chargedMicros:number;reservedMicros:number;calls:number},provider:string,reserve:number){
 const cap=provider==='anthropic'?CLAUDE_CAP_MICROS:['coinbase','x402_evidence'].includes(provider)?100_000:0;
 const callCap=provider==='anthropic'?CLAUDE_CALL_CAP:['coinbase','x402_evidence'].includes(provider)?10:5;
 if(!Number.isSafeInteger(reserve)||reserve<0||reserve>100_000)throw Error('Invalid spending reservation');
 if(account.chargedMicros+account.reservedMicros+reserve>cap||account.calls>=callCap)throw Error('Provider spending or request cap reached; cached results remain available');
 return {...account,reservedMicros:account.reservedMicros+reserve,calls:account.calls+1};
}
