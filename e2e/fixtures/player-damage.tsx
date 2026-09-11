import React, { useState, useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import Overlays from '../../src/presentation/maps/DicePresentationOverlays'
import { useDicePresentation } from '../../src/presentation/maps/useDicePresentation'
import { performPlayerDiceRoll, isPlayerDiceRollRequestForClient, playerDiceRollResultValues, receivePlayerDicePresentation } from '../../src/pages/maps/playerDiceRoll'
import type { SharedRollRequestEvent } from '../../src/lib/sharedCombatTypes'
import '../../src/index.css'

function App() {
  const count = Number(new URLSearchParams(location.search).get('count')) || 4
  const sides = Number(new URLSearchParams(location.search).get('sides')) || 10
  const isDM = new URLSearchParams(location.search).has('dm')
  const channel = useMemo(() => new BroadcastChannel('player-dice-mirror-fixture'), [])
  const [request, setRequest] = useState<SharedRollRequestEvent | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('等待玩家投掷')
  const dice = useDicePresentation(() => 1)
  useEffect(() => {
    if (!isDM) return
    const pending = { kind: 'dice' as const, count, sides, targetCharacterId: 'wizard',
      resolve: (values: number[]) => setResult(`DM mirrored ${values.join(',')}`) }
    channel.onmessage = ({ data }) => receivePlayerDicePresentation(data, pending, values => new Promise<void>(resolve => {
      dice.setDiceBoxRoll({ id: 1, requestKey: `${data.requestId}:player-authority`, count: count,
        totalCount: count, sides, values, label: data.label, targetName: data.targetName,
        resolve: () => resolve() })
    }))
    return () => { channel.onmessage = null }
  }, [isDM, channel, count, sides, dice.setDiceBoxRoll])
  const receive = () => {
    const event: SharedRollRequestEvent = { eventId: 'fire-bolt-damage', requestId: 'damage', mapId: 'test',
      kind: 'dice', count, sides, values: [], label: sides === 4 ? '强酸箭·伤害' : '火焰箭·伤害', targetName: '牛头人',
      sourceMode: 'dm', targetCharacterId: 'wizard', delivery: 'player-roll-request', updatedAt: Date.now() }
    if (isPlayerDiceRollRequestForClient({event, mode: 'player', spectator: false, controlledCharacterIds: new Set(['wizard'])})) setRequest(event)
  }
  const confirm = async () => {
    if (!request || busy) return
    setBusy(true)
    const values = await performPlayerDiceRoll(request, () => Math.min(7, sides), async values => {
      channel.postMessage({...request, sourceMode: 'player', delivery: 'player-roll-start', values})
      return new Promise(resolve => {
      dice.setDiceBoxRoll({ id: 1, requestKey: request.requestId, count: request.count, totalCount: request.count,
        sides: request.sides, values: values, label: request.label, targetName: request.targetName, resolve })
    })})
    channel.postMessage({...request, sourceMode: 'player', delivery: 'player-roll-result', values})
    const accepted = playerDiceRollResultValues({...request, sourceMode: 'player', delivery: 'player-roll-result', values}, request)
    setResult(`DM 收到 ${accepted?.length} 枚伤害骰，总计 ${accepted?.reduce((sum,value)=>sum+value,0)}`)
    setRequest(null)
    setBusy(false)
  }
  return <><button onClick={receive}>命中后请求伤害骰</button><p>{result}</p>
    <Overlays {...dice} isDM={isDM} activeRollStatus={null} dockTab="dice"
      playerRollPrompt={request ? {id: request.requestId, label: request.label, targetName: request.targetName, count, sides, busy}:null}
      renderFreeRollControls={() => <div>玩家骰盘</div>} onPlayerRoll={confirm}
      onD20Complete={dice.completeDiceBoxD20} onDiceComplete={dice.completeDiceBoxRoll}
      onPreviewComplete={dice.completeRollRequestPreview} onRollDone={()=>dice.setRoll(null)} onSecretConfirm={()=>{}} />
  </>
}
createRoot(document.getElementById('root')!).render(<App />)
