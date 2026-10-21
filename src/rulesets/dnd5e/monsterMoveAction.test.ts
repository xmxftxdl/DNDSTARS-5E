import {withDnd5ePendingMovementCompletion} from './pendingMovementCompletion'
import { afterEach, describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect, dnd5eActiveEffectId } from './activeEffects'
import { prepareDnd5eMonsterMovementSavingThrows, resolveDnd5eMonsterMapMove, previewDnd5eMonsterMapMove } from './monsterMoveAction'
import { prepareDnd5eExplorationMove, resolvePreparedDnd5eExplorationMove, prepareDnd5ePlayerMove, resolvePreparedDnd5ePlayerMove } from './playerMoveAction'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: 'Hero',
    player: 'P1',
    avatar: '',
    accent: '',
    race: '',
    charClass: '',
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 20,
    currentHp: 20,
    tempHp: 0,
    hitDice: '1d8',
    ac: 14,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 0,
    y: 0,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 10,
    maxHp: 10,
    ...patch,
  }
}

it.each(['player','monster'].flatMap(kind=>['long-jump-standing','long-jump-running'].flatMap(mode=>[5,2.5].flatMap(feetPerCell=>(mode==='long-jump-running'?[10,0]:[10]).map(approach=>[kind,mode,feetPerCell,approach] as const)))))('preserves one jump through %s map commits: %s, %s-foot cells, prior approach=%s',(kind,mode,feetPerCell,approach)=>{
  const traversalMode=mode as 'long-jump-standing'|'long-jump-running'
  const combatState={schemaVersion:2 as const,runningJumpApproachFeet:approach}
  let characters=[character({abilities:{str:20,dex:10,con:10,int:10,wis:10,cha:10},dnd5eCombatState:combatState})]
  let map:BattleMap={id:'jump-map',name:'Jump',width:300,height:200,gridSize:10,gridOffsetX:0,gridOffsetY:0,feetPerCell,showGrid:true,tokens:[
    token({id:'mover',x:5,y:25,poolId:kind==='monster'?'srd-5.1:hill-giant':undefined,type:kind==='player'?'player':'enemy',characterId:kind==='player'?'hero':undefined,dnd5eCombatState:combatState}),
    token({id:'other',x:225,y:105,poolId:'srd-5.1:goblin'}),
  ]}
  const initiativeOrder=map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,roll:20-i,emoji:'',color:''}))
  let turnEconomy=createDnd5eTurnEconomyCounts('jump:1:mover',30)
  let rejection=''
  const move=(x:number,jumpSegment:'continue'|'finish')=>{
    if(kind==='monster'){
      const result=resolveDnd5eMonsterMapMove({combatId:'jump',round:1,map,characters,initiativeOrder,actorTokenId:'mover',to:{x,y:25},traversalMode,jumpSegment,turnEconomy})
      rejection=result.ok?'':result.reason
      return result.ok?result:undefined
    }
    const prepared=prepareDnd5ePlayerMove({map,characters,initiativeOrder,turnEconomy,jumpSegment,action:{
      id:'jump-'+x,combatId:'jump',mapId:map.id,sourceMode:'player',status:'pending',type:'move-token',actorTokenId:'mover',characterId:'hero',targetPosition:{x,y:25},dnd5eTraversalMode:traversalMode,round:1,initiativeIndex:0,seq:1,updatedAt:1,
    }})
    return prepared.ok?resolvePreparedDnd5ePlayerMove({prepared:prepared.prepared}):undefined
  }
  const finalX=approach===0?5+15/feetPerCell*10:25
  const whole=move(finalX,'finish')
  expect(whole?.result.ok).toBe(true)
  const first=move(15,'continue')
  expect(first?.result.ok).toBe(true);expect(first?.application).toBeDefined()
  map=JSON.parse(JSON.stringify(first!.application!.map));characters=JSON.parse(JSON.stringify(first!.application!.characters))
  turnEconomy={...turnEconomy,movement:{...turnEconomy.movement,current:30-feetPerCell}}
  const owner=kind==='player'?characters[0].dnd5eCombatState:map.tokens[0].dnd5eCombatState
  if(approach===0){expect(owner?.jumpMovementProgress).toBeUndefined();expect(owner?.runningJumpApproachFeet).toBe(feetPerCell)}
  else expect(owner?.jumpMovementProgress?.distanceFeet).toBe(feetPerCell)
  expect(move(5+40/feetPerCell*10,'finish')?.result.ok??false).toBe(false)
  const final=move(finalX,'finish')
  expect(final?.result.ok,JSON.stringify({rejection,mover:map.tokens[0],turn:turnEconomy})).toBe(true)
  expect(final?.result.state.combatants.mover.turn.movementRemaining).toBe(30-(approach===0?15:2*feetPerCell))
  expect(final?.result.state.combatants.mover.turn.movementRemaining).toBe(whole?.result.state.combatants.mover.turn.movementRemaining)
  expect(final?.result.state.combatants.mover.classState.jumpMovementProgress).toBeUndefined()
})

