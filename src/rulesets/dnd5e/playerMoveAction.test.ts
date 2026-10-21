import {withDnd5ePendingMovementCompletion} from './pendingMovementCompletion'
import { recordDnd5eAcceptedMovementSightings } from './mapMovementSightings'
import { afterEach, describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eTurnEconomyCounts, spendDnd5eMovement } from './turnEconomy'
import {
  prepareDnd5eExplorationMove,
  resolvePreparedDnd5eExplorationMove,
  prepareDnd5ePlayerMove,
  resolveDnd5ePlayerDisengage,
  resolveDnd5ePlayerDodge,
  resolvePreparedDnd5ePlayerMove,
} from './playerMoveAction'
import {
  createDnd5eConditionEffect,
  createDnd5eMechanicalEffect,
  dnd5eConditionsFromActiveEffects,
} from './activeEffects'
import { migrateLegacyDnd5eConditions } from './legacyActiveEffectMigration'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { resolveDnd5eMonsterMapMove } from './monsterMoveAction'
import { advanceDnd5eCampaignTimedActiveEffects } from './campaignTimeRules'
import { createTokenMovementAnimation } from '../../lib/tokenMovementAnimation'
import {prepareDnd5eMovementEffectDice} from './movementEffectDice'
import {coordinateDnd5eMovementHazards} from '../../application/maps/MovementHazardCoordinator'

