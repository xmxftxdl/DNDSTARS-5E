import { replayDnd5eHitFollowContinuation } from './weaponHitFollowReplay'
import { describe, expect, it, vi } from 'vitest'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { DND5E_FIGHTER_STARTING_EQUIPMENT, DND5E_QUARTERSTAFF } from './equipment'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import {
  findDnd5eOpportunityAttackersForMove,
  findDnd5eOpportunityWindowsForMove,
  dnd5eOpportunityAttackClassDamageDefinitions,
  prepareDnd5eOpportunityAttack,
  previewDnd5eOpportunityAttack,
  resolvePreparedDnd5eOpportunityAttack,
} from './opportunityAttackAction'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { migrateCharacterToDnd5e } from './character'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'
import {prepareDnd5eHitFollowOpportunity,replayDnd5eHitFollowOpportunity} from './weaponHitFollowOpportunity'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import {createDnd5eHitFollowMovementSession} from './weaponHitFollowMovementSession'
import {withDnd5eHitFollowCheckpoints,visitDnd5eHitFollowCheckpoint} from './weaponHitFollowCheckpoint'
import {collectDnd5eHitFollowContinuation} from './weaponHitFollowCollector'

function hero(): Character {
  return {
    id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '人类', charClass: '战士', level: 3,
    background: '', experience: 0, reputation: 0, rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '3d10', ac: 16, speed: 30, initiativeBonus: 1,
    saveDC: 0, passivePerception: 10, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

function fixture() {
  const character = hero()
  const map: BattleMap = {
    id: 'map', name: '地图', width: 200, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0,
    showGrid: true, feetPerCell: 5,
    tokens: [
      { id: 'kobold', label: '狗头人', poolId: 'srd-5.1:kobold', x: 5, y: 5, color: '', emoji: '', size: 1, type: 'enemy', hp: 5, maxHp: 5 },
      { id: 'hero-token', label: '英雄', characterId: 'hero', x: 15, y: 5, color: '', emoji: '', size: 1, type: 'player', hp: 30, maxHp: 30 },
    ],
  }
  const initiativeOrder = [
    { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
    { tokenId: 'kobold', label: '狗头人', emoji: '', color: '', roll: 10 },
  ]
  return { character, map, initiativeOrder }
}

describe('D&D 5e opportunity attack bridge', () => {
  it('reaches the within-reach window before collecting a movement reaction and stops there on hit', async () => {
    let featureId=''
    const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.hold-follow',name:'Hold',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},
      setup(api){featureId=api.registerFeature({id:'hold',name:'Hold',summary:'Test',description:'Test',automation:'full',
        staticModifiers:{opportunityAttacksOnMoveWithinReach:true,opportunityAttackHitStopsMovement:true}})}})
    try {
      const {map,character,initiativeOrder}=fixture()
      const guard:Character={...hero(),id:'guard',equipment:DND5E_FIGHTER_STARTING_EQUIPMENT,dnd5ePluginFeatureIds:[featureId]}
      map.tokens[0]={...map.tokens[0],poolId:undefined,characterId:'guard',x:25,y:15,hp:30,maxHp:30}
      map.tokens.push({...map.tokens[0],id:'follow-target',characterId:undefined,poolId:'srd-5.1:kobold',x:75})
      initiativeOrder.push({tokenId:'follow-target',label:'Target',emoji:'',color:'',roll:1})
      const characters=[character,guard]
      const {state}=createDnd5eMapCombatSnapshot({map,characters,initiativeOrder,combatId:'hold-follow'})
      const original=structuredClone(state)
      let choices=0
      const result=await collectDnd5eHitFollowContinuation({state,map,characters,actorId:'hero-token',targetId:'follow-target',cell:{col:6,row:0},isCurrent:()=>true,
        chooseOpportunity:async({prepared})=>{
          choices++
          expect(prepared.state.combatants['hero-token'].position).toMatchObject({x:25,y:5})
          return {declined:false,rolls:{d20:18,d20Second:18,damageRolls:Array(prepared.damage.count).fill(1)}}
        },rollSegment:async()=>undefined,
      })
      expect(choices).toBe(1)
      expect(result.result.state.combatants['hero-token'].position).toMatchObject({x:25,y:5})
      expect(result.result.state.combatants['hero-token'].classState.movementStoppedTurnKey).toBeTruthy()
      expect(result.result.state.combatants.kobold.turn.reactionAvailable).toBe(false)
      expect(state).toEqual(original)
    } finally {dispose()}
  })
  it('finds a five-foot movement window inside reach, including subdivided paths', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id:'test.within-reach',name:'Within reach',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0' },
      setup(api) { featureId = api.registerFeature({id:'hold',name:'Hold',summary:'Test',description:'Test',automation:'full',
        staticModifiers:{opportunityAttacksOnMoveWithinReach:true,opportunityAttackHitStopsMovement:true}}) },
    })
    try {
      const {map,character} = fixture()
      const trained = {...character,equipment:DND5E_FIGHTER_STARTING_EQUIPMENT,dnd5ePluginFeatureIds:[featureId]}
      const input = {map,characters:[trained],movingToken:map.tokens[0],to:{x:5,y:15},turnEconomyByToken:{}}
      expect(findDnd5eOpportunityWindowsForMove({...input,movementMode:'fall'})).toEqual([])
      expect(findDnd5eOpportunityWindowsForMove({...input,movementMode:'fall',to:{x:5,y:45}})).toEqual([])
      for (const movementMode of ['walk', 'swim', 'climb', 'fly'] as const) {
        expect(findDnd5eOpportunityWindowsForMove({...input,movementMode,to:{x:5,y:45}})).toEqual([
          expect.objectContaining({trigger:'move-within-reach',position:{x:5,y:15,elevationFeet:0}}),
        ])
      }
      for (const path of [[{x:5,y:15}], [{x:5,y:9},{x:5,y:11},{x:5,y:15}], [{x:5,y:15},{x:15,y:15}]]) {
        expect(findDnd5eOpportunityWindowsForMove({...input,path})).toEqual([
          expect.objectContaining({trigger:'move-within-reach',position:{x:5,y:15,elevationFeet:0}}),
        ])
      }
      expect(findDnd5eOpportunityWindowsForMove({...input,to:{x:5,y:9}})).toEqual([])
      // The first five feet in reach must interrupt before a long move leaves it.
      expect(findDnd5eOpportunityWindowsForMove({...input,to:{x:5,y:45}})).toEqual([
        expect.objectContaining({trigger:'move-within-reach',pathSegmentIndex:0,position:{x:5,y:15,elevationFeet:0}}),
      ])
      const crossing={...map,tokens:[{...map.tokens[0],x:55}, {...map.tokens[1],x:25}]}
      expect(findDnd5eOpportunityWindowsForMove({...input,map:crossing,movingToken:crossing.tokens[0],to:{x:5,y:5}})).toEqual([
        expect.objectContaining({trigger:'move-within-reach',pathSegmentIndex:0,position:{x:25,y:5,elevationFeet:0}}),
      ])
      const farGuard={...trained,id:'far-guard'}
      const multi={...map,tokens:[
        {...map.tokens[1],id:'far-guard-token',characterId:'far-guard',x:55,y:15},
        {...map.tokens[1],x:25,y:15},
        {...map.tokens[0],x:15},
      ]}
      const ordered=findDnd5eOpportunityWindowsForMove({...input,map:multi,characters:[trained,farGuard],movingToken:multi.tokens[2],to:{x:85,y:5}})
      expect(ordered.map(window=>window.attacker.id)).toEqual(['hero-token','far-guard-token'])
      expect(ordered.map(window=>window.position.x)).toEqual([25,55])
      expect(findDnd5eOpportunityWindowsForMove({...input,disengaged:true})).toEqual([])
      expect(findDnd5eOpportunityWindowsForMove({...input,characters:[character]})).toEqual([])
      const spent=createDnd5eTurnEconomyCounts('turn',30);spent.reaction.current=0
      expect(findDnd5eOpportunityWindowsForMove({...input,turnEconomyByToken:{'hero-token':spent}})).toEqual([])
    } finally {dispose()}
  })
  it.each(['decline','hit','stale-choice','stale-segment'] as const)('collects follow receipts without publishing while awaiting UI: %s',async mode=>{
    const {map,character,initiativeOrder}=fixture()
    map.tokens.push({...map.tokens[0],id:'follow-target',x:75})
    initiativeOrder.push({tokenId:'follow-target',label:'Target',emoji:'',color:'',roll:1})
    const {state}=createDnd5eMapCombatSnapshot({map,characters:[character],initiativeOrder,combatId:'follow-collect'})
    const before=structuredClone(state)
    let current=true,choices=0,segments=0
    const result=collectDnd5eHitFollowContinuation({state,map,characters:[character],actorId:'hero-token',targetId:'follow-target',cell:{col:6,row:0},isCurrent:()=>current,
      chooseOpportunity:async({prepared})=>{
        choices++;expect(state).toEqual(before)
        expect(prepared.state.combatants['hero-token'].turn.reactionAvailable).toBe(false)
        if(mode==='stale-choice')current=false
        return mode==='decline'?{declined:true}:{declined:false,rolls:{d20:18,d20Second:18,damageRolls:Array(prepared.damage.count).fill(1)}}
      },rollSegment:async()=>{segments++;expect(state).toEqual(before);if(mode==='stale-segment')current=false;return undefined},
    })
    if(mode.startsWith('stale-'))await expect(result).rejects.toThrow('weapon-hit-follow-stale-authority')
    else{
      const collected=await result
      expect(collected.opportunities).toHaveLength(1)
      expect(collected.result.state.combatants['hero-token'].position).toMatchObject({x:65,y:5})
      expect(collected.result.state.combatants.kobold.turn.reactionAvailable).toBe(mode==='decline')
      expect(collected.result.state.combatants['hero-token'].currentHp).toBe(mode==='decline'?30:27)
    }
    expect(choices).toBe(1)
    expect(segments).toBe(mode==='stale-choice'?0:mode==='stale-segment'?1:5)
    expect(state).toEqual(before)
  })
  it('settles leaving reach before entering reach along the same path segment',()=>{
    let featureId=''
    const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.follow-enter',name:'Enter',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
      featureId=api.registerFeature({id:'enter',name:'Enter',summary:'Synthetic',description:'Synthetic',automation:'full',staticModifiers:{opportunityAttacksOnEnterReachWeaponIds:[DND5E_QUARTERSTAFF.id]}})
    }})
    try{
      const {map,character,initiativeOrder}=fixture()
      const guard:Character={...hero(),id:'guard-character',equipment:{mainWeapon:DND5E_QUARTERSTAFF},dnd5ePluginFeatureIds:[featureId]}
      map.tokens.unshift({...map.tokens[1],id:'enter-guard',characterId:guard.id,type:'enemy',x:35,y:15})
      map.tokens.push({...map.tokens[1],id:'follow-target',x:75,y:5})
      initiativeOrder.push({tokenId:'enter-guard',label:'Guard',emoji:'',color:'',roll:5},{tokenId:'follow-target',label:'Target',emoji:'',color:'',roll:1})
      const characters=[character,guard]
      const {state}=createDnd5eMapCombatSnapshot({map,characters,initiativeOrder,combatId:'follow-enter'})
      const session=createDnd5eHitFollowMovementSession({state,map,characters,actorId:'hero-token',targetId:'follow-target',cell:{col:6,row:0}})
      expect(session.ok).toBe(true);if(!session.ok)throw Error(session.reason)
      const windows=session.snapshot().opportunities
      expect(windows.map(window=>[window.attacker.id,window.pathSegmentIndex,window.trigger])).toEqual([
        ['kobold',0,'leave-reach'],['enter-guard',0,'enter-reach'],
      ])
      expect(session.settleOpportunity({attackerId:'kobold',window:windows[0],declined:true}).ok).toBe(true)
      expect(session.advance(1).ok).toBe(true)
      expect(session.settleOpportunity({attackerId:'enter-guard',window:windows[1],declined:true}).ok).toBe(true)
      expect(session.advance(session.path.length-1).ok).toBe(true)
    }finally{dispose()}
  })
  it.each(['decline','hit','stop','knockout','mid-hit','mid-stop','mandatory'] as const)('settles an opportunity inside staged follow movement: %s',mode=>{
    const clock=vi.spyOn(Date,'now').mockReturnValue(1700000000000)
    try{
    const {map,character,initiativeOrder}=fixture()
    if(mode.startsWith('mid-')){map.tokens[0].x=25;map.tokens[0].y=15}
    if(mode==='mandatory')map.tokens[0].dnd5eCombatState={activeEffects:[createDnd5eMechanicalEffect({definitionId:'test:mandatory-follow',label:'Mandatory',targetId:'kobold',source:{kind:'spell'},modifiers:{mandatoryOpportunityAttacks:true}})]}
    map.tokens.push({...map.tokens[0],id:'follow-target',x:75})
    initiativeOrder.push({tokenId:'follow-target',label:'Target',emoji:'',color:'',roll:1})
    const {state}=createDnd5eMapCombatSnapshot({map,characters:[character],initiativeOrder,combatId:'follow-staged'})
    const mover=state.combatants['hero-token']
    mover.currentHp=mode==='knockout'?1:21
    mover.turn.movementRemaining=0;mover.turn.movementSpent=30
    state.combatants.kobold.opportunityAttackHitStopsMovement=mode.endsWith('stop')
    const before=structuredClone(state)
    const session=createDnd5eHitFollowMovementSession({state,map,characters:[character],actorId:'hero-token',targetId:'follow-target',cell:{col:6,row:0}})
    expect(session.ok).toBe(true);if(!session.ok)throw Error(session.reason)
    const window=session.snapshot().opportunities.find(candidate=>candidate.attacker.id==='kobold')!
    expect(window).toBeDefined()
    expect(session.advance(session.path.length-1)).toEqual({ok:false,reason:'follow-opportunity-settlement-required'})
    const receipt=mode==='decline'?{attackerId:'kobold',window,declined:true as const}:
      {attackerId:'kobold',window,declined:false as const,kind:'weapon' as const,rolls:{d20:18,d20Second:18,damageRolls:[1]}}
    if(mode==='mandatory')expect(session.settleOpportunity({...receipt,declined:true})).toEqual({ok:false,reason:'follow-opportunity-mandatory'})
    if(mode.startsWith('mid-')){
      expect(session.settleOpportunity(receipt)).toEqual({ok:false,reason:'follow-opportunity-position-not-reached'})
      const advanced=session.advance(window.pathSegmentIndex)
      expect(advanced.ok,JSON.stringify(advanced)).toBe(true)
      expect(session.snapshot().state.combatants['hero-token'].position).toMatchObject({x:35,y:5})
    }
    const settled=session.settleOpportunity(receipt)
    expect(settled.ok,JSON.stringify(settled)).toBe(true);if(!settled.ok)throw Error(settled.reason)
    expect(settled.state.combatants.kobold.turn.reactionAvailable).toBe(mode==='decline')
    expect(settled.state.combatants['hero-token'].turn.reactionAvailable).toBe(false)
    expect(session.settleOpportunity(receipt)).toEqual({ok:false,reason:'follow-opportunity-not-found'})
    const afterSettlement=session.snapshot()
    expect(afterSettlement.state).toEqual(settled.state)
    expect(afterSettlement.events).toEqual(settled.events)
    const moved=session.advance(session.path.length-1)
    if(mode.endsWith('stop')||mode==='knockout'){
      expect(moved.ok).toBe(false)
      expect(session.snapshot().state.combatants['hero-token'].position).toMatchObject({x:window.position.x,y:window.position.y})
      expect(session.snapshot().state.combatants['hero-token'].currentHp).toBeLessThan(before.combatants['hero-token'].currentHp)
    }else{
      expect(moved.ok,JSON.stringify(moved)).toBe(true);if(!moved.ok)throw Error(moved.reason)
      expect(moved.state.combatants['hero-token'].position).toMatchObject({x:65,y:5})
      expect(moved.state.combatants['hero-token'].turn).toMatchObject({movementRemaining:0,movementSpent:30})
    }
    expect(session.snapshot().events.filter(event=>event.type==='turn-resource-spent'&&event.actorId==='hero-token'&&event.resource==='reaction')).toHaveLength(1)
    const replayed=withDnd5eHitFollowCheckpoints(()=>({declined:false,map,characters:[character],cell:{col:6,row:0},opportunities:[receipt]}),
      ()=>visitDnd5eHitFollowCheckpoint({packageId:'test.follow',activityId:'follow',actorId:'hero-token',targetId:'follow-target',targetRadiusFeet:5},state))
    expect(replayed?.ok).toBe(true)
    expect(replayed?.state.combatants).toEqual(session.snapshot().state.combatants)
    expect(replayed?.events).toEqual(session.snapshot().events)
    expect(()=>withDnd5eHitFollowCheckpoints(()=>({declined:false,map,characters:[character],cell:{col:6,row:0},opportunities:[]}),
      ()=>visitDnd5eHitFollowCheckpoint({packageId:'test.follow',activityId:'follow',actorId:'hero-token',targetId:'follow-target',targetRadiusFeet:5},state))).toThrow('weapon-hit-follow-opportunities-required')
    expect(state).toEqual(before)
    }finally{clock.mockRestore()}
  })
  it('prepares a follow opportunity using current transaction HP and resources without publishing its trigger position',()=>{
    const {map,character,initiativeOrder}=fixture()
    map.tokens.push({...map.tokens[0],id:'follow-target',x:75})
    initiativeOrder.push({tokenId:'follow-target',label:'Target',emoji:'',color:'',roll:1})
    const snapshot=createDnd5eMapCombatSnapshot({map,characters:[character],initiativeOrder,combatId:'follow-opportunity'})
    snapshot.state.combatants['hero-token'].currentHp=21
    snapshot.state.combatants['hero-token'].classResources.test={current:1,max:2}
    const before=structuredClone(snapshot.state)
    const input={state:snapshot.state,map,characters:[character],actorId:'hero-token',targetId:'follow-target',attackerId:'kobold',cell:{col:6,row:0}}
    const prepared=prepareDnd5eHitFollowOpportunity(input)
    expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
    expect(prepared.prepared.state.combatants['hero-token']).toMatchObject({currentHp:21,position:{x:15,y:5},classResources:{test:{current:1,max:2}},turn:{reactionAvailable:false}})
    expect(prepared.prepared.state.combatants.kobold.turn.reactionAvailable).toBe(true)
    const receipt={attackerId:'kobold',window:{pathSegmentIndex:prepared.window.pathSegmentIndex,position:prepared.window.position,trigger:prepared.window.trigger},
      rolls:{d20:18,d20Second:18,damageRolls:Array(prepared.prepared.damage.count).fill(1)}}
    const replayed=replayDnd5eHitFollowOpportunity({...input,receipt})
    expect(replayed.ok,JSON.stringify(replayed)).toBe(true)
    if(!replayed.ok)throw Error(replayed.reason)
    expect(replayed.result.state.combatants['hero-token'].currentHp).toBe(21-prepared.prepared.damage.count-prepared.prepared.damage.bonus)
    expect(replayed.result.state.combatants.kobold.turn.reactionAvailable).toBe(false)
    const injected={...receipt,rolls:{...receipt.rolls,prepared:{...prepared.prepared,attackModifier:999,damage:{...prepared.prepared.damage,bonus:999}}}}
    const replayedInjection=replayDnd5eHitFollowOpportunity({...input,receipt:injected})
    expect(replayedInjection.ok).toBe(true)
    if(!replayedInjection.ok)throw Error(replayedInjection.reason)
    expect(replayedInjection.result.state.combatants).toEqual(replayed.result.state.combatants)
    expect(replayedInjection.result.events).toEqual(replayed.result.events)
    for(const window of [{...receipt.window,pathSegmentIndex:99},{...receipt.window,position:{...receipt.window.position,x:999}},
      {...receipt.window,position:{...receipt.window.position,elevationFeet:5}},{...receipt.window,trigger:'enter-reach' as const}]){
      expect(replayDnd5eHitFollowOpportunity({...input,receipt:{...receipt,window}})).toEqual({ok:false,reason:'follow-opportunity-window-changed'})
    }
    expect(replayDnd5eHitFollowOpportunity({...input,receipt:{...receipt,rolls:{...receipt.rolls,d20:21}}}).ok).toBe(false)
    const attacked=resolvePreparedDnd5eOpportunityAttack({prepared:prepared.prepared,d20:18,d20Second:18,damageRolls:Array(prepared.prepared.damage.count).fill(1)})
    expect(attacked.result.ok,JSON.stringify(attacked.result)).toBe(true)
    expect(attacked.result.state.combatants['hero-token'].currentHp).toBe(21-prepared.prepared.damage.count-prepared.prepared.damage.bonus)
    expect(attacked.result.state.combatants['hero-token'].classResources.test.current).toBe(1)
    expect(attacked.result.state.combatants.kobold.turn.reactionAvailable).toBe(false)
    expect(snapshot.state).toEqual(before)
    snapshot.state.combatants.kobold.turn.reactionAvailable=false
    expect(prepareDnd5eHitFollowOpportunity(input)).toMatchObject({ok:false,reason:'follow-opportunity-not-found'})
    expect(replayDnd5eHitFollowOpportunity({...input,receipt})).toMatchObject({ok:false,reason:'follow-opportunity-not-found'})
  })
  it('reports the last in-reach path position for a staged follow without moving the map',()=>{
    const {map,character}=fixture(),before=structuredClone(map)
    const moving=map.tokens[1]
    const input={map,characters:[character],movingToken:moving,to:{x:45,y:5},path:[{x:15,y:5},{x:25,y:5},{x:35,y:5},{x:45,y:5}],turnEconomyByToken:{}}
    const windows=findDnd5eOpportunityWindowsForMove(input)
    expect(windows).toEqual([{attacker:map.tokens[0],pathSegmentIndex:0,position:{x:15,y:5,elevationFeet:0},trigger:'leave-reach'}])
    expect(findDnd5eOpportunityAttackersForMove(input)).toEqual(windows.map(window=>window.attacker))
    const alongPath={...map,tokens:map.tokens.map(token=>token.id==='kobold'?{...token,x:25,y:15}:token)}
    expect(findDnd5eOpportunityWindowsForMove({...input,map:alongPath})).toEqual([
      {attacker:alongPath.tokens[0],pathSegmentIndex:2,position:{x:35,y:5,elevationFeet:0},trigger:'leave-reach'},
    ])
    expect(map).toEqual(before)
    expect(findDnd5eOpportunityWindowsForMove({...input,disengaged:true})).toEqual([])
    const spent=createDnd5eTurnEconomyCounts('turn',30);spent.reaction.current=0
    expect(findDnd5eOpportunityWindowsForMove({...input,turnEconomyByToken:{kobold:spent}})).toEqual([])
  })
  it('allows a qualified zero-HP raging actor or target without opening ordinary defeated actors', () => {
    let featureId=''
    const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.zero-opportunity',name:'Opportunity',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
      featureId=api.registerFeature({id:'defer',name:'Defer',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{schemaVersion:1,id:'defer',name:'Defer',description:'Synthetic',level:1,trigger:{kind:'passive'},cost:{economy:'none'},targeting:{kind:'self'},effects:[],mechanic:{kind:'rage-death-deferral'},automation:'full'}})
    }})
    try {for(const mode of ['active','not-raging','unowned','dead'] as const)for(const role of ['actor','target'] as const){
      const {character,map,initiativeOrder}=fixture()
      character.currentHp=0
      character.equipment={...DND5E_FIGHTER_STARTING_EQUIPMENT}
      character.dnd5ePluginFeatureIds=mode==='unowned'?[]:[featureId]
      character.dnd5eCombatState={raging:mode!=='not-raging',rageTurnsRemaining:5,...(mode==='dead'?{deathRound:1}:{})}
      const result=prepareDnd5eOpportunityAttack({combatId:'zero-opportunity',map,characters:[character],initiativeOrder,
        actorTokenId:role==='actor'?'hero-token':'kobold',targetTokenId:role==='actor'?'kobold':'hero-token',turnEconomy:createDnd5eTurnEconomyCounts('turn',30)})
      expect(result.ok,`${mode}/${role}: ${JSON.stringify(result.ok?null:result)}`).toBe(mode==='active')
    }}finally{dispose()}
  })
  it.each(['active', 'suspended', 'removed', 'no-reaction', 'blinded', 'incapacitated'] as const)('mandatory attacks retain ordinary legality: %s', mode => {
    const { character, map, initiativeOrder } = fixture()
    const effect = createDnd5eMechanicalEffect({ definitionId: 'test:mandatory', label: 'Mandatory', targetId: 'kobold',
      source: { kind: 'spell', actorId: 'hero-token' }, modifiers: { mandatoryOpportunityAttacks: true },
      suspendedBy: mode === 'suspended' ? ['test-antimagic'] : undefined })
    map.tokens[0].dnd5eCombatState = { schemaVersion: 2, activeEffects: mode === 'removed' ? [] : [effect] }
    if (mode === 'blinded' || mode === 'incapacitated') map.tokens[0].dnd5eCombatState.activeEffects!.push(createDnd5eConditionEffect({
      condition: mode, targetId: 'kobold', source: { kind: 'dm' }, appliedAt: 1,
    }))
    const economy = createDnd5eTurnEconomyCounts('kobold-turn', 30)
    if (mode === 'no-reaction') economy.reaction.current = 0
    const result = prepareDnd5eOpportunityAttack({ combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token', turnEconomy: economy })
    expect(result.ok).toBe(!['no-reaction','blinded','incapacitated'].includes(mode))
    if (result.ok) expect(result.prepared.mandatory).toBe(mode === 'active')
  })

  it('treats a visible ally as an opportunity target only while subjective hostility is active', () => {
    const { character, map, initiativeOrder } = fixture()
    map.tokens[1].dnd5eSide = 'enemy'
    const effect = createDnd5eMechanicalEffect({ definitionId: 'test:hostile-perception', label: 'Hostile perception',
      targetId: 'kobold', source: { kind: 'spell', actorId: 'hero-token' },
      modifiers: { perceiveVisibleCreaturesAsHostile: true, mandatoryOpportunityAttacks: true } })
    map.tokens[0].dnd5eCombatState = { schemaVersion: 2, activeEffects: [effect] }
    const saved = JSON.parse(JSON.stringify(map)) as BattleMap
    const find = (disengaged = false) => findDnd5eOpportunityAttackersForMove({ map: saved, characters: [character],
      movingToken: saved.tokens[1], to: { x: 45, y: 5 }, turnEconomyByToken: {}, disengaged }).map(t => t.id)
    expect(find()).toEqual(['kobold'])
    expect(find(true)).toEqual([])
    const prepare = () => prepareDnd5eOpportunityAttack({ combatId: 'combat', map: saved, characters: [character], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token', turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30) })
    const ready = prepare()
    expect(ready.ok).toBe(true)
    if (!ready.ok) throw Error(ready.reason)
    expect(ready.prepared.mandatory).toBe(true)
    const resolved = resolvePreparedDnd5eOpportunityAttack({ prepared: ready.prepared, d20: 19, damageRolls: [3] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.state.combatants['hero-token'].currentHp).toBeLessThan(30)
    expect(resolved.result.state.combatants.kobold.turn.reactionAvailable).toBe(false)
    expect(saved.tokens[1].dnd5eSide).toBe('enemy')
    saved.tokens[0].dnd5eCombatState!.activeEffects![0].suspendedBy = ['test-antimagic']
    expect(find()).toEqual([])
    expect(prepare()).toEqual({ ok: false, reason: 'invalid-actor' })
    saved.tokens[0].dnd5eCombatState!.activeEffects = []
    expect(find()).toEqual([])
  })

  it('uses exported character capability effects for target-specific movement protection', async () => {
    const namespace = 'test.melee-protection'
    const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
      manifest: { id: namespace, name: 'Protection', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
      definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'footwork', name: 'Footwork',
        automation: automationCapabilityFromLegacyStatus('full'),
        payload: { id: 'footwork', name: 'Footwork', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
        effects: [{ schemaVersion: 1, id: 'passive', name: 'Protection', duration: { kind: 'permanent' }, stacking: 'unique-by-source',
          modifiers: [{ kind: 'character-capability', capability: 'preventOpportunityAttacksFromMeleeAttackTargets', value: true }] }],
      }] }
    const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      const { character, map, initiativeOrder } = fixture()
      const protectedCharacter: Character = JSON.parse(JSON.stringify({ ...character,
        dnd5ePluginFeatureIds: [`${namespace}:footwork`], dnd5eCombatState: { meleeAttackTargetIdsThisTurn: ['kobold'] } }))
      expect(migrateCharacterToDnd5e(protectedCharacter).preventOpportunityAttacksFromMeleeAttackTargets).toBe(true)
      const find = (mover: Character) => findDnd5eOpportunityAttackersForMove({ map, characters: [mover],
        movingToken: map.tokens[1], to: { x: 45, y: 5 }, turnEconomyByToken: {} }).map(t => t.id)
      expect(find(protectedCharacter)).toEqual([])
      expect(prepareDnd5eOpportunityAttack({ combatId: 'combat', map, characters: [protectedCharacter], initiativeOrder,
        actorTokenId: 'kobold', targetTokenId: 'hero-token', turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30) }))
        .toEqual({ ok: false, reason: 'invalid-target' })
      expect(find({ ...protectedCharacter, dnd5eCombatState: { meleeAttackTargetIdsThisTurn: ['different'] } })).toEqual(['kobold'])
      expect(find({ ...protectedCharacter, dnd5eCombatState: {} })).toEqual(['kobold'])
      expect(find({ ...protectedCharacter, dnd5ePluginFeatureIds: [] })).toEqual(['kobold'])
    } finally { dispose() }
  })
  it('suppresses movement reactions while protection is effective and restores them after suppression or removal', () => {
    const { character, map, initiativeOrder } = fixture()
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'test:movement-protection', label: 'Movement protection',
      source: { kind: 'spell', actorId: 'hero-token', pluginId: 'test.movement' },
      targetId: 'hero-token', modifiers: { preventMovementOpportunityAttacks: true },
    })
    character.dnd5eCombatState = { schemaVersion: 2, activeEffects: [effect] }
    const find = () => findDnd5eOpportunityAttackersForMove({
      map, characters: [character], movingToken: map.tokens[1], to: { x: 45, y: 5 }, turnEconomyByToken: {},
    }).map(token => token.id)
    expect(find()).toEqual([])
    expect(prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })).toEqual({ ok: false, reason: 'invalid-target' })
    effect.suspendedBy = ['antimagic-test']
    expect(find()).toEqual(['kobold'])
    character.dnd5eCombatState.activeEffects = []
    expect(find()).toEqual(['kobold'])
  })

  it('detects leaving reach from reaction availability rather than AP', () => {
    const { character, map } = fixture()
    expect(findDnd5eOpportunityAttackersForMove({
      map,
      characters: [character],
      movingToken: map.tokens[1],
      to: { x: 45, y: 5 },
      turnEconomyByToken: {},
    }).map((token) => token.id)).toEqual(['kobold'])
  })

  it('triggers when an adjacent creature takes off, not on its later high-altitude movement', () => {
    const { character, map, initiativeOrder } = fixture()
    expect(findDnd5eOpportunityAttackersForMove({
      map,
      characters: [character],
      movingToken: map.tokens[1],
      to: { x: 15, y: 5 },
      path: [{ x: 15, y: 5 }],
      pathElevationsFeet: [40],
      toElevationFeet: 40,
      movementMode: 'fly',
      turnEconomyByToken: {},
    }).map((token) => token.id)).toEqual(['kobold'])

    const airborneMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((token) => token.id === 'hero-token'
        ? { ...token, elevationFeet: 40 }
        : token),
    }
    expect(findDnd5eOpportunityAttackersForMove({
      map: airborneMap,
      characters: [character],
      movingToken: airborneMap.tokens[1],
      to: { x: 45, y: 5 },
      path: [{ x: 15, y: 5 }, { x: 25, y: 5 }, { x: 45, y: 5 }],
      pathElevationsFeet: [40, 40, 40],
      toElevationFeet: 40,
      movementMode: 'fly',
      turnEconomyByToken: {},
    })).toEqual([])
    expect(prepareDnd5eOpportunityAttack({
      combatId: 'combat',
      map: airborneMap,
      characters: [character],
      initiativeOrder,
      actorTokenId: 'kobold',
      targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })).toEqual({ ok: false, reason: 'target-out-of-range' })
  })

  it('does not trigger an opportunity attack when heavy obscuration hides the mover at the reach boundary', () => {
    const { character, map, initiativeOrder } = fixture()
    map.dnd5ePluginAreas = [{
      id: 'fog-cloud',
      pluginId: 'srd-5.1',
      featureId: 'spell:fog-cloud',
      sourceKind: 'core-spell',
      coreSpellId: 'fog-cloud',
      label: '云雾术',
      color: '#94a3b8',
      sourceCharacterId: character.id,
      sourceTokenId: 'hero-token',
      cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }],
      anchorCell: { col: 0, row: 0 },
      createdRound: 1,
      expiresAfterRound: 600,
      obscuration: { kind: 'heavy' },
    }]
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [],
      obstacles: [],
      vision: {
        enabled: true,
        defaultRangeFeet: 60,
        sharePartyVision: true,
        ambientLight: 'bright',
      },
      updatedAt: 1,
    }])
    try {
      expect(findDnd5eOpportunityAttackersForMove({
        map,
        characters: [character],
        movingToken: map.tokens[1],
        to: { x: 45, y: 5 },
        path: [{ x: 15, y: 5 }, { x: 25, y: 5 }, { x: 45, y: 5 }],
        turnEconomyByToken: {},
      })).toEqual([])
      expect(prepareDnd5eOpportunityAttack({
        combatId: 'combat',
        map,
        characters: [character],
        initiativeOrder,
        actorTokenId: 'kobold',
        targetTokenId: 'hero-token',
        turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
      })).toEqual({ ok: false, reason: 'target-not-visible' })

      map.tokens[0] = { ...map.tokens[0], blindsightRangeFeet: 10 }
      expect(findDnd5eOpportunityAttackersForMove({
        map,
        characters: [character],
        movingToken: map.tokens[1],
        to: { x: 45, y: 5 },
        turnEconomyByToken: {},
      }).map((token) => token.id)).toEqual(['kobold'])
    } finally {
      setMapGeometryRuntime([])
    }
  })

  it('suppresses opportunity attacks from creatures the Mobile owner attacked in melee this turn', () => {
    const pluginId = 'local.test.mobile-feat'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Mobile Feat Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'mobile', name: 'Mobile', summary: 'Synthetic feat.', description: 'Synthetic feat.',
          automation: 'partial', automationReasons: ['One movement rule remains manual.'],
          staticModifiers: { preventOpportunityAttacksFromMeleeAttackTargets: true },
        })
      },
    })
    try {
      const { character, map, initiativeOrder } = fixture()
      const mobile = {
        ...character,
        dnd5eFeatIds: [`${pluginId}:mobile`],
        dnd5eCombatState: { meleeAttackTargetIdsThisTurn: ['kobold'] },
      }
      expect(findDnd5eOpportunityAttackersForMove({
        map, characters: [mobile], movingToken: map.tokens[1], to: { x: 45, y: 5 },
        turnEconomyByToken: {},
      })).toEqual([])
      expect(prepareDnd5eOpportunityAttack({
        combatId: 'combat', map, characters: [mobile], initiativeOrder,
        actorTokenId: 'kobold', targetTokenId: 'hero-token',
        turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
      })).toEqual({ ok: false, reason: 'invalid-target' })
    } finally {
      dispose()
    }
  })

  it('uses a registered weapon whitelist to detect entering reach', () => {
    const pluginId = 'local.test.polearm-feat'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Polearm Feat Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'polearm-master', name: 'Polearm Master', summary: 'Synthetic feat.',
          description: 'Synthetic feat.', automation: 'full',
          staticModifiers: { opportunityAttacksOnEnterReachWeaponIds: ['dnd5e-quarterstaff'] },
        })
      },
    })
    try {
      const { character, map } = fixture()
      const polearmUser: Character = {
        ...character,
        equipment: { mainWeapon: DND5E_QUARTERSTAFF },
        dnd5eFeatIds: [`${pluginId}:polearm-master`],
      }
      map.tokens[0] = { ...map.tokens[0], x: 45 }
      expect(findDnd5eOpportunityAttackersForMove({
        map,
        characters: [polearmUser],
        movingToken: map.tokens[0],
        to: { x: 25, y: 5 },
        path: [{ x: 45, y: 5 }, { x: 35, y: 5 }, { x: 25, y: 5 }],
        turnEconomyByToken: {},
      }).map((token) => token.id)).toEqual(['hero-token'])
    } finally {
      dispose()
    }
  })

  it.each([false,true])('lets Sentinel ignore Disengage (persisted=%s) and stops movement on a qualifying hit', persisted => {
    const pluginId = 'local.test.sentinel-feat'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Sentinel Feat Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'sentinel', name: 'Sentinel', summary: 'Synthetic feat.',
          description: 'Synthetic feat.', automation: 'full',
          staticModifiers: {
            opportunityAttacksIgnoreDisengage: true,
            opportunityAttackHitStopsMovement: true,
          },
        })
      },
    })
    try {
      const { character, map, initiativeOrder } = fixture()
      const sentinel: Character = {
        ...character,
        equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
        dnd5eFeatIds: [`${pluginId}:sentinel`],
      }
      map.tokens[0] = { ...map.tokens[0], x: 25, ...(persisted ? { dnd5eCombatState: { disengagedTurnKey: 'combat:1:kobold' } } : {}) }
      expect(findDnd5eOpportunityAttackersForMove({
        map,
        characters: [sentinel],
        movingToken: map.tokens[0],
        to: { x: 45, y: 5 },
        path: [{ x: 25, y: 5 }, { x: 35, y: 5 }, { x: 45, y: 5 }],
        turnEconomyByToken: {},
        disengaged: !persisted,
      }).map((token) => token.id)).toEqual(['hero-token'])

      const prepared = prepareDnd5eOpportunityAttack({
        combatId: 'combat', round: 1, map, characters: [sentinel], initiativeOrder,
        actorTokenId: 'hero-token', targetTokenId: 'kobold',
        turnEconomy: createDnd5eTurnEconomyCounts('sentinel-turn', 30),
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      const resolved = resolvePreparedDnd5eOpportunityAttack({
        prepared: prepared.prepared, d20: 20, damageRolls: [4, 4],
      })
      expect(resolved.result.ok).toBe(true)
      if (!resolved.result.ok) return
      expect(resolved.result.state.combatants.kobold.turn.movementRemaining).toBe(0)
      expect(resolved.result.state.combatants.kobold.classState.movementStoppedTurnKey)
        .toBe('combat:1:kobold')
    } finally {
      dispose()
    }
  })

  it('spends a reaction in the 5e Headless engine and leaves legacy AP untouched', () => {
    const { character, map, initiativeOrder } = fixture()
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eOpportunityAttack({ prepared: prepared.prepared, d20: 20, damageRolls: [2, 3] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'turn-resource-spent', resource: 'reaction' }))
    expect(resolved.application?.characters[0].currentHp).toBeLessThan(30)
  })

  it('suppresses the opportunity-attack prompt when Calm Emotions forbids attacking the mover', () => {
    const { character, map, initiativeOrder } = fixture()
    map.tokens[0].dnd5eCombatState = {
      schemaVersion: 2,
      activeEffects: [createDnd5eMechanicalEffect({
        definitionId: 'srd-5.1:spell:calm-emotions:indifferent',
        label: '安定心神：漠然',
        source: { kind: 'spell', actorId: 'cleric', pluginId: 'srd-5.1' },
        targetId: 'kobold',
        tags: ['calm-emotions:indifferent'],
        modifiers: { calmEmotionsIndifferentTargetIds: ['hero-token'] },
      })],
    }

    expect(prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('treats an expanded critical as a preview hit despite higher armor class', () => {
    const { character, map, initiativeOrder } = fixture()
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    prepared.prepared.criticalThreshold = 19
    prepared.prepared.targetArmorClass = 30
    const preview = previewDnd5eOpportunityAttack(prepared.prepared, 19)
    expect(preview.hit).toBe(true)
    expect(preview.critical).toBe(true)
  })

  it('forces disadvantage on opportunity attacks against a Hunter with Escape the Horde', () => {
    const { character, map, initiativeOrder } = fixture()
    const ranger: Character = {
      ...character,
      charClass: '游侠',
      level: 7,
      dnd5eClassChoices: {
        classes: { ranger: { subclass: 'hunter', selections: { 'defensive-tactics': ['escape-the-horde'] } } },
      },
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [ranger], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('disadvantage')
    expect(prepared.prepared.attackModeResolution?.disadvantageReasons).toContain('逃脱众敌令借机攻击具有劣势')
    expect(previewDnd5eOpportunityAttack(prepared.prepared, 20, 2).hit).toBe(false)
    const resolved = resolvePreparedDnd5eOpportunityAttack({
      prepared: prepared.prepared, d20: 20, d20Second: 2, damageRolls: [],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(30)
  })

  it('includes the attacker condition disadvantage while preparing an opportunity attack', () => {
    const { character, map, initiativeOrder } = fixture()
    map.tokens[0].dnd5eCombatState = {
      schemaVersion: 2,
      activeEffects: [createDnd5eConditionEffect({
        condition: 'poisoned', targetId: 'kobold',
        source: { kind: 'dm', label: 'DM 裁定' }, appliedAt: 1,
      })],
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('disadvantage')
  })

  it('prepares Berserker Retaliation only for a level-14 Berserker in melee reach', () => {
    const { character, map, initiativeOrder } = fixture()
    const berserker: Character = {
      ...character,
      charClass: '野蛮人',
      level: 14,
      equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
      dnd5eClassChoices: { classes: { barbarian: { subclass: 'berserker', selections: {} } } },
      dnd5eCombatState: {
        berserkerRetaliationTrigger: { sourceId: 'kobold', round: 1 },
      },
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', round: 1, map, characters: [berserker], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('berserker-turn', 30),
      reactionFeature: 'berserker-retaliation',
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.reactionFeature).toBe('berserker-retaliation')
    const resolved = resolvePreparedDnd5eOpportunityAttack({
      prepared: prepared.prepared, d20: 15, damageRolls: [5],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'reaction',
    }))

    const invalid = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('fighter-turn', 30),
      reactionFeature: 'berserker-retaliation',
    })
    expect(invalid).toEqual({ ok: false, reason: 'invalid-actor' })
  })

  it('prepares Hunter Giant Killer only when the Hunter selected it', () => {
    const { character, map, initiativeOrder } = fixture()
    const hunter: Character = {
      ...character,
      charClass: '游侠',
      level: 3,
      equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
      dnd5eClassChoices: {
        classes: { ranger: { subclass: 'hunter', selections: { 'hunters-prey': ['giant-killer'] } } },
      },
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [hunter], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('hunter-turn', 30),
      reactionFeature: 'hunter-giant-killer',
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.reactionFeature).toBe('hunter-giant-killer')
    const resolved = resolvePreparedDnd5eOpportunityAttack({ prepared: prepared.prepared, d20: 15, damageRolls: [5] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'reaction',
    })

    const invalid = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [{ ...hunter, dnd5eClassChoices: { classes: { ranger: { subclass: 'hunter', selections: {} } } } }], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('hunter-turn', 30),
      reactionFeature: 'hunter-giant-killer',
    })
    expect(invalid).toEqual({ ok: false, reason: 'invalid-actor' })
  })

  it('carries Divine Favor through the player opportunity-attack authority bridge', () => {
    const { character, map, initiativeOrder } = fixture()
    const paladin: Character = {
      ...character,
      charClass: '圣武士',
      level: 2,
      equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
      dnd5eClassChoices: {
        classes: { paladin: { selections: { 'spell-prepared': ['divine-favor'] } } },
      },
      concentrating: true,
      dnd5eCombatState: {
        schemaVersion: 2,
        concentrationSpellId: 'divine-favor',
        concentrationTargetIds: ['hero-token'],
        concentrationEffectsBySource: { 'hero-token': 'divine-favor' },
      },
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [paladin], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('paladin-turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(dnd5eOpportunityAttackClassDamageDefinitions(prepared.prepared, false)).toContainEqual({
      source: 'divine-favor', count: 1, sides: 4, type: 'radiant', doubleOnCritical: true,
    })
    const resolved = resolvePreparedDnd5eOpportunityAttack({
      prepared: prepared.prepared,
      d20: 15,
      damageRolls: [1],
      classDamageRolls: [{ source: 'divine-favor', rolls: [4] }],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'hero-token', targetId: 'kobold',
      source: 'divine-favor', amount: 4,
    })
  })
})

