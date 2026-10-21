import {collectDnd5eHitPushConsequences} from './weaponHitPushConsequences'
import {collectDnd5eCompositeMovementStep} from './templeCompositeMovement'
import {resolveDnd5eForcedMovementLanding} from './headlessCombatEngine'
import {registerDnd5eActivityPackage} from './activities/dnd5eActivityRegistry'
import {settleDnd5eActivityTriggerWindowsV1} from './activities/dnd5eActivityTriggerSettlement'
import {settleDnd5eTempleTriggeredMovement} from './activities/templeTriggeredMovement'
import {it,expect,vi,afterEach} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication} from './mapBridge'
import {settleDnd5eTempleMovementEntries,prepareDnd5eTempleForcedMovement} from './templeMovementSettlement'
import type {BattleMap} from '../../store/maps'
import {resolveDnd5eHeadlessAction,type Dnd5eCombatEvent} from './headlessCombatEngine'
import {applyDnd5eActivityMapHandoffsV1} from './activities/dnd5eActivityMapInteraction'
import {dnd5eActivityMapMovementEvents} from './activities/dnd5eActivityMapMovementEvents'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {dnd5eTempleEntryRequirements} from './templeEntry'
import {settleDnd5eTemplePortalEntry} from './templePortalEntry'
import {setMapGeometryRuntime} from '../../lib/mapGeometry'
import {prepareDnd5eMonsterAreaAction,dnd5eMonsterAreaForcedMovementPlans,resolvePreparedDnd5eMonsterAreaAction} from './monsterAreaAction'
import {prepareDnd5eMonsterCoreSpell,resolvePreparedDnd5eMonsterCoreSpell} from './monsterCoreSpellAction'
import {dnd5eForcedPushDestination} from './spellAction'
import {resolveDnd5eTempleEntryEffectDice,replayDnd5eTempleEntry} from './templeEntryEffectDice'
import {replayDnd5eTempleMovementEntries} from './templeMovementReplay'
import {dnd5eCombatantPairKey} from './headlessCombatEngine'
import {previewDnd5eMonsterCompositePrefix,type Dnd5eAction} from './headlessCombatEngine'
import {getDnd5eSrdMonster} from './monsters'
import {registerDnd5ePluginMonsterCatalogEntry} from './roomMonsterCatalog'
afterEach(()=>vi.restoreAllMocks())

it.each([true,false])('settles cliff landing only after recorded temple entry permits movement (%s)',async allowed=>{
 vi.spyOn(Date,'now').mockReturnValue(1792189661000)
 const base=fixture('forced',75)
 const map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],poolId:'srd-5.1:dretch',elevationFeet:20}]}
 const geometry=base.snapshot.state.companionScene!.geometry!
 geometry.structureLifetimes![0].objectBoundary!.topFeet=40
 geometry.structureLifetimes![0].templeWard!.saveDc=15
 geometry.obstacles.push({id:'ledge',kind:'obstacle',label:'Ledge',cover:'none',
  points:[{x:0,y:0},{x:100,y:0},{x:100,y:500},{x:0,y:500}],baseHeightFeet:0,heightFeet:0,
  terrainElevationFeet:20,terrainRegion:true,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
 const snapshot=createDnd5eMapCombatSnapshot({map,geometry,characters:[],combatId:map.id,worldMinute:100,
  initiativeOrder:[{tokenId:'imp',roll:20,label:'Dretch',emoji:'',color:''}]})
 snapshot.state.combatants.imp.position={x:125,y:125}
 const events:Dnd5eCombatEvent[]=[{type:'moved',actorId:'imp',from:{x:75,y:125},to:{x:125,y:125},distance:5,
  movementKind:'forced',fromElevationFeet:20,toElevationFeet:20,fromMapId:map.id,toMapId:map.id}]
 const before=structuredClone(snapshot.state)
 const entry=await settleDnd5eTempleMovementEntries({map,state:snapshot.state,events,transactionId:'cliff:entry',
  isCurrent:()=>true,roll:async()=>({d20:allowed?20:1,d20Second:allowed?20:1})})
 expect(entry.ok).toBe(true);if(!entry.ok)throw Error(entry.reason)
 const landings=allowed?[{eventIndex:0,fallingDamageRolls:[2,3]}]:[]
 const replay=replayDnd5eTempleMovementEntries({map,state:snapshot.state,events,entryReplays:entry.entryReplays,landings})
 expect(replay.ok,JSON.stringify(replay)).toBe(true);if(!replay.ok)throw Error(replay.reason)
 expect(replay.state.combatants.imp.currentHp).toBe(allowed?5:10)
 expect(replay.state.combatants.imp.position.x).toBe(allowed?125:75)
 expect(replay.state.combatants.imp.elevationFeet).toBe(allowed?0:20)
 expect(replay.events.filter(event=>event.type==='damage-applied')).toHaveLength(allowed?1:0)
 const invalid=replayDnd5eTempleMovementEntries({map,state:snapshot.state,events,entryReplays:entry.entryReplays,
  landings:allowed?[]:[{eventIndex:0,fallingDamageRolls:[2,3]}]})
 expect(invalid.ok).toBe(false)
 expect(snapshot.state).toEqual(before)
 const falling=vi.fn(async()=>[2,3])
 const collected=await collectDnd5eHitPushConsequences({state:snapshot.state,map,events,transactionId:'hit:push',
  isCurrent:()=>true,roll:async()=>({d20:allowed?20:1,d20Second:allowed?20:1}),rollFallingDamage:falling})
 expect(collected.ok,JSON.stringify(collected)).toBe(true)
 if(!collected.ok)throw Error('collection failed')
 expect(collected.state.combatants.imp.currentHp).toBe(allowed?5:10)
 expect(collected.state.combatants.imp.position.x).toBe(allowed?125:75)
 expect(collected.state.combatants.imp.elevationFeet).toBe(allowed?0:20)
 expect(falling).toHaveBeenCalledTimes(allowed?1:0)
 const repeated=replayDnd5eTempleMovementEntries({state:snapshot.state,map,events,entryReplays:collected.entryReplays,landings:collected.landings})
 expect(repeated.ok).toBe(true)
 if(repeated.ok)expect(repeated.state).toEqual(collected.state)
 expect(snapshot.state).toEqual(before)
 const stale=await collectDnd5eHitPushConsequences({state:snapshot.state,map,events,transactionId:'hit:push:stale',
  isCurrent:()=>false,roll:async()=>undefined,rollFallingDamage:falling})
 expect(stale).toEqual({ok:false,reason:'temple-entry-authority-changed'})
})

it.each([[true,true],[false,true],[true,false],[false,false]])('replays entry between composite children before checking the next attack range (allowed %s, Host %s)',async (allowed,host)=>{
 const monster=structuredClone(getDnd5eSrdMonster('srd-5.1:adult-bronze-dragon')!)
 monster.id='test:temple-composite';monster.slug='temple-composite';monster.size='中型'
 const parent=monster.actions.find(action=>action.id==='multiattack')!
 parent.sequence=['breath-weapons','tail']
 const tail=monster.actions.find(action=>action.id==='tail')!
 tail.attack!.reachFeet=5
 const dispose=registerDnd5ePluginMonsterCatalogEntry(monster)
 try{
  const base=fixture('forced',75),map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'source',poolId:monster.id,x:25},base.map.tokens[0]]}
  const snapshot=createDnd5eMapCombatSnapshot({map,geometry:base.snapshot.state.companionScene!.geometry!,characters:[],combatId:map.id,worldMinute:100,
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
  const action:Extract<Dnd5eAction,{type:'monster-multiattack-composite'}>={type:'monster-multiattack-composite',schemaVersion:1,
   actorId:'source',actionId:'multiattack',steps:[{kind:'area',actionId:'breath-weapons',resolution:{schemaVersion:1,
    variantId:'repulsion-breath',targetIds:['imp'],targetSavingThrows:[{targetId:'imp',d20:1}],damageRolls:[],
    forcedMovements:[{targetId:'imp',to:{x:125,y:125},distanceFeet:5}]}},{kind:'weapon',actionId:'tail',roll:{targetId:'imp',d20:1,damageRolls:[]}}]}
  const before=structuredClone(snapshot.state)
  action.steps[0].stageForcedMovement=true
  if(host){
   const roll=vi.fn(async()=>({d20:allowed?20:1,d20Second:allowed?20:1}))
   const rollFallingDamage=vi.fn(async()=>undefined)
   const input={state:snapshot.state,action:{...action,steps:action.steps.slice(0,1)},transactionId:'composite:temple',isCurrent:()=>true,roll,rollFallingDamage}
   const cancelled=await collectDnd5eCompositeMovementStep({...input,isCurrent:()=>false})
   expect(cancelled).toMatchObject({ok:false,reason:'temple-entry-authority-changed'})
   expect(roll).not.toHaveBeenCalled()
   const collected=await collectDnd5eCompositeMovementStep(input)
   expect(collected.ok,JSON.stringify(collected)).toBe(true);if(!collected.ok)throw Error(collected.reason)
   expect(roll).toHaveBeenCalledTimes(1)
   expect(rollFallingDamage).not.toHaveBeenCalled()
   expect(input.action.steps[0].templeEntryReplays).toBeUndefined()
   Object.assign(action.steps[0],JSON.parse(JSON.stringify(collected.step)))
   const replay=await collectDnd5eCompositeMovementStep({...input,action:{...action,steps:action.steps.slice(0,1)}})
   expect(replay.ok,JSON.stringify(replay)).toBe(true)
   expect(roll).toHaveBeenCalledTimes(1)
  }else{
  const prefix=previewDnd5eMonsterCompositePrefix(snapshot.state,{...action,steps:action.steps.slice(0,1)},'composite:temple')
  expect(prefix.ok,JSON.stringify(prefix)).toBe(true);if(!prefix.ok)throw Error(prefix.reason)
  const events=prefix.events.map(event=>event.type==='moved'?{...event,movementKind:'forced' as const,
   fromElevationFeet:snapshot.state.combatants[event.actorId].elevationFeet??0,
   toElevationFeet:event.toElevationFeet??snapshot.state.combatants[event.actorId].elevationFeet}:event)
  const entry=await settleDnd5eTempleMovementEntries({map,state:prefix.state,events,transactionId:'composite:temple:child:0',
   isCurrent:()=>true,roll:async()=>({d20:allowed?20:1,d20Second:allowed?20:1})})
  expect(entry.ok).toBe(true);if(!entry.ok)throw Error(entry.reason)
  action.steps[0].templeEntryReplays=JSON.parse(JSON.stringify(entry.entryReplays))
  action.steps[0].forcedMovementLandings=allowed?events.flatMap((event,eventIndex)=>event.type==='moved'?[{eventIndex}]:[]):[]
  }
  const guarded=previewDnd5eMonsterCompositePrefix(snapshot.state,{...action,steps:action.steps.slice(0,1)},'composite:temple')
  expect(guarded.ok,JSON.stringify(guarded)).toBe(true);if(!guarded.ok)throw Error(guarded.reason)
  expect(guarded.state.combatants.imp.position.x).toBe(allowed?125:75)
  expect(guarded.state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey('source','imp')]).toBe(allowed?10:5)
  const result=resolveDnd5eHeadlessAction(snapshot.state,action,{transactionId:'composite:temple'})
  if(allowed){expect(result).toMatchObject({ok:false,reason:'invalid-target'})}
  else{
   expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
   expect(result.state.combatants.imp.position.x).toBe(75)
   expect(result.state.combatants.source.turn.actionAvailable).toBe(false)
   expect(result.events.filter(event=>event.type==='saving-throw-resolved'&&event.ability==='cha')).toHaveLength(1)
   expect(result.events.filter(event=>event.type==='attack-resolved')).toHaveLength(1)
  }
  expect(snapshot.state).toEqual(before)
 }finally{dispose()}
})

