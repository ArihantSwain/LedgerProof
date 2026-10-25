import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'LedgerProof · Know what cash you can count on',description:'Evidence-backed receivables investigation and a reviewable 13-week cash outlook.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
