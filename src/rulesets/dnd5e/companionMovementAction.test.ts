import { afterEach, expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { prepareDnd5eOwnedCompanionMovement } from './companionMovementAction'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { prepareDnd5eMonsterMovementSavingThrows, resolveDnd5eMonsterMapMove } from './monsterMoveAction'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { findDnd5eOpportunityAttackersForMove, prepareDnd5eOpportunityAttack, resolvePreparedDnd5eOpportunityAttack } from './opportunityAttackAction'
import { collectDnd5ePersistentAreaTriggers } from './pluginAreas'
import { prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
import { resolveDnd5eMonsterDodge, resolveDnd5eMonsterMovementAction, resolveDnd5eMonsterHelp } from './monsterBasicAction'
import { dnd5eExecutableCompanionOrder, dnd5eCompanionOrderIdentity } from './companionOrderExecution'
import { resolveDnd5eHeadlessAction, type Dnd5eAction } from './headlessCombatEngine'
import { prepareDnd5eCompanionSpecialAttack } from './companionSpecialAttack'
import { prepareDnd5eCompanionHide } from './companionHideAction'
import { resolveDnd5eCompanionObjectAction } from './companionObjectAction'
import { resolveDnd5eCompanionReadyAction } from './companionReadyAction'
import { resolveDnd5eReadiedObjectAction } from './readiedObjectAction'
import { prepareDnd5eMonsterAttack, resolvePreparedDnd5eMonsterAttack } from './monsterAttackAction'
import { resolvePreparedDnd5ePlayerBasicAction } from './playerBasicAction'
afterEach(() => setMapGeometryRuntime([]))

it.each(['finish','over-budget','changed-turn','stopped'] as const)('keeps one readied movement budget through a reaction checkpoint: %s',variant=>{
  const {actor,input}=fixture()
  actor.dnd5eCombatState!.companionCommand=undefined
  actor.dnd5eCombatState!.readiedAction={trigger:'signal',actionKind:'move',preparedTurnKey:'movement-test:1:undead'}
  const economy=createDnd5eTurnEconomyCounts('own-turn',30)
  economy.action.current=0
  economy.movement.current=10
  const first=resolveDnd5eMonsterMapMove({...input,turnEconomy:economy,to:{x:75,y:25},readiedMovement:{currentInitiativeIndex:1,segment:'continue'}})
  expect(first.ok&&first.result.ok).toBe(true)
  if(!first.ok||!first.result.ok||!first.application)throw Error('Missing checkpoint')
  expect(first.result.state.combatants[actor.id].turn).toMatchObject({movementRemaining:10,reactionAvailable:false,actionAvailable:false})
  expect(first.result.events.filter(e=>e.type==='turn-resource-spent'&&e.resource==='reaction')).toHaveLength(1)
  const saved=JSON.parse(JSON.stringify(first.application.map)) as BattleMap
  expect(saved.tokens[0].dnd5eCombatState?.readiedAction?.movementExecution?.remaining).toBe(25)
  const afterEconomy=structuredClone(economy);afterEconomy.reaction.current=0
  if(variant==='stopped')saved.tokens[0].dnd5eCombatState!.movementStoppedTurnKey='movement-test:1:chosen'
  const second=resolveDnd5eMonsterMapMove({...input,map:saved,round:variant==='changed-turn'?2:1,turnEconomy:afterEconomy,
    to:{x:variant==='over-budget'?375:175,y:25},readiedMovement:{currentInitiativeIndex:1,segment:'finish'}})
  if(variant!=='finish'){expect(second.ok&&second.result.ok).toBe(false);return}
  expect(second.ok&&second.result.ok).toBe(true)
  if(!second.ok||!second.result.ok||!second.application)throw Error('Missing final movement')
  expect(second.result.state.combatants[actor.id].turn).toMatchObject({movementRemaining:10,reactionAvailable:false,actionAvailable:false})
  expect(second.result.events.filter(e=>e.type==='turn-resource-spent'&&e.resource==='reaction')).toHaveLength(0)
  expect(second.application.map.tokens[0].dnd5eCombatState?.readiedAction).toBeUndefined()
  const replay=resolveDnd5eMonsterMapMove({...input,map:second.application.map,turnEconomy:afterEconomy,to:{x:225,y:25},readiedMovement:{currentInitiativeIndex:1,segment:'finish'}})
  expect(replay.ok&&replay.result.ok).toBe(false)
})

it.each([49,50,99,100])('keeps pickup and movement load limits after reload: %s held portions',count=>{
  const {actor,map,input}=fixture()
  const item={schemaVersion:1 as const,inventoryItem:{templateId:'srd-5.1:item:conjured-food-portion',quantity:1,receiptId:'load:next'}}
  actor.dnd5eCarriedObjects=Array.from({length:count},(_,i)=>({id:'held-'+i,pickupReceipt:'receipt-'+i,label:'Food',objectState:structuredClone(item)}))
  actor.dnd5eCombatState!.companionCommand={...actor.dnd5eCombatState!.companionCommand!,command:'use-object',movementDestination:undefined,attackTargetId:undefined,
    objectInteraction:{mapId:map.id,operation:'pickup-item',objectTokenId:'item',expectedReceiptId:'load:next',expectedQuantity:1}}
  map.tokens.push({id:'item',label:'Food',type:'obstacle',size:1,x:75,y:25,color:'',emoji:'',dnd5eObjectState:item})
  const before=structuredClone(map)
  const picked=resolveDnd5eCompanionObjectAction(input)
  expect(picked?.result.ok??false).toBe(count<100)
  expect(map).toEqual(before)
  if(count===100){expect(picked?.application).toBeUndefined();return}
  expect(picked!.result.state.combatants[actor.id].carriedWeightLb).toBe((count+1)*3)
  const saved=JSON.parse(JSON.stringify(picked!.application!.map)) as BattleMap
  const snapshot=createDnd5eMapCombatSnapshot({...input,map:saved})
  expect(snapshot.state.combatants[actor.id].carriedWeightLb).toBe((count+1)*3)
  const move=resolveDnd5eMonsterMapMove({...input,map:saved,to:{x:25,y:75}})
  expect(move.ok && move.result.ok).toBe(count===49)
})

it.each(['success','far','stale','removed','released','dead','no-reaction'] as const)('declares, saves and triggers actual Ready pickup: %s',mode=>{
  const {actor,map,input}=fixture()
  map.tokens.push({id:'item',label:'Water',type:'obstacle',size:1,x:75,y:25,color:'',emoji:'',
    dnd5eObjectState:{schemaVersion:1,inventoryItem:{templateId:'srd-5.1:item:holy-water-flask',quantity:1,receiptId:'ready:item'}}})
  actor.dnd5eCombatState!.companionCommand={...actor.dnd5eCombatState!.companionCommand!,command:'ready',movementDestination:undefined,attackTargetId:undefined,
    ready:{trigger:'signal',actionKind:'interact-object'},objectInteraction:{mapId:map.id,operation:'pickup-item',objectTokenId:'item',expectedReceiptId:'ready:item',expectedQuantity:1}}
  const declared=resolveDnd5eCompanionReadyAction(input)
  expect(declared?.result.ok).toBe(true);if(!declared?.result.ok)throw Error('Declaration failed')
  const ended=resolveDnd5eHeadlessAction(declared.result.state,{type:'end-turn',actorId:actor.id})
  expect(ended.ok).toBe(true)
  const saved=JSON.parse(JSON.stringify(planDnd5eMapResultApplication({state:ended.state,map,characters:[],characterIdByCombatantId:{},events:[...ended.events]}).map)) as BattleMap
  expect(saved.tokens[0].dnd5eCombatState?.companionCommand?.command).toBe('ready')
  expect(saved.tokens[0].dnd5eCombatState?.readiedAction?.objectInteraction).toMatchObject({operation:'pickup-item',objectTokenId:'item'})
  if(mode==='far')saved.tokens[0].x=475
  if(mode==='stale')saved.tokens.find(t=>t.id==='item')!.dnd5eObjectState!.inventoryItem!.receiptId='new'
  if(mode==='removed')saved.tokens=saved.tokens.filter(t=>t.id!=='item')
  if(mode==='released')saved.tokens[0].dnd5eSummon!.controlEnded=true
  if(mode==='dead')saved.tokens[0].hp=0
  const economy=createDnd5eTurnEconomyCounts('ready-pickup',30);economy.action.current=0
  if(mode==='no-reaction')economy.reaction.current=0
  const before=structuredClone(saved)
  const result=resolveDnd5eReadiedObjectAction({...input,map:saved,turnEconomy:economy,currentInitiativeIndex:1})
  expect(result?.result.ok??false).toBe(mode==='success')
  expect(saved).toEqual(before)
  if(mode!=='success'){expect(result?.application).toBeUndefined();return}
  expect(result!.result.state.initiativeIndex).toBe(1)
  expect(result!.result.state.combatants[actor.id].turn).toMatchObject({actionAvailable:false,reactionAvailable:false,objectInteractionAvailable:true})
  expect(result!.application!.map.tokens[0].dnd5eCarriedObjects).toHaveLength(1)
  expect(result!.application!.map.tokens[0].dnd5eCombatState?.readiedAction).toBeUndefined()
  expect(result!.application!.map.tokens.some(t=>t.id==='item')).toBe(false)
  expect(resolveDnd5eReadiedObjectAction({...input,map:result!.application!.map,currentInitiativeIndex:1})).toBeUndefined()
})

it.each(['success','stale-quantity','wrong-receipt','far','spent'] as const)('settles actual commanded pickup through Headless and map application: %s',mode=>{
  const {actor,map,input}=fixture()
  map.tokens.push({id:'item',label:'Water',type:'obstacle',size:1,x:75,y:25,color:'',emoji:'',
    dnd5eObjectState:{schemaVersion:1,inventoryItem:{templateId:'srd-5.1:item:holy-water-flask',quantity:1,receiptId:'test:item'}}})
  actor.dnd5eCombatState!.companionCommand={...actor.dnd5eCombatState!.companionCommand!,command:'use-object',movementDestination:undefined,attackTargetId:undefined,
    objectInteraction:{operation:'pickup-item',mapId:map.id,objectTokenId:'item',expectedReceiptId:mode==='wrong-receipt'?'wrong':'test:item',expectedQuantity:mode==='stale-quantity'?2:1}}
  if(mode==='far')actor.x=475
  const economy=createDnd5eTurnEconomyCounts('pickup',30)
  if(mode==='spent'){economy.action.current=0;economy.objectInteraction!.current=0}
  const before=structuredClone(map)
  const result=resolveDnd5eCompanionObjectAction({...input,turnEconomy:economy})
  expect(result?.result.ok??false).toBe(['success','stale-quantity','wrong-receipt'].includes(mode))
  expect(map).toEqual(before)
  if(mode==='stale-quantity'||mode==='wrong-receipt'){
    expect(result?.result.events).toContainEqual({type:'companion-object-order-cancelled',actorId:actor.id,reason:'object-missing-or-changed'})
    expect(result?.application?.map.tokens[0].dnd5eCombatState?.companionCommand).toBeUndefined()
    expect(result?.application?.map.tokens[0].dnd5eCarriedObjects).toBeUndefined()
    expect(result?.application?.map.tokens.find(token=>token.id==='item')).toEqual(map.tokens.find(token=>token.id==='item'))
    expect(result?.result.state.combatants[actor.id].turn.objectInteractionAvailable).toBe(true)
    return
  }
  if(mode!=='success'){expect(result?.application).toBeUndefined();return}
  const application=result!.application!
  expect(application.map.tokens.some(token=>token.id==='item')).toBe(false)
  expect(application.map.tokens[0].dnd5eCarriedObjects).toHaveLength(1)
  expect(application.tokenPatches?.[actor.id].dnd5eCarriedObjects).toHaveLength(1)
  expect(application.changedTokenIds).toContain('item')
  expect(application.map.tokens[0].dnd5eCombatState?.companionCommand).toBeUndefined()
  expect(result!.result.state.combatants[actor.id].turn.objectInteractionAvailable).toBe(false)
  expect(result!.result.state.combatants[actor.id].turn.actionAvailable).toBe(true)
  expect(resolveDnd5eCompanionObjectAction({...input,map:JSON.parse(JSON.stringify(application.map))})).toBeUndefined()
})

it('ends a second group recipient pickup after the first takes the only item without duplication or cost',()=>{
  const {actor,map,input}=fixture()
  actor.dnd5eCombatState!.companionCommand={...actor.dnd5eCombatState!.companionCommand!,command:'use-object',movementDestination:undefined,attackTargetId:undefined,
    objectInteraction:{mapId:map.id,operation:'pickup-item',objectTokenId:'item',expectedReceiptId:'one',expectedQuantity:1}}
  const second=structuredClone(actor);second.id='second';second.y=75
  map.tokens.push(second,{id:'item',label:'Water',type:'obstacle',size:1,x:75,y:25,color:'',emoji:'',dnd5eObjectState:{schemaVersion:1,
    inventoryItem:{templateId:'srd-5.1:item:holy-water-flask',quantity:1,receiptId:'one'}}})
  const initiativeOrder=map.tokens.filter(token=>token.type!=='obstacle').map((token,i)=>({tokenId:token.id,label:token.label,roll:20-i,color:'',emoji:''}))
  const first=resolveDnd5eCompanionObjectAction({...input,initiativeOrder})
  expect(first?.result.ok).toBe(true)
  const saved=JSON.parse(JSON.stringify(first!.application!.map)) as BattleMap
  const economy=createDnd5eTurnEconomyCounts('second',30);economy.action.current=0;economy.objectInteraction!.current=0
  const next=resolveDnd5eCompanionObjectAction({...input,map:saved,initiativeOrder,actorTokenId:second.id,turnEconomy:economy})
  expect(next?.result.ok).toBe(true)
  expect(next?.result.events).toContainEqual({type:'companion-object-order-cancelled',actorId:second.id,reason:'object-missing-or-changed'})
  expect(next?.result.events.some(event=>event.type==='turn-resource-spent'||event.type==='companion-item-picked-up')).toBe(false)
  const completed=next!.application!.map
  expect(completed.tokens.flatMap(token=>token.dnd5eCarriedObjects??[])).toHaveLength(1)
  expect(completed.tokens.find(token=>token.id===second.id)?.dnd5eCombatState?.companionCommand).toBeUndefined()
  expect(resolveDnd5eCompanionObjectAction({...input,map:completed,initiativeOrder,actorTokenId:second.id})).toBeUndefined()
})

it.each([29, 30])('uses campaign time for commanded object interaction under temporary lock suppression: %s', worldMinute => {
  const {actor, map, input}=fixture()
  const geometry=createEmptyMapGeometry(map.id)
  geometry.doors.push({id:'door',kind:'door',label:'Door',secret:false,state:'closed',openState:'closed',lockState:'unlocked',
    points:[{x:50,y:0},{x:50,y:50}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:10,createdAt:1,
    dnd5eArcaneLock:{schemaVersion:1,sourceTokenId:'someone-else',sourceActivityId:'lock',spellLevel:2,previousLocked:false,
      suppression:{kind:'campaign-time',untilWorldMinute:30}}})
  setMapGeometryRuntime([geometry])
  actor.dnd5eCombatState!.companionCommand={...actor.dnd5eCombatState!.companionCommand!,command:'use-object',
    movementDestination:undefined,attackTargetId:undefined,objectInteraction:{mapId:map.id,doorId:'door',operation:'open'}}
  const before=structuredClone(map)
  const result=resolveDnd5eCompanionObjectAction({...input,worldMinute})
  expect(result?.result.ok??false).toBe(worldMinute===29)
  if(worldMinute===29){expect(result?.door?.openState).toBe('open');expect(result?.result.state.combatants[actor.id].turn.objectInteractionAvailable).toBe(false)}
  else expect(result?.application).toBeUndefined()
  expect(map).toEqual(before)
})

it.each(['open', 'close', 'close-locked', 'already-open', 'already-closed', 'far', 'locked-after-ready', 'removed', 'no-reaction'] as const)('declares, saves and triggers a bound Ready door operation: %s', variant => {
  const { actor, map, input } = fixture()
  const closing = ['close', 'close-locked', 'already-closed'].includes(variant)
  const opened = ['close', 'close-locked', 'already-open'].includes(variant)
  const geometry = createEmptyMapGeometry(map.id)
  geometry.doors.push({ id: 'door', kind: 'door', label: 'Door', secret: false, state: opened ? 'open' : 'closed',
    openState: opened ? 'open' : 'closed', lockState: variant === 'close-locked' ? 'locked' : 'unlocked',
    points: [{ x: 50, y: 0 }, { x: 50, y: 50 }], blocksVision: true, blocksMovement: true,
    blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 })
  setMapGeometryRuntime([geometry])
  actor.dnd5eCombatState!.companionCommand = { ...actor.dnd5eCombatState!.companionCommand!, command: 'ready',
    movementDestination: undefined, attackTargetId: undefined, ready: { trigger: 'signal', actionKind: 'interact-object' },
    objectInteraction: { mapId: map.id, doorId: 'door', operation: closing ? 'close' : 'open' } }
  const declared = resolveDnd5eCompanionReadyAction(input)
  expect(declared?.result.ok).toBe(true)
  if (!declared?.result.ok) throw Error('Declaration failed')
  const ended = resolveDnd5eHeadlessAction(declared.result.state, { type: 'end-turn', actorId: actor.id })
  expect(ended.ok).toBe(true)
  const saved = JSON.parse(JSON.stringify(planDnd5eMapResultApplication({ state: ended.state, map,
    characters: [], characterIdByCombatantId: {}, events: [...ended.events] }).map)) as BattleMap
  expect(saved.tokens[0].dnd5eCombatState?.companionCommand?.command).toBe('ready')
  expect(saved.tokens[0].dnd5eCombatState?.readiedAction?.objectInteraction).toEqual(actor.dnd5eCombatState!.companionCommand!.objectInteraction)
  if (variant === 'far') saved.tokens[0].x = 475
  if (variant === 'locked-after-ready') geometry.doors[0] = { ...geometry.doors[0], state: 'locked', lockState: 'locked' }
  if (variant === 'removed') geometry.doors = []
  setMapGeometryRuntime([geometry])
  const economy = createDnd5eTurnEconomyCounts('ready-object', 30)
  economy.action.current = 0
  if (variant === 'no-reaction') economy.reaction.current = 0
  const before = structuredClone(saved), beforeGeometry = structuredClone(geometry)
  const triggered = resolveDnd5eReadiedObjectAction({ ...input, map: saved, turnEconomy: economy, currentInitiativeIndex: 1 })
  expect(saved).toEqual(before); expect(geometry).toEqual(beforeGeometry)
  if (['far', 'locked-after-ready', 'removed', 'no-reaction'].includes(variant)) {
    expect(triggered?.result.ok ?? false).toBe(false)
    expect(triggered?.application).toBeUndefined()
    return
  }
  expect(triggered?.result.ok, JSON.stringify(triggered)).toBe(true)
  expect(triggered?.door?.openState).toBe(closing ? 'closed' : 'open')
  expect(triggered?.door?.lockState).toBe(variant === 'close-locked' ? 'locked' : 'unlocked')
  expect(triggered?.result.state.initiativeIndex).toBe(1)
  expect(triggered?.result.state.combatants[actor.id].turn).toMatchObject({ actionAvailable: false, reactionAvailable: false, objectInteractionAvailable: true })
  expect(triggered?.result.events.filter(event => event.type === 'turn-resource-spent')).toEqual([
    expect.objectContaining({ type: 'turn-resource-spent', actorId: actor.id, resource: 'reaction' })])
  expect(triggered?.application?.map.tokens[0].dnd5eCombatState?.readiedAction).toBeUndefined()
  expect(resolveDnd5eReadiedObjectAction({ ...input, map: triggered!.application!.map, turnEconomy: economy, currentInitiativeIndex: 1 })).toBeUndefined()
})

it.each(['attack', 'move'] as const)('expires saved Ready %s at the next own turn and rejects replay', actionKind => {
  const { actor, input, map } = fixture()
  map.tokens[1].x = 75
  actor.dnd5eCombatState!.companionCommand = undefined
  actor.dnd5eCombatState!.readiedAction = { trigger: 'signal', actionKind, preparedTurnKey: 'movement-test:1:undead' }
  const state = createDnd5eMapCombatSnapshot({ ...input, round: 2 }).state
  state.initiativeIndex = 0
  const started = resolveDnd5eHeadlessAction(state, { type: 'begin-turn', actorId: actor.id })
  expect(started.ok, JSON.stringify(started)).toBe(true)
  expect(started.state.combatants[actor.id].classState.readiedAction).toBeUndefined()
  started.state.initiativeIndex = 1
  const before = JSON.parse(JSON.stringify(started.state)) as typeof started.state
  const action: Dnd5eAction = actionKind === 'attack'
    ? { type: 'trigger-readied-action', actorId: actor.id, weaponExecution: { actionId: 'shortsword', rolls: [{ targetId: 'chosen', d20: 15, damageRolls: [[3]] }] } }
    : { type: 'trigger-readied-action', actorId: actor.id, moveExecution: { type: 'move', actorId: actor.id, to: { x: 25, y: 75 }, distance: 5 } }
  const rejected = resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(started.state)), action)
  expect(rejected.ok).toBe(false)
  expect(rejected.state).toEqual(before)
})

it.each([1, 20])('preserves boundary-save outcomes for readied movement: %s', d20 => {
  const { actor, input, map } = fixture()
  map.tokens[1].x = 25; map.tokens[1].y = 125
  actor.dnd5eCombatState!.companionCommand = undefined
  actor.dnd5eCombatState!.readiedAction = { trigger: 'signal', actionKind: 'move', preparedTurnKey: 'movement-test:1:undead' }
  actor.dnd5eCombatState!.activeEffects = [createDnd5eMechanicalEffect({ id: 'ready-boundary', definitionId: 'ready-boundary', label: 'Boundary', targetId: actor.id,
    source: { kind: 'spell', actorId: 'chosen' }, modifiers: { movementBoundarySave: { maximumDistanceFeet: 15, ability: 'wis', dc: 15 } } })]
  const economy = createDnd5eTurnEconomyCounts('ready-boundary', 30)
  economy.action.current = 0; economy.movement.current = 0; economy.movement.spent = 30
  const resolved = resolveDnd5eMonsterMapMove({ ...input, to: { x: 325, y: 25 }, turnEconomy: economy,
    readiedMovement: { currentInitiativeIndex: 1 }, boundarySavingThrows: [{ effectId: 'ready-boundary', d20 }] })
  expect(resolved.ok && resolved.result.ok, JSON.stringify(resolved)).toBe(true)
  if (!resolved.ok || !resolved.result.ok) throw Error('Boundary resolution failed')
  expect(resolved.result.movementBlocked).toBe(d20 === 1 ? 'saving-throw' : undefined)
  expect(resolved.application?.map.tokens[0].x).toBe(d20 === 1 ? 25 : 325)
  expect(resolved.result.state.combatants[actor.id].turn.movementRemaining).toBe(0)
  expect(resolved.result.state.combatants[actor.id].turn.reactionAvailable).toBe(false)
  expect(resolved.result.state.combatants[actor.id].classState.readiedAction).toBeUndefined()
})

it.each(['normal', 'spent-movement', 'too-far', 'mud-short', 'mud-far', 'wall', 'closed-door', 'no-ready', 'no-reaction', 'dash'] as const)('settles readied movement through actual pathfinding: %s', variant => {
  const { actor, input, map } = fixture()
  actor.dnd5eCombatState!.companionCommand = undefined
  actor.dnd5eCombatState!.readiedAction = variant === 'no-ready' ? undefined : {
    trigger: 'signal', actionKind: 'move', preparedTurnKey: 'movement-test:1:undead' }
  const economy = createDnd5eTurnEconomyCounts('ready-move', 30)
  economy.action.current = 0
  economy.movement.current = variant === 'spent-movement' ? 0 : 5
  economy.movement.spent = variant === 'spent-movement' ? 30 : 25
  if (variant === 'no-reaction') economy.reaction.current = 0
  const geometry = createEmptyMapGeometry(map.id)
  if (variant.startsWith('mud')) geometry.obstacles.push({ id: 'mud', kind: 'obstacle', label: 'Mud',
    points: [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 400 }, { x: 0, y: 400 }],
    blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
    baseHeightFeet: 0, heightFeet: 0, terrainCostMultiplier: 2, traversal: 'ground', createdAt: 1 })
  if (variant === 'wall') geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 50, y: 0 }, { x: 50, y: 400 }],
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 20, createdAt: 1 })
  if (variant === 'closed-door') geometry.doors.push({ id: 'door', kind: 'door', label: 'Door', secret: false, state: 'closed',
    points: [{ x: 50, y: 0 }, { x: 50, y: 400 }], blocksVision: true, blocksMovement: true,
    blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 20, createdAt: 1 })
  setMapGeometryRuntime([geometry])
  const before = structuredClone(map), originalEconomy = structuredClone(economy)
  const to = { x: variant === 'too-far' ? 375 : variant === 'mud-short' ? 175 : 325, y: 25 }
  const result = resolveDnd5eMonsterMapMove({ ...input, to, turnEconomy: economy,
    readiedMovement: { currentInitiativeIndex: 1 }, dash: variant === 'dash' || undefined })
  expect(map).toEqual(before); expect(economy).toEqual(originalEconomy)
  if (!['normal', 'spent-movement', 'mud-short'].includes(variant)) {
    expect(result.ok && result.result.ok, JSON.stringify(result)).toBe(false)
    if (result.ok) {
      expect(result.application).toBeUndefined()
      expect(result.result.state.combatants[actor.id].position).toEqual({ x: 25, y: 25 })
      expect(result.result.state.combatants[actor.id].classState.readiedAction).toBeDefined()
    }
    return
  }
  expect(result.ok && result.result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok || !result.result.ok) throw Error('Ready movement rejected')
  expect(result.result.state.initiativeIndex).toBe(1)
  const moved = result.result.state.combatants[actor.id]
  expect(moved.position).toEqual(to)
  expect(moved.turn.movementRemaining).toBe(economy.movement.current)
  expect(moved.turn.movementSpent).toBe(economy.movement.spent)
  expect(moved.turn.actionAvailable).toBe(false)
  expect(moved.turn.reactionAvailable).toBe(false)
  expect(moved.classState.readiedAction).toBeUndefined()
  expect(result.application?.map.tokens[0].dnd5eCombatState?.readiedAction).toBeUndefined()
  expect(result.result.events.filter(event => event.type === 'turn-resource-spent' && event.resource === 'reaction')).toHaveLength(1)
  const saved = JSON.parse(JSON.stringify(result.application!.map)) as BattleMap
  expect(resolveDnd5eMonsterMapMove({ ...input, map: saved, to: { x: to.x + 50, y: 25 },
    turnEconomy: economy, readiedMovement: { currentInitiativeIndex: 1 } }).ok).toBe(false)
})

