import {redirect} from 'next/navigation';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}){
 const {view}=await searchParams;
 if(view==='pulse'||view==='recovery')redirect('/');
 const anchor=view==='evidence'?'#missing-context':view==='services'?'#accounting-review':view==='actions'||view==='room'?'#follow-up':'';
 redirect('/workbench'+anchor);
}