function character(): Character {
  return {
    id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '人类', charClass: '战士', level: 3,
    background: '', experience: 0, reputation: 0, rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '3d10', ac: 18, speed: 30, initiativeBonus: 1,
    saveDC: 0, passivePerception: 10, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

const map: BattleMap = {
  id: 'map', name: '地图', width: 300, height: 200, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0,
  showGrid: true, feetPerCell: 5,
  tokens: [
    { id: 'hero-token', label: '英雄', x: 5, y: 5, color: '', emoji: '', size: 1, type: 'player', characterId: 'hero', hp: 30, maxHp: 30 },
    { id: 'enemy-token', label: '敌人', x: 105, y: 5, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10 },
  ],
}

const action: SharedPlayerActionState = {
  id: 'move', mapId: 'map', combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'move-token',
  actorTokenId: 'hero-token', characterId: 'hero', targetPosition: { x: 25, y: 5 }, round: 1, initiativeIndex: 0,
  seq: 1, updatedAt: 1,
}

it('permits qualified conscious zero-HP movement while retaining ordinary defeat gates', () => {
  let featureId = ''
  const dispose = registerDnd5eRulesPlugin({manifest:{id:'test.zero-move',name:'Movement',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    featureId=api.registerFeature({id:'defer',name:'Defer',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{
      schemaVersion:1,id:'defer',name:'Defer',description:'Synthetic',level:1,trigger:{kind:'passive'},cost:{economy:'none'},targeting:{kind:'self'},effects:[],mechanic:{kind:'rage-death-deferral'},automation:'full',
    }})
  }})
  try {
    for (const mode of ['active','not-raging','unowned','dead','exhausted'] as const) {
      const hero=character()
      hero.currentHp=0
      hero.dnd5ePluginFeatureIds=mode==='unowned'?[]:[featureId]
      hero.dnd5eCombatState={raging:mode!=='not-raging',rageTurnsRemaining:5,...(mode==='dead'?{deathRound:1}:{})}
      if(mode==='exhausted')hero.exhaustionLevel=6
      const input={action,map,characters:[hero],initiativeOrder:[{tokenId:'hero-token',label:'Hero',emoji:'',color:'',roll:20}],turnEconomy:createDnd5eTurnEconomyCounts('turn',30)}
      const prepared=prepareDnd5ePlayerMove(input)
      expect(prepared.ok,mode).toBe(mode==='active')
      expect(prepareDnd5eExplorationMove({...input,action:{...action,combatId:undefined}}).ok,mode).toBe(mode==='active')
      if(prepared.ok){
        const settled=resolvePreparedDnd5ePlayerMove({prepared:prepared.prepared})
        expect(settled.result.ok).toBe(true)
        expect(settled.result.state.combatants['hero-token'].position).toMatchObject({x:25,y:5})
      }
    }
  } finally { dispose() }
})

it.each([1,4])('collects temple penalty dice for a player combat move (%s)',async penalty=>{
 const hero=character()
 hero.dnd5eCombatState={schemaVersion:2,wildShapeFormId:'srd-5.1:imp',wildShapeMode:'shapechange',wildShapeCurrentHp:10,wildShapeRoundsRemaining:600,wildShapeMaximumChallengeRating:20,
  wildShapeOriginalCurrentHp:hero.currentHp,wildShapeOriginalMaxHp:hero.maxHp,wildShapeOriginalArmorClass:hero.ac,wildShapeOriginalSpeed:hero.speed,
  wildShapeOriginalAbilities:{...hero.abilities},wildShapeOriginalSavingThrowBonuses:{}}
 const current={...map,tokens:[map.tokens[0]]}
 const geometry=createEmptyMapGeometry(map.id)
 geometry.structureLifetimes=[0,20].map((x,index)=>({id:`temple-${index}`,casterId:'builder',createdWorldMinute:0,expiresWorldMinute:1440,entityIds:[],replacementGroup:'temple-of-the-gods' as const,
  objectBoundary:{points:[{x,y:0},{x:x+20,y:0},{x:x+20,y:30},{x,y:30}],bottomFeet:0,topFeet:20},
  templeWard:{hostileCreatureTypes:['fiend'],saveDc:18,healingBonus:5,lighting:'none'}}))
 try{
  setMapGeometryRuntime([geometry])
  const prepared=prepareDnd5ePlayerMove({worldMinute:100,action,map:current,characters:[hero],initiativeOrder:[{tokenId:'hero-token',label:'Hero',emoji:'',color:'',roll:20}],turnEconomy:createDnd5eTurnEconomyCounts('turn',30)})
  expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
  const boundary=prepared.prepared.boundarySavingThrows[0]
  expect(boundary).toBeDefined()
  const input={prepared:prepared.prepared,transactionId:'player-temple-effect-dice',deferSolidMaterialExit:true,
   boundarySavingThrows:[{effectId:boundary.effectId,d20:19-boundary.requirement.modifier,d20Second:19-boundary.requirement.modifier}]}
  const before=structuredClone(prepared.prepared.state)
  let count=0
  const dice=await prepareDnd5eMovementEffectDice({resolve:effectRollDice=>resolvePreparedDnd5ePlayerMove({...input,effectRollDice}),
   isCurrent:()=>true,roll:async recipe=>{count++;expect(recipe.sides).toBe(4);return [penalty]}})
  expect(dice.ok).toBe(true);if(!dice.ok)throw Error(dice.reason)
  const settled=resolvePreparedDnd5ePlayerMove({...input,effectRollDice:dice.rolls})
  expect(settled.result.ok,JSON.stringify(settled.result)).toBe(true)
  expect(count).toBe(1)
  expect(settled.result.state.combatants['hero-token'].position).toEqual({x:penalty===1?25:5,y:5})
  if(penalty===4)expect(settled.result.state.combatants['hero-token'].turn.movementSpent??0).toBe(0)
  if(penalty===4){
   const hazards=await coordinateDnd5eMovementHazards({state:settled.result.state,map:current,characters:[hero],
    characterIdByCombatantId:prepared.prepared.characterIdByCombatantId,initialApplication:settled.application,movements:[],initiativeOrder:[],
    settleStep:async()=>{throw Error('Denied movement must not enter another area')}})
   expect(hazards.application.changedCharacterIds).toContain(hero.id)
   expect(hazards.application.characters[0].dnd5eCombatState?.activeEffects).toContainEqual(expect.objectContaining({definitionId:'temple-of-the-gods:entry-denied'}))
  }
  expect(prepared.prepared.state).toEqual(before)
 }finally{setMapGeometryRuntime([])}
})

it.each([
 ['ethereal',0],['stone',0],['ethereal',1],['stone',1],
] as const)('enforces temple boundaries in Host combat and exploration movement for %s with origin offset %s',(mode,offset)=>{
 const movementMap={...map,tokens:map.tokens.map(token=>token.id==='hero-token'?{...token,x:token.x+offset}:token)}
 const hero=character()
 hero.dnd5eCombatState={schemaVersion:2,activeEffects:[createDnd5eMechanicalEffect({definitionId:'travel',label:'Travel',targetId:'hero-token',source:{kind:'spell',actorId:'hero-token'},
 modifiers:mode==='ethereal'?{planarPhase:{plane:'ethereal',ignoresMaterialCollision:true,suppressCrossPlaneEffects:true,unrestrictedVerticalMovement:true}}:
 {solidMaterialTraversal:{materials:['stone'],endInside:'eject-end-source-stun-until-next-turn-end'}}})]}
 const geometry=createEmptyMapGeometry(map.id)
 geometry.walls=[{id:'temple-wall',kind:'wall',label:'Stone-looking force wall',material:'stone',points:[{x:15,y:0},{x:15,y:200}],baseHeightFeet:0,heightFeet:100,
 blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
 const initiativeOrder=[{tokenId:'hero-token',label:'Hero',emoji:'',color:'',roll:20},{tokenId:'enemy-token',label:'Enemy',emoji:'',color:'',roll:10}]
 const prepare=()=>[
  prepareDnd5ePlayerMove({action,map:movementMap,characters:[hero],initiativeOrder,turnEconomy:createDnd5eTurnEconomyCounts('turn',30)}),
  prepareDnd5eExplorationMove({action:{...action,combatId:undefined},map:movementMap,characters:[hero]})]
 try{
  setMapGeometryRuntime([geometry])
  for(const result of prepare())expect(result.ok,result.ok?undefined:result.reason).toBe(true)
  geometry.structureLifetimes=[{id:'temple',casterId:'caster',createdWorldMinute:0,expiresWorldMinute:1440,entityIds:['temple-wall'],replacementGroup:'temple-of-the-gods',siteKey:'site',
   objectBoundary:{points:[{x:15,y:0},{x:100,y:0},{x:100,y:200},{x:15,y:200}],bottomFeet:0,topFeet:100},
   templeWard:{hostileCreatureTypes:['fiend'],saveDc:18,healingBonus:5,lighting:'none'}}]
  setMapGeometryRuntime([geometry])
  for(const result of prepare())expect(result.ok).toBe(false)
 }finally{setMapGeometryRuntime([])}
})

it.each([
  ['player', true], ['monster', true], ['player', false], ['monster', false],
  ['exploration', true], ['exploration', false],
] as const)('settles %s solid traversal (ends inside=%s) through the actual movement adapter', (kind, inside) => {
  const moveAction = { ...action, targetPosition: { x: inside ? 25 : 35, y: 5 } }
  const actor = character()
  actor.concentrating = true
  actor.dnd5eCombatState = { schemaVersion: 2, concentrationSpellId: 'test:stone', activeEffects: [createDnd5eMechanicalEffect({
    definitionId: 'test:stone:body', label: 'Stone', targetId: 'hero-token',
    source: { kind: 'spell', actorId: 'hero-token', rulesId: 'test:stone', magical: true },
    duration: { type: 'concentration', sourceActorId: 'hero-token', concentrationId: 'test:stone', remainingRounds: 100 },
    modifiers: { solidMaterialTraversal: { materials: ['earth', 'stone'], endInside: 'eject-end-source-stun-until-next-turn-end' } },
  })] }
  const current: BattleMap = { ...map, tokens: [{ ...map.tokens[0], ...(kind === 'monster' ? {
    type: 'enemy' as const, characterId: undefined, poolId: 'srd-5.1:goblin', dnd5eCombatState: actor.dnd5eCombatState,
  } : {}) }] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.obstacles.push({ id: 'stone', kind: 'obstacle', label: 'Stone', surfaceMaterial: 'stone',
    points: [{ x: 20, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 200 }, { x: 20, y: 200 }],
    blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, cover: 'total',
    heightFeet: 10, baseHeightFeet: 0, createdAt: 1 })
  setMapGeometryRuntime([geometry])
  const initiativeOrder = [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }]
  try {
    const before = structuredClone({ current, actor })
    if (kind === 'exploration') {
      const prepared = prepareDnd5eExplorationMove({ action: { ...moveAction, combatId: undefined }, map: current, characters: [actor] })
      if (!prepared.ok) throw new Error(prepared.reason)
      const deferred = resolvePreparedDnd5eExplorationMove({ prepared: prepared.prepared, map: current,
        characters: [actor], deferSolidMaterialExit: true })
      if (!deferred.ok) throw new Error(deferred.reason)
      expect(deferred.state.active).toBe(false)
      expect(deferred.state.combatants['hero-token'].position).toEqual(moveAction.targetPosition)
      expect(deferred.characterIdByCombatantId['hero-token']).toBe(actor.id)
      expect(deferred.application.characters.find(entry => entry.id === actor.id)?.concentrating).toBe(true)
      expect(deferred.state.combatants['hero-token'].conditions).not.toContain('stunned')
      const resolved = resolvePreparedDnd5eExplorationMove({ prepared: prepared.prepared, map: current, characters: [actor] })
      if (!resolved.ok) throw new Error(resolved.reason)
      expect(resolved.prepared.to).toEqual({ x: inside ? 15 : 35, y: 5 })
      expect(resolved.application.map.tokens[0]).toMatchObject({ x: inside ? 15 : 35, y: 5 })
      const updated = resolved.application.characters.find(character => character.id === actor.id)!
      expect(updated.concentrating).toBe(!inside)
      expect(updated.dnd5eCombatState?.activeEffects?.some(effect => effect.standardCondition === 'stunned')).toBe(inside)
      if (inside) {
        const animation = createTokenMovementAnimation({ id: 'exploration-ejection', issuedAt: 1,
          path: resolved.prepared.path, finalPosition: resolved.prepared.to })!
        expect(animation.points).toContainEqual({ x: 25, y: 5 })
        expect(animation.points.at(-1)).toEqual({ x: 15, y: 5 })
        const advanced = advanceDnd5eCampaignTimedActiveEffects(updated, 0.1)
        expect((advanced.dnd5eCombatState?.activeEffects ?? []).some(effect => effect.standardCondition === 'stunned')).toBe(false)
        expect(advanced.conditions).not.toContain('stunned')
      }
      expect({ current, actor }).toEqual(before)
      return
    }
    const resolve = () => {
      if (kind === 'monster') {
        const value = resolveDnd5eMonsterMapMove({ combatId: 'combat', round: 1, map: current, characters: [],
          initiativeOrder, actorTokenId: 'hero-token', to: moveAction.targetPosition,
          turnEconomy: createDnd5eTurnEconomyCounts('turn', 30) })
        if (!value.ok) throw new Error(value.reason)
        return value
      }
      const value = prepareDnd5ePlayerMove({ action: moveAction, map: current, characters: [actor], initiativeOrder,
        turnEconomy: createDnd5eTurnEconomyCounts('turn', 30) })
      if (!value.ok) throw new Error(value.reason)
      return resolvePreparedDnd5ePlayerMove({ prepared: value.prepared })
    }
    const resolved = resolve()
    expect(resolved.result.ok).toBe(true)
    const moved = resolved.result.state.combatants['hero-token']
    expect(moved.position).toEqual({ x: inside ? 15 : 35, y: 5 })
    expect(moved.concentrating).toBe(!inside)
    expect(moved.conditions.includes('stunned')).toBe(inside)
    expect(moved.turn.movementRemaining).toBe(inside ? 0 : 15)
    expect(moved.turn.movementSpent).toBe(inside ? 10 : 15)
    expect(resolved.application?.map.tokens[0]).toMatchObject({ x: inside ? 15 : 35, y: 5 })
    const traces = 'prepared' in resolved ? resolved.prepared?.movementTraces
      : 'movementTraces' in resolved ? resolved.movementTraces : undefined
    expect(traces?.find(trace => trace.tokenId === 'hero-token')?.to).toEqual(moved.position)
    expect(traces?.find(trace => trace.tokenId === 'hero-token')?.path.at(-1)).toEqual(moved.position)
    expect(resolved.result.events.filter(event => event.type === 'moved')).toHaveLength(inside ? 2 : 1)
    expect({ current, actor }).toEqual(before)
  } finally { setMapGeometryRuntime([]) }
})

it.each([true, false])('charges movement from the live area source exemption (source=%s)', isSource => {
  const terrainMap: BattleMap = { ...map, dnd5ePluginAreas: [{
    id: 'mixed-wind', pluginId: 'test.wind', featureId: 'wind', label: 'Wind', color: '#fff',
    sourceCharacterId: isSource ? 'hero' : 'other', sourceTokenId: isSource ? 'hero-token' : 'enemy-token',
    createdRound: 1, expiresAfterRound: 11, includeSelf: true, relation: 'any',
    cells: Array.from({ length: 600 }, (_, index) => ({ col: index % 30, row: Math.floor(index / 30) })),
    movementCostMultiplier: 2, movementExcludesSource: true, occupantModifiers: { conditions: ['deafened'] },
  }] }
  const prepared = prepareDnd5ePlayerMove({ action, map: terrainMap, characters: [character()],
    initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }],
    turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
  })
  expect(prepared, JSON.stringify(prepared)).toMatchObject({ ok: true, prepared: { movementCostFeet: isSource ? 10 : 20 } })
})

function playerGrappleRelation() {
  return createDnd5eConditionEffect({
    id: 'hero-grapple-relation',
    condition: 'grappled',
    source: { kind: 'feature', actorId: 'hero-token', rulesId: 'basic-action:grapple' },
    targetId: 'enemy-token',
    relation: {
      schemaVersion: 1,
      kind: 'grapple',
      sourceActorId: 'hero-token',
      sourceActionId: 'basic-action:grapple',
      slotGroup: 'free-hand',
      maxDistanceFeet: 5,
      movement: 'drag-target',
      endsOnSourceIncapacitated: true,
    },
  })
}

it.each(['thick', 'ice'] as const)('validates free exploration across %s spell panels using the same material rules', mode => {
  const actor = character()
  actor.dnd5eCombatState = { schemaVersion: 2, activeEffects: [createDnd5eMechanicalEffect({
    definitionId: 'test:stone', label: 'Stone', targetId: 'hero-token', source: { kind: 'spell', actorId: 'hero-token' },
    modifiers: { solidMaterialTraversal: { materials: ['stone'], endInside: 'eject-end-source-stun-until-next-turn-end' } },
  })] }
  const freeMap: BattleMap = { ...map, snapMonstersToGrid: false, tokens: [map.tokens[0]],
    dnd5ePluginAreas: [{ id: 'wall', pluginId: 'test.wall', featureId: 'wall', label: 'Wall', color: '#aaa',
      sourceCharacterId: 'hero', sourceTokenId: 'hero-token',
      cells: [], createdRound: 1, expiresAfterRound: 100,
      stoneWall: { mode, saveDc: 15, panels: [{ id: 'panel', start: { col: 2, row: -1 }, end: { col: 2, row: 21 },
        cells: [], hitPoints: 30, maxHitPoints: 30 }] },
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 },
    }] }
  const before = structuredClone(freeMap)
  const prepared = prepareDnd5eExplorationMove({ action: { ...action, combatId: undefined, targetPosition: { x: 37, y: 7 } },
    map: freeMap, characters: [actor] })
  expect(prepared.ok).toBe(mode === 'thick')
  if (prepared.ok) expect(prepared.prepared.path.at(-1)).toEqual({ x: 37, y: 7 })
  expect(freeMap).toEqual(before)
})

function playerDragMap(): BattleMap {
  return {
    ...map,
    tokens: [
      { ...map.tokens[0], x: 5, y: 5 },
      {
        ...map.tokens[1],
        x: 5,
        y: 15,
        dnd5eCombatState: {
          schemaVersion: 2,
          activeEffects: [playerGrappleRelation()],
          conditions: ['grappled'],
        },
      },
    ],
  }
}

describe('D&D 5e player map movement', () => {
  it('commits a failed boundary save without moving the player or spending movement', () => {
    const hero = character()
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects: [createDnd5eMechanicalEffect({
      id: 'boundary', definitionId: 'boundary', label: 'Boundary', targetId: 'hero-token', source: { kind: 'spell', actorId: 'enemy-token' },
      modifiers: { movementBoundarySave: { maximumDistanceFeet: 15, ability: 'wis', dc: 15 } },
    })] }
    const current = { ...map, tokens: map.tokens.map(token => token.id === 'enemy-token' ? { ...token, x: 5, y: 25, poolId: 'srd-5.1:goblin' } : token) }
    const prepared = prepareDnd5ePlayerMove({ action: { ...action, targetPosition: { x: 65, y: 5 } }, map: current, characters: [hero],
      initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }, { tokenId: 'enemy-token', label: 'Source', emoji: '', color: '', roll: 10 }],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30) })
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared, boundarySavingThrows: [{ effectId: 'boundary', d20: 1 }] })
    expect(resolved.result).toMatchObject({ ok: true, movementBlocked: 'saving-throw' })
    expect(resolved.application?.map.tokens.find(token => token.id === 'hero-token')).toMatchObject({ x: 5, y: 5 })
    expect(resolved.result.state.combatants['hero-token'].turn.movementRemaining).toBe(30)
    expect(resolved.result.events.some(event => event.type === 'moved')).toBe(false)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', success: false }))
  })
  afterEach(() => setMapGeometryRuntime([]))

  it('allows an owned living player Token to move outside combat without turn economy', () => {
    const prepared = prepareDnd5eExplorationMove({
      action: {
        ...action,
        combatId: undefined,
        targetPosition: { x: 25, y: 5 },
      },
      map,
      characters: [character()],
    })

    expect(prepared).toMatchObject({
      ok: true,
      prepared: {
        actor: { id: 'hero' },
        actorToken: { id: 'hero-token' },
        to: { x: 25, y: 5 },
        toElevationFeet: 0,
      },
    })
    if (!prepared.ok) return
    expect(prepared.prepared.path.at(0)).toEqual({ x: 5, y: 5 })
    expect(prepared.prepared.path.at(-1)).toEqual({ x: 25, y: 5 })
  })

  it('preserves a free exploration destination when map snapping is disabled', () => {
    const prepared = prepareDnd5eExplorationMove({
      action: {
        ...action,
        combatId: undefined,
        targetPosition: { x: 27, y: 7 },
      },
      map: { ...map, snapMonstersToGrid: false },
      characters: [character()],
    })

    expect(prepared).toMatchObject({
      ok: true,
      prepared: {
        to: { x: 27, y: 7 },
      },
    })
    if (!prepared.ok) return
    expect(prepared.prepared.path.at(-1)).toEqual({ x: 27, y: 7 })
  })

  it('starts a later free move at the previously accepted arbitrary position', () => {
    const freeMap: BattleMap = {
      ...map,
      snapMonstersToGrid: false,
      tokens: map.tokens.map((token) => token.id === 'hero-token'
        ? { ...token, x: 27, y: 7 }
        : token),
    }
    const prepared = prepareDnd5eExplorationMove({
      action: {
        ...action,
        combatId: undefined,
        targetPosition: { x: 43, y: 18 },
      },
      map: freeMap,
      characters: [character()],
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.path.at(0)).toEqual({ x: 27, y: 7 })
    expect(prepared.prepared.path.at(-1)).toEqual({ x: 43, y: 18 })
  })

  it('routes ground exploration around Grease but lets an airborne Token fly over it', () => {
    const blockers = [1, 2, 3, 4, 5].flatMap((col) => [1, 3].map((row) => ({
      id: `blocker-${col}-${row}`,
      label: 'Blocker',
      x: col * 10 + 5,
      y: row * 10 + 5,
      color: '',
      emoji: '',
      size: 1,
      type: 'obstacle' as const,
    })))
    const greaseMap: BattleMap = {
      ...map,
      width: 70,
      height: 50,
      tokens: [
        { ...map.tokens[0], x: 5, y: 25 },
        ...blockers,
      ],
      dnd5ePluginAreas: [{
        id: 'grease-area',
        pluginId: 'srd-5.1',
        featureId: 'srd-5.1:spell:grease',
        sourceKind: 'core-spell',
        coreSpellId: 'grease',
        label: 'Grease',
        color: '#fde68a',
        sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token',
        cells: [1, 2, 3, 4, 5].map((col) => ({ col, row: 2 })),
        createdRound: 1,
        expiresAfterRound: 10,
        relation: 'any',
        includeSelf: true,
        movementCostMultiplier: 2,
        vertical: { mode: 'ground' },
      }],
    }
    const explorationAction: SharedPlayerActionState = {
      ...action,
      combatId: undefined,
      targetPosition: { x: 65, y: 25 },
    }

    const grounded = prepareDnd5eExplorationMove({
      action: explorationAction,
      map: greaseMap,
      characters: [character()],
    })
    const airborne = prepareDnd5eExplorationMove({
      action: explorationAction,
      map: {
        ...greaseMap,
        tokens: greaseMap.tokens.map((candidate) =>
          candidate.id === 'hero-token'
            ? { ...candidate, elevationFeet: 10 }
            : candidate),
      },
      characters: [character()],
    })

    expect(grounded.ok).toBe(true)
    expect(airborne.ok).toBe(true)
    if (!grounded.ok || !airborne.ok) return
    expect(grounded.prepared.path.some((point) => point.y !== 25)).toBe(true)
    expect(airborne.prepared.path).toHaveLength(7)
    expect(airborne.prepared.path.every((point) => point.y === 25)).toBe(true)
    expect(airborne.prepared.pathElevationsFeet.every((elevation) => elevation === 10)).toBe(true)
  })

  it('rejects exploration movement for a combat envelope, a defeated actor, or another Token', () => {
    expect(prepareDnd5eExplorationMove({
      action,
      map,
      characters: [character()],
    })).toEqual({ ok: false, reason: 'invalid-action' })

    expect(prepareDnd5eExplorationMove({
      action: { ...action, combatId: undefined },
      map,
      characters: [{ ...character(), currentHp: 0 }],
    })).toEqual({ ok: false, reason: 'invalid-actor' })

    expect(prepareDnd5eExplorationMove({
      action: {
        ...action,
        combatId: undefined,
        actorTokenId: 'enemy-token',
      },
      map,
      characters: [character()],
    })).toEqual({ ok: false, reason: 'invalid-actor' })
  })

  it('keeps exploration movement behind DM-authored walls', () => {
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'sealed-wall',
        kind: 'wall',
        label: 'Sealed wall',
        points: [{ x: 10, y: 0 }, { x: 10, y: 200 }],
        blocksVision: true,
        blocksMovement: true,
        blocksLineOfEffect: true,
        baseHeightFeet: 0,
        heightFeet: 10,
        createdAt: 1,
      }],
      doors: [],
      obstacles: [],
      vision: {
        enabled: false,
        defaultRangeFeet: 60,
        sharePartyVision: true,
        ambientLight: 'bright',
      },
      updatedAt: 1,
    }])

    expect(prepareDnd5eExplorationMove({
      action: {
        ...action,
        combatId: undefined,
        targetPosition: { x: 25, y: 5 },
      },
      map,
      characters: [character()],
    })).toEqual({ ok: false, reason: 'movement-blocked' })
  })

  it('moves a gaseous player through ordinary legacy door cracks but not an explicitly airtight door', () => {
    const door = {
      id: 'legacy-door', kind: 'door' as const, label: 'Legacy door',
      points: [{ x: 10, y: 0 }, { x: 10, y: 200 }] as [{ x: number; y: number }, { x: number; y: number }],
      state: 'locked' as const, openState: 'closed' as const, lockState: 'locked' as const,
      physicalState: 'intact' as const, secret: false,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }
    const geometry = {
      mapId: map.id, walls: [], doors: [door], obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' as const },
      updatedAt: 1,
    }
    setMapGeometryRuntime([geometry])

    const mist = character()
    mist.dnd5eCombatState = {
      schemaVersion: 2,
      activeEffects: [createDnd5eMechanicalEffect({
        definitionId: 'srd-5.1:spell:gaseous-form', label: '气化形体',
        source: { kind: 'spell', actorId: 'hero-token', rulesId: 'gaseous-form', magical: true },
        targetId: 'hero-token',
        modifiers: {
          environmentalCapabilities: { occupyCreatureSpaces: true, minimumPassageGapInches: 1 },
        },
      })],
    }
    expect(prepareDnd5eExplorationMove({
      action: { ...action, combatId: undefined, targetPosition: { x: 15, y: 5 } },
      map, characters: [mist],
    })).toMatchObject({ ok: true })
    const initiativeOrder = [
      { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
      { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
    ]
    expect(prepareDnd5ePlayerMove({
      action: { ...action, dnd5eTraversalMode: 'fly', targetPosition: { x: 15, y: 5 } },
      map, characters: [mist], initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 10),
    })).toMatchObject({ ok: true })
    expect(prepareDnd5ePlayerMove({
      action: { ...action, dnd5eTraversalMode: 'walk', targetPosition: { x: 15, y: 5 } },
      map, characters: [mist], initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 10),
    })).toEqual({ ok: false, reason: 'movement-blocked' })

    setMapGeometryRuntime([{ ...geometry, doors: [{ ...door, passageGapInches: 0 }] }])
    expect(prepareDnd5eExplorationMove({
      action: { ...action, combatId: undefined, targetPosition: { x: 15, y: 5 } },
      map, characters: [mist],
    })).toEqual({ ok: false, reason: 'movement-blocked' })
    expect(prepareDnd5ePlayerMove({
      action: { ...action, dnd5eTraversalMode: 'fly', targetPosition: { x: 15, y: 5 } },
      map, characters: [mist], initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 10),
    })).toEqual({ ok: false, reason: 'movement-blocked' })
  })

  it('projects linked character effects into map geometry so Wind Wall blocks Gaseous Form', () => {
    const mist = character()
    mist.dnd5eCombatState = {
      schemaVersion: 2,
      activeEffects: [createDnd5eMechanicalEffect({
        definitionId: 'srd-5.1:spell:gaseous-form', label: '气化形体',
        source: { kind: 'spell', actorId: 'hero-token', rulesId: 'gaseous-form', magical: true },
        targetId: 'hero-token',
      })],
    }
    const windWallMap: BattleMap = {
      ...map,
      dnd5ePluginAreas: [{
        id: 'wind-wall-area', sourceKind: 'core-spell', coreSpellId: 'wind-wall',
        pluginId: 'srd-5.1', featureId: 'spell:wind-wall', color: '#ffffff',
        label: '风墙术', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
        slotLevel: 3, createdRound: 1, expiresAfterRound: 11,
        anchorMode: 'fixed', cells: [{ col: 1, row: 0 }],
        vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 15 },
        blocking: { movement: true, movementMode: 'boundary' },
      }],
    }
    expect(prepareDnd5eExplorationMove({
      action: { ...action, combatId: undefined, targetPosition: { x: 15, y: 5 } },
      map: windWallMap, characters: [mist],
    })).toEqual({ ok: false, reason: 'movement-blocked' })
    expect(prepareDnd5ePlayerMove({
      action: { ...action, dnd5eTraversalMode: 'fly', targetPosition: { x: 15, y: 5 } },
      map: windWallMap, characters: [mist],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 10),
    })).toEqual({ ok: false, reason: 'movement-blocked' })
  })

  it('routes around a DM-authored movement blocker instead of crossing it', () => {
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'wall', kind: 'wall', label: '墙', points: [{ x: 15, y: 0 }, { x: 15, y: 20 }],
        blocksVision: false, blocksMovement: true, blocksLineOfEffect: false,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
      doors: [], obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' }, updatedAt: 1,
    }])
    const prepared = prepareDnd5ePlayerMove({
      action, map, characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.distanceFeet).toBeGreaterThan(10)
    expect(prepared.prepared.path).not.toContainEqual({ x: 15, y: 5 })
  })

  it('lets an Etherealness target cross material walls and creatures and charges vertical movement twice', () => {
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'material-wall', kind: 'wall', label: '实体墙',
        points: [{ x: 15, y: 0 }, { x: 15, y: 20 }],
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 20, createdAt: 1,
      }],
      doors: [], obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])
    const occupiedMap: BattleMap = {
      ...map,
      height: 20,
      tokens: map.tokens.map((token) => token.id === 'enemy-token'
        ? { ...token, x: 25, y: 5 }
        : token),
    }
    const etherealHero = character()
    etherealHero.dnd5eCombatState = {
      schemaVersion: 2,
      activeEffects: [createDnd5eMechanicalEffect({
        definitionId: 'activity:spell:etherealness:etherealness',
        label: '以太化',
        source: { kind: 'spell', actorId: 'hero-token', rulesId: 'etherealness', magical: true },
        targetId: 'hero-token',
        modifiers: {
          planarPhase: {
            plane: 'ethereal',
            ignoresMaterialCollision: true,
            suppressCrossPlaneEffects: true,
            unrestrictedVerticalMovement: true,
          },
        },
      })],
    }
    const initiativeOrder = [
      { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
      { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
    ]

    expect(prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 25, y: 5 } },
      map: occupiedMap, characters: [character()], initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })).toEqual({ ok: false, reason: 'movement-blocked' })
    const throughMaterial = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 25, y: 5 } },
      map: occupiedMap, characters: [etherealHero], initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(throughMaterial).toMatchObject({
      ok: true,
      prepared: { distanceFeet: 10, movementCostFeet: 10, to: { x: 25, y: 5 } },
    })

    const vertical = prepareDnd5ePlayerMove({
      action: {
        ...action,
        targetPosition: { x: 5, y: 5 },
        dnd5eTraversalMode: 'fly',
        targetElevationFeet: 15,
      },
      map: occupiedMap, characters: [etherealHero], initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(vertical).toMatchObject({
      ok: true,
      prepared: { distanceFeet: 0, movementCostFeet: 30, toElevationFeet: 15 },
    })
    if (!vertical.ok) throw Error('ethereal ascent rejected')
    const climbed = resolvePreparedDnd5ePlayerMove({ prepared: vertical.prepared })
    expect(climbed.result.ok, climbed.result.ok ? undefined : climbed.result.reason).toBe(true)
    expect(climbed.result.state.combatants['hero-token'].turn.movementRemaining).toBe(0)
    expect(climbed.application?.map.tokens.find(token => token.id === 'hero-token')).toMatchObject({ elevationFeet: 15 })
    expect(climbed.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', resource: 'movement', amount: 30,
    }))

    // A descent is voluntary movement as well; it is not a free material-plane fall.
    const elevatedMap = { ...occupiedMap, tokens: occupiedMap.tokens.map(token =>
      token.id === 'hero-token' ? { ...token, elevationFeet: 15 } : token) }
    for (const available of [29, 30]) {
      const descent = prepareDnd5ePlayerMove({
        action: { ...action, targetPosition: { x: 5, y: 5 }, dnd5eTraversalMode: 'fly', targetElevationFeet: 0 },
        map: elevatedMap, characters: [etherealHero], initiativeOrder,
        turnEconomy: createDnd5eTurnEconomyCounts('turn', available),
      })
      expect(descent.ok).toBe(available === 30)
      if (!descent.ok) continue
      expect(descent.prepared.movementCostFeet).toBe(30)
      const descended = resolvePreparedDnd5ePlayerMove({ prepared: descent.prepared })
      expect(descended.result.ok).toBe(true)
      expect(descended.result.state.combatants['hero-token'].turn.movementRemaining).toBe(0)
      expect(descended.application?.map.tokens.find(token => token.id === 'hero-token')).toMatchObject({ elevationFeet: 0 })
      expect(descended.result.events.some(event => event.type === 'damage-applied')).toBe(false)
    }
  })

  it('spends movement feet through the 5e Headless engine and never changes AP', () => {
    const hero = character()
    const prepared = prepareDnd5ePlayerMove({
      action, map, characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.distanceFeet).toBe(10)
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'turn-resource-spent', resource: 'movement', amount: 10 }))
    expect(resolved.application?.map.tokens.find((token) => token.id === 'hero-token')).toMatchObject({ x: 25, y: 5 })
  })

  it('moves a grappled target with the player and spends double movement', () => {
    const dragMap = playerDragMap()
    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 25, y: 5 } },
      map: dragMap,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      distanceFeet: 10,
      movementCostFeet: 20,
      movementTraces: [
        {
          tokenId: 'hero-token',
          to: { x: 25, y: 5 },
          path: [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 25, y: 5 }],
        },
        {
          tokenId: 'enemy-token',
          to: { x: 25, y: 15 },
          path: [{ x: 5, y: 15 }, { x: 15, y: 15 }, { x: 25, y: 15 }],
        },
      ],
    })
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: 'hero-token',
      resource: 'movement',
      amount: 20,
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'moved',
      actorId: 'enemy-token',
      from: { x: 5, y: 15 },
      to: { x: 25, y: 15 },
    }))
    expect(resolved.application?.map.tokens.find((token) => token.id === 'hero-token'))
      .toMatchObject({ x: 25, y: 5 })
    expect(resolved.application?.map.tokens.find((token) => token.id === 'enemy-token'))
      .toMatchObject({ x: 25, y: 15 })
    expect(resolved.application?.changedTokenIds).toEqual(expect.arrayContaining([
      'hero-token',
      'enemy-token',
    ]))
  })

  it('does not let the dragged target occupy and block the source path', () => {
    const dragMap = playerDragMap()
    dragMap.tokens = dragMap.tokens.map((entry) => entry.id === 'enemy-token'
      ? { ...entry, x: 15, y: 5 }
      : entry)
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'corridor-bottom',
        kind: 'wall',
        label: 'Corridor bottom',
        points: [{ x: 0, y: 10 }, { x: 40, y: 10 }],
        blocksVision: false,
        blocksMovement: true,
        blocksLineOfEffect: false,
        baseHeightFeet: 0,
        heightFeet: 10,
        createdAt: 1,
      }],
      doors: [],
      obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 25, y: 5 } },
      map: dragMap,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      distanceFeet: 10,
      path: [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 25, y: 5 }],
    })
  })

  it('reconciles an orphaned grapple before checking whether player movement is locked', () => {
    const hero = character()
    const orphanedGrapple = createDnd5eConditionEffect({
      id: 'orphaned-grapple',
      condition: 'grappled',
      source: { kind: 'feature', actorId: 'missing-source', rulesId: 'basic-action:grapple' },
      targetId: 'hero-token',
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: 'missing-source',
        sourceActionId: 'basic-action:grapple',
        slotGroup: 'free-hand',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    hero.conditions = ['grappled']
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects: [orphanedGrapple] }

    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 15, y: 5 } },
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants['hero-token'].conditions).not.toContain('grappled')
  })

  it('spends movement and removes a nonmagical grapple through automatic escape', () => {
    const hero = character()
    const grapple = createDnd5eConditionEffect({
      id: 'enemy-grapple', condition: 'grappled', targetId: 'hero-token',
      source: { kind: 'feature', actorId: 'enemy-token', rulesId: 'basic-action:grapple', magical: false },
      relation: {
        schemaVersion: 1, kind: 'grapple', sourceActorId: 'enemy-token',
        sourceActionId: 'basic-action:grapple', slotGroup: 'free-hand', maxDistanceFeet: 5,
        movement: 'drag-target', endsOnSourceIncapacitated: true,
      },
    })
    const freedom = createDnd5eMechanicalEffect({
      id: 'freedom', definitionId: 'activity:freedom-of-movement', label: 'Freedom of Movement',
      source: { kind: 'spell', actorId: 'hero-token', rulesId: 'freedom-of-movement', magical: true },
      targetId: 'hero-token',
      modifiers: {
        automaticEscape: {
          conditions: ['grappled', 'restrained'], movementCostFeet: 5, sourceMagical: false,
        },
      },
    })
    hero.conditions = ['grappled']
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects: [grapple, freedom] }
    const grappleMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((entry) => entry.id === 'enemy-token' ? { ...entry, x: 5, y: 15 } : entry),
    }
    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 25, y: 5 } }, map: grappleMap, characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 15),
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.movementCostFeet).toBe(15)
    expect(prepared.prepared.state.combatants['hero-token'].conditions).not.toContain('grappled')
    const blockedPreparation = structuredClone(prepared.prepared)
    blockedPreparation.state.combatants['hero-token'].classState.activeEffects!.push(createDnd5eMechanicalEffect({
      id: 'escape-boundary', definitionId: 'escape-boundary', label: 'Boundary', targetId: 'hero-token',
      source: { kind: 'spell', actorId: 'enemy-token' }, modifiers: { movementBoundarySave: { maximumDistanceFeet: 5, ability: 'wis', dc: 20 } },
    }))
    const blocked = resolvePreparedDnd5ePlayerMove({ prepared: blockedPreparation, boundarySavingThrows: [{ effectId: 'escape-boundary', d20: 1 }] })
    expect(blocked.result).toMatchObject({ ok: true, movementBlocked: 'saving-throw' })
    expect(blocked.result.state.combatants['hero-token'].conditions).toContain('grappled')
    expect(blocked.result.state.combatants['hero-token'].turn.movementRemaining).toBe(15)
    expect(blocked.result.events.some(event => event.type === 'active-effect-removed' && event.effectId === grapple.id)).toBe(false)
    expect(blocked.application?.map.tokens.find(token => token.id === 'hero-token')).toMatchObject({ x: 5, y: 5 })
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', effectId: 'enemy-grapple', reason: 'escaped',
    }))
  })

  it('keeps the authoritative swim move at normal cost when an effect ignores underwater movement penalties', () => {
    const hero = character()
    hero.dnd5eCombatState = {
      schemaVersion: 2,
      activeEffects: [createDnd5eMechanicalEffect({
        id: 'freedom',
        definitionId: 'srd-5.1:spell:freedom-of-movement',
        label: 'Freedom of Movement',
        source: { kind: 'spell', actorId: 'hero-token', rulesId: 'freedom-of-movement', magical: true },
        targetId: 'hero-token',
        modifiers: {
          environmentalCapabilities: { ignoreUnderwaterMovementPenalty: true },
        },
      })],
    }
    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 45, y: 5 }, dnd5eTraversalMode: 'swim' },
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 20),
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 20, movementCostFeet: 20 })
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants['hero-token'].turn.movementRemaining).toBe(0)
  })

  it('requests and consumes independent falling dice for the source and each dragged target', () => {
    const hero = character()
    const safeFall = createDnd5eMechanicalEffect({
      id: 'hero-safe-fall',
      definitionId: 'test:safe-fall',
      label: 'Safe fall',
      source: { kind: 'feature', actorId: 'hero-token', rulesId: 'test:safe-fall' },
      targetId: 'hero-token',
      modifiers: { safeFallFeet: 20 },
    })
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects: [safeFall] }
    const dragMap = playerDragMap()
    dragMap.tokens = dragMap.tokens.map((entry) => ({
      ...entry,
      elevationFeet: 20,
      ...(entry.id === 'enemy-token' ? { hp: 30, maxHp: 30 } : {}),
    }))

    const prepared = prepareDnd5ePlayerMove({
      action: {
        ...action,
        targetPosition: { x: 25, y: 5 },
        dnd5eTraversalMode: 'fall',
        targetElevationFeet: 0,
      },
      map: dragMap,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.fallingDamageDiceByCombatantId).toEqual({
      'hero-token': 0,
      'enemy-token': 2,
    })
    const resolved = resolvePreparedDnd5ePlayerMove({
      prepared: prepared.prepared,
      fallingDamageRollsByCombatantId: {
        'enemy-token': [6, 5],
      },
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({
      type: 'damage-applied',
      targetId: 'hero-token',
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied',
      targetId: 'enemy-token',
      amount: 11,
    }))
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'enemy-token')?.hp).toBe(19)
  })

  it('rejects dragging when the translated target route crosses a wall even if its endpoint has a detour', () => {
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'drag-lane-wall',
        kind: 'wall',
        label: 'Drag lane wall',
        points: [{ x: 10, y: 11 }, { x: 10, y: 19 }],
        blocksVision: false,
        blocksMovement: true,
        blocksLineOfEffect: false,
        baseHeightFeet: 0,
        heightFeet: 10,
        createdAt: 1,
      }],
      doors: [],
      obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    expect(prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 25, y: 5 } },
      map: playerDragMap(),
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })).toEqual({ ok: false, reason: 'movement-blocked' })
  })

  it('doubles terrain-adjusted movement cost while dragging through difficult terrain', () => {
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [],
      obstacles: [{
        id: 'mud',
        kind: 'obstacle',
        label: 'Mud',
        points: [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 100 }, { x: 10, y: 100 }],
        blocksVision: false,
        blocksMovement: false,
        blocksLineOfEffect: false,
        cover: 'none',
        baseHeightFeet: 0,
        heightFeet: 0,
        terrainCostMultiplier: 2,
        createdAt: 1,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 25, y: 5 } },
      map: playerDragMap(),
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      distanceFeet: 10,
      movementCostFeet: 40,
    })
  })

  it('ignores difficult terrain only after a generic Dash capability is committed this turn', () => {
    const pluginId = 'local.test.dash-terrain'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Dash terrain test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'dash-terrain', name: 'Dash terrain', summary: 'Synthetic feat.',
          description: 'Synthetic feat.', automation: 'full',
          staticModifiers: { ignoreDifficultTerrainWhileDashing: true },
        })
      },
    })
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [],
      obstacles: [{
        id: 'mud', kind: 'obstacle', label: 'Mud',
        points: [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 100 }, { x: 10, y: 100 }],
        blocksVision: false, blocksMovement: false, blocksLineOfEffect: false,
        cover: 'none', baseHeightFeet: 0, heightFeet: 0, terrainCostMultiplier: 2, createdAt: 1,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])
    try {
      const hero = character()
      hero.dnd5eFeatIds = [`${pluginId}:dash-terrain`]
      hero.dnd5eCombatState = { schemaVersion: 2, dashedTurnKey: 'combat:1:hero-token' }
      const prepared = prepareDnd5ePlayerMove({
        action: { ...action, targetPosition: { x: 25, y: 5 } },
        map,
        characters: [hero],
        initiativeOrder: [
          { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
          { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
        ],
        turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
      })
      expect(prepared.ok).toBe(true)
      if (prepared.ok) expect(prepared.prepared).toMatchObject({ distanceFeet: 10, movementCostFeet: 10 })
    } finally {
      dispose()
    }
  })

  it('doubles vertical traversal cost while flying with a grappled target', () => {
    const hero = character()
    hero.speed = 60
    hero.dnd5eMovementSpeeds = { fly: 60 }
    const prepared = prepareDnd5ePlayerMove({
      action: {
        ...action,
        targetPosition: { x: 25, y: 5 },
        dnd5eTraversalMode: 'fly',
        targetElevationFeet: 40,
      },
      map: playerDragMap(),
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 120),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      distanceFeet: 10,
      toElevationFeet: 40,
      movementCostFeet: 100,
    })
  })

  it('rejects movement beyond the remaining speed allowance', () => {
    const economy = createDnd5eTurnEconomyCounts('turn', 30)
    economy.movement.current = 5
    expect(prepareDnd5ePlayerMove({
      action, map, characters: [character()],
      initiativeOrder: [{ tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 }],
      turnEconomy: economy,
    })).toEqual({ ok: false, reason: 'insufficient-movement' })
  })

  it('can switch from a spent 10-foot walk to the remaining flight speed', () => {
    const hero = character()
    hero.dnd5eCombatState = {
      schemaVersion: 2,
      wildShapeFormId: 'srd-5.1:giant-eagle',
      wildShapeMode: 'polymorph',
      wildShapeCurrentHp: 26,
      wildShapeRoundsRemaining: 10,
      wildShapeMaximumChallengeRating: 1,
      wildShapeOriginalCurrentHp: 30,
      wildShapeOriginalMaxHp: 30,
      wildShapeOriginalArmorClass: 18,
      wildShapeOriginalSpeed: 30,
      wildShapeOriginalMovementSpeeds: { walk: 30 },
      wildShapeOriginalAbilities: { ...hero.abilities },
      wildShapeOriginalSavingThrowBonuses: {},
    }
    const economy = spendDnd5eMovement(
      createDnd5eTurnEconomyCounts('turn', 80),
      10,
    ).economy
    const formMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((token) => token.id === 'hero-token'
        ? { ...token, dnd5eCombatState: hero.dnd5eCombatState }
        : token),
    }
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'combat', round: 1,
      map: formMap, characters: [hero],
      initiativeOrder: [{ tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 }],
    })
    expect(snapshot.state.combatants['hero-token']).toMatchObject({
      speed: 80,
      movementSpeeds: { walk: 10, fly: 80 },
    })

    const flying = prepareDnd5ePlayerMove({
      action: { ...action, dnd5eTraversalMode: 'fly', targetElevationFeet: 0 },
      map: formMap,
      characters: [hero],
      initiativeOrder: [{ tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 }],
      turnEconomy: economy,
    })
    expect(flying.ok, JSON.stringify(flying)).toBe(true)
    if (flying.ok) expect(flying.prepared.movementCostFeet).toBe(10)

    expect(prepareDnd5ePlayerMove({
      action: { ...action, dnd5eTraversalMode: 'walk' },
      map: formMap,
      characters: [hero],
      initiativeOrder: [{ tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 }],
      turnEconomy: economy,
    })).toEqual({ ok: false, reason: 'insufficient-movement' })
  })

  it('recomputes ground elevation from DM geometry and blocks forged steps above 10 feet', () => {
    const terrain = {
      mapId: map.id,
      walls: [], doors: [], windows: [], lights: [],
      obstacles: [{
        id: 'ledge', kind: 'obstacle' as const, label: '高台',
        points: [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 10, y: 10 }],
        blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none' as const,
        baseHeightFeet: 0, heightFeet: 0, terrainElevationFeet: 15, createdAt: 1,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' as const },
      updatedAt: 1,
    }
    setMapGeometryRuntime([terrain])
    const input = {
      action: { ...action, targetElevationFeet: 999 },
      map,
      characters: [character()],
      initiativeOrder: [{ tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 }],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    }
    expect(prepareDnd5ePlayerMove(input)).toEqual({ ok: false, reason: 'movement-blocked' })
    terrain.obstacles[0].terrainElevationFeet = 10
    setMapGeometryRuntime([terrain])
    const prepared = prepareDnd5ePlayerMove(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.toElevationFeet).toBe(10)
  })

  it('treats a legacy token without elevation as standing on its terrain surface', () => {
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [],
      windows: [],
      lights: [],
      obstacles: [{
        id: 'plateau',
        kind: 'obstacle',
        label: 'Plateau',
        points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 0, y: 10 }],
        blocksVision: false,
        blocksMovement: false,
        blocksLineOfEffect: false,
        cover: 'none',
        baseHeightFeet: 0,
        heightFeet: 0,
        terrainRegion: true,
        terrainElevationFeet: 20,
        createdAt: 1,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    const prepared = prepareDnd5ePlayerMove({
      action,
      map,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      toElevationFeet: 20,
      pathElevationsFeet: [20, 20, 20],
      movementCostFeet: 10,
    })
    expect(prepared.prepared.state.combatants['hero-token'].elevationFeet).toBe(20)
  })

  it('validates a flying move as one three-dimensional trajectory over a tall wall', () => {
    const hero = character()
    hero.speed = 60
    hero.dnd5eMovementSpeeds = { fly: 60 }
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'high-wall', kind: 'wall', label: '高墙',
        points: [{ x: 15, y: 0 }, { x: 15, y: map.height }],
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
      doors: [], windows: [], obstacles: [], lights: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])
    const prepared = prepareDnd5ePlayerMove({
      action: {
        ...action,
        targetPosition: { x: 25, y: 5 },
        dnd5eTraversalMode: 'fly',
        targetElevationFeet: 40,
      },
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(prepared).toEqual(expect.objectContaining({ ok: true }))
    if (!prepared.ok) return
    expect(prepared.prepared.toElevationFeet).toBe(40)
    expect(prepared.prepared.pathElevationsFeet[0]).toBe(0)
    expect(prepared.prepared.pathElevationsFeet.at(-1)).toBe(40)
    expect(prepared.prepared.movementCostFeet).toBe(50)
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result).toEqual(expect.objectContaining({ ok: true }))
    expect(resolved.application?.map.tokens.find((token) => token.id === 'hero-token'))
      .toMatchObject({ x: 25, y: 5, elevationFeet: 40 })
  })

  it('authoritatively places a flyer above a ground enemy and rejects landing into it', () => {
    const hero = character()
    hero.dnd5eMovementSpeeds = { fly: 60 }
    const testMap = { ...map, tokens: [map.tokens[0], { ...map.tokens[1], x: 25 }] }
    const input = { map: testMap, characters: [hero],
      initiativeOrder: [{ tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 }],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    }
    const prepared = prepareDnd5ePlayerMove({ ...input,
      action: { ...action, dnd5eTraversalMode: 'fly', targetElevationFeet: 10 } })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find(token => token.id === 'hero-token'))
      .toMatchObject({ x: 25, y: 5, elevationFeet: 10 })
    expect(prepareDnd5ePlayerMove({ ...input,
      action: { ...action, dnd5eTraversalMode: 'fly', targetElevationFeet: 0 } }).ok).toBe(false)
    expect(prepareDnd5ePlayerMove({ ...input, characters: [character()],
      action: { ...action, dnd5eTraversalMode: 'fly', targetElevationFeet: 10 } }).ok).toBe(false)
  })

  it('half-speed careful movement consumes twice the traversed distance in Headless', () => {
    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, dnd5eCarefulMovement: true },
      map,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.movementCostFeet).toBe(20)
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', resource: 'movement', amount: 20,
    }))
  })

  it('charges Grease on the ground but not while flying over the same cells', () => {
    const greaseMap: BattleMap = {
      ...map,
      dnd5ePluginAreas: [{
        id: 'grease', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:grease',
        sourceKind: 'core-spell', coreSpellId: 'grease', label: 'Grease', color: '#facc15',
        sourceCharacterId: 'enemy', sourceTokenId: 'enemy-token',
        cells: Array.from({ length: 20 }, (_, row) => [
          { col: 1, row },
          { col: 2, row },
        ]).flat(),
        createdRound: 1, expiresAfterRound: 100,
        vertical: { mode: 'ground' }, relation: 'any', includeSelf: true,
        movementCostMultiplier: 2,
      }],
    }
    const hero = character()
    hero.speed = 60
    hero.dnd5eMovementSpeeds = { fly: 60 }
    const initiativeOrder = [
      { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
      { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
    ]
    const grounded = prepareDnd5ePlayerMove({
      action,
      map: greaseMap,
      characters: [hero],
      initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(grounded.ok).toBe(true)
    if (!grounded.ok) return
    expect(grounded.prepared).toMatchObject({
      distanceFeet: 10,
      movementCostFeet: 20,
      pathElevationsFeet: [0, 0, 0],
    })

    const jumpEffect = createDnd5eMechanicalEffect({
      id: 'hero-jump-spell',
      definitionId: 'srd-5.1:spell:jump',
      label: '跳跃术',
      targetId: hero.id,
      source: { kind: 'spell', actorId: hero.id, rulesId: 'jump' },
      modifiers: { jumpDistanceMultiplier: 3 },
    })
    const jumpingHero: Character = {
      ...hero,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [jumpEffect] },
    }
    const standingJump = prepareDnd5ePlayerMove({
      action: { ...action, dnd5eTraversalMode: 'long-jump-standing' },
      map: greaseMap,
      characters: [jumpingHero],
      initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(standingJump.ok).toBe(true)
    if (!standingJump.ok) return
    expect(standingJump.prepared).toMatchObject({
      distanceFeet: 10,
      movementCostFeet: 10,
    })

    const flyingMap: BattleMap = {
      ...greaseMap,
      tokens: greaseMap.tokens.map((entry) => entry.id === 'hero-token'
        ? { ...entry, elevationFeet: 10 }
        : entry),
    }
    const airborne = prepareDnd5ePlayerMove({
      action: {
        ...action,
        dnd5eTraversalMode: 'fly',
        targetElevationFeet: 10,
      },
      map: flyingMap,
      characters: [hero],
      initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(airborne.ok).toBe(true)
    if (!airborne.ok) return
    expect(airborne.prepared.path).toEqual(grounded.prepared.path)
    expect(airborne.prepared).toMatchObject({
      distanceFeet: 10,
      movementCostFeet: 10,
      pathElevationsFeet: [10, 10, 10],
    })
  })

  it('charges Spirit Guardians inside its volume but not above it', () => {
    const guardedMap: BattleMap = {
      ...map,
      dnd5ePluginAreas: [{
        id: 'spirit-guardians', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:spirit-guardians',
        sourceKind: 'core-spell', coreSpellId: 'spirit-guardians', label: '灵体卫士', color: '#fef3c7',
        sourceCharacterId: 'enemy', sourceTokenId: 'enemy-token', cells: [{ col: 1, row: 0 }, { col: 2, row: 0 }],
        createdRound: 1, expiresAfterRound: 100, relation: 'enemy', includeSelf: false,
        anchorMode: 'source-token', anchorTokenId: 'enemy-token',
        vertical: { mode: 'volume', baseElevationFeet: -15, heightFeet: 30, anchorOffsetFeet: -15 },
        movementCostMultiplier: 2,
      }],
    }
    const prepared = prepareDnd5ePlayerMove({
      action,
      map: guardedMap,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 10, movementCostFeet: 15 })

    const hero = character()
    hero.speed = 60
    hero.dnd5eMovementSpeeds = { fly: 60 }
    const airborne = prepareDnd5ePlayerMove({
      action: {
        ...action,
        dnd5eTraversalMode: 'fly',
        targetElevationFeet: 20,
      },
      map: {
        ...guardedMap,
        tokens: guardedMap.tokens.map((entry) => entry.id === 'hero-token'
          ? { ...entry, elevationFeet: 20 }
          : entry),
      },
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(airborne.ok).toBe(true)
    if (!airborne.ok) return
    expect(airborne.prepared).toMatchObject({
      distanceFeet: 10,
      movementCostFeet: 10,
      pathElevationsFeet: [20, 20, 20],
    })
  })

  it('charges double movement through Ice Storm difficult terrain', () => {
    const stormMap: BattleMap = {
      ...map,
      dnd5ePluginAreas: [{
        id: 'ice-storm', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:ice-storm',
        sourceKind: 'core-spell', coreSpellId: 'ice-storm', label: '冰风暴·冰雹地面', color: '#bfdbfe',
        sourceCharacterId: 'enemy', sourceTokenId: 'enemy-token',
        cells: Array.from({ length: 20 }, (_, row) => [
          { col: 1, row },
          { col: 2, row },
        ]).flat(),
        createdRound: 1, expiresAfterRound: 2, expiresAtSourceTurnEndAfterRound: 2,
        relation: 'any', includeSelf: true, movementCostMultiplier: 2,
      }],
    }
    const prepared = prepareDnd5ePlayerMove({
      action,
      map: stormMap,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 10, movementCostFeet: 20 })
  })

  it('spends half speed to stand from prone before moving and clears the condition', () => {
    const hero = character()
    const activeEffects = migrateLegacyDnd5eConditions({ targetId: hero.id, conditions: ['prone'] })
    hero.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects }
    const proneAction = { ...action, targetPosition: { x: 15, y: 5 } }
    const prepared = prepareDnd5ePlayerMove({
      action: proneAction, map, characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 5, movementCostFeet: 20, standFromProne: true })
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.state.combatants['hero-token'].turn.movementRemaining).toBe(10)
    expect(resolved.application?.characters[0].conditions).toEqual([])
    expect(resolved.result.events).toContainEqual({ type: 'condition-ended', targetId: 'hero-token', condition: 'prone' })
  })

  it('projects generic feat movement modifiers into climbing and standing authority', () => {
    const pluginId = 'local.test.athletic-movement'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Athletic movement test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'athletic-movement', name: 'Athletic movement', summary: 'Synthetic feat.',
          description: 'Synthetic feat.', automation: 'partial',
          staticModifiers: {
            climbWithoutSpeedCostMultiplier: 1,
            standFromProneMovementCostFeet: 5,
          },
        })
      },
    })
    try {
      const hero = character()
      hero.dnd5eFeatIds = [`${pluginId}:athletic-movement`]
      const climbed = prepareDnd5ePlayerMove({
        action: {
          ...action,
          targetPosition: { x: 25, y: 5 },
          dnd5eTraversalMode: 'climb',
        },
        map,
        characters: [hero],
        initiativeOrder: [
          { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
          { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
        ],
        turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
      })
      expect(climbed.ok).toBe(true)
      if (climbed.ok) expect(climbed.prepared).toMatchObject({ distanceFeet: 10, movementCostFeet: 10 })

      const activeEffects = migrateLegacyDnd5eConditions({ targetId: hero.id, conditions: ['prone'] })
      hero.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
      hero.dnd5eCombatState = { schemaVersion: 2, activeEffects }
      const stood = prepareDnd5ePlayerMove({
        action: { ...action, targetPosition: { x: 15, y: 5 } },
        map,
        characters: [hero],
        initiativeOrder: [
          { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
          { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
        ],
        turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
      })
      expect(stood.ok).toBe(true)
      if (stood.ok) expect(stood.prepared).toMatchObject({ distanceFeet: 5, movementCostFeet: 10, standFromProne: true })
    } finally {
      dispose()
    }
  })

  it.each(['flat', 'wall', 'cliff'] as const)('uses a Spider Climb effect as a climbing speed equal to walking speed: %s', (surface) => {
    const hero = character()
    hero.dnd5eCombatState = {
      schemaVersion: 2,
      activeEffects: [createDnd5eMechanicalEffect({
        id: 'hero-spider-climb',
        definitionId: 'activity:spider-climb:spider-climb:modifiers:0',
        label: '蛛行术',
        targetId: 'hero-token',
        source: { kind: 'spell', actorId: 'hero-token', rulesId: 'spider-climb' },
        modifiers: { climbSpeedEqualsWalking: true },
      })],
    }

    const geometry = createEmptyMapGeometry(map.id, 1)
    if (surface === 'wall') geometry.walls.push({
      id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      blocksMovement: true, blocksVision: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 60, createdAt: 1,
    })
    if (surface === 'cliff') geometry.obstacles.push({
      id: 'cliff', kind: 'obstacle', label: 'Cliff', points: [{ x: 10, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 10, y: 60 }],
      blocksMovement: false, blocksVision: false, blocksLineOfEffect: false,
      baseHeightFeet: 0, heightFeet: 0, terrainElevationFeet: 20, cover: 'none', createdAt: 1,
    })
    setMapGeometryRuntime([geometry])
    const destination = surface === 'wall' ? { x: 5, y: 5 } : surface === 'cliff' ? { x: 15, y: 5 } : { x: 45, y: 5 }
    const expectedDistance = surface === 'cliff' ? 25 : 20
    const climbed = prepareDnd5ePlayerMove({
      action: {
        ...action,
        targetPosition: destination,
        targetElevationFeet: surface === 'wall' ? 20 : undefined,
        dnd5eTraversalMode: 'climb',
      },
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(climbed.ok).toBe(true)
    if (!climbed.ok) return
    expect(climbed.prepared).toMatchObject({ distanceFeet: expectedDistance, movementCostFeet: expectedDistance })
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: climbed.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.state.combatants['hero-token'].turn.movementRemaining).toBe(30 - expectedDistance)
    expect(resolved.result.state.combatants['hero-token'].elevationFeet).toBe(surface === 'flat' ? 0 : 20)
  })

  it('lets a prone player crawl without automatically standing', () => {
    const hero = character()
    const activeEffects = migrateLegacyDnd5eConditions({ targetId: hero.id, conditions: ['prone'] })
    hero.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects }
    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 15, y: 5 }, dnd5eStandFromProne: false },
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 5, movementCostFeet: 10, standFromProne: false })
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.state.combatants['hero-token'].turn.movementRemaining).toBe(20)
    expect(resolved.application?.characters[0].conditions).toContain('prone')
  })

  it('keeps a prone player crawling and exposes why standing was prevented', () => {
    const hero = character()
    const proneEffects = migrateLegacyDnd5eConditions({ targetId: hero.id, conditions: ['prone'] })
    const laughter = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:hideous-laughter:repeat-save',
      label: '狂笑术',
      source: { kind: 'spell', actorId: 'enemy-token', rulesId: 'hideous-laughter' },
      targetId: hero.id,
      duration: { type: 'concentration', sourceActorId: 'enemy-token' },
    })
    const activeEffects = [...proneEffects, laughter]
    hero.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects }
    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 15, y: 5 }, dnd5eStandFromProne: true },
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      standFromProne: false,
      standPreventedBy: 'hideous-laughter',
      movementCostFeet: 10,
    })
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].conditions).toContain('prone')
  })

  it('accepts a Jump-enhanced running long jump as one Host-split movement', () => {
    const hero = character()
    const jumpEffect = createDnd5eMechanicalEffect({
      id: 'hero-running-jump-spell',
      definitionId: 'srd-5.1:spell:jump',
      label: '跳跃术',
      targetId: hero.id,
      source: { kind: 'spell', actorId: hero.id, rulesId: 'jump' },
      modifiers: { jumpDistanceMultiplier: 3 },
    })
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects: [jumpEffect] }
    const prepared = prepareDnd5ePlayerMove({
      action: {
        ...action,
        targetPosition: { x: 65, y: 5 },
        dnd5eTraversalMode: 'long-jump-running',
      },
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(prepared).toMatchObject({
      ok: true,
      prepared: { distanceFeet: 30, jumpDistanceFeet: 20, movementCostFeet: 30 },
    })
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
  })

  it('persists the Dodge action marker into the character combat state', () => {
    const dodgeAction: SharedPlayerActionState = { ...action, id: 'dodge', type: 'dodge' }
    const resolved = resolveDnd5ePlayerDodge({
      action: dodgeAction,
      map,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(resolved).toMatchObject({ ok: true })
    if (!resolved.ok) return
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'action',
    })
    expect(resolved.application.characters[0].dnd5eCombatState?.dodgingTurnKey).toBe('combat:1:hero-token')
  })

  it('accepts Haste Disengage after the ordinary action is spent', () => {
    const hero = character()
    hero.dnd5eCombatState = {
      schemaVersion: 2,
      activeEffects: [createDnd5eMechanicalEffect({
        id: 'haste-effect',
        definitionId: 'srd-5.1:spell:haste',
        label: '加速术',
        targetId: hero.id,
        source: { kind: 'spell', actorId: hero.id, rulesId: 'haste' },
        modifiers: {
          restrictedExtraAction: {
            allowedActions: ['weapon-attack', 'dash', 'disengage', 'hide', 'use-object'],
            maximumWeaponAttacks: 1,
          },
        },
      })],
    }
    const economy = createDnd5eTurnEconomyCounts('combat:1:hero-token', 60)
    economy.action.current = 0
    const resolved = resolveDnd5ePlayerDisengage({
      action: { ...action, id: 'disengage', type: 'disengage' },
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: economy,
    })

    expect(resolved).toMatchObject({ ok: true })
    if (!resolved.ok) return
    expect(resolved.result.state.combatants['hero-token'].classState.restrictedExtraActionUsesByEffect)
      .toEqual({ 'haste-effect': 'combat:1:hero-token' })
  })
})

