import{useEffect,useState}from'react'
import{validDnd5eSceneWeatherFacts,type Dnd5eSceneWeatherFactsV1}from'../../../shared/dnd5e-scene-weather-facts.mjs'
/** Host scene editor. An unrecorded scene never silently becomes dry or calm. */
export function SceneWeatherFactsFields({mapId,value,onChange}:{mapId:string;value?:Dnd5eSceneWeatherFactsV1;onChange:(facts:Dnd5eSceneWeatherFactsV1|undefined)=>void}){
 const signature=JSON.stringify(value??null),[raining,setRaining]=useState(''),[wind,setWind]=useState(''),[speed,setSpeed]=useState(''),[direction,setDirection]=useState('')
 useEffect(()=>{const facts=JSON.parse(signature)as Dnd5eSceneWeatherFactsV1|null;setRaining(facts?facts.raining?'yes':'no':'');setWind(facts?facts.wind?'yes':'no':'');setSpeed(facts?.wind?String(facts.wind.speedMph):'');setDirection(facts?.wind?String(facts.wind.directionDegrees):'')},[mapId,signature])
 const draft={schemaVersion:1,raining:raining==='yes',wind:wind==='yes'?{speedMph:Number(speed),directionDegrees:Number(direction)}:null},ready=!!raining&&!!wind&&(wind!=='yes'||speed.trim()!==''&&direction.trim()!=='')&&validDnd5eSceneWeatherFacts(draft),field='w-full rounded border border-white/15 bg-void-900 px-2 py-1 text-xs text-slate-100'
 return <details className="relative text-xs"><summary className="cursor-pointer rounded px-2 py-1 text-slate-300 hover:bg-white/5">实际天气</summary><div className="absolute left-0 top-full z-40 mt-1 grid w-64 gap-2 rounded-lg border border-white/15 bg-void-950 p-3 shadow-xl">
  <p className="text-[11px] text-slate-400">记录场景中的实际降雨和风况，供角色能力使用。</p>
  <label className="grid gap-1">实际降雨<select aria-label="实际降雨" className={field} value={raining} onChange={e=>setRaining(e.target.value)}><option value="">请选择</option><option value="yes">正在下雨</option><option value="no">没有下雨</option></select></label>
  <label className="grid gap-1">实际风况<select aria-label="实际风况" className={field} value={wind} onChange={e=>setWind(e.target.value)}><option value="">请选择</option><option value="yes">有风</option><option value="no">无风</option></select></label>
  {wind==='yes'&&<><label className="grid gap-1">风速（英里／小时）<input aria-label="实际风速（英里每小时）" type="number" min="0" step="any" className={field} value={speed} onChange={e=>setSpeed(e.target.value)}/></label><label className="grid gap-1">风吹向（0°北，90°东）<input aria-label="实际风向（度）" type="number" min="0" max="359.999999" step="any" className={field} value={direction} onChange={e=>setDirection(e.target.value)}/></label></>}
  <div className="flex gap-2"><button type="button" disabled={!ready} className="rounded bg-sky-500/20 px-2 py-1 text-sky-100 disabled:opacity-40" onClick={()=>{if(ready&&validDnd5eSceneWeatherFacts(draft))onChange(draft)}}>保存实际天气</button>{value!==undefined&&<button type="button" className="rounded px-2 py-1 text-slate-400 hover:bg-white/5" onClick={()=>onChange(undefined)}>清除记录</button>}</div>
 </div></details>
}