it.each([['monster', false], ['exploration', false], ['monster', true], ['exploration', true], ['player', false], ['player', true]] as const)('settles %s ejection with third-party rescue=%s without premature commits', (mode, rescue) => {
  const mover = token({ id: 'mover', poolId: 'srd-5.1:goblin', x: 25, y: 25, elevationFeet: 15, hp: 30, maxHp: 30,
    dnd5eCombatState: { schemaVersion: 2, concentrationSpellId: 'test:stone', activeEffects: [createDnd5eMechanicalEffect({
      definitionId: 'test:stone', label: 'Stone', targetId: 'mover', source: { kind: 'spell', actorId: 'mover', rulesId: 'test:stone' },
      duration: { type: 'concentration', sourceActorId: 'mover', concentrationId: 'test:stone', remainingRounds: 100 },
      modifiers: { flySpeedFeet: 30, solidMaterialTraversal: { materials: ['stone'], endInside: 'eject-end-source-stun-until-next-turn-end' } },
    })] } })
  const current: BattleMap = { id: 'fall-map', name: 'Fall', width: 250, height: 150, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [mover],
    dnd5ePluginAreas: [{ id: 'rock', pluginId: 'test', featureId: 'rock', label: 'Raised rock', color: '#aaa',
      sourceCharacterId: 'source', sourceTokenId: 'source', createdRound: 1, expiresAfterRound: 100,
      cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 }, circularGeometry: { radiusFeet: 3 },
      blocking: { movement: true }, vertical: { mode: 'volume', baseElevationFeet: 10, heightFeet: 10 },
      entityProfile: { material: 'stone', armorClass: 15, hitPoints: 30, cannotAttack: true, invisible: false, supportsStanding: true },
    }] }
  const ally = character({ id: 'rescuer', charClass: '法师', level: 5,
    dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['feather-fall'] } } } },
    classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
  })
  if (rescue) current.tokens.push(token({ id: 'rescuer-token', type: 'player', characterId: ally.id, x: 225, y: 125 }))
  const choices = [{ casterId: 'rescuer-token', targetIds: [mover.id] }]
  const input = { combatId: 'combat', map: current, characters: rescue ? [ally] : [], actorTokenId: mover.id,
    initiativeOrder: [{ tokenId: mover.id, label: 'Mover', emoji: '', color: '', roll: 20 },
      ...(rescue ? [{ tokenId: 'rescuer-token', label: 'Rescuer', emoji: '', color: '', roll: 10 }] : [])],
    to: { x: 75, y: 25 }, targetElevationFeet: 15, traversalMode: 'fly' as const,
    turnEconomy: createDnd5eTurnEconomyCounts('turn', 30) }
  const before = structuredClone(input)
  if (mode === 'player') {
    const hero = character({ concentrating: true, currentHp: 30, maxHp: 30, dnd5eCombatState: mover.dnd5eCombatState })
    current.tokens[0] = { ...mover, type: 'player', characterId: hero.id }
    const prepared = prepareDnd5ePlayerMove({ map: current, characters: rescue ? [hero, ally] : [hero],
      initiativeOrder: input.initiativeOrder, turnEconomy: input.turnEconomy, action: {
        id: 'player-fall', combatId: 'combat', mapId: current.id, sourceMode: 'player', status: 'pending', type: 'move-token',
        actorTokenId: mover.id, characterId: hero.id, targetPosition: input.to, targetElevationFeet: 15,
        dnd5eTraversalMode: 'fly', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      } })
    if (!prepared.ok) throw new Error(prepared.reason)
    const original = structuredClone(prepared.prepared)
    const pendingEndpoint = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared, deferSolidMaterialExit: true })
    expect(pendingEndpoint.result.ok).toBe(true)
    expect(pendingEndpoint.result.state.combatants.mover.concentrating).toBe(true)
    expect(pendingEndpoint.result.state.combatants.mover.position).toEqual(input.to)
    expect(pendingEndpoint.airborneFalls).toBeUndefined()
    const waiting = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(waiting.result.ok).toBe(false)
    expect(waiting.application).toBeUndefined()
    expect(waiting.solidExitReactionState?.combatants.mover.conditions).toContain('stunned')
    const settled = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared,
      ...(rescue ? { solidExitFeatherFallChoices: choices } : { airborneFallDamageRollsByCombatantId: { mover: [4] } }),
    })
    expect(settled.result.ok).toBe(true)
    expect(settled.result.state.combatants.mover).toMatchObject({ currentHp: rescue ? 30 : 26,
      elevationFeet: rescue ? 15 : 0, concentrating: false })
    expect(settled.result.state.combatants.mover.conditions).toContain('stunned')
    expect(settled.application?.characters.find(value => value.id === hero.id)?.currentHp).toBe(rescue ? 30 : 26)
    if (rescue) {
      expect(settled.result.state.combatants['rescuer-token'].turn.reactionAvailable).toBe(false)
      expect(settled.application?.characters.find(value => value.id === ally.id)?.classResources?.['dnd5e-spell-slot-1'].current).toBe(0)
      expect(settled.result.events.filter(event => event.type === 'spell-cast' && event.spellId === 'feather-fall')).toHaveLength(1)
    }
    expect(prepared.prepared).toEqual(original)
    return
  }
  if (mode === 'exploration') {
    const hero = character({ concentrating: true, currentHp: 30, maxHp: 30, dnd5eCombatState: mover.dnd5eCombatState })
    current.tokens[0] = { ...mover, type: 'player', characterId: hero.id }
    const prepared = prepareDnd5eExplorationMove({ map: current, characters: rescue ? [hero, ally] : [hero], action: {
      id: 'explore-fall', mapId: current.id, sourceMode: 'player', status: 'pending', type: 'move-token',
      actorTokenId: mover.id, characterId: hero.id, targetPosition: input.to, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    } })
    if (!prepared.ok) throw new Error(prepared.reason)
    const request = { prepared: prepared.prepared, map: current, characters: rescue ? [hero, ally] : [hero] }
    const original = structuredClone(request)
    expect(resolvePreparedDnd5eExplorationMove(request)).toMatchObject({ ok: false, reason: 'invalid-dice',
      solidExitReactionState: { combatants: { mover: { concentrating: false, conditions: expect.arrayContaining(['stunned']) } } },
      airborneFalls: [expect.objectContaining({ combatantId: mover.id, fallingDamageDice: 1 })] })
    expect(resolvePreparedDnd5eExplorationMove({ ...request,
      solidExitFeatherFallChoices: [{ casterId: mover.id, targetIds: [mover.id] }],
    })).toMatchObject({ ok: false, reason: 'invalid-reaction' })
    if (rescue) {
      const saved = resolvePreparedDnd5eExplorationMove({ ...request, solidExitFeatherFallChoices: choices })
      expect(saved.ok).toBe(true)
      if (!saved.ok) throw new Error(saved.reason)
      expect(saved.prepared.toElevationFeet).toBe(15)
      const rescued = saved.application.characters.find(value => value.id === hero.id)!
      expect(rescued.currentHp).toBe(30)
      expect(rescued.dnd5eCombatState?.activeEffects?.some(effect => effect.modifiers?.controlledDescent)).toBe(true)
      expect(saved.application.characters.find(value => value.id === ally.id)?.classResources?.['dnd5e-spell-slot-1'].current).toBe(0)
      expect(request).toEqual(original)
      return
    }
    const landed = resolvePreparedDnd5eExplorationMove({ ...request, airborneFallDamageRollsByCombatantId: { mover: [4] } })
    expect(landed.ok).toBe(true)
    if (!landed.ok) throw new Error(landed.reason)
    expect(landed.prepared.toElevationFeet).toBe(0)
    expect(landed.prepared.pathElevationsFeet.at(-1)).toBe(0)
    expect(landed.application.characters.find(value => value.id === hero.id)).toMatchObject({ currentHp: 26, concentrating: false })
    expect(request).toEqual(original)
    return
  }
  const preview = previewDnd5eMonsterMapMove(input)
  expect(preview.ok && preview.result.ok).toBe(true)
  if (!preview.ok) throw new Error(preview.reason)
  expect(preview.application).toBeUndefined()
  expect(preview.airborneFalls).toBeUndefined()
  expect(preview.path.at(-1)).toEqual(input.to)
  expect(preview.result.state.combatants.mover.concentrating).toBe(true)
  expect(preview.result.state.combatants.mover.conditions).not.toContain('stunned')
  expect(preview.result.events.some(event => event.type === 'spell-cast' && event.spellId === 'feather-fall')).toBe(false)
  expect(previewDnd5eMonsterMapMove({ ...input, to: { x: 10000, y: 10000 } }).ok).toBe(false)
  expect(input).toEqual(before)
  const pendingEndpoint = resolveDnd5eMonsterMapMove({ ...input, deferSolidMaterialExit: true })
  expect(pendingEndpoint.ok && pendingEndpoint.result.ok).toBe(true)
  if (!pendingEndpoint.ok) throw new Error(pendingEndpoint.reason)
  expect(pendingEndpoint.result.state.combatants.mover.concentrating).toBe(true)
  expect(pendingEndpoint.result.state.combatants.mover.position).toEqual(input.to)
  expect(pendingEndpoint.airborneFalls).toBeUndefined()
  const waiting = resolveDnd5eMonsterMapMove(input)
  expect(waiting).toMatchObject({ ok: true, result: { ok: false, reason: 'invalid-dice', events: [] },
    solidExitReactionState: { combatants: { mover: { concentrating: false, conditions: expect.arrayContaining(['stunned']) } } },
    airborneFalls: [expect.objectContaining({ combatantId: mover.id, fallingDamageDice: 1 })] })
  expect(resolveDnd5eMonsterMapMove({ ...input,
    solidExitFeatherFallChoices: [{ casterId: mover.id, targetIds: [mover.id] }],
  })).toMatchObject({ ok: false, reason: 'movement-blocked' })
  expect(waiting.ok && waiting.application).toBeUndefined()
  if (rescue) {
    const saved = resolveDnd5eMonsterMapMove({ ...input, solidExitFeatherFallChoices: choices })
    expect(saved.ok && saved.result.ok).toBe(true)
    if (!saved.ok) throw new Error(saved.reason)
    expect(saved.result.state.combatants.mover).toMatchObject({ currentHp: 30, elevationFeet: 15, concentrating: false })
    expect(saved.result.state.combatants.mover.conditions).toContain('stunned')
    expect(saved.result.state.combatants['rescuer-token'].turn.reactionAvailable).toBe(false)
    expect(saved.application?.characters.find(value => value.id === ally.id)?.classResources?.['dnd5e-spell-slot-1'].current).toBe(0)
    expect(saved.result.events.filter(event => event.type === 'spell-cast' && event.spellId === 'feather-fall')).toHaveLength(1)
    expect(input).toEqual(before)
    return
  }
  const landed = resolveDnd5eMonsterMapMove({ ...input, airborneFallDamageRollsByCombatantId: { mover: [4] } })
  expect(landed.ok && landed.result.ok).toBe(true)
  if (!landed.ok) throw new Error(landed.reason)
  expect(landed.result.state.combatants.mover).toMatchObject({ elevationFeet: 0, currentHp: 26, concentrating: false })
  expect(landed.movementTraces?.[0].pathElevationsFeet.at(-1)).toBe(0)
  expect(input).toEqual(before)
})