describe('reverse gravity movement ownership', () => {
  function scenario(flying = false, conditions: string[] = []) {
    const hero = character()
    hero.conditions = conditions
    if (flying) hero.dnd5eMovementSpeeds = { fly: 60 }
    const area = { id: 'gravity', pluginId: 'srd', featureId: 'reverse-gravity', sourceKind: 'core-spell' as const,
      coreSpellId: 'reverse-gravity', includeSelf: true, label: '反重力', color: '#fff', sourceCharacterId: 'hero', sourceTokenId: 'hero-token',
      vertical: { mode: 'volume' as const, baseElevationFeet: 0, heightFeet: 100 },
      cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }], createdRound: 0, expiresAfterRound: 10,
      occupantModifiers: { magicallyHeldAloft: true } }
    return { hero, board: { ...map, tokens: [{ ...map.tokens[0], elevationFeet: 100 }], dnd5ePluginAreas: [area] } }
  }
  it.each(['walk', 'fly', 'fall'] as const)('does not grant unsupported voluntary %s movement', mode => {
    const { hero, board } = scenario()
    const result = prepareDnd5ePlayerMove({ action: { ...action, dnd5eTraversalMode: mode, targetPosition: { x: 15, y: 5 }, targetElevationFeet: 100 },
      map: board, characters: [hero], initiativeOrder: [{ tokenId: 'hero-token', label: 'hero', emoji: '', color: '', roll: 20 }],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30) })
    expect(result.ok).toBe(false)
  })

  it('walks through an unlit off-grid corridor and open door but still stops at a closed door', () => {
    const corridor = createEmptyMapGeometry(map.id)
    corridor.vision = { ...corridor.vision, enabled: true, ambientLight: 'darkness' }
    corridor.walls = [1, 13].map((y, index) => ({
      id: `corridor-${index}`, kind: 'wall', label: 'Wall',
      points: [{ x: 0, y }, { x: 300, y }],
      blocksMovement: true, blocksVision: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }))
    corridor.doors = [{
      id: 'door', kind: 'door', label: 'Door', points: [{ x: 30, y: 1 }, { x: 30, y: 13 }],
      state: 'open', secret: false, blocksMovement: true, blocksVision: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    }]
    const freeMap: BattleMap = { ...map, snapMonstersToGrid: false, tokens: [{ ...map.tokens[0], x: 10, y: 7 }] }
    const input = { map: freeMap, characters: [character()],
      action: { ...action, combatId: undefined, targetPosition: { x: 75, y: 7 } } }
    setMapGeometryRuntime([corridor])
    const open = prepareDnd5eExplorationMove(input)
    expect(open.ok).toBe(true)
    if (open.ok) {
      expect(open.prepared.path[0]).toEqual({ x: 10, y: 7 })
      expect(open.prepared.path.at(-1)).toEqual({ x: 75, y: 7 })
      expect(open.prepared.path.every(point => point.y === 7)).toBe(true)
    }
    setMapGeometryRuntime([{ ...corridor, doors: [{ ...corridor.doors[0], state: 'closed' }] }])
    expect(prepareDnd5eExplorationMove(input)).toEqual({ ok: false, reason: 'movement-blocked' })
  })
  it('allows a creature with flight to fly through the area', () => {
    const { hero, board } = scenario(true)
    expect(prepareDnd5ePlayerMove({ action: { ...action, dnd5eTraversalMode: 'fly', targetPosition: { x: 15, y: 5 }, targetElevationFeet: 100 },
      map: board, characters: [hero], initiativeOrder: [{ tokenId: 'hero-token', label: 'hero', emoji: '', color: '', roll: 20 }],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60) })).toMatchObject({ ok: true })
  })
})

