import { rectangularPrism, rectangularPrismNearestPoint, rectangularPrismOutline } from './rectangular-prism.mjs'
import { clippedPrismLightOrigin } from './clipped-prism-origin.mjs'
/** Nearest point on the actual prism intersected with retained area cells. */
export function rectangularLightOrigin(map, area, target) {
    return clippedPrismLightOrigin(map, area, target);
}
/** Flat-plane cross-section of the rectangle's continuous radial illumination.
 * Rounded corners are tessellated only for drawing; authority remains analytic. */
export function rectangularLightFootprint(map, area, radiusFeet, planeElevationFeet = 0) {
    const rect = area.rectGeometry, anchor = area.anchorCell, vertical = area.vertical;
    if (rect?.pitchDegrees || rect?.rollDegrees)
        return tiltedLightFootprint(map, area, radiusFeet, planeElevationFeet);
    if (!rect || rect.gridAligned || !anchor || vertical?.mode !== 'volume' || vertical.shape === 'sphere')
        return undefined;
    const gap = Math.max(vertical.baseElevationFeet - planeElevationFeet, planeElevationFeet - vertical.baseElevationFeet - vertical.heightFeet, 0);
    if (radiusFeet < gap || radiusFeet <= 0)
        return [];
    const radius = Math.sqrt(Math.max(0, radiusFeet * radiusFeet - gap * gap));
    const scale = (map.feetPerCell ?? 5) / Math.max(1, map.gridSize);
    const center = { x: map.gridOffsetX + (anchor.col + 0.5) * map.gridSize,
        y: map.gridOffsetY + (anchor.row + 0.5) * map.gridSize };
    const { dc, dr } = rect.direction;
    return [[1, 1], [-1, 1], [-1, -1], [1, -1]].flatMap(([sx, sy], corner) => Array.from({ length: 17 }, (_, index) => {
        const angle = (corner + index / 16) * Math.PI / 2;
        const along = sx * rect.lengthFeet / 2 + Math.cos(angle) * radius;
        const across = sy * rect.widthFeet / 2 + Math.sin(angle) * radius;
        return { x: center.x + (along * dc - across * dr) / scale,
            y: center.y + (along * dr + across * dc) / scale };
    }));
}
/** A plane section of a convex solid's spherical offset is convex. Start at
 * a guaranteed interior point and solve its radial boundary by distance.
 * Only the drawing is tessellated; visibility still uses analytic distances. */
function tiltedLightFootprint(map, area, radiusFeet, elevationFeet) {
    const prism = rectangularPrism(map, area);
    if (!prism) return undefined;
    if (!Number.isFinite(radiusFeet) || radiusFeet <= 0) return [];
    const corners = [-1, 1].flatMap(a => [-1, 1].flatMap(b => [-1, 1].map(c =>
        prism.world([a * prism.half[0], b * prism.half[1], c * prism.half[2]]))));
    const ordered = [...corners].sort((a, b) => a.elevationFeet - b.elevationFeet);
    const bottom = ordered[0], top = ordered[7];
    const gap = Math.max(bottom.elevationFeet - elevationFeet, elevationFeet - top.elevationFeet, 0);
    if (gap >= radiusFeet) return [];
    const span = top.elevationFeet - bottom.elevationFeet;
    const fraction = span > 0 ? Math.max(0, Math.min(1, (elevationFeet - bottom.elevationFeet) / span)) : 0;
    const center = {x: bottom.x + (top.x - bottom.x) * fraction,
        y: bottom.y + (top.y - bottom.y) * fraction, elevationFeet};
    const scale = (map.feetPerCell ?? 5) / Math.max(1, map.gridSize);
    const bound = radiusFeet + Math.max(...corners.map(p => Math.hypot((p.x-center.x)*scale, (p.y-center.y)*scale)));
    const distance = point => Math.hypot(...prism.local(point).map((n, i) => Math.max(Math.abs(n)-prism.half[i], 0)));
    return Array.from({length: 128}, (_, i) => {
        const angle = i * Math.PI * 2 / 128, dx = Math.cos(angle) / scale, dy = Math.sin(angle) / scale;
        let low = 0, high = bound;
        for (let step = 0; step < 40; step++) {
            const middle = (low + high) / 2;
            if (distance({x:center.x+dx*middle,y:center.y+dy*middle,elevationFeet}) <= radiusFeet) low = middle;
            else high = middle;
        }
        return {x:center.x+dx*low,y:center.y+dy*low};
    });
}
/** Guaranteed points on the emitting volume, including faces and ends that can
 * remain visible when the nearest point is occluded. Not a visibility mesh. */