it('uses persisted Disengage to suppress ordinary opportunity attacks after reload',()=>{
 const {character,map}=fixture()
 character.equipment=DND5E_FIGHTER_STARTING_EQUIPMENT
 map.tokens[0].x=25
 const read=()=>findDnd5eOpportunityAttackersForMove({map,characters:[character],movingToken:map.tokens[0],to:{x:45,y:5},turnEconomyByToken:{}}).map(t=>t.id)
 expect(read()).toEqual(['hero-token'])
 map.tokens[0].dnd5eCombatState=JSON.parse(JSON.stringify({disengagedTurnKey:'combat:1:kobold'}))
 expect(read()).toEqual([])
 map.tokens[0].dnd5eCombatState={}
 expect(read()).toEqual(['hero-token'])
})

it.each([1, 20, undefined])('settles Shield casting failure during an opportunity attack: %s', d20 => {
  const { character, map, initiativeOrder } = fixture()
  character.equipment = DND5E_FIGHTER_STARTING_EQUIPMENT
  const target = map.tokens[0]
  target.poolId = 'srd-5.1:mage'
  target.hp = 30
  target.maxHp = 30
  const pain = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: target.id,
    source: { kind: 'spell' }, spellcastingSave: { ability: 'con', dc: 18 } })
  target.dnd5eCombatState = { activeEffects: [pain], monsterSpellSlots: { 1: { current: 1, max: 1 } } }
  const ready = prepareDnd5eOpportunityAttack({ combatId: 'pain-opportunity', map, characters: [character],
    initiativeOrder, actorTokenId: 'hero-token', targetTokenId: target.id,
    turnEconomy: createDnd5eTurnEconomyCounts('hero-turn', 30) })
  expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true)
  if (!ready.ok) return
  const prepared = ready.prepared
  const result = resolvePreparedDnd5eOpportunityAttack({ prepared,
    d20: prepared.targetArmorClass + 1 - prepared.attackModifier,
    damageRolls: d20 === 20 ? [] : Array.from({ length: prepared.damage.count }, () => 2),
    shieldSpellcastingSavingThrows: d20 == null ? undefined : { [target.id]: [{ effectId: pain.id, d20 }] } })
  expect(result.result.ok, result.result.ok ? '' : result.result.reason).toBe(d20 != null)
  if (!result.result.ok) {
    expect(result.application).toBeUndefined()
    expect(result.result.state.combatants[target.id].classState.monsterSpellSlots?.[1].current).toBe(1)
    return
  }
  const settled = result.result.state.combatants[target.id]
  expect(settled.currentHp).toBe(d20 === 20 ? 30 : 30 - prepared.damage.count * 2 - prepared.damage.bonus)
  expect(settled.classState.monsterSpellSlots?.[1].current).toBe(0)
  expect(settled.turn.reactionAvailable).toBe(false)
  expect(result.result.events.filter(e => e.type === 'spell-cast' && e.spellId === 'shield')).toHaveLength(1)
})