it.each(['hit', 'miss', 'critical', 'no-ready', 'wrong-target', 'no-reaction', 'far'] as const)('uses the normal monster attack facade for a readied reaction: %s', variant => {
  const { actor, input, map } = fixture()
  map.tokens[1].x = variant === 'far' ? 575 : 75
  actor.dnd5eCombatState!.companionCommand = undefined
  actor.dnd5eCombatState!.readiedAction = variant === 'no-ready' ? undefined : {
    trigger: 'approaches', actionKind: 'attack', targetId: variant === 'wrong-target' ? 'owner' : 'chosen', preparedTurnKey: 'movement-test:1:undead' }
  const economy = createDnd5eTurnEconomyCounts('ready-execution', 30)
  economy.action.current = 0
  if (variant === 'no-reaction') economy.reaction.current = 0
  const before = structuredClone(map)
  const prepared = prepareDnd5eMonsterAttack({ ...input, targetTokenId: 'chosen', actionIndex: 0,
    readiedAttack: true, currentInitiativeIndex: 1, turnEconomy: economy })
  if (['no-ready', 'wrong-target', 'far'].includes(variant)) {
    expect(prepared.ok, JSON.stringify(prepared)).toBe(false)
    expect(map).toEqual(before)
    return
  }
  expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
  if (!prepared.ok) throw Error('Preparation failed')
  expect(prepared.prepared.attacks).toHaveLength(1)
  const result = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared,
    rolls: [{ d20: variant === 'critical' ? 20 : variant === 'miss' ? 1 : 15,
      damageRolls: [variant === 'critical' ? [3, 3] : [3]] }] })
  expect(map).toEqual(before)
  if (variant === 'no-reaction') {
    expect(result.result.ok).toBe(false)
    expect(result.application).toBeUndefined()
    return
  }
  expect(result.result.ok, JSON.stringify(result.result)).toBe(true)
  expect(result.result.state.initiativeIndex).toBe(1)
  expect(result.result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
  expect(result.result.state.combatants[actor.id].turn.reactionAvailable).toBe(false)
  expect(result.application?.map.tokens[0].dnd5eCombatState?.readiedAction).toBeUndefined()
  expect(result.application?.map.tokens[1].hp).toBe(variant === 'miss' ? 30 : variant === 'critical' ? 22 : 25)
})

