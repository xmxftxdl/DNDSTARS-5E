import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import type{SharedCampaignTimeState}from'../../lib/campaignTime'
import type{MapGeometryState}from'../../lib/mapGeometry'
import{projectDnd5eCampaignTimeAirborneTokens}from'../../components/CampaignTimeSystem'
import{reconcileDnd5eCharacterCampaignTime,reconcileDnd5eSourceEffectLifecycles,reconcileDnd5eCampaignRosterSourceEffects}from'../../rulesets/dnd5e/campaignTimeRules'
/** Reuses the same formal character minute cursor and airborne projection as
 * CampaignTimeSystem. Caller CASes all resulting maps/characters with the clock
 * and geometry revisions; never reset a cursor while silently losing its work. */
export function reconcilePactHostClock(input:{characters:readonly Character[];maps:readonly BattleMap[];geometry:readonly MapGeometryState[];clock:SharedCampaignTimeState}){
 const sourceCharacters=reconcileDnd5eSourceEffectLifecycles(input.characters)
 const projected=projectDnd5eCampaignTimeAirborneTokens({characters:sourceCharacters,maps:input.maps,geometryMaps:input.geometry,clock:input.clock})
 const results=reconcileDnd5eCampaignRosterSourceEffects(sourceCharacters.map(character=>reconcileDnd5eCharacterCampaignTime(character,input.clock,{airborne:projected.airborneCharacterIds.has(character.id)})))
 return{characters:results.map(result=>result.character),maps:projected.maps}
}
