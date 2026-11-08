import{useEffect,useState}from'react'
import DiceOverlayPortal from'../DiceOverlayPortal'
import{subscribeSharedResourceInvalidation}from'../../composition/browserSharedRoomResources'
import type{Token}from'../../store/maps'
import{listMastermindNativeWardOutcomes,answerMastermindNativeWardOutcome,type MastermindNativeWardOutcomePrompt}from'../../pages/maps/mastermindNativeWardOutcomeChoice'
/** Only the server-authenticated Host sees choices for its characterless NPC. */
export default function MastermindNativeWardOutcomePanel({mapId,tokens}:{mapId:string;tokens:readonly Pick<Token,'id'|'label'>[]}){
 const[rows,setRows]=useState<MastermindNativeWardOutcomePrompt[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const refresh=async()=>{try{setRows(await listMastermindNativeWardOutcomes())}catch{setRows([])}}
 useEffect(()=>subscribeSharedResourceInvalidation('mastermind-native-ward-outcomes',refresh,{immediate:true}),[mapId])
 const pending=rows.filter(row=>row.mapId===mapId&&row.phase==='waiting'&&row.canAnswer);if(!pending.length)return null
 const answer=async(row:MastermindNativeWardOutcomePrompt,targetId?:string)=>{if(busy)return;setBusy(true);setNotice('');try{await answerMastermindNativeWardOutcome(row.id,targetId);await refresh()}catch{setNotice('原攻击或当前控制权已变化，请重新查看。')}finally{setBusy(false)}}
 return <DiceOverlayPortal layer="confirmation"><section aria-label="怪物攻击被防护阻止" className="pointer-events-auto fixed bottom-24 right-4 max-h-[calc(100dvh-10rem)] max-w-sm space-y-3 overflow-y-auto rounded-xl border border-amber-300/30 bg-slate-950/95 p-4 text-sm text-slate-200">
 {pending.map(row=><article key={row.id} className="space-y-2"><strong>攻击被防护阻止</strong><p>{tokens.find(token=>token.id===row.actorTokenId)?.label??'该生物'}本回合不能攻击{tokens.find(token=>token.id===row.wardTargetTokenId)?.label??'该目标'}。放弃会消耗这次攻击；已经使用的反应保持消耗。</p><div className="flex flex-wrap gap-2"><button type="button" data-action-id="mastermind-native-ward-waste" disabled={busy} onClick={()=>void answer(row)} className="rounded bg-amber-800 px-3 py-2 disabled:opacity-40">放弃这次攻击</button>{row.retargetTokenIds.map(targetId=><button key={targetId} type="button" data-action-id="mastermind-native-ward-retarget" data-target-id={targetId} disabled={busy} onClick={()=>void answer(row,targetId)} className="rounded bg-sky-800 px-3 py-2 disabled:opacity-40">改为攻击{tokens.find(token=>token.id===targetId)?.label??'该目标'}</button>)}</div></article>)}
 {notice&&<p role="status" className="text-amber-200">{notice}</p>}
 </section></DiceOverlayPortal>
}
