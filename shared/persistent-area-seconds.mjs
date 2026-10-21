/** Explicit campaign-clock advancement only; reloads and wall-clock time never expire areas. */
export function advancePersistentAreaSeconds(map, previousClock, nextClock) {
  const before=previousClock?.worldMinute,after=nextClock?.worldMinute
  if(!Number.isSafeInteger(before)||!Number.isSafeInteger(after))return map
  const elapsed=(after-before)*60+(nextClock.worldSecondRemainder??0)-(previousClock.worldSecondRemainder??0)
  if(!Number.isSafeInteger(elapsed)||elapsed<=0)return map
  let changed=false
  const areas=(map.dnd5ePluginAreas??[]).flatMap(area=>{
    const remaining=area.remainingExplorationSeconds
    if(!Number.isSafeInteger(remaining)||remaining<=0||remaining>86400)return [area]
    changed=true
    return remaining<=elapsed?[]:[{...area,remainingExplorationSeconds:remaining-elapsed}]
  })
  return changed?{...map,dnd5ePluginAreas:areas}:map
}
