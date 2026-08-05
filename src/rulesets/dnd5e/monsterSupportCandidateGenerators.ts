import type { Character } from '../../types/character'
import { areOpposedCombatTokens, dnd5eCombatTokenSide } from '../../lib/opportunityAttacks'
import { mapGeometryCoverBetween, mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eMonsterCoreSpellCompatibility } from './monsterAdvancedAbilities'
import { dnd5eAvailableMonsterSpellSlotLevels } from './monsterCoreSpellAction'
import type { MonsterDecisionCandidate } from './monsterDecisionContracts'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import {
  getDnd5eSrdCombatSpell,
  dnd5eSpellDiceCount,
} from './spells'
import { dnd5eStandardConditionId } from './conditions'
import type { Dnd5eActiveEffectInstance } from './activeEffects'
import type { Dnd5eMonsterStatBlock } from './monsters'
import type { Dnd5eMonsterTurnPlan } from './monsterTurnPlanner'

interface HitPointProjection {
  current: number
  maximum: number
}

export interface MonsterSupportCandidateServices {
  hitPoints(target: Token, characters: readonly Character[]): HitPointProjection
  armorClass(target: Token, characters: readonly Character[]): number
  distanceFeet(map: BattleMap, left: Token, right: Token): number
  activeEffects(target: Token, characters: readonly Character[]): readonly Dnd5eActiveEffectInstance[]
  monsterForToken(target: Token): Dnd5eMonsterStatBlock | undefined
}

interface MonsterSupportCandidateInput {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  characters: readonly Character[]
  canUseAction: boolean
  canUseBonusAction: boolean
}

const baseMetrics = {
  targetPriorityWeight: 0,
  hitProbability: 1,
  preferredDistanceFeet: 0,
  movementFeet: 0,
  distanceImprovementFeet: 0,
  defensiveCoverBonus: 0,
  opportunityAttackRisk: 0,
  attacksThisTurn: false,
  dodges: false,
  dashes: false,
  usesNimbleEscape: false,
  usesPreciseCoverRoute: false,
} as const

export function createMonsterHealingCandidates(
  input: MonsterSupportCandidateInput,
  services: MonsterSupportCandidateServices,
): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  const { map, enemy, monster, characters } = input
  const geometry = mapGeometryRuntimeForMap(map.id)
  const healingSpells = (monster.spellcasting?.spells ?? []).flatMap((listedSpell) => {
    const spell = getDnd5eSrdCombatSpell(listedSpell.id)
    if (
      !spell ||
      dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full' ||
      spell.effect !== 'healing' ||
      spell.castingTime === 'reaction' ||
      (spell.castingTime === 'action' && !input.canUseAction) ||
      (spell.castingTime === 'bonus-action' && !input.canUseBonusAction)
    ) return []
    return dnd5eAvailableMonsterSpellSlotLevels({ monster, token: enemy, spell: listedSpell })
      .map((slotLevel) => ({ spell, slotLevel }))
  })
  if (healingSpells.length === 0) return []
  const allies = map.tokens.filter((target) => {
    if (target.type === 'obstacle' || areOpposedCombatTokens(enemy, target)) return false
    const hp = services.hitPoints(target, characters)
    if (hp.current <= 0 || hp.current >= hp.maximum) return false
    const creatureType = (services.monsterForToken(target)?.creatureType ?? '').toLowerCase()
    return !['undead', 'construct'].includes(creatureType) &&
      !creatureType.includes('亡灵') &&
      !creatureType.includes('构装')
  })
  return allies.flatMap((target) => healingSpells.flatMap(({ spell, slotLevel }) => {
    const distanceFeet = services.distanceFeet(map, enemy, target)
    if (distanceFeet > spell.rangeFeet) return []
    const cover = target.id === enemy.id
      ? undefined
      : mapGeometryCoverBetween(geometry, enemy, target, map)
    if (cover?.blocksLineOfEffect) return []
    const hp = services.hitPoints(target, characters)
    const diceCount = dnd5eSpellDiceCount(
      spell,
      Math.max(1, monster.spellcasting?.casterLevel ?? 1),
      slotLevel,
    )
    const modifier = spell.addSpellcastingModifier && monster.spellcasting?.ability
      ? rules.abilityModifier(monster.abilities[monster.spellcasting.ability])
      : 0
    const expectedHealing = Math.min(
      hp.maximum - hp.current,
      diceCount * (spell.dice.sides + 1) / 2 + spell.dice.bonus + modifier,
    )
    const missingRatio = 1 - hp.current / hp.maximum
    return [{
      id: `heal:${target.id}:${spell.id}:${slotLevel}`,
      kind: 'heal' as const,
      payload: {
        moved: false,
        attacked: false,
        attackerTokenId: enemy.id,
        targetTokenId: target.id,
        targetCharacterId: target.characterId,
        spellCast: {
          spellId: spell.id,
          spellName: spell.name,
          slotLevel,
          targetTokenIds: [target.id],
          effect: spell.effect,
          diceCount,
          diceSides: spell.dice.sides,
          castingTime: spell.castingTime,
        },
        message: `${enemy.label}施放${spell.name}治疗 ${target.label}。`,
      },
      metrics: {
        ...baseMetrics,
        expectedDamage: 0,
        targetCurrentHp: hp.current,
        targetMaximumHp: hp.maximum,
        targetArmorClass: services.armorClass(target, characters),
        supportValue: expectedHealing * 4 + missingRatio * 140,
        resourceCost: spell.level === 0 ? 0 : slotLevel * 3,
        targetDistanceFeet: distanceFeet,
        consumesAction: spell.castingTime === 'action',
      },
    }]
  }))
}

