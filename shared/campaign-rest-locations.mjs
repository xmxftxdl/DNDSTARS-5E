const id = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 160
const coordinate = value => typeof value === 'number' && Number.isFinite(value)
export function validCampaignRestLocations(value, worldMinute) {
  if (value == null) return true
  return Array.isArray(value) && value.length <= 4096 &&
    new Set(value.map(row => JSON.stringify([row?.characterId,row?.plane]))).size === value.length &&
    value.every(row => row && id(row.characterId) && id(row.plane) && id(row.mapId) &&
      coordinate(row.x) && coordinate(row.y) && coordinate(row.elevationFeet) &&
      Number.isSafeInteger(row.completedAtWorldMinute) && row.completedAtWorldMinute >= 0 && row.completedAtWorldMinute <= worldMinute)
}

/** maps and participants are Host snapshots, never coordinates from the mutation request. */
export function recordCampaignLongRestLocations(previous, maps, participants, completedAtWorldMinute) {
  if (!validCampaignRestLocations(previous, completedAtWorldMinute)) throw Error('invalid-rest-locations')
  const records = (previous ?? []).map(row => ({...row}))
  for (const characterId of new Set(participants ?? [])) {
    if (!id(characterId)) continue
    const matches = (maps ?? []).flatMap(map => (map.tokens ?? [])
      .filter(token => token.type === 'player' && token.characterId === characterId && !token.dnd5eSimulacrum)
      .map(token => ({map,token})))
    // A newer unlocatable rest must not silently keep an older destination.
    // Preserve other planes only when every possible current plane is known.
    const invalidate = () => {
      const planes = matches.map(({map}) => map.dnd5ePlane)
      const known = planes.length > 0 && planes.every(id)
      for (let index=records.length-1;index>=0;index--) {
        if(records[index].characterId===characterId && (!known || planes.includes(records[index].plane))) records.splice(index,1)
      }
    }
    if (matches.length !== 1) { invalidate(); continue }
    const {map,token} = matches[0]
    if (!id(map.id) || !id(map.dnd5ePlane) || !coordinate(token.x) || !coordinate(token.y) ||
      !coordinate(map.width) || !coordinate(map.height) || token.x < 0 || token.y < 0 || token.x > map.width || token.y > map.height ||
      (token.elevationFeet != null && !coordinate(token.elevationFeet))) { invalidate(); continue }
    const next = {characterId,plane:map.dnd5ePlane,mapId:map.id,x:token.x,y:token.y,elevationFeet:token.elevationFeet ?? 0,completedAtWorldMinute}
    const index = records.findIndex(row => row.characterId === characterId && row.plane === map.dnd5ePlane)
    if (index >= 0) records[index] = next
    else if (records.length < 4096) records.push(next)
  }
  return records
}
