'use client';
export default function ErrorPage({retry}:{retry:()=>void}){
 return <div className="welcome"><div className="welcome-content"><h1>Let’s reopen your workspace.</h1><p>The page could not finish loading. Reload it to check the latest saved records before repeating an action.</p><div className="button-row"><button className="primary" onClick={()=>retry()}>Reload workspace</button><a href="/">Return to the demo</a><a href="/SAMPLES/samples.zip" download>Download example documents</a></div></div></div>;
}