export function createMonsterHealingTouchCandidates(
  input: Omit<MonsterSupportCandidateInput, 'canUseBonusAction'>,
  services: MonsterSupportCandidateServices,
): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  if (!input.canUseAction) return []
  const { map, enemy, monster, characters } = input
  const actorSide = dnd5eCombatTokenSide(enemy)
  if (!actorSide) return []
  const geometry = mapGeometryRuntimeForMap(map.id)
  const actions = monster.actions.filter((action) =>
    action.kind === 'other' &&
    action.rule?.kind === 'healing-touch' &&
    dnd5eMonsterActionAutomation(action) === 'headless' &&
    (action.usage?.kind !== 'per-day' ||
      (enemy.dnd5eCombatState?.monsterActionUsesByActionId?.[action.id]?.current ?? action.usage.max) > 0))

  return actions.flatMap<MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>>((action) => {
    const rule = action.rule
    if (rule?.kind !== 'healing-touch') return []
    return map.tokens.flatMap((target) => {
      const hp = services.hitPoints(target, characters)
      if (
        target.id === enemy.id ||
        target.type === 'obstacle' ||
        dnd5eCombatTokenSide(target) !== actorSide ||
        hp.current <= 0 || hp.current >= hp.maximum
      ) return []
      const distanceFeet = services.distanceFeet(map, enemy, target)
      if (
        distanceFeet > rule.rangeFeet ||
        mapGeometryCoverBetween(geometry, enemy, target, map)?.blocksLineOfEffect
      ) return []

      const removable = new Set<string>()
      for (const effect of services.activeEffects(target, characters)) {
        const standard = effect.standardCondition ??
          (effect.legacyCondition ? dnd5eStandardConditionId(effect.legacyCondition) : undefined)
        const legacy = effect.legacyCondition?.trim().toLowerCase()
        if (rule.removes.includes('poisoned') && standard === 'poisoned') removable.add('poisoned')
        if (rule.removes.includes('blinded') && standard === 'blinded') removable.add('blinded')
        if (rule.removes.includes('deafened') && standard === 'deafened') removable.add('deafened')
        if (rule.removes.includes('disease') && ['disease', 'diseased', '疾病'].includes(legacy ?? '')) {
          removable.add('disease')
        }
        if (rule.removes.includes('curse') && ['curse', 'cursed', '诅咒'].includes(legacy ?? '')) {
          removable.add('curse')
        }
      }
      const effectiveHealing = Math.min(
        hp.maximum - hp.current,
        rule.healing.count * (rule.healing.sides + 1) / 2 + rule.healing.bonus,
      )
      const missingRatio = 1 - hp.current / hp.maximum
      return [{
        id: `heal-touch:${target.id}:${action.id}`,
        kind: 'heal' as const,
        payload: {
          moved: false,
          attacked: false,
          attackerTokenId: enemy.id,
          targetTokenId: target.id,
          targetCharacterId: target.characterId,
          specialAction: {
            kind: 'healing-touch' as const,
            actionId: action.id,
            actionName: action.name,
            targetTokenId: target.id,
            healing: {
              diceCount: rule.healing.count,
              diceSides: rule.healing.sides,
              bonus: rule.healing.bonus,
            },
          },
          message: `${enemy.label}使用${action.name}治疗${target.label}。`,
        },
        metrics: {
          ...baseMetrics,
          expectedDamage: 0,
          targetCurrentHp: hp.current,
          targetMaximumHp: hp.maximum,
          targetArmorClass: services.armorClass(target, characters),
          supportValue: effectiveHealing * 4 + missingRatio * 140 + removable.size * 50,
          allyEmergency: missingRatio,
          resourceCost: action.usage?.kind === 'per-day' ? 8 : 0,
          targetDistanceFeet: distanceFeet,
          consumesAction: true,
        },
      }]
    })
  })
}

