import {useState} from 'react'
import {assertDnd5eFortressRoomAccess,buildDnd5eFortressRoomBlueprint,type Dnd5eFortressRoomBlueprint} from '../../rulesets/dnd5e/fortressRoomBlueprint'

export function FortressRoomLayoutDialog({floor,stair,onDone}:{floor:number;stair:number;onDone:(rooms:Dnd5eFortressRoomBlueprint[]|null)=>void}){
 const [rooms,setRooms]=useState<Dnd5eFortressRoomBlueprint[]>([]),[level,setLevel]=useState<1|2|3>(1),[selected,setSelected]=useState<string>()
 const rise=10+floor/12,active=rooms.find(room=>room.id===selected)
 let error=''
 try{
  const blueprint=buildDnd5eFortressRoomBlueprint(rooms,[0,rise,2*rise])
  assertDnd5eFortressRoomAccess(blueprint,[
   {id:'lower',from:{x:47.5,y:47.5,elevationFeet:0},to:{x:62.5,y:47.5,elevationFeet:rise},widthFeet:5,thicknessInches:stair},
   {id:'upper',from:{x:47.5,y:67.5,elevationFeet:rise},to:{x:62.5,y:67.5,elevationFeet:2*rise},widthFeet:5,thicknessInches:stair}],
   [0,1,2].flatMap(column=>[{level:2 as const,column,row:1},{level:3 as const,column,row:3}]),[0,rise,2*rise])
 }catch(e){
  const code=e instanceof Error?e.message:''
  error=code==='fortress-room-overlap'?'同层房间不能重叠。':code==='fortress-room-stair-conflict'?'房间墙穿过了楼梯，请调整位置。':
   code==='fortress-room-opening-conflict'?'房间墙穿过了楼板开口，请调整位置。':code==='fortress-room-entrance-invalid'?'入口需要 5 尺净宽，且不能碰到侧墙。':'房间必须位于主楼内，长宽至少 6 尺（含墙厚）。'
 }
 const update=(patch:Partial<Dnd5eFortressRoomBlueprint>)=>setRooms(current=>current.map(room=>room.id===selected?{...room,...patch}:room))
 return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
  <section role="dialog" aria-modal="true" aria-labelledby="fortress-layout-title" className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl border border-violet-400/40 bg-slate-950 p-5 text-slate-100">
   <h2 id="fortress-layout-title" className="text-lg font-semibold">坚固堡垒 · 自定义房间</h2>
   <p className="my-2 text-sm text-slate-300">点击房间编辑。坐标以主楼西北角为原点，单位为尺。灰色为楼梯，斜线区域为楼板开口；未分隔部分保留为大厅。</p>
   <div className="flex gap-2">{([1,2,3]as const).map(value=><button key={value} className={value===level?'rounded bg-violet-600 px-3 py-1':'rounded bg-slate-800 px-3 py-1'} onClick={()=>{setLevel(value);setSelected(undefined)}}>第 {value} 层</button>)}</div>
   <div className="mt-3 grid gap-4 sm:grid-cols-2">
    <svg viewBox="32 32 56 56" className="w-full border border-slate-600 bg-slate-900" aria-label={`第 ${level} 层房间平面图`}>
     <defs><pattern id="fortress-hole-hatch" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M0 0L2 2" stroke="#e8b56c" strokeWidth=".2"/></pattern></defs>
     <rect x="35" y="35" width="50" height="50" fill="none" stroke="#cbd5e1" strokeWidth=".5"/>
     {level>1&&<rect x="35" y={level===2?45:65} width="30" height="10" fill="url(#fortress-hole-hatch)"/>}
     {level<=2&&<rect x="47.5" y="45" width="15" height="5" fill="#64748b"/>}
     {level>=2&&<rect x="47.5" y="65" width="15" height="5" fill="#64748b"/>}
     {rooms.filter(room=>room.level===level).map((room,index)=><g key={room.id} onClick={()=>setSelected(room.id)} role="button" tabIndex={0} aria-label={`选择房间 ${index+1}`} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')setSelected(room.id)}}>
      <rect x={room.x} y={room.y} width={room.widthFeet} height={room.depthFeet} fill={selected===room.id?'#7c3aed88':'#2563eb55'} stroke="#c4b5fd" strokeWidth=".4"/>
      {(()=>{const {side,offsetFeet,kind}=room.entrance,horizontal=side==='north'||side==='south'
       const x=horizontal?room.x+offsetFeet:side==='west'?room.x:room.x+room.widthFeet
       const y=horizontal?(side==='north'?room.y:room.y+room.depthFeet):room.y+offsetFeet
       return <line x1={x} y1={y} x2={x+(horizontal?5:0)} y2={y+(horizontal?0:5)} stroke={kind==='door'?'#fbbf24':'#34d399'} strokeWidth="1"/>
      })()}
      <text x={room.x+room.widthFeet/2} y={room.y+room.depthFeet/2} textAnchor="middle" fontSize="2.5" fill="white">{index+1}</text>
     </g>)}
    </svg>
    <div className="space-y-2 text-sm">
     <button className="rounded bg-violet-700 px-3 py-2" disabled={rooms.length>=192} onClick={()=>{const id='room-'+crypto.randomUUID();setRooms(current=>[...current,{id,level,x:73,y:36,widthFeet:10,depthFeet:10,entrance:{side:'west',offsetFeet:2,kind:'door'}}]);setSelected(id)}}>添加房间</button>
     {active&&<>
      {(['x','y','widthFeet','depthFeet']as const).map((key,index)=><label key={key} className="flex items-center justify-between gap-2">{['距西墙','距北墙','东西宽度','南北长度'][index]}<input className="w-24 rounded bg-slate-800 p-1" type="number" step="0.5" value={active[key]-(key==='x'||key==='y'?35:0)} onChange={event=>update({[key]:Number(event.target.value)+(key==='x'||key==='y'?35:0)})}/></label>)}
      <label className="flex justify-between">入口方向<select aria-label="入口方向" className="bg-slate-800" value={active.entrance.side} onChange={event=>update({entrance:{...active.entrance,side:event.target.value as typeof active.entrance.side}})}>{(['north','south','west','east']as const).map((side,index)=><option key={side} value={side}>{['北','南','西','东'][index]}</option>)}</select></label>
      <label className="flex justify-between">入口偏移（从北／西端）<input className="w-24 bg-slate-800" type="number" step="0.5" value={active.entrance.offsetFeet} onChange={event=>update({entrance:{...active.entrance,offsetFeet:Number(event.target.value)}})}/></label>
      <label className="flex justify-between">入口类型<select aria-label="入口类型" className="bg-slate-800" value={active.entrance.kind} onChange={event=>update({entrance:{...active.entrance,kind:event.target.value as 'door'|'arch'}})}><option value="door">石门</option><option value="arch">开放拱门</option></select></label>
      <button className="text-rose-300" onClick={()=>{setRooms(current=>current.filter(room=>room.id!==selected));setSelected(undefined)}}>删除房间</button>
     </>}
    </div>
   </div>
   <p className="mt-2 text-xs text-slate-300">黄色为石门，绿色为开放拱门；房间显示数字仅用于布局识别。</p>
   {error&&<p role="alert" className="mt-3 text-rose-300">{error}</p>}
   <footer className="mt-4 flex justify-end gap-3"><button onClick={()=>onDone(null)}>取消</button><button disabled={!!error} className="rounded bg-violet-600 px-4 py-2 disabled:opacity-40" onClick={()=>onDone(rooms)}>确认布局</button></footer>
  </section>
 </div>
}
