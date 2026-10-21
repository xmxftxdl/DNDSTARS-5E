import {wallSurfaceRayIntervals} from './wall-surface-sections.mjs'
import {rectangularPrismRayInterval} from './rectangular-prism.mjs'
import { stoneWallIntersects } from './stone-wall-geometry.mjs'
import { forceShellCrosses } from './force-shell-geometry.mjs'
import { persistentAreaHeightSlices } from './persistent-area-columns.mjs'
import { groveVolumeOverlaps } from './grove-volume.mjs'
import { annularAreaRayIntervals } from './annular-area-geometry.mjs'

// Partition a Grove ray at every structure edge and height change. Sampling
// fixed distances can miss narrow outdoor remnants beside a building.
function groveRayIntersects(input, area, interval) {
  const volume = area.groveVolume
  const dx = input.to.x - input.from.x, dy = input.to.y - input.from.y
  const z = input.fromElevationFeet + input.fromEyeHeightFeet
  const dz = input.toElevationFeet + input.toEyeHeightFeet - z
  const cuts = [interval[0], interval[1]]
  const add = t => { if (t > interval[0] && t < interval[1]) cuts.push(t) }
  const cube = [{x:volume.minX,y:volume.minY},{x:volume.minX+volume.widthPixels,y:volume.minY},
    {x:volume.minX+volume.widthPixels,y:volume.minY+volume.widthPixels},{x:volume.minX,y:volume.minY+volume.widthPixels}]
  for (const points of [cube, ...volume.excludedStructures.map(s => s.points)]) {
    for (let i=0;i<points.length;i++) {
      const a=points[i], b=points[(i+1)%points.length], ex=b.x-a.x, ey=b.y-a.y
      const qx=a.x-input.from.x, qy=a.y-input.from.y, denominator=dx*ey-dy*ex
      if (Math.abs(denominator)<1e-12) continue
      const t=(qx*ey-qy*ex)/denominator, u=(qx*dy-qy*dx)/denominator
      if (u>=0&&u<=1) add(t)
    }
  }
  const heights=[volume.baseElevationFeet,volume.baseElevationFeet+volume.heightFeet,
    ...volume.excludedStructures.flatMap(s=>[s.baseElevationFeet,s.baseElevationFeet+s.heightFeet])]
  if(area.vertical?.mode==='volume') heights.push(area.vertical.baseElevationFeet,area.vertical.baseElevationFeet+area.vertical.heightFeet)
  if(Math.abs(dz)>1e-12) for(const height of heights) add((height-z)/dz)
  cuts.sort((a,b)=>a-b)
  for(let i=1;i<cuts.length;i++) {
    if(cuts[i]-cuts[i-1]<1e-12)continue
    const t=(cuts[i]+cuts[i-1])/2, height=z+dz*t
    if(groveVolumeOverlaps(volume,{x:input.from.x+dx*t,y:input.from.y+dy*t},height)&&
      input.overlapsHeight(area,height,0.1))return true
  }
  return false
}

function cellRayInterval(from, to, left, top, width, height = width) {
  let lower = 0, upper = 1
  for (const [start, delta, minimum, maximum] of [
    [from.x, to.x - from.x, left, left + width],
    [from.y, to.y - from.y, top, top + height],
  ]) {
    if (Math.abs(delta) < 1e-12) {
      if (start < minimum || start >= maximum) return undefined
      continue
    }
    const a = (minimum - start) / delta, b = (maximum - start) / delta
    lower = Math.max(lower, Math.min(a, b)); upper = Math.min(upper, Math.max(a, b))
    if (lower > upper) return undefined
  }
  return [lower, upper]
}

/** Match the persistent rectangle's saved axes, not its inflated selection cells. */
function rectangleRay(area, map, from, to) {
  const geometry = area.rectGeometry, anchor = area.anchorCell
  if (!geometry || geometry.gridAligned || !anchor) return undefined
  const scale = (map.feetPerCell ?? 5) / Math.max(1, map.gridSize)
  const centerX = (map.gridOffsetX ?? 0) + (anchor.col + .5) * map.gridSize
  const centerY = (map.gridOffsetY ?? 0) + (anchor.row + .5) * map.gridSize
  const { dc, dr } = geometry.direction
  const local = point => ({ x: ((point.x - centerX) * dc + (point.y - centerY) * dr) * scale,
    y: (-(point.x - centerX) * dr + (point.y - centerY) * dc) * scale })
  const left = -geometry.lengthFeet / 2, top = -geometry.widthFeet / 2
  return {
    interval: cellRayInterval(local(from), local(to), left, top, geometry.lengthFeet, geometry.widthFeet),
    contains: point => { const p = local(point); return p.x >= left && p.x <= -left && p.y >= top && p.y <= -top },
  }
}

