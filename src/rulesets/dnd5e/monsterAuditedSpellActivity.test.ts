import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, endDnd5eConcentration } from './headlessCombatEngine'
import {dnd5eReactionsPrevented} from './passiveDefenses'
import { resolveDnd5eMonsterAuditedSpellEffects } from './monsterAuditedSpellActivity'
import { prepareDnd5eMonsterCoreSpell,resolvePreparedDnd5eMonsterCoreSpell } from './monsterCoreSpellAction'
import { dnd5eManualMonsterSpellOptions } from '../../lib/monsterManualSpell'
import type {BattleMap,Token} from '../../store/maps'
import {planDnd5eMonsterTurn} from './monsterTurnPlanner'
import {ensureDnd5eCoreSpellActivitiesRegisteredV1} from './activities/dnd5eCoreSpellActivities'
import {mapTokenGrantedActivityControls} from '../../components/map/playerMapPersistentAreas'
import {prepareDnd5ePluginFeatureAction,resolvePreparedDnd5ePluginFeatureAction} from './pluginFeatureAction'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'

function fixture() {
  const creatures = ['demon','failed','passed'].map((id,index) => createDnd5eCombatant({
    id,name:id,controller:'dm',initiative:20-index,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},
    proficiencyBonus:2,armorClass:12,currentHp:30,maxHp:30,temporaryHp:0,speed:30,concentrating:false,
    position:{x:index*50,y:0},
  }))
  creatures[0].statBlockId='srd-5.1:glabrezu'
  creatures[0].saveDc=8 // The stat block, not an inherited character DC, is authoritative.
  const state=startDnd5eHeadlessCombat('monster-activity-effects',creatures)
  state.combatants.demon.turn.actionAvailable=false // The enclosing transaction already paid.
  return state
}

it('can plan Confusion against a distant group when its single-target stun is spent',()=>{
  const demon:Token={id:'demon',label:'Demon',type:'enemy',poolId:'srd-5.1:glabrezu',x:75,y:75,size:2,hp:157,maxHp:157,color:'',emoji:'',
    dnd5eCombatState:{monsterSpellUsesBySpellId:{'power-word-stun':{current:0,max:1}}}}
  const targets:Token[]=['a','b','c'].map((id,index)=>({id,label:id,type:'player',poolId:'srd-5.1:bandit',x:625,y:75+index*50,size:1,hp:100,maxHp:100,color:'',emoji:''}))
  const map:BattleMap={id:'confusion-planner',name:'Test',width:1000,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[demon,...targets]}
  const plan=planDnd5eMonsterTurn(map,demon,[],{movementBudgetFeet:0})
  expect(plan.spellCast?.spellId,JSON.stringify(plan)).toBe('confusion')
  expect(plan.spellCast?.targetTokenIds.length).toBeGreaterThanOrEqual(2)
})

