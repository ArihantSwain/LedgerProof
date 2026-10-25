import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'LedgerProof · Know your books. Know your cash.',description:'Review your accounting evidence and understand your next 13 weeks of cash.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
