import { expect, it } from 'vitest'
import { createDnd5eConditionEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { advanceDnd5eSubmergedBreathing as advance, advanceDnd5eSubmergedBreathingAtCombatRound as atRound, advanceDnd5eSubmergedBreathingAtCampaignTime as atTime, normalizeDnd5eSubmergedBreathing } from './submergedBreathing'

const effect = createDnd5eConditionEffect({ condition: 'restrained', targetId: 'target', source: { kind: 'plugin', actorId: 'caster' },
  modifiers: { submerged: true } })
const input = { effects: [effect], constitutionScore: 14, elapsedSeconds: 0, stepKey: 'capture', targetTurnStart: false }

it('preserves campaign seconds across reload, rejects gaps, and excludes already charged combat rounds', () => {
  const first = atTime({ ...input, fromSeconds: 28_800, toSeconds: 28_806 })
  expect(first.state).toMatchObject({ breathSeconds: 174, campaignClockSeconds: 28_806 })
  const saved = normalizeDnd5eSubmergedBreathing(JSON.parse(JSON.stringify(first.state)))
  expect(atTime({ ...input, state: saved, fromSeconds: 28_800, toSeconds: 28_806 }).state).toEqual(saved)
  const combat = atRound({ ...input, state: saved, combatId: 'a', round: 1 })
  const nextRound = atRound({ ...input, state: combat.state, combatId: 'a', round: 2 })
  expect(nextRound.state?.breathSeconds).toBe(168)
  const exploration = atTime({ ...input, state: nextRound.state, fromSeconds: 28_806, toSeconds: 28_818, creditedCombatRounds: 1 })
  expect(exploration.state).toMatchObject({ breathSeconds: 162, campaignClockSeconds: 28_818 })
  expect(atRound({ ...input, state: exploration.state, combatId: 'a', round: 3 }).state?.breathSeconds).toBe(162)
  expect(() => atTime({ ...input, state: saved, fromSeconds: 28_812, toSeconds: 28_818 })).toThrow('stale-submerged-campaign-clock')
  expect(() => atTime({ ...input, state: saved, fromSeconds: 28_794, toSeconds: 28_800 })).toThrow('stale-submerged-campaign-clock')
  expect(() => atTime({ ...input, fromSeconds: 0, toSeconds: 5, creditedCombatRounds: 1 })).toThrow('invalid-submerged-campaign-clock')
  expect(normalizeDnd5eSubmergedBreathing({ ...saved, campaignClockSeconds: -1 })).toBeUndefined()
  const short = atTime({ ...input, constitutionScore: 8, fromSeconds: 0, toSeconds: 35, targetTurnStart: true })
  expect(short.state).toMatchObject({ breathSeconds: 0, survivalSeconds: 1, collapsed: false })
  expect(atTime({ ...input, constitutionScore: 8, state: short.state, fromSeconds: 35, toSeconds: 36, targetTurnStart: true }).dropToZero).toBe(true)
})

it('reconciles changing breath capacity without refunding time or refilling exhausted breath', () => {
  const extended = { ...effect, id: 'extended', modifiers: { environmentalCapabilities: { holdBreathSeconds: 3600 } } }
  const initial = advance({ ...input, elapsedSeconds: 60 })
  expect(initial.state?.breathSeconds).toBe(120)
  const buffed = advance({ ...input, state: initial.state, effects: [effect, extended] })
  expect(buffed.state?.breathSeconds).toBe(3540)
  const expired = advance({ ...input, state: buffed.state, effects: [effect] })
  expect(expired.state?.breathSeconds).toBe(120)
  const suppressed = advance({ ...input, state: buffed.state, effects: [effect, { ...extended, suspendedBy: ['antimagic'] }] })
  expect(suppressed.state?.breathSeconds).toBe(120)
  const exhausted = advance({ ...input, state: expired.state, elapsedSeconds: 120, stepKey: 'elapsed' })
  expect(advance({ ...input, state: exhausted.state, effects: [effect, extended] }).state?.breathSeconds).toBe(0)
  expect(normalizeDnd5eSubmergedBreathing({ ...expired.state, breathCapacitySeconds: 30 })).toBeUndefined()
})

it('preserves imported no-air and extended-breath capabilities and respects suppression', () => {
  const airless = { ...effect, id: 'airless', modifiers: { environmentalCapabilities: { doesNotNeedAir: true as const } } }
  const extended = { ...effect, id: 'extended', modifiers: { environmentalCapabilities: { holdBreathSeconds: 3600 } } }
  expect(validateDnd5eActiveEffectsStrict([airless, extended]).ok).toBe(true)
  const [savedAirless, savedExtended] = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([airless, extended])))
  expect(advance({ ...input, effects: [effect, savedAirless] }).state).toBeUndefined()
  expect(advance({ ...input, effects: [effect, savedExtended] }).state?.breathSeconds).toBe(3600)
  expect(advance({ ...input, effects: [effect, { ...savedAirless, suspendedBy: ['antimagic'] }] }).state).toBeDefined()
  expect(advance({ ...input, effects: [effect, { ...savedExtended, suspendedBy: ['antimagic'] }] }).state?.breathSeconds).toBe(180)
})

