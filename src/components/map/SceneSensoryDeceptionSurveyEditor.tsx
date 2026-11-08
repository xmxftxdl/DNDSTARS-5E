import { useState } from 'react'
import type { SceneSensoryDeceptionSurvey } from '../../lib/sceneSensoryDeceptionSurvey'

export function SceneSensoryDeceptionSurveyEditor(props: {
  value?: SceneSensoryDeceptionSurvey
  center: {x:number;y:number}
  onChange: (value: SceneSensoryDeceptionSurvey | undefined) => void
}) {
  const [point,setPoint] = useState({eastFeet:0,northFeet:0,elevationFeet:0})
  const [shape,setShape] = useState<'point'|'sphere'|'box'>('point')
  const [radius,setRadius] = useState(5)
  const [dimensions,setDimensions] = useState({east:5,north:5,height:5})
  const survey = props.value
  return <fieldset className="mt-3 space-y-2 rounded border border-violet-300/15 p-2">
    <legend className="text-xs text-violet-100">明察秋毫场景资料（仅 DM）</legend>
    <label className="flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={!!survey}
      onChange={event => props.onChange(event.target.checked ? {centerX:props.center.x,centerY:props.center.y,elevationFeet:0,radiusFeet:60,presences:[]} : undefined)} />
      已核对覆盖范围内所有欺骗感官的现象</label>
    <p className="text-[11px] text-slate-400">包括幻术、非原形的变形生物及欺骗感官的魔法。请记录范围内的所有现象，包括地图上已表示和地图外的现象；不必记录其真相。场景变化后请更新资料。</p>
    {survey && <>
      <div className="grid grid-cols-2 gap-2">{([
        ['centerX','明察资料中心 X'],['centerY','明察资料中心 Y'],['elevationFeet','明察资料中心高度（尺）'],['radiusFeet','明察资料覆盖半径（尺）'],
      ] as const).map(([key,label]) => <label key={key} className="text-xs text-slate-300">{label}<input type="number" aria-label={label}
        className="w-full rounded bg-void-950 p-1" value={survey[key]} onChange={event => {
          const n=Number(event.target.value)
          if(Number.isFinite(n) && (key!=='radiusFeet' || n>0 && n<=1_000_000))props.onChange({...survey,[key]:n})
        }} /></label>)}</div>
      {survey.presences.map((p,index) => <div key={index} className="text-xs text-slate-300">东 {p.eastFeet} / 北 {p.northFeet} / 高 {p.elevationFeet} 尺
        {p.radiusFeet!=null && <span> · 球形半径 {p.radiusFeet} 尺</span>}
        {p.halfExtentsFeet && <span> · 长方体 {p.halfExtentsFeet.east*2} × {p.halfExtentsFeet.north*2} × {p.halfExtentsFeet.height*2} 尺</span>}
        <button type="button" onClick={()=>props.onChange({...survey,presences:survey.presences.filter((_,i)=>i!==index)})}>删除现象 {index+1}</button></div>)}
      <div className="grid grid-cols-3 gap-2">{([['eastFeet','现象向东距离（尺）'],['northFeet','现象向北距离（尺）'],['elevationFeet','现象绝对高度（尺）']] as const).map(([key,label]) =>
        <label key={key} className="text-xs text-slate-300">{label}<input type="number" aria-label={label} value={point[key]} className="w-full rounded bg-void-950 p-1"
          onChange={event=>{const n=Number(event.target.value);if(Number.isFinite(n))setPoint({...point,[key]:n})}} /></label>)}</div>
      <label className="text-xs text-slate-300">现象形状<select aria-label="现象形状" value={shape} onChange={event=>setShape(event.target.value as typeof shape)} className="ml-2 rounded bg-void-950 p-1">
        <option value="point">点状</option><option value="sphere">球形</option><option value="box">长方体</option>
      </select></label>
      {shape==='sphere' && <label className="block text-xs text-slate-300">现象半径（尺）<input type="number" aria-label="现象半径（尺）" value={radius} className="w-full rounded bg-void-950 p-1"
        onChange={event=>{const n=Number(event.target.value);if(Number.isFinite(n)&&n>=0&&n<=1_000_000)setRadius(n)}} /></label>}
      {shape==='box' && <div className="grid grid-cols-3 gap-2">{([['east','现象东西长度（尺）'],['north','现象南北宽度（尺）'],['height','现象垂直高度（尺）']] as const).map(([key,label])=>
        <label key={key} className="text-xs text-slate-300">{label}<input type="number" aria-label={label} value={dimensions[key]} className="w-full rounded bg-void-950 p-1"
          onChange={event=>{const n=Number(event.target.value);if(Number.isFinite(n)&&n>=0&&n<=2_000_000)setDimensions({...dimensions,[key]:n})}} /></label>)}</div>}
      <button type="button" disabled={survey.presences.length>=100} onClick={()=>props.onChange({...survey,presences:[...survey.presences,{...point,
        ...(shape==='sphere'?{radiusFeet:radius}:{}),
        ...(shape==='box'?{halfExtentsFeet:{east:dimensions.east/2,north:dimensions.north/2,height:dimensions.height/2}}:{}),
      }]})}
        className="rounded bg-violet-500/20 px-2 py-1 text-xs text-violet-100">添加现象</button>
    </>}
  </fieldset>
}
