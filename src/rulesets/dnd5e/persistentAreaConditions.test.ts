import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { createDnd5eConditionEffect } from './activeEffects'
import { dnd5eStandardConditionId } from './conditions'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { normalizeDnd5ePersistentAreaOccupantModifiers } from './persistentAreaTypes'
import { createDnd5eCombatant, resolveDnd5ePersistentAreaTrigger, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { dnd5ePersistentAreaConditionEffects } from './persistentAreaConditionEffects'

function fixture(independentBlindness = false) {
  const hero = normalizeCharacter({ id: 'hero', name: 'Hero', maxHp: 20, currentHp: 20, dnd5eCombatState: independentBlindness ? { activeEffects: [createDnd5eConditionEffect({ id: 'independent', condition: 'blinded', targetId: 'hero', source: { kind: 'spell', rulesId: 'other-spell' }, duration: { type: 'permanent' } })] } : undefined })
  const area: Dnd5ePluginArea = { id: 'sand', pluginId: 'test', featureId: 'sand', label: 'Sand', color: '#aaaaaa', sourceTokenId: 'source', sourceCharacterId: 'source', cells: [{ col: 0, row: 0 }], createdRound: 1, expiresAfterRound: 100, includeSelf: true, relation: 'any', occupantModifiers: { conditions: ['blinded', 'deafened'] } }
  const map: BattleMap = { id: 'map', name: 'Map', width: 200, height: 100, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [{ id: 'player', characterId: hero.id, type: 'player', label: 'Hero', x: 25, y: 25, size: 1, emoji: '', color: '' }, { id: 'enemy', type: 'enemy', label: 'Enemy', x: 25, y: 25, size: 1, emoji: '', color: '', hp: 20, maxHp: 20 }], dnd5ePluginAreas: [area, { ...area, id: 'sand-two' }] }
  const snapshot = (nextMap = map, characters = [hero]) => createDnd5eMapCombatSnapshot({ combatId: 'area-conditions', map: nextMap, characters, initiativeOrder: nextMap.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20-i })) })
  return { hero, map, snapshot }
}
const standard = (values: readonly string[]) => values.map(dnd5eStandardConditionId)

it('validates closed conditions and preserves them through normalization', () => {
  expect(normalizeDnd5ePersistentAreaOccupantModifiers({ conditions: ['blinded', 'deafened', 'blinded'] })?.conditions).toEqual(['blinded', 'deafened'])
  expect(normalizeDnd5ePersistentAreaOccupantModifiers({ conditions: ['invented'] })).toBeUndefined()
  expect(normalizeDnd5ePersistentAreaOccupantModifiers({ conditions: 'blinded' })).toBeUndefined()
})

it.each([false, true])('projects overlapping areas without persisting or deleting independent conditions (independent=%s)', independent => {
  const {hero,map,snapshot} = fixture(independent)
  const initial = snapshot()
  for (const id of ['player','enemy']) expect(standard(initial.state.combatants[id].conditions)).toEqual(expect.arrayContaining(['blinded','deafened']))
  const plan = planDnd5eMapResultApplication({ state: initial.state, map, characters: [hero], characterIdByCombatantId: initial.characterIdByCombatantId })
  expect(standard(plan.characters[0].conditions).includes('blinded')).toBe(independent)
  expect(standard(plan.characters[0].conditions)).not.toContain('deafened')
  expect(standard(plan.map.tokens.find(t=>t.id==='enemy')!.dnd5eCombatState?.conditions??[])).not.toContain('blinded')
  const one = snapshot({ ...plan.map, dnd5ePluginAreas: plan.map.dnd5ePluginAreas!.slice(0,1) }, plan.characters)
  expect(standard(one.state.combatants.enemy.conditions)).toContain('blinded')
  const gone = snapshot({ ...plan.map, dnd5ePluginAreas: [] }, plan.characters)
  expect(standard(gone.state.combatants.enemy.conditions)).not.toContain('blinded')
  expect(standard(gone.state.combatants.player.conditions).includes('blinded')).toBe(independent)
  const outside = snapshot({ ...plan.map, tokens: plan.map.tokens.map(t=>({...t,x:125})) }, plan.characters)
  expect(standard(outside.state.combatants.enemy.conditions)).not.toContain('deafened')
  expect(standard(outside.state.combatants.player.conditions).includes('blinded')).toBe(independent)
})

it('respects area-projected immunity and antimagic without leaving a condition behind', () => {
  const {map,snapshot} = fixture()
  const immune = snapshot({ ...map, dnd5ePluginAreas: [...map.dnd5ePluginAreas!, { ...map.dnd5ePluginAreas![0], id: 'protection', occupantModifiers: { conditionImmunities: ['blinded'] } }] })
  expect(standard(immune.state.combatants.enemy.conditions)).not.toContain('blinded')
  expect(standard(immune.state.combatants.enemy.conditions)).toContain('deafened')
  const suppressed = snapshot({ ...map, dnd5ePluginAreas: [...map.dnd5ePluginAreas!, { ...map.dnd5ePluginAreas![0], id: 'antimagic', occupantModifiers: { suppressesMagic: true } }] })
  expect(standard(suppressed.state.combatants.enemy.conditions)).not.toContain('blinded')
})