function ankhegDragFixture() {
  const ankheg = token({
    id: 'ankheg',
    label: 'Ankheg',
    poolId: 'srd-5.1:ankheg',
    x: 5,
    y: 5,
    hp: 39,
    maxHp: 39,
  })
  const relationId = dnd5eActiveEffectId('relation', 'grapple', ankheg.id, 'bite', 'hero-token')
  const relation = createDnd5eConditionEffect({
    id: relationId,
    condition: 'grappled',
    source: {
      kind: 'monster',
      actorId: ankheg.id,
      rulesId: 'monster:srd-5.1:ankheg:bite:bite-grapple',
    },
    targetId: 'hero-token',
    escapeCheck: {
      ability: 'str',
      skill: 'athletics',
      alternativeAbility: 'dex',
      alternativeSkill: 'acrobatics',
      dc: 13,
      economy: 'action',
    },
    relation: {
      schemaVersion: 1,
      kind: 'grapple',
      sourceActorId: ankheg.id,
      sourceActionId: 'bite',
      slotGroup: 'bite',
      maxDistanceFeet: 5,
      movement: 'drag-target',
      endsOnSourceIncapacitated: true,
    },
    stackingKey: relationId,
  })
  const hero = character({
    dnd5eCombatState: {
      schemaVersion: 2,
      activeEffects: [relation],
    },
    conditions: ['grappled'],
  })
  const heroToken = token({
    id: 'hero-token',
    label: hero.name,
    type: 'player',
    characterId: hero.id,
    x: 5,
    y: 15,
    hp: hero.currentHp,
    maxHp: hero.maxHp,
  })
  const map: BattleMap = {
    id: 'map',
    name: 'Map',
    width: 100,
    height: 100,
    gridSize: 10,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens: [ankheg, heroToken],
  }
  return {
    ankheg,
    hero,
    heroToken,
    map,
    initiativeOrder: [
      { tokenId: ankheg.id, label: ankheg.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ],
  }
}

describe('D&D 5e monster map movement', () => {
  it.each([false, true])('uses the grappled creature own solid traversal (target has it=%s)', targetHasTraversal => {
    const f = ankhegDragFixture()
    const body = (actorId: string) => createDnd5eMechanicalEffect({ definitionId: 'test:stone', label: 'Stone', targetId: actorId,
      source: { kind: 'spell', actorId, rulesId: 'test:stone' },
      duration: { type: 'concentration', sourceActorId: actorId, concentrationId: 'test:stone', remainingRounds: 100 },
      modifiers: { solidMaterialTraversal: { materials: ['stone'], endInside: 'eject-end-source-stun-until-next-turn-end' } } })
    f.ankheg.dnd5eCombatState = { schemaVersion: 2, concentrationSpellId: 'test:stone', activeEffects: [body(f.ankheg.id)] }
    if (targetHasTraversal) {
      f.hero.concentrating = true
      f.hero.dnd5eCombatState!.concentrationSpellId = 'test:stone'
      f.hero.dnd5eCombatState!.activeEffects!.push(body(f.heroToken.id))
    }
    const geometry = createEmptyMapGeometry(f.map.id, 1)
    geometry.walls.push({ id: 'rock-wall', kind: 'wall', label: 'Rock', material: 'stone',
      points: [{ x: 15, y: 0 }, { x: 15, y: 100 }], baseHeightFeet: 0, heightFeet: 20,
      blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, createdAt: 1 })
    setMapGeometryRuntime([geometry])
    const before = structuredClone(f)
    const result = resolveDnd5eMonsterMapMove({ map: f.map, characters: [f.hero], combatId: 'drag-stone',
      actorTokenId: f.ankheg.id, initiativeOrder: f.initiativeOrder, to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('drag', 30) })
    expect(f).toEqual(before)
    if (!targetHasTraversal) {
      expect(result).toMatchObject({ ok: false, reason: 'movement-blocked' })
      return
    }
    expect(result.ok && result.result.ok).toBe(true)
    if (!result.ok) throw new Error(result.reason)
    expect(result.result.state.combatants[f.heroToken.id].position).toEqual({ x: 25, y: 15 })
    expect(result.result.state.combatants[f.heroToken.id].conditions).toContain('grappled')
    expect(result.application?.map.tokens.find(token => token.id === f.heroToken.id)).toMatchObject({ x: 25, y: 15 })
  })
  it.each([{ door: false, dash: false }, { door: true, dash: false }, { door: true, dash: true }])('commits a failed boundary save without auto-opening doors, preserving chosen actions (%j)', ({ door, dash }) => {
    const hero = character()
    const monster = token({ id: 'monster', poolId: 'srd-5.1:goblin', x: 5, y: 5, dnd5eCombatState: { schemaVersion: 2, activeEffects: [createDnd5eMechanicalEffect({
      id: 'boundary', definitionId: 'boundary', label: 'Boundary', targetId: 'monster', source: { kind: 'spell', actorId: 'hero-token' },
      modifiers: { movementBoundarySave: { maximumDistanceFeet: 15, ability: 'wis', dc: 15 } },
    })] } })
    const current: BattleMap = { id: 'boundary-map', name: 'Boundary', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [monster, token({ id: 'hero-token', type: 'player', characterId: hero.id, x: 5, y: 25 })] }
    if (door) setMapGeometryRuntime([{ ...createEmptyMapGeometry(current.id), doors: [{ id: 'boundary-door', kind: 'door', label: 'Door',
      points: [{ x: 10, y: 0 }, { x: 10, y: 100 }], state: 'closed', secret: false, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1 }] }])
    const resolved = resolveDnd5eMonsterMapMove({ combatId: 'boundary', map: current, characters: [hero],
      initiativeOrder: [{ tokenId: monster.id, label: 'Monster', emoji: '', color: '', roll: 20 }, { tokenId: 'hero-token', label: 'Source', emoji: '', color: '', roll: 10 }],
      actorTokenId: monster.id, to: { x: 65, y: 5 }, dash, turnEconomy: createDnd5eTurnEconomyCounts('turn', 30), boundarySavingThrows: [{ effectId: 'boundary', d20: 1 }] })
    expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
    if (!resolved.ok) return
    expect(resolved.result).toMatchObject({ ok: true, movementBlocked: 'saving-throw' })
    expect(resolved.movementTraces).toEqual([])
    expect(resolved.doorsToOpen).toEqual([])
    expect(resolved.distanceFeet).toBe(0)
    expect(resolved.application?.map.tokens.find(token => token.id === monster.id)).toMatchObject({ x: 5, y: 5 })
    expect(resolved.result.state.combatants[monster.id].turn.movementRemaining).toBe(dash ? 60 : 30)
    expect(resolved.result.state.combatants[monster.id].turn.actionAvailable).toBe(!dash)
    expect(resolved.result.state.combatants[monster.id].turn.objectInteractionAvailable).toBe(true)
    expect(resolved.result.events.some(event => event.type === 'object-action-taken')).toBe(false)
    expect(resolved.result.events.some(event => event.type === 'turn-resource-spent' && event.resource === 'objectInteraction')).toBe(false)
  })
  afterEach(() => setMapGeometryRuntime([]))

  it('charges Grease on the ground but not while flying over the same cells', () => {
    const snake = token({
      id: 'flying-snake',
      label: 'Flying Snake',
      poolId: 'srd-5.1:flying-snake',
      x: 5,
      y: 5,
      hp: 5,
      maxHp: 5,
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token',
      label: hero.name,
      type: 'player',
      characterId: hero.id,
      x: 85,
      y: 85,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const greaseMap: BattleMap = {
      id: 'map',
      name: 'Map',
      width: 100,
      height: 100,
      gridSize: 10,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [snake, heroToken],
      dnd5ePluginAreas: [{
        id: 'grease', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:grease',
        sourceKind: 'core-spell', coreSpellId: 'grease', label: 'Grease', color: '#facc15',
        sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
        cells: Array.from({ length: 10 }, (_, row) => [
          { col: 1, row },
          { col: 2, row },
        ]).flat(),
        createdRound: 1, expiresAfterRound: 100,
        vertical: { mode: 'ground' }, relation: 'any', includeSelf: true,
        movementCostMultiplier: 2,
      }],
    }
    const initiativeOrder = [
      { tokenId: snake.id, label: snake.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]
    const grounded = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map: greaseMap,
      characters: [hero],
      initiativeOrder,
      actorTokenId: snake.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(grounded.ok).toBe(true)
    if (!grounded.ok) return
    expect(grounded.traversalMode).toBe('walk')
    expect(grounded.path).toEqual([{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 25, y: 5 }])
    expect(grounded.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: snake.id,
      resource: 'movement',
      // Walking 10 physical feet through Grease spends 20 feet from the
      // common movement allowance; switching to flight can use the remainder.
      amount: 20,
    }))

    const flyingMap: BattleMap = {
      ...greaseMap,
      tokens: [{ ...snake, elevationFeet: 10 }, heroToken],
    }
    const airborne = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map: flyingMap,
      characters: [hero],
      initiativeOrder,
      actorTokenId: snake.id,
      to: { x: 25, y: 5 },
      targetElevationFeet: 10,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(airborne.ok).toBe(true)
    if (!airborne.ok) return
    expect(airborne.traversalMode).toBe('fly')
    expect(airborne.path).toEqual(grounded.path)
    expect(airborne.movementTraces?.[0]?.pathElevationsFeet).toEqual([10, 10, 10])
    expect(airborne.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: snake.id,
      resource: 'movement',
      amount: 10,
    }))
  })

  it('uses a Fly active effect when a walking monster plans airborne movement', () => {
    const fly = createDnd5eMechanicalEffect({
      id: 'walking-monster-fly',
      definitionId: 'srd-5.1:spell:fly',
      label: 'Fly',
      targetId: 'walking-monster',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'fly' },
      duration: { type: 'concentration', sourceActorId: 'caster', concentrationId: 'fly' },
      modifiers: { flySpeedFeet: 60 },
    })
    const walker = token({
      id: 'walking-monster',
      label: 'Walking Monster',
      poolId: 'srd-5.1:goblin',
      x: 5,
      y: 5,
      elevationFeet: 10,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [fly] },
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token',
      label: hero.name,
      type: 'player',
      characterId: hero.id,
      x: 85,
      y: 85,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'fly-effect-map',
      name: 'Fly effect map',
      width: 100,
      height: 100,
      gridSize: 10,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [walker, heroToken],
    }
    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: walker.id, label: walker.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: walker.id,
      to: { x: 25, y: 5 },
      targetElevationFeet: 20,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.ok, result.result.ok ? undefined : result.result.reason).toBe(true)
    expect(result.movementTraces?.[0]).toMatchObject({
      tokenId: walker.id,
      to: { x: 25, y: 5 },
    })
    expect(result.movementTraces?.[0]?.pathElevationsFeet.at(-1)).toBe(20)
    expect(result.application?.map.tokens.find((entry) => entry.id === walker.id)).toMatchObject({
      x: 25,
      y: 5,
      elevationFeet: 20,
    })
  })

  it('routes a Small airborne monster around a legacy Wind Wall and charges the routed distance', () => {
    const sword = token({
      id: 'flying-sword',
      label: 'Flying Sword',
      poolId: 'srd-5.1:flying-sword',
      creatureSize: '小型',
      x: 270,
      y: 370,
      elevationFeet: 5,
      hp: 17,
      maxHp: 17,
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token',
      label: hero.name,
      type: 'player',
      characterId: hero.id,
      x: 370,
      y: 570,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'wind-wall-flight-map',
      name: 'Wind Wall flight map',
      width: 400,
      height: 600,
      gridSize: 20,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [sword, heroToken],
      dnd5ePluginAreas: [{
        id: 'legacy-wind-wall',
        pluginId: 'srd-5.1',
        featureId: 'srd-5.1:spell:wind-wall',
        sourceKind: 'core-spell',
        coreSpellId: 'wind-wall',
        label: 'Wind Wall',
        color: '#bae6fd',
        sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token',
        cells: Array.from({ length: 10 }, (_, index) => ({ col: 6 + index, row: 20 })),
        createdRound: 1,
        expiresAfterRound: 11,
        vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 15 },
        // Deliberately omit `blocking`: old live areas must adopt the current
        // Wind Wall rule before the first movement settlement.
      }],
    }
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [],
      obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      round: 1,
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: sword.id, label: sword.label, emoji: sword.emoji, color: sword.color, roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: heroToken.emoji, color: heroToken.color, roll: 10 },
      ],
      actorTokenId: sword.id,
      to: { x: 290, y: 470 },
      targetElevationFeet: 5,
      traversalMode: 'fly',
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 50),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.ok, result.result.ok ? undefined : result.result.reason).toBe(true)
    expect(result.distanceFeet).toBe(35)
    expect(result.path).toEqual([
      { x: 270, y: 370 },
      { x: 290, y: 390 },
      { x: 310, y: 390 },
      { x: 330, y: 390 },
      { x: 330, y: 410 },
      { x: 330, y: 430 },
      { x: 310, y: 450 },
      { x: 290, y: 470 },
    ])
    expect(result.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: sword.id,
      resource: 'movement',
      amount: 35,
    }))
  })

  it('moves a grappled target with the monster and spends double movement', () => {
    const { ankheg, hero, heroToken, map, initiativeOrder } = ankhegDragFixture()
    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.ok).toBe(true)
    expect(result.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: ankheg.id,
      resource: 'movement',
      amount: 20,
    }))
    expect(result.result.events).toContainEqual(expect.objectContaining({
      type: 'moved',
      actorId: heroToken.id,
      from: { x: 5, y: 15 },
      to: { x: 25, y: 15 },
    }))
    expect(result.movementTraces).toMatchObject([
      {
        tokenId: ankheg.id,
        to: { x: 25, y: 5 },
        path: [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 25, y: 5 }],
      },
      {
        tokenId: heroToken.id,
        to: { x: 25, y: 15 },
        path: [{ x: 5, y: 15 }, { x: 15, y: 15 }, { x: 25, y: 15 }],
      },
    ])
    expect(result.application?.map.tokens.find((entry) => entry.id === ankheg.id))
      .toMatchObject({ x: 25, y: 5 })
    expect(result.application?.map.tokens.find((entry) => entry.id === heroToken.id))
      .toMatchObject({ x: 25, y: 15 })
    expect(result.application?.changedTokenIds).toEqual(expect.arrayContaining([
      ankheg.id,
      heroToken.id,
    ]))
  })

  it('does not let the dragged target occupy and block the monster source path', () => {
    const { ankheg, hero, map, initiativeOrder } = ankhegDragFixture()
    map.tokens = map.tokens.map((entry) => entry.id === 'hero-token'
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

    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.distanceFeet).toBe(10)
    expect(result.path).toEqual([{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 25, y: 5 }])
  })

  it('rejects movement by a monster that is itself grappled', () => {
    const { ankheg, hero, map, initiativeOrder } = ankhegDragFixture()
    const grapple = createDnd5eConditionEffect({
      id: 'hero-basic-grapple',
      condition: 'grappled',
      source: { kind: 'feature', actorId: 'hero-token', rulesId: 'basic-action:grapple' },
      targetId: ankheg.id,
      duration: { type: 'permanent' },
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
    const grappledMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((entry) => entry.id === ankheg.id
        ? {
            ...entry,
            dnd5eCombatState: {
              schemaVersion: 2,
              conditions: ['grappled'],
              activeEffects: [grapple],
            },
          }
        : entry),
    }

    expect(resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map: grappledMap,
      characters: [hero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })).toEqual({ ok: false, reason: 'movement-locked' })
  })

  it('rejects dragging when the target translation crosses a wall despite an endpoint detour', () => {
    const { ankheg, hero, map, initiativeOrder } = ankhegDragFixture()
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

    expect(resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })).toEqual({ ok: false, reason: 'movement-blocked' })
  })

  it('opens one unlocked door before validating the dragged target through it', () => {
    const { ankheg, hero, map, initiativeOrder } = ankhegDragFixture()
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [{
        id: 'shared-door',
        kind: 'door',
        label: 'Shared door',
        points: [{ x: 10, y: 0 }, { x: 10, y: 20 }],
        state: 'closed',
        secret: false,
        blocksVision: true,
        blocksMovement: true,
        blocksLineOfEffect: true,
        baseHeightFeet: 0,
        heightFeet: 10,
        createdAt: 1,
      }],
      obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.doorsToOpen).toEqual(['shared-door'])
    expect(result.result.ok).toBe(true)
    expect(result.application?.map.tokens.find((entry) => entry.id === ankheg.id))
      .toMatchObject({ x: 25, y: 5 })
    expect(result.application?.map.tokens.find((entry) => entry.id === 'hero-token'))
      .toMatchObject({ x: 25, y: 15 })
    expect(result.application?.characters.find((entry) => entry.id === hero.id)
      ?.dnd5eCombatState?.activeEffects).toContainEqual(expect.objectContaining({
        id: dnd5eActiveEffectId('relation', 'grapple', ankheg.id, 'bite', 'hero-token'),
      }))
  })

  it('doubles difficult-terrain and vertical movement costs while dragging', () => {
    const { ankheg, hero, map, initiativeOrder } = ankhegDragFixture()
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [],
      obstacles: [{
        id: 'steep-mud',
        kind: 'obstacle',
        label: 'Steep mud',
        points: [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 100 }, { x: 10, y: 100 }],
        blocksVision: false,
        blocksMovement: false,
        blocksLineOfEffect: false,
        cover: 'none',
        baseHeightFeet: 0,
        heightFeet: 0,
        terrainCostMultiplier: 2,
        terrainRegion: true,
        terrainElevationFeet: 10,
        createdAt: 1,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 90),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.distanceFeet).toBe(20)
    expect(result.result.ok).toBe(true)
    expect(result.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: ankheg.id,
      resource: 'movement',
      amount: 60,
    }))
  })

  it('resolves Dash and Disengage in the same authoritative movement transaction', () => {
    const goblin = token({
      id: 'goblin', poolId: 'srd-5.1:goblin', x: 5, y: 5, hp: 7, maxHp: 7,
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: hero.id,
      x: 145, y: 45, hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'basic-move-map', name: 'Basic move map', width: 160, height: 60,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [goblin, heroToken],
    }
    const initiativeOrder = [
      { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]
    const dashed = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 75, y: 5 }, dash: true,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) return
    expect(dashed.result.ok, dashed.result.ok ? undefined : dashed.result.reason).toBe(true)
    expect(dashed.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: goblin.id, resource: 'action',
    }))

    const disengaged = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 25, y: 5 }, disengage: true,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(disengaged.ok).toBe(true)
    if (!disengaged.ok) return
    expect(disengaged.result.ok, disengaged.result.ok ? undefined : disengaged.result.reason).toBe(true)
    expect(disengaged.result.state.combatants[goblin.id].disengaged).toBe(true)
  })

  it('uses the monster Strength score for running and standing long jumps', () => {
    const goblin = token({
      id: 'goblin', poolId: 'srd-5.1:goblin', x: 5, y: 5, hp: 7, maxHp: 7,
      dnd5eCombatState: { schemaVersion: 2, runningJumpApproachFeet: 10 },
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: hero.id,
      x: 65, y: 45, hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'jump-map', name: 'Jump map', width: 80, height: 60,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [goblin, heroToken],
    }
    const initiativeOrder = [
      { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]
    const running = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 15, y: 5 },
      traversalMode: 'long-jump-running',
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(running.ok).toBe(true)
    if (running.ok) expect(running.result.ok).toBe(true)

    expect(resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 15, y: 5 },
      traversalMode: 'long-jump-standing',
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })).toEqual({ ok: false, reason: 'jump-too-far' })
  })

  it('applies an active Jump spell multiplier while prevalidating a standing long jump', () => {
    const jump = createDnd5eMechanicalEffect({
      id: 'goblin-jump-spell',
      definitionId: 'srd-5.1:spell:jump',
      label: '跳跃术',
      targetId: 'jumping-goblin',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'jump' },
      modifiers: { jumpDistanceMultiplier: 3 },
    })
    const goblin = token({
      id: 'jumping-goblin', poolId: 'srd-5.1:goblin', x: 5, y: 5, hp: 7, maxHp: 7,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [jump] },
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: hero.id,
      x: 65, y: 45, hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'standing-jump-spell-map', name: 'Standing jump spell map', width: 80, height: 60,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [goblin, heroToken],
    }
    const initiativeOrder = [
      { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]

    const standing = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 15, y: 5 },
      traversalMode: 'long-jump-standing',
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(standing.ok).toBe(true)
    if (standing.ok) expect(standing.result.ok).toBe(true)
  })

  it.each(['flat', 'wall', 'cliff'] as const)('uses an active Spider Climb effect as the monster walking speed: %s', (surface) => {
    const spiderClimb = createDnd5eMechanicalEffect({
      id: 'goblin-spider-climb',
      definitionId: 'activity:spider-climb:spider-climb:modifiers:0',
      label: '蛛行术',
      targetId: 'climbing-goblin',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'spider-climb' },
      modifiers: { climbSpeedEqualsWalking: true },
    })
    const goblin = token({
      id: 'climbing-goblin', poolId: 'srd-5.1:goblin', x: 5, y: 5, hp: 7, maxHp: 7,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [spiderClimb] },
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: hero.id,
      x: 85, y: 45, hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const climbMap: BattleMap = {
      id: 'spider-climb-map', name: 'Spider Climb map', width: 100, height: 60,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [goblin, heroToken],
    }

    const geometry = createEmptyMapGeometry(climbMap.id, 1)
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
    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map: climbMap, characters: [hero],
      initiativeOrder: [
        { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: goblin.id,
      to: destination,
      targetElevationFeet: surface === 'wall' ? 20 : undefined,
      traversalMode: 'climb',
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.distanceFeet).toBe(expectedDistance)
    expect(result.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: goblin.id, resource: 'movement', amount: expectedDistance,
    }))
  })

  it.each(['ordinary', 'carrier-only', 'both'] as const)('checks each carried creature traversal capability (%s)', mode => {
    const mound = token({
      id: 'mound', label: 'Shambling Mound', poolId: 'srd-5.1:shambling-mound',
      x: 5, y: 5, hp: 136, maxHp: 136, size: 2,
    })
    const relation = createDnd5eConditionEffect({
      id: 'mound-engulf',
      condition: 'grappled',
      source: { kind: 'monster', actorId: mound.id, rulesId: 'monster:srd-5.1:shambling-mound:engulf' },
      targetId: 'carried-token',
      relation: {
        schemaVersion: 1,
        kind: 'engulfed',
        sourceActorId: mound.id,
        sourceActionId: 'engulf',
        slotGroup: 'engulf',
        maxDistanceFeet: 5,
        movement: 'carry-target',
        endsOnSourceIncapacitated: false,
      },
    })
    const carriedToken = token({
      id: 'carried-token', type: 'enemy', poolId: 'srd-5.1:goblin',
      x: 5, y: 5, hp: 7, maxHp: 7,
      dnd5eCombatState: {
        schemaVersion: 2,
        conditions: ['grappled'],
        activeEffects: [relation],
      },
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: hero.id,
      x: 85, y: 85, hp: 20, maxHp: 20,
    })
    const map: BattleMap = {
      id: 'carry-map', name: 'Carry map', width: 100, height: 100,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [mound, carriedToken, heroToken],
    }
    if (mode !== 'ordinary') {
      const grant = (target: Token) => {
        const effect = createDnd5eMechanicalEffect({ definitionId: 'test:stone', label: 'Stone', targetId: target.id,
          source: { kind: 'spell', actorId: target.id, rulesId: 'test:stone' },
          duration: { type: 'concentration', sourceActorId: target.id, concentrationId: 'test:stone', remainingRounds: 100 },
          modifiers: { solidMaterialTraversal: { materials: ['stone'], endInside: 'eject-end-source-stun-until-next-turn-end' } } })
        target.dnd5eCombatState = { ...target.dnd5eCombatState, schemaVersion: 2, concentrationSpellId: 'test:stone',
          activeEffects: [...(target.dnd5eCombatState?.activeEffects ?? []), effect] }
      }
      grant(mound)
      if (mode === 'both') grant(carriedToken)
      const geometry = createEmptyMapGeometry(map.id, 1)
      geometry.walls.push({ id: 'rock-wall', kind: 'wall', label: 'Rock', material: 'stone',
        points: [{ x: 15, y: -50 }, { x: 15, y: 100 }], baseHeightFeet: 0, heightFeet: 20,
        blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, createdAt: 1 })
      setMapGeometryRuntime([geometry])
    }
    const original = structuredClone(map)
    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [hero],
      initiativeOrder: [
        { tokenId: mound.id, label: mound.label, emoji: '', color: '', roll: 20 },
        { tokenId: carriedToken.id, label: carriedToken.label, emoji: '', color: '', roll: 15 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: mound.id, to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(map).toEqual(original)
    if (mode === 'carrier-only') {
      expect(result).toMatchObject({ ok: false, reason: 'movement-blocked' })
      return
    }
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.ok, result.result.ok ? undefined : result.result.reason).toBe(true)
    expect(result.result.state.combatants[carriedToken.id]?.position).toEqual({ x: 25, y: 5 })
    expect(result.application?.map.tokens.find((entry) => entry.id === carriedToken.id))
      .toMatchObject({ x: 25, y: 5 })
    expect(result.movementTraces).toContainEqual(expect.objectContaining({
      tokenId: carriedToken.id,
      to: { x: 25, y: 5 },
    }))
  })

  it('prepares and resolves a monster after-movement save for Compulsion', () => {
    const controller = character({
      id: 'bard', name: 'Bard', saveDC: 15,
      dnd5eCombatState: {
        schemaVersion: 2,
        activityDirectionalCommands: {
          compulsion: {
            schemaVersion: 1,
            commandKey: 'compulsion',
            sourceActivityId: 'spell:compulsion:set-direction',
            angleDegrees: 0,
            updatedTurnKey: 'combat:1:bard-token:normal',
          },
        },
      },
    })
    const controllerToken = token({
      id: 'bard-token', label: controller.name, type: 'player', characterId: controller.id,
      x: 85, y: 85, hp: 20, maxHp: 20,
    })
    const compulsion = createDnd5eMechanicalEffect({
      id: 'compulsion-target',
      definitionId: 'activity:compulsion:compulsion-target:extension',
      label: '强迫术·受强迫',
      source: { kind: 'spell', actorId: controllerToken.id, rulesId: 'compulsion' },
      targetId: 'ape',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      repeatSave: { ability: 'wis', dc: 15, timing: 'after-movement', onSuccess: 'remove' },
      legacyCondition: 'directional-compulsion:compulsion',
    })
    const ape = token({
      id: 'ape', label: 'Ape', poolId: 'srd-5.1:ape', x: 5, y: 5, hp: 19, maxHp: 19,
      dnd5eCombatState: {
        schemaVersion: 2,
        conditions: ['directional-compulsion:compulsion'],
        activeEffects: [compulsion],
      },
    })
    const map: BattleMap = {
      id: 'compulsion-map', name: 'Compulsion map', width: 100, height: 100,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [ape, controllerToken],
    }
    const initiativeOrder = [
      { tokenId: ape.id, label: ape.label, emoji: '', color: '', roll: 20 },
      { tokenId: controllerToken.id, label: controllerToken.label, emoji: '', color: '', roll: 10 },
    ]
    const prepared = prepareDnd5eMonsterMovementSavingThrows({
      combatId: 'combat', map, characters: [controller], initiativeOrder,
      actorTokenId: ape.id, to: { x: 25, y: 5 },
    })
    expect(prepared?.movementRepeatSavingThrows).toEqual([
      expect.objectContaining({
        effectId: compulsion.id,
        sourceActorId: controllerToken.id,
        requirement: expect.objectContaining({ ability: 'wis', dc: 15, modifier: 1 }),
      }),
    ])

    const missingRoll = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [controller], initiativeOrder,
      actorTokenId: ape.id, to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(missingRoll.ok ? missingRoll.result.ok ? 'ok' : missingRoll.result.reason : missingRoll.reason)
      .toBe('invalid-dice')

    const resolved = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [controller], initiativeOrder,
      actorTokenId: ape.id, to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
      movementRepeatSavingThrows: [{ effectId: compulsion.id, d20: 20 }],
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: ape.id, ability: 'wis', success: true,
    }))
    expect(resolved.result.state.combatants[ape.id]?.classState.activeEffects)
      .not.toContainEqual(expect.objectContaining({ id: compulsion.id }))
  })
})

