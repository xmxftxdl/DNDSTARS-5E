import DiceOverlayPortal from '../DiceOverlayPortal'
import {useEffect,useState} from 'react'
import type {Token} from '../../store/maps'
import {subscribeSharedResourceInvalidation} from '../../lib/sharedApi'
import {answerMastermindMisdirection,listMastermindMisdirectionPrompts,type MastermindMisdirectionPrompt} from '../../pages/maps/mastermindMisdirectionParent'

/** This panel presents the server's single-owner decision, never a caller's
 * proposed cover witness or an attack/result publisher. */
export default function MastermindMisdirectionPanel({mapId,tokens}:{mapId:string;tokens:readonly Pick<Token,'id'|'label'>[]}){
 const[rows,setRows]=useState<MastermindMisdirectionPrompt[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const refresh=async()=>{try{setRows(await listMastermindMisdirectionPrompts())}catch{setRows([])}}
 useEffect(()=>subscribeSharedResourceInvalidation('mastermind-misdirections',refresh,{immediate:true}),[mapId])
 const pending=rows.filter(row=>row.mapId===mapId&&row.phase==='waiting')
 if(!pending.length)return null
 const answer=async(id:string,choice:string)=>{if(busy)return;setBusy(true);setNotice('');try{await answerMastermindMisdirection(id,choice);await refresh()}catch{setNotice('人物、掩护或原攻击已改变，请刷新后重新确认。')}finally{setBusy(false)}}
 return <DiceOverlayPortal layer="confirmation"><section aria-label="移花接木反应" className="pointer-events-auto fixed bottom-24 right-4 max-h-[calc(100dvh-10rem)] overflow-y-auto max-w-sm space-y-3 rounded-xl border border-violet-300/30 bg-slate-950/95 p-4 text-sm text-slate-200">
  {pending.map(row=><MastermindMisdirectionChoice key={row.id} row={row} tokens={tokens} busy={busy} answer={answer}/>)}
  {notice&&<p role="status" className="text-amber-200">{notice}</p>}
 </section></DiceOverlayPortal>
}

export function MastermindMisdirectionChoice({row,tokens,busy,answer}:{row:MastermindMisdirectionPrompt;tokens:readonly Pick<Token,'id'|'label'>[];busy:boolean;answer:(id:string,choice:string)=>Promise<void>}){
 return <article className="space-y-2"><strong>移花接木</strong><p>一次攻击正以你为目标。你可以用反应，将这同一次攻击转向身边 5 尺内为你提供掩护的生物。</p>
  {row.canAnswer?<div className="flex flex-col gap-2">{row.replacementTokenIds.map((id,index)=><button type="button" disabled={busy} key={id} data-action-id="mastermind-misdirection-use" data-target-id={id} onClick={()=>void answer(row.id,id)} className="rounded bg-violet-800 px-3 py-2 disabled:opacity-40">使用反应：{tokens.find(token=>token.id===id)?.label??`掩护生物 ${index+1}`}</button>)}<button type="button" disabled={busy} data-action-id="mastermind-misdirection-decline" onClick={()=>void answer(row.id,'decline')} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-40">不使用反应，保留原目标</button></div>:<p role="status">等待该人物的控制者选择；主持人不能代替玩家作答。</p>}
 </article>
}
