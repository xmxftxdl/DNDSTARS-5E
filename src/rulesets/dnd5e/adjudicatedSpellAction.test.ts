import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  prepareDnd5eAdjudicatedSpell,
  resolvePreparedDnd5eAdjudicatedSpell,
} from './adjudicatedSpellAction'
import { dnd5eSpellbookEntries, type Dnd5eImportedSpell } from './spellbook'
import { DND5E_LEATHER_ARMOR } from './equipment'
import { createDnd5eEffectiveRulesContextV1 } from './effectiveRulesContext'

function wizard(spellId: string): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'wizard', name: '法师', player: '', avatar: '', accent: '',
    race: '人类', charClass: '法师', level: 5, background: '', experience: 0, reputation: 0,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '5d6', ac: 14, speed: 30, initiativeBonus: 2,
    saveDC: 15, passivePerception: 11, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } },
    classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
  }
}

function token(id: string, type: 'player' | 'enemy', x: number, characterId?: string): Token {
  return { id, label: id, x, y: 25, color: '', emoji: '', size: 1, type, characterId, hp: 30, maxHp: 30 }
}

function roomSpell(): Dnd5eImportedSpell {
  return {
    id: 'test.rules:amber-bolt', name: '琥珀箭', englishName: 'Amber Bolt', level: 1,
    school: 'evocation', ritual: false,
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'distance', feet: 60 },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'instantaneous', concentration: false },
    classes: ['wizard'], description: '具体命中与效果由 DM 裁定。',
    source: { title: '测试规则包', publisher: 'DNDSTARS', license: '测试' },
    automation: { mode: 'reference-only' },
  }
}

function fixture() {
  const spell = roomSpell()
  const actor = wizard(spell.id)
  const actorToken = token('wizard-token', 'player', 25, actor.id)
  const enemy = token('enemy-token', 'enemy', 125)
  const map: BattleMap = {
    id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [actorToken, enemy],
  }
  const action: SharedPlayerActionState = {
    id: 'adjudicated-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending',
    type: 'dnd5e-adjudicated-spell', actorTokenId: actorToken.id, characterId: actor.id,
    dnd5eAdjudicatedSpell: { spellId: spell.id, slotLevel: 1 },
    round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
  }
  return {
    action, spell: dnd5eSpellbookEntries([spell]).find((entry) => entry.id === spell.id)!,
    map, actor, actorToken, enemy,
    characters: [actor],
    initiativeOrder: [actorToken, enemy].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    })),
  }
}

describe('DM-adjudicated spell Headless transaction', () => {
  it('reports when the character has not learned or prepared the spell', () => {
    const input = fixture()
    input.actor.dnd5eClassChoices = { classes: { wizard: { selections: { 'spell-prepared': [] } } } }
    expect(prepareDnd5eAdjudicatedSpell(input)).toEqual({
      ok: false,
      reason: 'spell-not-known-or-prepared',
    })
  })

  it('rejects DM-adjudicated casting while the caster wears unproficient armor', () => {
    const input = fixture()
    input.actor.equipment = { armor: DND5E_LEATHER_ARMOR }
    expect(prepareDnd5eAdjudicatedSpell(input)).toEqual({
      ok: false,
      reason: 'armor-proficiency-required',
    })
  })

  it('rejects a verbal DM-adjudicated spell while the caster is silenced', () => {
    const input = fixture()
    input.actor.conditions = ['沉默']
    expect(prepareDnd5eAdjudicatedSpell(input)).toEqual({
      ok: false,
      reason: 'component-unavailable',
    })
  })

  it('allows DM-adjudicated casting when the room disables casting prerequisites', () => {
    const input = fixture()
    input.actor.equipment = { armor: DND5E_LEATHER_ARMOR }
    input.actor.conditions = ['沉默']
    expect(prepareDnd5eAdjudicatedSpell({
      ...input,
      effectiveRules: createDnd5eEffectiveRulesContextV1({
        houseRules: { spellcastingPrerequisitesEnabled: false },
      }),
    })).toMatchObject({ ok: true })
  })

  it('does not spend resources during preparation and commits all approved effects atomically', () => {
    const input = fixture()
    const prepared = prepareDnd5eAdjudicatedSpell({
      ...input,
      turnEconomy: {
        turnKey: 'combat:1:wizard-token', attacksUsed: 0,
        action: { current: 1, max: 1 }, bonusAction: { current: 1, max: 1 },
        reaction: { current: 1, max: 1 }, movement: { current: 30, max: 30 },
      },
    })
    expect(prepared.ok).toBe(true)
    expect(input.actor.classResources?.['dnd5e-spell-slot-1']).toEqual({ current: 1, max: 4 })
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: {
        decision: 'approved',
        effects: [
          { targetTokenId: input.enemy.id, operation: 'damage', amount: 7, addCondition: '倒地' },
          { targetTokenId: input.enemy.id, operation: 'temporary-hit-points', amount: 5 },
        ],
        note: '敏捷豁免失败。',
      },
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[input.actorToken.id].turn.actionAvailable).toBe(false)
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-1']).toEqual({ current: 0, max: 4 })
    expect(resolved.result.state.combatants[input.enemy.id]).toMatchObject({ currentHp: 23, temporaryHp: 5, conditions: ['倒地'] })
    expect(resolved.application?.map.tokens.find((entry) => entry.id === input.enemy.id)?.dnd5eCombatState?.temporaryHp).toBe(5)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'adjudicated-spell-resolved', spellId: input.spell.id, effectCount: 2,
    }))
  })

  it('rejects player-selected effect targets that are not map combatants without spending the slot', () => {
    const input = fixture()
    const prepared = prepareDnd5eAdjudicatedSpell(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eAdjudicatedSpell({
      prepared: prepared.prepared,
      response: { decision: 'approved', effects: [{ targetTokenId: 'forged-target', operation: 'damage', amount: 999 }] },
    })
    expect(resolved.result.ok).toBe(false)
    expect(resolved.result.state.combatants[input.actorToken.id].classResources['dnd5e-spell-slot-1']).toEqual({ current: 1, max: 4 })
  })
})
