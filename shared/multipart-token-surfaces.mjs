export function multipartServerSurfaces(map, target) {
  const parts=target.dnd5eCombatState?.monsterMultipart
  if(!parts || target.multipartProjection) return null
    const projections=[{...target,multipartProjection:true}],units=(map.gridSize||50)/(map.feetPerCell||5)
    for(const head of parts.heads??[])if(head.alive){
      const dx=head.position.x-parts.body.x,dy=head.position.y-parts.body.y,dz=head.position.z-parts.body.z
      const steps=Math.min(240,Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)/2.5)))
      for(let i=1;i<=steps;i++)projections.push({...target,multipartProjection:true,size:1,creatureSize:'中型',
        x:target.x+dx*units*i/steps,y:target.y+dy*units*i/steps,elevationFeet:(target.elevationFeet??0)+dz*i/steps})
    }
  return projections
}

/** Mutates only the per-player token copy, never the authoritative map. */
export function redactMultipartHistory(token) {
  if(!token.dnd5eCombatState?.monsterMultipart)return
  token.dnd5eCombatState={...token.dnd5eCombatState,monsterMultipart:{...token.dnd5eCombatState.monsterMultipart,
    consumed:[],lastHumanoidConsumedMinute:undefined,lastRegrowthMinute:undefined,lastRegrowthRestId:undefined,restStartedMinute:undefined}}
}
