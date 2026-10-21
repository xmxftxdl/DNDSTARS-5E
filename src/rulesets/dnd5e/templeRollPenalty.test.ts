import {expect,it} from 'vitest'
import {createEmptyMapGeometry,setMapGeometryRuntime} from '../../lib/mapGeometry'
import {createDnd5eMapCombatSnapshot,refreshDnd5eMapSpatialRelations,planDnd5eMapResultApplication} from './mapBridge'
import {dnd5eRollDiceRecipes,resolveDnd5eRollDiceModifiers} from './rollDiceModifiers'
import type {BattleMap} from '../../store/maps'
import {resolveDnd5eHeadlessAction,startDnd5eHeadlessCombat,createDnd5eCombatant,type Dnd5eAction} from './headlessCombatEngine'
import {prepareDnd5eEffectRollDice} from './prepareEffectRollDice'
import {createDnd5eMechanicalEffect,removeDnd5eActiveEffectsByIds} from './activeEffects'
import {dnd5eTempleEntryRequirements} from './templeEntry'
import {dnd5eTempleWardAt} from './templeWardGeometry'
import {normalizeCharacter} from '../../store/characters'
import {advanceDnd5eCampaignTimedActiveEffects} from './campaignTimeRules'
import {prepareDnd5eMonsterMovementSavingThrows,resolveDnd5eMonsterMapMove,previewDnd5eMonsterMapMove} from './monsterMoveAction'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'
import {prepareDnd5eExplorationEntrySavingThrows,resolvePreparedDnd5eExplorationMove} from './playerMoveAction'
import {settleDnd5eExplorationMoveEffectDice} from './explorationMoveEffectDice'
import {prepareDnd5eMovementEffectDice} from './movementEffectDice'
import {coordinateDnd5eMovementHazards} from '../../application/maps/MovementHazardCoordinator'

it.each([1,4,'cancel','invalid','stale'] as const)('collects source temple dice through the monster combat movement adapter (%s)',async penalty=>{
 const {map,geometry}=fixture()
 geometry.structureLifetimes![1].objectBoundary={points:[{x:0,y:100},{x:100,y:100},{x:100,y:200},{x:0,y:200}],bottomFeet:0,topFeet:20}
 map.tokens[0].x=75
 const input={transactionId:'monster-temple-effect-dice',combatId:'temple-adapter',worldMinute:100,map,characters:[],
  initiativeOrder:[{tokenId:'imp',label:'Imp',emoji:'',color:'',roll:20}],actorTokenId:'imp',to:{x:125,y:125},
  deferSolidMaterialExit:true,turnEconomy:createDnd5eTurnEconomyCounts('temple-turn',20)}
 const before=structuredClone(input)
 try{
  setMapGeometryRuntime([geometry])
  const prepared=prepareDnd5eMonsterMovementSavingThrows(input)!
  const boundary=prepared.boundarySavingThrows[0]
  const rolled={...input,boundarySavingThrows:[{effectId:boundary.effectId,d20:19-boundary.requirement.modifier,d20Second:19-boundary.requirement.modifier}]}
  let count=0,current=true
  const dice=await prepareDnd5eMovementEffectDice({resolve:effectRollDice=>previewDnd5eMonsterMapMove({...rolled,effectRollDice}),
   isCurrent:()=>current,roll:async recipe=>{count++;expect(recipe.sides).toBe(4)
    if(penalty==='stale')current=false
    return penalty==='cancel'?undefined:[typeof penalty==='number'?penalty:penalty==='invalid'?5:1]}})
  if(typeof penalty==='string'){
   expect(dice).toMatchObject({ok:false,reason:penalty==='stale'?'movement-hazard-state-changed':`movement-effect-dice-${penalty==='invalid'?'invalid-dice':'cancelled'}`})
   expect(input).toEqual(before);return
  }
  expect(dice.ok).toBe(true);if(!dice.ok)throw Error(dice.reason)
  const replay=await prepareDnd5eMovementEffectDice({initialDice:dice.rolls,resolve:effectRollDice=>resolveDnd5eMonsterMapMove({...rolled,effectRollDice}),
   isCurrent:()=>true,roll:async()=>{throw Error('A previewed entry must not reroll at commit')}})
  expect(replay.ok).toBe(true);if(!replay.ok)throw Error(replay.reason)
  const settled=resolveDnd5eMonsterMapMove({...rolled,effectRollDice:replay.rolls})
  expect(settled.ok).toBe(true);if(!settled.ok)throw Error(settled.reason)
  expect(settled.result.ok,JSON.stringify(settled.result)).toBe(true)
  expect(count).toBe(1)
  expect(settled.result.state.combatants.imp.position).toEqual({x:penalty===1?125:75,y:125})
  if(penalty===4){expect(settled.distanceFeet).toBe(0);expect(settled.result.state.combatants.imp.turn.movementSpent??0).toBe(0)}
  if(penalty===4){
   const hazards=await coordinateDnd5eMovementHazards({state:settled.result.state,map,characters:[],characterIdByCombatantId:{},
    initialApplication:settled.application,movements:settled.movementTraces??[],initiativeOrder:input.initiativeOrder,
    settleStep:async()=>{throw Error('Denied movement cannot trigger travel hazards')}})
   expect(hazards.application.changedTokenIds).toContain('imp')
   expect(hazards.application.map.tokens[0].dnd5eCombatState?.activeEffects).toContainEqual(expect.objectContaining({definitionId:'temple-of-the-gods:entry-denied'}))
   expect(hazards.application.map.tokens[0].x).toBe(75)
  }
  const selected=await prepareDnd5eMovementEffectDice({availableDice:{...dice.rolls,unrelated:[3]},
   resolve:effectRollDice=>resolveDnd5eMonsterMapMove({...rolled,effectRollDice}),isCurrent:()=>true,
   roll:async()=>{throw Error('Requested cached dice must be reused')}})
  expect(selected.ok).toBe(true);if(!selected.ok)throw Error(selected.reason)
  expect(selected.rolls).toEqual(dice.rolls)
  const noEntry={...rolled,to:{x:75,y:125},boundarySavingThrows:[]}
  const shorter=await prepareDnd5eMovementEffectDice({availableDice:dice.rolls,
   resolve:effectRollDice=>resolveDnd5eMonsterMapMove({...noEntry,effectRollDice}),isCurrent:()=>true,
   roll:async()=>{throw Error('A segment before the boundary must not roll')}})
  expect(shorter.ok).toBe(true);if(!shorter.ok)throw Error(shorter.reason)
  expect(shorter.rolls).toEqual({})
  const shortResult=resolveDnd5eMonsterMapMove({...noEntry,effectRollDice:shorter.rolls})
  expect(shortResult.ok&&shortResult.result.ok).toBe(true)
  expect(settled.result.events.filter(event=>event.type==='saving-throw-resolved')).toHaveLength(1)
  expect(input).toEqual(before)
 }finally{setMapGeometryRuntime([])}
})