it.each([false, true])('spends authoritative monster movement against wind (terrain=%s)', terrain => {
  setMapGeometryRuntime([])
  const mover = token({ id: 'goblin', poolId: 'srd-5.1:goblin', x: 5, y: 5, hp: 7, maxHp: 7 })
  const board: BattleMap = { id: 'wind-move', name: 'Wind', width: 100, height: 100, gridSize: 10, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [mover],
    dnd5ePluginAreas: [{ id: 'wind', pluginId: 'test.wind', featureId: 'zone', label: 'Wind', color: '#fff', sourceCharacterId: 'other', sourceTokenId: 'other',
      createdRound: 1, expiresAfterRound: 11, includeSelf: true, relation: 'any', cells: Array.from({ length: 100 }, (_, i) => ({ col: i % 10, row: Math.floor(i / 10) })),
      movementCostMultiplier: terrain ? 2 : 1, directionalMovementCost: { direction: { dc: -1, dr: 0 }, additionalFeetPerFoot: 1 } }] }
  const result = resolveDnd5eMonsterMapMove({ combatId: 'wind', map: board, characters: [], actorTokenId: mover.id, to: { x: 25, y: 5 },
    initiativeOrder: [{ tokenId: mover.id, label: mover.label, emoji: '', color: '', roll: 20 }], turnEconomy: createDnd5eTurnEconomyCounts('turn', 30) })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) return
  expect(result.result.events).toContainEqual(expect.objectContaining({ type: 'turn-resource-spent', resource: 'movement', amount: terrain ? 30 : 20 }))
  expect(result.result.state.combatants[mover.id].turn.movementRemaining).toBe(terrain ? 0 : 10)
})