export function createMonsterRestorationCandidates(
  input: Omit<MonsterSupportCandidateInput, 'canUseBonusAction'>,
  services: MonsterSupportCandidateServices,
): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  if (!input.canUseAction) return []
  const { map, enemy, monster, characters } = input
  const geometry = mapGeometryRuntimeForMap(map.id)
  const spells = (monster.spellcasting?.spells ?? []).flatMap((listedSpell) => {
    const spell = getDnd5eSrdCombatSpell(listedSpell.id)
    if (
      !spell ||
      spell.id !== 'lesser-restoration' ||
      spell.effect !== 'remove-condition' ||
      dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full'
    ) return []
    return dnd5eAvailableMonsterSpellSlotLevels({ monster, token: enemy, spell: listedSpell })
      .map((slotLevel) => ({ listedSpell, spell, slotLevel }))
  })
  const actorSide = dnd5eCombatTokenSide(enemy)
  if (!actorSide || spells.length === 0) return []
  const conditionPriority = ['paralyzed', 'blinded', 'poisoned', 'deafened', 'disease'] as const

  return map.tokens.flatMap((target) => {
    if (
      target.type === 'obstacle' ||
      dnd5eCombatTokenSide(target) !== actorSide ||
      services.hitPoints(target, characters).current <= 0
    ) return []
    const effects = services.activeEffects(target, characters)
    const conditionChoice = conditionPriority.find((condition) => effects.some((effect) => {
      const standard = effect.standardCondition ??
        (effect.legacyCondition ? dnd5eStandardConditionId(effect.legacyCondition) : undefined)
      return condition === 'disease'
        ? ['disease', 'diseased', '疾病'].includes(effect.legacyCondition?.trim().toLowerCase() ?? '')
        : standard === condition
    }))
    if (!conditionChoice) return []
    return spells.flatMap(({ listedSpell, spell, slotLevel }) => {
      const distanceFeet = services.distanceFeet(map, enemy, target)
      if (distanceFeet > spell.rangeFeet) return []
      const cover = target.id === enemy.id
        ? undefined
        : mapGeometryCoverBetween(geometry, enemy, target, map)
      if (cover?.blocksLineOfEffect || cover?.cover === 'total') return []
      const hp = services.hitPoints(target, characters)
      return [{
        id: `restore:${target.id}:${spell.id}:${conditionChoice}:${slotLevel}`,
        kind: 'support' as const,
        payload: {
          moved: false,
          attacked: false,
          attackerTokenId: enemy.id,
          targetTokenId: target.id,
          targetCharacterId: target.characterId,
          spellCast: {
            spellId: spell.id,
            spellName: spell.name,
            slotLevel,
            targetTokenIds: [target.id],
            effect: spell.effect,
            diceCount: 0,
            diceSides: spell.dice.sides,
            castingTime: spell.castingTime,
            conditionChoice,
          },
          message: `${enemy.label}施放${spell.name}，结束${target.label}的${conditionChoice}状态。`,
        },
        metrics: {
          ...baseMetrics,
          expectedDamage: 0,
          targetCurrentHp: hp.current,
          targetMaximumHp: hp.maximum,
          targetArmorClass: services.armorClass(target, characters),
          supportValue: conditionChoice === 'paralyzed' ? 110
            : conditionChoice === 'blinded' ? 78
              : conditionChoice === 'poisoned' ? 68
                : 52,
          allyEmergency: 1 - Math.max(0, Math.min(1, hp.current / Math.max(1, hp.maximum))),
          resourceCost: listedSpell.usage?.kind === 'per-day' ? 8 : slotLevel * 3,
          targetDistanceFeet: distanceFeet,
          consumesAction: true,
        },
      }]
    })
  })
}