it.each([1,4])('applies the source temple d4 before committing exploration movement (%s)',async penalty=>{
 const {map,geometry}=fixture()
 geometry.structureLifetimes=geometry.structureLifetimes!.slice(0,1)
 geometry.structureLifetimes.push({...structuredClone(geometry.structureLifetimes[0]),id:'source-temple',
  objectBoundary:{points:[{x:0,y:100},{x:100,y:100},{x:100,y:200},{x:0,y:200}],bottomFeet:0,topFeet:20}})
 map.tokens[0].x=75
 const prepared={actor:normalizeCharacter({id:'placeholder',name:'Placeholder'}),actorToken:map.tokens[0],
  to:{x:125,y:125},toElevationFeet:0,path:[{x:75,y:125},{x:125,y:125}],pathElevationsFeet:[0,0]}
 const input={prepared,map,characters:[],worldMinute:100,deferSolidMaterialExit:true}
 const before=structuredClone(map)
 try{
  setMapGeometryRuntime([geometry])
  const entry=prepareDnd5eExplorationEntrySavingThrows(input)!
  const boundary=entry.boundarySavingThrows[0]
  let rolls=0
  const result=await settleDnd5eExplorationMoveEffectDice({...input,boundarySavingThrows:[{
   effectId:boundary.effectId,d20:19-boundary.requirement.modifier,d20Second:19-boundary.requirement.modifier}]},{
    isCurrent:()=>true,roll:async recipe=>{rolls++;expect(recipe.sides).toBe(4);return [penalty]}})
  expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
  expect(rolls).toBe(1)
  expect(result.prepared.to).toEqual({x:penalty===1?125:75,y:125})
  expect(result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',success:penalty===1}))
  expect(map).toEqual(before)
 }finally{setMapGeometryRuntime([])}
})

it.each(['cancel','invalid','stale'] as const)('preserves exploration state when entry effect dice are %s',async mode=>{
 const {map,geometry}=fixture()
 geometry.structureLifetimes![1].objectBoundary={points:[{x:0,y:100},{x:100,y:100},{x:100,y:200},{x:0,y:200}],bottomFeet:0,topFeet:20}
 map.tokens[0].x=75
 const prepared={actor:normalizeCharacter({id:'placeholder',name:'Placeholder'}),actorToken:map.tokens[0],
  to:{x:125,y:125},toElevationFeet:0,path:[{x:75,y:125},{x:125,y:125}],pathElevationsFeet:[0,0]}
 const input={prepared,map,characters:[],worldMinute:100,deferSolidMaterialExit:true},before=structuredClone(map)
 try{
  setMapGeometryRuntime([geometry])
  const entry=prepareDnd5eExplorationEntrySavingThrows(input)!
  let current=true
  const result=await settleDnd5eExplorationMoveEffectDice({...input,boundarySavingThrows:[{
   effectId:entry.boundarySavingThrows[0].effectId,d20:20,d20Second:20}]},{isCurrent:()=>current,roll:async()=>{
    if(mode==='stale')current=false
    return mode==='cancel'?undefined:mode==='invalid'?[5]:[1]
   }})
  expect(result).toMatchObject({ok:false,reason:mode==='stale'?'movement-hazard-state-changed':`movement-effect-dice-${mode==='invalid'?'invalid-dice':'cancelled'}`})
  expect(map).toEqual(before)
 }finally{setMapGeometryRuntime([])}
})

it('settles exploration entry without initiative and retains denial across map reload',()=>{
 const {map,geometry}=fixture()
 geometry.structureLifetimes=geometry.structureLifetimes!.slice(0,1)
 map.tokens[0].x=75
 const prepared={actor:normalizeCharacter({id:'placeholder',name:'Placeholder'}),actorToken:map.tokens[0],
  to:{x:125,y:125},toElevationFeet:0,path:[{x:75,y:125},{x:125,y:125}],pathElevationsFeet:[0,0]}
 const input={prepared,map,characters:[],worldMinute:100,deferSolidMaterialExit:true}
 try{
  setMapGeometryRuntime([geometry])
  const preview=prepareDnd5eExplorationEntrySavingThrows(input)!
  expect(preview.snapshot.state.active).toBe(false)
  expect(preview.boundarySavingThrows).toHaveLength(1)
  expect(resolvePreparedDnd5eExplorationMove(input)).toMatchObject({ok:false,reason:'invalid-dice'})
  const effectId=preview.boundarySavingThrows[0].effectId
  const failed=resolvePreparedDnd5eExplorationMove({...input,boundarySavingThrows:[{effectId,d20:1,d20Second:1}]})
  expect(failed.ok,JSON.stringify(failed)).toBe(true)
  if(!failed.ok)throw Error(failed.reason)
  expect(failed.prepared.to).toEqual({x:75,y:125})
  expect(failed.events.filter(event=>event.type==='saving-throw-resolved')).toHaveLength(1)
  expect(failed.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',success:false}))
  expect(failed.application.map.tokens[0].dnd5eCombatState?.activeEffects).toContainEqual(expect.objectContaining({definitionId:'temple-of-the-gods:entry-denied'}))
  const reloaded=JSON.parse(JSON.stringify(failed.application.map)) as BattleMap
  const retry=resolvePreparedDnd5eExplorationMove({...input,map:reloaded})
  expect(retry.ok).toBe(true)
  if(!retry.ok)throw Error(retry.reason)
  expect(retry.prepared.to).toEqual({x:75,y:125})
  expect(retry.events.some(event=>event.type==='saving-throw-resolved')).toBe(false)
  const success=resolvePreparedDnd5eExplorationMove({...input,boundarySavingThrows:[{effectId,d20:1,d20Second:20}]})
  expect(success.ok,JSON.stringify(success)).toBe(true)
  if(!success.ok)throw Error(success.reason)
  expect(success.prepared.to).toEqual(prepared.to)
  expect(success.state.active).toBe(false)
  expect(success.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',success:true}))
  expect(success.state.combatants.imp.turn.movementRemaining).toBe(preview.actor.turn.movementRemaining)
  expect(success.state.combatants.imp.classState.activeEffects).toContainEqual(expect.objectContaining({definitionId:'temple-of-the-gods:hostile-rolls'}))
  const leaving=resolvePreparedDnd5eExplorationMove({...input,map:success.application.map,
    prepared:{...prepared,actorToken:success.application.map.tokens[0],to:{x:75,y:125},path:[prepared.to,{x:75,y:125}]}})
  expect(leaving.ok).toBe(true)
  if(!leaving.ok)throw Error(leaving.reason)
  expect(leaving.state.combatants.imp.classState.activeEffects?.some(effect=>effect.definitionId==='temple-of-the-gods:hostile-rolls')).not.toBe(true)
  expect(prepareDnd5eExplorationEntrySavingThrows({...input,worldMinute:1440})!.entries).toEqual([])
 }finally{setMapGeometryRuntime([])}
})

function fixture(){
 const map:BattleMap={id:'temple-rolls',name:'Temple',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'imp',type:'enemy',label:'Imp',poolId:'srd-5.1:imp',x:125,y:125,size:1,color:'',emoji:'',hp:10,maxHp:10}]}
 const geometry=createEmptyMapGeometry(map.id)
 const record={id:'temple',casterId:'builder',createdWorldMinute:0,expiresWorldMinute:1440,entityIds:[],replacementGroup:'temple-of-the-gods' as const,siteKey:'site',
  objectBoundary:{points:[{x:100,y:100},{x:200,y:100},{x:200,y:200},{x:100,y:200}],bottomFeet:0,topFeet:20},
  templeWard:{hostileCreatureTypes:['fiend' as const],saveDc:18,healingBonus:5,lighting:'none' as const}}
 geometry.structureLifetimes=[record,{...record,id:'temple-2'}]
 const snapshot=createDnd5eMapCombatSnapshot({map,geometry,characters:[],combatId:'temple-rolls',worldMinute:100,
  initiativeOrder:[{tokenId:'imp',label:'Imp',emoji:'',color:'',roll:20}]})
 return {snapshot,map,geometry}
}
it('settles a temple entry save and persists a 24-hour denial without moving or rolling again',()=>{
 const {snapshot,map,geometry}=fixture(),state=snapshot.state,actor=state.combatants.imp
 geometry.structureLifetimes=geometry.structureLifetimes!.slice(0,1)
 state.companionScene!.geometry=geometry
 actor.position={x:75,y:125}
 actor.speed=30;actor.movementSpeeds={...actor.movementSpeeds,walk:30};actor.turn.movementRemaining=30
 refreshDnd5eMapSpatialRelations(state,map,[],{geometry})
 const to={x:125,y:125},requirements=dnd5eTempleEntryRequirements(state,actor,to)
 expect(requirements).toHaveLength(1)
 const move={type:'move' as const,actorId:actor.id,to,distance:5}
 const before=structuredClone(state)
 const around=[{x:75,y:125,elevationFeet:0},{x:75,y:75,elevationFeet:0},{x:225,y:75,elevationFeet:0},{x:225,y:125,elevationFeet:0}]
 expect(dnd5eTempleEntryRequirements(state,actor,{x:225,y:125},0,around)).toHaveLength(0)
 expect(dnd5eTempleEntryRequirements(state,actor,{x:225,y:125},0)).toHaveLength(1)
 const detour=resolveDnd5eHeadlessAction(state,{...move,to:{x:225,y:125},distance:25,hostMovementPath:around})
 expect(detour.ok,JSON.stringify(detour)).toBe(true)
 expect(detour.state.combatants.imp.position).toEqual({x:225,y:125})
 expect(resolveDnd5eHeadlessAction(state,{...move,hostMovementPath:around}).ok).toBe(false)
 expect(resolveDnd5eHeadlessAction(state,move).ok).toBe(false)
 expect(actor.magicResistance).toBe(true)
 expect(resolveDnd5eHeadlessAction(state,{...move,boundarySavingThrows:[{effectId:requirements[0].effectId,d20:1}]}).ok).toBe(false)
 const failed=resolveDnd5eHeadlessAction(state,{...move,boundarySavingThrows:[{effectId:requirements[0].effectId,d20:1,d20Second:1}]})
 expect(failed.ok,JSON.stringify(failed)).toBe(true)
 if(!failed.ok)throw Error(failed.reason)
 expect(failed.movementBlocked).toBe('saving-throw')
 expect(failed.state.combatants.imp.position).toEqual(actor.position)
 expect(failed.state.combatants.imp.turn.movementRemaining).toBe(actor.turn.movementRemaining)
 const denied=failed.state.combatants.imp.classState.activeEffects!.find(effect=>effect.definitionId==='temple-of-the-gods:entry-denied')!
 expect(denied.duration).toMatchObject({type:'rounds',remainingRounds:14400})
 const again=resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(failed.state)),move)
 expect(again.ok).toBe(true);if(!again.ok)throw Error(again.reason)
 expect(again.movementBlocked).toBe('saving-throw')
 expect(again.events.some(event=>event.type==='saving-throw-resolved')).toBe(false)
 const timed=normalizeCharacter({id:'test',name:'Test',dnd5eCombatState:{activeEffects:[denied]}})
 expect(advanceDnd5eCampaignTimedActiveEffects(timed,1439).dnd5eCombatState?.activeEffects).toHaveLength(1)
 expect(advanceDnd5eCampaignTimedActiveEffects(timed,1440).dnd5eCombatState?.activeEffects??[]).toHaveLength(0)
 const success=resolveDnd5eHeadlessAction(state,{...move,boundarySavingThrows:[{effectId:requirements[0].effectId,d20:1,d20Second:20}]})
 expect(success.ok,JSON.stringify(success)).toBe(true)
 expect(success.state.combatants.imp.position).toEqual(to)
 expect(state).toEqual(before)
})
it('shows and settles magical advantage through the monster movement adapter',()=>{
 const {map,geometry}=fixture()
 geometry.structureLifetimes=geometry.structureLifetimes!.slice(0,1)
 map.tokens[0].x=75
 const input={combatId:'temple-adapter',map,characters:[],initiativeOrder:[{tokenId:'imp',label:'Imp',emoji:'',color:'',roll:20}],actorTokenId:'imp',to:{x:125,y:125}}
 try{
  setMapGeometryRuntime([geometry])
  const prepared=prepareDnd5eMonsterMovementSavingThrows(input)
  expect(prepared?.boundarySavingThrows).toHaveLength(1)
  const requirement=prepared!.boundarySavingThrows[0]
  expect(requirement.requirement).toMatchObject({ability:'cha',dc:18,mode:'advantage'})
  const resolved=resolveDnd5eMonsterMapMove({...input,turnEconomy:createDnd5eTurnEconomyCounts('temple-turn',30),
    boundarySavingThrows:[{effectId:requirement.effectId,d20:1,d20Second:20}]})
  expect(resolved.ok,JSON.stringify(resolved)).toBe(true)
  if(!resolved.ok)throw Error(resolved.reason)
  expect(resolved.result.ok,JSON.stringify(resolved.result)).toBe(true)
  expect(resolved.result.state.combatants.imp.position).toEqual(input.to)
  expect(prepareDnd5eMonsterMovementSavingThrows({...input,worldMinute:1440})?.boundarySavingThrows).toEqual([])
  const expired=resolveDnd5eMonsterMapMove({...input,worldMinute:1440,turnEconomy:createDnd5eTurnEconomyCounts('temple-turn',30)})
  expect(expired.ok,JSON.stringify(expired)).toBe(true)
  if(!expired.ok)throw Error(expired.reason)
  expect(expired.result.ok,JSON.stringify(expired.result)).toBe(true)
  expect(expired.result.state.combatants.imp.position).toEqual(input.to)
  geometry.obstacles=[{id:'solid',kind:'obstacle',label:'Stone',points:[{x:100,y:100},{x:200,y:100},{x:200,y:200},{x:100,y:200}],
    blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,cover:'total',baseHeightFeet:0,heightFeet:20,createdAt:1}]
  setMapGeometryRuntime([geometry])
  const around={...input,to:{x:225,y:125}}
  expect(prepareDnd5eMonsterMovementSavingThrows(around)?.boundarySavingThrows).toEqual([])
  const detour=resolveDnd5eMonsterMapMove({...around,dash:true,turnEconomy:createDnd5eTurnEconomyCounts('temple-turn',20)})
  expect(detour.ok,JSON.stringify(detour)).toBe(true)
  if(!detour.ok)throw Error(detour.reason)
  expect(detour.result.ok,JSON.stringify(detour.result)).toBe(true)
  expect(detour.result.state.combatants.imp.position).toEqual(around.to)
 }finally{setMapGeometryRuntime([])}
})
it('keeps temple penalties active inside antimagic while suppressing ordinary magic, including spatial refresh',()=>{
 const {map,geometry}=fixture()
 const ordinary=createDnd5eMechanicalEffect({id:'ordinary-magic',definitionId:'ordinary-magic',label:'Ordinary magic',targetId:'imp',
  source:{kind:'spell',rulesId:'bless',actorId:'builder',magical:true},duration:{type:'permanent'},
  modifiers:{rollDiceModifiers:[{count:1,sides:6,direction:'add',appliesTo:['ability-check']}]}})
 map.tokens[0].dnd5eCombatState={activeEffects:[ordinary]}
 map.dnd5ePluginAreas=[{id:'antimagic',pluginId:'test',featureId:'test',label:'Antimagic',color:'',sourceTokenId:'imp',sourceCharacterId:'',
  cells:[{col:2,row:2}],createdRound:1,expiresAfterRound:100,includeSelf:true,relation:'any',occupantModifiers:{suppressesMagic:true}}]
 const snapshot=createDnd5eMapCombatSnapshot({map,geometry,characters:[],combatId:'temple-antimagic',worldMinute:100,
  initiativeOrder:[{tokenId:'imp',label:'Imp',emoji:'',color:'',roll:20}]})
 const check=()=>{
  const actor=snapshot.state.combatants.imp
  expect(actor.magicSuppressed).toBe(true)
  expect(actor.classState.activeEffects?.find(effect=>effect.id==='ordinary-magic')?.suspendedBy).toContain('persistent-area:antimagic')
  const recipes=dnd5eRollDiceRecipes({effects:actor.classState.activeEffects,actorId:actor.id,eventId:'check',kind:'ability-check'})
  expect(recipes).toHaveLength(1);expect(recipes[0]).toMatchObject({sides:4,direction:'subtract'})
 }
 check();refreshDnd5eMapSpatialRelations(snapshot.state,map,[],{geometry});check()
})
it('does not project protection, entry saves or penalties before creation or at expiry',()=>{
 const {map,geometry}=fixture()
 for(const record of geometry.structureLifetimes!)record.createdWorldMinute=100
 for(const [worldMinute,active] of [[99,false],[100,true],[1439,true],[1440,false],[NaN,false]] as const){
  expect(dnd5eTempleWardAt(geometry,{x:125,y:125},0,worldMinute)).toBe(active)
  const snapshot=createDnd5eMapCombatSnapshot({map,geometry,characters:[],combatId:'temple-time',worldMinute,
   initiativeOrder:[{tokenId:'imp',label:'Imp',emoji:'',color:'',roll:20}]})
  const actor=snapshot.state.combatants.imp
  expect(dnd5eRollDiceRecipes({effects:actor.classState.activeEffects,actorId:actor.id,eventId:'check',kind:'ability-check'})).toHaveLength(active?1:0)
  actor.position={x:75,y:125}
  expect(dnd5eTempleEntryRequirements(snapshot.state,actor,{x:125,y:125})).toHaveLength(active?2:0)
 }
})
it('projects one fresh temple d4 per roll for a hostile creature and removes it on leaving or expiry',()=>{
 const {snapshot,map,geometry}=fixture()
 const target=snapshot.state.combatants.imp
 expect(target).toBeDefined()
 for(const kind of ['attack','ability-check','saving-throw','concentration-save'] as const){
  const input={effects:target.classState.activeEffects,actorId:target.id,eventId:kind,kind}
  const recipes=dnd5eRollDiceRecipes(input)
  expect(recipes).toHaveLength(1)
  expect(recipes[0]).toMatchObject({count:1,sides:4,direction:'subtract'})
  expect(()=>resolveDnd5eRollDiceModifiers(input,undefined)).toThrow('roll-dice-missing-or-invalid')
  expect(resolveDnd5eRollDiceModifiers(input,{[recipes[0].id]:[3]}).modifier).toBe(-3)
 }
 const count=()=>dnd5eRollDiceRecipes({effects:target.classState.activeEffects,actorId:target.id,eventId:'check',kind:'ability-check'}).length
 const refresh=()=>refreshDnd5eMapSpatialRelations(snapshot.state,map,[],{geometry})
 target.position={x:225,y:125};refresh();expect(count()).toBe(0)
 target.position={x:125,y:125};refresh();expect(count()).toBe(1)
 target.creatureType='humanoid';refresh();expect(count()).toBe(0)
 target.creatureType='fiend';refresh();expect(count()).toBe(1)
 const result=planDnd5eMapResultApplication({state:snapshot.state,map,geometry,characters:[],characterIdByCombatantId:snapshot.characterIdByCombatantId})
 expect(result.map.tokens[0].dnd5eCombatState?.activeEffects?.some(effect=>effect.definitionId==='temple-of-the-gods:hostile-rolls')).not.toBe(true)
 snapshot.state.companionScene!.worldMinute=1440;refresh();expect(count()).toBe(0)
})

