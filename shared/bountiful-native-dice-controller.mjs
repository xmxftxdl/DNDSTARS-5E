/** Mirrors the actual DiceBox's explicit simulacrum source-character priority.
 * Team, viewerControlled and ordinary summon source never confer dice control.
 * Call only against the current authoritative room resources. */
export function bountifulNativeDiceController(map,characters,actorId,roomId){
 if(!roomId||!Array.isArray(map?.tokens)||!Array.isArray(characters))return null
 const tokens=map.tokens.filter(token=>token.id===actorId)
 if(tokens.length!==1||tokens[0].type==='obstacle')return null
 const token=tokens[0],characterId=token.dnd5eSimulacrum?.sourceCharacterId??token.characterId
 if(characterId!==undefined){
  if(typeof characterId!=='string'||!characterId.trim()||characterId.trim()!==characterId)return null
  const rows=characters.filter(character=>character.id===characterId)
  if(rows.length!==1)return null
  const character=rows[0]
  if(character.roomId!==undefined&&character.roomId!==roomId||character.roomMemberId!==undefined&&(typeof character.roomMemberId!=='string'||!character.roomMemberId.trim()||character.roomMemberId.trim()!==character.roomMemberId))return null
  return {token,character}
 }
 return typeof token.poolId==='string'&&!!token.poolId.trim()?{token}:null
}