export function rectangularLightCandidateOrigins(map, area, target, occluderEndpoints = [], occluderSegments = []) {
    const nearest = rectangularLightOrigin(map, area, target);
    if (!nearest)
        return [];
    // Persistent opaque regions participate in the same angular partition as
    // mapped walls. Keep cell clipping boundaries as well as the exact prism.
    const persistentEndpoints = [];
    const persistentSegments = [];
    for (const blocker of map.dnd5ePluginAreas ?? []) {
        if (blocker.id === area.id || !(blocker.blocking?.vision ||
            blocker.obscuration?.kind === 'heavy' && blocker.obscuration.scope !== 'source-token')) continue;
        const outline = rectangularPrismOutline(map, blocker);
        if (outline) for (let i=0;i<outline.length;i+=2) {
            const a={x:outline[i],y:outline[i+1]},j=(i+2)%outline.length;
            persistentEndpoints.push(a);
            // Upright rectangular volumes have constant lower/upper faces.
            // These edges add candidate partitions only; actual ray authority
            // still checks clipped cells and the precise blocking volume.
            if(blocker.vertical?.mode==='volume'&&!blocker.rectGeometry?.pitchDegrees&&!blocker.rectGeometry?.rollDegrees)
                persistentSegments.push({a,b:{x:outline[j],y:outline[j+1]},baseHeightFeet:blocker.vertical.baseElevationFeet,heightFeet:blocker.vertical.heightFeet});
        }
        if(blocker.rectGeometry?.pitchDegrees||blocker.rectGeometry?.rollDegrees){
            const solid=rectangularPrism(map,blocker);
            if(solid){
                const corners=[-1,1].flatMap(a=>[-1,1].flatMap(b=>[-1,1].map(c=>solid.world([a*solid.half[0],b*solid.half[1],c*solid.half[2]]))));
                for(let i=0;i<8;i++)for(const bit of [1,2,4]){
                    const j=i^bit;if(j<i)continue;
                    persistentSegments.push({a:corners[i],b:corners[j],baseHeightFeet:corners[i].elevationFeet,heightFeet:0});
                }
            }
        }
        const occupied = new Set(blocker.cells.map(cell=>`${cell.col},${cell.row}`));
        for (const cell of blocker.cells) {
            if (!blocker.vertical?.columns && [[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dy])=>occupied.has(`${cell.col+dx},${cell.row+dy}`))) continue;
            if(!outline&&blocker.vertical?.mode==='volume'&&blocker.vertical.shape!=='sphere'){
                const column=blocker.vertical.columns?.find(c=>c.col===cell.col&&c.row===cell.row);
                const baseHeightFeet=column?.baseElevationFeet??blocker.vertical.baseElevationFeet;
                const heightFeet=column?.heightFeet??blocker.vertical.heightFeet;
                const x=(map.gridOffsetX??0)+cell.col*map.gridSize,y=(map.gridOffsetY??0)+cell.row*map.gridSize,g=map.gridSize;
                const edges=[[{x,y},{x:x+g,y},0,-1],[{x:x+g,y},{x:x+g,y:y+g},1,0],[{x:x+g,y:y+g},{x,y:y+g},0,1],[{x,y:y+g},{x,y},-1,0]];
                for(const [a,b,dx,dy] of edges)if(blocker.vertical.columns||!occupied.has(`${cell.col+dx},${cell.row+dy}`))
                    persistentSegments.push({a,b,baseHeightFeet,heightFeet});
            }
            for(const dx of [0,1])for(const dy of [0,1]) persistentEndpoints.push({
                x:(map.gridOffsetX??0)+(cell.col+dx)*map.gridSize,
                y:(map.gridOffsetY??0)+(cell.row+dy)*map.gridSize});
        }
    }
    occluderEndpoints = [...occluderEndpoints, ...persistentEndpoints];
    occluderSegments = [...occluderSegments, ...persistentSegments];
    const rect = area.rectGeometry, anchor = area.anchorCell, vertical = area.vertical;
    if (rect.pitchDegrees || rect.rollDegrees) {
        const prism = rectangularPrism(map, area);
        const values = prism.local(nearest);
        const points = [...new Set([values[0], -prism.half[0], prism.half[0]])].flatMap(a =>
          [...new Set([values[1], -prism.half[1], prism.half[1]])].flatMap(b =>
            [...new Set([values[2], -prism.half[2], prism.half[2]])].map(c => prism.world([a,b,c]))));
        const scale = (map.feetPerCell ?? 5) / Math.max(1, map.gridSize);
        if (occluderEndpoints.length) {
            const corners = [-1,1].flatMap(a => [-1,1].flatMap(b => [-1,1].map(c =>
                prism.world([a*prism.half[0],b*prism.half[1],c*prism.half[2]]))));
            const tau = 2*Math.PI;
            const angles = [...new Set([...occluderEndpoints,...corners].map(p =>
                (Math.atan2(p.y-target.y,p.x-target.x)+tau)%tau))].sort((a,b)=>a-b);
            for (let i=0;i<angles.length;i++) {
                const angle=(angles[i]+(angles[i+1]??angles[0]+tau))/2;
                const dx=Math.cos(angle),dy=Math.sin(angle);
                // Slice the solid by the vertical plane through this sight direction.
                // Intersections with its twelve edges define a convex section.
                const side=p=>(-(p.x-target.x)*dy+(p.y-target.y)*dx)*scale;
                const section=[];
                for(let j=0;j<8;j++)for(const bit of [1,2,4]){
                    const k=j^bit;if(k<j)continue;
                    const a=corners[j],b=corners[k],sa=side(a),sb=side(b);
                    if(Math.abs(sa)<1e-10)section.push(a);
                    if(sa*sb<0){const f=sa/(sa-sb);section.push({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,elevationFeet:a.elevationFeet+(b.elevationFeet-a.elevationFeet)*f});}
                }
                const along=p=>((p.x-target.x)*dx+(p.y-target.y)*dy)*scale;
                // Every section chord remains inside the emitter. Include the
                // closest point on each chord, covering boundary edges too.
                for(const a of section)for(const b of section){
                    const ta=along(a),tb=along(b);if(ta<0&&tb<0)continue;
                    const za=a.elevationFeet-target.elevationFeet,zb=b.elevationFeet-target.elevationFeet;
                    const dt=tb-ta,dz=zb-za,den=dt*dt+dz*dz;
                    let low=0,high=1;
                    if(ta<0)low=-ta/dt;else if(tb<0)high=-ta/dt;
                    const f=Math.max(low,Math.min(high,den?-(ta*dt+za*dz)/den:0));
                    points.push({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,elevationFeet:a.elevationFeet+(b.elevationFeet-a.elevationFeet)*f});
                }
            }
        }
        const distance = point => Math.hypot((point.x-target.x)*scale,(point.y-target.y)*scale,point.elevationFeet-target.elevationFeet);
        return retainedOrigins(map,area,verticalOpeningOrigins(map,area,target,points,occluderSegments)).sort((a,b)=>distance(a)-distance(b));
    }
    if (vertical.mode !== 'volume')
        return [];
    const scale = (map.feetPerCell ?? 5) / Math.max(1, map.gridSize);
    const cx = map.gridOffsetX + (anchor.col + 0.5) * map.gridSize;
    const cy = map.gridOffsetY + (anchor.row + 0.5) * map.gridSize;
    const { dc, dr } = rect.direction;
    const along = ((nearest.x - cx) * dc + (nearest.y - cy) * dr) * scale;
    const across = (-(nearest.x - cx) * dr + (nearest.y - cy) * dc) * scale;
    const candidates = [...new Set([along, -rect.lengthFeet / 2, rect.lengthFeet / 2])].flatMap(a => [...new Set([across, -rect.widthFeet / 2, rect.widthFeet / 2])].flatMap(b => [...new Set([nearest.elevationFeet, vertical.baseElevationFeet, vertical.baseElevationFeet + vertical.heightFeet])].map(elevationFeet => ({ x: cx + (a * dc - b * dr) / scale, y: cy + (a * dr + b * dc) / scale, elevationFeet }))));
    // A fixed grid can miss arbitrarily narrow openings. Partition horizontal
    // sight directions at actual blocker endpoints and emitter corners instead.
    if (occluderEndpoints.length) {
        const tau = Math.PI * 2;
        const angles = [...new Set([...occluderEndpoints, ...candidates].map(point => (Math.atan2(point.y - target.y, point.x - target.x) + tau) % tau))].sort((a, b) => a - b);
        const tx = ((target.x - cx) * dc + (target.y - cy) * dr) * scale;
        const ty = (-(target.x - cx) * dr + (target.y - cy) * dc) * scale;
        for (let i = 0; i < angles.length; i++) {
            const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + tau;
            const angle = (angles[i] + next) / 2;
            const dx = Math.cos(angle) * dc + Math.sin(angle) * dr;
            const dy = -Math.cos(angle) * dr + Math.sin(angle) * dc;
            let enter = 0, exit = Infinity;
            for (const [start, delta, half] of [[tx, dx, rect.lengthFeet / 2], [ty, dy, rect.widthFeet / 2]]) {
                if (Math.abs(delta) < 1e-12) {
                    if (Math.abs(start) > half)
                        exit = -1;
                    continue;
                }
                const a = (-half - start) / delta, b = (half - start) / delta;
                enter = Math.max(enter, Math.min(a, b));
                exit = Math.min(exit, Math.max(a, b));
            }
            if (exit < enter || !Number.isFinite(enter))
                continue;
            const a = tx + enter * dx, b = ty + enter * dy;
            for (const elevationFeet of new Set([nearest.elevationFeet, vertical.baseElevationFeet, vertical.baseElevationFeet + vertical.heightFeet]))
                candidates.push({ x: cx + (a * dc - b * dr) / scale, y: cy + (a * dr + b * dc) / scale, elevationFeet });
        }
    }
    return retainedOrigins(map,area,verticalOpeningOrigins(map,area,target,candidates,occluderSegments)).sort((a, b) => Math.hypot((a.x - target.x) * scale, (a.y - target.y) * scale, a.elevationFeet - target.elevationFeet) -
        Math.hypot((b.x - target.x) * scale, (b.y - target.y) * scale, b.elevationFeet - target.elevationFeet));
}

