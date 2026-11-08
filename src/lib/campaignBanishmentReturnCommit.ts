import type {SharedRoomGatewayPort} from '../ports/sharedRoomGateway'
import type {BattleMap} from '../store/maps'
import type {Character} from '../types/character'
import type {SharedCampaignTimeState} from './campaignTime'
import type {SharedCombatState} from './sharedCombatTypes'
import {createEmptyMapGeometry,type MapGeometryState} from './mapGeometry'
import type {EtherealExpirySettlement} from './campaignEtherealReturnCommit'
import {normalizeDnd5eActiveEffects} from '../rulesets/dnd5e/activeEffects'
import {reconcileDnd5eCharacterCampaignTime} from '../rulesets/dnd5e/campaignTimeRules'

type Versioned={_sync?:{revision?:number}}
const native=(effects:unknown)=>normalizeDnd5eActiveEffects(effects).filter(effect=>effect.tags?.includes('banishing-smite-native-return'))
function pendingIds(map:BattleMap,characters:readonly Character[]):Set<string>{
 const byId=new Map(characters.map(character=>[character.id,character]))
 return new Set(map.tokens.flatMap(token=>native(token.characterId?byId.get(token.characterId)?.dnd5eCombatState?.activeEffects:token.dnd5eCombatState?.activeEffects).map(effect=>`${token.id}:${effect.id}`)))
}
/** Ordinary roster edits must not restart other clock reconciliations. Only a
 * pending native departure and its actual controller/body facts add a key. */
export function dnd5eBanishmentReturnRoomKey(characters:readonly Character[],maps:readonly BattleMap[]):string{
 if(!maps.some(map=>pendingIds(map,characters).size))return ''
 const effects=(value:unknown)=>normalizeDnd5eActiveEffects(value).filter(effect=>effect.captureExecutionIdentity===true||effect.tags?.includes('banishing-smite-native-return'))
 return JSON.stringify({characters:characters.map(character=>[character.id,character.deathSaveFailures,effects(character.dnd5eCombatState?.activeEffects)]),
  maps:maps.map(map=>[map.id,map.tokens.map(token=>[token.id,token.characterId,token.x,token.y,token.elevationFeet,token.size,effects(token.dnd5eCombatState?.activeEffects)])])})
}
/** Physical native return, any required fall and reaction costs publish as one
 * existing room CAS. Unknown sources and foreign departures never qualify. */
export async function commitCampaignBanishmentReturns(
 gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>,
 settle:EtherealExpirySettlement,isCurrent:()=>boolean,
):Promise<boolean>{
 const [maps,roster,clock,geometry,combat]=await Promise.all([
  gateway.loadResource<Versioned&{maps:BattleMap[]}>('maps'),gateway.loadResource<Versioned&{characters:Character[]}>('characters'),
  gateway.loadResource<Versioned&SharedCampaignTimeState>('campaign-time'),gateway.loadResource<Versioned&{maps:MapGeometryState[]}>('map-geometry'),
  gateway.loadResource<Versioned&SharedCombatState>('combat'),
 ])
 if(!isCurrent())return false
 if(!maps||!roster||!clock)throw Error('banishment-return-snapshot-unavailable')
 const scenes=maps.maps.filter(map=>pendingIds(map,roster.characters).size)
 if(!scenes.length)return false
 let characters:readonly Character[]=roster.characters.map(character=>reconcileDnd5eCharacterCampaignTime(character,clock).character)
 const nextMaps=[...maps.maps];let nextCombat:SharedCombatState|undefined,changed=false
 for(const map of scenes){
  const before=pendingIds(map,roster.characters)
  const result=await settle({map,geometry:geometry?.maps.find(scene=>scene.mapId===map.id)??createEmptyMapGeometry(map.id),
   beforeCharacters:roster.characters,characters,combat:nextCombat??combat??undefined,worldMinute:clock.worldMinute})
  if(!isCurrent())return false
  const remaining=pendingIds(result.map,result.characters)
  if(![...before].some(id=>!remaining.has(id)))continue
  changed=true;nextMaps[nextMaps.findIndex(scene=>scene.id===map.id)]=result.map;characters=result.characters;nextCombat=result.combat??nextCombat
 }
 if(!changed)return false
 const revision=(value:Versioned|null)=>value?._sync?.revision??0
 const readRevisions:Record<string,number>={'campaign-time':revision(clock),'map-geometry':revision(geometry)}
 if(!nextCombat)readRevisions.combat=revision(combat)
 await gateway.saveResourcesAtomically([
  {name:'maps',data:{...maps,maps:nextMaps},expectedRevision:revision(maps)},
  {name:'characters',data:{...roster,characters},expectedRevision:revision(roster)},
  ...(nextCombat?[{name:'combat',data:nextCombat,expectedRevision:revision(combat)}]:[]),
 ],{readRevisions})
 return true
}
