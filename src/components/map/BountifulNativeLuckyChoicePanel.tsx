import{useState}from'react'
import type{BountifulNativeLuckyPrompt}from'../../application/combat/dnd5eCombatRules'
export default function BountifulNativeLuckyChoicePanel({prompt,actorName,onChoose}:{prompt:BountifulNativeLuckyPrompt;actorName:string;onChoose:(decision:'use'|'decline')=>Promise<unknown>}){
 const[pending,setPending]=useState(false),[error,setError]=useState('')
 const choose=async(decision:'use'|'decline')=>{if(pending)return;setPending(true);setError('');try{await onChoose(decision)}catch{setPending(false);setError('选择未保存，请重试。')}}
 return <section role="dialog" aria-label="半身人幸运选择" className="absolute bottom-24 left-1/2 z-50 w-80 -translate-x-1/2 rounded-xl border border-sky-400/30 bg-void-900 p-4 shadow-xl">
  <h3 className="font-semibold text-sky-100">{actorName} · 半身人幸运</h3>
  <p className="my-2 text-xs text-slate-300">第 {prompt.dieIndex+1} 枚原始 d20 为 1。可重掷一次并采用新结果，或保留原骰。</p>
  <div className="flex gap-2"><button type="button" disabled={pending} onClick={()=>void choose('use')} className="rounded bg-sky-500/25 px-3 py-2 text-xs text-sky-50 disabled:opacity-50">使用半身人幸运</button><button type="button" disabled={pending} onClick={()=>void choose('decline')} className="rounded bg-white/5 px-3 py-2 text-xs text-slate-200 disabled:opacity-50">保留原骰</button></div>
  {pending&&<p role="status" className="mt-2 text-xs text-slate-400">等待原行动继续…</p>}{error&&<p role="alert" className="mt-2 text-xs text-amber-200">{error}</p>}
 </section>
}
