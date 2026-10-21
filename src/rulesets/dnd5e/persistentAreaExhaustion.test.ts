import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5ePersistentAreaTrigger} from './headlessCombatEngine'
import {normalizeDnd5ePersistentAreaTriggerSnapshot} from './persistentAreaTypes'
import {addDnd5eAreaExhaustion,normalizeDnd5eSourcedExhaustion} from './sourcedExhaustion'
import {reconcileDnd5eAreaCaptivesAcrossMaps} from './persistentAreaEnd'
import {normalizeCharacter} from '../../store/characters'
import type {BattleMap} from '../../store/maps'
import {createDnd5eConditionEffect,createDnd5eMechanicalEffect,dnd5eActiveEmittedLight,normalizeDnd5eActiveEffects} from './activeEffects'
import {dnd5eAttackerIsUnseen,dnd5eUnseenTargetImposesDisadvantage} from './passiveDefenses'
import {dnd5eCombatantCanSee,setDnd5eSourcedExhaustion} from './headlessCombatEngine'

const trigger={id:'exposure',label:'Exposure',timing:'turn-start' as const,
 savingThrow:{ability:'con' as const,dc:15,onSuccess:'none' as const,magical:true},
 damage:{count:4,sides:10,type:'radiant' as const},exhaustionOnFailedSave:{levels:1,endsWithArea:true as const}}
const origin={mapId:'source-map',areaId:'area',sourceActorId:'caster'}
const state=()=>startDnd5eHeadlessCombat('exposure',['caster','target'].map(id=>createDnd5eCombatant({
 id,name:id,controller:'player',initiative:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},
 proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})))
const request={areaMapId:'source-map',areaId:'area',sourceId:'caster',targetId:'target',trigger,damageRolls:[3,3,3,3]}
const glowingTrigger={...trigger,visibilityOnFailedSave:{dimRadiusFeet:5,color:'#a3e635',suppressInvisibilityBenefits:true as const,endsWithArea:true as const}}
const map=(id:string):BattleMap=>({id,name:id,width:100,height:100,gridSize:10,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]})
it('kills at six levels, ends concentration, and does not resurrect when the area expires',()=>{
 const before=state(),target=before.combatants.target
 setDnd5eSourcedExhaustion(target,addDnd5eAreaExhaustion({schemaVersion:1,baseLevel:0,sources:[]},origin,5))
 target.concentrating=true;target.classState.concentrationSpellId='test:concentration'
 const result=resolveDnd5ePersistentAreaTrigger(before,{...request,d20:1,d20Second:2})
 expect(result.ok).toBe(true)
 const dead=result.state.combatants.target
 expect(dead).toMatchObject({currentHp:0,concentrating:false,exhaustionLevel:6,deathSaves:{dead:true,failures:3}})
 expect(result.events).toContainEqual(expect.objectContaining({type:'instant-death',sourceId:'caster',targetId:'target'}))
 const sheet=normalizeCharacter({id:'dead',currentHp:0,maxHp:100,deathSaveFailures:3,exhaustionLevel:6,dnd5eCombatState:dead.classState})
 const ended=reconcileDnd5eAreaCaptivesAcrossMaps({maps:[map('source-map')],characters:[sheet],round:1})
 expect(ended.characters[0]).toMatchObject({exhaustionLevel:0,currentHp:0,deathSaveFailures:3})
 expect(before.combatants.target.deathSaves.dead).toBe(false)
})
it('consumes death ward instead of persisting a fatal sixth increment, and the next exposure kills',()=>{
 const before=state(),target=before.combatants.target
 setDnd5eSourcedExhaustion(target,addDnd5eAreaExhaustion({schemaVersion:1,baseLevel:0,sources:[]},origin,5))
 target.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'srd-5.1:spell:death-ward',label:'Ward',source:{kind:'spell',actorId:'caster'},targetId:'target',duration:{type:'permanent'}})]
 const survived=resolveDnd5ePersistentAreaTrigger(before,{...request,d20:1,d20Second:2})
 expect(survived.ok).toBe(true)
 expect(survived.state.combatants.target).toMatchObject({currentHp:38,exhaustionLevel:5,deathSaves:{dead:false}})
 expect(survived.events).toContainEqual(expect.objectContaining({type:'death-ward-triggered',trigger:'instant-death'}))
 const killed=resolveDnd5ePersistentAreaTrigger(survived.state,{...request,d20:1,d20Second:2})
 expect(killed.ok).toBe(true)
 expect(killed.state.combatants.target.deathSaves.dead).toBe(true)
})
it('uses an existing mature clone without carrying the dead body exposure into the replacement',()=>{
 const before=state(),target=before.combatants.target
 setDnd5eSourcedExhaustion(target,addDnd5eAreaExhaustion({schemaVersion:1,baseLevel:0,sources:[]},origin,5))
 target.campaignWorldMinute=120
 target.classState.spellAuthorityRecords={clone:{schemaVersion:1,id:'clone',kind:'clone-receptacle',sourceActorId:'caster',subjectActorId:'target',
  sourceActivityId:'test:clone',createdWorldMinute:0,maturesAtWorldMinute:120,
  bodySnapshot:{name:'Replacement',abilities:{...target.abilities},maximumHitPoints:80,sizeRank:2,creatureType:'humanoid'}}}
 const result=resolveDnd5ePersistentAreaTrigger(before,{...request,trigger:glowingTrigger,d20:1,d20Second:2})
 expect(result.ok).toBe(true)
 expect(result.state.combatants.target).toMatchObject({name:'Replacement',maxHp:80,currentHp:80,exhaustionLevel:0,deathSaves:{dead:false}})
 expect(result.state.combatants.target.classState.exhaustionBaseMaxHp).toBeUndefined()
 expect(result.state.combatants.target.classState.spellAuthorityRecords).toBeUndefined()
 expect(dnd5eActiveEmittedLight(result.state.combatants.target.classState.activeEffects)).toBeUndefined()
 expect(result.events).toContainEqual(expect.objectContaining({type:'clone-soul-transferred'}))
})
it('halves an odd maximum once at level four and restores the maximum without healing',()=>{
 const target=state().combatants.target
 target.maxHp=101;target.currentHp=90
 setDnd5eSourcedExhaustion(target,{schemaVersion:1,baseLevel:4,sources:[]})
 expect(target).toMatchObject({maxHp:50,currentHp:50})
 setDnd5eSourcedExhaustion(target,{schemaVersion:1,baseLevel:5,sources:[]})
 expect(target.maxHp).toBe(50)
 target.currentHp=20
 setDnd5eSourcedExhaustion(target,{schemaVersion:1,baseLevel:3,sources:[]})
 expect(target).toMatchObject({maxHp:101,currentHp:20})
 expect(target.classState.exhaustionBaseMaxHp).toBeUndefined()
})

