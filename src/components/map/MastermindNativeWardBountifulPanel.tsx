import{useEffect,useState}from'react'
import DiceOverlayPortal from'../DiceOverlayPortal'
import{subscribeSharedResourceInvalidation}from'../../composition/browserSharedRoomResources'
import{listMastermindNativeWardBountiful,answerMastermindNativeWardBountiful,type MastermindNativeWardBountifulPrompt}from'../../pages/maps/mastermindNativeWardBountifulChoice'
export default function MastermindNativeWardBountifulPanel({mapId}:{mapId:string}){
 const[rows,setRows]=useState<MastermindNativeWardBountifulPrompt[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const refresh=async()=>{try{setRows(await listMastermindNativeWardBountiful())}catch{setRows([])}}
 useEffect(()=>subscribeSharedResourceInvalidation('mastermind-native-ward-bountifuls',refresh,{immediate:true}),[mapId])
 const pending=rows.find(row=>row.mapId===mapId);if(!pending)return null
 const answer=async(choice:'use'|'decline')=>{if(busy)return;setBusy(true);setNotice('');try{await answerMastermindNativeWardBountiful(pending.id,choice);await refresh()}catch{setNotice('原豁免或当前控制权已改变，请重新查看。')}finally{setBusy(false)}}
 return <DiceOverlayPortal layer="confirmation"><section aria-label="丰厚运势·攻击守卫" className="pointer-events-auto fixed bottom-24 right-4 max-w-sm space-y-3 rounded-xl border border-amber-300/30 bg-slate-950/95 p-4 text-sm text-slate-200"><strong>丰厚运势</strong><p>{pending.actorName??'盟友'}的防护豁免原骰为 1。是否使用反应，让其重新掷这次原骰？</p><div className="flex gap-2"><button type="button" data-action-id="mastermind-native-ward-bountiful-use" disabled={busy} onClick={()=>void answer('use')} className="rounded bg-amber-800 px-3 py-2 disabled:opacity-40">使用反应</button><button type="button" data-action-id="mastermind-native-ward-bountiful-decline" disabled={busy} onClick={()=>void answer('decline')} className="rounded bg-slate-700 px-3 py-2 disabled:opacity-40">放弃</button></div>{notice&&<p role="status">{notice}</p>}</section></DiceOverlayPortal>
}
