import type {MapGeometryEntityPatch,MapGeometryObstacle} from '../../lib/mapGeometry'
import {normalizeControlledWaterState} from '../../../shared/controlled-water-state.mjs'

export function createControlledWaterPatch(body:MapGeometryObstacle,feetPerPixel:number):MapGeometryEntityPatch|undefined{
 if(body.points.length<3||!Number.isFinite(feetPerPixel)||feetPerPixel<=0||body.heightFeet<=0)return undefined
 const xs=body.points.map(p=>p.x),ys=body.points.map(p=>p.y)
 const controlledWater=normalizeControlledWaterState({id:body.id,
  positionFeet:{x:(Math.min(...xs)+Math.max(...xs))/2*feetPerPixel,y:(Math.min(...ys)+Math.max(...ys))/2*feetPerPixel,z:body.baseHeightFeet},
  dimensionsFeet:{x:(Math.max(...xs)-Math.min(...xs))*feetPerPixel,y:(Math.max(...ys)-Math.min(...ys))*feetPerPixel,z:body.heightFeet},
  color:'#268fbc',opacity:0.45,alterations:[],appliedActionIds:[]})
 if(!controlledWater)return undefined
 return {controlledWater,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,terrainRegion:false,
  terrainElevationFeet:undefined,surfaceMaterial:undefined}
}

export function ControlledWaterFields({body,feetPerPixel,onChange}:{body:MapGeometryObstacle;feetPerPixel:number;onChange:(patch:MapGeometryEntityPatch)=>void}){
 const water=body.controlledWater,canCreate=!!createControlledWaterPatch(body,feetPerPixel)
 return <span className="flex flex-wrap items-center gap-2 text-[10px] text-sky-100">
  <label title="将所画多边形标记为水体；底高表示水底，高度表示水深。普通贴图不会自动识别为水。">
   <input type="checkbox" checked={!!water} disabled={!water&&!canCreate}
    onChange={event=>{const patch=event.target.checked?createControlledWaterPatch(body,feetPerPixel):{controlledWater:undefined};if(patch)onChange(patch)}}/> 水体（供操水术选择）
  </label>
  {!water&&!canCreate&&<span>请先画出水域，并设置大于 0 的水深。</span>}
  {water&&<>
   <label>水色<input type="color" aria-label="水体原始颜色" value={water.color}
    onChange={event=>onChange({controlledWater:{...water,color:event.target.value}})}/></label>
   <label>不透明度<input type="number" aria-label="水体原始不透明度" min={0} max={1} step={0.05} value={water.opacity}
    className="ml-1 w-14 rounded border border-white/10 bg-void-900 px-1"
    onChange={event=>{const opacity=Number(event.target.value);if(Number.isFinite(opacity)&&opacity>=0&&opacity<=1)onChange({controlledWater:{...water,opacity}})}}/></label>
   <span>底高为水底，高度为水深；操水术每次选取不超过 5 尺立方。</span>
  </>}
 </span>
}