it.each(['normal', 'no-action', 'released', 'no-order', 'wrong-owner', 'empty-trigger'] as const)('plans and persists commanded Ready through the map facade: %s', variant => {
  const { actor, input } = fixture()
  actor.dnd5eCombatState!.companionCommand = { ...actor.dnd5eCombatState!.companionCommand!, command: 'ready',
    movementDestination: undefined, ready: { trigger: variant === 'empty-trigger' ? '' : 'When the enemy approaches', actionKind: 'attack' } }
  if (variant === 'released') actor.dnd5eSummon!.controlEnded = true
  if (variant === 'no-order') actor.dnd5eCombatState!.companionCommand = undefined
  if (variant === 'wrong-owner') actor.dnd5eCombatState!.companionCommand!.sourceOwnerId = 'other'
  const economy = createDnd5eTurnEconomyCounts('ready', 30)
  if (variant === 'no-action') economy.action.current = 0
  const resolved = resolveDnd5eCompanionReadyAction({ ...input, turnEconomy: economy })
  const plan = planDnd5eMonsterTurn(input.map, actor, [], { combatId: input.combatId, turnEconomy: economy })
  if (variant !== 'normal') {
    expect(resolved?.result.ok ?? false).toBe(false)
    expect(plan.commandedReady).toBeUndefined()
    return
  }
  expect(resolved?.result.ok).toBe(true)
  expect(plan.commandedReady).toBe(true)
  expect(resolved?.result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
  expect(resolved?.result.state.combatants[actor.id].turn.reactionAvailable).toBe(true)
  expect(resolved?.application?.map.tokens[0].dnd5eCombatState?.readiedAction).toMatchObject({
    trigger: 'When the enemy approaches', actionKind: 'attack', targetId: 'chosen' })
})

it.each(['hit', 'miss', 'wrong-target', 'wrong-action', 'invalid-dice', 'no-reaction', 'no-ready', 'multiple-attacks'] as const)('settles actual readied monster weapon atomically: %s', variant => {
  const { actor, map, input } = fixture()
  map.tokens[1].x = 75
  actor.dnd5eCombatState!.companionCommand = { ...actor.dnd5eCombatState!.companionCommand!, command: 'ready',
    ready: { trigger: 'When the chosen enemy approaches', actionKind: 'attack' } }
  const snapshot = createDnd5eMapCombatSnapshot(input)
  const declared = resolveDnd5eHeadlessAction(snapshot.state, { type: 'ready', actorId: actor.id,
    trigger: 'When the chosen enemy approaches', actionKind: 'attack', targetId: 'chosen' })
  expect(declared.ok, JSON.stringify(declared)).toBe(true)
  const applied = planDnd5eMapResultApplication({ state: declared.state, map, characters: [],
    characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...declared.events] })
  const restoredMap = JSON.parse(JSON.stringify(applied.map)) as BattleMap
  expect(restoredMap.tokens[0].dnd5eCombatState?.readiedAction).toMatchObject({ actionKind: 'attack', targetId: 'chosen' })
  const restored = createDnd5eMapCombatSnapshot({ ...input, map: restoredMap }).state
  restored.initiativeIndex = 1
  restored.combatants[actor.id].turn.actionAvailable = false
  if (variant === 'no-reaction') restored.combatants[actor.id].turn.reactionAvailable = false
  if (variant === 'no-ready') restored.combatants[actor.id].classState.readiedAction = undefined
  const before = structuredClone(restored)
  const roll = { targetId: variant === 'wrong-target' ? actor.id : 'chosen', d20: variant === 'miss' ? 1 : 15,
    damageRolls: [[variant === 'invalid-dice' ? 99 : 3]] }
  const action: Dnd5eAction = { type: 'trigger-readied-action', actorId: actor.id, weaponExecution: {
    actionId: variant === 'wrong-action' ? 'multiattack' : 'shortsword', rolls: variant === 'multiple-attacks' ? [roll, roll] : [roll] } }
  const result = resolveDnd5eHeadlessAction(restored, action)
  expect(restored).toEqual(before)
  if (variant !== 'hit' && variant !== 'miss') {
    expect(result.ok, JSON.stringify(result)).toBe(false)
    expect(result.state).toEqual(before)
    return
  }
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.initiativeIndex).toBe(1)
  expect(result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
  expect(result.state.combatants[actor.id].turn.reactionAvailable).toBe(false)
  expect(result.state.combatants[actor.id].classState.readiedAction).toBeUndefined()
  expect(result.state.combatants.chosen.currentHp).toBe(variant === 'hit' ? 25 : 30)
  expect(result.events.filter(event => event.type === 'turn-resource-spent')).toEqual([
    expect.objectContaining({ type: 'turn-resource-spent', actorId: actor.id, resource: 'reaction' })])
  expect(resolveDnd5eHeadlessAction(result.state, action).ok).toBe(false)
  const completed = planDnd5eMapResultApplication({ state: result.state, map: restoredMap, characters: [],
    characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...result.events] })
  expect(completed.map.tokens[0].dnd5eCombatState?.readiedAction).toBeUndefined()
})