it('suppresses invisible benefits and emits light without deleting invisibility, restoring benefits after area end',()=>{
 const before=state()
 const invisible=createDnd5eConditionEffect({id:'invisibility',condition:'invisible',targetId:'target',source:{kind:'spell',actorId:'target'},duration:{type:'permanent'}})
 before.combatants.target.classState.activeEffects=[invisible]
 before.combatants.target.conditions=['invisible']
 expect(dnd5eAttackerIsUnseen(before.combatants.target)).toBe(true)
 const result=resolveDnd5ePersistentAreaTrigger(before,{...request,trigger:glowingTrigger,d20:2})
 expect(result.ok).toBe(true)
 const target=result.state.combatants.target
 expect(target.conditions).toContain('invisible')
 expect(target.classState.activeEffects?.some(effect=>effect.id==='invisibility')).toBe(true)
 expect(dnd5eAttackerIsUnseen(target)).toBe(false)
 expect(dnd5eUnseenTargetImposesDisadvantage(result.state.combatants.caster,target)).toBe(false)
 expect(dnd5eCombatantCanSee(result.state,'caster','target')).toBe(true)
 expect(dnd5eActiveEmittedLight(target.classState.activeEffects)).toMatchObject({brightRadiusFeet:0,dimRadiusFeet:5,color:'#a3e635'})
 const restored=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(target.classState.activeEffects)))
 const remote=map('remote')
 remote.tokens=[{id:'target',type:'enemy',label:'Target',x:5,y:5,size:1,color:'#fff',emoji:'',hp:80,maxHp:100,dnd5eCombatState:{activeEffects:restored,sourcedExhaustion:target.classState.sourcedExhaustion}}]
 const ended=reconcileDnd5eAreaCaptivesAcrossMaps({maps:[map('source-map'),remote],characters:[],round:1})
 const effects=ended.maps[1].tokens[0].dnd5eCombatState?.activeEffects
 expect(effects?.map(effect=>effect.id)).toEqual(['invisibility'])
 expect(dnd5eActiveEmittedLight(effects)).toBeUndefined()
 expect(dnd5eAttackerIsUnseen({...target,classState:{...target.classState,activeEffects:effects}})).toBe(true)
})
it('applies no glow on a successful save but still applies it to an exhaustion-immune failed target',()=>{
 const before=state();before.combatants.target.conditionImmunities=['exhaustion']
 const success=resolveDnd5ePersistentAreaTrigger(before,{...request,trigger:glowingTrigger,d20:20})
 expect(dnd5eActiveEmittedLight(success.state.combatants.target.classState.activeEffects)).toBeUndefined()
 const failed=resolveDnd5ePersistentAreaTrigger(before,{...request,trigger:glowingTrigger,d20:2})
 expect(failed.state.combatants.target.exhaustionLevel).toBe(0)
 expect(dnd5eActiveEmittedLight(failed.state.combatants.target.classState.activeEffects)).toMatchObject({dimRadiusFeet:5})
})