it.each(['ice', 'snow', 'sand'] as const)('charges monster movement using selective %s terrain exemption', surfaceMaterial => {
  const mover = token({ id: 'goblin', poolId: 'srd-5.1:goblin', x: 5, y: 5, hp: 7, maxHp: 7,
    dnd5eCombatState: { schemaVersion: 2, activeEffects: [createDnd5eMechanicalEffect({
      definitionId: 'test:ice-terrain', label: 'Ice terrain', targetId: 'goblin',
      source: { kind: 'spell', actorId: 'goblin', rulesId: 'test:ice', magical: true },
      modifiers: { environmentalCapabilities: { ignoreDifficultTerrainMaterials: ['ice', 'snow'] } },
    })] },
  })
  const board: BattleMap = { id: 'ice-move', name: 'Ice', width: 100, height: 100, gridSize: 10, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [mover] }
  const geometry = createEmptyMapGeometry(board.id, 1)
  geometry.obstacles.push({ id: 'surface', kind: 'obstacle', label: 'Surface',
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
    blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
    heightFeet: 0, baseHeightFeet: 0, traversal: 'ground', terrainCostMultiplier: 2, surfaceMaterial, createdAt: 1 })
  setMapGeometryRuntime([geometry])
  try {
    const result = resolveDnd5eMonsterMapMove({ combatId: 'ice', map: board, characters: [], actorTokenId: mover.id, to: { x: 25, y: 5 },
      initiativeOrder: [{ tokenId: mover.id, label: mover.label, emoji: '', color: '', roll: 20 }], turnEconomy: createDnd5eTurnEconomyCounts('turn', 30) })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.result.state.combatants[mover.id].turn.movementRemaining).toBe(surfaceMaterial === 'sand' ? 10 : 20)
  } finally { setMapGeometryRuntime([]) }
})
import {resolveDnd5eDeferredMovementRepeatSaves} from './headlessCombatEngine'
it.each([1,2])('defers after-movement saves across %s committed monster segments',segments=>{
 const effect=createDnd5eMechanicalEffect({id:'move-save',definitionId:'test:move-save',label:'After movement',
  targetId:'mover',source:{kind:'spell',actorId:'source'},duration:{type:'rounds',remainingRounds:10,tickOn:'target-turn-end'},
  repeatSave:{ability:'wis',dc:15,timing:'after-movement',onSuccess:'remove'}})
 let board:BattleMap={id:'deferred-map',name:'Map',width:200,height:100,gridSize:10,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,
  tokens:[token({id:'mover',poolId:'srd-5.1:ape',x:5,y:5,hp:30,maxHp:30,dnd5eCombatState:{schemaVersion:2,activeEffects:[effect]}}),token({id:'source',poolId:'srd-5.1:kobold',x:95,y:85})]}
 const initiativeOrder=board.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i}))
 let state:Parameters<typeof resolveDnd5eDeferredMovementRepeatSaves>[0]|undefined
 for(let i=0;i<segments;i++){
  const result=resolveDnd5eMonsterMapMove({combatId:'deferred',map:board,characters:[],initiativeOrder,actorTokenId:'mover',to:{x:15+i*10,y:5},
   turnEconomy:createDnd5eTurnEconomyCounts('turn',30-i*5),deferMovementRepeatSavingThrows:true})
  expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
  expect(result.result.ok).toBe(true)
  expect(result.result.events.some(e=>e.type==='saving-throw-resolved')).toBe(false)
  expect(result.result.state.combatants.mover.classState.activeEffects?.some(e=>e.id===effect.id)).toBe(true)
  const atomic=withDnd5ePendingMovementCompletion(result.application!,'mover',`completion:${i}`,true)
  expect(atomic.map.dnd5ePendingMovementCompletions).toEqual([{id:'completion:0',actorTokenId:'mover'}])
  board=JSON.parse(JSON.stringify(atomic.map));state=result.result.state
 }
 const finish=resolveDnd5eDeferredMovementRepeatSaves(state!,'mover',true,[{effectId:effect.id,d20:20}],{transactionId:'finish',effectRollDice:{}})
 expect(finish.ok).toBe(true)
 expect(finish.events.filter(e=>e.type==='saving-throw-resolved')).toHaveLength(1)
 expect(finish.state.combatants.mover.classState.activeEffects?.some(e=>e.id===effect.id)).toBe(false)
 expect(finish.state.combatants.mover.position).toEqual({x:5+segments*10,y:5})
})






