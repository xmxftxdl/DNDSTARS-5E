import { describe, expect, it } from 'vitest'
import { normalizeCharacter, serializeDnd5eCharacterSnapshot } from './characters'

describe('D&D 5e character save migration', () => {
  it('repairs an explicitly missing ruleset id and retires persisted AP balances', () => {
    const migrated = normalizeCharacter({
      rulesetId: undefined,
      name: '旧存档战士',
      charClass: '战士',
      level: 7,
      actionPoints: 2,
      currentAP: 1,
      traits: [{ id: 'legacy-trait', name: '旧职业特性', level: 1, uses: 1, maxUses: 1, description: '' }],
      combatSkills: [{
        id: 'legacy-skill', name: '旧 AP 技能', emoji: '', description: '', apCost: 1,
        cooldown: 0, cdReduction: 0, remaining: 0, usedThisTurn: false,
        damageCount: 0, damageSides: 0, damageBonus: 0,
      }],
      combatBuffs: { galeComboReady: true },
    })

    expect(migrated.rulesetId).toBe('dnd5e-2014-srd-5.1')
    expect(migrated).not.toHaveProperty('actionPoints')
    expect(migrated).not.toHaveProperty('currentAP')
    expect(migrated).not.toHaveProperty('traits')
    expect(migrated).not.toHaveProperty('combatSkills')
    expect(migrated).not.toHaveProperty('combatBuffs')
  })

  it('does not publish retired AP balances or AP skills in a new shared snapshot', () => {
    const migrated = normalizeCharacter({
      id: 'legacy-fighter',
      name: '旧战士',
      actionPoints: 2,
      currentAP: 1,
      combatSkills: [{
        id: 'legacy-strike', name: '旧强力打击', emoji: '⚔️', description: '', apCost: 1,
        cooldown: 0, cdReduction: 0, remaining: 0, usedThisTurn: false,
        damageCount: 1, damageSides: 8, damageBonus: 0,
      }],
    })

    const snapshot = serializeDnd5eCharacterSnapshot(migrated)
    expect(JSON.stringify(snapshot)).not.toMatch(/actionPoints|currentAP|combatSkills|apCost/)
  })

  it('persists valid combat XP receipts and drops malformed receipts', () => {
    const migrated = normalizeCharacter({
      id: 'fighter',
      name: '战士',
      experience: 150,
      dnd5eExperienceAwards: [
        { combatId: 'combat-1', mapId: 'map-1', xp: 50, awardedAt: 10 },
        { combatId: '', mapId: 'map-1', xp: 100, awardedAt: 11 },
        { combatId: 'combat-2', mapId: 'map-1', xp: -1, awardedAt: 12 },
      ],
    })
    expect(migrated.dnd5eExperienceAwards).toEqual([
      { combatId: 'combat-1', mapId: 'map-1', xp: 50, awardedAt: 10 },
    ])
    expect(serializeDnd5eCharacterSnapshot(migrated).dnd5eExperienceAwards).toEqual(migrated.dnd5eExperienceAwards)
  })
})
