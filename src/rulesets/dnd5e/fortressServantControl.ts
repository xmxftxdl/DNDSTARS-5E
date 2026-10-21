import type {BattleMap} from '../../store/maps'
import type {MapGeometryState} from '../../lib/mapGeometry'
import {normalizeStructureLifetimes} from '../../../shared/structure-lifetime.mjs'

/** Resolve against Host geometry, never a caller's claimed caster or delegated identity. */
export function resolveDnd5eFortressServantControl(input:{map:BattleMap;geometry:MapGeometryState;
 servantTokenId:string;commanderTokenId:string;worldMinute:number}){
 if(input.map.id!==input.geometry.mapId||!Number.isSafeInteger(input.worldMinute)||input.worldMinute<0)return undefined
 const servant=input.map.tokens.find(token=>token.id===input.servantTokenId)
 const commander=input.map.tokens.find(token=>token.id===input.commanderTokenId)
 const binding=servant?.dnd5eObjectState?.structureBinding
 if(!servant||servant.type!=='obstacle'||servant.hp==null||servant.hp<=0||!commander||commander.type==='obstacle'||commander.dnd5eSpellEffect||
  (commander.hp!=null&&commander.hp<=0)||binding?.mapId!==input.map.id)return undefined
 const record=normalizeStructureLifetimes(input.geometry.structureLifetimes)?.find(record=>record.id===binding.structureId)
 const member=record?.fortressServices?.servants?.find(member=>member.tokenId===servant.id)
 if(!record||record.replacementGroup!=='mighty-fortress'||!member||input.worldMinute<record.createdWorldMinute||
  (record.expiresWorldMinute!=null&&input.worldMinute>=record.expiresWorldMinute)||
  ![record.casterId,...record.fortressServices!.authorizedCreatureIds].includes(commander.characterId??commander.id))return undefined
 return {servant,commander,record,member}
}