it('applies damage and one area-bound level on failure only, keeping input immutable',()=>{
 const before=state(),copy=structuredClone(before)
 const failed=resolveDnd5ePersistentAreaTrigger(before,{...request,d20:2})
 expect(failed.ok).toBe(true)
 expect(failed.state.combatants.target).toMatchObject({currentHp:88,exhaustionLevel:1})
 expect(failed.state.combatants.target.classState.sourcedExhaustion?.sources[0]).toMatchObject({levels:1,areaLifetime:origin})
 const success=resolveDnd5ePersistentAreaTrigger(before,{...request,d20:20})
 expect(success.ok).toBe(true)
 expect(success.state.combatants.target).toMatchObject({currentHp:100,exhaustionLevel:0})
 expect(success.state.combatants.target.classState.sourcedExhaustion).toBeUndefined()
 expect(before).toEqual(copy)
})
it.each(['exhaustion','力竭'])('keeps damage when the target is immune to %s',condition=>{
 const before=state();before.combatants.target.conditionImmunities=[condition]
 const result=resolveDnd5ePersistentAreaTrigger(before,{...request,d20:2})
 expect(result.ok).toBe(true)
 expect(result.state.combatants.target).toMatchObject({currentHp:88,exhaustionLevel:0})
})
it('applies radiant resistance to damage without reducing the failed-save fatigue rider',()=>{
 const before=state();before.combatants.target.damageResistances=['radiant']
 const result=resolveDnd5ePersistentAreaTrigger(before,{...request,d20:2})
 expect(result.ok).toBe(true)
 expect(result.state.combatants.target).toMatchObject({currentHp:94,exhaustionLevel:1})
})
it('rejects a rider without a Host map origin before damage',()=>{
 const before=state()
 const result=resolveDnd5ePersistentAreaTrigger(before,{...request,areaMapId:undefined,d20:2})
 expect(result.ok).toBe(false)
 expect(result.state.combatants.target.currentHp).toBe(100)
})
it('accumulates repeated failed exposures but keeps another area independently removable',()=>{
 const first=resolveDnd5ePersistentAreaTrigger(state(),{...request,d20:2})
 const second=resolveDnd5ePersistentAreaTrigger(first.state,{...request,d20:2})
 expect(second.ok).toBe(true)
 expect(second.state.combatants.target.exhaustionLevel).toBe(2)
 expect(second.state.combatants.target.classState.sourcedExhaustion?.sources).toHaveLength(1)
 const other=resolveDnd5ePersistentAreaTrigger(second.state,{...request,areaId:'other',d20:2})
 expect(other.ok).toBe(true)
 expect(other.state.combatants.target.exhaustionLevel).toBe(3)
 expect(other.state.combatants.target.classState.sourcedExhaustion?.sources).toHaveLength(2)
})
it('validates the declaration and preserves it across snapshot normalization',()=>{
 expect(normalizeDnd5ePersistentAreaTriggerSnapshot(trigger)?.exhaustionOnFailedSave).toEqual(trigger.exhaustionOnFailedSave)
 for(const rider of [{levels:0,endsWithArea:true},{levels:7,endsWithArea:true},{levels:1,endsWithArea:false},{levels:1,endsWithArea:true,script:'x'}])
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot({...trigger,exhaustionOnFailedSave:rider})).toBeUndefined()
 expect(normalizeDnd5ePersistentAreaTriggerSnapshot({...trigger,savingThrow:undefined})).toBeUndefined()
})
it.each([false,true])('cleans an ended source on a remote target (mapless %s), retaining other fatigue',mapless=>{
 const ledger=addDnd5eAreaExhaustion(addDnd5eAreaExhaustion({schemaVersion:1,baseLevel:1,sources:[]},origin,2),{...origin,areaId:'other'},1)
 const hero=normalizeCharacter({id:'hero',name:'Hero',exhaustionLevel:4,dnd5eCombatState:{sourcedExhaustion:ledger}})
 const source=map('source-map')
 source.dnd5ePluginAreas=[{id:'other',sourceTokenId:'caster',sourceCharacterId:'',pluginId:'test',featureId:'test',label:'Other',color:'#ffffff',createdRound:1,expiresAfterRound:10,cells:[{col:1,row:1}]}]
 const remote=map('remote-map')
 if(!mapless)remote.tokens=[{id:'target',characterId:hero.id,type:'player',label:'Hero',x:5,y:5,size:1,color:'#ffffff',emoji:''}]
 const input={maps:[source,remote],characters:[hero],round:1},copy=structuredClone(input)
 const result=reconcileDnd5eAreaCaptivesAcrossMaps(input)
 expect(result.characters[0].exhaustionLevel).toBe(2)
 expect(result.characters[0].dnd5eCombatState?.sourcedExhaustion?.sources).toHaveLength(1)
 expect(result.characters[0].dnd5eCombatState?.sourcedExhaustion?.sources[0].areaLifetime?.areaId).toBe('other')
 expect(input).toEqual(copy)
 const again=reconcileDnd5eAreaCaptivesAcrossMaps({...input,maps:result.maps,characters:result.characters})
 expect(again.events).toEqual([])
})
it('preserves an unknown source map, but releases an explicitly deleted map after JSON reload',()=>{
 const ledger=addDnd5eAreaExhaustion({schemaVersion:1,baseLevel:2,sources:[]},origin,1)
 const hero=normalizeCharacter({id:'hero',dnd5eCombatState:{sourcedExhaustion:normalizeDnd5eSourcedExhaustion(JSON.parse(JSON.stringify(ledger)))}})
 expect(reconcileDnd5eAreaCaptivesAcrossMaps({maps:[],characters:[hero],round:1}).characters[0].exhaustionLevel).toBe(3)
 expect(reconcileDnd5eAreaCaptivesAcrossMaps({maps:[],characters:[hero],round:1,deletedMapIds:['source-map']}).characters[0].exhaustionLevel).toBe(2)
})
it('cleans a monster on a remote map and is idempotent after JSON reload',()=>{
 const source=map('source-map'),remote=map('remote-map')
 remote.tokens=[{id:'monster',type:'enemy',label:'Monster',x:5,y:5,size:1,color:'#ffffff',emoji:'',hp:20,maxHp:20,
  dnd5eCombatState:{sourcedExhaustion:addDnd5eAreaExhaustion({schemaVersion:1,baseLevel:1,sources:[]},origin,2)}}]
 const result=reconcileDnd5eAreaCaptivesAcrossMaps({maps:JSON.parse(JSON.stringify([source,remote])),characters:[],round:1})
 expect(result.maps[1].tokens[0].dnd5eCombatState?.sourcedExhaustion).toEqual({schemaVersion:1,baseLevel:1,sources:[]})
 expect(result.events).toContainEqual(expect.objectContaining({type:'exhaustion-adjusted',actorId:'monster',before:3,after:1}))
 expect(reconcileDnd5eAreaCaptivesAcrossMaps({...result,round:1}).events).toEqual([])
 expect(remote.tokens[0].dnd5eCombatState?.sourcedExhaustion?.sources).toHaveLength(1)
})
