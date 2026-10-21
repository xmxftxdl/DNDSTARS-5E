import {useState} from 'react'
import type {BattleMap} from '../../store/maps'
import type {MapGeometryState} from '../../lib/mapGeometry'
import {dnd5eInventoryItemTemplate} from '../../rulesets/dnd5e/items'
import {placeDnd5eFortressFurnishings} from '../../rulesets/dnd5e/fortressFurnishings'
import type {Dnd5eFortressFurnishingRecipe,Dnd5eFortressFurnishingPlacement} from '../../rulesets/dnd5e/fortressFurnishingDefinition'
import {fortressVisualParts} from './fortressVisualGeometry'

export interface FortressFurnishingPreview {map:BattleMap;geometry:MapGeometryState;structureId:string;catalog:readonly Dnd5eFortressFurnishingRecipe[]}
export function FortressFurnishingDialog({preview,onDone}:{preview:FortressFurnishingPreview;onDone:(value:Dnd5eFortressFurnishingPlacement[]|null)=>void}){
 const [placements,setPlacements]=useState<Dnd5eFortressFurnishingPlacement[]>([]),[level,setLevel]=useState<1|2|3>(1)
 const [templateId,setTemplateId]=useState(preview.catalog[0]?.templateId??''),[selected,setSelected]=useState<string>()
 const active=placements.find(item=>item.id===selected),record=preview.geometry.structureLifetimes!.find(item=>item.id===preview.structureId)!
 const [a,b,,d]=record.objectBoundary!.points,ux=b.x-a.x,uy=b.y-a.y,vx=d.x-a.x,vy=d.y-a.y
 const local=(p:{x:number;y:number})=>({x:((p.x-a.x)*ux+(p.y-a.y)*uy)/(ux*ux+uy*uy)*120,y:((p.x-a.x)*vx+(p.y-a.y)*vy)/(vx*vx+vy*vy)*120})
 const slab=preview.geometry.obstacles.find(item=>item.id.startsWith(`${record.id}:floor:keep-level-${level}.`))
 const elevation=level===1?record.objectBoundary!.bottomFeet??0:slab?slab.baseHeightFeet+slab.heightFeet:0
 const parts=fortressVisualParts(preview.geometry,elevation,record.createdWorldMinute)
 let error=''
 try{placeDnd5eFortressFurnishings({...preview,placements})}catch(cause){
  const code=cause instanceof Error?cause.message:''
  error=code==='fortress-furnishings-template-unavailable'?'模块家具模板不可用，请重新选择。':code==='fortress-furnishings-outside-keep'?'家具必须完整放在主楼内。':'家具与墙、楼梯、其他物体重叠，或下方没有完整楼面，请调整位置。'
 }
 const update=(patch:Partial<Dnd5eFortressFurnishingPlacement>)=>setPlacements(items=>items.map(item=>item.id===selected?{...item,...patch}:item))
 return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
  <section role="dialog" aria-modal="true" aria-labelledby="fortress-furnishing-title" className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl border border-violet-400/40 bg-slate-950 p-5 text-slate-100">
   <h2 id="fortress-furnishing-title" className="text-lg font-semibold">坚固堡垒 · 家具摆放</h2>
   <p className="my-2 text-sm text-slate-300">选择家具并添加，点击平面图调整选中家具的位置。坐标以主楼西北角为原点，单位为尺。</p>
   <div className="flex gap-2">{([1,2,3]as const).map(value=><button key={value} onClick={()=>{setLevel(value);setSelected(undefined)}} className={`rounded px-3 py-1 ${value===level?'bg-violet-600':'bg-slate-800'}`}>第 {value} 层</button>)}</div>
   <div className="mt-3 grid gap-4 sm:grid-cols-2">
    <svg viewBox="32 32 56 56" aria-label="家具摆放平面图" className="w-full border border-slate-600 bg-slate-900" onClick={event=>{
     if(!active)return
     const svg=event.currentTarget,matrix=svg.getScreenCTM()
     if(!matrix)return
     const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse())
     update({x:Math.round(point.x*2)/2,y:Math.round(point.y*2)/2})
    }}>
     {parts.map(({entity,kind})=><polygon key={entity.id} points={entity.points.map(local).map(p=>`${p.x},${p.y}`).join(' ')} fill={kind==='floor'?'#334155':'#64748b'} stroke="#cbd5e1" strokeWidth=".2"/>)}
     {placements.filter(item=>item.level===level).map((item,index)=>{const size=(preview.catalog.find(recipe=>recipe.templateId===item.templateId)?.size??1)*(preview.map.feetPerCell??5)
      return <g key={item.id} role="button" tabIndex={0} aria-label={`选择家具 ${index+1}`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setSelected(item.id)}} onClick={e=>{e.stopPropagation();setSelected(item.id)}}>
       <rect x={item.x-size/2} y={item.y-size/2} width={size} height={size} fill={item.id===selected?'#d97706':'#a16207'} stroke="#fde68a" strokeWidth=".3"/>
       <text x={item.x} y={item.y+1} fontSize="2" textAnchor="middle" fill="white">{index+1}</text>
      </g>})}
    </svg>
    <div className="space-y-3 text-sm">
     <label className="block">家具种类<select aria-label="家具种类" value={templateId} onChange={e=>setTemplateId(e.target.value)} className="mt-1 w-full rounded bg-slate-800 p-2">{preview.catalog.map(item=><option key={item.templateId} value={item.templateId}>{dnd5eInventoryItemTemplate(item.templateId)?.name??item.templateId}</option>)}</select></label>
     <button disabled={!templateId||placements.length>=512} className="rounded bg-violet-700 px-3 py-2" onClick={()=>{const id='item-'+crypto.randomUUID();setPlacements(items=>[...items,{id,templateId,level,x:60,y:60}]);setSelected(id)}}>添加家具</button>
     {active&&<>
      <p>{dnd5eInventoryItemTemplate(active.templateId)?.name}</p>
      {(['x','y']as const).map((key,index)=><label key={key} className="flex justify-between">{['距西墙','距北墙'][index]}<input className="w-24 bg-slate-800" type="number" step=".5" value={active[key]-35} onChange={e=>update({[key]:Number(e.target.value)+35})}/></label>)}
      <button className="text-rose-300" onClick={()=>{setPlacements(items=>items.filter(item=>item.id!==selected));setSelected(undefined)}}>删除家具</button>
     </>}
    </div>
   </div>
   {error&&<p role="alert" className="mt-3 text-rose-300">{error}</p>}
   <footer className="mt-4 flex justify-end gap-3"><button onClick={()=>onDone(null)}>取消</button><button className="rounded bg-violet-600 px-4 py-2 disabled:opacity-40" disabled={!!error} onClick={()=>onDone(placements)}>确认家具摆放</button></footer>
  </section>
 </div>
}
