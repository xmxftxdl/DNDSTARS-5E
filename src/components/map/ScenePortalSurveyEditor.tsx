import { useState } from 'react'
import type { ScenePortalSurvey } from '../../lib/scenePortalSurvey'

export function ScenePortalSurveyEditor(props: {
  value?: ScenePortalSurvey
  center: { x: number; y: number }
  onChange: (value: ScenePortalSurvey | undefined) => void
}) {
  const [plane, setPlane] = useState('')
  const [east, setEast] = useState(0)
  const [north, setNorth] = useState(0)
  const [height, setHeight] = useState(0)
  const survey = props.value
  const inputClass = 'w-full rounded border border-white/10 bg-void-950 p-1 text-xs text-slate-200'
  return <fieldset className="mt-3 space-y-2 rounded border border-violet-300/15 p-2">
    <legend className="text-xs text-violet-100">位面传送门侦测资料</legend>
    <label className="flex items-center gap-2 text-xs text-slate-300">
      <input type="checkbox" checked={!!survey} onChange={event => props.onChange(event.target.checked ? {
        centerX: props.center.x, centerY: props.center.y, elevationFeet: 0, radiusFeet: 5280, externalPortals: [],
      } : undefined)} />已记录下列范围内的全部位面传送门
    </label>
    <p className="text-[11px] text-slate-400">仅在资料完整时启用。覆盖区域为球形，角色的整个侦测范围必须包含在内；一英里为 5280 尺。</p>
    {survey && <>
      <div className="grid grid-cols-2 gap-2">
        {([
          ['centerX', '覆盖中心 X（地图坐标）'], ['centerY', '覆盖中心 Y（地图坐标）'],
          ['elevationFeet', '覆盖中心高度（尺）'], ['radiusFeet', '完整覆盖半径（尺）'],
        ] as const).map(([key, label]) => <label key={key} className="text-[11px] text-slate-400">{label}
          <input aria-label={label} type="number" className={inputClass} value={survey[key]}
            onChange={event => {
              const value = Number(event.target.value)
              if (Number.isFinite(value) && (key !== 'radiusFeet' || (value > 0 && value <= 1_000_000)))
                props.onChange({ ...survey, [key]: value })
            }} />
        </label>)}
      </div>
      <p className="text-[11px] text-slate-400">当前地图的入口使用触发区中标记的传送门。地图外入口可在下方补录：东、北距离相对覆盖中心，高度为绝对高度。</p>
      {survey.externalPortals.map((portal, index) => <div key={index} className="flex items-center gap-2 text-[11px] text-slate-300">
        <input aria-label={`启用地图外传送门 ${index + 1}`} type="checkbox" checked={portal.enabled}
          onChange={event => props.onChange({ ...survey, externalPortals: survey.externalPortals.map((p, i) =>
            i === index ? { ...p, enabled: event.target.checked } : p) })} />
        <span className="flex-1">{portal.destinationPlane} · 东 {portal.eastFeet} / 北 {portal.northFeet} / 高 {portal.elevationFeet} 尺</span>
        <button type="button" onClick={() => props.onChange({ ...survey, externalPortals: survey.externalPortals.filter((_, i) => i !== index) })}>删除</button>
      </div>)}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-slate-400">目标位面<input aria-label="地图外传送门目标位面" value={plane} maxLength={120} className={inputClass} onChange={event => setPlane(event.target.value)} /></label>
        {([['向东距离（尺）', east, setEast], ['向北距离（尺）', north, setNorth], ['入口绝对高度（尺）', height, setHeight]] as const).map(([label, value, change]) =>
          <label key={label} className="text-[11px] text-slate-400">{label}<input aria-label={label} type="number" value={value} className={inputClass}
            onChange={event => { const n = Number(event.target.value); if (Number.isFinite(n)) change(n) }} /></label>)}
      </div>
      <button type="button" disabled={!plane.trim() || /[\u0000-\u001f\u007f]/.test(plane) || survey.externalPortals.length >= 100}
        className="rounded bg-violet-500/20 px-2 py-1 text-xs text-violet-100 disabled:opacity-40"
        onClick={() => { props.onChange({ ...survey, externalPortals: [...survey.externalPortals,
          { destinationPlane: plane.trim(), eastFeet: east, northFeet: north, elevationFeet: height, enabled: true }] }); setPlane('') }}>
        添加地图外入口
      </button>
    </>}
  </fieldset>
}
