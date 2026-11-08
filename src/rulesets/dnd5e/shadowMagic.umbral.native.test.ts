import { expect, it } from 'vitest'
import { nativeUmbralFixture } from './shadowMagic.umbral.native.fixture'
import { umbralFeatureId } from './shadowMagic.umbralSource.native.fixture'
import { dnd5eCharacterHasPluginFeature, dnd5ePluginFeatureCurrentEnvelopeFullV1 } from './pluginApi'
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from './pluginFeatureAction'
import { prepareDnd5ePlayerMove, resolvePreparedDnd5ePlayerMove } from './playerMoveAction'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { dnd5eActiveObjectCreatureTraversal } from './activeEffects'

for (const carrier of ['unified','legacy'] as const) it('actual Sorcerer1→18 '+carrier+' archives own Umbral; BA6SP, real native object move, own-end5force',async()=>{
  const f=await nativeUmbralFixture('human',carrier,18)
  try {
    const soul=f.soul();expect(dnd5eCharacterHasPluginFeature(soul,umbralFeatureId)).toBe(true)
    expect(dnd5ePluginFeatureCurrentEnvelopeFullV1(umbralFeatureId)).toBe(true)
    let map={...f.map(),width:500,height:250,tokens:[...f.map().tokens].reverse().map((token:any)=>({...token,x:token.id==='soul-token'?25:425,y:25}))}
    const geometry=createEmptyMapGeometry(map.id)
    geometry.walls.push({id:'wood',kind:'wall',label:'Wood',material:'wood',points:[{x:125,y:0},{x:125,y:250}],
      baseHeightFeet:0,heightFeet:15,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1})
    setMapGeometryRuntime([geometry])
    const order=map.tokens.map((token:any,i:number)=>({tokenId:token.id,label:token.label,roll:20-i,color:'',emoji:''}))
    const action:any={id:'real-umbral-'+carrier,mapId:map.id,combatId:'umbral-native',sourceMode:'player',status:'pending',
      type:'dnd5e-plugin-action',actorTokenId:'soul-token',characterId:soul.id,targetTokenId:'soul-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,
      dnd5ePluginAction:{featureId:umbralFeatureId,payload:{selectedActivityId:'umbral-form'}}}
    const input={map,characters:f.characters(),action,initiativeOrder:order},before=structuredClone(input)
    const prepared=prepareDnd5ePluginFeatureAction(input);expect(prepared.ok,JSON.stringify(prepared)).toBe(true)
    if(!prepared.ok)throw Error(prepared.reason)
    const used=await resolvePreparedDnd5ePluginFeatureAction({prepared:prepared.prepared,combatRevision:1,rolls:{}})
    expect(used.result.ok,JSON.stringify(used.result)).toBe(true);if(!used.result.ok||!used.application)throw Error('Actual native form required')
    expect(input).toEqual(before)
    const actor=used.result.state.combatants['soul-token']
    expect(actor.turn.bonusActionAvailable).toBe(false);expect(actor.turn.actionAvailable).toBe(true)
    expect(actor.classResources['dnd5e-sorcery-points']).toMatchObject({current:12})
    expect(dnd5eActiveObjectCreatureTraversal(actor.classState.activeEffects)).toBe(true)
    const resistances=actor.classState.activeEffects!.flatMap(effect=>effect.modifiers?.damageResistance?[effect.modifiers.damageResistance]:[])
    expect(resistances.sort()).toEqual(['acid','bludgeoning','cold','fire','lightning','necrotic','piercing','poison','psychic','slashing','thunder'].sort())
    map=used.application.map as typeof map
    const economy=createDnd5eTurnEconomyCounts('umbral-native:1:soul-token',actor.speed)
    economy.action.current=actor.turn.actionAvailable?1:0;economy.bonusAction.current=actor.turn.bonusActionAvailable?1:0
    economy.reaction.current=actor.turn.reactionAvailable?1:0;economy.movement.current=actor.turn.movementRemaining
    const move=prepareDnd5ePlayerMove({map,characters:used.application.characters,initiativeOrder:order,turnEconomy:economy,
      action:{...action,id:action.id+'-move',type:'move-token',targetPosition:{x:125,y:25},dnd5ePluginAction:undefined}})
    expect(move.ok,JSON.stringify(move)).toBe(true);if(!move.ok)throw Error(move.reason)
    const moved=resolvePreparedDnd5ePlayerMove({prepared:move.prepared})
    expect(moved.result.ok,JSON.stringify(moved.result)).toBe(true);if(!moved.result.ok)throw Error(moved.result.reason)
    const hp=moved.result.state.combatants['soul-token'].currentHp
    expect(hp).toBe(actor.currentHp)
    const ended=resolveDnd5eHeadlessAction(moved.result.state,{type:'end-turn',actorId:'soul-token'})
    expect(ended.ok,JSON.stringify(ended)).toBe(true)
    expect(ended.state.combatants['soul-token'].currentHp).toBe(hp-5)
    expect(ended.state.combatants['soul-token'].position).toEqual({x:125,y:25})
    expect(dnd5eActiveObjectCreatureTraversal(ended.state.combatants['soul-token'].classState.activeEffects)).toBe(true)
    const foeEnd=resolveDnd5eHeadlessAction(ended.state,{type:'end-turn',actorId:'foe-token'})
    expect(foeEnd.ok,JSON.stringify(foeEnd)).toBe(true)
    expect(foeEnd.state.combatants['soul-token'].currentHp).toBe(hp-5)
  }finally{setMapGeometryRuntime([]);f.dispose()}
})