it('lets a lost-control demon cast at the nearest non-demon and rejects a farther spell target',()=>{
  const demon:Token={id:'demon',label:'Demon',type:'enemy',poolId:'srd-5.1:glabrezu',x:75,y:75,size:2,hp:157,maxHp:157,color:'',emoji:'',
    dnd5eSummon:{schemaVersion:1,pluginId:'test',featureId:'summon',sourceTokenId:'missing-owner',sourceCharacterId:'owner',
      createdRound:1,expiresAfterRound:600,side:'enemy',controlSave:{ability:'cha',dc:15},controlEnded:true,requiredCreatureSubtype:'demon'}}
  const targets:Token[]=['near','far'].map((id,index)=>({id,label:id,type:'player',poolId:'srd-5.1:bandit',x:325+index*100,y:75,size:1,hp:11,maxHp:11,color:'',emoji:''}))
  const map:BattleMap={id:'lost-control-spell',name:'Test',width:1000,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[demon,...targets]}
  map.tokens.push({id:'other-demon',label:'Other demon',type:'player',poolId:'srd-5.1:dretch',x:175,y:75,size:1,hp:18,maxHp:18,color:'',emoji:''})
  const plan=planDnd5eMonsterTurn(map,demon,[],{movementBudgetFeet:0})
  expect(plan.spellCast?.spellId,JSON.stringify(plan)).toBe('power-word-stun')
  expect(plan.spellCast?.targetTokenIds).toEqual(['near'])
  for(const targetId of ['near','far','other-demon']){
    const prepared=prepareDnd5eMonsterCoreSpell({combatId:'lost-control-spell',map,characters:[],
      initiativeOrder:map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,roll:20-i,color:'',emoji:''})),
      actorTokenId:'demon',targetTokenIds:[targetId],spellId:'power-word-stun',slotLevel:8})
    expect(prepared.ok,JSON.stringify(prepared)).toBe(true)
    if(!prepared.ok)throw Error('spell preparation failed')
    const cast=resolvePreparedDnd5eMonsterCoreSpell({prepared:prepared.prepared,resolution:{effectRolls:[]}})
    expect(cast.result.ok,JSON.stringify(cast.result)).toBe(targetId==='near')
    if(targetId!=='near'){
      expect(cast.result).toMatchObject({ok:false,reason:'invalid-target'})
      expect(cast.result.state.combatants.demon.turn.actionAvailable).toBe(true)
    }else{
      expect(cast.result.state.combatants.near.conditions).toContain('stunned')
      expect(cast.result.state.combatants.demon.classState.monsterSpellUsesBySpellId?.['power-word-stun'].current).toBe(0)
    }
  }
})

it('plans innate detection without requiring or consuming class slots',()=>{
  const state=fixture(), before=structuredClone(state)
  const planned=resolveDnd5eMonsterAuditedSpellEffects({state,actorId:'demon',spellId:'detect-magic',targetIds:['demon'],castLevel:1,rolls:{}})
  expect(planned?.resolution.ok).toBe(true)
  if(!planned?.resolution.ok)throw Error(JSON.stringify(planned))
  expect(planned.resolution.consumptions).toEqual([])
  expect(planned.resolution.proposals.length).toBeGreaterThan(0)
  expect(state).toEqual(before)
  expect(resolveDnd5eMonsterAuditedSpellEffects({state,actorId:'demon',spellId:'detect-magic',targetIds:['passed'],castLevel:1,rolls:{}})).toBeUndefined()
})

it('uses glabrezu DC16 with the existing Confusion effect and leaves state untouched',()=>{
  const state=fixture(),before=structuredClone(state)
  const planned=resolveDnd5eMonsterAuditedSpellEffects({state,actorId:'demon',spellId:'confusion',targetIds:['failed','passed'],castLevel:4,
    areaPlacement:{x:75,y:0,radiusFeet:10},areaPlacementDistanceFeet:10,
    checkRollModes:{'spell-save:failed':'normal','spell-save:passed':'normal'},
    rolls:{'spell-save-d20:failed':{values:[15]},'spell-save-d20:passed':{values:[16]}}})
  expect(planned?.resolution.ok,JSON.stringify(planned)).toBe(true)
  if(!planned?.resolution.ok)throw Error('planning failed')
  expect(planned.resolution.consumptions).toEqual([])
  expect(planned.resolution.proposals.filter(p=>p.kind==='apply-effect')).toEqual([
    expect.objectContaining({targetId:'failed',effectId:'confusion'}),
  ])
  expect(state).toEqual(before)
  state.combatants.demon.statBlockId='srd-5.1:dretch'
  expect(resolveDnd5eMonsterAuditedSpellEffects({state,actorId:'demon',spellId:'confusion',targetIds:[],castLevel:4,rolls:{}})).toBeUndefined()
})

