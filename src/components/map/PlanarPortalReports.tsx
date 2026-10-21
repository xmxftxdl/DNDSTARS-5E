import type { Dnd5ePlanarPortalReceipt } from '../../rulesets/dnd5e/planarPortalReport'

export function PlanarPortalReports({ reports }: { reports: readonly Dnd5ePlanarPortalReceipt[] }) {
  const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return <>{reports.map(receipt => {
    const result = receipt.report
    const bearing = result.status === 'found' ? directions[Math.round(result.bearingDegrees / 45) % 8] : ''
    const direction = result.status === 'found' && Math.abs(result.elevationDegrees) >= 89.5
      ? (result.elevationDegrees > 0 ? '正上方' : '正下方') : `${bearing}方`
    return <div key={receipt.sourceActivityId} data-testid="planar-portal-report"
      className="rounded-lg border border-violet-300/20 bg-violet-500/5 p-2 text-xs text-violet-100">
      <div className="font-semibold">位面传送门 · 上次侦测结果</div>
      <div className="mt-1">{result.status === 'none'
        ? `${receipt.rangeFeet} 尺范围内未发现位面传送门。`
        : `最近入口在${direction}，距离 ${Math.round(result.distanceFeet * 10) / 10} 尺。${
          Math.abs(result.elevationDegrees) >= 0.5 && Math.abs(result.elevationDegrees) < 89.5
            ? `向${result.elevationDegrees > 0 ? '上' : '下'} ${Math.round(Math.abs(result.elevationDegrees))}°。` : ''}`}</div>
      <div className="mt-1 text-[11px] text-slate-400">以侦测时的位置为准，移动后不会自动更新。</div>
    </div>
  })}</>
}