it.each([false, true])('charges grid movement against a live wind direction (terrain=%s)', terrain => {
  setMapGeometryRuntime([])
  const wind: BattleMap = { ...map, dnd5ePluginAreas: [{ id: 'wind', pluginId: 'test.wind', featureId: 'zone', label: 'Wind', color: '#fff', sourceCharacterId: 'other', sourceTokenId: 'other',
    createdRound: 1, expiresAfterRound: 11, includeSelf: true, relation: 'any', cells: Array.from({ length: 600 }, (_, i) => ({ col: i % 30, row: Math.floor(i / 30) })),
    movementCostMultiplier: terrain ? 2 : 1, directionalMovementCost: { direction: { dc: -1, dr: 0 }, additionalFeetPerFoot: 1 } }] }
  const prepared = prepareDnd5ePlayerMove({ action, map: wind, characters: [character()], initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }], turnEconomy: createDnd5eTurnEconomyCounts('turn', 30) })
  expect(prepared, JSON.stringify(prepared)).toMatchObject({ ok: true, prepared: { movementCostFeet: terrain ? 30 : 20 } })
})


it.each(['ice', 'snow', 'sand'] as const)('charges the player actual movement with selective %s terrain', surfaceMaterial => {
  const state = createEmptyMapGeometry(map.id, 1)
  state.obstacles.push({
    id: 'ground', kind: 'obstacle', label: 'Ground',
    points: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }],
    blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
    heightFeet: 0, baseHeightFeet: 0, traversal: 'ground', terrainCostMultiplier: 2, surfaceMaterial, createdAt: 1,
  })
  setMapGeometryRuntime([state])
  const actor = character()
  actor.dnd5eCombatState = { schemaVersion: 2, activeEffects: [createDnd5eMechanicalEffect({
    definitionId: 'test:ice-terrain', label: 'Ice terrain', targetId: 'hero-token',
    source: { kind: 'spell', actorId: 'hero-token', rulesId: 'test:ice', magical: true },
    modifiers: { environmentalCapabilities: { ignoreDifficultTerrainMaterials: ['ice', 'snow'] } },
  })] }
  try {
    const prepared = prepareDnd5ePlayerMove({ action, map, characters: [actor],
      initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared).toMatchObject({ ok: true, prepared: { movementCostFeet: surfaceMaterial === 'sand' ? 20 : 10 } })
  } finally { setMapGeometryRuntime([]) }
})


