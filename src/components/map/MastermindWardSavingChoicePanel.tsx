import{useEffect,useState}from'react'
import DiceOverlayPortal from'../DiceOverlayPortal'
import type{Token}from'../../store/maps'
import{subscribeSharedResourceInvalidation}from'../../composition/browserSharedRoomResources'
import{listMastermindWardSavingChoices,answerMastermindWardSavingChoice,type MastermindWardSavingPrompt}from'../../pages/maps/mastermindWardSavingChoice'
export default function MastermindWardSavingChoicePanel({mapId,tokens}:{mapId:string;tokens:readonly Pick<Token,'id'|'label'>[]}){
 const[rows,setRows]=useState<MastermindWardSavingPrompt[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const refresh=async()=>{try{setRows(await listMastermindWardSavingChoices())}catch{setRows([])}}
 useEffect(()=>subscribeSharedResourceInvalidation('mastermind-ward-saving-choices',refresh,{immediate:true}),[mapId])
 const pending=rows.filter(row=>row.mapId===mapId&&row.phase==='waiting');if(!pending.length)return null
 const answer=async(id:string,use:boolean)=>{if(busy)return;setBusy(true);setNotice('');try{await answerMastermindWardSavingChoice(id,use);await refresh()}catch{setNotice('原豁免或人物控制权已改变，请重新查看。')}finally{setBusy(false)}}
 return <DiceOverlayPortal layer="confirmation"><section aria-label="本次豁免的吟游激励" className="pointer-events-auto fixed bottom-24 right-4 max-h-[calc(100dvh-10rem)] max-w-sm space-y-3 overflow-y-auto rounded-xl border border-amber-300/30 bg-slate-950/95 p-4 text-sm text-slate-200">
 {pending.map(row=><article key={row.id} className="space-y-2"><strong>本次豁免的吟游激励</strong><p>{tokens.find(token=>token.id===row.actorTokenId)?.label??'豁免者'}可以为本次豁免消耗一枚 d{row.sides} 吟游激励骰。选择保留不会消耗该骰。</p>{row.canAnswer?<div className="flex flex-wrap gap-2"><button type="button" data-action-id="mastermind-ward-saving-use" data-request-id={row.id} disabled={busy} onClick={()=>void answer(row.id,true)} className="rounded bg-amber-800 px-3 py-2 disabled:opacity-40">使用 d{row.sides} 吟游激励</button><button type="button" data-action-id="mastermind-ward-saving-decline" data-request-id={row.id} disabled={busy} onClick={()=>void answer(row.id,false)} className="rounded bg-slate-700 px-3 py-2 disabled:opacity-40">保留吟游激励</button></div>:<p role="status">等待豁免者的控制者选择；主持人不能代替玩家作答。</p>}</article>)}
 {notice&&<p role="status" className="text-amber-200">{notice}</p>}
 </section></DiceOverlayPortal>
}
