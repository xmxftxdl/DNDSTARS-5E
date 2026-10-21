import type { VerticalMaterialSurface } from './verticalMaterialSurface'
import { MAP_SURFACE_MATERIALS } from '../../lib/mapSurfaceMaterials'

/** Serializable rendering projection; this is not proof that a cast may target the face. */
export function normalizeVerticalSurfaceProjection(value: unknown,allowFragments=true): VerticalMaterialSurface | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const v = value as Record<string, unknown>
  const keys = ['entityId', 'edgeIndex', 'a', 'b', 'outward', 'baseElevationFeet', 'heightFeet', 'material', 'attachment', 'fragments']
  if (Object.keys(v).some(key => !keys.includes(key)) ||
    typeof v.entityId !== 'string' || !v.entityId.trim() || v.entityId.length > 256 ||
    typeof v.edgeIndex !== 'number' || !Number.isSafeInteger(v.edgeIndex) || v.edgeIndex < 0 ||
    typeof v.baseElevationFeet !== 'number' || !Number.isFinite(v.baseElevationFeet) ||
    typeof v.heightFeet !== 'number' || !Number.isFinite(v.heightFeet) || v.heightFeet <= 0 ||
    !(MAP_SURFACE_MATERIALS as readonly unknown[]).includes(v.material)) return undefined
  const point = (raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
    const p = raw as Record<string, unknown>
    if (Object.keys(p).some(key => key !== 'x' && key !== 'y') ||
      typeof p.x !== 'number' || typeof p.y !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return undefined
    return { x: p.x, y: p.y }
  }
  const a = point(v.a), b = point(v.b), outward = point(v.outward)
  if (!a || !b || !outward) return undefined
  let attachment: VerticalMaterialSurface['attachment']
  if(v.attachment!=null){
    if(typeof v.attachment!=='object'||Array.isArray(v.attachment))return undefined
    const binding=v.attachment as Record<string,unknown>
    if(Object.keys(binding).some(key=>!['centerFraction','widthFeet','baseOffsetFeet'].includes(key)) ||
      ![binding.centerFraction,binding.widthFeet,binding.baseOffsetFeet].every(n=>typeof n==='number'&&Number.isFinite(n)) ||
      (binding.centerFraction as number)<0 || (binding.centerFraction as number)>1 || (binding.widthFeet as number)<=0 || (binding.baseOffsetFeet as number)<0)return undefined
    attachment={centerFraction:binding.centerFraction as number,widthFeet:binding.widthFeet as number,baseOffsetFeet:binding.baseOffsetFeet as number}
  }
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy)
  if (!Number.isFinite(length) || length <= 1e-7 ||
    Math.abs(Math.hypot(outward.x, outward.y) - 1) > 1e-6 ||
    Math.abs(dx / length * outward.x + dy / length * outward.y) > 1e-6) return undefined
  let fragments:VerticalMaterialSurface['fragments']
  if(v.fragments!=null){
    if(!allowFragments||!Array.isArray(v.fragments)||!v.fragments.length||v.fragments.length>256)return undefined
    fragments=[]
    for(const part of v.fragments){
      if(!part||typeof part!=='object'||Object.keys(part).some(k=>!['surface','leftFeet','bottomFeet','widthFeet','heightFeet','reversed'].includes(k))||
        ![part.leftFeet,part.bottomFeet,part.widthFeet,part.heightFeet].every(n=>typeof n==='number'&&Number.isFinite(n))||
        part.leftFeet<0||part.bottomFeet<0||part.widthFeet<=0||part.heightFeet<=0||typeof part.reversed!=='boolean')return undefined
      const surface=normalizeVerticalSurfaceProjection(part.surface,false)
      if(!surface?.attachment||Math.abs(surface.attachment.widthFeet-part.widthFeet)>1e-6||Math.abs(surface.heightFeet-part.heightFeet)>1e-6||part.bottomFeet+part.heightFeet>v.heightFeet+1e-6)return undefined
      fragments.push({surface,leftFeet:part.leftFeet,bottomFeet:part.bottomFeet,widthFeet:part.widthFeet,heightFeet:part.heightFeet,reversed:part.reversed})
    }
    const first=fragments[0],scale=Math.hypot(first.surface.b.x-first.surface.a.x,first.surface.b.y-first.surface.a.y)/first.widthFeet
    const width=length/scale
    if(!Number.isFinite(scale)||scale<=0||!Number.isFinite(width))return undefined
    for(let i=0;i<fragments.length;i++){
      const part=fragments[i],partScale=Math.hypot(part.surface.b.x-part.surface.a.x,part.surface.b.y-part.surface.a.y)/part.widthFeet
      if(part.leftFeet+part.widthFeet>width+1e-6||Math.abs(partScale-scale)>1e-6*Math.max(1,scale))return undefined
      for(let j=0;j<i;j++){
        const other=fragments[j]
        if(Math.min(part.leftFeet+part.widthFeet,other.leftFeet+other.widthFeet)-Math.max(part.leftFeet,other.leftFeet)>1e-7 &&
          Math.min(part.bottomFeet+part.heightFeet,other.bottomFeet+other.heightFeet)-Math.max(part.bottomFeet,other.bottomFeet)>1e-7)return undefined
      }
    }
  }
  return { entityId: v.entityId, edgeIndex: v.edgeIndex, a, b, outward,
    baseElevationFeet: v.baseElevationFeet, heightFeet: v.heightFeet,
    material: v.material as VerticalMaterialSurface['material'],...(attachment?{attachment}:{}),...(fragments?{fragments}:{}) }
}
