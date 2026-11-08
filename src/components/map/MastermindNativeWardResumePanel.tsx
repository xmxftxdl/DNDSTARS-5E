import{useEffect,useState}from'react'
import DiceOverlayPortal from'../DiceOverlayPortal'
import{listMastermindNativeWardResumeParents}from'../../pages/maps/mastermindNativeWardResume'
export default function MastermindNativeWardResumePanel({mapId,onResume}:{mapId:string;onResume:(parentId:string)=>Promise<void>}){
 const[parents,setParents]=useState<string[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 useEffect(()=>{let alive=true;void listMastermindNativeWardResumeParents(mapId).then(rows=>{if(alive)setParents(rows)}).catch(()=>{if(alive)setParents([])});return()=>{alive=false}},[mapId]);
 if(!parents.length)return null
 const resume=async(parent:string)=>{if(busy)return;setBusy(true);setNotice('');try{await onResume(parent);setParents(rows=>rows.filter(id=>id!==parent))}catch{setNotice('原攻击未完成或当前来源已变化，请检查后重试。')}finally{setBusy(false)}}
 return <DiceOverlayPortal layer="confirmation"><section aria-label="恢复怪物原攻击" className="pointer-events-auto fixed bottom-24 left-4 max-w-sm space-y-2 rounded-xl border border-sky-400/40 bg-slate-950/95 p-4 text-sm text-slate-200"><p>存在尚未完成的原攻击。继续会恢复已保存的原骰与选择。</p>{parents.map(parent=><button key={parent} type="button" data-action-id="mastermind-native-ward-resume" data-parent-id={parent} disabled={busy} onClick={()=>void resume(parent)} className="block rounded bg-sky-800 px-3 py-2 disabled:opacity-40">继续原攻击</button>)}{notice&&<p role="status">{notice}</p>}</section></DiceOverlayPortal>
}