it.each(['allowed','denied','cancel','invalid','stale','feather','decline','denied-reaction'] as const)('collects composite cliff dice only after entry (%s)',async mode=>{
 const monster=structuredClone(getDnd5eSrdMonster('srd-5.1:adult-bronze-dragon')!)
 monster.id='test:temple-cliff';monster.slug='temple-cliff';monster.size='中型'
 monster.actions.find(action=>action.id==='multiattack')!.sequence=['breath-weapons','tail']
 const dispose=registerDnd5ePluginMonsterCatalogEntry(monster)
 try{
  const base=fixture('forced',75)
  const map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'source',poolId:monster.id,x:25,elevationFeet:20},
   {...base.map.tokens[0],poolId:'srd-5.1:dretch',elevationFeet:20}]}
  const geometry=base.snapshot.state.companionScene!.geometry!
  geometry.structureLifetimes![0].objectBoundary!.topFeet=40
  geometry.structureLifetimes![0].templeWard!.saveDc=15
  geometry.obstacles.push({id:'ledge',kind:'obstacle',label:'Ledge',cover:'none',
   points:[{x:0,y:0},{x:100,y:0},{x:100,y:500},{x:0,y:500}],baseHeightFeet:0,heightFeet:0,
   terrainElevationFeet:20,terrainRegion:true,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
  const snapshot=createDnd5eMapCombatSnapshot({map,geometry,characters:[],combatId:map.id,worldMinute:100,
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
  const action:Extract<Dnd5eAction,{type:'monster-multiattack-composite'}>={type:'monster-multiattack-composite',schemaVersion:1,
   actorId:'source',actionId:'multiattack',steps:[{kind:'area',stageForcedMovement:true,actionId:'breath-weapons',resolution:{schemaVersion:1,
    variantId:'repulsion-breath',targetIds:['imp'],targetSavingThrows:[{targetId:'imp',d20:1}],damageRolls:[],
    forcedMovements:[{targetId:'imp',to:{x:125,y:125},distanceFeet:5}]}}]}
  const caster=snapshot.state.combatants.source
  caster.classId='wizard';caster.classLevels={wizard:5};caster.classSelections={'spell-prepared':['feather-fall']}
  caster.classResources={'dnd5e-spell-slot-1':{current:1,max:1}}
  const denied=mode==='denied'||mode==='denied-reaction'
  const requestFallReaction=vi.fn(async()=>mode==='decline'?undefined:{casterId:'source',targetIds:['imp']})
  const before=structuredClone(snapshot.state),original=structuredClone(action)
  let current=true
  const fall=vi.fn(async(count:number,targetId:string)=>{
   expect(count).toBe(2);expect(targetId).toBe('imp')
   if(mode==='stale')current=false
   return mode==='cancel'?undefined:mode==='invalid'?[7,1]:[2,3]
  })
  const result=await collectDnd5eCompositeMovementStep({state:snapshot.state,action,transactionId:'cliff:composite',
   isCurrent:()=>current,roll:async()=>({d20:denied?1:20}),rollFallingDamage:fall,
   requestFallReaction:['feather','decline','denied-reaction'].includes(mode)?requestFallReaction:undefined})
  expect(fall).toHaveBeenCalledTimes(denied||mode==='feather'?0:1)
  if(['allowed','denied','feather','decline','denied-reaction'].includes(mode)){
   expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
   expect(result.prefix.state.combatants.imp.currentHp).toBe(!denied&&mode!=='feather'?5:10)
   expect(result.prefix.state.combatants.imp.elevationFeet).toBe(denied||mode==='feather'?20:0)
   expect(result.prefix.state.combatants.imp.position.x).toBe(denied?75:125)
   expect(requestFallReaction).toHaveBeenCalledTimes(['feather','decline'].includes(mode)?1:0)
   expect(result.prefix.state.combatants.source.classResources['dnd5e-spell-slot-1'].current).toBe(mode==='feather'?0:1)
   if(mode==='feather'){
    const repeated=await collectDnd5eCompositeMovementStep({state:snapshot.state,action:{...action,steps:[JSON.parse(JSON.stringify(result.step))]},
     transactionId:'cliff:composite',isCurrent:()=>true,roll:async()=>{throw Error('No reroll')},rollFallingDamage:fall,requestFallReaction})
    expect(repeated.ok).toBe(true);expect(requestFallReaction).toHaveBeenCalledTimes(1)
    if(repeated.ok)expect(repeated.prefix.state.combatants.source.classResources['dnd5e-spell-slot-1'].current).toBe(0)
   }
  }else expect(result.ok).toBe(false)
  expect(snapshot.state).toEqual(before);expect(action).toEqual(original)
 }finally{dispose()}
})

it.each([true,false])('binds movement replay evidence and refreshes distances for the next child (%s)',async allowed=>{
 vi.spyOn(Date,'now').mockReturnValue(1700000000000)
 const base=fixture('forced',75)
 const map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'source',x:25},base.map.tokens[0]]}
 const snapshot=createDnd5eMapCombatSnapshot({map,geometry:base.snapshot.state.companionScene!.geometry!,characters:[],combatId:map.id,worldMinute:100,
  initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
 snapshot.state.combatants.source.turn.actionAvailable=false
 snapshot.state.combatants.imp.position={x:125,y:125};snapshot.state.combatants.imp.currentHp=8
 const events:Dnd5eCombatEvent[]=[{...(base.events[0] as Extract<Dnd5eCombatEvent,{type:'moved'}>),to:{x:125,y:125},distance:5}]
 const before=structuredClone(snapshot.state)
 const settled=await settleDnd5eTempleMovementEntries({map,state:snapshot.state,events,transactionId:'child:0',isCurrent:()=>true,
  roll:async()=>({d20:allowed?20:1,d20Second:allowed?20:1})})
 expect(settled.ok).toBe(true);if(!settled.ok)throw Error(settled.reason)
 const entryReplays=JSON.parse(JSON.stringify(settled.entryReplays))
 const replay=replayDnd5eTempleMovementEntries({map,state:snapshot.state,events,entryReplays})
 expect(replay.ok,JSON.stringify(replay)).toBe(true);if(!replay.ok)throw Error(replay.reason)
 expect(replay.state).toEqual(settled.state);expect(replay.events).toEqual(settled.events)
 expect(replay.state.combatants.source.turn.actionAvailable).toBe(false)
 expect(replay.state.combatants.imp.currentHp).toBe(8)
 expect(replay.state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey('source','imp')]).toBe(allowed?10:5)
 expect(replayDnd5eTempleMovementEntries({map,state:snapshot.state,events,entryReplays:[]})).toMatchObject({ok:false,reason:'temple-entry-replay-missing'})
 for(const mutation of ['destination','target','index','duplicate','scene','transport'] as const){
  const forged=structuredClone(entryReplays)
  if(mutation==='destination')forged[0].receipt.action.to.x+=50
  if(mutation==='target')forged[0].receipt.action.actorId='source'
  if(mutation==='index')forged[0].eventIndex=99
  if(mutation==='duplicate')forged.push(structuredClone(forged[0]))
  if(mutation==='scene')forged[0].receipt.action.entryScene=structuredClone(snapshot.state.companionScene)
  if(mutation==='transport')forged[0].receipt.action.transportMode='teleport'
  expect(replayDnd5eTempleMovementEntries({map,state:snapshot.state,events,entryReplays:forged}).ok,mutation).toBe(false)
 }
 expect(snapshot.state).toEqual(before)
})

it('records movement entry evidence and replays inspiration consumption from the original snapshot',async()=>{
 const {map,snapshot,events}=fixture('forced',75)
 const movement=events[0] as Extract<Dnd5eCombatEvent,{type:'moved'}>
 movement.to={x:125,y:125};movement.distance=5
 snapshot.state.combatants.imp.classState.bardicInspirationDie=6
 snapshot.state.combatants.imp.classState.bardicInspirationRoundsRemaining=100
 const before=structuredClone(snapshot.state)
 let rolls=0
 const settled=await settleDnd5eTempleMovementEntries({map,state:snapshot.state,events,transactionId:'composite:child:1',
  isCurrent:()=>true,roll:async()=>{rolls++;return {d20:1,d20Second:1,bardicInspirationRoll:1}}})
 expect(settled.ok).toBe(true);if(!settled.ok)throw Error(settled.reason)
 expect(settled.entryReplays).toHaveLength(1)
 expect(settled.entryReplays[0]).toMatchObject({eventIndex:0,receipt:{transactionId:'composite:child:1:entry:0'}})
 const receipt=JSON.parse(JSON.stringify(settled.entryReplays[0].receipt))
 for(let repeat=0;repeat<3;repeat++){
  const replay=replayDnd5eTempleEntry(before,receipt)
  expect(replay.ok,JSON.stringify(replay)).toBe(true);if(!replay.ok)throw Error(replay.reason)
  expect(replay.movementBlocked).toBe('saving-throw')
  expect(replay.state.combatants.imp.classState.bardicInspirationDie).toBeUndefined()
  expect(replay.state.combatants.imp.classState.activeEffects?.filter(effect=>effect.definitionId==='temple-of-the-gods:entry-denied')).toHaveLength(1)
 }
 expect(rolls).toBe(1)
 expect(snapshot.state).toEqual(before)
})

