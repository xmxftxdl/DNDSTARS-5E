import { describe, it, expect } from 'vitest'
import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'
import { interactWithRopeTrick, ropeTrickEffect, clearExpiredRopeTrickSpaces } from './ropeTrick'
import { validateDnd5eActiveEffectsStrict } from './activeEffects'
import { dnd5eTokenStatusMarkersFromActiveEffects } from './tokenStatusMarkers'
import { createDnd5eConditionEffect } from './activeEffects'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { dnd5eSrdAuditedSpellActivityV1 } from './activities/dnd5eSrdAuditedSpellActivities'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
const character = (patch: Partial<Character> = {}): Character => ({
  id: 'caster', name: 'caster', player: '', avatar: '', accent: '', race: '人类', charClass: '法师', level: 3,
  background: '', experience: 0, reputation: 0, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savingThrows: [], skills: [], maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '3d6', ac: 10, speed: 30,
  initiativeBonus: 0, saveDC: 12, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
  visibleToPlayers: true, ...patch,
})
const actor: Token = { id: 'actor', characterId: 'caster', label: 'caster', type: 'player', size: 1, x: 25, y: 25, color: '#fff', emoji: '' }
const map: BattleMap = { id: 'map', name: 'map', width: 1000, height: 1000, gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [actor], dnd5ePluginAreas: [{
  id: 'rope', coreSpellId: 'rope-trick', pluginId: 'srd-5.1', featureId: 'rope-trick', label: '魔绳术', color: '#abc', sourceCharacterId: 'caster', sourceTokenId: 'actor', cells: [{ col: 1, row: 0 }], createdRound: 1, expiresAfterRound: 601,
}] }
const enter = (characters: Character[], patch: Partial<Token> = {}) => interactWithRopeTrick({ map, characters, actor: { ...actor, ...patch }, areaId: 'rope', operation: 'enter', now: 10 })
describe('魔绳术入口', () => {
  it('rejects zero speed and movement-locking effects on either character or token', () => {
    expect(enter([character({ speed: 0 })])).toMatchObject({ ok: false })
    for (const condition of ['restrained', 'grappled', 'paralyzed', 'stunned'] as const) {
      const effect = createDnd5eConditionEffect({ id: `test:${condition}`, condition, targetId: actor.id,
        source: { kind: 'dm', actorId: 'monster' }, duration: { type: 'permanent' } })
      expect(enter([character({ dnd5eCombatState: { activeEffects: [effect] } })])).toMatchObject({ ok: false })
      expect(enter([character()], { dnd5eCombatState: { activeEffects: [effect] } })).toMatchObject({ ok: false })
    }
  })
  it('rejects monster attacks against occupants and allows them again after leaving', () => {
    const entered = enter([character()])
    expect(entered.ok).toBe(true)
    if (!entered.ok) return
    const left = interactWithRopeTrick({ map, characters: [entered.character], actor, areaId: 'rope', operation: 'leave', now: 20 })
    expect(left.ok).toBe(true)
    if (!left.ok) return
    for (const [targetCharacter, allowed] of [[entered.character, false], [left.character, true]] as const) {
      const monster = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character({ id: 'monster' })), controller: 'dm', initiativeD20: 20, position: { x: 25, y: 25 } })
      const target = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(targetCharacter), controller: 'player', initiativeD20: 1, position: { x: 25, y: 25 } })
      const state = startDnd5eHeadlessCombat('rope-attack', [monster, target])
      const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: monster.id, targetId: target.id,
        d20: 15, attackModifier: 20, damage: { count: 1, sides: 6, bonus: 0, rolls: [6], type: 'slashing' } })
      expect(result.ok).toBe(allowed)
      if (!allowed) expect(result).toMatchObject({ reason: 'invalid-target' })
    }
  })
  it('creates a targeted 5ft map area without applying a status during casting', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('rope-trick')!
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.target).toMatchObject({ kind: 'area', placeRangeFeet: 5, lengthFeet: 5 })
    const operations = activity.outcomes.flatMap(outcome => outcome.operations)
    expect(operations.some(op => op.kind === 'create-persistent-area')).toBe(true)
    expect(operations.some(op => op.kind === 'apply-effect' || op.kind === 'manual-adjudication')).toBe(false)
  })
  it('enters once, validates the persisted state and can leave', () => {
    const result = enter([character()])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(validateDnd5eActiveEffectsStrict(result.character.dnd5eCombatState?.activeEffects).ok).toBe(true)
    expect(ropeTrickEffect(result.character)?.label).toContain('异次元空间')
    expect(dnd5eTokenStatusMarkersFromActiveEffects(result.character.dnd5eCombatState?.activeEffects)).toMatchObject([
      { statusId: 'extradimensional', label: '异次元空间（魔绳术）', activeEffectId: ropeTrickEffect(result.character)?.id },
    ])
    expect(enter([result.character]).ok).toBe(false)
    const left = interactWithRopeTrick({ map, characters: [result.character], actor, areaId: 'rope', operation: 'leave', now: 20 })
    expect(left.ok && ropeTrickEffect(left.character)).toBeUndefined()
    expect(left.ok && left.character.conditions).toEqual([])
    expect(left.ok && dnd5eTokenStatusMarkersFromActiveEffects(left.character.dnd5eCombatState?.activeEffects)).toEqual([])
    expect(dnd5eTokenStatusMarkersFromActiveEffects(clearExpiredRopeTrickSpaces([result.character], [])[0]!.dnd5eCombatState?.activeEffects)).toEqual([])
    expect(clearExpiredRopeTrickSpaces([result.character], [])[0]!.conditions).toEqual([])
    expect(ropeTrickEffect(clearExpiredRopeTrickSpaces([result.character], [])[0]!)).toBeUndefined()
  })
  it('rejects distant and oversized creatures', () => {
    expect(enter([character()], { x: 400 }).ok).toBe(false)
    expect(enter([character()], { size: 2 }).ok).toBe(false)
  })
  it('shares capacity among players and rejects the ninth entry', () => {
    let characters = Array.from({ length: 9 }, (_, index) => character({ id: String(index) }))
    for (let index = 0; index < 9; index++) {
      const result = enter(characters, { characterId: String(index), id: String(index) })
      expect(result.ok).toBe(index < 8)
      if (result.ok) characters = characters.map(entry => entry.id === result.character.id ? result.character : entry)
    }
  })
})

