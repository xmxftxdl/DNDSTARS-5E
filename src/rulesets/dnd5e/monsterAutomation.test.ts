import { describe, expect, it } from 'vitest'
import type { Dnd5eMonsterMechanicTrigger } from './monsters'
import {
  dnd5eEligibleMonsterMechanics,
  dnd5eMonsterMechanicCompatibility,
  dnd5eMonsterMechanicEffects,
  normalizeDnd5eMonsterBehaviorPreference,
} from './monsterAutomation'

const base = {
  id: 'test-mechanic',
  name: '测试机制',
  predicates: { hpPercentageAtOrBelow: 50, requiresPositiveHp: true },
  limit: 'once-per-turn' as const,
}

describe('D&D 5e declarative monster mechanism compatibility', () => {
  it('accepts only versioned deterministic behavior styles', () => {
    expect(normalizeDnd5eMonsterBehaviorPreference({
      schemaVersion: 1,
      style: 'skirmisher',
    })).toEqual({ schemaVersion: 1, style: 'skirmisher' })
    expect(normalizeDnd5eMonsterBehaviorPreference({
      schemaVersion: 1,
      style: 'execute-arbitrary-script',
    })).toBeUndefined()
  })

  it('keeps V1 low-hit-point healing loadable as a full V2-compatible effect', () => {
    const mechanic: Dnd5eMonsterMechanicTrigger = {
      ...base,
      schemaVersion: 1,
      event: 'turn-start',
      effect: { kind: 'healing', dice: { count: 2, sides: 6, bonus: 1 } },
      automation: 'headless',
    }
    expect(dnd5eMonsterMechanicCompatibility(mechanic)).toEqual({
      requested: 'full', effective: 'full', reasons: [],
    })
    expect(dnd5eMonsterMechanicEffects(mechanic)).toEqual([{
      id: 'effect-0', kind: 'healing', target: 'self', dice: { count: 2, sides: 6, bonus: 1 },
    }])
  })

  it('downgrades map- and reaction-dependent declarations instead of silently executing them', () => {
    const mechanic: Dnd5eMonsterMechanicTrigger = {
      ...base,
      schemaVersion: 2,
      trigger: { event: 'after-damaged' },
      effects: [
        { id: 'summon-wolf', kind: 'summon', monsterId: 'srd-5.1:wolf', count: 1, durationRounds: 10 },
        { id: 'blast', kind: 'area-attack', shape: 'cone', rangeFeet: 30, sizeFeet: 15, dice: { count: 2, sides: 6, bonus: 0 }, damageType: 'fire' },
      ],
      automation: 'full',
    }
    const report = dnd5eMonsterMechanicCompatibility(mechanic)
    expect(report.effective).toBe('partial')
    expect(report.reasons).toHaveLength(2)
    expect(dnd5eEligibleMonsterMechanics({
      id: 'room-monster:test', slug: 'test', name: '测试', englishName: 'Test', source: 'DM 自定义',
      size: '中型', creatureType: '怪兽', alignment: '无阵营', armorClass: { value: 10 },
      hitPoints: { average: 10, dice: '2d8' }, speed: { walk: 30 },
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, senses: [],
      passivePerception: 10, languages: [], challenge: { rating: '0', xp: 0 }, traits: [], actions: [],
      headlessMechanics: [mechanic], description: '测试。',
    }, 'after-damaged', {
      combatId: 'combat', round: 1, actorId: 'monster', currentHp: 4, maxHp: 10,
    })).toEqual([])
  })

  it('promotes generic movement and triggered-attack chains to authoritative snapshots', () => {
    const mechanic: Dnd5eMonsterMechanicTrigger = {
      ...base,
      schemaVersion: 2,
      trigger: {
        event: 'movement',
        subject: 'hostile-within',
        radiusFeet: 30,
        movement: { comparison: 'at-least', feet: 20 },
      },
      effects: [{
        id: 'horn-attack',
        kind: 'attack',
        target: 'selected-subject',
        toHit: 13,
        damage: { average: 29, count: 5, sides: 6, bonus: 12, type: 'piercing' },
      }],
      automation: 'full',
    }

    const report = dnd5eMonsterMechanicCompatibility(mechanic)
    expect(report).toEqual({ requested: 'full', effective: 'full', reasons: [] })
  })
})
