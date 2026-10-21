function insidePolygon(point, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i]
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)
    if (Math.abs(cross) < 1e-7 && point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x) &&
      point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y)) return true
    if ((a.y > point.y) !== (b.y > point.y) &&
      point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Intersect a vertical sample with the saved grove, subtracting classified structures. */
export function groveVolumeOverlaps(volume, point, base, height = 0) {
  if (!volume) return true
  if (point.x < volume.minX || point.x >= volume.minX + volume.widthPixels ||
    point.y < volume.minY || point.y >= volume.minY + volume.widthPixels) return false
  const structures = volume.excludedStructures.filter(s => insidePolygon(point, s.points))
  if (height <= 0) return base >= volume.baseElevationFeet && base < volume.baseElevationFeet + volume.heightFeet &&
    !structures.some(s => base >= s.baseElevationFeet && base < s.baseElevationFeet + s.heightFeet)
  let intervals = [[Math.max(base, volume.baseElevationFeet), Math.min(base + height, volume.baseElevationFeet + volume.heightFeet)]]
  for (const s of structures) intervals = intervals.flatMap(([lo, hi]) => {
    const bottom = s.baseElevationFeet, top = bottom + s.heightFeet
    if (top <= lo || bottom >= hi) return [[lo, hi]]
    return [[lo, Math.min(hi, bottom)], [Math.max(lo, top), hi]].filter(([a, b]) => b > a)
  })
  return intervals.some(([lo, hi]) => hi > lo)
}

/** Boundary of a cell minus classified structures, sliced at every height change. */
export function groveCellVisionSegments(volume, box, base, height) {
  const boxHeight = box.height ?? box.size
  const rectangle = [{ x: box.x, y: box.y }, { x: box.x + box.size, y: box.y },
    { x: box.x + box.size, y: box.y + boxHeight }, { x: box.x, y: box.y + boxHeight }]
  const structures = volume.excludedStructures.filter(s =>
    Math.max(...s.points.map(p => p.x)) >= box.x && Math.min(...s.points.map(p => p.x)) <= box.x + box.size &&
    Math.max(...s.points.map(p => p.y)) >= box.y && Math.min(...s.points.map(p => p.y)) <= box.y + boxHeight)
  const lo = Math.max(base, volume.baseElevationFeet), hi = Math.min(base + height, volume.baseElevationFeet + volume.heightFeet)
  if (hi <= lo) return []
  const levels = [...new Set([lo, hi, ...structures.flatMap(s => [s.baseElevationFeet, s.baseElevationFeet + s.heightFeet])
    .filter(z => z > lo && z < hi)])].sort((a, b) => a - b)
  const cube = [{x:volume.minX,y:volume.minY},{x:volume.minX+volume.widthPixels,y:volume.minY},
    {x:volume.minX+volume.widthPixels,y:volume.minY+volume.widthPixels},{x:volume.minX,y:volume.minY+volume.widthPixels}]
  const edges = [rectangle, cube, ...structures.map(s => s.points)].flatMap(points =>
    points.map((a, i) => ({ a, b: points[(i + 1) % points.length] })))
  const cross = (a, b) => a.x * b.y - a.y * b.x
  const output = [], seen = new Set()
  const epsilon = Math.min(box.size * 1e-6, boxHeight * 1e-6, 1e-4)
  for (const edge of edges) {
    const d = {x:edge.b.x-edge.a.x,y:edge.b.y-edge.a.y}, length = Math.hypot(d.x,d.y)
    if (length < 1e-8) continue
    const cuts = [0,1]
    for (const other of edges) {
      const e = {x:other.b.x-other.a.x,y:other.b.y-other.a.y}, q = {x:other.a.x-edge.a.x,y:other.a.y-edge.a.y}
      const denominator = cross(d,e)
      if (Math.abs(denominator) > 1e-9) {
        const t=cross(q,e)/denominator, u=cross(q,d)/denominator
        if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t)
      } else if (Math.abs(cross(q,d)) < 1e-7) {
        for(const p of [other.a,other.b]) {
          const t=((p.x-edge.a.x)*d.x+(p.y-edge.a.y)*d.y)/(length*length)
          if(t>0&&t<1)cuts.push(t)
        }
      }
    }
    cuts.sort((a,b)=>a-b)
    for(let i=1;i<cuts.length;i++) {
      if(cuts[i]-cuts[i-1]<1e-9)continue
      const at=t=>({x:edge.a.x+d.x*t,y:edge.a.y+d.y*t})
      const a=at(cuts[i-1]), b=at(cuts[i]), mid=at((cuts[i-1]+cuts[i])/2)
      for(let z=1;z<levels.length;z++) {
        const elevation=(levels[z-1]+levels[z])/2
        const contains=p=>p.x>=box.x&&p.x<box.x+box.size&&p.y>=box.y&&p.y<box.y+boxHeight&&groveVolumeOverlaps(volume,p,elevation)
        if(contains({x:mid.x-d.y/length*epsilon,y:mid.y+d.x/length*epsilon})===
          contains({x:mid.x+d.y/length*epsilon,y:mid.y-d.x/length*epsilon}))continue
        const key=[`${a.x.toFixed(6)},${a.y.toFixed(6)}`,`${b.x.toFixed(6)},${b.y.toFixed(6)}`].sort().join(':')+`:${levels[z-1]}:${levels[z]}`
        if(seen.has(key))continue
        seen.add(key)
        output.push({a,b,baseHeightFeet:levels[z-1],heightFeet:levels[z]-levels[z-1]})
      }
    }
  }
  return output
}

/** Intersect the creature's occupied rectangle with actual outdoor area volume. */
export function groveAreaFootprintOverlaps(volume, cells, map, position, halfSize, base, height) {
  if (!volume) return true
  if (height < 0) return false
  for (const cell of cells) {
    const x = (map.gridOffsetX ?? 0) + cell.col * map.gridSize
    const y = (map.gridOffsetY ?? 0) + cell.row * map.gridSize
    const left=Math.max(x,position.x-halfSize), right=Math.min(x+map.gridSize,position.x+halfSize)
    const top=Math.max(y,position.y-halfSize), bottom=Math.min(y+map.gridSize,position.y+halfSize)
    if(right<=left||bottom<=top)continue
    if(groveVolumeOverlaps(volume,{x:(left+right)/2,y:(top+bottom)/2},base,height))return true
    if(groveCellVisionSegments(volume,{x:left,y:top,size:right-left,height:bottom-top},base,
      height===0?1e-7:height).length)return true
  }
  return false
}