it('evaluates area conditions after allied immunity auras', () => {
  const { hero, map } = fixture()
  const paladin = normalizeCharacter({ id: 'paladin', name: 'Paladin', charClass: '圣武士', level: 10, maxHp: 30, currentHp: 30 })
  const ally = map.tokens[0]
  const current = { ...map, tokens: [ally, { ...ally, id: 'paladin-token', characterId: paladin.id, x: 75 }], dnd5ePluginAreas: [{ ...map.dnd5ePluginAreas![0], occupantModifiers: { conditions: ['frightened'] as const } }] }
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'courage-area', map: current, characters: [hero, paladin], initiativeOrder: current.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20-i })) })
  expect(snapshot.state.combatants.player.conditionImmunities).toContain('frightened')
  expect(standard(snapshot.state.combatants.player.conditions)).not.toContain('frightened')
})

it.each([undefined, 'symbol'] as const)('keeps condition instances separate and refreshes only their own area: %s', coreSpellId => {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'dm',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const initial = startDnd5eHeadlessCombat('area-condition-origins', [make('source', 20), make('target', 10)])
  const trigger = { id: 'bind', label: 'Bind', timing: 'on-enter' as const,
    savingThrow: { ability: 'str' as const, dc: 15, onSuccess: 'none' as const },
    skipSaveWhenSourceConditionActive: 'restrained' as const,
    condition: { condition: 'restrained' as const, duration: { expiresAt: 'source-turn-end' as const } } }
  const apply = (state: typeof initial, areaId: string, d20?: number) => resolveDnd5ePersistentAreaTrigger(state,
    { areaId, sourceId: 'source', targetId: 'target', trigger, coreSpellId,
      areaSourceKind: coreSpellId ? 'core-spell' : undefined, d20 })
  const first = apply(initial, 'first', 1)
  expect(first.ok).toBe(true)
  const rejected = apply(first.state, 'second')
  expect(rejected).toMatchObject({ ok: false, reason: 'invalid-dice' })
  const second = apply(first.state, 'second', 1)
  expect(second.ok).toBe(true)
  const reloaded = JSON.parse(JSON.stringify(second.state)) as typeof initial
  const refreshed = apply(reloaded, 'first')
  expect(refreshed.ok).toBe(true)
  const effects = refreshed.state.combatants.target.classState.activeEffects!
  expect(effects).toHaveLength(2)
  expect(new Set(effects.map(effect => effect.id)).size).toBe(2)
  for (const areaId of ['first', 'second']) {
    expect(dnd5ePersistentAreaConditionEffects({ effects, areaId, sourceId: 'source', condition: 'restrained' }))
      .toHaveLength(1)
  }
  expect(refreshed.events.some(event => event.type === 'saving-throw-resolved')).toBe(false)
  expect(refreshed.events).toContainEqual(expect.objectContaining({ type: 'active-effect-refreshed' }))
  expect(initial.combatants.target.classState.activeEffects ?? []).toEqual([])
})

it('ignores suspended, unrelated-source and ambiguous effects; legacy lookup is opt-in', () => {
  const effect = createDnd5eConditionEffect({ id: 'bind', condition: 'restrained', targetId: 'target',
    source: { kind: 'spell', actorId: 'source', rulesId: 'web' }, duration: { type: 'permanent' },
    tags: ['persistent-area:first'] })
  const input = { areaId: 'first', sourceId: 'source', condition: 'restrained' as const }
  expect(dnd5ePersistentAreaConditionEffects({ ...input, effects: [effect] })).toHaveLength(1)
  expect(dnd5ePersistentAreaConditionEffects({ ...input, sourceId: 'other', effects: [effect] })).toEqual([])
  expect(dnd5ePersistentAreaConditionEffects({ ...input, effects: [{ ...effect, suspendedBy: ['antimagic'] }] })).toEqual([])
  expect(dnd5ePersistentAreaConditionEffects({ ...input, effects: [{ ...effect, tags: ['persistent-area:first', 'persistent-area:second'] }] })).toEqual([])
  const legacy = { ...effect, tags: undefined }
  expect(dnd5ePersistentAreaConditionEffects({ ...input, effects: [legacy] })).toEqual([])
  expect(dnd5ePersistentAreaConditionEffects({ ...input, effects: [legacy], legacyCoreSpellId: 'web' })).toHaveLength(1)
  expect(dnd5ePersistentAreaConditionEffects({ ...input, areaId: 'second', effects: [effect], legacyCoreSpellId: 'web' })).toEqual([])
})

it.each([false, undefined])('honors independent condition duration without changing legacy concentration (%s)', endsWithArea => {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'dm',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const source = make('source', 20)
  source.concentrating = true
  source.classState = { concentrationSpellId: 'web', concentrationRoundsRemaining: 100 }
  const state = startDnd5eHeadlessCombat('independent-condition', [source, make('target', 10)])
  const result = resolveDnd5ePersistentAreaTrigger(state, { areaId: 'ward', sourceId: source.id, targetId: 'target',
    areaSourceKind: 'core-spell', coreSpellId: 'web', d20: 1,
    trigger: { id: 'blind', label: 'Blindness', timing: 'on-create', savingThrow: { ability: 'con', dc: 15, onSuccess: 'none' },
      condition: { condition: 'blinded', endsWithArea, duration: { expiresAt: 'target-turn-end-save', remainingRounds: 10, saveAbility: 'con', saveDc: 15 } } } })
  expect(result.ok).toBe(true)
  const effect = result.state.combatants.target.classState.activeEffects!.find(effect => effect.standardCondition === 'blinded')!
  expect(effect.duration).toMatchObject(endsWithArea === false ? { type: 'rounds', remainingRounds: 10 } : { type: 'concentration', remainingRounds: 100 })
  expect(effect.repeatSave).toMatchObject({ ability: 'con', dc: 15, timing: 'target-turn-end' })
})
