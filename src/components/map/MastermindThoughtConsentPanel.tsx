import DiceOverlayPortal from'../DiceOverlayPortal'
import{useEffect,useState}from'react'
import{subscribeSharedResourceInvalidation}from"../../composition/browserSharedRoomResources"
import{answerMastermindThoughtReading,listMastermindThoughtPrompts,type MastermindThoughtPrompt}from'../../pages/maps/mastermindThoughtReadingParent'

export default function MastermindThoughtConsentPanel({mapId}:{mapId:string}){
 const[rows,setRows]=useState<MastermindThoughtPrompt[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const refresh=async()=>{try{setRows(await listMastermindThoughtPrompts())}catch{setRows([])}}
 useEffect(()=>subscribeSharedResourceInvalidation('mastermind-thought-readings',refresh,{immediate:true}),[mapId])
 const pending=rows.filter(row=>row.mapId===mapId&&row.phase==='waiting')
 if(!pending.length)return null
 const answer=async(row:MastermindThoughtPrompt,choice:NonNullable<MastermindThoughtPrompt['choice']>,falseThoughts?:string)=>{if(busy)return;setBusy(true);setNotice('');try{await answerMastermindThoughtReading(row.id,choice,falseThoughts);await refresh()}catch{setNotice('原法术、人物控制权或场景已改变，请刷新后重新确认。')}finally{setBusy(false)}}
 return <DiceOverlayPortal layer="confirmation"><section aria-label="思想读取选择" className="pointer-events-auto fixed bottom-24 right-4 max-h-[calc(100dvh-10rem)] overflow-y-auto max-w-sm space-y-3 rounded-xl border border-violet-300/30 bg-slate-950/95 p-4 text-sm text-slate-200">{pending.map(row=><MastermindThoughtConsentChoice key={row.id} row={row} busy={busy} answer={answer}/>)}{notice&&<p role="status" className="text-amber-200">{notice}</p>}</section></DiceOverlayPortal>
}

export function MastermindThoughtConsentChoice({row,busy,answer}:{row:MastermindThoughtPrompt;busy:boolean;answer:(row:MastermindThoughtPrompt,choice:NonNullable<MastermindThoughtPrompt['choice']>,falseThoughts?:string)=>Promise<void>}){
 const[falseThoughts,setFalseThoughts]=useState('')
 return <article className="space-y-2"><strong>诡诈之魂</strong><p>读取你的思想须经你允许。拒绝不会消耗反应，也不会给予对方真实思想。</p>{row.canAnswer?<div className="flex flex-col gap-2"><button type="button" data-action-id="mastermind-thought-deny" disabled={busy} onClick={()=>void answer(row,'deny')} className="rounded border border-slate-600 p-2">拒绝读取</button><button type="button" data-action-id="mastermind-thought-allow" disabled={busy} onClick={()=>void answer(row,'allow-real-thoughts')} className="rounded bg-violet-800 p-2">允许本次读取真实思想</button><label>你想展示的思想<textarea aria-label="希望展示的思想" maxLength={4000} value={falseThoughts} onChange={event=>setFalseThoughts(event.target.value)} className="mt-1 block w-full rounded bg-slate-800 p-2"/></label><p className="text-xs text-slate-400">展示虚假思想须进行魅力（欺瞒）对抗对方的感知（洞悉）；失败也不代表同意读取真实思想。检定完成前，原法术会继续等待。</p><button type="button" data-action-id="mastermind-thought-false" disabled={busy||!falseThoughts.trim()} onClick={()=>void answer(row,'present-false-thoughts',falseThoughts)} className="rounded bg-violet-800 p-2 disabled:opacity-40">选择展示虚假思想，等待对抗检定</button></div>:<p role="status">等待该人物的控制者选择；主持人不能代替玩家同意。</p>}</article>
}
