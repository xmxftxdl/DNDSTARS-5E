import {useEffect,useState} from 'react'
import {MAP_SURFACE_MATERIALS,type MapSurfaceMaterial} from '../../lib/mapSurfaceMaterials'
import {normalizeDnd5eMapObjectSurface,type Dnd5eMapObjectSurface} from '../../rulesets/dnd5e/mapObjectSurface'

const labels:Record<MapSurfaceMaterial,string>={solid:'其他坚实材质',sand:'沙',dust:'尘土','loose-earth':'松土',gravel:'碎石',stone:'石',ice:'冰',snow:'雪',earth:'泥土',mud:'泥浆',quicksand:'流沙'}
function draftFor(value:Dnd5eMapObjectSurface|undefined){return {material:value?.material??'',widthFeet:value?String(value.widthFeet):'',lengthFeet:value?String(value.lengthFeet):'',heightFeet:value?String(value.heightFeet):'',rotationDegrees:String(value?.rotationDegrees??0)}}
export function MapObjectSurfaceEditor({value,onChange}:{value:Dnd5eMapObjectSurface|undefined;onChange:(value:Dnd5eMapObjectSurface|undefined)=>void}){
  const [draft,setDraft]=useState(()=>draftFor(value))
  const material=value?.material??''
  const widthFeet=value?String(value.widthFeet):''
  const lengthFeet=value?String(value.lengthFeet):''
  const heightFeet=value?String(value.heightFeet):''
  const rotationDegrees=String(value?.rotationDegrees??0)
  const surfaceId=value?.surfaceId
  // Room snapshots recreate objects even when the saved surface has not changed.
  useEffect(()=>setDraft({material,widthFeet,lengthFeet,heightFeet,rotationDegrees}),
    [material,widthFeet,lengthFeet,heightFeet,rotationDegrees,surfaceId])
  const normalized=normalizeDnd5eMapObjectSurface({...(value?.surfaceId ? {surfaceId:value.surfaceId} : {}),material:draft.material,widthFeet:Number(draft.widthFeet),lengthFeet:Number(draft.lengthFeet),heightFeet:Number(draft.heightFeet),rotationDegrees:Number(draft.rotationDegrees)})
  return <details className="mt-2 rounded-lg border border-white/10 p-2 text-xs text-slate-300">
    <summary className="cursor-pointer">材质与实际尺寸{value?` · ${labels[value.material]}`:' · 未记录'}</summary>
    <label className="mt-2 block">材质<select aria-label="物件表面材质" className="ml-2 rounded bg-void-950 px-2 py-1" value={draft.material} onChange={event=>setDraft({...draft,material:event.target.value})}>
      <option value="">未记录</option>{MAP_SURFACE_MATERIALS.map(material=><option key={material} value={material}>{labels[material]}</option>)}
    </select></label>
    <div className="mt-2 grid grid-cols-2 gap-2">{(['widthFeet','lengthFeet','heightFeet','rotationDegrees'] as const).map((field,index)=><label key={field}>
      {['宽（尺）','长（尺）','高（尺）','旋转角度'][index]}
      <input type="number" aria-label={['物件实际宽度（尺）','物件实际长度（尺）','物件实际高度（尺）','物件表面旋转角度'][index]} value={draft[field]}
        min={field==='rotationDegrees'?0:0.001} max={field==='rotationDegrees'?359.999:100000} step="any" placeholder="未记录"
        onChange={event=>setDraft({...draft,[field]:event.target.value})} className="mt-1 w-full rounded bg-void-950 px-2 py-1"/>
    </label>)}</div>
    <p className="mt-2 text-slate-400">以物件中心定位，尺寸不改变图标占格。</p>
    <div className="mt-2 flex gap-2"><button type="button" disabled={!normalized} onClick={()=>normalized&&onChange(normalized)} className="rounded bg-violet-700 px-2 py-1 disabled:opacity-40">保存材质与尺寸</button>
      <button type="button" disabled={!value} onClick={()=>{onChange(undefined);setDraft(draftFor(undefined))}} className="rounded bg-white/10 px-2 py-1 disabled:opacity-40">清除记录</button></div>
  </details>
}