function retainedOrigins(map,area,points){
    return points.map(point=>clippedPrismLightOrigin(map,area,point)).filter(Boolean);
}

/** At each horizontal candidate, intersect the prism with a vertical line.
 * Project actual blocker height boundaries onto that interval, then sample
 * each open interval. This preserves arbitrarily thin vertical openings. */
function verticalOpeningOrigins(map, area, target, candidates, segments) {
    if (!segments.length) return candidates;
    const prism=rectangularPrism(map,area);
    if (!prism) return candidates;
    const result=[...candidates], seen=new Set();
    for (const candidate of candidates) {
        const key=`${candidate.x},${candidate.y}`;
        if(seen.has(key))continue;seen.add(key);
        const start=prism.local({...candidate,elevationFeet:0});
        const next=prism.local({...candidate,elevationFeet:1});
        let low=-Infinity,high=Infinity;
        for(let i=0;i<3;i++){
            const delta=next[i]-start[i],half=prism.half[i];
            if(Math.abs(delta)<1e-10){if(Math.abs(start[i])>half+1e-8)high=-Infinity;continue;}
            const a=(-half-start[i])/delta,b=(half-start[i])/delta;
            low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));
        }
        if(!Number.isFinite(low)||!Number.isFinite(high)||high<=low)continue;
        const boundaries=[low,high];
        const dx=candidate.x-target.x,dy=candidate.y-target.y;
        for(const segment of segments){
            const sx=segment.b.x-segment.a.x,sy=segment.b.y-segment.a.y;
            const den=dx*sy-dy*sx;if(Math.abs(den)<1e-10)continue;
            const ax=segment.a.x-target.x,ay=segment.a.y-target.y;
            const t=(ax*sy-ay*sx)/den,u=(ax*dy-ay*dx)/den;
            if(t<=1e-8||t>=1||u<0||u>1)continue;
            const heights=Number.isFinite(segment.a.elevationFeet)&&Number.isFinite(segment.b.elevationFeet)
                ? [segment.a.elevationFeet+(segment.b.elevationFeet-segment.a.elevationFeet)*u]
                : [segment.baseHeightFeet,segment.baseHeightFeet+segment.heightFeet];
            for(const height of heights){
                const z=target.elevationFeet+(height-target.elevationFeet)/t;
                if(z>low&&z<high)boundaries.push(z);
            }
        }
        const ordered=[...new Set(boundaries)].sort((a,b)=>a-b);
        for(let i=1;i<ordered.length;i++)result.push({...candidate,elevationFeet:(ordered[i-1]+ordered[i])/2});
    }
    return result;
}

