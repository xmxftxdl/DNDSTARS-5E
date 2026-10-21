import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { createDnd5eMechanicalEffect, createDnd5eConditionEffect } from './activeEffects'
import { mapGeometryPlacementBlocked } from '../../lib/mapGeometry'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction,
  dnd5eFeatherFallReactionOption, resolveDnd5eFeatherFallReaction, dnd5eCombatantPairKey } from './headlessCombatEngine'
import { appendDnd5eSolidExitMovementTraces, settleDnd5eSolidMaterialExit, dnd5eLostSolidMaterialTraversal, replayDnd5eSolidExitFeatherFallChoices } from './solidMaterialExitSettlement'
import { previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,
  resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange } from './headlessCombatEngine'

function fixture() {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
    position: { x: 125, y: 125 }, concentrating: id === 'caster' })
  const caster = make('caster', 20), other = make('other', 10)
  caster.classState.concentrationSpellId = 'test:stone'
  caster.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'test:stone:body', label: 'Stone',
    source: { kind: 'spell', actorId: caster.id, rulesId: 'test:stone', magical: true }, targetId: caster.id,
    duration: { type: 'concentration', sourceActorId: caster.id, concentrationId: 'test:stone', remainingRounds: 100 },
    modifiers: { solidMaterialTraversal: { materials: ['earth', 'stone'], endInside: 'eject-end-source-stun-until-next-turn-end' } } })]
  const state = startDnd5eHeadlessCombat('exit', [caster, other])
  const map: BattleMap = { id: 'map', name: 'Map', width: 250, height: 250, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [{ id: caster.id, label: 'Caster', type: 'enemy', x: 125, y: 125, size: 1, color: '', emoji: '' }] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.obstacles.push({ id: 'stone', kind: 'obstacle', label: 'Stone', surfaceMaterial: 'stone',
    points: [{ x: 100, y: 100 }, { x: 150, y: 100 }, { x: 150, y: 150 }, { x: 100, y: 150 }],
    blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10,
    cover: 'total', createdAt: 1 })
  return { state, map, geometry, actorId: caster.id }
}

it('atomically ejects, ends source concentration and stuns through the next turn end', () => {
  const input = fixture(), before = structuredClone(input)
  const result = settleDnd5eSolidMaterialExit(input)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  expect(input).toEqual(before)
  expect(result.state.combatants.caster.position).toEqual({ x: 75, y: 75 })
  expect(result.state.combatants.caster.concentrating).toBe(false)
  expect(result.state.combatants.caster.conditions).toContain('stunned')
  expect(result.state.combatants.caster.classState.activeEffects?.some(e => e.modifiers?.solidMaterialTraversal)).toBe(false)
  const reloaded = JSON.parse(JSON.stringify(result.state))
  const end = resolveDnd5eHeadlessAction(reloaded, { type: 'end-turn', actorId: 'caster' })
  expect(end.ok).toBe(true)
  expect(end.state.combatants.caster.conditions).toContain('stunned')
  const next = resolveDnd5eHeadlessAction(end.state, { type: 'end-turn', actorId: 'other' })
  expect(next.ok).toBe(true)
  const done = resolveDnd5eHeadlessAction(next.state, { type: 'end-turn', actorId: 'caster' })
  expect(done.ok).toBe(true)
  expect(done.state.combatants.caster.conditions).not.toContain('stunned')
})

it('expires at the next target turn end when ejected outside its own turn', () => {
  const input = fixture()
  input.state = resolveDnd5eHeadlessAction(input.state, { type: 'end-turn', actorId: 'caster' }).state
  const result = settleDnd5eSolidMaterialExit(input)
  if (!result.ok) throw new Error(result.reason)
  const next = resolveDnd5eHeadlessAction(result.state, { type: 'end-turn', actorId: 'other' })
  expect(next.ok).toBe(true)
  expect(next.state.combatants.caster.conditions).toContain('stunned')
  const done = resolveDnd5eHeadlessAction(next.state, { type: 'end-turn', actorId: 'caster' })
  expect(done.ok).toBe(true)
  expect(done.state.combatants.caster.conditions).not.toContain('stunned')
})

it('uses current Headless creature positions rather than stale map occupancy', () => {
  const input = fixture()
  input.map.tokens.push({ ...input.map.tokens[0], id: 'other', x: 225, y: 225 })
  input.state.combatants.other.position = { x: 75, y: 75 }
  input.state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'other')]: 999 }
  const before = structuredClone(input)
  const result = settleDnd5eSolidMaterialExit(input)
  if (!result.ok) throw new Error(result.reason)
  expect(result.state.combatants.caster.position).not.toEqual({ x: 75, y: 75 })
  expect(result.state.combatants.caster.airborne).toBe(false)
  expect(result.state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey('caster', 'other')]).toBe(5)
  expect(input).toEqual(before)
})