it.each([1,4])('replays an entry with its original effect dice and transaction without changing the source (d4=%s)',async penalty=>{
 // Effect and ledger audit timestamps use wall time; keep that independent
 // variable fixed while asserting identical rule state and dice outcomes.
 vi.spyOn(Date,'now').mockReturnValue(1700000000000)
 const {snapshot}=fixture('forced',125)
 const geometry=snapshot.state.companionScene!.geometry!
 geometry.structureLifetimes!.push({...structuredClone(geometry.structureLifetimes![0]),id:'second-temple',
  objectBoundary:{points:[{x:300,y:100},{x:400,y:100},{x:400,y:200},{x:300,y:200}],bottomFeet:0,topFeet:20}})
 const actor=snapshot.state.combatants.imp
 const requirements=dnd5eTempleEntryRequirements(snapshot.state,actor,{x:325,y:125},0,undefined,'forced')
 expect(requirements).toHaveLength(1)
 const before=structuredClone(snapshot.state)
 const d20=19-(actor.savingThrowBonuses.cha??Math.floor((actor.abilities.cha-10)/2))
 const action={type:'temple-entry-attempt' as const,actorId:'imp',to:{x:325,y:125},toElevationFeet:0,distance:20,
  transportMode:'forced' as const,boundarySavingThrows:[{effectId:requirements[0].effectId,d20,d20Second:d20}]}
 let diceRequests=0
 const prepared=await resolveDnd5eTempleEntryEffectDice({state:snapshot.state,action,transactionId:'composite-entry:step:0',
  isCurrent:()=>true,rollEffectDice:async recipe=>{diceRequests++;expect(recipe.sides).toBe(4);return [penalty]}})
 expect(prepared.ok,JSON.stringify(prepared)).toBe(true)
 if(!prepared.ok||!('entryReplay' in prepared))throw Error('missing replay evidence')
 expect(diceRequests).toBe(1)
 const receipt=JSON.parse(JSON.stringify(prepared.entryReplay))
 action.boundarySavingThrows[0].d20=1
 for(let repeat=0;repeat<3;repeat++){
  const replay=replayDnd5eTempleEntry(snapshot.state,receipt)
  expect(replay.ok).toBe(true)
  expect(replay.state).toEqual(prepared.state)
  expect(replay.events).toEqual(prepared.events)
  if(replay.ok)expect(replay.movementBlocked).toBe(prepared.movementBlocked)
 }
 expect(snapshot.state).toEqual(before)
 expect(diceRequests).toBe(1)
 expect(prepared.movementBlocked).toBe(penalty===4?'saving-throw':undefined)
 const incomplete=structuredClone(receipt)
 incomplete.action.effectRollDice={}
 expect(replayDnd5eTempleEntry(snapshot.state,incomplete).ok).toBe(false)
})

it.each([true,false])('stages native Thunderwave before temple entry without undoing damage or slots (%s)',async allowed=>{
 const base=fixture('forced',75)
 const map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'druid',poolId:'srd-5.1:druid',x:25,hp:27,maxHp:27,
  dnd5eCombatState:{monsterSpellSlots:{1:{current:1,max:1}}}},base.map.tokens[0]]}
 setMapGeometryRuntime([base.snapshot.state.companionScene!.geometry!])
 try{
  const prepared=prepareDnd5eMonsterCoreSpell({map,characters:[],combatId:map.id,worldMinute:100,
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''})),
   actorTokenId:'druid',targetTokenIds:['imp'],areaTargetCell:{col:1,row:2},spellId:'thunderwave',slotLevel:1})
  expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
  const before=structuredClone(prepared.prepared.state)
  const movement={targetId:'imp',...dnd5eForcedPushDestination(map,map.tokens[0],map.tokens[1],10)}
  const resolution={targetSavingThrows:[{targetId:'imp',d20:1,d20Second:1}],forcedMovements:[movement],effectRolls:[[1,1]]}
  const resolved=resolvePreparedDnd5eMonsterCoreSpell({prepared:prepared.prepared,resolution,deferForcedMovementLanding:true})
  expect(resolved.result.ok,JSON.stringify(resolved.result)).toBe(true);if(!resolved.result.ok)throw Error(resolved.result.reason)
  const gate=await settleDnd5eTempleMovementEntries({state:resolved.result.state,map,
   events:resolved.result.events.map(event=>event.type==='moved'?{...event,movementKind:'forced' as const,fromElevationFeet:0,toElevationFeet:0}:event),
   isCurrent:()=>true,roll:async()=>({d20:allowed?20:1,d20Second:allowed?20:1})})
  expect(gate.ok,JSON.stringify(gate)).toBe(true);if(!gate.ok)throw Error(gate.reason)
  expect(gate.state.combatants.imp.position).toEqual(allowed?movement.to:{x:75,y:125})
  expect(gate.state.combatants.imp.currentHp).toBe(8)
  expect(gate.state.combatants.druid.classState.monsterSpellSlots?.['1'].current).toBe(0)
  expect(gate.state.combatants.druid.turn.actionAvailable).toBe(false)
  expect(gate.events.filter(event=>event.type==='moved')).toHaveLength(allowed?1:0)
  const forged=resolvePreparedDnd5eMonsterCoreSpell({prepared:prepared.prepared,deferForcedMovementLanding:true,
   resolution:{...resolution,forcedMovements:[{...movement,to:{x:275,y:125}}]}})
  expect(forged.result).toMatchObject({ok:false,reason:'invalid-target'})
  expect(prepared.prepared.state).toEqual(before)
 }finally{setMapGeometryRuntime([])}
})

it.each([[true,1],[false,1],[true,3],[false,3]] as const)('gates native repulsion after the strength save while retaining the spent action (%s, size %s)',async (allowed,size)=>{
 const base=fixture('forced',325)
 const map:BattleMap={...base.map,width:1500,tokens:[
  {...base.map.tokens[0],id:'dragon',poolId:'srd-5.1:adult-bronze-dragon',x:125,hp:212,maxHp:212,size},
  {...base.map.tokens[0],type:'enemy'}]}
 const geometry=base.snapshot.state.companionScene!.geometry!
 geometry.structureLifetimes![0].objectBoundary={points:[{x:500,y:0},{x:1100,y:0},{x:1100,y:500},{x:500,y:500}],bottomFeet:0,topFeet:20}
 setMapGeometryRuntime([geometry])
 try{
  const prepared=prepareDnd5eMonsterAreaAction({combatId:map.id,map,characters:[],
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''})),
   actorTokenId:'dragon',actionId:'breath-weapons',variantId:'repulsion-breath',targetTokenIds:['imp'],areaTargetCell:{col:6,row:2}})
  expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
  const before=structuredClone(prepared.prepared.state)
  const movements=dnd5eMonsterAreaForcedMovementPlans(prepared.prepared).map(({targetId,to,distanceFeet})=>({targetId,to,distanceFeet}))
  expect(movements).toHaveLength(1)
  const resolved=resolvePreparedDnd5eMonsterAreaAction({prepared:prepared.prepared,
   resolution:{targetSavingThrows:[{targetId:'imp',d20:1}],damageRolls:[],forcedMovements:movements}})
  expect(resolved.result.ok,JSON.stringify(resolved.result)).toBe(true);if(!resolved.result.ok)throw Error(resolved.result.reason)
  let saves=0
  const gate=await settleDnd5eTempleMovementEntries({state:resolved.result.state,map,
   events:resolved.result.events.map(event=>event.type==='moved'?{...event,movementKind:'forced' as const,fromElevationFeet:0,toElevationFeet:0}:event),
   isCurrent:()=>true,roll:async()=>{saves++;return {d20:allowed?20:1,d20Second:allowed?20:1}}})
  expect(gate.ok,JSON.stringify(gate)).toBe(true);if(!gate.ok)throw Error(gate.reason)
  expect(saves).toBe(1)
  expect(gate.state.combatants.dragon.turn.actionAvailable).toBe(false)
  expect(gate.state.combatants.imp.position).toEqual(allowed?movements[0].to:{x:325,y:125})
  expect(gate.state.combatants.imp.currentHp).toBe(10)
  expect(gate.events.filter(event=>event.type==='moved')).toHaveLength(allowed?1:0)
  expect(prepared.prepared.state).toEqual(before)
 }finally{setMapGeometryRuntime([])}
})

it.each([1,4])('uses the source temple penalty when entering another temple (d4=%s)',async penalty=>{
 const source=fixture('teleport'),destination=fixture('teleport')
 source.snapshot.state.mapId='source'
 source.snapshot.state.companionScene!.map.id='source'
 source.snapshot.state.companionScene!.geometry!.mapId='source'
 const before=structuredClone(source.snapshot.state)
 const event={...(destination.events[0] as Extract<Dnd5eCombatEvent,{type:'moved'}>),fromMapId:'source',from:{x:125,y:125}}
 const recipes:string[]=[]
 const result=await settleDnd5eTemplePortalEntry({state:source.snapshot.state,destinationScene:destination.snapshot.state.companionScene!,event,
  isCurrent:()=>true,roll:async request=>({d20:19-request.requirement.modifier,d20Second:19-request.requirement.modifier}),rollEffectDice:async(recipe,target)=>{
   expect(target.id).toBe('imp');expect(recipe.sides).toBe(4);expect(recipe.count).toBe(1)
   recipes.push(recipe.id);return [penalty]
  }})
 expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(recipes).toHaveLength(1)
 expect(result.allowed).toBe(penalty===1)
 expect(result.events.filter(event=>event.type==='saving-throw-resolved')).toHaveLength(1)
 expect(result.state.combatants.imp.position).toEqual({x:125,y:125})
 expect(source.snapshot.state).toEqual(before)
})