/** Refine a known visible point when its distance and the nearest point lie
 * in different illumination bands. Every retained point passes real ray
 * authority; interpolation stays in the convex emitting prism. */
export function refineRectangularLightOrigin(map,area,target,origin,isVisible){
    const nearest=rectangularLightOrigin(map,area,target),light=area.lighting;
    if(!nearest||light?.kind!=='light')return origin;
    const scale=(map.feetPerCell??5)/Math.max(1,map.gridSize);
    const distance=p=>Math.hypot((p.x-target.x)*scale,(p.y-target.y)*scale,p.elevationFeet-target.elevationFeet);
    const nearDistance=distance(nearest),farDistance=distance(origin);
    if(![light.brightRadiusFeet,light.brightRadiusFeet+light.dimRadiusFeet].some(radius=>nearDistance<=radius&&farDistance>radius))return origin;
    let low=0,high=1,best=origin;
    for(let i=0;i<40;i++){
        const f=(low+high)/2;
        const point={x:nearest.x+(origin.x-nearest.x)*f,y:nearest.y+(origin.y-nearest.y)*f,elevationFeet:nearest.elevationFeet+(origin.elevationFeet-nearest.elevationFeet)*f};
        const retained=clippedPrismLightOrigin(map,area,point);
        const inside=retained&&Math.hypot(retained.x-point.x,retained.y-point.y,retained.elevationFeet-point.elevationFeet)<1e-7;
        if(inside&&isVisible(point)){best=point;high=f;}else low=f;
    }
    return best;
}