it('refuses mismatched source identity without terminating another spell', () => {
  const input = fixture()
  input.state.combatants.caster.classState.concentrationSpellId = 'test:other-spell'
  const before = structuredClone(input)
  expect(settleDnd5eSolidMaterialExit(input)).toEqual({ ok: false, reason: 'solid-traversal-source-mismatch' })
  expect(input).toEqual(before)
})

it('ejects onto a solid stone plateau without falling back into its body', () => {
  const input = fixture()
  delete input.state.combatants.other
  input.geometry.obstacles[0].points = [{ x: 0, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 250 }, { x: 0, y: 250 }]
  const exited = settleDnd5eSolidMaterialExit(input)
  if (!exited.ok) throw new Error(exited.reason)
  expect(exited.state.combatants.caster).toMatchObject({ elevationFeet: 10, groundElevationFeet: 10, airborne: false })
  expect(exited.state.combatants.caster.conditions).toContain('stunned')
  expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(input.state, exited.state, ['caster'])).toEqual([])
})

it.each([1, 2])('moves a contained creature with its carrier into a space fitting both (size=%s)', size => {
  const input = fixture()
  input.state.combatants.other.classState.activeEffects = [createDnd5eConditionEffect({
    condition: 'grappled', targetId: 'other', source: { kind: 'monster', actorId: 'caster', rulesId: 'test:engulf' },
    escapeCheck: { ability: 'str', skill: 'athletics', alternativeAbility: 'dex', alternativeSkill: 'acrobatics', dc: 14, economy: 'action' },
    relation: { schemaVersion: 1, kind: 'engulfed', sourceActorId: 'caster', sourceActionId: 'engulf',
      slotGroup: 'engulf', maxDistanceFeet: 5, movement: 'carry-target', endsOnSourceIncapacitated: false },
  })]
  input.map.tokens.push({ ...input.map.tokens[0], id: 'other', size })
  const before = structuredClone(input)
  const result = settleDnd5eSolidMaterialExit(input)
  if (!result.ok) throw new Error(result.reason)
  const carrier = result.state.combatants.caster, carried = result.state.combatants.other
  expect(carried.position).toEqual(carrier.position)
  expect(carried.elevationFeet).toBe(carrier.elevationFeet)
  expect(carried.classState.activeEffects?.some(effect => effect.relation?.movement === 'carry-target')).toBe(true)
  expect(result.events.filter(event => event.type === 'moved').map(event => event.type === 'moved' && event.actorId).sort()).toEqual(['caster', 'other'])
  expect(mapGeometryPlacementBlocked({ map: input.map, geometry: input.geometry, token: input.map.tokens[1],
    at: carried.position, elevationFeet: carried.elevationFeet }).blocked).toBe(false)
  expect(input).toEqual(before)
})

it.each([true, false])('checks imported concentration identity through the exact spell source (matching=%s)', matching => {
  const input = fixture()
  const effect = input.state.combatants.caster.classState.activeEffects![0]
  if (effect.duration.type !== 'concentration') throw new Error('Expected concentration')
  delete effect.duration.concentrationId
  if (!matching) effect.source.rulesId = 'another-plugin:other-spell'
  const before = structuredClone(input)
  const result = settleDnd5eSolidMaterialExit(input)
  expect(result.ok).toBe(matching)
  if (result.ok) expect(result.state.combatants.caster.concentrating).toBe(false)
  else expect(result.reason).toBe('solid-traversal-source-mismatch')
  expect(input).toEqual(before)
})