it('previews and settles an opportunity attack supported by an independent area owner', () => {
  const { map, character, initiativeOrder } = fixture()
  character.equipment = { ...DND5E_FIGHTER_STARTING_EQUIPMENT }
  map.tokens.push({ ...map.tokens[0], id: 'totem-owner', x: 155 })
  initiativeOrder.push({ tokenId: 'totem-owner', label: 'Owner', emoji: '', color: '', roll: 1 })
  map.dnd5ePluginAreas = [{ id: 'hawk', pluginId: 'test', featureId: 'hawk', label: 'Hawk', color: '#fff',
    sourceTokenId: 'totem-owner', sourceCharacterId: '', expiresAfterRound: 10, cells: [{ col: 0, row: 0 }], anchorCell: { col: 0, row: 0 },
    createdRound: 1, includeSelf: true, relation: 'any', attackAdvantageReaction: 'area-source' }]
  const result = prepareDnd5eOpportunityAttack({ map, characters: [character], initiativeOrder,
    combatId: 'hawk-opportunity', round: 1, turnEconomy: createDnd5eTurnEconomyCounts('hawk-turn', 30), actorTokenId: 'hero-token', targetTokenId: 'kobold' })
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true); if (!result.ok) return
  const prepared = result.prepared
  prepared.areaAttackAdvantageReaction = { areaId: 'hawk', sourceId: 'totem-owner' }
  expect(previewDnd5eOpportunityAttack(prepared, 2, 18).roll.total).toBe(18 + prepared.attackModifier)
  const settled = resolvePreparedDnd5eOpportunityAttack({ prepared, d20: 2, d20Second: 18,
    damageRolls: Array(prepared.damage.count).fill(1) })
  expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
  if (!settled.result.ok) return
  expect(settled.result.state.combatants['hero-token'].turn.reactionAvailable).toBe(false)
  expect(settled.result.state.combatants['totem-owner'].turn.reactionAvailable).toBe(false)
  // Movement replays reconstruct prepared from Host state; the choice travels in the receipt.
  const replayed = resolvePreparedDnd5eOpportunityAttack({
    prepared: { ...prepared, areaAttackAdvantageReaction: undefined },
    areaAttackAdvantageReaction: { areaId: 'hawk', sourceId: 'totem-owner' },
    d20: 2, d20Second: 18, damageRolls: Array(prepared.damage.count).fill(1),
  })
  expect(replayed.result.ok).toBe(true)
  expect(replayed.result.state.combatants.kobold.currentHp).toBe(settled.result.state.combatants.kobold.currentHp)
  expect(replayed.result.state.combatants['totem-owner'].turn.reactionAvailable).toBe(false)
  const forged = resolvePreparedDnd5eOpportunityAttack({ prepared,
    areaAttackAdvantageReaction: { areaId: 'forged', sourceId: 'totem-owner' },
    d20: 2, d20Second: 18, damageRolls: Array(prepared.damage.count).fill(1) })
  expect(forged.result.ok).toBe(false)
  expect(forged.result.state.combatants['hero-token'].turn.reactionAvailable).toBe(true)
  expect(forged.result.state.combatants['totem-owner'].turn.reactionAvailable).toBe(true)
  expect(forged.result.state.combatants.kobold.currentHp).toBe(prepared.state.combatants.kobold.currentHp)
})