it('settles an in-place underground walk through Host, charging movement before ejection', () => {
  const actor=character()
  actor.concentrating=true
  actor.dnd5eCombatState={schemaVersion:2,concentrationSpellId:'test:earth',activeEffects:[createDnd5eMechanicalEffect({
    definitionId:'test:earth:body',label:'Earth',targetId:'hero-token',
    source:{kind:'spell',actorId:'hero-token',rulesId:'test:earth',magical:true},
    duration:{type:'concentration',sourceActorId:'hero-token',concentrationId:'test:earth',remainingRounds:100},
    modifiers:{solidMaterialTraversal:{materials:['earth','stone'],endInside:'eject-end-source-stun-until-next-turn-end'}},
  })]}
  const geometry=createEmptyMapGeometry(map.id,1)
  geometry.obstacles=[{id:'earth',kind:'obstacle',label:'Earth',surfaceMaterial:'earth',terrainRegion:true,terrainElevationFeet:0,
    points:[{x:0,y:0},{x:300,y:0},{x:300,y:200},{x:0,y:200}],heightFeet:0,baseHeightFeet:0,
    blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,cover:'none',createdAt:1}]
  setMapGeometryRuntime([geometry])
  try {
    const prepared=prepareDnd5ePlayerMove({action:{...action,targetPosition:{x:5,y:5},targetElevationFeet:-5,dnd5eTraversalMode:'walk'},
      map,characters:[actor],initiativeOrder:[{tokenId:'hero-token',label:'Hero',emoji:'',color:'',roll:20}],
      turnEconomy:createDnd5eTurnEconomyCounts('turn',30)})
    if(!prepared.ok)throw new Error(prepared.reason)
    expect(prepared.prepared).toMatchObject({distanceFeet:5,movementCostFeet:5,toElevationFeet:-5,pathElevationsFeet:[0,-5]})
    const resolved=resolvePreparedDnd5ePlayerMove({prepared:prepared.prepared})
    expect(resolved.result.ok).toBe(true)
    const moved=resolved.result.state.combatants['hero-token']
    expect(moved.turn.movementSpent).toBe(5)
    expect(moved.elevationFeet).toBe(0)
    expect(moved.concentrating).toBe(false)
    expect(moved.conditions).toContain('stunned')
  }finally{setMapGeometryRuntime([])}
})


