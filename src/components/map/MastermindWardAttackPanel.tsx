import{useEffect,useState}from'react'
import DiceOverlayPortal from'../DiceOverlayPortal'
import type{Token}from'../../store/maps'
import{subscribeSharedResourceInvalidation}from'../../composition/browserSharedRoomResources'
import{listMastermindWardAttackChoices,answerMastermindWardAttackChoice,answerMastermindWardAttackRetarget,type MastermindWardAttackPrompt}from'../../pages/maps/mastermindWardAttackChoice'
/** Only the server's canonical original attacker can choose this outcome. */
export default function MastermindWardAttackPanel({mapId,tokens}:{mapId:string;tokens:readonly Pick<Token,'id'|'label'>[]}){
 const[rows,setRows]=useState<MastermindWardAttackPrompt[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const refresh=async()=>{try{setRows(await listMastermindWardAttackChoices())}catch{setRows([])}}
 useEffect(()=>subscribeSharedResourceInvalidation('mastermind-ward-attacks',refresh,{immediate:true}),[mapId])
 const pending=rows.filter(row=>row.mapId===mapId&&row.phase==='waiting');if(!pending.length)return null
 const answer=async(id:string,targetTokenId?:string)=>{if(busy)return;setBusy(true);setNotice('');try{if(targetTokenId)await answerMastermindWardAttackRetarget(id,targetTokenId);else await answerMastermindWardAttackChoice(id);await refresh()}catch{setNotice('原攻击或人物控制权已改变，请重新查看。')}finally{setBusy(false)}}
 return <DiceOverlayPortal layer="confirmation"><section aria-label="攻击被防护阻止" className="pointer-events-auto fixed bottom-24 right-4 max-h-[calc(100dvh-10rem)] max-w-sm space-y-3 overflow-y-auto rounded-xl border border-amber-300/30 bg-slate-950/95 p-4 text-sm text-slate-200">
 {pending.map(row=><article key={row.id} className="space-y-2"><strong>攻击被防护阻止</strong><p>{tokens.find(token=>token.id===row.actorTokenId)?.label??'攻击者'}本回合不能攻击{tokens.find(token=>token.id===row.wardTargetTokenId)?.label??'该目标'}。放弃这次攻击会消耗这次攻击；目标已经使用的反应保持已消耗。</p>{row.canAnswer?<div className="flex flex-wrap gap-2"><button type="button" data-action-id="mastermind-ward-waste" disabled={busy} onClick={()=>void answer(row.id)} className="rounded bg-amber-800 px-3 py-2 disabled:opacity-40">放弃这次攻击</button>{row.retargetTokenIds?.map(targetId=><button key={targetId} type="button" data-action-id="mastermind-ward-retarget" data-target-id={targetId} disabled={busy} onClick={()=>void answer(row.id,targetId)} className="rounded bg-sky-800 px-3 py-2 disabled:opacity-40">改为攻击{tokens.find(token=>token.id===targetId)?.label??"该目标"}</button>)}</div>:<p role="status">等待攻击者的控制者选择；主持人不能代替玩家作答。</p>}</article>)}
 {notice&&<p role="status" className="text-amber-200">{notice}</p>}
 </section></DiceOverlayPortal>
}
