import {useState} from 'react'
import type {BattleMap} from '../../store/maps'
import type {MapGeometryState} from '../../lib/mapGeometry'
import {mapGeometryTokenElevation} from '../../lib/mapGeometry'
import {dnd5eFortressMovementLevels} from '../../rulesets/dnd5e/fortressMovementLevels'
import {dnd5eFortressRoomDestinations} from '../../rulesets/dnd5e/fortressRoomDestinations'
import type {FortressServantPosition} from '../../rulesets/dnd5e/fortressServantMove'

export function MightyFortressServicesPanel({map,geometry,worldMinute,isDM=false,requestPending=false,actorTokenId,onFeast,onCommand,onPickup,onDrop,onMove,onDoor}:{
 map:BattleMap;geometry:MapGeometryState;worldMinute:number;isDM?:boolean;requestPending?:boolean;actorTokenId?:string;
 onFeast:(structureId:string,guests:number,expectedWorldDay:number,actorTokenId:string)=>Promise<void>;
 onCommand?:(structureId:string,servantNumbers:number[],instruction:string,actorTokenId:string)=>Promise<void>;
 onPickup?:(servantTokenId:string,objectTokenId:string,expectedReceiptId:string,expectedQuantity:number,commanderTokenId:string,approach:boolean)=>Promise<void>;
 onDrop?:(servantTokenId:string,carriedObjectId:string,expectedPickupReceipt:string,commanderTokenId:string)=>Promise<void>;
 onMove?:(servantTokenId:string,commanderTokenId:string,drop?:{id:string;receipt:string},elevationFeet?:number,destination?:FortressServantPosition)=>Promise<void>;
 onDoor?:(servantTokenId:string,doorId:string,operation:'open'|'close',commanderTokenId:string)=>Promise<void>;
}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(''),[actor,setActor]=useState('')
 const [guests,setGuests]=useState(1),[submitting,setBusy]=useState(false),[error,setError]=useState('')
 const busy=submitting||requestPending
 const [numbers,setNumbers]=useState<number[]>([]),[instruction,setInstruction]=useState('')
 const [objectId,setObjectId]=useState('')
 const [heldId,setHeldId]=useState('')
 const [approach,setApproach]=useState(true)
 const [targetHeight,setTargetHeight]=useState('')
 const [doorId,setDoorId]=useState('')
 const [roomId,setRoomId]=useState('')
 const actors=map.tokens.filter(token=>token.type!=='obstacle'&&!token.dnd5eSpellEffect)
 const chosen=actors.find(token=>token.id===(isDM?actor:actorTokenId))??(isDM?actors[0]:undefined)
 const records=(geometry.structureLifetimes??[]).filter(record=>record.replacementGroup==='mighty-fortress'&&record.fortressServices&&
  (record.expiresWorldMinute==null||record.expiresWorldMinute>worldMinute)&&
  (isDM||chosen&&[record.casterId,...record.fortressServices.authorizedCreatureIds].includes(chosen.characterId??chosen.id)))
 const record=records.find(record=>record.id===selected)??records[0]
 if(!record)return null
 const day=Math.floor(worldMinute/1440),services=record.fortressServices!
 const remaining=100-(services.mealDay===day?services.mealsServed:0)
 const availableServants=(services.servants??[]).filter(servant=>map.tokens.some(token=>token.id===servant.tokenId&&
  token.type==='obstacle'&&(token.hp??0)>0&&token.dnd5eObjectState?.structureBinding?.mapId===map.id&&
  token.dnd5eObjectState.structureBinding.structureId===record.id))
 const availableNumbers=new Set(availableServants.map(servant=>servant.number))
 const selectedNumbers=numbers.filter(number=>availableNumbers.has(number))
 const allSelected=availableServants.length>0&&selectedNumbers.length===availableServants.length
 const objects=map.tokens.filter(token=>token.type==='obstacle'&&token.dnd5eObjectState?.inventoryItem&&!token.dnd5eObjectState.wornOrCarried)
 const object=objects.find(token=>token.id===objectId),worker=selectedNumbers.length===1?availableServants.find(servant=>servant.number===selectedNumbers[0]):undefined
 const held=map.tokens.find(token=>token.id===worker?.tokenId)?.dnd5eCarriedObjects??[],selectedHeld=held.find(item=>item.id===heldId)
 const workerToken=map.tokens.find(token=>token.id===worker?.tokenId)
 const doors=geometry.doors.filter(door=>isDM||!door.secret)
 const selectedDoor=doors.find(door=>door.id===doorId)
 const rooms=dnd5eFortressRoomDestinations(geometry,record.id),selectedRoom=rooms.find(room=>room.id===roomId)
 const currentHeight=workerToken?mapGeometryTokenElevation(geometry,workerToken):record.objectBoundary?.bottomFeet??0
 const levels=dnd5eFortressMovementLevels(geometry,record.id,currentHeight)
 const destinationHeight=targetHeight!==''&&levels.some(level=>level.elevationFeet===Number(targetHeight))?Number(targetHeight):currentHeight
 return <div className="absolute bottom-72 right-3 z-50 flex max-w-72 flex-col overflow-hidden rounded-xl border border-amber-700 bg-slate-950/95 p-3 text-sm text-slate-100" style={{maxHeight:'calc(100% - 19rem)'}}>
  <button type="button" className="shrink-0" onClick={()=>{setOpen(!open);setError('')}}>堡垒服务{open?' · 收起':''}</button>
  {open&&<form className="mt-2 flex min-h-0 flex-col gap-2 overflow-y-auto" onSubmit={async event=>{
   event.preventDefault();if(busy||!chosen||!services.mealTemplateId)return
   setBusy(true);setError('')
   try{await onFeast(record.id,guests,day,chosen.id);setOpen(false)}catch(cause){setError(cause instanceof Error?cause.message:'供餐失败')}finally{setBusy(false)}
  }}>
   {isDM&&<select aria-label="指挥堡垒服务的生物" className="bg-slate-900" value={chosen?.id??''} onChange={event=>setActor(event.target.value)}>
    {actors.map(token=><option key={token.id} value={token.id}>{token.label}</option>)}
   </select>}
   {records.length>1&&<select aria-label="选择堡垒" className="bg-slate-900" value={record.id} onChange={event=>{setSelected(event.target.value);setNumbers([]);setHeldId('');setTargetHeight('')}}>
    {records.map((item,index)=><option key={item.id} value={item.id}>堡垒 {index+1}</option>)}
   </select>}
   <p>九道菜宴席 · 今日还可供 {remaining} 人</p>
   {!services.mealTemplateId&&<p className="text-amber-200">此模块尚未配置宴席物品，暂时无法供餐。</p>}
   <label>供餐人数<input type="number" aria-label="供餐人数" min={1} max={remaining} value={guests}
    onChange={event=>setGuests(Number(event.target.value))} className="ml-2 w-20 rounded bg-slate-900 px-2 py-1" /></label>
   <button type="submit" disabled={busy||!chosen||!services.mealTemplateId||!Number.isInteger(guests)||guests<1||guests>remaining}
    className="rounded bg-amber-800 px-2 py-1 disabled:opacity-50">{busy?'提交中':'准备宴席'}</button>
   {services.servants&&onCommand&&<fieldset disabled={busy} className="flex flex-col gap-2 border-t border-white/15 pt-2">
    <legend>隐形仆役 · {availableServants.length} 名可用 / {services.servants.length} 名</legend>
    <button type="button" disabled={!availableServants.length} onClick={()=>setNumbers(allSelected?[]:availableServants.map(s=>s.number))}>{allSelected?'取消全选':'选择全部可用仆役'}</button>
    <div className="max-h-36 overflow-y-auto">
     {services.servants.map(servant=><label key={servant.number} className="block">
      <input type="checkbox" disabled={!availableNumbers.has(servant.number)} checked={selectedNumbers.includes(servant.number)} onChange={event=>setNumbers(current=>event.target.checked?[...current.filter(n=>availableNumbers.has(n)),servant.number]:current.filter(n=>n!==servant.number&&availableNumbers.has(n)))}/>
      仆役 {servant.number} · {availableNumbers.has(servant.number)?servant.assignment?.instruction??'待命':'不可用'}
     </label>)}
    </div>
    <label>任务指令<textarea aria-label="仆役任务指令" maxLength={1000} value={instruction} onChange={event=>setInstruction(event.target.value)} className="w-full rounded bg-slate-900 p-1"/></label>
    <p className="text-xs text-slate-400">任务文字用于记录；拾取请在下方选择一名仆役和物品。</p>
    <button type="button" disabled={!chosen||!selectedNumbers.length} className="rounded bg-amber-800 px-2 py-1 disabled:opacity-50" onClick={async()=>{
     if(!chosen||busy||!selectedNumbers.length)return
     setBusy(true);setError('')
     try{await onCommand(record.id,selectedNumbers,instruction,chosen.id)}catch(cause){setError(cause instanceof Error?cause.message:'指令提交失败')}finally{setBusy(false)}
    }}>{instruction.trim()?'下达任务':'清除所选任务'}</button>
    {onDoor&&<>
     <select aria-label="仆役操作的门" className="bg-slate-900" value={selectedDoor?.id??''} onChange={event=>setDoorId(event.target.value)}>
      <option value="">选择要操作的门</option>{doors.map(door=><option key={door.id} value={door.id}>{door.label||'门'}</option>)}
     </select>
     <div className="flex gap-2">{(['open','close'] as const).map(operation=><button key={operation} type="button"
      disabled={!chosen||!worker?.tokenId||!selectedDoor} onClick={async()=>{
       if(!chosen||!worker?.tokenId||!selectedDoor||busy)return
       setBusy(true);setError('')
       try{await onDoor(worker.tokenId,selectedDoor.id,operation,chosen.id)}catch(cause){setError(cause instanceof Error?cause.message:'开关门失败')}finally{setBusy(false)}
      }}>{operation==='open'?'命令开门':'命令关门'}</button>)}</div>
    </>}
    {onPickup&&<>
     <label><input type="checkbox" checked={approach} onChange={event=>setApproach(event.target.checked)}/>先靠近物品（最多 15 尺）</label>
     <select aria-label="仆役拾取物品" className="bg-slate-900" value={object?.id??''} onChange={event=>setObjectId(event.target.value)}>
      <option value="">选择地图物品</option>{objects.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
     </select>
     <button type="button" disabled={!chosen||!worker?.tokenId||!object} className="rounded bg-amber-800 px-2 py-1 disabled:opacity-50" onClick={async()=>{
      if(!chosen||!worker?.tokenId||!object?.dnd5eObjectState?.inventoryItem||busy)return
      const item=object.dnd5eObjectState.inventoryItem
      setBusy(true);setError('')
      try{await onPickup(worker.tokenId,object.id,item.receiptId,item.quantity,chosen.id,approach)}catch(cause){setError(cause instanceof Error?cause.message:'拾取失败')}finally{setBusy(false)}
     }}>命令所选仆役拾取一件</button>
    </>}
    {onDrop&&<>
     <select aria-label="仆役放下物品" className="bg-slate-900" value={selectedHeld?.id??''} onChange={event=>setHeldId(event.target.value)}>
      <option value="">选择仆役持有的物品</option>{held.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
     </select>
     <button type="button" disabled={!chosen||!worker?.tokenId||!selectedHeld} className="rounded bg-amber-800 px-2 py-1 disabled:opacity-50" onClick={async()=>{
      if(!chosen||!worker?.tokenId||!selectedHeld||busy)return
      setBusy(true);setError('')
      try{await onDrop(worker.tokenId,selectedHeld.id,selectedHeld.pickupReceipt,chosen.id)}catch(cause){setError(cause instanceof Error?cause.message:'放下失败')}finally{setBusy(false)}
     }}>命令所选仆役放下物品</button>
    </>}
    {onMove&&<div className="flex flex-col gap-2">
     {rooms.length>0&&<>
      <select aria-label="仆役目的房间" value={selectedRoom?.id??''} className="bg-slate-900" onChange={event=>setRoomId(event.target.value)}>
       <option value="">选择房间</option>{rooms.map(room=><option key={room.id} value={room.id}>{room.label}</option>)}
      </select>
      <div className="flex gap-2">{(['outside','inside'] as const).map(side=><button key={side} type="button" disabled={!chosen||!worker?.tokenId||!selectedRoom}
       onClick={async()=>{
        if(!chosen||!worker?.tokenId||!selectedRoom||busy)return
        setBusy(true);setError('')
        try{await onMove(worker.tokenId,chosen.id,undefined,selectedRoom[side].elevationFeet,selectedRoom[side])}catch(cause){setError(cause instanceof Error?cause.message:'前往房间失败')}finally{setBusy(false)}
       }}>{side==='outside'?'前往门外':'进入房间'}</button>)}</div>
      <p className="text-xs text-slate-400">每次最多移动 15 尺；经过关闭的房门前需先开门，拱门可直接通过。</p>
     </>}
     <label>目的高度<select aria-label="仆役移动目的高度" className="ml-2 bg-slate-900" value={destinationHeight} onChange={event=>setTargetHeight(event.target.value)}>
      {levels.map(level=><option key={level.elevationFeet} value={level.elevationFeet}>{level.label} · {Number(level.elevationFeet.toFixed(2))} 尺</option>)}
     </select></label>
     <button type="button" disabled={!chosen||!worker?.tokenId} onClick={async()=>{
      if(!chosen||!worker?.tokenId||busy)return
      setBusy(true);setError('')
      try{await onMove(worker.tokenId,chosen.id,undefined,destinationHeight)}catch(cause){setError(cause instanceof Error?cause.message:'移动失败')}finally{setBusy(false)}
     }}>在地图上选择移动位置</button>
     <button type="button" disabled={!chosen||!worker?.tokenId||!selectedHeld} onClick={async()=>{
      if(!chosen||!worker?.tokenId||!selectedHeld||busy)return
      setBusy(true);setError('')
      try{await onMove(worker.tokenId,chosen.id,{id:selectedHeld.id,receipt:selectedHeld.pickupReceipt},destinationHeight)}catch(cause){setError(cause instanceof Error?cause.message:'移动放下失败')}finally{setBusy(false)}
     }}>移动到选点后放下所选物品</button>
    </div>}
   </fieldset>}
   {error&&<p role="alert" className="text-rose-300">{error}</p>}
  </form>}
 </div>
}
