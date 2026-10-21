import {campaignUnappliedEffectMinutes,characterCombatClockKey,tokenCombatClockKey} from '../../../shared/combat-round-credits.mjs'
import {mapGeometryTokenElevation,mapGeometryTerrainElevationAtPoint,type MapGeometryState} from '../../lib/mapGeometry'
import type {SharedCampaignTimeState} from '../../lib/campaignTime'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
import {advanceDnd5eCampaignTimedActiveEffects,reconcileDnd5eCharacterCampaignTime} from './campaignTimeRules'
import {advanceDnd5eHitPointMaximumReductionDurations,normalizeDnd5eHitPointMaximumReductionLedger} from './hitPointMaximumReductions'
import {dnd5eNativeMonsterBreathing} from './monsterBreathing'

/** Run before expiring temple geometry in the same revision-checked clock transaction. */
export function settleDnd5eTempleCampaignTime(input:{maps:readonly BattleMap[];geometry:readonly MapGeometryState[];characters:readonly Character[];clock:SharedCampaignTimeState;
 priorMaps?:readonly BattleMap[];priorGeometry?:readonly MapGeometryState[]}){
 let characters=[...input.characters],changed=false
 const maps=input.maps.map(map=>{
  let mapChanged=false
  const tokens=map.tokens.map(token=>{
   if(token.type==='obstacle'||token.dnd5eSpellEffect)return token
   const previousLocations=input.priorMaps?.flatMap(prior=>prior.tokens.filter(body=>body.id===token.id&&body.characterId===token.characterId)
    .map(body=>({mapId:prior.id,token:body})))??[]
   const previous=previousLocations.find(location=>location.mapId===map.id)??(previousLocations.length===1?previousLocations[0]:undefined)
   const positionToken=previous?.token??token,positionMapId=previous?.mapId??map.id
   const geometry=(previous?input.priorGeometry??input.geometry:input.geometry).find(scene=>scene.mapId===positionMapId)
   if(!geometry?.structureLifetimes?.some(s=>s.templeWard))return token
   const characterIndex=token.characterId?characters.findIndex(c=>c.id===token.characterId):-1
   const character=characters[characterIndex]
   const fromWorldMinute=character?.dnd5eWorldTimeAppliedMinute??token.dnd5eWorldTimeAppliedMinute
   if(!Number.isSafeInteger(fromWorldMinute)||fromWorldMinute!<0||fromWorldMinute!>=input.clock.worldMinute)return token
   // Settle the prior interval for every occupant before an expiry reaction is
   // created. Otherwise a new Feather Fall inherits the old clock marker and
   // the next room projection immediately ages it by the entire elapsed day.
   const actorKey=character?characterCombatClockKey(character.id):tokenCombatClockKey(positionMapId,token.id)
   const context={templeHealing:{geometry,token:positionToken,clock:input.clock,fromWorldMinute:fromWorldMinute!,actorKey},
    cannotRegainHitPoints:!!token.dnd5eSimulacrum,
    intrinsicBreathing:character?undefined:dnd5eNativeMonsterBreathing(token.dnd5eCombatState?.wildShapeFormId??token.poolId),
    airborne:mapGeometryTokenElevation(geometry,positionToken)>mapGeometryTerrainElevationAtPoint(geometry,positionToken)}
   if(character){
    const result=reconcileDnd5eCharacterCampaignTime(character,input.clock,context)
    if(result.changed){characters[characterIndex]=result.character;changed=true}
    return token
   }
   const elapsed=campaignUnappliedEffectMinutes(input.clock,fromWorldMinute!,actorKey)
   const maximumReduction=advanceDnd5eHitPointMaximumReductionDurations(normalizeDnd5eHitPointMaximumReductionLedger(token.dnd5eCombatState?.hitPointMaximumReductionLedger),elapsed*10)
   const maximum=maximumReduction.maximum??token.maxHp??token.hp??1
   const projected=advanceDnd5eCampaignTimedActiveEffects({id:token.id,name:token.label,rulesetId:'dnd5e-2014-srd-5.1',
    currentHp:Math.min(token.hp??maximum,maximum),maxHp:maximum,conditions:token.dnd5eCombatState?.conditions??[],
    concentrating:token.dnd5eCombatState?.concentrationSpellId!=null,dnd5eCombatState:{...token.dnd5eCombatState,hitPointMaximumReductionLedger:maximumReduction.ledger},
    dnd5eWorldTimeAppliedMinute:fromWorldMinute} as Character,elapsed,context)
   mapChanged=true;changed=true
   return {...token,hp:token.hp==null?token.hp:projected.currentHp,maxHp:token.maxHp==null?token.maxHp:projected.maxHp,dnd5eCombatState:projected.dnd5eCombatState,dnd5eWorldTimeAppliedMinute:input.clock.worldMinute}
  })
  return mapChanged?{...map,tokens}:map
 })
 return {maps,characters,changed}
}
