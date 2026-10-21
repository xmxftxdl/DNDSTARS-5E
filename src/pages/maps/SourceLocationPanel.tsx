import { useMapStore } from '../../store/maps'

/** Only displays the location-only tokens authorized by the room projection. */
export default function SourceLocationPanel({ activeMapId }: { activeMapId: string }) {
  const maps = useMapStore(state => state.maps)
  const locations = maps.flatMap(map => map.id === activeMapId ? [] : map.tokens
    .filter(token => token.sourceLocationKnown === true && token.perceptionVisibility === 'detected-unseen')
    .map(token => ({ map, token })))
  if (!locations.length) return null
  return <details data-testid="source-location-panel" className="absolute left-1/2 top-14 z-30 w-max max-w-xs -translate-x-1/2 rounded-lg border border-violet-400/40 bg-slate-950/95 p-2 text-xs text-violet-100">
    <summary className="cursor-pointer">异地定位（{locations.length}）</summary>
    <p className="my-2 text-slate-400">你知道目标的位置，但无法因此看见目标。</p>
    <ul className="space-y-1">
      {locations.map(({ map, token }) => <li key={`${map.id}:${token.id}`}>
        {map.name} · 格子（{Math.floor((token.x - (map.gridOffsetX ?? 0)) / map.gridSize) + 1}，
        {Math.floor((token.y - (map.gridOffsetY ?? 0)) / map.gridSize) + 1}）
        {Number.isFinite(token.elevationFeet) ? ` · 高度 ${token.elevationFeet} 尺` : ''}
      </li>)}
    </ul>
  </details>
}