it('projects one paid opportunity cancellation into normal preview and Headless without restoring Ki', () => {
  let featureId = ''
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.opportunity-negation', name: 'Test', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    featureId = api.registerFeature({ id: 'luck', name: 'Luck', summary: 'Test', description: 'Test', automation: 'full',
      declarativeAbility: { schemaVersion: 1, id: 'luck', name: 'Luck', description: 'Test', level: 1,
        trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
        cost: { economy: 'none', resources: [{ resourceId: 'dnd5e-ki', scope: 'core', amount: 2 }] },
        mechanic: { kind: 'd20-disadvantage-negation', rollKinds: ['attack'] } } })
  } })
  try {
    const { character, map, initiativeOrder } = fixture()
    character.charClass = '武僧'
    character.level = 11
    character.dnd5eClassLevels = { monk: 11 }
    character.equipment = { mainWeapon: DND5E_QUARTERSTAFF }
    character.classResources = { 'dnd5e-ki': { current: 1, max: 3 } }
    character.dnd5ePluginFeatureIds = [featureId]
    character.dnd5eCombatState = { disadvantageNegationReceipts: { paid: { rollId: 'paid', transactionId: 'reaction', featureId, kind: 'attack' } } }
    const result = prepareDnd5eOpportunityAttack({ combatId: 'paid-reaction', map, characters: [character], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold', initiativeIndex: 1,
      turnEconomy: createDnd5eTurnEconomyCounts('reaction', 30) })
    expect(result.ok).toBe(true)
    if (!result.ok) throw Error(result.reason)
    const prepared = result.prepared
    prepared.attackMode = 'disadvantage'
    prepared.attackModeResolution = undefined
    expect(previewDnd5eOpportunityAttack(prepared, 18, 2).roll.d20).toBe(2)
    prepared.disadvantageNegation = { rollId: 'paid', transactionId: 'reaction' }
    expect(previewDnd5eOpportunityAttack(prepared, 18, 2).roll.d20).toBe(18)
    const resolved = resolvePreparedDnd5eOpportunityAttack({ prepared, d20: 18, damageRolls: [1] })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    const actor = resolved.result.state.combatants['hero-token']
    expect(actor.classResources['dnd5e-ki'].current).toBe(1)
    expect(actor.turn.reactionAvailable).toBe(false)
    expect(actor.classState.disadvantageNegationReceipts).toBeUndefined()
    prepared.disadvantageNegation.transactionId = 'wrong'
    expect(resolvePreparedDnd5eOpportunityAttack({ prepared, d20: 18, damageRolls: [1] }).result.ok).toBe(false)
    prepared.disadvantageNegation = undefined
    prepared.state.combatants['hero-token'].classResources['dnd5e-ki'].current = 3
    prepared.state.combatants['hero-token'].classState.disadvantageNegationReceipts = undefined
    const before = JSON.stringify(prepared)
    const choice = { featureId, rollId: 'local-roll', transactionId: 'follow' }
    const local = resolvePreparedDnd5eOpportunityAttack({ prepared, d20: 18, damageRolls: [1], disadvantageNegationChoice: choice })
    expect(local.result.ok, JSON.stringify(local.result)).toBe(true)
    expect(local.result.state.combatants['hero-token'].classResources['dnd5e-ki'].current).toBe(1)
    expect(local.result.state.combatants['hero-token'].classState.disadvantageNegationReceipts).toBeUndefined()
    expect(JSON.stringify(prepared)).toBe(before)
    const replay = resolvePreparedDnd5eOpportunityAttack({ prepared, d20: 18, damageRolls: [1], disadvantageNegationChoice: choice })
    expect(replay.result.state.combatants['hero-token'].classResources['dnd5e-ki'].current).toBe(1)
    prepared.state.combatants['hero-token'].classResources['dnd5e-ki'].current = 1
    expect(resolvePreparedDnd5eOpportunityAttack({ prepared, d20: 18, damageRolls: [1], disadvantageNegationChoice: choice }).result.ok).toBe(false)
    expect(prepared.state.combatants['hero-token'].turn.reactionAvailable).toBe(true)

  } finally { dispose() }
})