it.each(['forced','teleport'] as const)('retains source ward dice for same-map %s movement',async mode=>{
 const {map,snapshot,events}=fixture(mode)
 const geometry=snapshot.state.companionScene!.geometry!
 geometry.structureLifetimes!.push({...structuredClone(geometry.structureLifetimes![0]),id:'source-ward',
  objectBoundary:{points:[{x:0,y:100},{x:100,y:100},{x:100,y:200},{x:0,y:200}],bottomFeet:0,topFeet:20}})
 const before=structuredClone(snapshot.state)
 let count=0
 const result=await settleDnd5eTempleMovementEntries({state:snapshot.state,map,events,isCurrent:()=>true,
  roll:async request=>({d20:19-request.requirement.modifier,d20Second:19-request.requirement.modifier}),
  rollEffectDice:async recipe=>{count++;expect(recipe.sides).toBe(4);return [4]}})
 expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(count).toBe(1)
 expect(result.state.combatants.imp.position).toEqual({x:75,y:125})
 expect(result.events.some(event=>event.type==='moved')).toBe(false)
 expect(result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',success:false}))
 expect(snapshot.state).toEqual(before)
})

it.each(['cancel','invalid','stale'] as const)('does not commit a portal save when effect dice are %s',async mode=>{
 const source=fixture('teleport'),destination=fixture('teleport')
 source.snapshot.state.mapId='source';source.snapshot.state.companionScene!.map.id='source'
 source.snapshot.state.companionScene!.geometry!.mapId='source'
 const before=structuredClone(source.snapshot.state)
 const event={...(destination.events[0] as Extract<Dnd5eCombatEvent,{type:'moved'}>),fromMapId:'source',from:{x:125,y:125}}
 let current=true
 const result=await settleDnd5eTemplePortalEntry({state:source.snapshot.state,destinationScene:destination.snapshot.state.companionScene!,event,
  isCurrent:()=>current,roll:async()=>({d20:20,d20Second:20}),rollEffectDice:async()=>{
   if(mode==='stale')current=false
   return mode==='cancel'?undefined:mode==='invalid'?[5]:[1]
  }})
 expect(result).toMatchObject({ok:false,reason:mode==='stale'?'temple-entry-authority-changed':`temple-entry-effect-dice-${mode==='invalid'?'invalid-dice':'cancelled'}`})
 expect(source.snapshot.state).toEqual(before)
})

it.each([true,false])('preflights a portal against destination geometry while preserving source scene and position (%s)',async allowed=>{
 const source=fixture('teleport',75),destination=fixture('teleport')
 source.map.id='source';source.snapshot.state.mapId='source'
 source.snapshot.state.companionScene!.map.id='source'
 source.snapshot.state.companionScene!.geometry=createEmptyMapGeometry('source')
 source.snapshot.state.combatants.imp.position={x:125,y:125}
 const before=structuredClone(source.snapshot.state)
 const event={...(destination.events[0] as Extract<Dnd5eCombatEvent,{type:'moved'}>),fromMapId:'source',from:{x:125,y:125}}
 let count=0
 const result=await settleDnd5eTemplePortalEntry({state:source.snapshot.state,destinationScene:destination.snapshot.state.companionScene!,event,
  isCurrent:()=>true,roll:async request=>{count++;expect(request.state.mapId).toBe('source');expect(request.requirement.mode).toBe('advantage');return {d20:allowed?20:1,d20Second:allowed?20:1}}})
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(count).toBe(1);expect(result.allowed).toBe(allowed)
 expect(result.state.mapId).toBe('source');expect(result.state.companionScene).toEqual(before.companionScene)
 expect(result.state.combatants.imp.position).toEqual({x:125,y:125})
 expect(result.events.some(event=>event.type==='moved')).toBe(false)
 expect(source.snapshot.state).toEqual(before)
 if(!allowed){
  const retry=await settleDnd5eTemplePortalEntry({state:JSON.parse(JSON.stringify(result.state)),destinationScene:destination.snapshot.state.companionScene!,event,
   isCurrent:()=>true,roll:async()=>{throw Error('Denied entry must not reroll')}})
  expect(retry.ok).toBe(true);if(retry.ok)expect(retry.allowed).toBe(false)
 }
})

it.each(['cancel','stale','mismatch'] as const)('rejects portal %s without mutating source state',async mode=>{
 const {snapshot,events}=fixture('teleport',75),before=structuredClone(snapshot.state)
 const event={...(events[0] as Extract<Dnd5eCombatEvent,{type:'moved'}>),to:{x:125,y:125}}
 const destination=structuredClone(snapshot.state.companionScene!)
 if(mode==='mismatch')event.toMapId='unknown'
 let current=true
 const result=await settleDnd5eTemplePortalEntry({state:snapshot.state,destinationScene:destination,event,isCurrent:()=>current,
  roll:async()=>{if(mode==='stale')current=false;return mode==='cancel'?undefined:{d20:20,d20Second:20}}})
 expect(result.ok).toBe(false);expect(snapshot.state).toEqual(before)
})

it.each([75,125,225])('requires destination context for cross-map arrival at x=%s before any no-ward shortcut',async x=>{
 const {map,snapshot,events}=fixture('teleport',x)
 const moved=events[0] as Extract<Dnd5eCombatEvent,{type:'moved'}>
 moved.fromMapId='other-map';moved.from={x,y:125}
 const before=structuredClone(snapshot.state)
 const result=await settleDnd5eTempleMovementEntries({state:snapshot.state,map,events,isCurrent:()=>true,
  roll:async()=>{throw Error('Unverified destination must not request dice')}})
 expect(result).toEqual({ok:false,reason:'temple-cross-map-entry-context-required'})
 expect(snapshot.state).toEqual(before)
})

it('treats matching coordinates on another map as outside the destination temple',()=>{
 const {snapshot}=fixture('teleport')
 const actor=snapshot.state.combatants.imp
 actor.position={x:125,y:125}
 expect(dnd5eTempleEntryRequirements(snapshot.state,actor,{x:125,y:125},0,undefined,'teleport')).toHaveLength(0)
 expect(dnd5eTempleEntryRequirements(snapshot.state,actor,{x:125,y:125},0,undefined,'teleport','other-map')).toEqual([
  expect.objectContaining({effectId:'temple-entry:temple-transport:temple',dc:18,denied:false})])
 expect(dnd5eTempleEntryRequirements(snapshot.state,actor,{x:225,y:125},0,undefined,'teleport','other-map')).toHaveLength(0)
})

it.each([true,false])('resolves cross-map temple saves using destination ward identity (allowed %s)',allowed=>{
 // Start with the traveler's pre-entry effects, not effects derived by spawning
 // inside the destination ward. The source map happens to use the same coordinates.
 const {snapshot}=fixture('teleport',75)
 snapshot.state.combatants.imp.position={x:125,y:125}
 const before=structuredClone(snapshot.state)
 const action={type:'temple-entry-attempt' as const,actorId:'imp',to:{x:125,y:125},toElevationFeet:0,distance:1,
  transportMode:'teleport' as const,originMapId:'other-map',boundarySavingThrows:[{
   effectId:'temple-entry:temple-transport:temple',d20:allowed?20:1,d20Second:allowed?20:1}]}
 const result=resolveDnd5eHeadlessAction(snapshot.state,action)
 if(!result.ok)throw Error(result.reason)
 expect(result.movementBlocked).toBe(allowed?undefined:'saving-throw')
 expect(result.state.combatants.imp.classState.activeEffects?.some(effect=>effect.source.rulesId==='temple-entry:temple-transport:temple')??false).toBe(!allowed)
 expect(result.events.filter(event=>event.type==='saving-throw-resolved')).toHaveLength(1)
 expect(result.events.some(event=>event.type==='moved')).toBe(false)
 if(!allowed){
  const retry=resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(result.state)),{...action,boundarySavingThrows:[]})
  expect(retry.ok).toBe(true);if(retry.ok)expect(retry.movementBlocked).toBe('saving-throw')
  expect(retry.events.some(event=>event.type==='saving-throw-resolved')).toBe(false)
 }
 expect(snapshot.state).toEqual(before)
})