it.each(['free', 'action', 'no-resource', 'far', 'locked', 'wrong-id', 'no-order', 'close-locked', 'already-open', 'already-closed', 'pending-movement'] as const)('executes bounded door command: %s', variant => {
  const { actor, map, input } = fixture()
  const order = actor.dnd5eCombatState!.companionCommand!
  order.command = 'use-object'; order.attackTargetId = undefined; order.movementDestination = undefined
  const closing = variant === 'close-locked' || variant === 'already-closed'
  const initiallyOpen = variant === 'close-locked' || variant === 'already-open'
  const satisfied = variant === 'already-open' || variant === 'already-closed'
  order.objectInteraction = { mapId: map.id, doorId: 'door', operation: closing ? 'close' : 'open' }
  if (variant === 'pending-movement') order.movementDestination = { mapId: map.id, x: 125, y: 25 }
  const geometry = createEmptyMapGeometry(map.id)
  geometry.doors.push({ id: 'door', kind: 'door', secret: false, label: 'Door', points: [{ x: 50, y: 0 }, { x: 50, y: 50 }],
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    state: initiallyOpen ? 'open' : variant === 'locked' ? 'locked' : 'closed',
    openState: initiallyOpen ? 'open' : 'closed', lockState: variant === 'locked' || variant === 'close-locked' ? 'locked' : 'unlocked' })
  setMapGeometryRuntime([geometry])
  if (variant === 'far') actor.x = 475
  if (variant === 'no-order') actor.dnd5eCombatState!.companionCommand = undefined
  const economy = createDnd5eTurnEconomyCounts('objects', 30)
  if (variant === 'action' || variant === 'no-resource') economy.objectInteraction!.current = 0
  if (variant === 'no-resource') economy.action.current = 0
  const state = createDnd5eMapCombatSnapshot(input).state
  state.combatants[actor.id].turn.objectInteractionAvailable = economy.objectInteraction!.current > 0
  state.combatants[actor.id].turn.actionAvailable = economy.action.current > 0
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'use-object', actorId: actor.id,
    interactionId: variant === 'wrong-id' ? 'open:other' : `${order.objectInteraction.operation}:door` })
  if (['no-resource', 'far', 'locked', 'wrong-id', 'no-order'].includes(variant)) {
    expect(result.ok, JSON.stringify(result)).toBe(false)
    expect(result.state).toEqual(before)
  } else {
    expect(result.ok, JSON.stringify(result)).toBe(true)
    const door = result.state.companionScene!.geometry!.doors[0]
    expect(door.openState).toBe(closing ? 'closed' : 'open')
    expect(door.lockState).toBe(variant === 'close-locked' ? 'locked' : 'unlocked')
    expect(result.state.combatants[actor.id].turn.actionAvailable).toBe(variant !== 'action')
    expect(result.state.combatants[actor.id].turn.objectInteractionAvailable).toBe(satisfied)
    if (satisfied) {
      const spent = structuredClone(state)
      spent.combatants[actor.id].turn.actionAvailable = false
      spent.combatants[actor.id].turn.objectInteractionAvailable = false
      const completed = resolveDnd5eHeadlessAction(spent, { type: 'use-object', actorId: actor.id, interactionId: `${order.objectInteraction.operation}:door` })
      expect(completed.ok, JSON.stringify(completed)).toBe(true)
      expect(completed.events.some(event => event.type === 'turn-resource-spent')).toBe(false)
      expect(completed.state.combatants[actor.id].classState.companionCommand).toBeUndefined()
    }
    if (variant === 'pending-movement') {
      const saved = JSON.parse(JSON.stringify(result.state)) as typeof state
      expect(saved.combatants[actor.id].classState.companionCommand?.objectInteractionCompleted).toBe(true)
      expect(dnd5eCompanionOrderIdentity(saved.combatants[actor.id].classState.companionCommand!)).toBe(dnd5eCompanionOrderIdentity(order))
      const moved = resolveDnd5eHeadlessAction(saved, { type: 'move', actorId: actor.id, to: { x: 125, y: 25 }, distance: 10 })
      expect(moved.ok, JSON.stringify(moved)).toBe(true)
      expect(moved.state.combatants[actor.id].classState.companionCommand).toBeUndefined()
      expect(moved.state.combatants[actor.id].turn.actionAvailable).toBe(true)
      expect(moved.events.some(event => event.type === 'object-action-taken')).toBe(false)
    } else expect(result.state.combatants[actor.id].classState.companionCommand).toBeUndefined()
    expect(resolveDnd5eHeadlessAction(result.state, { type: 'use-object', actorId: actor.id, interactionId: 'open:door' }).ok).toBe(false)
    const facade = resolveDnd5eCompanionObjectAction({ ...input, turnEconomy: economy })
    expect(facade?.door?.openState).toBe(door.openState)
    const mappedOrder = facade?.application?.map.tokens.find(token => token.id === actor.id)?.dnd5eCombatState?.companionCommand
    if (variant === 'pending-movement') expect(mappedOrder?.objectInteractionCompleted).toBe(true)
    else expect(mappedOrder).toBeUndefined()
  }
  expect(state).toEqual(before)
  expect(geometry.doors[0].openState).toBe(initiallyOpen ? 'open' : 'closed')
})

