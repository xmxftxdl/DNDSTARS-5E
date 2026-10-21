function mapGeometryPointInPolygon(point, polygon) {
  let inside = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/((b.y-a.y)||1e-9)+a.x) inside=!inside;
  }
  return inside;
}
const cross = (a, b) => a.x * b.y - a.y * b.x;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
/** Check the union's exposed boundary, so seams do not become holes. No perimeter sampling. */
export function polygonUnionSupportsCircle(polygons, center, radius) {
    const tolerance = 1e-4;
    const nearby = polygons.filter(points => Math.min(...points.map(p => p.x)) <= center.x + radius + tolerance &&
        Math.max(...points.map(p => p.x)) >= center.x - radius - tolerance &&
        Math.min(...points.map(p => p.y)) <= center.y + radius + tolerance &&
        Math.max(...points.map(p => p.y)) >= center.y - radius - tolerance);
    const contains = (p) => nearby.some(points => mapGeometryPointInPolygon(p, points));
    if (!Number.isFinite(radius) || radius < 0 || !contains(center))
        return false;
    const edges = nearby.flatMap(points => points.map((a, i) => ({ a, b: points[(i + 1) % points.length] })));
    for (const { a, b } of edges) {
        const d = sub(b, a), length = Math.hypot(d.x, d.y), squared = length * length;
        if (length < 1e-7)
            continue;
        const at = (t) => ({ x: a.x + d.x * t, y: a.y + d.y * t });
        const cuts = [0, 1];
        for (const other of edges) {
            const e = sub(other.b, other.a), q = sub(other.a, a), denominator = cross(d, e);
            if (Math.abs(denominator) > 1e-9) {
                const t = cross(q, e) / denominator, u = cross(q, d) / denominator;
                if (t > 0 && t < 1 && u >= -1e-9 && u <= 1 + 1e-9)
                    cuts.push(t);
            }
            else if (Math.abs(cross(q, d)) / length < 1e-7) {
                for (const p of [other.a, other.b]) {
                    const t = ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / squared;
                    if (t > 0 && t < 1)
                        cuts.push(t);
                }
            }
        }
        cuts.sort((x, y) => x - y);
        for (let i = 1; i < cuts.length; i++) {
            const low = cuts[i - 1], high = cuts[i];
            if ((high - low) * length < 1e-7)
                continue;
            const middle = at((low + high) / 2), nx = -d.y / length * 1e-6, ny = d.x / length * 1e-6;
            if (contains({ x: middle.x + nx, y: middle.y + ny }) && contains({ x: middle.x - nx, y: middle.y - ny }))
                continue;
            const projection = ((center.x - a.x) * d.x + (center.y - a.y) * d.y) / squared;
            const closest = at(Math.max(low, Math.min(high, projection)));
            if (Math.hypot(center.x - closest.x, center.y - closest.y) + tolerance < radius)
                return false;
        }
    }
    return true;
}
