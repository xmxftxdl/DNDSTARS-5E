import { useState } from 'react'
import type { MultipartCreatureState } from '../../rulesets/dnd5e/multipartCreature'
import type { MultipartControlCommand } from '../../rulesets/dnd5e/multipartControlAction'

export function MultipartControls({actorId,state,isCurrent,pending,onCommand,corpses}:{actorId:string;state:MultipartCreatureState;
  isCurrent:boolean;pending:boolean;corpses?:readonly {id:string;label:string}[];onCommand?:(command:MultipartControlCommand)=>void}) {
  const [headId,setHeadId]=useState('head-1')
  const [corpseId,setCorpseId]=useState('')
  const [deathAge,setDeathAge]=useState(0)
  const [offset,setOffset]=useState({x:0,y:0,z:0})
  const alive=state.heads.filter(head=>head.alive)
  const head=alive.find(h=>h.id===headId)??alive[0]??state.heads[0]
  if(!head)return <p className="p-3 text-sm text-slate-400">所有头部已死亡。</p>
  return <section className="m-3 space-y-2 rounded-lg border border-rose-300/20 p-3 text-sm text-slate-200">
    <p>存活头部 {alive.length} / 9 · 待选择断头 {state.pendingHeadDeaths}</p>
    <select aria-label="选择头部" value={head.id} onChange={e=>setHeadId(e.target.value)} className="rounded bg-slate-900 p-2">
      {alive.map(h=><option key={h.id} value={h.id}>{h.id.replace('head-','头部 ')} · 剩余移动 {30-h.movementSpent} 尺{h.actionSpent?' · 已行动':''}</option>)}
    </select>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending||!head.alive||!isCurrent||head.actionSpent||!head.grappledTargetId||state.pendingHeadDeaths>0||!onCommand}
        onClick={()=>onCommand?.({type:'multipart-control',actorId,headId:head.id,command:'swallow'})} className="rounded bg-rose-900 px-3 py-2 disabled:opacity-40">吞噬此头擒抱的目标</button>
      <button type="button" disabled={pending||!head.alive||!isCurrent||head.actionSpent||state.pendingHeadDeaths>0||!onCommand}
        onClick={()=>onCommand?.({type:'multipart-control',actorId,headId:head.id,command:'sing'})} className="rounded bg-violet-800 px-3 py-2 disabled:opacity-40">寂静挽歌</button>
      <button type="button" disabled={pending||state.pendingHeadDeaths<1||!onCommand}
        onClick={()=>onCommand?.({type:'multipart-control',actorId,headId:head.id,command:'sever'})} className="rounded bg-rose-900 px-3 py-2 disabled:opacity-40">选择此头死亡</button>
    </div>
    <p className="text-xs text-slate-400">头部位移（尺）：向右、向下、向上；负数表示反方向。</p>
    <div className="flex gap-2">{(['x','y','z'] as const).map((key,index)=><label key={key} className="min-w-0 flex-1">
      {['向右','向下','向上'][index]}<input type="number" value={offset[key]} min={-30} max={30}
        onChange={e=>setOffset({...offset,[key]:Number(e.target.value)})} className="w-full rounded bg-slate-900 p-2"/>
    </label>)}</div>
    <button type="button" disabled={pending||!head.alive||!isCurrent||state.pendingHeadDeaths>0||!onCommand}
      onClick={()=>onCommand?.({type:'multipart-control',actorId,headId:head.id,command:'move',
        to:{x:head.position.x+offset.x,y:head.position.y+offset.y,z:head.position.z+offset.z},pathFeet:Math.hypot(offset.x,offset.y,offset.z)})}
      className="rounded bg-slate-700 px-3 py-2 disabled:opacity-40">移动这个头</button>
    {!!corpses?.length && <div className="space-y-2 border-t border-slate-600 pt-2">
      <label>吞噬尸体<select aria-label="吞噬尸体" value={corpseId} onChange={e=>setCorpseId(e.target.value)} className="ml-2 rounded bg-slate-900 p-2">
        <option value="">选择头旁边的尸体</option>{corpses.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label className="block">死亡多久（分钟，无记录时由DM确认）<input type="number" min={0} value={deathAge} onChange={e=>setDeathAge(Number(e.target.value))} className="w-20 rounded bg-slate-900 p-2"/></label>
      <button type="button" disabled={pending||!head.alive||!isCurrent||head.actionSpent||!corpseId||!onCommand}
        onClick={()=>onCommand?.({type:'multipart-control',actorId,headId:head.id,command:'consume-corpse',targetId:corpseId,deathAgeMinutes:deathAge})}
        className="rounded bg-slate-700 px-3 py-2 disabled:opacity-40">以此头吞噬尸体</button>
    </div>}
    <button type="button" disabled={pending||!onCommand} className="rounded bg-slate-700 px-3 py-2 disabled:opacity-40"
      onClick={()=>onCommand?.({type:'multipart-control',actorId,headId:head.id,command:state.restStartedMinute==null?'start-rest':'finish-rest'})}>
      {state.restStartedMinute==null?'开始长休':'完成长休并检查再生（须经过8小时）'}</button>
    {!!state.consumed?.length && <details><summary>吞噬与遗忘记录（DM）</summary>{state.consumed.map(entry=><p key={entry.targetId} className="text-xs text-slate-400">
      {entry.name} · 第{entry.minute}分钟 · {entry.requiem?'安魂曲已触发，仅完全复生术、祈愿术或神力干预可复活':'旧尸体，未触发安魂曲'}
      {entry.requiem && `；在场受影响者重塑记忆需 ${Object.values(entry.rewriteMinutesByActorId).join('、')} 分钟。具体认识关系和记忆内容由DM裁定。`}
    </p>)}</details>}
  </section>
}
