import { describe, expect, it } from 'vitest'
import type { Character, CombatSkill } from '../types/character'
import type { EquipmentItem } from '../types/equipment'
import {
  ARCHER_CLASS_DEFINITION,
  classDefinitionForCharacter,
  equipmentCatalogForCharacter,
  registerClassDefinition,
  type ClassDefinition,
} from './classDefinitionRegistry'
import { getClassSkillRank, syncCharacterClassProgression } from './classProgressionRegistry'
import {
  characterToCombatInput,
  computeMaxHp,
  computePhysicalAttack,
  ensureDefaultEquipment,
} from './combatStats'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: 'Hero',
    charClass: '测试守卫',
    level: 2,
    abilities: { str: 12, dex: 8, con: 14, int: 6, wis: 7, cha: 5 },
    traits: [],
    combatSkills: [],
    conditions: [],
    actionPoints: 2,
    currentAP: 2,
    currentHp: 10,
    maxHp: 10,
    ...patch,
  } as Character
}

const testWeapon: EquipmentItem = {
  id: 'test-hammer',
  name: '测试锤',
  slot: 'mainWeapon',
  physicalAttack: 5,
}

function testDefinition(): ClassDefinition {
  return {
    id: 'test-guardian',
    classNames: ['测试守卫'],
    matchesClassName: (name) => name === '测试守卫',
    progression: {
      id: 'test-guardian',
      hasSkillTree: true,
      matches: (candidate) => candidate.charClass === '测试守卫',
      ownsSkill: (id) => id === 'shield-hit',
      syncSkills: (candidate) => candidate.charClass === '测试守卫'
        ? {
            ...candidate,
            combatSkills: [{ id: 'shield-hit', name: '盾击', skillTreeId: 'shield-hit' } as CombatSkill],
          }
        : candidate,
      canLearnSkill: () => true,
      canUpgradeSkillRank: () => true,
      getSkillRank: () => 2,
    },
    combatStats: {
      physicalAttack: { ability: 'str', multiplier: 3 },
      defense: { ability: 'con', multiplier: 2 },
      magicAttack: { ability: 'int', multiplier: 1 },
      magicDefense: { ability: 'wis', multiplier: 1 },
      maxHp: { base: 20, ability: 'con', useModifier: false, multiplierPerLevel: 1 },
      critDamage: { basePercent: 100, ability: 'str', percentPerPoint: 1 },
    },
    defaultEquipment: { mainWeapon: testWeapon },
    knownEquipment: [testWeapon],
    skillTree: {
      buildView: () => ({
        sections: [{ id: 'guardian', label: '守卫' }],
        nodes: [],
        availablePoints: 1,
        earnedPoints: 1,
        pointRuleLabel: '每 5 级 +1',
      }),
    },
  }
}

describe('class definition registry', () => {
  it('exposes the built-in archer skill-tree view through the generic contract', () => {
    const archer = character({ charClass: '弓手', level: 5 })
    const view = ARCHER_CLASS_DEFINITION.skillTree?.buildView(archer)
    expect(view?.sections.length).toBeGreaterThan(0)
    expect(view?.nodes.some((node) => node.id === 'multiShot')).toBe(true)
  })

  it('activates progression, stats, equipment, and skill tree from one definition', () => {
    const definition = testDefinition()
    const dispose = registerClassDefinition(definition)
    try {
      const hero = character()
      expect(classDefinitionForCharacter(hero)?.id).toBe('test-guardian')
      expect(syncCharacterClassProgression(hero).combatSkills[0]?.skillTreeId).toBe('shield-hit')
      expect(getClassSkillRank(hero, 'shield-hit')).toBe(2)
      expect(computePhysicalAttack(characterToCombatInput(hero))).toBe(36)
      expect(computeMaxHp(characterToCombatInput(hero))).toBe(48)
      expect(ensureDefaultEquipment(hero).equipment?.mainWeapon?.id).toBe('test-hammer')
      expect(equipmentCatalogForCharacter(hero)).toEqual([testWeapon])
      expect(definition.skillTree?.buildView(hero).sections[0]?.label).toBe('守卫')
    } finally {
      dispose()
    }
  })
})
