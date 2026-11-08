import {it,expect} from 'vitest'
import {normalizeCharacter,useCharacterStore} from '../../store/characters'
import {useMapStore,type BattleMap} from '../../store/maps'
import {prepareDnd5ePlayerMove,resolvePreparedDnd5ePlayerMove} from '../../rulesets/dnd5e/playerMoveAction'
import {createDnd5eTurnEconomyCounts} from '../../rulesets/dnd5e/turnEconomy'
import {applyDnd5eCombatResultApplication,mergeDnd5eCombatCharacterResult} from './commitDnd5eCombatResult'
import {dnd5eCombatApplicationUsesStructuralMap,projectDnd5eCombatApplicationStoreState} from './combatApplicationStoreProjection'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'

it('replays actual entity coordinator and authority Store finalization including exact undefined fields',()=>{
 const character=normalizeCharacter({id:'mover',name:'Mover',charClass:'战士',level:4,currentHp:36,maxHp:36})
 character.dnd5eCombatState={schemaVersion:2,wardingBondParticipantCharacterId:'mover',runningJumpApproachFeet:0}
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'mover-token',characterId:'mover',label:'Mover',type:'player',x:500,y:375,size:1,color:'',emoji:''}]}
 const characters=[character],action:SharedPlayerActionState={id:'real-segment:1',mapId:'map',characterId:'mover',actorTokenId:'mover-token',type:'move-token',targetPosition:{x:525,y:375},dnd5eTraversalMode:'walk',sourceMode:'player',roomMemberId:'mover-member',status:'pending',round:1,initiativeIndex:0,seq:1,updatedAt:1}
 const prepare=prepareDnd5ePlayerMove({action,map,characters,initiativeOrder:[{tokenId:'mover-token',label:'Mover',roll:20,color:'',emoji:''}],turnEconomy:createDnd5eTurnEconomyCounts('combat:1:mover-token')});if(!prepare.ok)throw Error(prepare.reason)
 const native=resolvePreparedDnd5ePlayerMove({prepared:prepare.prepared,transactionId:action.id},{now:1000});if(!native.result.ok||!native.application)throw Error('True native movement required')
 const projected=projectDnd5eCombatApplicationStoreState({map,characters,application:native.application})
 useMapStore.setState({maps:[structuredClone(map)]});useCharacterStore.setState({characters:structuredClone(characters)})
 applyDnd5eCombatResultApplication({application:native.application,mapId:map.id,applicationMode:dnd5eCombatApplicationUsesStructuralMap(map,native.application)?'map':'entities',
  applyMap:(id,resolved)=>useMapStore.getState().applyAuthorityMapUpdate(id,resolved),
  applyToken:(id,token,resolved,patch)=>useMapStore.getState().applyAuthorityTokenUpdate(id,token,patch??resolved),
  applyCharacter:(id,resolved,patch)=>{const current=useCharacterStore.getState().characters.find(row=>row.id===id);if(!current)throw Error('Actual character');useCharacterStore.getState().applyAuthorityUpdate(id,mergeDnd5eCombatCharacterResult(current,resolved,patch),{protectPatchUntilAcknowledged:true})},
 })
 const actual={map:useMapStore.getState().maps[0],characters:useCharacterStore.getState().characters}
 expect(encodeSecondChanceParentWire(projected)).toEqual(encodeSecondChanceParentWire(actual))
 expect(Object.hasOwn(actual.map,'dnd5eSkillCheckMovement')).toBe(false)
 expect(Object.hasOwn(actual.characters[0].dnd5eCombatState!,'activeEffects')).toBe(true)
 expect(Object.hasOwn(actual.characters[0].dnd5eCombatState!,'hitPointMaximumReductionLedger')).toBe(true)
 expect(actual.map.tokens[0].x).toBe(525);expect(native.result.state.combatants['mover-token'].turn.movementRemaining).toBe(30)
 expect(map.tokens[0].x).toBe(500)
})
