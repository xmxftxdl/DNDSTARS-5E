import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat} from './headlessCombatEngine'
import {captureDnd5eLongCasting,beginDnd5eLongCasting,armDnd5eLongCasting,dnd5eLongCastingCanComplete,observeDnd5eLongCasting,continueDnd5eLongCastingInsideCombat,invalidateDnd5eLongCasting} from './longCastingContinuity'
import {normalizeCharacter} from '../../store/characters'
import type {SharedCampaignTimeState} from '../../lib/campaignTime'
import {recordDnd5eRestActivityWindow,consumeDnd5eRestActivityWindow} from './restActivityWindows'
import {captureDnd5eRestCastingWindow,openDnd5eRestCastingWindow} from './restActivityCastingWindow'

function fixture(){
 const binding={requestId:'rest-cast',spellId:'teleportation-circle',mapId:'map',actorTokenId:'hero',actorCharacterId:'hero'}
 const actor=createDnd5eCombatant({id:'hero',name:'Hero',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10},proficiencyBonus:5,armorClass:12,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const state=startDnd5eHeadlessCombat('exploration',[actor]);state.active=false;state.combatants.hero.campaignWorldMinute=540
 return{binding,state}
}
it.each([60,600,61])('requires observed concentration and the complete %s seconds before finishing',seconds=>{
 const {binding,state}=fixture(),before=structuredClone(state)
 const receipt=captureDnd5eLongCasting(binding,state.combatants.hero,undefined,{startedAtWorldMinute:540,requiredSeconds:seconds})!
 expect(dnd5eLongCastingCanComplete(receipt,binding,state)).toBe(false)
 const started=beginDnd5eLongCasting(receipt,binding,state)!
 expect(armDnd5eLongCasting(receipt,binding,started.combatants.hero)).toBe(true)
 expect(state).toEqual(before)
 started.combatants.hero.campaignWorldMinute=540+Math.ceil(seconds/60)-1
 expect(dnd5eLongCastingCanComplete(receipt,binding,started)).toBe(false)
 started.combatants.hero.campaignWorldMinute++
 expect(dnd5eLongCastingCanComplete(receipt,binding,started)).toBe(true)
 expect(dnd5eLongCastingCanComplete(JSON.parse(JSON.stringify(receipt)),binding,started)).toBe(false)
 expect(dnd5eLongCastingCanComplete(receipt,{...binding,requestId:'other'},started)).toBe(false)
 started.combatants.hero.concentrating=false
 expect(observeDnd5eLongCasting(receipt,binding,started.combatants.hero)).toBe(false)
 started.combatants.hero.concentrating=true
 expect(dnd5eLongCastingCanComplete(receipt,binding,started)).toBe(false)
})
it('rejects stale start clocks and retains remaining work when combat begins',()=>{
 const {binding,state}=fixture()
 expect(captureDnd5eLongCasting(binding,state.combatants.hero,undefined,{startedAtWorldMinute:539,requiredSeconds:60})).toBeUndefined()
 const receipt=captureDnd5eLongCasting(binding,state.combatants.hero,undefined,{startedAtWorldMinute:540,requiredSeconds:600})!
 expect(beginDnd5eLongCasting(receipt,binding,{...state,active:true})).toBeUndefined()
 const started=beginDnd5eLongCasting(receipt,binding,state)!
 expect(armDnd5eLongCasting(receipt,binding,started.combatants.hero)).toBe(true)
 started.active=true;started.combatId='new-combat';started.combatants.hero.campaignWorldMinute=541
 expect(continueDnd5eLongCastingInsideCombat(receipt,binding,started,541)?.requiredRounds).toBe(90)
 expect(dnd5eLongCastingCanComplete(receipt,binding,started)).toBe(false)
 invalidateDnd5eLongCasting(receipt)
})

it('retains only the bound rest authorization through a real one-minute cast',()=>{
 const {binding:casting,state}=fixture()
 const clock:SharedCampaignTimeState={schemaVersion:2,worldMinute:540,displayMode:'campaign-day',displayMinuteOffset:0,timers:[],updatedAt:1,
  advances:[{id:'rest',kind:'short-rest',fromWorldMinute:480,toWorldMinute:540,minutes:60,reason:'Rest',dawnsCrossed:0,expiredTimerIds:[],createdAt:1,beneficiaryCharacterIds:['hero']}]}
 const character=recordDnd5eRestActivityWindow(normalizeCharacter({id:'hero',name:'Hero',dnd5eWorldTimeAppliedMinute:540}),'short-rest-complete',540)
 const binding={packageId:'test.dreams',packageVersion:'1.0.0',activityId:'walker-portal',restEventId:character.dnd5eRestActivityWindow!.eventId,casting}
 const castingReceipt=captureDnd5eLongCasting(casting,state.combatants.hero,undefined,{startedAtWorldMinute:540,requiredSeconds:60})!
 const initial={character,clock,binding,castingReceipt}
 const receipt=captureDnd5eRestCastingWindow(initial)!
 expect(receipt).toBeTruthy()
 expect(captureDnd5eRestCastingWindow({...initial,clock:{...clock,advances:[]}})).toBeUndefined()
 expect(captureDnd5eRestCastingWindow({...initial,clock:{...clock,worldMinute:541}})).toBeUndefined()
 const started=beginDnd5eLongCasting(castingReceipt,casting,state)!
 expect(armDnd5eLongCasting(castingReceipt,casting,started.combatants.hero)).toBe(true)
 expect(openDnd5eRestCastingWindow({receipt,character,clock,binding,state:started})).toBeUndefined()
 started.combatants.hero.campaignWorldMinute=541
 const completed={receipt,character:{...character,dnd5eWorldTimeAppliedMinute:541},clock:{...clock,worldMinute:541},binding,state:started}
 expect(openDnd5eRestCastingWindow(completed)).toEqual(character.dnd5eRestActivityWindow)
 expect(openDnd5eRestCastingWindow({...completed,receipt:JSON.parse(JSON.stringify(receipt))})).toBeUndefined()
 expect(openDnd5eRestCastingWindow({...completed,binding:{...binding,packageVersion:'2.0.0'}})).toBeUndefined()
 expect(openDnd5eRestCastingWindow({...completed,binding:{...binding,activityId:'walker-dream'}})).toBeUndefined()
 const consumed=consumeDnd5eRestActivityWindow(character,{worldMinute:540,eventId:binding.restEventId,packageId:binding.packageId,activityId:binding.activityId,outcome:'used'})!
 expect(openDnd5eRestCastingWindow({...completed,character:{...consumed,dnd5eWorldTimeAppliedMinute:541}})).toBeUndefined()
 const nextRest=recordDnd5eRestActivityWindow(completed.character,'short-rest-complete',541)
 expect(openDnd5eRestCastingWindow({...completed,character:nextRest})).toBeUndefined()
 started.combatants.hero.concentrating=false
 expect(openDnd5eRestCastingWindow(completed)).toBeUndefined()
 started.combatants.hero.concentrating=true
 expect(openDnd5eRestCastingWindow(completed)).toBeUndefined()
 expect(character.dnd5eRestActivityWindow!.receipts).toEqual({})
})
