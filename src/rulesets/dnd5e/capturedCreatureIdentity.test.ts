import {getEnemyVisualPresentation} from '../../lib/enemyPool'
import {it,expect} from 'vitest'
import {createDnd5eConditionEffect,normalizeDnd5eActiveEffects,validateDnd5eActiveEffectsStrict} from './activeEffects'
import {normalizeDnd5eCapturedCreatureIdentity} from './capturedCreatureIdentity'
import {captureDnd5eLinkedTargetPresentations} from './linkedTargetPresentation'
import {createDnd5eCombatant,startDnd5eHeadlessCombat} from './headlessCombatEngine'
import {migrateMapsState} from '../../store/maps'
it.each([false,true])('captures presentation once, including missing artwork: %s',missing=>{
 const identity={actorId:'corpse',name:'Remembered person',creatureType:'humanoid'}
 const effect={...createDnd5eConditionEffect({condition:'invisible',targetId:'owner',source:{kind:'dm'}}),capturedCreatureIdentity:identity}
 const owner=createDnd5eCombatant({id:'owner',name:'Owner',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,classState:{activeEffects:[effect]}})
 const state=startDnd5eHeadlessCombat('capture',[owner])
 const token={id:'corpse',type:'enemy',label:'Remembered person',x:0,y:0,size:1,emoji:'X',color:'#123456',poolId:'test-person',tokenPortrait:'portrait-a'}
 const map=migrateMapsState({maps:[{id:'map',name:'Map',tokens:missing?[]:[token]}],selectedId:'map',updatedAt:1}).maps[0]
 if(!missing)map.tokens[0].tokenPortrait='data:image/png;base64,aGVsbG8='
 captureDnd5eLinkedTargetPresentations(state,map,[])
 const captured=state.combatants.owner.classState.activeEffects![0].capturedCreatureIdentity!
 expect(captured.presentationCaptured).toBe(true)
 if(missing)expect(captured.presentation).toBeUndefined()
 else expect(captured.presentation).toMatchObject({emoji:'X',tokenPortrait:'data:image/png;base64,aGVsbG8='})
 const before=structuredClone(captured)
 map.tokens=[{...token,tokenPortrait:'portrait-b',label:'Different person'}] as typeof map.tokens
 captureDnd5eLinkedTargetPresentations(state,map,[])
 expect(state.combatants.owner.classState.activeEffects![0].capturedCreatureIdentity).toEqual(before)
 const restored=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(state.combatants.owner.classState.activeEffects)))
 expect(restored[0].capturedCreatureIdentity).toEqual(before)
 expect(validateDnd5eActiveEffectsStrict(restored).ok).toBe(true)
})
it('rejects corrupted identity and stat-block or ownership payloads',()=>{
 const identity={actorId:'corpse',name:'Name'}
 for(const invalid of [{...identity,actorId:''},{...identity,name:3},{...identity,inventory:[]},{...identity,controller:'player'},{...identity,presentationCaptured:false},{...identity,presentation:{emoji:'X',color:'#123',size:1}}]){
 expect(normalizeDnd5eCapturedCreatureIdentity(invalid)).toBeUndefined()
 const effect={...createDnd5eConditionEffect({condition:'invisible',targetId:'owner',source:{kind:'dm'}}),capturedCreatureIdentity:invalid}
 expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(false)
 }
})

it.each([false,true])('captures catalog portrait once, respecting room image overrides: %s',roomImage=>{
 const effect={...createDnd5eConditionEffect({condition:'invisible',targetId:'owner',source:{kind:'dm'}}),capturedCreatureIdentity:{actorId:'corpse',name:'Bandit'}}
 const owner=createDnd5eCombatant({id:'owner',name:'Owner',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,classState:{activeEffects:[effect]}})
 const state=startDnd5eHeadlessCombat('capture-catalog',[owner])
 const map=migrateMapsState({maps:[{id:'map',name:'Map',tokens:[{id:'corpse',type:'enemy',label:'Bandit',x:0,y:0,size:1,emoji:'M',color:'#123456',poolId:'srd-5.1:bandit'}]}],selectedId:'map',updatedAt:1}).maps[0]
 if(roomImage)map.tokens[0].tokenPortraitImageId='room-custom-art'
 captureDnd5eLinkedTargetPresentations(state,map,[])
 const identity=state.combatants.owner.classState.activeEffects![0].capturedCreatureIdentity!
 if(roomImage){expect(identity.presentation?.tokenPortraitImageId).toBe('room-custom-art');expect(identity.presentation?.tokenPortrait).toBeUndefined()}
 else {expect(getEnemyVisualPresentation('srd-5.1:bandit')?.tokenPortrait).toBeTruthy();expect(identity.presentation?.tokenPortrait).toBe(getEnemyVisualPresentation('srd-5.1:bandit')?.tokenPortrait)}
 const saved=structuredClone(identity)
 map.tokens[0].poolId='srd-5.1:orc';map.tokens[0].tokenPortrait='later-art'
 captureDnd5eLinkedTargetPresentations(state,map,[])
 expect(state.combatants.owner.classState.activeEffects![0].capturedCreatureIdentity).toEqual(saved)
})