it.each(['attack','ability-check','saving-throw','concentration-save'] as const)('settles the projected temple penalty through a real %s transaction',async kind=>{
 const {snapshot}=fixture(),actor=snapshot.state.combatants.imp
 actor.abilities={str:10,dex:10,con:10,int:10,wis:10,cha:10}
 actor.savingThrowBonuses={};actor.concentrating=true
 const target=createDnd5eCombatant({id:'target',name:'Target',controller:'player',initiative:1,abilities:actor.abilities,armorClass:12,proficiencyBonus:2,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:actor.position,concentrating:false})
 if(kind==='saving-throw'){
  const effect=createDnd5eMechanicalEffect({id:'ending',definitionId:'ending',label:'Ending',targetId:actor.id,source:{kind:'spell',actorId:actor.id},endSavingThrow:{ability:'con',dc:12,exhaustionOnFailure:1}})
  actor.classState.activeEffects!.push(...removeDnd5eActiveEffectsByIds({effects:[effect],ids:[effect.id]}).effects)
 }
 const state=startDnd5eHeadlessCombat('temple-action',[actor,target])
 const action:Dnd5eAction=kind==='attack'?{type:'attack',actorId:actor.id,targetId:'target',attackModifier:0,d20:14,spendAction:true,damage:{count:1,sides:4,bonus:0,rolls:[2]}}:
  kind==='ability-check'?{type:'ability-check',actorId:actor.id,ability:'int',d20:14,dc:12,spendAction:true}:
  kind==='concentration-save'?{type:'concentration-save',actorId:actor.id,d20:14,dc:12}:
  {type:'active-effect-end-save',actorId:actor.id,effectId:actor.classState.activeEffects!.find(effect=>effect.pendingEndSavingThrow)!.id,d20:14}
 const options={transactionId:'temple-'+kind,now:1},before=structuredClone(state)
 expect(resolveDnd5eHeadlessAction(state,action,options).ok).toBe(false)
 const requests:string[]=[]
 const prepared=await prepareDnd5eEffectRollDice({resolve:effectRollDice=>resolveDnd5eHeadlessAction(state,{...action,effectRollDice},options),roll:async recipe=>{
  expect(recipe.sides).toBe(4);requests.push(recipe.id);return [3]
 }})
 expect(prepared.status,JSON.stringify(prepared)).toBe('ready')
 expect(requests).toHaveLength(1)
 const eventType=kind==='attack'?'attack-resolved':kind==='ability-check'?'ability-check-resolved':kind==='concentration-save'?'concentration-resolved':'active-effect-save-resolved'
 expect(prepared.result.events.find(event=>event.type===eventType)).toMatchObject({total:11,...(kind==='attack'?{hit:false}:{success:false})})
 expect(prepared.result.transaction?.rollLedger.entries).toContainEqual(expect.objectContaining({sourceId:'persistent-area-occupant:temple:imp',dice:{sides:4,values:[3]}}))
 expect(resolveDnd5eHeadlessAction(state,{...action,effectRollDice:prepared.rolls},{transactionId:'different-event'}).ok).toBe(false)
 expect(state).toEqual(before)
})

