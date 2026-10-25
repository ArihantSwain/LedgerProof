'use client';
export default function GlobalError({retry}:{retry:()=>void}){
 return <html lang="en"><body style={{fontFamily:'Arial, sans-serif',background:'#f7f8f4',color:'#23332d',padding:'10vh 8vw'}}><h1>Let’s reopen LedgerProof.</h1><p>The page could not finish loading. Reload it to check your saved workspace.</p><button onClick={()=>retry()} style={{padding:'12px 20px',marginRight:20}}>Reload workspace</button><a href="/">Return to the demo</a></body></html>;
}
