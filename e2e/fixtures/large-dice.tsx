import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import MapDiceRoller from '../../src/components/map/MapDiceRoller'
import { mixedDiceSides } from '../../src/components/map/mapFreeDiceRoll'
import Overlays from '../../src/presentation/maps/DicePresentationOverlays'
import { useDicePresentation } from '../../src/presentation/maps/useDicePresentation'
import '../../src/index.css'

function App() {
  const isDM = new URLSearchParams(location.search).has('dm')
  const channel = useMemo(() => new BroadcastChannel('large-dice-verification'), [])
  const dice = useDicePresentation(() => 1)
  const { setRollRequestPreview } = dice
  const [result, setResult] = useState<number[]>([])
  useEffect(() => {
    if (!isDM) return
    const receive = ({ data }: MessageEvent<{ id: string; values: number[]; dieSides: number[] }>) => {
      setResult(data.values)
      setRollRequestPreview({ id: data.id, kind: 'dice', count: data.values.length,
        sides: 6, dieSides: data.dieSides, values: data.values,
        total: data.values.reduce((a, b) => a + b, 0), label: '远古龙吐息测试', targetName: '玩家自由投掷' })
    }
    channel.addEventListener('message', receive)
    return () => channel.removeEventListener('message', receive)
  }, [isDM, channel, setRollRequestPreview])
  return <>
    <output data-testid="large-pool-result">{JSON.stringify(result)}</output>
    <Overlays {...dice} historyScope={`large-pool-${isDM ? 'dm' : 'player'}`} isDM={isDM}
      activeRollStatus={null} dockTab="dice" onRollDone={() => {}} onSecretConfirm={() => {}}
      onD20Complete={dice.completeDiceBoxD20} onDiceComplete={dice.completeDiceBoxRoll}
      onPreviewComplete={dice.completeRollRequestPreview}
      renderFreeRollControls={() => <MapDiceRoller embedded isDm={isDM} canCheck={false} headlessCheck pending={false}
        turnEconomy={{ turnKey: 'fixture', attacksUsed: 0, action: { current: 1, max: 1 }, bonusAction: { current: 1, max: 1 }, reaction: { current: 1, max: 1 } }}
        onCheck={() => {}} onRoll={async request => {
          const dieSides = mixedDiceSides(request.groups ?? [{ count: request.count, sides: request.sides }])
          const values = dieSides.map((sides, index) => index % sides + 1)
          const id = Date.now()
          channel.postMessage({ id: String(id), values, dieSides })
          const completed = await new Promise<number[]>(resolve => dice.setDiceBoxRoll({
            id, requestKey: String(id), count: values.length, totalCount: values.length, sides: request.sides,
            dieSides, values, label: request.label, targetName: '远古龙吐息测试', resolve,
          }))
          setResult(completed)
        }} />}
    />
  </>
}
createRoot(document.getElementById('root')!).render(<App />)