it.each([true,false])('checks actual feature map-handoff teleport before publication (allowed %s)',async allowed=>{
 const {map,snapshot}=fixture('teleport')
 const before={...map,tokens:map.tokens.map(token=>({...token,x:75}))}
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'test-step',name:'Test step',activation:{kind:'action'},
  automation:automationCapabilityFromLegacyStatus('full'),target:{kind:'self'},outcomes:[]}
 const movement={kind:'move' as const,operationId:'step',targetId:'imp',mode:'teleport' as const,distanceFeet:30}
 const applied=applyDnd5eActivityMapHandoffsV1({map:before,activity,packageId:'test.temple',actionId:'step',actorId:'imp',round:1,
  handoffs:{movements:[movement],summons:[],persistentAreas:[],invocations:[]},
  selection:{movementCellsByOperationId:{step:{col:2,row:2}}}})
 expect(applied.ok).toBe(true);if(!applied.ok)throw Error(applied.reason)
 const events=dnd5eActivityMapMovementEvents({before,after:applied.map,actorId:'imp',activityId:activity.id,movements:[movement]})
 const result=await settleDnd5eTempleMovementEntries({state:snapshot.state,map:applied.map,events,isCurrent:()=>true,
  roll:async()=>({d20:allowed?20:1,d20Second:allowed?20:1})})
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 const application=planDnd5eMapResultApplication({state:result.state,map:applied.map,characters:[],
  characterIdByCombatantId:snapshot.characterIdByCombatantId,events:result.events})
 expect(application.map.tokens[0].x).toBe(allowed?125:75)
 expect(result.events.some(event=>event.type==='moved')).toBe(allowed)
 expect(application.map.tokens[0].dnd5eCombatState?.activeEffects?.some(effect=>effect.definitionId==='temple-of-the-gods:entry-denied')??false).toBe(!allowed)
 expect(before.tokens[0].x).toBe(75)
})
function fixture(mode:'forced'|'teleport',toX=125){
 const map:BattleMap={id:'temple-transport',name:'Temple',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'imp',poolId:'srd-5.1:imp',type:'enemy',label:'Imp',x:toX,y:125,size:1,emoji:'',color:'',hp:10,maxHp:10}]}
 const geometry=createEmptyMapGeometry(map.id)
 geometry.structureLifetimes=[{id:'temple',casterId:'builder',createdWorldMinute:0,expiresWorldMinute:1440,entityIds:[],replacementGroup:'temple-of-the-gods',
  objectBoundary:{points:[{x:100,y:100},{x:200,y:100},{x:200,y:200},{x:100,y:200}],bottomFeet:0,topFeet:20},
  templeWard:{hostileCreatureTypes:['fiend'],saveDc:18,healingBonus:5,lighting:'none'}}]
 const snapshot=createDnd5eMapCombatSnapshot({map,geometry,characters:[],combatId:map.id,worldMinute:100,
  initiativeOrder:[{tokenId:'imp',roll:20,label:'Imp',emoji:'',color:''}]})
 snapshot.state.active=false
 const event:Dnd5eCombatEvent={type:'moved',actorId:'imp',fromMapId:map.id,toMapId:map.id,from:{x:75,y:125},to:{x:toX,y:125},
  fromElevationFeet:0,toElevationFeet:0,distance:(toX-75)/10,movementKind:mode}
 return {map,snapshot,events:[event]}
}
it.each([true,false])('preflights a monster push without moving before attack commit (allowed %s)',async success=>{
 const {map,snapshot}=fixture('forced')
 snapshot.state.combatants.imp.position={x:75,y:125}
 const before=structuredClone(snapshot.state)
 const result=await prepareDnd5eTempleForcedMovement({state:snapshot.state,map,targetId:'imp',to:{x:125,y:125},distanceFeet:5,
  isCurrent:()=>true,roll:async()=>({d20:success?20:1,d20Second:success?20:1})})
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(result.allowed).toBe(success)
 expect(result.state.combatants.imp.position).toEqual({x:75,y:125})
 expect(result.events).not.toContainEqual(expect.objectContaining({type:'moved'}))
 expect(result.state.combatants.imp.classState.activeEffects?.some(effect=>effect.definitionId==='temple-of-the-gods:entry-denied')??false).toBe(!success)
 expect(snapshot.state).toEqual(before)
})
it.each(['forced','teleport'] as const)('settles %s failures once, persists denial, and prevents false arrival events',async mode=>{
 const {map,snapshot,events}=fixture(mode),before=structuredClone(snapshot.state)
 let rolls=0
 const result=await settleDnd5eTempleMovementEntries({state:snapshot.state,map,events,isCurrent:()=>true,roll:async request=>{
  rolls++;expect(request.requirement.mode).toBe('advantage');return {d20:1,d20Second:1}
 }})
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(rolls).toBe(1);expect(result.state.combatants.imp.position).toEqual({x:75,y:125})
 expect(result.events.some(event=>event.type==='moved')).toBe(false)
 expect(result.state.combatants.imp.turn).toMatchObject(before.combatants.imp.turn)
 expect(result.state.combatants.imp.turn.movementSpent??0).toBe(before.combatants.imp.turn.movementSpent??0)
 const application=planDnd5eMapResultApplication({state:result.state,map,characters:[],characterIdByCombatantId:snapshot.characterIdByCombatantId,events:result.events})
 expect(application.map.tokens[0].dnd5eCombatState?.activeEffects).toContainEqual(expect.objectContaining({definitionId:'temple-of-the-gods:entry-denied',duration:expect.objectContaining({remainingRounds:14400})}))
 const retry=await settleDnd5eTempleMovementEntries({state:JSON.parse(JSON.stringify(result.state)),map,events,isCurrent:()=>true,
  roll:async()=>{throw Error('denied entry must not reroll')}})
 expect(retry.ok).toBe(true);if(retry.ok)expect(retry.state.combatants.imp.position).toEqual({x:75,y:125})
 expect(snapshot.state).toEqual(before)
})
it.each(['forced','teleport'] as const)('allows a restrained creature to enter by %s after a successful save without movement cost',async mode=>{
 const {map,snapshot,events}=fixture(mode)
 snapshot.state.combatants.imp.conditions=['restrained']
 const turn=structuredClone(snapshot.state.combatants.imp.turn)
 const result=await settleDnd5eTempleMovementEntries({state:snapshot.state,map,events,isCurrent:()=>true,roll:async()=>({d20:20,d20Second:20})})
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(result.state.combatants.imp.position).toEqual({x:125,y:125});expect(result.state.combatants.imp.turn).toEqual(turn)
 expect(result.events.filter(event=>event.type==='moved')).toHaveLength(1)
})
it('does not treat teleport travel as passing through intervening temples, but does test a physical push',async()=>{
 for(const mode of ['teleport','forced'] as const){
  const {map,snapshot,events}=fixture(mode,225);let rolls=0
  const result=await settleDnd5eTempleMovementEntries({state:snapshot.state,map,events,isCurrent:()=>true,roll:async()=>{rolls++;return {d20:20,d20Second:20}}})
  expect(result.ok).toBe(true);expect(rolls).toBe(mode==='teleport'?0:1)
 }
})
it('returns no commit on cancellation or stale authority',async()=>{
 const {map,snapshot,events}=fixture('teleport'),before=structuredClone(snapshot.state)
 expect(await settleDnd5eTempleMovementEntries({state:snapshot.state,map,events,isCurrent:()=>true,roll:async()=>undefined})).toMatchObject({ok:false,reason:'temple-entry-save-cancelled'})
 let current=true
 expect(await settleDnd5eTempleMovementEntries({state:snapshot.state,map,events,isCurrent:()=>current,roll:async()=>{current=false;return {d20:20,d20Second:20}}})).toMatchObject({ok:false,reason:'temple-entry-authority-changed'})
 expect(snapshot.state).toEqual(before)
})

it.each([true,false])('settles chained movements in event order (entry succeeds: %s)',async succeeds=>{
 const {map,snapshot,events}=fixture('teleport',225)
 const first={...events[0],to:{x:125,y:125},toElevationFeet:5} as Dnd5eCombatEvent
 const second={...events[0],from:{x:125,y:125},fromElevationFeet:5,to:{x:225,y:125},toElevationFeet:10} as Dnd5eCombatEvent
 const before=structuredClone(snapshot.state)
 let rolls=0
 const result=await settleDnd5eTempleMovementEntries({state:snapshot.state,map,events:[first,second],isCurrent:()=>true,
  roll:async()=>{rolls++;return {d20:succeeds?20:1,d20Second:succeeds?20:1}}})
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(rolls).toBe(1)
 expect(result.state.combatants.imp.position).toEqual({x:succeeds?225:75,y:125})
 expect(result.state.combatants.imp.elevationFeet).toBe(succeeds?10:0)
 expect(result.events.filter(event=>event.type==='moved')).toEqual(succeeds?[first,second]:[])
 expect(snapshot.state).toEqual(before)
})

// Trigger handoffs must keep their already committed damage/resources while
// publishing only movement that passed entry authority.
it.each([true,false])('settles triggered teleport before arrival discovery (allowed %s)',async allowed=>{
 const {map,snapshot}=fixture('teleport')
 const before={...map,tokens:map.tokens.map(token=>({...token,x:75}))}
 snapshot.state.combatants.imp.position={x:75,y:125}
 snapshot.state.combatants.imp.currentHp=8
 const original=structuredClone(snapshot.state)
 const result=await settleDnd5eTempleTriggeredMovement({before,after:map,state:snapshot.state,
  actorId:'imp',activityId:'trigger-step',events:[],
  movements:[{kind:'move',operationId:'step',targetId:'imp',mode:'teleport',distanceFeet:30}],
  harmfulMovementTargetIds:['imp'],isCurrent:()=>true,
  roll:async()=>({d20:allowed?20:1,d20Second:allowed?20:1})})
 expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(result.map.tokens[0].x).toBe(allowed?125:75)
 expect(result.state.combatants.imp.currentHp).toBe(8)
 expect(result.state.combatants.imp.turn).toMatchObject(original.combatants.imp.turn)
 expect(result.state.combatants.imp.turn.movementSpent??0).toBe(original.combatants.imp.turn.movementSpent??0)
 expect(result.events.filter(event=>event.type==='moved')).toHaveLength(allowed?1:0)
 expect(result.events.filter(event=>event.type==='saving-throw-resolved')).toHaveLength(1)
 const application=planDnd5eMapResultApplication({state:result.state,map:result.map,characters:[],
  characterIdByCombatantId:snapshot.characterIdByCombatantId,events:result.events})
 expect(application.map.tokens[0].hp).toBe(8)
 expect(application.map.tokens[0].dnd5eCombatState?.activeEffects?.some(effect=>effect.definitionId==='temple-of-the-gods:entry-denied')??false).toBe(!allowed)
 expect(snapshot.state).toEqual(original)
 expect(map.tokens[0].x).toBe(125)
})
it.each(['cancel','stale'] as const)('does not publish triggered movement when save is %s',async mode=>{
 const {map,snapshot}=fixture('teleport'),original=structuredClone(snapshot.state)
 const before={...map,tokens:map.tokens.map(token=>({...token,x:75}))}
 let current=true
 const result=await settleDnd5eTempleTriggeredMovement({before,after:map,state:snapshot.state,
  actorId:'imp',activityId:'trigger-step',events:[],
  movements:[{kind:'move',operationId:'step',targetId:'imp',mode:'teleport',distanceFeet:30}],
  isCurrent:()=>current,roll:async()=>{if(mode==='stale')current=false;return mode==='cancel'?undefined:{d20:20,d20Second:20}}})
 expect(result).toMatchObject({ok:false,reason:mode==='cancel'?'temple-entry-save-cancelled':'temple-entry-authority-changed'})
 expect(snapshot.state).toEqual(original)
 expect(before.tokens[0].x).toBe(75)
})

it.each([true,false])('routes a registered turn-start activity through actual map handoff and temple settlement (%s)',async allowed=>{
 const {map,snapshot}=fixture('teleport')
 const before={...map,tokens:map.tokens.map(token=>({...token,x:75}))}
 const packageId='test.temple.trigger'
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'trigger-step',name:'Triggered step',
  legacySource:{kind:'feature',id:'step'},activation:{kind:'reaction'},target:{kind:'self'},
  consumption:[{kind:'action-economy',economy:'reaction',amount:1,consumeOn:'resolve'}],
  invocation:{kind:'triggered',event:'turn-start',confirmation:'automatic'},
  automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'step',when:{kind:'always'},operations:[
   {id:'step',kind:'move',target:'actor',mode:'teleport',distanceFeet:{kind:'constant',value:30}}]}]}
 const registration=registerDnd5eActivityPackage({packageId,packageVersion:'1.0.0',activities:[activity]})
 try{
  snapshot.state.active=true
  snapshot.state.combatants.imp.position={x:75,y:125}
  snapshot.state.combatants.imp.pluginFeatureIds=[`${packageId}:step`]
  let finalMap=before,entries=0
  const result=await settleDnd5eActivityTriggerWindowsV1({state:snapshot.state,
   events:[{type:'turn-started',actorId:'imp',round:1}],eventBatchId:'temple-trigger-start',combatRevision:1,
   confirm:async()=>true,roll:async()=>{throw Error('Unexpected activity dice')},
   settleMapHandoffs:async request=>{
    const handoffs=request.committed.activityHandoffs!
    const applied=applyDnd5eActivityMapHandoffsV1({map:before,activity,packageId,actionId:request.receiptId,
     actorId:'imp',round:1,handoffs,selection:{movementCellsByOperationId:{step:{col:2,row:2}}}})
    if(!applied.ok)return applied
    const entry=await settleDnd5eTempleTriggeredMovement({before,after:applied.map,state:request.committed.state,
     actorId:'imp',activityId:activity.id,movements:handoffs.movements,events:request.committed.events,
     isCurrent:()=>true,roll:async()=>{entries++;return {d20:allowed?20:1,d20Second:allowed?20:1}}})
    if(!entry.ok)return entry
    request.committed.state=entry.state;request.committed.events=entry.events;finalMap=entry.map
    return {ok:true}
   }})
  expect(entries,JSON.stringify(result.diagnostics)).toBe(1)
  expect(finalMap.tokens[0].x).toBe(allowed?125:75)
  expect(result.state.combatants.imp.turn.reactionAvailable).toBe(false)
  expect(result.state.combatants.imp.position.x).toBe(allowed?125:75)
  expect(result.events.filter(event=>event.type==='moved')).toHaveLength(allowed?1:0)
  expect(result.diagnostics).toContainEqual(expect.objectContaining({activityId:activity.id,status:'resolved'}))
 }finally{registration.dispose()}
})

