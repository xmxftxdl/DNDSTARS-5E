import { describe, expect, it } from 'vitest'
import type { Token } from '../store/maps'
import {
  buildDnd5eManualMonsterSpellPlan,
  dnd5eManualMonsterSpellOptions,
  dnd5eMonsterAdjudicationSpellOptions,
} from './monsterManualSpell'

function mageToken(): Token {
  return {
    id: 'mage',
    label: '法师',
    x: 5,
    y: 5,
    color: '#ef4444',
    emoji: '🧙',
    size: 1,
    type: 'enemy',
    poolId: 'srd-5.1:mage',
    hp: 40,
    maxHp: 40,
    dnd5eCombatState: {
      monsterSpellSlots: {
        1: { current: 2, max: 4 },
        2: { current: 1, max: 3 },
        3: { current: 1, max: 3 },
      },
    },
  }
}

describe('manual monster spells', () => {
  it('projects the monster spell list with current slot resources', () => {
    const fireball = dnd5eManualMonsterSpellOptions(mageToken())
      .find((spell) => spell.spellId === 'fireball')

    expect(fireball).toMatchObject({
      spellName: '火球术',
      level: 3,
      castingTime: 'action',
      automation: 'full',
      availableSlotLevels: [3],
    })
    expect(fireball?.resourceLabels['3']).toBe('3 环 1/3')
  })

  it('builds a manual Magic Missile declaration with all projectiles on the selected target', () => {
    const plan = buildDnd5eManualMonsterSpellPlan({
      actor: mageToken(),
      spellId: 'magic-missile',
      slotLevel: 1,
      targetTokenIds: ['hero-token'],
      targetCharacterId: 'hero',
    })

    expect(plan).toMatchObject({
      attackerTokenId: 'mage',
      targetTokenId: 'hero-token',
      targetCharacterId: 'hero',
      spellCast: {
        spellId: 'magic-missile',
        slotLevel: 1,
        targetTokenIds: ['hero-token'],
        projectileTargetIds: ['hero-token', 'hero-token', 'hero-token'],
      },
    })
  })

  it('does not build a cast after the required spell resource is exhausted', () => {
    const exhausted = mageToken()
    exhausted.dnd5eCombatState!.monsterSpellSlots!['3'] = { current: 0, max: 3 }
    expect(buildDnd5eManualMonsterSpellPlan({
      actor: exhausted,
      spellId: 'fireball',
      slotLevel: 3,
      targetTokenIds: ['hero-token'],
      areaTargetCell: { col: 5, row: 0 },
    })).toBeUndefined()
  })

  it('offers prepared Sphinx spells and their live slots to legendary DM adjudication', () => {
    const sphinx: Token = {
      ...mageToken(),
      id: 'sphinx',
      label: '雌性斯芬克斯',
      poolId: 'srd-5.1:gynosphinx',
      dnd5eCombatState: {
        monsterLegendaryActionPoints: 3,
        monsterSpellSlots: {
          1: { current: 3, max: 4 },
          2: { current: 2, max: 3 },
          3: { current: 3, max: 3 },
          4: { current: 3, max: 3 },
          5: { current: 1, max: 1 },
        },
      },
    }
    const options = dnd5eMonsterAdjudicationSpellOptions(sphinx)
    expect(options.find((spell) => spell.spellId === 'shield')).toMatchObject({
      level: 1,
      availableSlotLevels: [1, 2, 3, 4, 5],
      resourceLabels: { '1': '1 环 3/4' },
    })
    expect(options.find((spell) => spell.spellId === 'legend-lore')).toMatchObject({
      level: 5,
      availableSlotLevels: [5],
    })
    expect(dnd5eManualMonsterSpellOptions(sphinx)
      .find((spell) => spell.spellId === 'legend-lore')).toMatchObject({
        level: 5,
        castingTime: 'action',
        automation: 'manual',
        availableSlotLevels: [5],
      })
  })
})
