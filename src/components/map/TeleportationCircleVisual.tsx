import { useRef } from 'react'
import Konva from 'konva'
import { Arc, Circle, Group, Line, Text } from 'react-konva'
import { useMapStore, type BattleMap, type Dnd5ePluginArea } from '../../store/maps'
import { cellToPixel } from '../../lib/gridCombat'
import { usePrefersReducedMotion, useStatusAnimation } from './mapEffectHooks'

function PortalRing({ x, y, radius, label }: { x: number; y: number; radius: number; label: string }) {
  const ring = useRef<Konva.Group>(null)
  const current = useRef<Konva.Group>(null)
  const reduced = usePrefersReducedMotion()
  const ink = label === '传送出口' ? '#c4b5fd' : '#67e8f9'
  const glow = label === '传送出口' ? '#8b5cf6' : '#22d3ee'
  useStatusAnimation(() => ring.current?.getLayer() ?? null, frame => {
    const time = frame?.time ?? 0
    ring.current?.rotation(time / 900)
    current.current?.rotation(-time / 240)
    current.current?.opacity(.65 + Math.sin(time / 1300) * .18)
  }, { active: !reduced, fps: 16 })
  return <Group x={x} y={y} listening={false}>
    <Circle radius={radius} fill="#071a2b55" stroke={ink} strokeWidth={1.2} shadowColor={glow} shadowBlur={8} />
    {/* Normalized coordinates keep the engraved details consistent at every grid size. */}
    <Group scaleX={radius / 100} scaleY={radius / 100}>
      <Circle radius={96} stroke={ink} strokeWidth={.65} opacity={.65} />
      <Circle radius={76} stroke={ink} strokeWidth={1} />
      <Circle radius={72} stroke={ink} strokeWidth={.5} opacity={.65} />
      <Group ref={ring}>
        {Array.from({ length: 24 }, (_, i) => <Group key={i} rotation={i * 15}>
          <Line points={i % 3 === 0
            ? [-3, -81, -3, -90, 3, -87, -3, -84, 3, -81]
            : i % 3 === 1 ? [-3, -83, 0, -90, 3, -83, -3, -86, 3, -86]
              : [-3, -90, 3, -87, -3, -84, 3, -81, 3, -90]}
            stroke={ink} strokeWidth={1.2} lineCap="round" lineJoin="round" />
        </Group>)}
      </Group>
      <Group opacity={.65}>
        <Line points={[0, -69, 59.8, 34.5, -59.8, 34.5]} closed stroke={ink} strokeWidth={1} />
        <Line points={[0, 69, -59.8, -34.5, 59.8, -34.5]} closed stroke={ink} strokeWidth={1} />
        <Circle radius={34.5} stroke={ink} strokeWidth={.7} />
        <Circle radius={29} stroke={ink} strokeWidth={.5} />
      </Group>
      {Array.from({ length: 6 }, (_, i) => <Group key={i} rotation={i * 60}>
        <Circle y={-69} radius={3} fill="#e0faff" shadowColor={glow} shadowBlur={5} />
        <Line points={[0, -22, 0, -13]} stroke={ink} strokeWidth={1} />
      </Group>)}
      <Line points={[0, -11, 7, 0, 0, 11, -7, 0]} closed stroke="#ecfeff" strokeWidth={1.2} fill={`${glow}44`} />
      <Group ref={current} opacity={.75}>
        {[0, 120, 240].map(rotation => <Arc key={rotation} rotation={rotation} angle={28}
          innerRadius={97} outerRadius={99} fill="#ecfeff" shadowColor={glow} shadowBlur={7} />)}
      </Group>
    </Group>
    <Text text={label} x={-radius} y={radius + 4} width={radius * 2} align="center"
      fontSize={Math.max(9, radius * .15)} fill="#ecfeff" shadowColor="#020617" shadowBlur={3} />
  </Group>
}

export function TeleportationCircleVisual({ map, area }: { map: BattleMap; area: Dnd5ePluginArea }) {
  if (!area.anchorCell) return null
  return <PortalRing {...cellToPixel(area.anchorCell, map)} radius={5 * map.gridSize / (map.feetPerCell ?? 5)} label="传送入口" />
}

export function TeleportationCircleDestinations({ map }: { map: BattleMap }) {
  const maps = useMapStore(state => state.maps)
  return <>{maps.flatMap(source => (source.dnd5ePluginAreas ?? []).flatMap(area => {
    const exit = area.teleportationExit
    return exit?.mapId === map.id ? [<PortalRing key={area.id} x={exit.x} y={exit.y} radius={5 * map.gridSize / (map.feetPerCell ?? 5)} label="传送出口" />] : []
  }))}</>
}