it.each(['success', 'helped', 'failed-check', 'visible', 'no-order', 'wrong-order', 'no-action'] as const)('settles and persists commanded Hide: %s', variant => {
  const { actor, map, input } = fixture()
  actor.dnd5eSummon!.side = 'player'
  const order = actor.dnd5eCombatState!.companionCommand!
  order.command = 'hide'; order.attackTargetId = undefined; order.movementDestination = undefined
  const geometry = createEmptyMapGeometry(map.id)
  if (variant !== 'visible') geometry.walls.push({ id: 'screen', kind: 'wall', label: 'Screen',
    points: [{ x: 300, y: 0 }, { x: 300, y: 400 }], blocksVision: true, blocksMovement: true,
    blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 20, createdAt: 1 })
  setMapGeometryRuntime([geometry])
  if (variant === 'no-order') actor.dnd5eCombatState!.companionCommand = undefined
  if (variant === 'wrong-order') order.command = 'dodge'
  if (variant === 'helped') actor.dnd5eCombatState!.helpedAbilityCheckSourceId = 'owner'
  const economy = createDnd5eTurnEconomyCounts('hide', 30)
  if (variant === 'no-action') economy.action.current = 0
  const request = { ...input, turnEconomy: economy }
  const before = structuredClone(map)
  const prepared = prepareDnd5eCompanionHide(request)
  const plan = planDnd5eMonsterTurn(map, actor, [], { combatId: input.combatId, turnEconomy: economy })
  if (variant !== 'success' && variant !== 'failed-check' && variant !== 'helped') {
    expect(prepared).toBeUndefined()
    expect(plan.commandedHide).toBeUndefined()
    const state = createDnd5eMapCombatSnapshot(input).state
    state.combatants[actor.id].turn.actionAvailable = economy.action.current > 0
    const result = resolveDnd5eHeadlessAction(state, { type: 'hide', actorId: actor.id, d20: 20 })
    expect(result.ok).toBe(false)
    expect(result.state).toEqual(state)
  } else {
    expect(prepared).toBeDefined(); expect(plan.commandedHide).toBe(true)
    if (variant === 'helped') expect(prepared!.actorRollMode).toBe('advantage')
    const settled = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared!, actorD20: variant === 'success' ? 20 : 1, actorD20Second: 20 })
    expect(settled.result.ok).toBe(true)
    if (!settled.result.ok || !settled.application) throw Error('Hide failed')
    const hidden = settled.result.state.combatants[actor.id].classState.hiddenCheckTotal
    if (variant === 'success' || variant === 'helped') expect(hidden).toBeGreaterThan(10)
    else expect(hidden).toBeUndefined()
    expect(settled.result.state.combatants[actor.id].classState.helpedAbilityCheckSourceId).toBeUndefined()
    expect(settled.result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
    const saved = JSON.parse(JSON.stringify(settled.application.map)) as BattleMap
    const restored = createDnd5eMapCombatSnapshot({ ...input, map: saved }).state
    expect(restored.combatants[actor.id].classState.hiddenCheckTotal).toBe(hidden)
    const ended = resolveDnd5eHeadlessAction(settled.result.state, { type: 'end-turn', actorId: actor.id })
    expect(ended.ok).toBe(true)
    expect(ended.state.combatants[actor.id].classState.companionCommand).toBeUndefined()
    expect(ended.state.combatants[actor.id].classState.hiddenCheckTotal).toBe(hidden)
  }
  expect(map).toEqual(before)
})