it('reads native breathing traits for both monsters and current creature forms', async () => {
  const { dnd5eNativeMonsterBreathing } = await import('./monsterBreathing')
  const { normalizeCharacter } = await import('../../store/characters')
  const { createDnd5eMapCombatSnapshot } = await import('./mapBridge')
  const { syncDnd5eSubmergedBreathingClock } = await import('./headlessCombatEngine')
  expect(dnd5eNativeMonsterBreathing('srd-5.1:reef-shark')).toMatchObject({ canBreatheWater: true })
  expect(dnd5eNativeMonsterBreathing('srd-5.1:crocodile')).toMatchObject({ holdBreathSeconds: 900 })
  expect(dnd5eNativeMonsterBreathing('srd-5.1:killer-whale')).toMatchObject({ holdBreathSeconds: 1800 })
  expect(dnd5eNativeMonsterBreathing('srd-5.1:hydra')).toMatchObject({ holdBreathSeconds: 3600 })
  expect(dnd5eNativeMonsterBreathing('custom:water-looking-creature')).toEqual({})
  const character = normalizeCharacter({ id: 'breather', name: 'Breather', maxHp: 20, currentHp: 20,
    dnd5eCombatState: { schemaVersion: 2, activeEffects: [effect] }, conditions: ['restrained'] })
  const map: import('../../store/maps').BattleMap = { id: 'water', name: 'Water', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [{ id: 'target', characterId: character.id, type: 'player', label: 'Target', x: 25, y: 25, size: 1, color: '', emoji: '' }] }
  const snapshot = createDnd5eMapCombatSnapshot({ map, characters: [character], combatId: 'breathing', round: 1,
    initiativeOrder: [{ tokenId: 'target', label: 'Target', color: '', emoji: '', roll: 10 }] })
  const actor = snapshot.state.combatants.target
  actor.statBlockId = 'srd-5.1:crocodile'
  syncDnd5eSubmergedBreathingClock(snapshot.state)
  expect(actor.classState.submergedBreathing?.breathSeconds).toBe(900)
  actor.classState.wildShapeFormId = 'srd-5.1:frog'
  syncDnd5eSubmergedBreathingClock(snapshot.state)
  expect(actor.classState.submergedBreathing).toBeUndefined()
  actor.classState.wildShapeFormId = undefined
  actor.statBlockId = 'srd-5.1:reef-shark'
  syncDnd5eSubmergedBreathingClock(snapshot.state)
  expect(actor.classState.submergedBreathing).toBeUndefined()
  // An unrelated turn must not start a breathing calculation or validate its inputs.
  actor.classState.activeEffects = []
  actor.abilities.con = 0
  const { resolveDnd5eHeadlessAction } = await import('./headlessCombatEngine')
  const unrelatedTurn = resolveDnd5eHeadlessAction(snapshot.state, { type: 'begin-turn', actorId: 'target' })
  expect(unrelatedTurn.ok, JSON.stringify(unrelatedTurn.events)).toBe(true)
  expect(unrelatedTurn.state.combatants.target.classState.submergedBreathing).toBeUndefined()
}, 30_000)

it('server rejects malformed player and NPC breathing state before persistence', async () => {
  const { validateSharedStateShape } = await import('../../../scripts/shared-server-core.mjs')
  const state = advance(input).state!
  for (const malformed of [{ ...state, breathSeconds: -1 }, { ...state, breathSeconds: '30' },
    { ...state, collapsed: true }, { ...state, combatClock: { combatId: 'combat', round: -1 } }, { ...state, injected: true }]) {
    const character = { id: 'hero', name: 'Hero', conditions: [], dnd5eCombatState: { schemaVersion: 2, submergedBreathing: malformed } }
    expect(validateSharedStateShape('characters', { characters: [character] })).toMatchObject({ ok: false, reason: 'invalid-submerged-breathing-state' })
    const token = { id: 'npc', type: 'npc', label: 'NPC', x: 25, y: 25, size: 1, color: '', emoji: '', dnd5eCombatState: character.dnd5eCombatState }
    expect(validateSharedStateShape('maps', { maps: [{ id: 'water', name: 'Water', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [token] }] })).toMatchObject({ ok: false, reason: 'invalid-submerged-breathing-state' })
  }
  expect(validateSharedStateShape('characters', { characters: [{ id: 'hero', name: 'Hero', conditions: [],
    dnd5eCombatState: { schemaVersion: 2, submergedBreathing: state } }] }).ok).toBe(true)
}, 30_000)