it.each(['use', 'decline', 'insufficient'] as const)('replays a complete follow movement with a staged Luck choice: %s', async mode => {
  let featureId = ''
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.follow-luck', name: 'Test', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    featureId = api.registerFeature({ id: 'luck', name: 'Luck', summary: 'Test', description: 'Test', automation: 'full',
      declarativeAbility: { schemaVersion: 1, id: 'luck', name: 'Luck', description: 'Test', level: 1,
        trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
        cost: { economy: 'none', resources: [{ resourceId: 'dnd5e-ki', scope: 'core', amount: 2 }] },
        mechanic: { kind: 'd20-disadvantage-negation', rollKinds: ['attack'] } } })
  } })
  try {
    const { map, character, initiativeOrder } = fixture()
    map.tokens.push({ ...map.tokens[0], id: 'follow-target', x: 75 })
    map.tokens[0] = { ...map.tokens[0], poolId: undefined, characterId: 'guard', hp: 30, maxHp: 30 }
    initiativeOrder.push({ tokenId: 'follow-target', label: 'Target', emoji: '', color: '', roll: 1 })
    const guard: Character = { ...hero(), id: 'guard', charClass: '武僧', level: 11,
      dnd5eClassLevels: { monk: 11 }, exhaustionLevel: 3, equipment: { mainWeapon: DND5E_QUARTERSTAFF },
      classResources: { 'dnd5e-ki': { current: mode === 'insufficient' ? 1 : 3, max: 11 } }, dnd5ePluginFeatureIds: [featureId] }
    const characters = [character, guard]
    const { state } = createDnd5eMapCombatSnapshot({ map, characters, initiativeOrder, combatId: 'follow-luck' })
    const before = JSON.stringify(state)
    const input = { state, map, characters, actorId: 'hero-token', targetId: 'follow-target', cell: { col: 6, row: 0 } }
    let choices = 0
    const collecting = collectDnd5eHitFollowContinuation({ ...input, isCurrent: () => true,
      chooseOpportunity: async ({ prepared }) => {
        choices++
        expect(previewDnd5eOpportunityAttack(prepared, 18, 2).roll.d20).toBe(2)
        return { declined: false, rolls: { d20: 18, d20Second: 2,
          damageRolls: mode === 'decline' ? [] : [1],
          disadvantageNegationChoice: mode === 'decline' ? undefined : { featureId, rollId: 'follow-luck-roll', transactionId: 'follow-action' } } }
      },
    })
    if (mode === 'insufficient') {
      await expect(collecting).rejects.toThrow('invalid-class-feature')
      expect(JSON.stringify(state)).toBe(before)
      return
    }
    const collected = await collecting
    expect(choices).toBe(1)
    expect(JSON.stringify(state)).toBe(before)
    const receipt = JSON.parse(JSON.stringify({ opportunities: collected.opportunities, segmentRolls: collected.segmentRolls,
      completionRolls: collected.completionRolls, areaReceipts: collected.areaReceipts, concentrationReceipts: collected.concentrationReceipts }))
    const replay = replayDnd5eHitFollowContinuation({ ...input, ...receipt })
    expect(replay.ok).toBe(true)
    if (!replay.ok) throw Error(replay.reason)
    for (const result of [collected.result, replay]) {
      expect(result.state.combatants.kobold.classResources['dnd5e-ki'].current).toBe(mode === 'use' ? 1 : 3)
      expect(result.state.combatants.kobold.turn.reactionAvailable).toBe(false)
      expect(result.state.combatants.kobold.classState.disadvantageNegationReceipts).toBeUndefined()
      expect(result.state.combatants['hero-token'].currentHp).toBe(mode === 'use' ? 26 : 30)
      expect(result.state.combatants['hero-token'].position).toEqual({ x: 65, y: 5, elevationFeet: 0 })
    }
  } finally { dispose() }
})