it('native Dispel Magic removes ordinary spell effects but preserves the temple and its hostile penalty',()=>{
 const {map,geometry}=fixture()
 map.tokens.unshift({id:'priest',type:'enemy',label:'Priest',poolId:'srd-5.1:priest',x:75,y:125,size:1,color:'',emoji:'',hp:27,maxHp:27})
 map.tokens[1].dnd5eCombatState={activeEffects:[createDnd5eMechanicalEffect({id:'ordinary-bless',definitionId:'bless',label:'Bless',targetId:'imp',
  source:{kind:'spell',rulesId:'bless',actorId:'priest',spellLevel:1,magical:true},duration:{type:'permanent'},
  modifiers:{rollDiceModifiers:[{count:1,sides:4,direction:'add',appliesTo:['saving-throw']}]}})]}
 const snapshot=createDnd5eMapCombatSnapshot({map,geometry,characters:[],combatId:'temple-dispel',worldMinute:100,
  initiativeOrder:map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i}))})
 const before=structuredClone(snapshot.state)
 const result=resolveDnd5eHeadlessAction(snapshot.state,{type:'monster-core-spell',actorId:'priest',spellId:'dispel-magic',slotLevel:3,
  resolution:{schemaVersion:1,targetIds:['imp'],effectRolls:[],dispelMagicChecks:[]}})
 expect(result.ok,result.ok?undefined:result.reason).toBe(true)
 if(!result.ok)throw Error(result.reason)
 expect(result.events).toContainEqual(expect.objectContaining({type:'spell-dispelled',spellId:'bless',success:true}))
 expect(result.state.combatants.imp.classState.activeEffects?.some(e=>e.id==='ordinary-bless')).toBe(false)
 expect(result.state.combatants.imp.classState.activeEffects).toContainEqual(expect.objectContaining({definitionId:'temple-of-the-gods:hostile-rolls'}))
 expect(result.state.companionScene?.geometry).toEqual(before.companionScene?.geometry)
 refreshDnd5eMapSpatialRelations(result.state,map,[],{geometry})
 expect(dnd5eRollDiceRecipes({effects:result.state.combatants.imp.classState.activeEffects,actorId:'imp',eventId:'after-dispel',kind:'saving-throw'})).toMatchObject([{sides:4,direction:'subtract'}])
 expect(snapshot.state).toEqual(before)
})