it('settles suffocation at actual turn start and blocks healing, stabilization, and natural-20 recovery until breathing resumes', async () => {
  const { normalizeCharacter } = await import('../../store/characters')
  const { createDnd5eMapCombatSnapshot } = await import('./mapBridge')
  const { resolveDnd5eHeadlessAction, applyDnd5eHeadlessHealing, applyDnd5eHeadlessStabilization } = await import('./headlessCombatEngine')
  const character = normalizeCharacter({ id: 'breather', name: 'Breather', maxHp: 20, currentHp: 20,
    dnd5eCombatState: { schemaVersion: 2, activeEffects: [effect], submergedBreathing: {
      schemaVersion: 1, breathSeconds: 0, survivalSeconds: 6, collapsed: false, lastStepKey: 'prior', combatClock: { combatId: 'breathing', round: 1 },
    } }, conditions: ['restrained'] })
  const map: import('../../store/maps').BattleMap = { id: 'water', name: 'Water', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [{ id: 'target', characterId: character.id, type: 'player', label: 'Target', x: 25, y: 25, size: 1, color: '', emoji: '' }] }
  const snapshot = createDnd5eMapCombatSnapshot({ map, characters: [character], combatId: 'breathing', round: 2,
    initiativeOrder: [{ tokenId: 'target', label: 'Target', color: '', emoji: '', roll: 10 }] })
  const result = resolveDnd5eHeadlessAction(snapshot.state, { type: 'begin-turn', actorId: 'target' })
  expect(result.ok, JSON.stringify(result.events)).toBe(true)
  const target = result.state.combatants.target
  expect(target.currentHp).toBe(0)
  expect(target.deathSaves).toMatchObject({ stable: false, dead: false })
  expect(target.conditions).toContain('unconscious')
  expect(target.classState.submergedBreathing?.collapsed).toBe(true)
  const events: import('./headlessCombatEngine').Dnd5eCombatEvent[] = []
  expect(applyDnd5eHeadlessHealing(target, 10, events, true)).toBe(0)
  expect(applyDnd5eHeadlessStabilization(target, 'helper', events)).toBe(false)
  const deathSave = resolveDnd5eHeadlessAction(result.state, { type: 'death-save', actorId: 'target', d20: 20 })
  expect(deathSave.ok).toBe(true)
  expect(deathSave.state.combatants.target.currentHp).toBe(0)
  expect(deathSave.state.combatants.target.deathSaves.stable).toBe(false)
  target.classState.activeEffects = target.classState.activeEffects?.filter(candidate => candidate.id !== effect.id)
  expect(applyDnd5eHeadlessStabilization(target, 'helper', events)).toBe(true)
  expect(applyDnd5eHeadlessHealing(target, 10, events, true)).toBe(10)
  expect(target.currentHp).toBe(10)
}, 30_000)