it('evaluates real feather fall after ejection: stunned self cannot react, an ally spends its own resources', () => {
  const input = fixture()
  for (const actor of Object.values(input.state.combatants)) {
    actor.classId = 'wizard'
    actor.classLevels = { wizard: 5 }
    actor.classSelections = { 'spell-prepared': ['feather-fall'] }
    actor.classResources = { 'dnd5e-spell-slot-1': { current: 1, max: 4 } }
  }
  expect(dnd5eFeatherFallReactionOption(input.state.combatants.caster)).toBeDefined()
  const exited = settleDnd5eSolidMaterialExit(input)
  if (!exited.ok) throw new Error(exited.reason)
  exited.state.combatants.caster.elevationFeet = 10
  exited.state.combatants.caster.airborne = true
  exited.state.combatants.caster.groundElevationFeet = 0
  exited.state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'other')]: 10 }
  const before = structuredClone(exited.state)
  const falls = previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(input.state, exited.state, ['caster'])
  expect(falls).toHaveLength(1)
  expect(dnd5eFeatherFallReactionOption(exited.state.combatants.caster)).toBeUndefined()
  const self = resolveDnd5eFeatherFallReaction(exited.state, { casterId: 'caster', falls })
  expect(self.ok).toBe(false)
  expect(self.state).toEqual(before)
  const ally = resolveDnd5eFeatherFallReaction(exited.state, { casterId: 'other', falls })
  expect(ally.ok).toBe(true)
  expect(ally.state.combatants.other.turn.reactionAvailable).toBe(false)
  expect(ally.state.combatants.other.classResources['dnd5e-spell-slot-1'].current).toBe(0)
  expect(ally.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(1)
  expect(ally.state.combatants.caster.conditions).toContain('stunned')
  expect(ally.state.combatants.caster.classState.activeEffects?.some(effect => effect.modifiers?.controlledDescent)).toBe(true)
  const choices = [{ casterId: 'other', targetIds: ['caster'] }]
  const replay = replayDnd5eSolidExitFeatherFallChoices(input.state, exited.state, ['caster'], choices)
  expect(replay.ok).toBe(true)
  if (!replay.ok) throw new Error('Expected valid reaction replay')
  const withoutTimestamps = (value: unknown) => JSON.parse(JSON.stringify(value, (key, entry) => key === 'appliedAt' ? undefined : entry))
  expect(withoutTimestamps(replay.state)).toEqual(withoutTimestamps(ally.state))
  expect(replay.events).toEqual(ally.events)
  expect(withoutTimestamps(replayDnd5eSolidExitFeatherFallChoices(input.state, exited.state, ['caster'], choices))).toEqual(withoutTimestamps(replay))
  expect(replayDnd5eSolidExitFeatherFallChoices(input.state, exited.state, ['caster'], [...choices, ...choices])).toEqual({ ok: false })
  expect(replayDnd5eSolidExitFeatherFallChoices(input.state, exited.state, ['caster'], [{ casterId: 'caster', targetIds: ['caster'] }])).toEqual({ ok: false })
  expect(exited.state).toEqual(before)
})

it.each([true, false])('distinguishes pillar-top support from unsupported ejection (supports=%s)', supports => {
  const input = fixture()
  input.geometry.obstacles = []
  delete input.state.combatants.other
  input.map.dnd5ePluginAreas = [{ id: 'pillar', pluginId: 'test', featureId: 'pillar', label: 'Pillar', color: '#aaa',
    sourceCharacterId: 'other-caster', sourceTokenId: 'other-caster', createdRound: 1, expiresAfterRound: 100,
    cells: [{ col: 2, row: 2 }], anchorCell: { col: 2, row: 2 }, circularGeometry: { radiusFeet: 100 },
    blocking: { movement: true }, vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 },
    entityProfile: { material: 'stone', armorClass: 15, hitPoints: 30, cannotAttack: true, invisible: false,
      supportsStanding: supports ? true : undefined },
  }]
  const before = structuredClone(input)
  const exited = settleDnd5eSolidMaterialExit(input)
  if (!exited.ok) throw new Error(exited.reason)
  expect(exited.state.combatants.caster.elevationFeet).toBe(10)
  expect(exited.state.combatants.caster.groundElevationFeet).toBe(supports ? 10 : 0)
  const falls = previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(input.state, exited.state, ['caster'])
  expect(falls).toHaveLength(supports ? 0 : 1)
  if (!supports) {
    expect(falls[0]).toMatchObject({ fallDistanceFeet: 10, fallingDamageDice: 1 })
    const missing = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(input.state, exited.state, undefined, ['caster'])
    expect(missing).toMatchObject({ ok: false, reason: 'invalid-dice', state: input.state, events: [] })
    const landed = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(input.state, exited.state, { caster: [4] }, ['caster'])
    expect(landed.ok).toBe(true)
    expect(landed.state.combatants.caster).toMatchObject({ elevationFeet: 0, currentHp: 26, concentrating: false })
    expect(landed.state.combatants.caster.conditions).toEqual(expect.arrayContaining(['stunned', 'prone']))
    const traces = appendDnd5eSolidExitMovementTraces([{ tokenId: 'caster', to: input.state.combatants.caster.position,
      path: [input.state.combatants.caster.position], pathElevationsFeet: [0] }], [...exited.events, ...landed.events])
    expect(traces[0].pathElevationsFeet.at(-1)).toBe(0)
    expect(traces[0].to).toEqual(landed.state.combatants.caster.position)
    const protectedState = structuredClone(exited.state)
    protectedState.combatants.other = fixture().state.combatants.other
    protectedState.combatants.other.position = { x: 225, y: 225 }
    protectedState.combatants.caster.classState.activeEffects!.push(createDnd5eMechanicalEffect({
      definitionId: 'test:feather-fall', label: 'Feather Fall', targetId: 'caster',
      source: { kind: 'spell', actorId: 'ally', rulesId: 'feather-fall', magical: true },
      modifiers: { controlledDescent: { maximumFeetPerRound: 60, safeLanding: true, endsOnLanding: true } },
    }))
    const safe = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(input.state, protectedState, undefined, ['caster'])
    expect(safe.ok).toBe(true)
    expect(safe.state.combatants.caster).toMatchObject({ elevationFeet: 10, currentHp: 30 })
    expect(safe.state.combatants.caster.conditions).toContain('stunned')
    expect(safe.state.combatants.caster.conditions).not.toContain('prone')
    const end = resolveDnd5eHeadlessAction(safe.state, { type: 'end-turn', actorId: 'caster' })
    const next = resolveDnd5eHeadlessAction(end.state, { type: 'end-turn', actorId: 'other' })
    expect(next.ok).toBe(true)
    expect(next.state.combatants.caster).toMatchObject({ elevationFeet: 0, currentHp: 30 })
    expect(next.state.combatants.caster.conditions).toContain('stunned')
    expect(next.state.combatants.caster.conditions).not.toContain('prone')
    expect(next.state.combatants.caster.classState.activeEffects?.some(effect => effect.modifiers?.controlledDescent)).toBe(false)
  }
  expect(input).toEqual(before)
})