it.each(['id','tag'] as const)('registered Activity removal by %s preserves spatial temple effects',async selector=>{
 const {registerDnd5eRulesPlugin}=await import('./pluginApi')
 const {registerDnd5eActivityPackage}=await import('./activities/dnd5eActivityRegistry')
 const {compileDnd5eActivityHeadlessAction}=await import('./activities/dnd5eActivityHeadlessCompiler')
 const {dnd5ePluginFeatureActionFromActivityV1}=await import('./activities/dnd5eActivityFeatureActionAdapter')
 const {automationCapabilityFromLegacyStatus}=await import('../../domain/automation/automationCapability')
 const {snapshot,map,geometry}=fixture(),state=snapshot.state,target=state.combatants.imp
 target.classState.activeEffects!.push(createDnd5eMechanicalEffect({id:'ordinary-magic',definitionId:'ordinary-magic',label:'Ordinary',targetId:'imp',tags:['ordinary-removable'],
  source:{kind:'spell',rulesId:'bless',actorId:'imp',magical:true},duration:{type:'permanent'}}))
 const packageId='local.temple.removal-'+selector
 const operation=selector==='id'?{id:'remove',kind:'remove-effect',target:'actor',effectId:'ordinary-magic',source:'any'}:
  {id:'remove',kind:'remove-effects-by-tag',target:'actor',tags:['ordinary-removable'],match:'any',source:'any'}
 const activity:import('./activities/dnd5eActivityContracts').Dnd5eActivityDefinitionV1=JSON.parse(JSON.stringify({schemaVersion:1,id:'remove',name:'Remove ordinary effect',activation:{kind:'action'},target:{kind:'self'},legacySource:{kind:'feature',id:'remove'},
  automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'resolve',when:{kind:'always'},operations:[operation]}]}))
 const registration=registerDnd5eActivityPackage({packageId,packageVersion:'1.0.0',activities:[activity]})
 const dispose=registerDnd5eRulesPlugin({manifest:{id:packageId,name:'Removal audit',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
  api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
  api.registerFeature({id:'remove',name:'Remove',summary:'Test',description:'Test',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(activity)})
 }})
 try{
  target.pluginFeatureIds=[packageId+':remove']
  const before=structuredClone(state)
  const result=resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:packageId,actionId:'remove',featureId:packageId+':remove',actorId:'imp',targetId:'imp',targetIds:['imp'],rolls:{}})
  expect(result.ok,result.ok?undefined:result.reason).toBe(true)
  if(!result.ok)throw Error(result.reason)
  expect(result.state.combatants.imp.classState.activeEffects?.some(e=>e.id==='ordinary-magic')).toBe(false)
  expect(result.state.companionScene?.geometry).toEqual(before.companionScene?.geometry)
  refreshDnd5eMapSpatialRelations(result.state,map,[],{geometry})
  expect(result.state.combatants.imp.classState.activeEffects).toContainEqual(expect.objectContaining({definitionId:'temple-of-the-gods:hostile-rolls'}))
  expect(state).toEqual(before)
 }finally{dispose();registration.dispose()}
})