it.each(['grapple','shove-prone','shove-push'] as const)('prepares and maps the commanded %s contest, including failure',attackKind=>{
 for(const success of [true,false]){
  const {actor,map,input}=fixture()
  actor.dnd5eSummon!.side='player';map.tokens[1].x=75
  actor.dnd5eCombatState!.companionCommand!.attackKind=attackKind
  actor.dnd5eCombatState!.companionCommand!.movementDestination=undefined
  const before=structuredClone(map)
  const prepared=prepareDnd5eCompanionSpecialAttack(input)
  expect(prepared).toBeDefined()
  if(!prepared)throw Error('Special attack unavailable')
  const settled=resolvePreparedDnd5ePlayerBasicAction({prepared,actorD20:success?20:1,targetD20:success?1:20})
  expect(settled.result.ok,JSON.stringify(settled.result)).toBe(true)
  expect(settled.result.events).toContainEqual(expect.objectContaining({type:'contest-resolved',success}))
  if(!settled.application)throw Error('No map application')
  const saved=JSON.parse(JSON.stringify(settled.application.map)) as BattleMap
  const target=saved.tokens.find(t=>t.id==='chosen')!
  if(attackKind==='shove-push')expect(target.x).toBe(success?125:75)
  else if(success)expect(target.dnd5eCombatState?.activeEffects?.some(e=>e.standardCondition===(attackKind==='grapple'?'grappled':'prone'))).toBe(true)
  expect(settled.result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
  expect(map).toEqual(before)
 }
})

it.each(['grapple','shove'] as const)('checks %s against the named attack or actual self-defense target',kind=>{
 for(const mode of ['named','wrong-target','uncommanded','retaliation','guard-inside','guard-outside'] as const){
  const {actor,map,input}=fixture()
  actor.dnd5eSummon!.side='player';map.tokens[1].x=75
  const order=actor.dnd5eCombatState!.companionCommand!
  order.movementDestination=undefined
  if(mode==='wrong-target')order.attackTargetId='different-target'
  if(mode==='uncommanded'||mode==='retaliation')actor.dnd5eCombatState!.companionCommand=undefined
  if(mode==='retaliation')actor.dnd5eCombatState!.summonAttackerIds=['chosen']
  if(mode==='guard-inside'||mode==='guard-outside'){
   order.attackTargetId=undefined
   order.guardArea={mapId:map.id,minX:0,minY:0,maxX:mode==='guard-inside'?100:50,maxY:100}
  }
  const state=createDnd5eMapCombatSnapshot(input).state
  const before=structuredClone(state)
  const action:Dnd5eAction=kind==='grapple'
   ?{type:'grapple',actorId:actor.id,targetId:'chosen',actorD20:20,targetD20:1,targetDefense:'athletics'}
   :{type:'shove',actorId:actor.id,targetId:'chosen',actorD20:20,targetD20:1,targetDefense:'athletics',outcome:'prone'}
  const result=resolveDnd5eHeadlessAction(state,action)
  if(mode==='wrong-target'||mode==='uncommanded'||mode==='guard-outside'){
   expect(result.ok).toBe(false)
   if(!result.ok)expect(result.reason).toBe('invalid-class-feature')
   expect(result.state).toEqual(before)
  }else{
   expect(result.ok,JSON.stringify(result)).toBe(true)
   if(result.ok)expect(result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
  }
  expect(state).toEqual(before)
 }
})

it.each(['miss','hit','dead-target','missing-target','unconscious-target','waiting'] as const)('finishes attack task correctly for %s',variant=>{
 const {actor,map,input}=fixture()
 actor.dnd5eSummon!.side='player'; map.tokens[1].x=75
 actor.dnd5eCombatState!.companionCommand!.movementDestination=undefined
 const state=createDnd5eMapCombatSnapshot(input).state
 if(variant==='dead-target')state.combatants.chosen.deathSaves.dead=true
 if(variant==='missing-target')delete state.combatants.chosen
 if(variant==='unconscious-target'){state.combatants.chosen.currentHp=0;state.combatants.chosen.deathSaves.dead=false}
 const used=variant==='miss'||variant==='hit'?resolveDnd5eHeadlessAction(state,{type:'attack',actorId:actor.id,targetId:'chosen',d20:variant==='miss'?1:15,attackModifier:10,
  damage:{count:1,sides:6,bonus:0,rolls:[2],type:'piercing'}}):{ok:true as const,state}
 expect(used.ok).toBe(true)
 if(!used.ok)throw Error('Attack rejected')
 const ended=resolveDnd5eHeadlessAction(used.state,{type:'end-turn',actorId:actor.id})
 expect(ended.ok).toBe(true)
 if(!ended.ok)throw Error('End turn rejected')
 const order=ended.state.combatants[actor.id].classState.companionCommand
 const completed=variant==='dead-target'||variant==='missing-target'
 if(completed)expect(order).toBeUndefined()
 else expect(JSON.parse(JSON.stringify(order))?.attackTargetId).toBe('chosen')
 expect(ended.events.filter(event=>event.type==='companion-order-completed')).toHaveLength(completed?1:0)
})

it.each(['dash','disengage','dodge'] as const)('ends a completed %s order at turn end, retaining pending travel and unused actions', command => {
 for(const variant of ['reached','pending','unused','other-map'] as const){
  const {actor,map,input}=fixture(command)
  actor.dnd5eCombatState!.companionCommand!.movementDestination={mapId:variant==='other-map'?'other':map.id,x:variant==='pending'?475:25,y:25}
  const state=createDnd5eMapCombatSnapshot(input).state
  const used=variant==='unused'?{ok:true as const,state}:resolveDnd5eHeadlessAction(state,{type:command,actorId:actor.id})
  expect(used.ok).toBe(true)
  if(!used.ok)throw Error('Action rejected')
  const ended=resolveDnd5eHeadlessAction(used.state,{type:'end-turn',actorId:actor.id})
  expect(ended.ok).toBe(true)
  if(!ended.ok)throw Error('End turn rejected')
  const saved=JSON.parse(JSON.stringify(ended.state.combatants[actor.id]))
  expect(ended.events.filter(e=>e.type==='companion-order-completed')).toHaveLength(variant==='reached'?1:0)
  if(variant==='reached'){
   expect(saved.classState.companionCommand).toBeUndefined()
   expect(saved.classState.summonSelfDefenseTurnKey).toBe('movement-test:1:undead')
  }else expect(saved.classState.companionCommand?.command).toBe(command)
 }
})

it('retains a standing guard after its Dodge action and turn end',()=>{
 const {actor,map,input}=fixture()
 actor.dnd5eCombatState!.companionCommand!.movementDestination=undefined
 actor.dnd5eCombatState!.companionCommand!.guardArea={mapId:map.id,minX:0,minY:0,maxX:200,maxY:200}
 const state=createDnd5eMapCombatSnapshot(input).state
 const dodge=resolveDnd5eHeadlessAction(state,{type:'dodge',actorId:actor.id})
 expect(dodge.ok).toBe(true)
 if(!dodge.ok)throw Error('Dodge rejected')
 const ended=resolveDnd5eHeadlessAction(dodge.state,{type:'end-turn',actorId:actor.id})
 expect(ended.ok).toBe(true)
 if(ended.ok)expect(ended.state.combatants[actor.id].classState.companionCommand?.guardArea).toBeDefined()
})

it('finishes Help followed by its declared movement without granting Help twice',()=>{
 const {actor,map,input}=fixture()
 actor.dnd5eSummon!.side='player'; map.tokens[1].x=75
 const order=actor.dnd5eCombatState!.companionCommand!
 order.command='help'; order.attackTargetId=undefined; order.helpTargetId='chosen'; order.helpKind='attack'
 order.movementDestination={mapId:map.id,x:125,y:25}
 const state=createDnd5eMapCombatSnapshot(input).state
 const helped=resolveDnd5eHeadlessAction(state,{type:'help',actorId:actor.id,targetId:'chosen',helpKind:'attack'})
 expect(helped.ok).toBe(true)
 if(!helped.ok)throw Error('Help rejected')
 expect(helped.state.combatants[actor.id].classState.companionCommand).toBeDefined()
 const moved=resolveDnd5eHeadlessAction(helped.state,{type:'move',actorId:actor.id,to:{x:125,y:25},distance:10})
 expect(moved.ok).toBe(true)
 if(!moved.ok)throw Error('Move rejected')
 const ended=resolveDnd5eHeadlessAction(moved.state,{type:'end-turn',actorId:actor.id})
 expect(ended.ok).toBe(true)
 if(!ended.ok)throw Error('End turn rejected')
 expect(ended.state.combatants[actor.id].classState.companionCommand).toBeUndefined()
 expect(ended.state.combatants.chosen.classState.helpedAttackSourceId).toBe(actor.id)
 expect([...helped.events,...moved.events,...ended.events].filter(event=>event.type==='help-granted')).toHaveLength(1)
})

it.each(['absent', 'reached', 'pending'] as const)('ends successful Help only when its movement is %s', destination => {
 const {actor,map,input}=fixture()
 actor.dnd5eSummon!.side='player'
 const order=actor.dnd5eCombatState!.companionCommand!
 order.command='help'; order.attackTargetId=undefined; order.helpTargetId='chosen'; order.helpKind='attack'
 order.movementDestination=destination==='absent'?undefined:{mapId:map.id,x:destination==='reached'?25:475,y:25}
 map.tokens[1].x=75
 const result=resolveDnd5eMonsterHelp({...input,targetTokenId:'chosen',helpKind:'attack'})
 expect(result.ok&&result.result.ok,JSON.stringify(result)).toBe(true)
 if(!result.ok||!result.application)throw Error('Help failed')
 const restored=JSON.parse(JSON.stringify(result.application.map)) as BattleMap
 const helper=restored.tokens[0]
 expect(restored.tokens[1].dnd5eCombatState?.helpedAttackSourceId).toBe(actor.id)
 if(destination==='pending')expect(helper.dnd5eCombatState?.companionCommand).toMatchObject({command:'help'})
 else {
  expect(helper.dnd5eCombatState?.companionCommand).toBeUndefined()
  expect(helper.dnd5eCombatState?.summonSelfDefenseTurnKey).toBe('movement-test:1:undead')
  expect(dnd5eExecutableCompanionOrder(helper,'movement-test:1:undead')).toBeUndefined()
  expect(dnd5eExecutableCompanionOrder(helper,'movement-test:2:undead')?.selfDefenseOnly).toBe(true)
 }
})

it('executes uncommanded persistent summons defensively without creating an unrestricted attack order',()=>{
 const {actor,map,input}=fixture()
 actor.dnd5eCombatState!.companionCommand=undefined
 expect(dnd5eExecutableCompanionOrder(actor,'combat:1:undead')).toMatchObject({selfDefenseOnly:true})
 expect(planDnd5eMonsterTurn(map,actor)).toMatchObject({attacked:false,dodged:true})
 actor.dnd5eCombatState!.summonAttackerIds=['chosen']
 map.tokens[1].x=75
 expect(planDnd5eMonsterTurn(map,actor)).toMatchObject({attacked:true,targetTokenId:'chosen'})
 actor.dnd5eCombatState!.summonSelfDefenseTurnKey='combat:1:undead'
 expect(dnd5eExecutableCompanionOrder(JSON.parse(JSON.stringify(actor)),'combat:1:undead')).toBeUndefined()
 expect(dnd5eExecutableCompanionOrder(actor,'combat:2:undead')?.selfDefenseOnly).toBe(true)
 const dodge=resolveDnd5eMonsterDodge(input)
 expect(dodge.ok&&dodge.result.ok).toBe(true)
 if(!dodge.ok||!dodge.application)throw Error('Dodge failed')
 expect(dodge.application.map.tokens[0].dnd5eCombatState?.summonSelfDefenseTurnKey).toBe('combat:1:undead')
 expect(dodge.application.map.tokens[0].dnd5eCombatState?.companionCommand).toBeUndefined()
 const reloaded=createDnd5eMapCombatSnapshot({...input,map:JSON.parse(JSON.stringify(dodge.application.map))})
 expect(reloaded.state.combatants[actor.id].dodging).toBe(true)
 expect(reloaded.state.combatants[actor.id].classState.dodgingTurnKey).toBe('movement-test:1:undead')
 actor.dnd5eSummon!.controlEnded=true
 expect(dnd5eExecutableCompanionOrder(actor,'combat:2:undead')).toBeUndefined()
})

it.each([1,20])('keeps the declared destination after a boundary save (%s) and never teleports past its budget',d20=>{
 const {actor,map,input}=fixture('dodge')
 map.tokens[1].x=25;map.tokens[1].y=125
 actor.dnd5eCombatState!.activeEffects=[createDnd5eMechanicalEffect({id:'boundary',definitionId:'boundary',label:'Boundary',targetId:actor.id,
  source:{kind:'spell',actorId:'chosen'},modifiers:{movementBoundarySave:{maximumDistanceFeet:15,ability:'wis',dc:15}}})]
 const before=structuredClone(map)
 const prepared=prepareDnd5eOwnedCompanionMovement({...input,turnEconomy:createDnd5eTurnEconomyCounts('boundary',30)})
 expect(prepared?.destination).toEqual({x:325,y:25})
 expect(map).toEqual(before)
 const saves=prepareDnd5eMonsterMovementSavingThrows({...input,to:prepared!.destination})
 expect(saves?.boundarySavingThrows).toHaveLength(1)
 const settled=resolveDnd5eMonsterMapMove({...input,to:prepared!.destination,boundarySavingThrows:[{effectId:'boundary',d20}]})
 expect(settled.ok&&settled.result.ok,JSON.stringify(settled)).toBe(true)
 if(!settled.ok||!settled.result.ok||!settled.application)throw Error('No movement result')
 expect(settled.application.map.tokens[0].x).toBe(d20===1?25:325)
 expect(settled.result.state.combatants[actor.id].turn.movementRemaining).toBe(d20===1?30:0)
 expect(settled.application.map.tokens[0].dnd5eCombatState?.companionCommand?.movementDestination).toEqual({mapId:'scene',x:475,y:25})
})

it.each(['dodge','disengage'] as const)('routes commanded %s movement through normal opportunity eligibility',command=>{
 const {actor,map,input}=fixture(command)
 actor.dnd5eSummon!.side='player'
 map.tokens[1].x=25;map.tokens[1].y=75
 const movement=prepareDnd5eOwnedCompanionMovement(input)!
 expect(movement.movement?.result.ok).toBe(true)
 const attackers=findDnd5eOpportunityAttackersForMove({map,characters:[],movingToken:actor,to:movement.destination,
  path:movement.movement!.path,disengaged:movement.disengage,turnEconomyByToken:{}})
 expect(attackers.map(token=>token.id)).toEqual(command==='disengage'?[]:['chosen'])
 if(command==='disengage')return
 const ready=prepareDnd5eOpportunityAttack({...input,actorTokenId:'chosen',targetTokenId:actor.id,
  turnEconomy:createDnd5eTurnEconomyCounts('enemy',30)})
 expect(ready.ok,JSON.stringify(ready)).toBe(true)
 if(!ready.ok)throw Error('Reaction preparation failed')
 const hit=resolvePreparedDnd5eOpportunityAttack({prepared:ready.prepared,d20:15,damageRolls:[3]})
 expect(hit.result.ok).toBe(true)
 if(!hit.result.ok||!hit.application)throw Error('Reaction resolution failed')
 expect(hit.result.state.combatants[actor.id].currentHp).toBeLessThan(13)
 expect(hit.result.state.combatants.chosen.turn.reactionAvailable).toBe(false)
 const afterReaction=prepareDnd5eOwnedCompanionMovement({...input,map:hit.application.map})!
 expect(afterReaction.movement?.result.state.combatants[actor.id].currentHp).toBe(hit.result.state.combatants[actor.id].currentHp)
})

it('settles each entered hazard interval along a commanded path and persists its receipts',()=>{
 const {actor,map,input}=fixture('dodge')
 map.dnd5ePluginAreas=[{id:'hazard',pluginId:'test',featureId:'hazard',label:'Hazard',color:'#f00',
  sourceCharacterId:'source',sourceTokenId:'chosen',createdRound:1,expiresAfterRound:10,
  cells:[{col:1,row:0},{col:2,row:0},{col:3,row:0}],
  triggers:[{id:'step',label:'Step',timing:'on-move-distance',oncePerRound:false,movementIntervalFeet:5,
   damage:{count:1,sides:4,modifier:0,type:'fire'}}]}]
 const movement=prepareDnd5eOwnedCompanionMovement(input)!
 expect(movement.movement?.result.ok).toBe(true)
 const candidates=collectDnd5ePersistentAreaTriggers({map,timing:'on-move-distance',round:1,
  movement:{token:actor,to:movement.destination,path:movement.movement!.path}})
 expect(candidates).toHaveLength(3)
 let current=map
 for(const candidate of candidates){
  const ready=prepareDnd5ePersistentAreaTrigger({...input,map:current,candidate})
  expect(ready.ok,JSON.stringify(ready)).toBe(true)
  if(!ready.ok)throw Error('Hazard preparation failed')
  const settled=resolvePreparedDnd5ePersistentAreaTrigger({prepared:ready.prepared,damageRolls:[1]})
  expect(settled.result.ok).toBe(true)
  if(!settled.application)throw Error('Hazard settlement failed')
  current=JSON.parse(JSON.stringify(settled.application.map))
 }
 expect(current.tokens.find(token=>token.id===actor.id)?.hp).toBe(10)
 expect(current.dnd5ePluginAreas![0].triggerReceipts).toHaveLength(3)
 expect(current.tokens[0].dnd5eCombatState?.companionCommand?.movementDestination).toEqual({mapId:'scene',x:475,y:25})
})

function fixture(command: 'attack' | 'dash' | 'disengage' | 'dodge' = 'attack') {
  const actor: Token = { id: 'undead', label: 'Undead', emoji: '', color: '', type: 'enemy',
    x: 25, y: 25, size: 1, hp: 13, maxHp: 13, poolId: 'srd-5.1:skeleton',
    dnd5eSummon: { schemaVersion: 1, pluginId: 'test', featureId: 'summon', sourceCharacterId: 'caster',
      sourceTokenId: 'owner', createdRound: 1, expiresAfterRound: 600, side: 'enemy', commandPolicy: 'persistent-order' },
    dnd5eCombatState: { companionCommand: { schemaVersion: 1, sourceOwnerId: 'owner', sourceFeatureId: 'summon',
      issuedRound: 1, persistentOrder: true, command, attackTargetId: 'chosen', movementDestination: { mapId: 'scene', x: 475, y: 25 } } } }
  const map: BattleMap = { id: 'scene', name: 'Scene', width: 800, height: 400, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actor,
      { id: 'chosen', label: 'Chosen', emoji: '', color: '', type: 'enemy', poolId: 'srd-5.1:goblin', hp: 30, maxHp: 30, x: 575, y: 25, size: 1 }] }
  const input = { map, characters: [], actorTokenId: actor.id, combatId: 'movement-test', round: 1,
    initiativeOrder: map.tokens.map((token, index) => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 20 - index })) }
  return { actor, map, input }
}