it.each(['srd-5.1:frog', 'srd-5.1:goblin'])('ends a creature form at zero and reevaluates original breathing: %s', async originalStatBlockId => {
  const { normalizeCharacter } = await import('../../store/characters')
  const { createDnd5eMapCombatSnapshot } = await import('./mapBridge')
  const { resolveDnd5eHeadlessAction } = await import('./headlessCombatEngine')
  const character = normalizeCharacter({ id: 'aquatic', name: 'Aquatic', maxHp: 20, currentHp: 20 })
  const map: import('../../store/maps').BattleMap = { id: 'water', name: 'Water', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [{ id: 'target', characterId: character.id, type: 'player', label: 'Target', x: 25, y: 25, size: 1, color: '', emoji: '' }] }
  const snapshot = createDnd5eMapCombatSnapshot({ map, characters: [character], combatId: 'breathing', round: 2,
    initiativeOrder: [{ tokenId: 'target', label: 'Target', color: '', emoji: '', roll: 10 }] })
  const actor = snapshot.state.combatants.target
  actor.classState.activeEffects = [effect]
  actor.classState.wildShapeFormId = 'srd-5.1:goblin'
  actor.classState.wildShapeMode = 'polymorph'
  actor.classState.wildShapeOriginalStatBlockId = originalStatBlockId
  actor.classState.wildShapeOriginalCurrentHp = 15
  actor.classState.wildShapeOriginalMaxHp = 20
  actor.concentrating = true
  actor.classState.concentrationSpellId = 'maintained-spell'
  actor.classState.submergedBreathing = { schemaVersion: 1, breathSeconds: 0, survivalSeconds: 6,
    collapsed: false, lastStepKey: 'prior', combatClock: { combatId: 'breathing', round: 1 } }
  const result = resolveDnd5eHeadlessAction(snapshot.state, { type: 'begin-turn', actorId: 'target' })
  expect(result.ok).toBe(true)
  const restored = result.state.combatants.target
  expect(restored.classState.wildShapeFormId).toBeUndefined()
  expect(restored.statBlockId).toBe(originalStatBlockId)
  expect(restored.currentHp).toBe(15)
  expect(restored.concentrating).toBe(true)
  expect(restored.classState.concentrationSpellId).toBe('maintained-spell')
  expect(restored.conditions).not.toContain('unconscious')
  if (originalStatBlockId === 'srd-5.1:frog') expect(restored.classState.submergedBreathing).toBeUndefined()
  else {
    expect(restored.classState.submergedBreathing?.collapsed).toBe(true)
    restored.classState.submergedBreathing!.campaignClockSeconds = 28_866
    restored.classState.submergedBreathing!.pendingCollapseAtSeconds = 28_872
    result.state.round = 3
    restored.classState.turnStartResolvedTurnKey = undefined
    const next = resolveDnd5eHeadlessAction(result.state, { type: 'begin-turn', actorId: 'target' })
    expect(next.ok).toBe(true)
    expect(next.state.combatants.target.currentHp).toBe(0)
    expect(next.state.combatants.target.classState.submergedBreathing?.pendingCollapseAtSeconds).toBeUndefined()
    expect(next.state.combatants.target.concentrating).toBe(false)
    expect(next.state.combatants.target.conditions).toContain('unconscious')
  }
}, 30_000)

it('charges only new Host rounds and retains spent breath across combat transitions', () => {
  const first = atRound({ ...input, combatId: 'a', round: 5 })
  expect(first.state?.breathSeconds).toBe(180)
  const same = atRound({ ...input, state: first.state, combatId: 'a', round: 5, targetTurnStart: true })
  expect(same.state?.breathSeconds).toBe(180)
  const next = atRound({ ...input, state: same.state, combatId: 'a', round: 6 })
  expect(next.state?.breathSeconds).toBe(174)
  expect(atRound({ ...input, state: next.state, combatId: 'a', round: 6 }).state?.breathSeconds).toBe(174)
  expect(atRound({ ...input, state: next.state, combatId: 'b', round: 1 }).state?.breathSeconds).toBe(174)
  expect(() => atRound({ ...input, state: next.state, combatId: 'a', round: 5 })).toThrow('stale-submerged-breathing-clock')
})

it('spends three minutes of breath, then two rounds, and collapses only at turn start', () => {
  const initial = advance(input)
  expect(initial.state).toMatchObject({ breathSeconds: 180, survivalSeconds: 12, collapsed: false })
  const breathless = advance({ ...input, state: initial.state, elapsedSeconds: 180, stepKey: 'elapsed' })
  expect(breathless.state).toMatchObject({ breathSeconds: 0, survivalSeconds: 12 })
  const pending = advance({ ...input, state: breathless.state, elapsedSeconds: 12, stepKey: 'end' })
  expect(pending.dropToZero).toBe(false)
  const collapse = advance({ ...input, state: pending.state, stepKey: 'start', targetTurnStart: true })
  expect(collapse.dropToZero).toBe(true)
  expect(collapse.blocksHealingAndStabilization).toBe(true)
  expect(advance({ ...input, state: collapse.state, stepKey: 'start', targetTurnStart: true }).dropToZero).toBe(false)
  expect(advance({ ...input, state: collapse.state, effects: [] })).toEqual({ dropToZero: false, blocksHealingAndStabilization: false })
})

it('honors minimum breath and survival and preserves consumed breath across effect replacement and reload', () => {
  const first = advance({ ...input, constitutionScore: 8, elapsedSeconds: 30 })
  expect(first.state).toMatchObject({ breathSeconds: 0, survivalSeconds: 6 })
  const saved = normalizeDnd5eSubmergedBreathing(JSON.parse(JSON.stringify(first.state)))
  const next = advance({ ...input, state: saved, effects: [{ ...effect, id: 'replacement-water' }], constitutionScore: 8,
    elapsedSeconds: 6, stepKey: 'next', targetTurnStart: true })
  expect(next.dropToZero).toBe(true)
  expect(saved).toEqual(first.state)
})

