import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Overlays from '../../src/presentation/maps/DicePresentationOverlays'
import { useDicePresentation } from '../../src/presentation/maps/useDicePresentation'
import { receivePlayerDicePresentation, type PendingPlayerDicePresentation } from '../../src/pages/maps/playerDiceRoll'
import type { SharedRollRequestEvent } from '../../src/lib/sharedCombatTypes'
import '../../src/index.css'
const player = new URLSearchParams(location.search).get('player')
function App() {
 const dice = useDicePresentation(() => 1)
 const { setDiceBoxD20, setDiceBoxRoll, setDicePreviewPaused } = dice
 const [waiting, setWaiting] = useState(false)
 const channel = useMemo(() => new BroadcastChannel('concurrent-check-e2e'), [])
 const pending = useRef(new Map<string, PendingPlayerDicePresentation>())
 const [received, setReceived] = useState<string[]>([])
 const [finished, setFinished] = useState<string[]>([])
 const [physical, setPhysical] = useState<string[]>([])
 useEffect(() => {
  if (player) return
  const receive = ({ data: event }: MessageEvent<SharedRollRequestEvent>) => {
   let entry = pending.current.get(event.requestId)
   if (!entry) {
    entry = { kind:event.kind,count:event.count,sides:event.sides,targetCharacterId:event.targetCharacterId,
     resolve: () => {
      setFinished(old => [...old,event.requestId])
      if (location.search.includes('hold') && event.requestId === 'player-1-single') { setWaiting(true); setDicePreviewPaused(true,true) }
     } }
    pending.current.set(event.requestId,entry)
    setReceived(old => [...old,event.requestId])
   }
   receivePlayerDicePresentation(event,entry,values => new Promise<void>(resolve => {
    const common = { id: Number(event.targetCharacterId), requestKey:event.requestId,label:event.label,targetName:event.targetName,settledHoldMs:150,resolve }
    if (event.kind === 'd20') setDiceBoxD20({...common,value:values[0]})
    else setDiceBoxRoll({...common,count:values.length,sides:event.sides,values})
   }))
  }
  channel.addEventListener('message',receive)
  return () => channel.removeEventListener('message',receive)
 },[channel,setDiceBoxD20,setDiceBoxRoll,setDicePreviewPaused])
 const send = (pair: boolean) => {
  const event = { requestId:`player-${player}-${pair?'pair':'single'}`, mapId:'test', sourceMode:'player',kind:pair?'dice':'d20',count:pair?2:1,sides:20,
   targetCharacterId:player!,targetName:`玩家${player}`,label:'敏捷鉴定',values:pair?[4,18]:[Number(player)===1?15:7],updatedAt:Date.now() } as SharedRollRequestEvent
  channel.postMessage({...event,delivery:'player-roll-start'})
  channel.postMessage({...event,delivery:'player-roll-result'})
  channel.postMessage({...event,delivery:'player-roll-result'})
 }
 return <>{waiting && <button onClick={()=>{setWaiting(false);setDicePreviewPaused(false)}}>确认第一名玩家</button>}<button onClick={()=>send(false)}>投掷鉴定</button><button onClick={()=>send(true)}>双 D20 鉴定</button>
 <output data-testid="received">{JSON.stringify(received)}</output><output data-testid="finished">{JSON.stringify(finished)}</output>
 <output data-testid="physical">{JSON.stringify(physical)}</output>
 <output data-testid="active">{dice.diceBoxD20?.requestKey??dice.diceBoxRoll?.requestKey??''}</output>
 {!player && <Overlays {...dice} historyScope="concurrent-check-test" secretConfirmation={waiting?{id:"first",label:"敏捷鉴定",targetName:"玩家1",sides:20,values:[15],visibility:"public"}:null} isDM activeRollStatus={null} dockTab="dice" onRollDone={()=>{}} onSecretConfirm={()=>{}}
  onD20Complete={(request,value)=>{setPhysical(old=>[...old,request.requestKey!]);dice.completeDiceBoxD20(request,value)}}
  onDiceComplete={(request,values)=>{setPhysical(old=>[...old,request.requestKey!]);dice.completeDiceBoxRoll(request,values)}}
  onPreviewComplete={dice.completeRollRequestPreview} renderFreeRollControls={()=><div/>}/>}
 </>
}
createRoot(document.getElementById('root')!).render(<App/> )