/** Shared boundary and panel geometry; callers supply terrain/anchor height resolution. */
export function persistentAreaBlocksRay(input) {
  const areas = input.map.dnd5ePluginAreas ?? []
  if (areas.length === 0) return undefined
  const gridSize = Math.max(1, input.map.gridSize)
  const offsetX = input.map.gridOffsetX ?? 0
  const offsetY = input.map.gridOffsetY ?? 0
  const distance = Math.hypot(input.to.x - input.from.x, input.to.y - input.from.y)
  const steps = Math.max(2, Math.ceil(distance / Math.max(1, gridSize / 4)))
  for (const area of areas.flatMap(persistentAreaHeightSlices)) {
    const blocks = input.purpose === 'opaque-cover'
      ? area.blocking?.vision === true && area.blocking?.lineOfEffect === true
      : input.purpose === 'vision'
      ? area.blocking?.vision
      : input.purpose === 'movement'
        ? (area.blocking?.movementMode ?? 'occupancy') === 'occupancy'
          ? area.blocking?.movement
          : false
        : input.purpose === 'ordinary-projectile'
          ? area.windBarrier === true || (area.sourceKind === 'core-spell' && area.coreSpellId === 'wind-wall')
          : input.purpose === 'ranged-weapon-disadvantage'
            ? area.blocking?.rangedWeaponAttackDisadvantage != null
          : input.purpose === 'damage-attenuation'
            ? area.blocking?.halvedDamageTypes?.includes(input.damageType) === true
          : area.blocking?.lineOfEffect
    if (blocks !== true) continue
    if(area.wallSurfaceSections!=null || area.rectGeometry?.pitchDegrees || area.rectGeometry?.rollDegrees ||
      input.purpose==='vision' && area.rectGeometry && !area.rectGeometry.gridAligned && area.vertical?.mode==='volume' && !area.vertical.shape){
      const hits=persistentAreaVolumeRayIntersections({...input,area,
        fromElevationFeet:input.fromElevationFeet+input.fromEyeHeightFeet,
        toElevationFeet:input.toElevationFeet+input.toEyeHeightFeet})
      if(!hits.length)continue
      if(input.purpose==='vision'&&area.blocking?.visionMode==='outside-in'&&hits[0].fromT<=1e-9)continue
      const boundary=(input.purpose==='line-of-effect'||input.purpose==='opaque-cover')&&area.blocking?.lineOfEffectMode==='boundary'||
        input.purpose==='ranged-weapon-disadvantage'&&area.blocking?.rangedWeaponAttackDisadvantage==='boundary'
      let covered=0
      for(const hit of hits){if(hit.fromT>covered+1e-9)break;covered=Math.max(covered,hit.toT)}
      if(boundary&&covered>=1-1e-9)continue
      return area.id
    }
    if (area.circularGeometry?.innerRadiusFeet != null) {
      const bands = annularAreaRayIntervals(area,input.map,input.from,input.to)
      const z = input.fromElevationFeet + input.fromEyeHeightFeet
      const dz = input.toElevationFeet + input.toEyeHeightFeet - z
      const intervals=[]
      for (const cell of area.cells) {
        const clip = cellRayInterval(input.from,input.to,offsetX+cell.col*gridSize,offsetY+cell.row*gridSize,gridSize)
        if (!clip) continue
        for (const band of bands) {
          const start=Math.max(clip[0],band[0]), end=Math.min(clip[1],band[1])
          if (start >= end) continue
          const a=z+dz*start,b=z+dz*end
          if(input.overlapsHeight(area,Math.min(a,b),Math.abs(b-a)+.1))intervals.push([start,end])
        }
      }
      if (!intervals.length) continue
      intervals.sort((a,b)=>a[0]-b[0])
      if(input.purpose==='vision'&&area.blocking?.visionMode==='outside-in'&&intervals[0][0]===0)continue
      const boundary=input.purpose==='ranged-weapon-disadvantage'&&area.blocking?.rangedWeaponAttackDisadvantage==='boundary'
        ||(input.purpose==='line-of-effect'||input.purpose==='opaque-cover')&&area.blocking?.lineOfEffectMode==='boundary'
      if(!boundary)return area.id
      let covered=0
      for(const[start,end]of intervals){if(start>covered+1e-9)return area.id;covered=Math.max(covered,end)}
      if(covered<1-1e-9)return area.id
      continue
    }
    if (area.groveVolume && input.purpose === 'ordinary-projectile') {
      for (const cell of area.cells) {
        const interval=cellRayInterval(input.from,input.to,offsetX+cell.col*gridSize,offsetY+cell.row*gridSize,gridSize)
        if(interval&&groveRayIntersects(input,area,interval))return area.id
      }
      continue
    }
    if (input.purpose === 'movement' && area.circularGeometry) {
      const anchor = area.anchorCell ?? area.cells[0]
      if (!anchor) continue
      const scale = (input.map.feetPerCell ?? 5) / gridSize
      const x = (input.from.x - offsetX - (anchor.col + .5) * gridSize) * scale
      const y = (input.from.y - offsetY - (anchor.row + .5) * gridSize) * scale
      const dx = (input.to.x - input.from.x) * scale, dy = (input.to.y - input.from.y) * scale
      const radius = area.circularGeometry.radiusFeet
      const a = dx * dx + dy * dy, b = 2 * (x * dx + y * dy), c = x * x + y * y - radius * radius
      let interval
      if (a < 1e-12) {
        if (c < 0) interval = [0, 1]
      } else {
        const discriminant = b * b - 4 * a * c
        if (discriminant > 0) {
          const root = Math.sqrt(discriminant)
          const start = Math.max(0, (-b - root) / (2 * a)), end = Math.min(1, (-b + root) / (2 * a))
          if (start < end) interval = [start, end]
        }
      }
      if (interval) {
        const z = input.fromElevationFeet + input.fromEyeHeightFeet
        const dz = input.toElevationFeet + input.toEyeHeightFeet - z
        const lower = z + dz * interval[0], upper = z + dz * interval[1]
        if (input.overlapsHeight(area, Math.min(lower, upper), Math.abs(upper - lower) + .1)) return area.id
      }
      continue
    }
    if (area.stoneWall || area.forceWall) {
      if (stoneWallIntersects(area, input.map, input.from, input.to,
        input.fromElevationFeet + input.fromEyeHeightFeet, input.toElevationFeet + input.toEyeHeightFeet)) return area.id
      continue
    }
    if (area.forceShell) {
      if (forceShellCrosses(area, input.map, input.from, input.to,
        input.fromElevationFeet + input.fromEyeHeightFeet, input.toElevationFeet + input.toEyeHeightFeet)) return area.id
      continue
    }
    const exactMovement = input.purpose === 'movement' && input.exactCellIntersection === true
    const rectangle = input.purpose === 'ranged-weapon-disadvantage' || input.purpose === 'damage-attenuation' || exactMovement ? rectangleRay(area, input.map, input.from, input.to) : undefined
    if (rectangle && !rectangle.interval) continue
    const cells = new Set(area.cells.map((cell) => `${cell.col}:${cell.row}`))
    const pointInside = (
      point,
      elevationFeet,
      eyeHeightFeet,
    ) => {
      const key = `${Math.floor((point.x - offsetX) / gridSize)}:${Math.floor((point.y - offsetY) / gridSize)}`
      return cells.has(key) && (!rectangle || rectangle.contains(point)) && input.overlapsHeight(
        area,
        elevationFeet + eyeHeightFeet,
        0.1,
      )
    }
    const fromInside = pointInside(input.from, input.fromElevationFeet, input.fromEyeHeightFeet)
    const toInside = pointInside(input.to, input.toElevationFeet, input.toEyeHeightFeet)
    if (input.purpose === 'ranged-weapon-disadvantage' || input.purpose === 'damage-attenuation' || exactMovement) {
      const occupancy = exactMovement || input.purpose === 'damage-attenuation' || area.blocking.rangedWeaponAttackDisadvantage === 'occupancy'
      if (occupancy && (fromInside || toInside)) return area.id
      const startHeight = input.fromElevationFeet + input.fromEyeHeightFeet
      const heightDelta = input.toElevationFeet + input.toEyeHeightFeet - startHeight
      const intervals = area.cells.flatMap(cell => {
        const interval = cellRayInterval(input.from, input.to, offsetX + cell.col * gridSize, offsetY + cell.row * gridSize, gridSize)
        if (!interval) return []
        if (rectangle) {
          interval[0] = Math.max(interval[0], rectangle.interval[0])
          interval[1] = Math.min(interval[1], rectangle.interval[1])
          if (interval[0] > interval[1]) return []
        }
        const a = startHeight + heightDelta * interval[0], b = startHeight + heightDelta * interval[1]
        return input.overlapsHeight(area, Math.min(a, b), Math.abs(b - a) + 0.1) ? [interval] : []
      }).sort((a, b) => a[0] - b[0])
      if (!intervals.length) continue
      if (occupancy || !fromInside || !toInside) return area.id
      // Two inside endpoints can still cross a gap in a disconnected or concave area.
      let covered = 0
      for (const [start, end] of intervals) {
        if (start > covered + 1e-9) return area.id
        covered = Math.max(covered, end)
      }
      if (covered < 1 - 1e-9) return area.id
      continue
    }
    if ((input.purpose === 'line-of-effect' || input.purpose === 'opaque-cover') && area.blocking?.lineOfEffectMode === 'boundary') {
      if (fromInside && toInside) continue
      if (fromInside !== toInside) return area.id
    }
    if (input.purpose === 'vision' && area.blocking?.visionMode === 'outside-in') {
      if (fromInside) continue
      if (toInside) return area.id
    }
    for (let index = 1; index < steps; index += 1) {
      const ratio = index / steps
      const point = {
        x: input.from.x + (input.to.x - input.from.x) * ratio,
        y: input.from.y + (input.to.y - input.from.y) * ratio,
      }
      const key = `${Math.floor((point.x - offsetX) / gridSize)}:${Math.floor((point.y - offsetY) / gridSize)}`
      if (!cells.has(key)) continue
      const rayHeight = input.fromElevationFeet + input.fromEyeHeightFeet +
        ((input.toElevationFeet + input.toEyeHeightFeet) -
          (input.fromElevationFeet + input.fromEyeHeightFeet)) * ratio
      if (input.overlapsHeight(area, rayHeight, 0.1)) return area.id
    }
  }
  return undefined
}

