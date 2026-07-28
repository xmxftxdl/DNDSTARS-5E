import { describe, expect, it } from 'vitest'
import {
  dnd5eCanUseUncannyDodge,
  dnd5eCanThreatenRangedAttacker,
  dnd5eClassPassiveDefenses,
  dnd5eConditionImmuneFromSource,
  dnd5eDamageAfterSavingThrow,
  dnd5ePreventsAttackAdvantage,
  dnd5eReactionsPrevented,
  dnd5eSavingThrowMode,
  dnd5eSavingThrowModeExplanation,
  dnd5eTargetGrantsAttackAdvantage,
  dnd5eUnseenTargetImposesDisadvantage,
  type Dnd5eDefensiveCreature,
} from './passiveDefenses'
import { createDnd5eMechanicalEffect } from './activeEffects'

function creature(patch: Partial<Dnd5eDefensiveCreature> = {}): Dnd5eDefensiveCreature {
  return {
    level: 1, exhaustionLevel: 0, classSelections: {}, classState: {}, conditions: [], ...patch,
  }
}

describe('SRD 5.1 passive class defenses', () => {
  it('applies magic resistance only against spells and explicitly magical effects', () => {
    const resistant = creature({ magicResistance: true })
    expect(dnd5eSavingThrowMode(resistant, 'wis', { sourceIsSpell: true })).toBe('advantage')
    expect(dnd5eSavingThrowMode(resistant, 'con', { sourceIsMagical: true })).toBe('advantage')
    expect(dnd5eSavingThrowMode(resistant, 'str')).toBe('normal')
    expect(dnd5eSavingThrowMode({ ...resistant, exhaustionLevel: 3 }, 'wis', { sourceIsSpell: true }))
      .toBe('normal')
  })

  it('applies imported racial saving-throw advantages only to declared contexts', () => {
    const ancestry = creature({
      racialSavingThrowAdvantages: {
        conditions: ['charmed'],
        damageTypes: ['poison'],
        magicAbilities: ['int', 'wis', 'cha'],
      },
    })
    expect(dnd5eSavingThrowMode(ancestry, 'con', { damageType: 'poison' })).toBe('advantage')
    expect(dnd5eSavingThrowMode(ancestry, 'wis', { condition: 'charmed' })).toBe('advantage')
    expect(dnd5eSavingThrowMode(ancestry, 'int', { sourceIsMagical: true })).toBe('advantage')
    expect(dnd5eSavingThrowMode(ancestry, 'str', { sourceIsMagical: true })).toBe('normal')
    expect(dnd5eSavingThrowMode(ancestry, 'wis', { condition: 'frightened' })).toBe('normal')
  })

  it('exposes the rule sources behind a saving throw roll mode', () => {
    const explanation = dnd5eSavingThrowModeExplanation(
      creature({ magicResistance: true, exhaustionLevel: 3 }),
      'con',
      { sourceIsSpell: true },
    )
    expect(explanation.mode).toBe('normal')
    expect(explanation.advantage).toContainEqual(expect.objectContaining({
      id: 'magic-resistance', label: '魔法抗性',
    }))
    expect(explanation.disadvantage).toContainEqual(expect.objectContaining({
      id: 'exhaustion-level-3', label: '力竭（3级或更高）',
    }))
  })

  it('applies Danger Sense and cancels it against level-three exhaustion', () => {
    const barbarian = creature({ classId: 'barbarian', level: 2 })
    expect(dnd5eSavingThrowMode(barbarian, 'dex')).toBe('advantage')
    expect(dnd5eSavingThrowMode({ ...barbarian, exhaustionLevel: 3 }, 'dex')).toBe('normal')
    expect(dnd5eSavingThrowMode({ ...barbarian, conditions: ['目盲'] }, 'dex')).toBe('normal')
    expect(dnd5eSavingThrowMode(barbarian, 'con')).toBe('normal')
  })

  it('uses the relevant secondary class level for passive defenses', () => {
    const fighterBarbarian = creature({
      classId: 'fighter',
      level: 10,
      classLevels: { fighter: 8, barbarian: 2 },
    })
    expect(dnd5eSavingThrowMode(fighterBarbarian, 'dex')).toBe('advantage')
    const wizardRogue = creature({
      classId: 'wizard',
      level: 8,
      classLevels: { wizard: 1, rogue: 7 },
    })
    expect(dnd5eDamageAfterSavingThrow({
      creature: wizardRogue,
      ability: 'dex',
      damage: 15,
      success: true,
      successfulSave: 'half',
    })).toBe(0)
  })

  it('grants a raging Barbarian advantage on Strength saving throws', () => {
    const barbarian = creature({ classId: 'barbarian', level: 1, classState: { raging: true } })
    expect(dnd5eSavingThrowMode(barbarian, 'str')).toBe('advantage')
    expect(dnd5eSavingThrowMode(barbarian, 'dex')).toBe('normal')
    expect(dnd5eSavingThrowMode({ ...barbarian, exhaustionLevel: 3 }, 'str')).toBe('normal')
  })

  it('grants a dodging creature advantage on Dexterity saving throws', () => {
    const dodging = creature({ classState: { dodgingTurnKey: 'combat:2:hero' } })
    expect(dnd5eSavingThrowMode(dodging, 'dex')).toBe('advantage')
    expect(dnd5eSavingThrowMode(dodging, 'con')).toBe('normal')
    expect(dnd5eSavingThrowMode({ ...dodging, exhaustionLevel: 3 }, 'dex')).toBe('normal')
  })

  it('applies unproficient-armor disadvantage to Strength and Dexterity saving throws', () => {
    const armored = creature({ wearingUnproficientArmor: true })
    expect(dnd5eSavingThrowMode(armored, 'str')).toBe('disadvantage')
    expect(dnd5eSavingThrowMode(armored, 'dex')).toBe('disadvantage')
    expect(dnd5eSavingThrowMode(armored, 'con')).toBe('normal')
  })

  it('applies Hunter Steel Will only against being frightened', () => {
    const hunter = creature({
      classId: 'ranger', subclassId: 'hunter', level: 7,
      classSelections: { 'defensive-tactics': ['steel-will'] },
    })
    expect(dnd5eSavingThrowMode(hunter, 'wis', { condition: 'frightened' })).toBe('advantage')
    expect(dnd5eSavingThrowMode(hunter, 'wis', { condition: 'charmed' })).toBe('normal')
    expect(dnd5eSavingThrowMode({ ...hunter, exhaustionLevel: 3 }, 'wis', { condition: '恐慌' })).toBe('normal')
  })

  it('applies Countercharm only to charm and fear saves and lets exhaustion cancel the advantage', () => {
    const protectedCreature = creature({ countercharmSourceIds: ['bard-token'] })
    expect(dnd5eSavingThrowMode(protectedCreature, 'wis', { condition: 'frightened' })).toBe('advantage')
    expect(dnd5eSavingThrowMode(protectedCreature, 'cha', { condition: '魅惑' })).toBe('advantage')
    expect(dnd5eSavingThrowMode(protectedCreature, 'wis', { condition: 'prone' })).toBe('normal')
    expect(dnd5eSavingThrowMode({ ...protectedCreature, exhaustionLevel: 3 }, 'wis', { condition: 'charmed' })).toBe('normal')
  })

  it('lets an 18th-level Ranger ignore disadvantage from an unseen target', () => {
    const invisibleTarget = creature({ classState: { emptyBodyRoundsRemaining: 10 } })
    expect(dnd5eUnseenTargetImposesDisadvantage(creature({ classId: 'ranger', level: 17 }), invisibleTarget)).toBe(true)
    expect(dnd5eUnseenTargetImposesDisadvantage(creature({ classId: 'ranger', level: 18 }), invisibleTarget)).toBe(false)
    expect(dnd5eUnseenTargetImposesDisadvantage(creature({ classId: 'fighter', level: 20 }), invisibleTarget)).toBe(true)
  })

  it('applies the blinded condition to both sides of attack visibility', () => {
    const blinded = creature({ conditions: ['blinded'] })
    expect(dnd5eTargetGrantsAttackAdvantage(blinded)).toBe(true)
    expect(dnd5eUnseenTargetImposesDisadvantage(blinded, creature())).toBe(true)
    expect(dnd5eTargetGrantsAttackAdvantage(creature({
      classId: 'rogue', level: 18, conditions: ['blinded'],
    }))).toBe(false)
  })

  it('only lets a nearby hostile threaten ranged attacks when it can see and act', () => {
    const attacker = creature()
    expect(dnd5eCanThreatenRangedAttacker(attacker, creature())).toBe(true)
    expect(dnd5eCanThreatenRangedAttacker(attacker, creature({ conditions: ['incapacitated'] }))).toBe(false)
    expect(dnd5eCanThreatenRangedAttacker(attacker, creature({ conditions: ['blinded'] }))).toBe(false)
    expect(dnd5eCanThreatenRangedAttacker(creature({ conditions: ['invisible'] }), creature())).toBe(false)
    expect(dnd5eCanThreatenRangedAttacker(creature({ classState: { hiddenCheckTotal: 18 } }), creature())).toBe(false)
  })

  it('applies Evasion to Rogue, Monk, and the selected Hunter defense', () => {
    const rogue = creature({ classId: 'rogue', level: 7 })
    expect(dnd5eDamageAfterSavingThrow({ creature: rogue, ability: 'dex', damage: 15, success: true, successfulSave: 'half' })).toBe(0)
    expect(dnd5eDamageAfterSavingThrow({ creature: rogue, ability: 'dex', damage: 15, success: false, successfulSave: 'half' })).toBe(7)
    const hunter = creature({ classId: 'ranger', subclassId: 'hunter', level: 15, classSelections: { 'superior-hunters-defense': ['evasion'] } })
    expect(dnd5eDamageAfterSavingThrow({ creature: hunter, ability: 'dex', damage: 12, success: true, successfulSave: 'half' })).toBe(0)
    expect(dnd5eDamageAfterSavingThrow({ creature: hunter, ability: 'con', damage: 12, success: true, successfulSave: 'half' })).toBe(6)
  })

  it('implements Elusive and passive poison/disease defenses', () => {
    expect(dnd5ePreventsAttackAdvantage(creature({ classId: 'rogue', level: 18 }))).toBe(true)
    expect(dnd5ePreventsAttackAdvantage(creature({ classId: 'rogue', level: 18, classState: { stunnedByActorId: 'enemy' } }))).toBe(false)
    expect(dnd5eClassPassiveDefenses(creature({ classId: 'paladin', level: 3 })).conditionImmunities).toContain('疾病')
    expect(dnd5eClassPassiveDefenses(creature({ classId: 'monk', level: 10 }))).toMatchObject({
      damageImmunities: ['poison'], conditionImmunities: expect.arrayContaining(['中毒', '疾病']),
    })
    expect(dnd5eClassPassiveDefenses(creature({ classId: 'druid', subclassId: 'land', level: 10 }))).toMatchObject({
      damageImmunities: ['poison'], conditionImmunities: expect.arrayContaining(['中毒', '疾病']),
    })
  })

  it('limits the Land druid charm/fear immunity to elemental and fey sources', () => {
    const druid = creature({ classId: 'druid', subclassId: 'land', level: 10 })
    expect(dnd5eConditionImmuneFromSource(druid, 'charmed', creature({ creatureType: '精类' }))).toBe(true)
    expect(dnd5eConditionImmuneFromSource(druid, 'frightened', creature({ creatureType: '元素生物' }))).toBe(true)
    expect(dnd5eConditionImmuneFromSource(druid, 'frightened', creature({ creatureType: '龙类' }))).toBe(false)
    expect(dnd5eConditionImmuneFromSource({ ...druid, level: 9 }, 'charmed', creature({ creatureType: '精类' }))).toBe(false)
  })

  it('applies Devotion Purity of Spirit only against protected creature types', () => {
    const paladin = creature({ classId: 'paladin', subclassId: 'devotion', level: 15 })
    const fiend = creature({ creatureType: '邪魔' })
    const humanoid = creature({ creatureType: '类人生物' })
    expect(dnd5eUnseenTargetImposesDisadvantage(fiend, paladin)).toBe(true)
    expect(dnd5eUnseenTargetImposesDisadvantage(humanoid, paladin)).toBe(false)
    expect(dnd5eConditionImmuneFromSource(paladin, 'charmed', fiend)).toBe(true)
    expect(dnd5eConditionImmuneFromSource(paladin, '附身', creature({ creatureType: '亡灵' }))).toBe(true)
    expect(dnd5eConditionImmuneFromSource(paladin, 'frightened', humanoid)).toBe(false)
  })

  it('grants Holy Nimbus advantage on saves against fiend and undead spells', () => {
    const paladin = creature({
      classId: 'paladin', subclassId: 'devotion', level: 20,
      classState: { holyNimbusRoundsRemaining: 10 },
    })
    expect(dnd5eSavingThrowMode(paladin, 'wis', { sourceCreatureType: '邪魔', sourceIsSpell: true })).toBe('advantage')
    expect(dnd5eSavingThrowMode(paladin, 'wis', { sourceCreatureType: '亡灵', sourceIsSpell: false })).toBe('normal')
    expect(dnd5eSavingThrowMode(paladin, 'wis', { sourceCreatureType: '龙类', sourceIsSpell: true })).toBe('normal')
  })

  it('limits Uncanny Dodge to a conscious Rogue or the selected Hunter with a reaction', () => {
    const rogue = { ...creature({ classId: 'rogue', level: 5 }), currentHp: 10, turn: { reactionAvailable: true } }
    expect(dnd5eCanUseUncannyDodge(rogue)).toBe(true)
    expect(dnd5eCanUseUncannyDodge({ ...rogue, turn: { reactionAvailable: false } })).toBe(false)
    const denied = {
      ...rogue,
      classState: { openHandNoReactionsAppliedTurnKeysBySource: { monk: 'combat:1:monk' } },
    }
    expect(dnd5eReactionsPrevented(denied)).toBe(true)
    expect(dnd5eCanUseUncannyDodge(denied)).toBe(false)
    expect(dnd5eReactionsPrevented({
      classState: { surprisedCombatId: 'combat', surpriseResolvedCombatId: undefined },
    })).toBe(true)
    expect(dnd5eReactionsPrevented({
      classState: { surprisedCombatId: 'combat', surpriseResolvedCombatId: 'combat' },
    })).toBe(false)
    expect(dnd5eReactionsPrevented({ classState: { turnedByClericId: 'cleric' } })).toBe(true)
    expect(dnd5eReactionsPrevented({ classState: { activeEffects: [createDnd5eMechanicalEffect({
      id: 'shock', definitionId: 'spell:shocking-grasp:reaction-lock', label: '无法反应',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'shocking-grasp' }, targetId: 'target',
      duration: { type: 'until-turn-boundary', boundary: 'target-turn-start' },
      modifiers: { preventReactions: true },
    })] } })).toBe(true)
    const hunter = {
      ...creature({
        classId: 'ranger', subclassId: 'hunter', level: 15,
        classSelections: { 'superior-hunters-defense': ['uncanny-dodge'] },
      }),
      currentHp: 10,
      turn: { reactionAvailable: true },
    }
    expect(dnd5eCanUseUncannyDodge(hunter)).toBe(true)
  })
})