it('moves only an affordable prefix and resumes the saved destination on the next turn', () => {
  const { actor, map, input } = fixture()
  const before = structuredClone(map)
  const first = prepareDnd5eOwnedCompanionMovement(input)
  const direct = resolveDnd5eMonsterMapMove({ ...input, to: { x: 325, y: 25 } })
  const full = resolveDnd5eMonsterMapMove({ ...input, to: { x: 475, y: 25 } })
  expect(first?.movement?.result.ok, JSON.stringify({ direct: direct.ok ? {ok:direct.result.ok,reason:direct.result.ok?null:direct.result.reason,path:direct.path} : direct,
    full: full.ok ? {ok:full.result.ok,reason:full.result.ok?null:full.result.reason,path:full.path} : full })).toBe(true)
  expect(first?.destination).toEqual({ x: 325, y: 25 })
  expect(first?.movement?.result.state.combatants[actor.id].turn.movementRemaining).toBe(0)
  expect(first?.movement?.result.state.combatants[actor.id].turn.actionAvailable).toBe(true)
  expect(map).toEqual(before)
  expect(first?.movement?.application).toBeUndefined()
  if (!direct.ok || !direct.application) throw new Error('Expected authoritative movement application')
  const restored = JSON.parse(JSON.stringify(direct.application.map)) as BattleMap
  expect(restored.tokens[0].dnd5eCombatState?.companionCommand?.movementDestination).toEqual({ mapId: 'scene', x: 475, y: 25 })
  const second = prepareDnd5eOwnedCompanionMovement({ ...input, map: restored, round: 2,
    turnEconomy: createDnd5eTurnEconomyCounts('second', 30) })
  expect(second?.destination).toMatchObject({ x: 475, y: 25 })
  expect(second?.movement?.result.state.combatants[actor.id].turn.movementRemaining).toBe(15)
})