it.each([true,false])('gates an actual shove after its contest without refunding its action (%s)',async allowed=>{
 const original=fixture('forced')
 const map={...original.map,tokens:[{...original.map.tokens[0],id:'pusher',poolId:'srd-5.1:ogre',x:25},
  {...original.map.tokens[0],x:75}]}
 const snapshot=createDnd5eMapCombatSnapshot({map,geometry:original.snapshot.state.companionScene!.geometry!,characters:[],
  combatId:map.id,worldMinute:100,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
 snapshot.state.combatants.pusher.controller='player'
 const shoved=resolveDnd5eHeadlessAction(snapshot.state,{type:'shove',actorId:'pusher',targetId:'imp',
  actorD20:20,targetD20:1,targetDefense:'acrobatics',outcome:'push',pushTo:{x:125,y:125}})
 expect(shoved.ok,JSON.stringify(shoved)).toBe(true);if(!shoved.ok)throw Error(shoved.reason)
 expect(shoved.events).toContainEqual(expect.objectContaining({type:'contest-resolved',success:true}))
 const gate=await settleDnd5eTempleMovementEntries({state:shoved.state,map,
  events:shoved.events.map(event=>event.type==='moved'?{...event,movementKind:'forced' as const,fromElevationFeet:0,toElevationFeet:0}:event),
  isCurrent:()=>true,roll:async()=>({d20:allowed?20:1,d20Second:allowed?20:1})})
 expect(gate.ok,JSON.stringify(gate)).toBe(true);if(!gate.ok)throw Error(gate.reason)
 expect(gate.state.combatants.pusher.turn.actionAvailable).toBe(false)
 expect(gate.state.combatants.imp.position.x).toBe(allowed?125:75)
 expect(gate.events.filter(event=>event.type==='moved')).toHaveLength(allowed?1:0)
 expect(gate.state.combatants.imp.currentHp).toBe(10)
 expect(gate.events.filter(event=>event.type==='contest-resolved')).toHaveLength(1)
})
it('lands an accepted displacement once and rejects invalid fall dice without mutating the source',()=>{
 const {snapshot}=fixture('forced')
 const actor=snapshot.state.combatants.imp
 actor.elevationFeet=20;actor.groundElevationFeet=20;actor.currentHp=10;actor.movementSpeeds={walk:20}
 const before=structuredClone(snapshot.state)
 const invalid=resolveDnd5eForcedMovementLanding({state:snapshot.state,targetId:'imp',toElevationFeet:0,toGroundElevationFeet:0,fallingDamageRolls:[7,1]})
 expect(invalid.ok).toBe(false);expect(snapshot.state).toEqual(before)
 const landed=resolveDnd5eForcedMovementLanding({state:snapshot.state,targetId:'imp',toElevationFeet:0,toGroundElevationFeet:0,fallingDamageRolls:[2,3]})
 expect(landed.ok,JSON.stringify(landed)).toBe(true);if(!landed.ok)throw Error(landed.reason)
 expect(landed.state.combatants.imp.currentHp).toBe(5)
 expect(landed.state.combatants.imp.elevationFeet).toBe(0)
 expect(landed.events.filter(event=>event.type==='damage-applied')).toHaveLength(1)
 expect(snapshot.state).toEqual(before)
})

it.each([true,false])('gates a source-linked reel without dropping the tendril (%s)',async allowed=>{
 const monster=structuredClone(getDnd5eSrdMonster('srd-5.1:roper')!)
 monster.id='test:temple-reel';monster.slug='temple-reel';monster.size='中型'
 monster.actions.find(a=>a.id==='multiattack')!.sequence=['reel','bite']
 const dispose=registerDnd5ePluginMonsterCatalogEntry(monster)
 try{
  const base=fixture('forced',75),map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'source',poolId:monster.id,x:175},base.map.tokens[0]]}
  const snapshot=createDnd5eMapCombatSnapshot({map,geometry:base.snapshot.state.companionScene!.geometry!,characters:[],combatId:map.id,worldMinute:100,
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
  const grabbed=resolveDnd5eHeadlessAction(snapshot.state,{type:'monster-action',actorId:'source',actionId:'tendril',
   rolls:[{targetId:'imp',d20:15,damageRolls:[],onHitEffectRolls:[{effectId:'tendril-grapple'}]}]})
  expect(grabbed.ok,JSON.stringify(grabbed)).toBe(true);if(!grabbed.ok)throw Error(grabbed.reason)
  grabbed.state.combatants.source.turn.actionAvailable=true
  const before=structuredClone(grabbed.state)
  const action:Extract<Dnd5eAction,{type:'monster-multiattack-composite'}>={type:'monster-multiattack-composite',schemaVersion:1,
   actorId:'source',actionId:'multiattack',steps:[{kind:'special',actionId:'reel',stageForcedMovement:true,
    forcedMovements:[{targetId:'imp',to:{x:125,y:125},distanceFeet:5}]}]}
  const preview=previewDnd5eMonsterCompositePrefix(grabbed.state,action,'reel:temple')
  expect(preview.ok,JSON.stringify(preview)).toBe(true)
  const result=await collectDnd5eCompositeMovementStep({state:grabbed.state,action,transactionId:'reel:temple',isCurrent:()=>true,
   roll:async()=>({d20:allowed?20:1,d20Second:allowed?20:1}),rollFallingDamage:async()=>{throw Error('No cliff')}})
  expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
  expect(result.prefix.state.combatants.imp.position.x).toBe(allowed?125:75)
  expect(result.prefix.state.combatants.imp.classState.activeEffects?.filter(e=>e.relation?.sourceActorId==='source').length).toBeGreaterThan(0)
  const completed=resolveDnd5eHeadlessAction(grabbed.state,{...action,steps:[result.step,{kind:'weapon',actionId:'bite',roll:{targetId:'imp',d20:1,damageRolls:[]}}]})
  expect(completed.ok).toBe(allowed)
  if(!allowed)expect(completed).toMatchObject({reason:'invalid-target'})
  expect(grabbed.state).toEqual(before)
 }finally{dispose()}
})

it.each([true,false])('defers throw release, collision and prone until temple entry is accepted (%s)',async allowed=>{
 const monster=structuredClone(getDnd5eSrdMonster('srd-5.1:kraken')!)
 monster.id='test:temple-throw';monster.slug='temple-throw';monster.size='中型'
 const parent=monster.actions.find(a=>a.id==='multiattack-flings')!;parent.sequence=['fling']
 const dispose=registerDnd5ePluginMonsterCatalogEntry(monster)
 try{
  const base=fixture('forced',75),map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'source',poolId:monster.id,x:25},
   {...base.map.tokens[0],hp:200,maxHp:200}]}
  const snapshot=createDnd5eMapCombatSnapshot({map,geometry:base.snapshot.state.companionScene!.geometry!,characters:[],combatId:map.id,worldMinute:100,
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
  const tentacle=monster.actions.find(a=>a.id==='tentacle')!.attack!
  const grabbed=resolveDnd5eHeadlessAction(snapshot.state,{type:'monster-action',actorId:'source',actionId:'tentacle',
   rolls:[{targetId:'imp',d20:15,damageRolls:tentacle.damage.map(d=>Array(d.count).fill(1)),onHitEffectRolls:[{effectId:'tentacle-grapple'}]}]})
  expect(grabbed.ok,JSON.stringify(grabbed)).toBe(true);if(!grabbed.ok)throw Error(grabbed.reason)
  grabbed.state.combatants.source.turn.actionAvailable=true
  const before=structuredClone(grabbed.state),hp=before.combatants.imp.currentHp
  const action:Extract<Dnd5eAction,{type:'monster-multiattack-composite'}>={type:'monster-multiattack-composite',schemaVersion:1,
   actorId:'source',actionId:parent.id,steps:[{kind:'special',actionId:'fling',targetId:'imp',stageForcedMovement:true,damageRolls:[4],
    forcedMovements:[{targetId:'imp',to:{x:175,y:125},distanceFeet:10}]}]}
  const preview=previewDnd5eMonsterCompositePrefix(grabbed.state,action,'throw:temple')
  expect(preview.ok,JSON.stringify(preview)).toBe(true);if(!preview.ok)throw Error(preview.reason)
  expect(preview.state.combatants.imp.currentHp).toBe(hp)
  expect(preview.state.combatants.imp.classState.activeEffects?.some(e=>e.relation?.sourceActorId==='source')).toBe(true)
  const result=await collectDnd5eCompositeMovementStep({state:grabbed.state,action,transactionId:'throw:temple',isCurrent:()=>true,
   roll:async()=>({d20:allowed?20:1,d20Second:allowed?20:1}),rollFallingDamage:async()=>{throw Error('No cliff')}})
  expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
  const completed=resolveDnd5eHeadlessAction(grabbed.state,{...action,steps:[result.step]})
  expect(completed.ok,JSON.stringify(completed)).toBe(true);if(!completed.ok)throw Error(completed.reason)
  const target=completed.state.combatants.imp
  expect(target.position.x).toBe(allowed?175:75)
  expect(target.currentHp).toBe(allowed?hp-4:hp)
  expect(target.classState.activeEffects?.some(e=>e.relation?.sourceActorId==='source')??false).toBe(!allowed)
  expect(target.classState.activeEffects?.some(e=>e.standardCondition==='prone')??false).toBe(allowed)
  expect(completed.state.combatants.source.turn.actionAvailable).toBe(false)
  expect(grabbed.state).toEqual(before)
 }finally{dispose()}
})