it('uses the movement source after concentration loss without resurrecting the spell', () => {
  const input = fixture()
  const broken = resolveDnd5eHeadlessAction(input.state, { type: 'concentration-save', actorId: 'caster', d20: 1, dc: 30 })
  expect(broken.ok).toBe(true)
  expect(dnd5eLostSolidMaterialTraversal(input.state, broken.state, 'caster')).toBe(true)
  expect(dnd5eLostSolidMaterialTraversal(input.state, input.state, 'caster')).toBe(false)
  expect(dnd5eLostSolidMaterialTraversal(input.state, broken.state, 'other')).toBe(false)
  const result = settleDnd5eSolidMaterialExit({ ...input, state: broken.state, movementSourceState: input.state })
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(result.state.combatants.caster.position).toEqual({ x: 75, y: 75 })
  expect(result.state.combatants.caster.concentrating).toBe(false)
  expect(result.state.combatants.caster.conditions).toContain('stunned')
  expect(dnd5eLostSolidMaterialTraversal(broken.state, result.state, 'caster')).toBe(false)
  expect(result.state.combatants.caster.classState.activeEffects?.some(e => e.modifiers?.solidMaterialTraversal) ?? false).toBe(false)
  const outside = structuredClone(broken.state)
  outside.combatants.caster.position = { x: 25, y: 25 }
  const safe = settleDnd5eSolidMaterialExit({ ...input, state: outside, movementSourceState: input.state })
  expect(safe.ok).toBe(true)
  if (safe.ok) { expect(safe.events).toEqual([]); expect(safe.state.combatants.caster.conditions).not.toContain('stunned') }
  expect(settleDnd5eSolidMaterialExit({ ...input, state: broken.state,
    movementSourceState: { ...input.state, combatId: 'another-combat' } })).toMatchObject({ ok: false, reason: 'solid-traversal-source-mismatch' })
})


it.each([1,20])('replays a Feather Fall casting save %s on the fresh ejection state', d20 => {
  const input=fixture()
  const ally=input.state.combatants.other
  ally.classId='wizard';ally.classLevels={wizard:5};ally.classSelections={'spell-prepared':['feather-fall']};ally.classResources={'dnd5e-spell-slot-1':{current:1,max:1}}
  const pain=createDnd5eMechanicalEffect({definitionId:'pain',label:'Pain',targetId:'other',source:{kind:'spell',actorId:'caster'},spellcastingSave:{ability:'con',dc:18}})
  ally.classState.activeEffects=[pain]
  const exited=settleDnd5eSolidMaterialExit(input)
  if(!exited.ok)throw new Error(exited.reason)
  Object.assign(exited.state.combatants.caster,{elevationFeet:10,airborne:true,groundElevationFeet:0})
  exited.state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('caster','other')]:10}
  const falls=previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(input.state,exited.state,['caster'])
  const spellcastingSavingThrows=[{effectId:pain.id,d20}]
  const direct=resolveDnd5eFeatherFallReaction(exited.state,{casterId:'other',falls,spellcastingSavingThrows})
  const replay=replayDnd5eSolidExitFeatherFallChoices(input.state,exited.state,['caster'],[{casterId:'other',targetIds:['caster'],spellcastingSavingThrows}])
  expect(direct.ok).toBe(true);expect(replay.ok).toBe(true)
  if(!direct.ok||!replay.ok)return
  const clean=(value:unknown)=>JSON.parse(JSON.stringify(value,(key,entry)=>key==='appliedAt'?undefined:entry))
  expect(clean(replay.state)).toEqual(clean(direct.state))
  expect(replay.events).toEqual(direct.events)
  expect(replay.state.combatants.other.classResources['dnd5e-spell-slot-1'].current).toBe(0)
})