it('casts innate Detect Magic through the real monster transaction and projects the effect',async()=>{
  ensureDnd5eCoreSpellActivitiesRegisteredV1()
  const demon:Token={id:'demon',label:'Demon',type:'enemy',poolId:'srd-5.1:glabrezu',x:75,y:75,size:2,hp:157,maxHp:157,color:'',emoji:''}
  const map:BattleMap={id:'innate-detection',name:'Test',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[demon]}
  expect(dnd5eManualMonsterSpellOptions(demon).find(s=>s.spellId==='detect-magic')?.automation).toBe('full')
  const prepared=prepareDnd5eMonsterCoreSpell({combatId:'innate-detection',map,characters:[],initiativeOrder:[{tokenId:'demon',label:'Demon',roll:20,color:'',emoji:''}],actorTokenId:'demon',targetTokenIds:['demon'],spellId:'detect-magic',slotLevel:1})
  expect(prepared.ok,JSON.stringify(prepared)).toBe(true)
  if(!prepared.ok)throw Error('prepare failed')
  const before=structuredClone(prepared.prepared.state)
  const cast=resolvePreparedDnd5eMonsterCoreSpell({prepared:prepared.prepared,resolution:{effectRolls:[]}})
  expect(cast.result.ok,JSON.stringify(cast.result)).toBe(true)
  expect(cast.result.state.combatants.demon.turn.actionAvailable).toBe(false)
  expect(cast.result.state.combatants.demon.classResources).toEqual(before.combatants.demon.classResources)
  expect(cast.result.state.combatants.demon.concentrating).toBe(true)
  expect(cast.result.state.combatants.demon.classState.activeEffects?.some(e=>e.grantedActivities?.includes('spell:detect-magic:reveal-auras'))).toBe(true)
  expect(cast.application?.map.tokens[0].dnd5eCombatState?.activeEffects?.length).toBeGreaterThan(0)
  expect(prepared.prepared.state).toEqual(before)
  const reloaded=JSON.parse(JSON.stringify(cast.application!.map)) as BattleMap
  const control=mapTokenGrantedActivityControls(reloaded.tokens[0],reloaded,[]).find(c=>c.activityId==='spell:detect-magic:reveal-auras')
  expect(control).toBeDefined()
  if(!control?.effectId)throw Error('missing detection action grant')
  const aura=prepareDnd5ePluginFeatureAction({map:reloaded,characters:[],roomRequiredPlugins:[],
    initiativeOrder:[{tokenId:'demon',label:'Demon',roll:20,color:'',emoji:''}],
    turnEconomy:createDnd5eTurnEconomyCounts('innate-detection:2:demon'),
    action:{id:'reveal',mapId:map.id,combatId:'innate-detection',sourceMode:'dm',status:'pending',type:'dnd5e-plugin-action',actorTokenId:'demon',characterId:'dm-token:demon',targetTokenId:'demon',round:2,initiativeIndex:0,seq:1,updatedAt:1,
      dnd5ePluginAction:{featureId:control.featureId,payload:{activeEffectId:control.effectId}}}})
  expect(aura.ok,JSON.stringify(aura)).toBe(true)
  if(!aura.ok)throw Error('aura prepare failed')
  const revealed=await resolvePreparedDnd5ePluginFeatureAction({prepared:aura.prepared})
  expect(revealed.result.ok,JSON.stringify(revealed.result)).toBe(true)
  expect(revealed.result.state.combatants.demon.turn.actionAvailable).toBe(false)
  expect(revealed.result.events).toContainEqual(expect.objectContaining({type:'spell-detection-updated',actorId:'demon',revealAuras:true}))
})