it('persists exploration sightings on the player character while preserving unrelated character and token state', () => {
  const hero = { ...character(), notes: 'keep', dnd5eCombatState: { recentCreatureSightings: undefined } }
  const before = JSON.stringify({map, hero})
  const result = recordDnd5eAcceptedMovementSightings({ map, characters: [hero], actorTokenId: 'hero-token',
    path: [{x:5,y:5},{x:25,y:5}], worldMinute: 12, worldSecondRemainder: 15 })
  expect(result.characters[0].dnd5eCombatState?.recentCreatureSightings?.['enemy-token'].worldMinute).toBe(12.25)
  expect(result.map.tokens[0].dnd5eCombatState?.recentCreatureSightings).toBeUndefined()
  expect(result.map.tokens[1].dnd5eCombatState?.recentCreatureSightings?.['hero-token'].worldMinute).toBe(12.25)
  expect(result.characters[0]).toMatchObject({notes:'keep',currentHp:30,maxHp:30})
  expect(JSON.stringify({map,hero})).toBe(before)
  expect(JSON.parse(JSON.stringify(result.characters))[0].dnd5eCombatState.recentCreatureSightings['enemy-token'].worldMinute).toBe(12.25)
})
import {resolveDnd5eDeferredMovementRepeatSaves} from './headlessCombatEngine'
it.each([1,2])('preserves a player after-movement effect until %s committed segments finish',segments=>{
 const effect=createDnd5eMechanicalEffect({id:'player-move-save',definitionId:'test:move-save',label:'After movement',targetId:'hero-token',
  source:{kind:'spell',actorId:'hero-token'},duration:{type:'rounds',remainingRounds:10,tickOn:'target-turn-end'},
  repeatSave:{ability:'wis',dc:15,timing:'after-movement',onSuccess:'remove'}})
 let people=[character()];people[0].dnd5eCombatState={schemaVersion:2,activeEffects:[effect]}
 let board=structuredClone(map)
 const initiativeOrder=[{tokenId:'hero-token',label:'Hero',emoji:'',color:'',roll:20}]
 let state:Parameters<typeof resolveDnd5eDeferredMovementRepeatSaves>[0]|undefined
 for(let index=0;index<segments;index++){
  const p=prepareDnd5ePlayerMove({action:{...action,targetPosition:{x:15+10*index,y:5}},map:board,characters:people,initiativeOrder,
   turnEconomy:createDnd5eTurnEconomyCounts('turn',30-index*5)})
  expect(p.ok).toBe(true);if(!p.ok)throw Error(p.reason)
  const result=resolvePreparedDnd5ePlayerMove({prepared:p.prepared,deferMovementRepeatSavingThrows:true})
  expect(result.result.ok).toBe(true)
  expect(result.result.events.some(e=>e.type==='saving-throw-resolved')).toBe(false)
  expect(result.result.state.combatants['hero-token'].classState.activeEffects?.some(e=>e.id===effect.id)).toBe(true)
  const atomic=withDnd5ePendingMovementCompletion(result.application!,'hero-token',`completion:${index}`,true)
  expect(atomic.map.dnd5ePendingMovementCompletions).toEqual([{id:'completion:0',actorTokenId:'hero-token'}])
  board=JSON.parse(JSON.stringify(atomic.map));people=JSON.parse(JSON.stringify(result.application!.characters));state=result.result.state
 }
 const result=resolveDnd5eDeferredMovementRepeatSaves(state!,'hero-token',true,[{effectId:effect.id,d20:20}],{transactionId:'player-finish',effectRollDice:{}})
 expect(result.ok).toBe(true)
 expect(result.events.filter(e=>e.type==='saving-throw-resolved')).toHaveLength(1)
 expect(result.state.combatants['hero-token'].classState.activeEffects?.some(e=>e.id===effect.id)).toBe(false)
})
