import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
/** Used only after the actual Host issuer has compared this prepared map and
 * character snapshot with the room resources (or restored that private wire).
 * A bound player always remains the controller. A character with no player
 * owner is controlled by this exact issuing Host, never by a caller's member. */
export function bountifulPreparedController(prepared:{map:BattleMap;characters:readonly Character[];characterIdByCombatantId:Record<string,string>},tokenId:string,hostMemberId:string){
 const characterId=prepared.characterIdByCombatantId[tokenId],tokens=prepared.map.tokens.filter(row=>row.id===tokenId),characters=prepared.characters.filter(row=>row.id===characterId)
 if(!hostMemberId||tokens.length!==1||characters.length!==1||tokens[0].characterId!==characterId)throw Error('bountiful-controller:actual-character-token-required')
 const owner=characters[0].roomMemberId
 if(owner!==undefined&&(typeof owner!=='string'||!owner.trim()||owner.trim()!==owner))throw Error('bountiful-controller:invalid-current-owner')
 return {characterId,memberId:owner??hostMemberId}
}

/** Characterless pool creatures use this issuing Host's actual native control.
 * A character link is always resolved through its canonical current owner. */
export function bountifulPreparedOriginalRoller(prepared:{map:BattleMap;characters:readonly Character[];characterIdByCombatantId:Record<string,string>},tokenId:string,hostMemberId:string):{tokenId:string;characterId?:string;memberId:string;kind?:'host-token'}{
 const tokens=prepared.map.tokens.filter(row=>row.id===tokenId);if(!hostMemberId||tokens.length!==1||tokens[0].type==='obstacle')throw Error('bountiful-controller:actual-creature-token-required')
 const token=tokens[0];if(token.characterId)return{tokenId,...bountifulPreparedController(prepared,tokenId,hostMemberId)}
 if(prepared.characterIdByCombatantId[tokenId]||!token.poolId)throw Error('bountiful-controller:actual-pool-token-required')
 return{tokenId,kind:'host-token',memberId:hostMemberId}
}
