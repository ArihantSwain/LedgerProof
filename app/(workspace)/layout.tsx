import FinanceWorkspace from '../components/finance-workspace';

// The layout persists across forecast/workbench navigation, retaining the session.
export default function WorkspaceLayout({children}:{children:React.ReactNode}){
 return <><FinanceWorkspace/>{children}</>;
}