it('replays one feather fall for multiple accepted targets and rejects forged targets',()=>{
 const base=fixture('forced',75)
 const map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],poolId:'srd-5.1:dretch',x:125,elevationFeet:20},
  {...base.map.tokens[0],id:'second',poolId:'srd-5.1:dretch',x:125,y:175,elevationFeet:20}]}
 const geometry=base.snapshot.state.companionScene!.geometry!;geometry.structureLifetimes=[]
 geometry.obstacles.push({id:'ledge',kind:'obstacle',label:'Ledge',cover:'none',
  points:[{x:0,y:0},{x:100,y:0},{x:100,y:500},{x:0,y:500}],baseHeightFeet:0,heightFeet:0,
  terrainElevationFeet:20,terrainRegion:true,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
 const snapshot=createDnd5eMapCombatSnapshot({map,geometry,characters:[],combatId:map.id,worldMinute:100,
  initiativeOrder:map.tokens.map((t,i)=>({tokenId:t.id,roll:20-i,label:t.id,emoji:'',color:''}))})
 const caster=snapshot.state.combatants.imp
 caster.classId='wizard';caster.classLevels={wizard:5};caster.classSelections={'spell-prepared':['feather-fall']}
 caster.classResources={'dnd5e-spell-slot-1':{current:1,max:1}}
 const events:Dnd5eCombatEvent[]=map.tokens.map(t=>({type:'moved',actorId:t.id,from:{x:75,y:t.y},to:{x:125,y:t.y},distance:5,
  movementKind:'forced',fromElevationFeet:20,toElevationFeet:20,fromMapId:map.id,toMapId:map.id}))
 const before=structuredClone(snapshot.state)
 const input={state:snapshot.state,map,events,entryReplays:[],landings:[{eventIndex:0},{eventIndex:1}],
  fallReactions:[{casterId:'imp',targetIds:['imp','second']}]}
 const result=replayDnd5eTempleMovementEntries(input)
 expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(result.events.filter(e=>e.type==='spell-cast')).toHaveLength(1)
 expect(result.state.combatants.imp.classResources['dnd5e-spell-slot-1'].current).toBe(0)
 for(const id of ['imp','second']){
  expect(result.state.combatants[id].currentHp).toBe(10)
  expect(result.state.combatants[id].elevationFeet).toBe(20)
  expect(result.state.combatants[id].classState.activeEffects?.some(e=>e.modifiers?.controlledDescent)).toBe(true)
 }
 expect(replayDnd5eTempleMovementEntries({...input,fallReactions:[{casterId:'imp',targetIds:['missing']}]}).ok).toBe(false)
 expect(replayDnd5eTempleMovementEntries({...input,fallReactions:[...input.fallReactions,...input.fallReactions]}).ok).toBe(false)
 expect(snapshot.state).toEqual(before)
})

it('rejects direct reel across temple boundary without an entry receipt',()=>{
 const monster=structuredClone(getDnd5eSrdMonster('srd-5.1:roper')!)
 monster.id='test:temple-reel';monster.slug='temple-reel';monster.size='中型'
 monster.actions.find(a=>a.id==='multiattack')!.sequence=['reel','bite']
 const dispose=registerDnd5ePluginMonsterCatalogEntry(monster)
 try{
  const base=fixture('forced',75),map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'source',poolId:monster.id,x:175},base.map.tokens[0]]}
  const snapshot=createDnd5eMapCombatSnapshot({map,geometry:base.snapshot.state.companionScene!.geometry!,characters:[],combatId:map.id,worldMinute:100,
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
  const grabbed=resolveDnd5eHeadlessAction(snapshot.state,{type:'monster-action',actorId:'source',actionId:'tendril',
   rolls:[{targetId:'imp',d20:15,damageRolls:[],onHitEffectRolls:[{effectId:'tendril-grapple'}]}]})
  expect(grabbed.ok,JSON.stringify(grabbed)).toBe(true);if(!grabbed.ok)throw Error(grabbed.reason)
  grabbed.state.combatants.source.turn.actionAvailable=true
  const before=structuredClone(grabbed.state)
  const result=resolveDnd5eHeadlessAction(grabbed.state,{type:'monster-special-action',actorId:'source',actionId:'reel',forcedMovements:[{targetId:'imp',to:{x:125,y:125},distanceFeet:5}]})
  expect(result.ok,JSON.stringify({ok:result.ok,position:result.state.combatants.imp.position,hp:result.state.combatants.imp.currentHp})).toBe(false)
  expect(grabbed.state).toEqual(before)
 }finally{dispose()}
})

it('rejects direct throw across temple boundary without an entry receipt',()=>{
 const monster=structuredClone(getDnd5eSrdMonster('srd-5.1:kraken')!)
 monster.id='test:temple-throw';monster.slug='temple-throw';monster.size='中型'
 const parent=monster.actions.find(a=>a.id==='multiattack-flings')!;parent.sequence=['fling']
 const dispose=registerDnd5ePluginMonsterCatalogEntry(monster)
 try{
  const base=fixture('forced',75),map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'source',poolId:monster.id,x:25},
   {...base.map.tokens[0],hp:200,maxHp:200}]}
  const snapshot=createDnd5eMapCombatSnapshot({map,geometry:base.snapshot.state.companionScene!.geometry!,characters:[],combatId:map.id,worldMinute:100,
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
  const tentacle=monster.actions.find(a=>a.id==='tentacle')!.attack!
  const grabbed=resolveDnd5eHeadlessAction(snapshot.state,{type:'monster-action',actorId:'source',actionId:'tentacle',
   rolls:[{targetId:'imp',d20:15,damageRolls:tentacle.damage.map(d=>Array(d.count).fill(1)),onHitEffectRolls:[{effectId:'tentacle-grapple'}]}]})
  expect(grabbed.ok,JSON.stringify(grabbed)).toBe(true);if(!grabbed.ok)throw Error(grabbed.reason)
  grabbed.state.combatants.source.turn.actionAvailable=true
  const before=structuredClone(grabbed.state)
  const result=resolveDnd5eHeadlessAction(grabbed.state,{type:'monster-special-action',actorId:'source',actionId:'fling',targetId:'imp',damageRolls:[4],forcedMovements:[{targetId:'imp',to:{x:175,y:125},distanceFeet:10}]})
  expect(result.ok,JSON.stringify({ok:result.ok,position:result.state.combatants.imp.position,hp:result.state.combatants.imp.currentHp})).toBe(false)
  expect(grabbed.state).toEqual(before)
 }finally{dispose()}
})

it.each([true,false])('collects and replays direct reel temple entry (%s)',async allowed=>{
 const {collectDnd5eDirectSpecialMovement}=await import('./templeDirectMovement')
 const clock=vi.spyOn(Date,'now').mockReturnValue(1700000000000)
 const monster=structuredClone(getDnd5eSrdMonster('srd-5.1:roper')!)
 monster.id='test:temple-reel';monster.slug='temple-reel';monster.size='中型'
 monster.actions.find(a=>a.id==='multiattack')!.sequence=['reel','bite']
 const dispose=registerDnd5ePluginMonsterCatalogEntry(monster)
 try{
  const base=fixture('forced',75),map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'source',poolId:monster.id,x:175},base.map.tokens[0]]}
  const snapshot=createDnd5eMapCombatSnapshot({map,geometry:base.snapshot.state.companionScene!.geometry!,characters:[],combatId:map.id,worldMinute:100,
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
  const grabbed=resolveDnd5eHeadlessAction(snapshot.state,{type:'monster-action',actorId:'source',actionId:'tendril',
   rolls:[{targetId:'imp',d20:15,damageRolls:[],onHitEffectRolls:[{effectId:'tendril-grapple'}]}]})
  expect(grabbed.ok,JSON.stringify(grabbed)).toBe(true);if(!grabbed.ok)throw Error(grabbed.reason)
  grabbed.state.combatants.source.turn.actionAvailable=true
  const before=structuredClone(grabbed.state)
  let rolls=0
  const action={type:'monster-special-action' as const,actorId:'source',actionId:'reel',forcedMovements:[{targetId:'imp',to:{x:125,y:125},distanceFeet:5}]}
  const result=await collectDnd5eDirectSpecialMovement({state:grabbed.state,action,transactionId:'direct-reel',isCurrent:()=>true,
   roll:async()=>{rolls++;return {d20:allowed?20:1,d20Second:allowed?20:1}},rollFallingDamage:async()=>{throw Error('No cliff')}})
  expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
  expect(result.result.state.combatants.imp.position.x).toBe(allowed?125:75)
  expect(result.result.state.combatants.imp.currentHp).toBe(before.combatants.imp.currentHp-0)
  expect(result.result.state.combatants.source.turn.actionAvailable).toBe(false)
  expect(rolls).toBe(1)
  const replay=await collectDnd5eDirectSpecialMovement({state:grabbed.state,action:JSON.parse(JSON.stringify(result.action)),transactionId:'direct-reel',isCurrent:()=>true,
   roll:async()=>{throw Error('No repeat dice')},rollFallingDamage:async()=>{throw Error('No repeat landing')}})
  expect(replay.ok).toBe(true)
  if(replay.ok)expect(replay.result.state).toEqual(result.result.state)
  expect(grabbed.state).toEqual(before)
 }finally{dispose();clock.mockRestore()}
})

it.each([true,false])('collects and replays direct throw temple entry (%s)',async allowed=>{
 const {collectDnd5eDirectSpecialMovement}=await import('./templeDirectMovement')
 const clock=vi.spyOn(Date,'now').mockReturnValue(1700000000000)
 const monster=structuredClone(getDnd5eSrdMonster('srd-5.1:kraken')!)
 monster.id='test:temple-throw';monster.slug='temple-throw';monster.size='中型'
 const parent=monster.actions.find(a=>a.id==='multiattack-flings')!;parent.sequence=['fling']
 const dispose=registerDnd5ePluginMonsterCatalogEntry(monster)
 try{
  const base=fixture('forced',75),map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'source',poolId:monster.id,x:25},
   {...base.map.tokens[0],hp:200,maxHp:200}]}
  const snapshot=createDnd5eMapCombatSnapshot({map,geometry:base.snapshot.state.companionScene!.geometry!,characters:[],combatId:map.id,worldMinute:100,
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
  const tentacle=monster.actions.find(a=>a.id==='tentacle')!.attack!
  const grabbed=resolveDnd5eHeadlessAction(snapshot.state,{type:'monster-action',actorId:'source',actionId:'tentacle',
   rolls:[{targetId:'imp',d20:15,damageRolls:tentacle.damage.map(d=>Array(d.count).fill(1)),onHitEffectRolls:[{effectId:'tentacle-grapple'}]}]})
  expect(grabbed.ok,JSON.stringify(grabbed)).toBe(true);if(!grabbed.ok)throw Error(grabbed.reason)
  grabbed.state.combatants.source.turn.actionAvailable=true
  const before=structuredClone(grabbed.state)
  let rolls=0
  const action={type:'monster-special-action' as const,actorId:'source',actionId:'fling',targetId:'imp',damageRolls:[4],forcedMovements:[{targetId:'imp',to:{x:175,y:125},distanceFeet:10}]}
  const result=await collectDnd5eDirectSpecialMovement({state:grabbed.state,action,transactionId:'direct-throw',isCurrent:()=>true,
   roll:async()=>{rolls++;return {d20:allowed?20:1,d20Second:allowed?20:1}},rollFallingDamage:async()=>{throw Error('No cliff')}})
  expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
  expect(result.result.state.combatants.imp.position.x).toBe(allowed?175:75)
  expect(result.result.state.combatants.imp.currentHp).toBe(before.combatants.imp.currentHp-(allowed?4:0))
  expect(result.result.state.combatants.source.turn.actionAvailable).toBe(false)
  expect(rolls).toBe(1)
  const replay=await collectDnd5eDirectSpecialMovement({state:grabbed.state,action:JSON.parse(JSON.stringify(result.action)),transactionId:'direct-throw',isCurrent:()=>true,
   roll:async()=>{throw Error('No repeat dice')},rollFallingDamage:async()=>{throw Error('No repeat landing')}})
  expect(replay.ok).toBe(true)
  if(replay.ok)expect(replay.result.state).toEqual(result.result.state)
  expect(grabbed.state).toEqual(before)
 }finally{dispose();clock.mockRestore()}
})

