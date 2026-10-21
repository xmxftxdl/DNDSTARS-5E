import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { captureDnd5eLongCasting, beginDnd5eLongCasting, armDnd5eLongCasting, observeDnd5eLongCasting } from './longCastingContinuity'
import { captureDnd5eCastingProximity, verifyDnd5eCastingProximity } from './castingProximity'
import { authorizeDnd5eActivityTargetQualificationsV1, dnd5eHostTargetQualificationsV1 } from './activities/dnd5eActivityTargetQualifications'
import { createDnd5ePreparedDamageCommitSession } from './damageCommitSession'
import { cloneDnd5eHostTransactionInput } from './hostTransactionClone'
import type { BattleMap } from '../../store/maps'

function fixture() {
  const actor = createDnd5eCombatant({ id:'actor', name:'Actor', initiative:20, controller:'player',
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10}, proficiencyBonus:2, armorClass:10,
    currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false })
  const binding = {requestId:'cast',spellId:'ceremony',mapId:'map',actorTokenId:actor.id,actorCharacterId:'sheet'}
  const receipt = captureDnd5eLongCasting(binding,actor)!
  const state = beginDnd5eLongCasting(receipt,binding,startDnd5eHeadlessCombat('replay',[actor]))!
  expect(armDnd5eLongCasting(receipt,binding,state.combatants.actor)).toBe(true)
  const action = {actorId:actor.id,pluginId:'ceremony',actionId:'cast',transactionId:'transaction',payload:{activityChoices:{rite:'coming-of-age'}}}
  authorizeDnd5eActivityTargetQualificationsV1(action,{actor:['adult','willing']})
  return {binding,state,input:{prepared:{state,longCastingReceipt:receipt,activityHeadlessAction:action},dice:[4]}}
}

it('the actual prepared replay retains issued long-cast and qualification evidence while freezing command data',()=>{
  const {binding,state,input} = fixture()
  const session = createDnd5ePreparedDamageCommitSession(input, value=>({
    long:observeDnd5eLongCasting(value.prepared.longCastingReceipt,binding,value.prepared.state.combatants.actor),
    qualified:dnd5eHostTargetQualificationsV1(value.prepared.activityHeadlessAction),dice:value.dice,
  }),()=>false)
  input.dice[0]=1
  input.prepared.activityHeadlessAction.payload.activityChoices.rite='wedding'
  expect(session.run(state)).toMatchObject({status:'resolved',result:{long:true,qualified:{actor:['adult','willing']},dice:[4]}})
})

it.each(['json','structured'] as const)('replay does not turn a %s copy into Host authority',mode=>{
  const {binding,state,input} = fixture()
  const copied = mode==='json'?JSON.parse(JSON.stringify(input)):structuredClone(input)
  const session = createDnd5ePreparedDamageCommitSession(copied,value=>({
    long:observeDnd5eLongCasting(value.prepared.longCastingReceipt,binding,value.prepared.state.combatants.actor),
    qualified:dnd5eHostTargetQualificationsV1(value.prepared.activityHeadlessAction),
  }),()=>false)
  expect(session.run(state)).toMatchObject({status:'resolved',result:{long:false,qualified:undefined}})
})

it('trusted cloning preserves proximity identity and its sticky interruption, including container aliases',()=>{
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
    tokens:[{id:'actor',label:'Actor',type:'player',characterId:'sheet',x:25,y:25,size:1,color:'',emoji:''}]}
  const binding={requestId:'cast',spellId:'ceremony',activityId:'rite',mapId:'map',actorTokenId:'actor',targetTokenIds:['actor'],maximumTargetDistanceFeet:10}
  const receipt=captureDnd5eCastingProximity(binding,map)!
  const source:{receipt:typeof receipt; list:Map<object,Set<object>>; self?:unknown}={receipt,list:new Map([[receipt,new Set([receipt])]])}
  source.self=source
  const cloned=cloneDnd5eHostTransactionInput(source)
  expect(cloned).not.toBe(source)
  expect(cloned.self).toBe(cloned)
  expect(cloned.receipt).toBe(receipt)
  expect(cloned.list.get(receipt)?.has(receipt)).toBe(true)
  expect(verifyDnd5eCastingProximity(cloned.receipt,binding,map)).toBe(true)
  expect(verifyDnd5eCastingProximity(cloned.receipt,binding,{...map,tokens:[]})).toBe(false)
  expect(verifyDnd5eCastingProximity(receipt,binding,map)).toBe(false)
})

it('qualification evidence remains bound to choices and transaction after trusted cloning',()=>{
  const {input}=fixture(),copied=cloneDnd5eHostTransactionInput(input)
  copied.prepared.activityHeadlessAction.transactionId='different'
  expect(dnd5eHostTargetQualificationsV1(copied.prepared.activityHeadlessAction)).toBeUndefined()
  copied.prepared.activityHeadlessAction.transactionId='transaction'
  copied.prepared.activityHeadlessAction.payload.activityChoices.rite='wedding'
  expect(dnd5eHostTargetQualificationsV1(copied.prepared.activityHeadlessAction)).toBeUndefined()
})