/** Exact 3D intersections for wall material reactions, independent of movement blocking. */
export function persistentAreaVolumeRayIntersections(input) {
  const {map,area,from,to}=input
  if(area.vertical?.mode!=='volume'||area.vertical.shape)return []
  const grid=map.gridSize,ox=map.gridOffsetX??0,oy=map.gridOffsetY??0
  const z=input.fromElevationFeet,dz=input.toElevationFeet-z
  const result=[]
  if(area.rectGeometry?.pitchDegrees || area.rectGeometry?.rollDegrees){
    const band=rectangularPrismRayInterval(map,area,{...from,elevationFeet:z},{...to,elevationFeet:input.toElevationFeet})
    if(!band)return result
    for(const cell of area.cells){
      const interval=cellRayInterval(from,to,ox+cell.col*grid,oy+cell.row*grid,grid)
      if(!interval)continue
      const lo=Math.max(band[0],interval[0]),hi=Math.min(band[1],interval[1])
      if(hi-lo>1e-9)result.push({cell:{...cell},fromT:lo,toT:hi,fromElevationFeet:z+dz*lo,toElevationFeet:z+dz*hi})
    }
    return result.sort((a,b)=>a.fromT-b.fromT)
  }
  for(const slice of persistentAreaHeightSlices(area)){
    const rectangle=rectangleRay(slice,map,from,to)
    if(rectangle&&!rectangle.interval)continue
    const bands=slice.circularGeometry?.innerRadiusFeet!=null?annularAreaRayIntervals(slice,map,from,to)
      :rectangle?[rectangle.interval]:[[0,1]]
    for(const cell of slice.cells){
      const cellInterval=cellRayInterval(from,to,ox+cell.col*grid,oy+cell.row*grid,grid)
      if(!cellInterval)continue
      const bottom=slice.vertical.baseElevationFeet,top=bottom+slice.vertical.heightFeet
      for(const band of bands){
        let lo=Math.max(0,cellInterval[0],band[0]),hi=Math.min(1,cellInterval[1],band[1])
        if(Math.abs(dz)<1e-12){if(z<bottom||z>=top)continue}
        else{
          const a=(bottom-z)/dz,b=(top-z)/dz
          lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b))
        }
        if(hi-lo<=1e-9)continue
        for(const [start,end] of wallSurfaceRayIntervals(slice,map,from,to,z,dz,[lo,hi]))
          result.push({cell:{...cell},fromT:start,toT:end,fromElevationFeet:z+dz*start,toElevationFeet:z+dz*end})
      }
    }
  }
  return result.sort((a,b)=>a.fromT-b.fromT||a.toT-b.toT)
}
