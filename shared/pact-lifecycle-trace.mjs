/** Private server facts. A client cannot clear or supply an existing trace.
 * Facts contain geometry only; enchantments, charges and concentration always
 * come from the current transaction, never a frozen historical character. */
export function observePactLifecycleTrace(input){
 if(!Array.isArray(input.after?.characters))return input.after;
 const second=clock=>Number.isSafeInteger(clock?.worldMinute)&&Number.isSafeInteger(clock?.worldSecondRemainder??0)?clock.worldMinute*60+(clock.worldSecondRemainder??0):undefined;
 const sample=(ownerId,instanceId,characters,maps,geometry,clock)=>{
  const worldSecond=second(clock);if(worldSecond==null)return null;
  const owners=(maps?.maps??[]).flatMap(map=>(map.tokens??[]).filter(t=>t.characterId===ownerId).map(token=>({map,token})));
  const carried=(characters?.characters??[]).flatMap(actor=>(actor.dnd5eInventory?.entries??[]).filter(e=>e.instanceId===instanceId).map(()=>actor.id));
  const grounds=(maps?.maps??[]).flatMap(map=>(map.tokens??[]).filter(t=>t.dnd5eObjectState?.inventoryItem?.instance?.instanceId===instanceId).map(token=>({map,token})));
  const origin=owners.length===1?owners[0]:null;
  const map=origin?.map;
  const shape=token=>!token?null:({id:token.id,x:token.x,y:token.y,size:token.size,creatureSize:token.creatureSize,
    elevationFeet:token.elevationFeet,
    ...(token.dnd5eCombatState?.monsterMultipart?{dnd5eCombatState:{monsterMultipart:structuredClone(token.dnd5eCombatState.monsterMultipart)}}:{})});
  let location=null,locationKind='unknown';
  if(carried.length+grounds.length===1&&origin){
   if(carried[0]===ownerId)locationKind='owner';
   else if(carried.length===1){const candidates=(map.tokens??[]).filter(t=>t.characterId===carried[0]);if(candidates.length===1){location=candidates[0];locationKind='carrier'}}
   else if(grounds[0]?.map.id===map.id){location=grounds[0].token;locationKind='ground'}
  }
  const versions=Object.fromEntries([['characters',characters],['maps',maps],['map-geometry',geometry],['campaign-time',clock]].map(([name,value])=>[name,value?._sync?.revision??0]));
  if(Object.values(versions).some(value=>!Number.isSafeInteger(value)||value<0))throw Error('pact-lifecycle:invalid-resource-version');
  const surface=(geometry?.maps??[]).find(g=>g.mapId===map?.id);
  const actor=characters?.characters?.find(row=>row.id===ownerId),deathRound=actor?.dnd5eCombatState?.deathRound;
  // This is the engine's confirmed-death boundary, not unconscious HP0 or a
  // rage-deferred failure count (whose deathRound deliberately stays absent).
  const confirmedOwnerDeath=actor?.currentHp<=0&&(actor?.deathSaveFailures??0)>=3&&Number.isSafeInteger(deathRound)&&deathRound>=0;
  return {worldSecond,versions,...(confirmedOwnerDeath?{confirmedOwnerDeath:true}:{}),...(surface?{geometry:structuredClone(surface)}:{}),map:map?Object.fromEntries(['id','gridSize','gridOffsetX','gridOffsetY','feetPerCell','snapMonstersToGrid'].map(key=>[key,map[key]])):{id:'unknown',gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5},owner:shape(origin?.token),location:shape(location),locationKind};
 };
 let changed=false;
 const characters=input.after.characters.map(actor=>{
  const old=input.before?.characters?.find(row=>row.id===actor.id)?.dnd5ePactWeaponAuthority;let authority=actor.dnd5ePactWeaponAuthority;
  // A stale full-character upload cannot delete private binding facts. Real
  // Host transitions advance the Pact revision before replacing/removing it.
  if(old&&(!authority||authority.state?.revision<old.state.revision||authority.state?.revision===old.state.revision&&JSON.stringify(authority.state.binding)!==JSON.stringify(old.state.binding))){authority=structuredClone(old);actor={...actor,dnd5ePactWeaponAuthority:authority};changed=true;}
  if(!authority?.state?.binding){
   if(authority?.lifecycleTrace){authority={...authority};delete authority.lifecycleTrace;changed=true;return{...actor,dnd5ePactWeaponAuthority:authority};}
   return actor;
  }
  const instanceId=authority.state.binding.inventoryInstanceId;
  // Only the previous committed server record is a source of historical facts.
  const trace=old?.state?.binding?.inventoryInstanceId===instanceId&&old.lifecycleTrace?.instanceId===instanceId?structuredClone(old.lifecycleTrace):{instanceId,rows:[]};
  // Only a newly persisted Host lifecycle receipt may advance the private
  // watermark. Stale uploads cannot request history deletion with a bare time.
  const completed=authority.lifecycle?.some(receipt=>receipt.pactRevision===authority.state.revision&&!old?.lifecycle?.some(prior=>prior.transactionId===receipt.transactionId));
  const watermark=authority.state.lastHostSecond;
  if(completed&&Number.isSafeInteger(watermark)){
    const prior=trace.rows.filter(row=>row.worldSecond<=watermark).at(-1);
    trace.rows=[...(prior?[prior]:[]),...trace.rows.filter(row=>row.worldSecond>watermark)];
  }
  const add=row=>{if(!row)return;const last=trace.rows.at(-1);if(last&&row.worldSecond<last.worldSecond)throw Error('pact-lifecycle:clock-regressed');if(JSON.stringify(last)!==JSON.stringify(row)){if(trace.rows.length>=10000)throw Error('pact-lifecycle:trace-capacity');trace.rows.push(row)}};
  const confirmedDeath=actor.currentHp<=0&&(actor.deathSaveFailures??0)>=3&&Number.isSafeInteger(actor.dnd5eCombatState?.deathRound)&&actor.dnd5eCombatState.deathRound>=0;
  if(authority.state.binding.status==='present'||confirmedDeath){
   // Capture the last pre-change fact at the old clock, and the newly committed
   // location at the new clock. A clock-only transaction also seals the interval.
   add(sample(actor.id,instanceId,input.before,input.beforeMaps,input.beforeGeometry,input.beforeClock));
   add(sample(actor.id,instanceId,input.after,input.afterMaps,input.afterGeometry,input.afterClock));
  }
  if(JSON.stringify(authority.lifecycleTrace)===JSON.stringify(trace))return actor;
  changed=true;return {...actor,dnd5ePactWeaponAuthority:{...authority,lifecycleTrace:trace}};
 });
 return changed?{...input.after,characters}:input.after;
}