it('uses effective water breathing, not merely a present but suppressed effect', () => {
  const breathing = { ...effect, id: 'water-breathing', modifiers: { environmentalCapabilities: { breatheIn: ['water'] as const } } }
  expect(advance({ ...input, effects: [effect, breathing] }).state).toBeUndefined()
  expect(advance({ ...input, intrinsic: { canBreatheWater: true } }).state).toBeUndefined()
  expect(advance({ ...input, intrinsic: { doesNotNeedAir: true } }).state).toBeUndefined()
  expect(advance({ ...input, effects: [effect, { ...breathing, suspendedBy: ['antimagic'] }] }).state).toBeDefined()
})

it('rejects malformed authority state instead of silently granting a fresh breath', () => {
  const state = advance(input).state!
  expect(normalizeDnd5eSubmergedBreathing({ ...state, breathSeconds: -1 })).toBeUndefined()
  expect(() => advance({ ...input, state: { ...state, breathSeconds: -1 } })).toThrow('invalid-submerged-breathing-state')
  expect(() => advance({ ...input, elapsedSeconds: -6 })).toThrow('invalid-submerged-breathing-step')
  for (const holdBreathSeconds of [NaN, -1, 0, Infinity, 1.5, 86_401]) {
    expect(() => advance({ ...input, intrinsic: { holdBreathSeconds } })).toThrow('invalid-intrinsic-breath-duration')
  }
})

it('preserves consumed breath through character and NPC map snapshot/application/reload', async () => {
  const { normalizeCharacter } = await import('../../store/characters')
  const { migrateMapsState } = await import('../../store/maps')
  const { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } = await import('./mapBridge')
  const breathing = advance({ ...input, elapsedSeconds: 174 }).state!
  const deadlines = [{ effectId: 'breathing-ward', appliedAt: 1000, expiresAtSeconds: 28_860 }]
  const character = normalizeCharacter({ id: 'breather', name: 'Breather', maxHp: 20, currentHp: 20,
    dnd5eCombatState: { schemaVersion: 2, submergedBreathing: breathing, submergedBreathingEffectDeadlines: deadlines } })
  const token = { id: 'player', characterId: character.id, type: 'player' as const, label: 'Player', color: '', emoji: '', x: 25, y: 25, size: 1 }
  const map: import('../../store/maps').BattleMap = { id: 'breathing-map', name: 'Water', width: 500, height: 500,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [token,
      { ...token, id: 'npc', characterId: undefined, type: 'npc', x: 75, hp: 20, maxHp: 20,
        dnd5eCombatState: { schemaVersion: 2, submergedBreathing: breathing, submergedBreathingEffectDeadlines: deadlines } }] }
  const snapshot = createDnd5eMapCombatSnapshot({ map, characters: [character], round: 1, combatId: 'breathing',
    initiativeOrder: map.tokens.map(token => ({ tokenId: token.id, label: token.label, color: '', emoji: '', roll: 10 })) })
  for (const actor of Object.values(snapshot.state.combatants)) {
    expect(actor.classState.submergedBreathing).toEqual(breathing)
    expect(actor.classState.submergedBreathingEffectDeadlines).toEqual(deadlines)
    actor.classState.submergedBreathing = advance({ ...input, state: breathing, elapsedSeconds: 6, stepKey: 'next' }).state
  }
  const applied = planDnd5eMapResultApplication({ map, characters: [character], state: snapshot.state,
    characterIdByCombatantId: snapshot.characterIdByCombatantId })
  const savedMap = migrateMapsState(JSON.parse(JSON.stringify({ maps: [applied.map] }))).maps[0]
  const savedCharacter = normalizeCharacter(JSON.parse(JSON.stringify(applied.characters[0])))
  expect(savedCharacter.dnd5eCombatState?.submergedBreathing).toMatchObject({ breathSeconds: 0, survivalSeconds: 12 })
  expect(savedCharacter.dnd5eCombatState?.submergedBreathingEffectDeadlines).toEqual(deadlines)
  expect(savedMap.tokens.find(token => token.id === 'npc')?.dnd5eCombatState?.submergedBreathingEffectDeadlines).toEqual(deadlines)
  expect(savedMap.tokens.find(token => token.id === 'npc')?.dnd5eCombatState?.submergedBreathing).toMatchObject({ breathSeconds: 0, survivalSeconds: 12 })
  expect(character.dnd5eCombatState?.submergedBreathing).toEqual(breathing)
}, 30_000)