it.each(['dash', 'disengage', 'dodge'] as const)('preserves the %s action and its actual economy', command => {
  const { actor, map, input } = fixture(command)
  const prepared = prepareDnd5eOwnedCompanionMovement(input)
  expect(prepared?.movement?.result.ok).toBe(true)
  expect(prepared?.destination).toMatchObject({ x: command === 'dash' ? 475 : 325, y: 25 })
  expect(prepared?.movement?.result.state.combatants[actor.id].turn.actionAvailable).toBe(command === 'dodge')
  const plan = planDnd5eMonsterTurn(map, actor, [], { combatId: input.combatId })
  expect(plan).toMatchObject({ moved: true, attacked: false, newPosition: prepared!.destination })
  if (command === 'dodge') expect(plan.dodged).toBe(true)
  if (command === 'dash') expect(plan.dashed).toBe(true)
  if (command === 'disengage') expect(plan.disengaged).toBe(true)
})

it('keeps the chosen attack and waits without chasing when the destination is on another map', () => {
  const { actor, map } = fixture()
  expect(planDnd5eMonsterTurn(map, actor)).toMatchObject({ moved: true, newPosition: { x: 325, y: 25 }, targetTokenId: 'chosen' })
  actor.dnd5eCombatState!.companionCommand!.movementDestination!.mapId = 'other'
  const waiting = planDnd5eMonsterTurn(map, actor)
  expect(waiting.moved).toBe(false)
  expect(waiting.newPosition).toBeUndefined()
})

it('charges difficult terrain and respects a smaller remaining movement pool', () => {
  const { map, input } = fixture('dodge')
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.obstacles.push({ id: 'mud', kind: 'obstacle', label: 'Mud',
    points: [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 400 }, { x: 0, y: 400 }],
    blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
    baseHeightFeet: 0, heightFeet: 0, terrainCostMultiplier: 2, traversal: 'ground', createdAt: 1 })
  setMapGeometryRuntime([geometry])
  const economy = createDnd5eTurnEconomyCounts('remaining', 30)
  economy.movement.current = 20
  economy.movement.spent = 10
  const prepared = prepareDnd5eOwnedCompanionMovement({ ...input, turnEconomy: economy })
  expect(prepared?.destination).toEqual({ x: 125, y: 25 })
  expect(prepared?.movement?.result.state.combatants.undead.turn.movementRemaining).toBe(0)
})

it('does not cross a sealed wall or treat a blocked destination as a teleport', () => {
  const { actor, map, input } = fixture('dodge')
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 50, y: 0 }, { x: 50, y: 400 }],
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 20, createdAt: 1 })
  setMapGeometryRuntime([geometry])
  const before = structuredClone(map)
  expect(prepareDnd5eOwnedCompanionMovement(input)?.movement).toBeUndefined()
  expect(planDnd5eMonsterTurn(map, actor)).toMatchObject({ moved: false, attacked: false, dodged: true })
  expect(map).toEqual(before)
})

it.each(['dash', 'disengage'] as const)('can settle %s at the held position and retain an execution checkpoint', command => {
  const { actor, input } = fixture(command)
  const result = resolveDnd5eMonsterMovementAction(input, command)
  expect(result.ok && result.result.ok).toBe(true)
  if (!result.ok || !result.result.ok || !result.application) return
  expect(result.result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
  const restored = JSON.parse(JSON.stringify(result.application.map)) as BattleMap
  const token = restored.tokens.find(token => token.id === actor.id)!
  expect(dnd5eExecutableCompanionOrder(token, 'combat:1:undead')).toBeDefined()
  token.dnd5eCombatState!.companionCommand!.executedTurnKey = 'combat:1:undead'
  expect(dnd5eExecutableCompanionOrder(JSON.parse(JSON.stringify(token)), 'combat:1:undead')).toBeUndefined()
  expect(dnd5eExecutableCompanionOrder(token, 'combat:2:undead')).toBeDefined()
  token.dnd5eSummon!.controlEnded = true
  expect(dnd5eExecutableCompanionOrder(token, 'combat:2:undead')).toBeUndefined()
})

it('persists Disengage through map reload and removes it at turn end',()=>{
 const {actor,input}=fixture('disengage')
 const result=resolveDnd5eMonsterMovementAction(input,'disengage')
 expect(result.ok&&result.result.ok).toBe(true)
 if(!result.ok||!result.application)throw Error('Disengage failed')
 const saved=JSON.parse(JSON.stringify(result.application.map)) as BattleMap
 const snapshot=createDnd5eMapCombatSnapshot({...input,map:saved})
 expect(snapshot.state.combatants[actor.id].disengaged).toBe(true)
 const ended=resolveDnd5eHeadlessAction(snapshot.state,{type:'end-turn',actorId:actor.id})
 expect(ended.ok).toBe(true)
 expect(ended.state.combatants[actor.id].disengaged).toBe(false)
 expect(ended.state.combatants[actor.id].classState.disengagedTurnKey).toBeUndefined()
})


it('retains a readied order through turn end and reports only its actual triggered completion',()=>{
 const {actor,input}=fixture()
 const order=actor.dnd5eCombatState!.companionCommand!
 order.command='ready';order.attackTargetId=undefined;order.movementDestination=undefined
 order.ready={trigger:'收到约定信号',actionKind:'other'}
 const state=createDnd5eMapCombatSnapshot(input).state
 const declared=resolveDnd5eHeadlessAction(state,{type:'ready',actorId:actor.id,trigger:order.ready.trigger,actionKind:'other'})
 expect(declared.ok).toBe(true)
 const ended=resolveDnd5eHeadlessAction(declared.state,{type:'end-turn',actorId:actor.id})
 expect(ended.ok).toBe(true)
 expect(ended.state.combatants[actor.id].classState.companionCommand?.command).toBe('ready')
 expect(ended.events.some(event=>event.type==='companion-order-completed')).toBe(false)
 const triggered=resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(ended.state)),{type:'trigger-readied-action',actorId:actor.id})
 expect(triggered.ok).toBe(true)
 expect(triggered.state.combatants[actor.id].turn.reactionAvailable).toBe(false)
 expect(triggered.state.combatants[actor.id].classState.companionCommand).toBeUndefined()
 expect(triggered.events.filter(event=>event.type==='companion-order-completed')).toHaveLength(1)
 const repeated=resolveDnd5eHeadlessAction(triggered.state,{type:'trigger-readied-action',actorId:actor.id})
 expect(repeated.ok).toBe(false)
 expect(repeated.events.some(event=>event.type==='companion-order-completed')).toBe(false)
})