it.each([false, true])('replays follow movement through an area with saving-throw Luck=%s', async use => {
  let featureId = ''
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.follow-area-luck', name: 'Test', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    featureId = api.registerFeature({ id: 'luck', name: 'Luck', summary: 'Test', description: 'Test', automation: 'full',
      declarativeAbility: { schemaVersion: 1, id: 'luck', name: 'Luck', description: 'Test', level: 1,
        trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
        cost: { economy: 'none', resources: [{ resourceId: 'dnd5e-ki', scope: 'core', amount: 2 }] },
        mechanic: { kind: 'd20-disadvantage-negation', rollKinds: ['saving-throw'] } } })
  } })
  try {
    const { map, character, initiativeOrder } = fixture()
    character.charClass = '武僧'; character.level = 11; character.dnd5eClassLevels = { monk: 11 }
    character.dnd5ePluginFeatureIds = [featureId]
    character.classResources = { 'dnd5e-ki': { current: 3, max: 11 } }
    character.dnd5eCombatState = { activeEffects: [createDnd5eMechanicalEffect({ id: 'save-penalty', definitionId: 'save-penalty', label: 'Penalty',
      targetId: 'hero-token', source: { kind: 'spell' }, duration: { type: 'permanent' }, modifiers: { savingThrowDisadvantages: ['dex'] } })] }
    map.tokens.push({ ...map.tokens[0], id: 'follow-target', x: 75 })
    initiativeOrder.push({ tokenId: 'follow-target', label: 'Target', emoji: '', color: '', roll: 1 })
    map.dnd5ePluginAreas = [{ id: 'field', pluginId: 'local.test', featureId: 'field', label: 'Field', color: '#888888',
      sourceTokenId: 'kobold', sourceCharacterId: 'kobold', createdRound: 1, expiresAfterRound: 11, cells: [{ col: 4, row: 0 }],
      triggers: [{ id: 'enter', label: 'Enter', timing: 'on-enter', oncePerTurn: true,
        savingThrow: { ability: 'dex', dc: 10, onSuccess: 'none' }, damage: { count: 1, sides: 4, type: 'fire' } }] }]
    const characters = [character]
    const { state } = createDnd5eMapCombatSnapshot({ map, characters, initiativeOrder, combatId: 'follow-area-luck' })
    const before = JSON.stringify(state)
    const input = { state, map, characters, actorId: 'hero-token', targetId: 'follow-target', cell: { col: 6, row: 0 } }
    let saves = 0
    const collected = await collectDnd5eHitFollowContinuation({ ...input, isCurrent: () => true,
      chooseOpportunity: async () => ({ declined: true }),
      rollArea: async ({ prepared }) => {
        saves++
        expect(prepared.save?.mode).toBe('disadvantage')
        return { d20: 18, d20Second: use ? undefined : 2, damageRolls: use ? [] : [2],
          disadvantageNegationChoice: use ? { featureId, rollId: 'follow-area-roll', transactionId: prepared.candidate.transactionId,
            contextId: JSON.stringify([prepared.candidate.area.id, prepared.candidate.trigger.id]) } : undefined }
      },
    })
    expect(saves).toBe(1)
    expect(collected.areaReceipts).toHaveLength(1)
    const receipt = JSON.parse(JSON.stringify({ opportunities: collected.opportunities, segmentRolls: collected.segmentRolls,
      completionRolls: collected.completionRolls, areaReceipts: collected.areaReceipts, concentrationReceipts: collected.concentrationReceipts }))
    const replay = replayDnd5eHitFollowContinuation({ ...input, ...receipt })
    expect(replay.ok, JSON.stringify(replay)).toBe(true)
    if (!replay.ok) throw Error(replay.reason)
    for (const result of [collected.result, replay]) {
      expect(result.state.combatants['hero-token'].classResources['dnd5e-ki'].current).toBe(use ? 1 : 3)
      expect(result.state.combatants['hero-token'].currentHp).toBe(use ? 30 : 28)
      expect(result.state.combatants['hero-token'].position).toEqual({ x: 65, y: 5, elevationFeet: 0 })
      expect(result.state.combatants['hero-token'].classState.disadvantageNegationReceipts).toBeUndefined()
    }
    expect(JSON.stringify(state)).toBe(before)
  } finally { dispose() }
})
