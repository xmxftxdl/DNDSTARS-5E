import{useEffect,useState}from'react'
import DiceOverlayPortal from'../DiceOverlayPortal'
import{requestSharedMastermindThoughtReading,subscribeSharedResourceInvalidation}from'../../lib/sharedApi'
type Result={parentTransactionId:string;mapId:string;kind:'unavailable'|'thoughts';thoughts?:string}
/** This projection contains only this actual caster's committed result. It
 * deliberately has no target feature, contest outcome, or owner answer. */
export default function MastermindThoughtResultPanel({mapId}:{mapId:string}){
 const[rows,setRows]=useState<Result[]>([]),[dismissed,setDismissed]=useState<string[]>([])
 useEffect(()=>subscribeSharedResourceInvalidation('mastermind-thought-readings',async()=>{try{const result=await requestSharedMastermindThoughtReading<{results:Result[]}>('read-results',{});setRows(result.results)}catch{setRows([])}},{immediate:true}),[mapId])
 const shown=rows.filter(row=>row.mapId===mapId&&!dismissed.includes(row.parentTransactionId))
 if(!shown.length)return null
 return <DiceOverlayPortal layer="confirmation"><section aria-label="你的思想读取结果" className="pointer-events-auto fixed bottom-24 left-4 max-h-[calc(100dvh-10rem)] max-w-sm space-y-3 overflow-y-auto rounded-xl border border-violet-300/30 bg-slate-950/95 p-4 text-sm text-slate-200">{shown.map(row=><article key={row.parentTransactionId}><strong>思想读取</strong><p className="whitespace-pre-wrap">{row.kind==='unavailable'?'无法读取目标的思想。':row.thoughts??'读取已获允许。具体思想由主持人向你私下说明。'}</p><button type="button" onClick={()=>setDismissed(ids=>[...ids,row.parentTransactionId])} className="mt-2 rounded border border-slate-600 px-3 py-1">收起</button></article>)}</section></DiceOverlayPortal>
}