it.each([true,false])('collects and replays legendary throw temple entry (%s)',async allowed=>{
 const {collectDnd5eDirectSpecialMovement}=await import('./templeDirectMovement')
 const clock=vi.spyOn(Date,'now').mockReturnValue(1700000000000)
 const monster=structuredClone(getDnd5eSrdMonster('srd-5.1:kraken')!)
 monster.id='test:temple-throw';monster.slug='temple-throw';monster.size='中型'
 const parent=monster.actions.find(a=>a.id==='multiattack-flings')!;parent.sequence=['fling']
 const dispose=registerDnd5ePluginMonsterCatalogEntry(monster)
 try{
  const base=fixture('forced',75),map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'source',poolId:monster.id,x:25},
   {...base.map.tokens[0],hp:200,maxHp:200}]}
  const snapshot=createDnd5eMapCombatSnapshot({map,geometry:base.snapshot.state.companionScene!.geometry!,characters:[],combatId:map.id,worldMinute:100,
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
  const tentacle=monster.actions.find(a=>a.id==='tentacle')!.attack!
  const grabbed=resolveDnd5eHeadlessAction(snapshot.state,{type:'monster-action',actorId:'source',actionId:'tentacle',
   rolls:[{targetId:'imp',d20:15,damageRolls:tentacle.damage.map(d=>Array(d.count).fill(1)),onHitEffectRolls:[{effectId:'tentacle-grapple'}]}]})
  expect(grabbed.ok,JSON.stringify(grabbed)).toBe(true);if(!grabbed.ok)throw Error(grabbed.reason)
  grabbed.state.combatants.source.turn.actionAvailable=true
  grabbed.state.initiativeIndex=1
  grabbed.state.combatants.source.classState.monsterLegendaryActionPoints=3
  const before=structuredClone(grabbed.state)
  let rolls=0
  const action={type:'monster-legendary-special-action' as const,actorId:'source',actionId:'legendary-fling',targetId:'imp',damageRolls:[4],forcedMovements:[{targetId:'imp',to:{x:175,y:125},distanceFeet:10}]}
  const result=await collectDnd5eDirectSpecialMovement({state:grabbed.state,action,transactionId:'direct-throw',isCurrent:()=>true,
   roll:async()=>{rolls++;return {d20:allowed?20:1,d20Second:allowed?20:1}},rollFallingDamage:async()=>{throw Error('No cliff')}})
  expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
  expect(result.result.state.combatants.imp.position.x).toBe(allowed?175:75)
  expect(result.result.state.combatants.imp.currentHp).toBe(before.combatants.imp.currentHp-(allowed?4:0))
  expect(result.result.state.combatants.source.turn.actionAvailable).toBe(true)
  expect(result.result.state.combatants.source.classState.monsterLegendaryActionPoints).toBe(2)
  expect(rolls).toBe(1)
  const replay=await collectDnd5eDirectSpecialMovement({state:grabbed.state,action:JSON.parse(JSON.stringify(result.action)),transactionId:'direct-throw',isCurrent:()=>true,
   roll:async()=>{throw Error('No repeat dice')},rollFallingDamage:async()=>{throw Error('No repeat landing')}})
  expect(replay.ok).toBe(true)
  if(replay.ok)expect(replay.result.state).toEqual(result.result.state)
  expect(grabbed.state).toEqual(before)
 }finally{dispose();clock.mockRestore()}
})

it.each(['cancel','stale','invalid'] as const)('rejects interrupted direct reel collection (%s)',async mode=>{
 const {collectDnd5eDirectSpecialMovement}=await import('./templeDirectMovement')
 const clock=vi.spyOn(Date,'now').mockReturnValue(1700000000000)
 const monster=structuredClone(getDnd5eSrdMonster('srd-5.1:roper')!)
 monster.id='test:temple-reel';monster.slug='temple-reel';monster.size='中型'
 monster.actions.find(a=>a.id==='multiattack')!.sequence=['reel','bite']
 const dispose=registerDnd5ePluginMonsterCatalogEntry(monster)
 try{
  const base=fixture('forced',75),map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'source',poolId:monster.id,x:175},base.map.tokens[0]]}
  const snapshot=createDnd5eMapCombatSnapshot({map,geometry:base.snapshot.state.companionScene!.geometry!,characters:[],combatId:map.id,worldMinute:100,
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
  const grabbed=resolveDnd5eHeadlessAction(snapshot.state,{type:'monster-action',actorId:'source',actionId:'tendril',
   rolls:[{targetId:'imp',d20:15,damageRolls:[],onHitEffectRolls:[{effectId:'tendril-grapple'}]}]})
  expect(grabbed.ok,JSON.stringify(grabbed)).toBe(true);if(!grabbed.ok)throw Error(grabbed.reason)
  grabbed.state.combatants.source.turn.actionAvailable=true
  const before=structuredClone(grabbed.state)
  let rolls=0
  const action={type:'monster-special-action' as const,actorId:'source',actionId:'reel',forcedMovements:[{targetId:'imp',to:{x:125,y:125},distanceFeet:5}]}
  let current=true
  const result=await collectDnd5eDirectSpecialMovement({state:grabbed.state,action,transactionId:'direct-reel-interrupt',isCurrent:()=>current,
   roll:async()=>{rolls++;if(mode==='stale')current=false;return mode==='cancel'?undefined:{d20:mode==='invalid'?21:20,d20Second:20}},rollFallingDamage:async()=>{throw Error('No cliff')}})
  expect(result.ok).toBe(false)
  expect(rolls).toBe(1)
  expect(grabbed.state).toEqual(before)
 }finally{dispose();clock.mockRestore()}
})

it.each(['allowed','denied','cancel','invalid','stale','feather'] as const)('settles direct throw cliff after entry (%s)',async mode=>{
 const {collectDnd5eDirectSpecialMovement}=await import('./templeDirectMovement')
 const clock=vi.spyOn(Date,'now').mockReturnValue(1700000000000)
 const monster=structuredClone(getDnd5eSrdMonster('srd-5.1:kraken')!)
 monster.id='test:temple-throw';monster.slug='temple-throw';monster.size='中型'
 const parent=monster.actions.find(a=>a.id==='multiattack-flings')!;parent.sequence=['fling']
 const dispose=registerDnd5ePluginMonsterCatalogEntry(monster)
 try{
  const base=fixture('forced',75),map:BattleMap={...base.map,tokens:[{...base.map.tokens[0],id:'source',poolId:monster.id,x:25},
   {...base.map.tokens[0],hp:200,maxHp:200}]}
  map.tokens.forEach(t=>{t.elevationFeet=20})
  map.tokens[1].poolId='srd-5.1:dretch'
  const geometry=base.snapshot.state.companionScene!.geometry!
  geometry.structureLifetimes![0].objectBoundary!.topFeet=40
  geometry.structureLifetimes![0].templeWard!.saveDc=15
  geometry.obstacles.push({id:'ledge',kind:'obstacle',label:'Ledge',cover:'none',points:[{x:0,y:0},{x:100,y:0},{x:100,y:500},{x:0,y:500}],
   baseHeightFeet:0,heightFeet:0,terrainElevationFeet:20,terrainRegion:true,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
  const snapshot=createDnd5eMapCombatSnapshot({map,geometry:base.snapshot.state.companionScene!.geometry!,characters:[],combatId:map.id,worldMinute:100,
   initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,roll:20-index,label:token.id,emoji:'',color:''}))})
  const tentacle=monster.actions.find(a=>a.id==='tentacle')!.attack!
  const grabbed=resolveDnd5eHeadlessAction(snapshot.state,{type:'monster-action',actorId:'source',actionId:'tentacle',
   rolls:[{targetId:'imp',d20:15,damageRolls:tentacle.damage.map(d=>Array(d.count).fill(1)),onHitEffectRolls:[{effectId:'tentacle-grapple'}]}]})
  expect(grabbed.ok,JSON.stringify(grabbed)).toBe(true);if(!grabbed.ok)throw Error(grabbed.reason)
  grabbed.state.combatants.source.turn.actionAvailable=true
  const caster=grabbed.state.combatants.source
  caster.classId='wizard';caster.classLevels={wizard:5};caster.classSelections={'spell-prepared':['feather-fall']};caster.classResources={'dnd5e-spell-slot-1':{current:1,max:1}}
  const before=structuredClone(grabbed.state)
  let rolls=0
  const action={type:'monster-special-action' as const,actorId:'source',actionId:'fling',targetId:'imp',damageRolls:[4],forcedMovements:[{targetId:'imp',to:{x:175,y:125},distanceFeet:10}]}
  let current=true
  const fall=vi.fn(async(count:number)=>{expect(count).toBe(2);if(mode==='stale')current=false;return mode==='cancel'?undefined:mode==='invalid'?[7,1]:[2,3]})
  const result=await collectDnd5eDirectSpecialMovement({state:grabbed.state,action,transactionId:'direct-cliff',isCurrent:()=>current,
   roll:async()=>{rolls++;return {d20:mode==='denied'?1:20}},rollFallingDamage:fall,
   requestFallReaction:mode==='feather'?async()=>({casterId:'source',targetIds:['imp']}):undefined})
  expect(result.ok,JSON.stringify(result)).toBe(!['cancel','invalid','stale'].includes(mode))
  if(result.ok){
   expect(result.result.state.combatants.imp.position.x).toBe(mode==='denied'?75:175)
   expect(result.result.state.combatants.imp.currentHp).toBe(before.combatants.imp.currentHp-(mode==='denied'?0:mode==='feather'?4:9))
   expect(result.result.state.combatants.imp.elevationFeet).toBe(mode==='denied'||mode==='feather'?20:0)
   expect(fall).toHaveBeenCalledTimes(mode==='denied'||mode==='feather'?0:1)
   if(mode==='feather')expect(result.result.state.combatants.source.classResources['dnd5e-spell-slot-1'].current).toBe(0)
  }
  expect(rolls).toBe(1)
  expect(grabbed.state).toEqual(before)
 }finally{dispose();clock.mockRestore()}
})