export function createMonsterProtectionCandidates(
  input: MonsterSupportCandidateInput,
  services: MonsterSupportCandidateServices,
): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  const { map, enemy, monster, characters } = input
  const geometry = mapGeometryRuntimeForMap(map.id)
  const supportedSpellIds = new Set([
    'barkskin', 'blur', 'fly', 'greater-invisibility', 'invisibility',
    'longstrider', 'mage-armor', 'protection-from-poison', 'sanctuary',
  ])
  const supportSpells = (monster.spellcasting?.spells ?? []).flatMap((listedSpell) => {
    const spell = getDnd5eSrdCombatSpell(listedSpell.id)
    if (
      !spell ||
      !supportedSpellIds.has(spell.id) ||
      spell.effect !== 'active-effect' ||
      !spell.appliedEffect ||
      dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full' ||
      (spell.id === 'sanctuary' &&
        (!Number.isInteger(monster.spellcasting?.saveDc) || (monster.spellcasting?.saveDc ?? 0) <= 0)) ||
      (spell.concentration && enemy.dnd5eCombatState?.concentrationSpellId != null) ||
      spell.castingTime === 'reaction' ||
      (spell.castingTime === 'action' && !input.canUseAction) ||
      (spell.castingTime === 'bonus-action' && !input.canUseBonusAction)
    ) return []
    return dnd5eAvailableMonsterSpellSlotLevels({ monster, token: enemy, spell: listedSpell })
      .map((slotLevel) => ({ listedSpell, spell, slotLevel }))
  })
  const actorSide = dnd5eCombatTokenSide(enemy)
  if (!actorSide || supportSpells.length === 0) return []
  const allies = map.tokens.filter((target) =>
    target.type !== 'obstacle' &&
    dnd5eCombatTokenSide(target) === actorSide &&
    services.hitPoints(target, characters).current > 0)

  return allies.flatMap((target) => supportSpells.flatMap(({ listedSpell, spell, slotLevel }) => {
    if (
      (spell.rangeFeet === 0 && target.id !== enemy.id) ||
      target.dnd5eCombatState?.activeEffects?.some((effect) => effect.source.rulesId === spell.id)
    ) return []
    const targetMonster = services.monsterForToken(target)
    const armorNote = targetMonster?.armorClass.note?.trim().toLowerCase() ?? ''
    const wearingArmor = [
      '皮甲', '兽皮甲', '镶钉皮甲', '链甲衫', '链甲', '鳞甲', '胸甲', '半身板甲',
      '环甲', '板条甲', '板甲', 'leather', 'hide', 'chain', 'scale',
      'breastplate', 'half plate', 'ring mail', 'splint', 'plate',
    ].some((name) => armorNote.includes(name))
    const armorClass = services.armorClass(target, characters)
    if (
      (spell.id === 'mage-armor' && wearingArmor) ||
      (spell.id === 'barkskin' && armorClass >= 16) ||
      (spell.id === 'fly' && (targetMonster?.speed.fly ?? 0) >= 60)
    ) return []
    const distanceFeet = services.distanceFeet(map, enemy, target)
    if (distanceFeet > spell.rangeFeet) return []
    const cover = target.id === enemy.id
      ? undefined
      : mapGeometryCoverBetween(geometry, enemy, target, map)
    if (cover?.blocksLineOfEffect || cover?.cover === 'total') return []
    const hp = services.hitPoints(target, characters)
    const missingRatio = 1 - Math.max(0, Math.min(1, hp.current / Math.max(1, hp.maximum)))
    const nearbyHostiles = map.tokens.filter((candidate) =>
      candidate.type !== 'obstacle' &&
      areOpposedCombatTokens(target, candidate) &&
      services.hitPoints(candidate, characters).current > 0 &&
      services.distanceFeet(map, target, candidate) <= 30).length
    const hasPoisonedCondition = target.dnd5eCombatState?.activeEffects?.some((effect) =>
      effect.standardCondition === 'poisoned' ||
      ['poisoned', '中毒'].includes(effect.legacyCondition?.trim().toLowerCase() ?? '')) === true
    const baseSupportValue = spell.id === 'greater-invisibility' ? 68
      : spell.id === 'invisibility' ? 46
        : spell.id === 'blur' ? 48
          : spell.id === 'fly' ? 38
            : spell.id === 'barkskin' ? 24 + Math.max(0, 16 - armorClass) * 16
              : spell.id === 'mage-armor' ? 42
                : spell.id === 'longstrider' ? 22
                  : spell.id === 'protection-from-poison' ? (hasPoisonedCondition ? 72 : 18)
                    : 28
    return [{
      id: `support:${target.id}:${spell.id}:${slotLevel}`,
      kind: 'support' as const,
      payload: {
        moved: false,
        attacked: false,
        attackerTokenId: enemy.id,
        targetTokenId: target.id,
        targetCharacterId: target.characterId,
        spellCast: {
          spellId: spell.id,
          spellName: spell.name,
          slotLevel,
          targetTokenIds: [target.id],
          effect: spell.effect,
          diceCount: 0,
          diceSides: spell.dice.sides,
          castingTime: spell.castingTime,
        },
        message: `${enemy.label}施放${spell.name}保护 ${target.label}。`,
      },
      metrics: {
        ...baseMetrics,
        expectedDamage: 0,
        targetCurrentHp: hp.current,
        targetMaximumHp: hp.maximum,
        targetArmorClass: armorClass,
        supportValue: baseSupportValue + missingRatio * 38 + Math.min(3, nearbyHostiles) * 6,
        allyEmergency: missingRatio,
        resourceCost: listedSpell.usage?.kind === 'at-will' || listedSpell.level === 0
          ? 0
          : listedSpell.usage?.kind === 'per-day'
            ? 8
            : slotLevel * 3,
        targetDistanceFeet: distanceFeet,
        consumesAction: spell.castingTime === 'action',
      },
    }]
  }))
}