it('settles innate Confusion once with DC16, one daily use and only failed targets affected',()=>{
  const demon:Token={id:'demon',label:'Demon',type:'enemy',poolId:'srd-5.1:glabrezu',x:75,y:75,size:2,hp:157,maxHp:157,color:'',emoji:''}
  const targets:Token[]=['failed','passed'].map((id,index)=>({id,label:id,type:'enemy',poolId:'srd-5.1:bandit',x:325+index*50,y:75,size:1,hp:11,maxHp:11,color:'',emoji:''}))
  const map:BattleMap={id:'innate-confusion',name:'Test',width:700,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[demon,...targets]}
  const input={combatId:'innate-confusion',map,characters:[],initiativeOrder:map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,roll:20-i,color:'',emoji:''})),actorTokenId:'demon',targetTokenIds:['failed','passed'],areaTargetCell:{col:6,row:1},spellId:'confusion',slotLevel:4}
  const prepared=prepareDnd5eMonsterCoreSpell(input)
  expect(prepared.ok,JSON.stringify(prepared)).toBe(true)
  if(!prepared.ok)throw Error('prepare failed')
  const before=structuredClone(prepared.prepared.state)
  const rejected=resolvePreparedDnd5eMonsterCoreSpell({prepared:prepared.prepared,resolution:{effectRolls:[]}})
  expect(rejected.result.ok).toBe(false)
  expect(prepared.prepared.state).toEqual(before)
  const cast=resolvePreparedDnd5eMonsterCoreSpell({prepared:prepared.prepared,resolution:{effectRolls:[],targetSavingThrows:[{targetId:'failed',d20:15},{targetId:'passed',d20:16}]}})
  expect(cast.result.ok,JSON.stringify(cast.result)).toBe(true)
  expect(cast.result.state.combatants.demon.turn.actionAvailable).toBe(false)
  expect(cast.result.state.combatants.demon.classState.monsterSpellUsesBySpellId?.confusion.current).toBe(0)
  expect(cast.result.state.combatants.failed.classState.activeEffects?.some(e=>e.definitionId.includes('confusion'))).toBe(true)
  expect(cast.result.state.combatants.passed.classState.activeEffects??[]).toHaveLength(0)
  expect(cast.result.events.filter(e=>e.type==='saving-throw-resolved')).toHaveLength(2)
  expect(cast.result.events.filter(e=>e.type==='saving-throw-resolved')).toEqual(expect.arrayContaining([
    expect.objectContaining({targetId:'failed',dc:16,success:false}),expect.objectContaining({targetId:'passed',dc:16,success:true}),
  ]))
  expect(cast.result.state.combatants.demon.concentrating).toBe(true)
  expect(prepareDnd5eMonsterCoreSpell({...input,map:JSON.parse(JSON.stringify(cast.application!.map))})).toMatchObject({ok:false,reason:'resource-unavailable'})
  const reloaded=JSON.parse(JSON.stringify(cast.result.state)) as typeof cast.result.state
  const started=Array.from({length:64},(_,index)=>{
    const state=structuredClone(reloaded);state.combatId='innate-confusion-lifecycle-'+index
    return resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:'demon'})
  })
  const paused=started.find(result=>result.ok&&result.events.some(e=>e.type==='confused-turn-behavior-resolved'&&e.mode==='no-movement-or-action'))
  expect(paused?.ok).toBe(true)
  if(!paused?.ok)throw Error('missing confused turn')
  expect(paused.state.combatants.failed.turn.actionAvailable).toBe(false)
  expect(paused.state.combatants.failed.turn.movementRemaining).toBe(0)
  expect(dnd5eReactionsPrevented(paused.state.combatants.failed)).toBe(true)
  const effect=paused.state.combatants.failed.classState.activeEffects!.find(e=>e.definitionId.includes('confusion'))!
  expect(effect.repeatSave).toMatchObject({ability:'wis',dc:16,timing:'target-turn-end',onSuccess:'remove'})
  expect(resolveDnd5eHeadlessAction(paused.state,{type:'end-turn',actorId:'failed'}).ok).toBe(false)
  for(const d20 of [15,16]){
    const ended=resolveDnd5eHeadlessAction(paused.state,{type:'end-turn',actorId:'failed',activeEffectSavingThrows:[{effectId:effect.id,d20}]})
    expect(ended.ok,JSON.stringify(ended)).toBe(true)
    expect(ended.state.combatants.failed.classState.activeEffects?.some(e=>e.id===effect.id)??false).toBe(d20===15)
  }
  const interrupted=structuredClone(reloaded)
  endDnd5eConcentration(interrupted,interrupted.combatants.demon,[])
  expect(interrupted.combatants.failed.classState.activeEffects?.some(e=>e.definitionId.includes('confusion'))??false).toBe(false)
  expect(prepared.prepared.state).toEqual(before)
})
