import type { DiceRoll } from '../components/DiceRollOverlay'
import type { BattleMap, Token } from '../store/maps'
import type { Character, CombatSkill } from '../types/character'
import { isCalmMindActive, isOutOfBreath } from './calmMind'
import { attackDamageDiceCount, doubleArrowExtraDamageSides, resolveRangedAttackRoll } from './archerCombat'
import { getSkillRank, skillGrantsStun } from './archerSkillTree'
import { canUseArmorPiercing, canUseDoubleArrow, findClassTrait } from './classFeatures'
import { isTokenAlive } from './combatTokens'
import { getAc, isMagicDamageSkill } from './combatStats'
import type { AbilityKey } from './dnd'
import { getTokenTargetAc } from './enemyCombatStats'
import { pixelToCell, type GridCell } from './gridCombat'
import {
  aoeTargetResolvedEvents,
  attackResolvedEvent,
  attackResolvedEvents,
  targetDodgeResolvedEvent,
  type HeadlessEventOf,
} from './headlessCombatEvents'
import type { HeadlessAoeTargetPacket, HeadlessCombatEvent, HeadlessPlayerAttackPacket } from './headlessDmCombatEngine'
import { KNOCKBACK_DEFAULT_TURNS, KNOCKBACK_STATUS_LABEL } from './knockback'
import {
  aoeOrientFromCell,
  canPlaceAoe,
  cellsForAoe,
  getSkillAoeTargeting,
  tokensInCells,
  type SkillAoeTargeting,
} from './skillTargeting'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import { piercingInsightExtraD4, piercingInsightHpThresholdPercent } from './traitRegistry'

export type PlayerAttackPrepareResult =
  | {
      ok: true
      actor: Character
      skill: CombatSkill
      targets: Token[]
      targetIds: string[]
      waiveAp: boolean
      doubleArrow: boolean
      isArrowSequence: boolean
    }
  | {
      ok: false
      reason: 'invalid-attack' | 'insufficient-ap'
    }

export function preparePlayerAttackAction(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: Character[]
}): PlayerAttackPrepareResult {
  const { action, map, characters } = input
  const actor = characters.find((character) => character.id === action.characterId)
  const skill = actor?.combatSkills.find((item) => item.id === action.skillId)
  const targetIds = action.targetTokenIds?.length
    ? action.targetTokenIds
    : action.targetTokenId
      ? [action.targetTokenId]
      : []
  const initialTargets = targetIds
    .map((targetId) => map.tokens.find((token) => token.id === targetId))
    .filter((target): target is Token => !!target)

  if (
    action.type !== 'attack-token' ||
    !actor ||
    !skill ||
    getSkillAoeTargeting(skill) ||
    initialTargets.length === 0 ||
    initialTargets.some((target) => !isTokenAlive(target, characters))
  ) {
    return { ok: false, reason: 'invalid-attack' }
  }

  const waiveAp = !!actor.combatBuffs?.galeComboReady
  if (!waiveAp && actor.currentAP < skill.apCost) return { ok: false, reason: 'insufficient-ap' }

  const doubleArrow = canUseDoubleArrow(actor, skill) && !!actor.combatBuffs?.doubleArrowReady
  const targets = expandRepeatedAttackTargets(skill, initialTargets)
  const isArrowSequence =
    skill.skillTreeId === 'multiShot' ||
    skill.skillTreeId === 'encircle' ||
    (!!action.targetTokenIds?.length && skill.skillTreeId === 'rageShot')

  return {
    ok: true,
    actor,
    skill,
    targets,
    targetIds,
    waiveAp,
    doubleArrow,
    isArrowSequence,
  }
}

export type PlayerAoeAttackPrepareResult =
  | {
      ok: true
      actor: Character
      skill: CombatSkill
      aoe: SkillAoeTargeting
      actorToken: Token
      casterCell: GridCell
      anchorCell: GridCell
      cells: GridCell[]
      targets: Token[]
      waiveAp: boolean
      skillRank: number
      baseDiceCount: number
      calmExtraDiceCount: number
      windExtraDiceCount: number
      saveMode?: 'half' | 'none' | 'fail-half'
      selfCooldownReduction: number
      shouldStun: boolean
    }
  | {
      ok: false
      reason: 'invalid-aoe-attack' | 'insufficient-ap' | 'unsupported-aoe-attack' | 'out-of-range' | 'invalid-target'
    }

export function preparePlayerAoeAttackAction(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: Character[]
}): PlayerAoeAttackPrepareResult {
  const { action, map, characters } = input
  const actor = characters.find((character) => character.id === action.characterId)
  const skill = actor?.combatSkills.find((item) => item.id === action.skillId)
  const aoe = skill ? getSkillAoeTargeting(skill) : null
  if (action.type !== 'aoe-attack' || !actor || !skill || !aoe || !action.targetCell) {
    return { ok: false, reason: 'invalid-aoe-attack' }
  }

  const waiveAp = !!actor.combatBuffs?.galeComboReady
  if (!waiveAp && actor.currentAP < skill.apCost) return { ok: false, reason: 'insufficient-ap' }
  if (skill.damageCount <= 0 || skill.damageSides <= 0) return { ok: false, reason: 'unsupported-aoe-attack' }

  const actorToken = map.tokens.find((token) => token.id === action.actorTokenId)
  if (!actorToken) return { ok: false, reason: 'invalid-aoe-attack' }

  const casterCell = pixelToCell(actorToken.x, actorToken.y, map)
  const anchorCell = aoe.shape === 'circle' && aoe.origin === 'self' ? casterCell : action.targetCell
  if (!canPlaceAoe(aoe, casterCell, anchorCell)) return { ok: false, reason: 'out-of-range' }

  const orientFrom = aoeOrientFromCell(aoe, casterCell, anchorCell, {
    skillTreeId: skill.skillTreeId,
    rectRotation: action.aoeRectRotation ?? 0,
  })
  const cells = cellsForAoe(aoe, orientFrom, anchorCell)
  const targets = tokensInCells(map, map.tokens, cells).filter(
    (token) => token.id !== actorToken.id && isTokenAlive(token, characters),
  )
  if (targets.length === 0) return { ok: false, reason: 'invalid-target' }

  const skillRank = skill.skillTreeId ? getSkillRank(actor, skill.skillTreeId) : 0
  const calm = findClassTrait(actor, 'calmMind')
  const calmExtraDiceCount = calm && isCalmMindActive(actor) && calm.level > 0 ? calm.level : 0
  const windExtraDiceCount = windTraceExtraDiceCountForAoe(
    skill.skillTreeId,
    skillRank,
    actor,
    targets[0],
    targets.length,
  )
  const saveMode =
    skill.skillTreeId === 'focusShot'
      ? 'fail-half'
      : skill.skillTreeId === 'spiralBlade'
        ? 'none'
        : skill.skillTreeId === 'windTraceShot'
          ? undefined
          : 'half'
  const selfCooldownReduction =
    skill.skillTreeId === 'windTraceShot' && skillRank >= 4 && isCalmMindActive(actor) ? 1 : 0
  const shouldStun = skill.skillTreeId === 'focusShot' && skillGrantsStun(skill.skillTreeId, skillRank)

  return {
    ok: true,
    actor,
    skill,
    aoe,
    actorToken,
    casterCell,
    anchorCell,
    cells,
    targets,
    waiveAp,
    skillRank,
    baseDiceCount: Math.max(1, attackDamageDiceCount(skill, false)),
    calmExtraDiceCount,
    windExtraDiceCount,
    saveMode,
    selfCooldownReduction,
    shouldStun,
  }
}

export function canResolveSingleAttackWithHeadless(
  actor: Character,
  skill: CombatSkill,
  opts: { doubleArrow: boolean; targetCount: number },
): boolean {
  void opts.doubleArrow
  if (opts.targetCount !== 1) return false
  if (skill.remaining > 0 || skill.damageCount <= 0 || skill.damageSides <= 0) return false
  if (getSkillAoeTargeting(skill)) return false
  const buffs = actor.combatBuffs
  if (
    (buffs?.burstKickExtraD6 && skill.skillTreeId !== 'burstKick') ||
    (buffs?.windKickTreatKnockbackTargetId && skill.skillTreeId !== 'windKickCombo')
  ) {
    return false
  }
  return true
}

export interface EnemyDodgePreviewForPacket {
  decision: { shouldDodge: boolean }
  attackBonus: number
  targetAc: number
}

export interface SingleAttackTargetPacketBuildInput {
  actor: Character
  skill: CombatSkill
  targetToken: Token
  targetChar?: Character
  doubleArrow: boolean
  actionIsCrit?: boolean
  liveRound: number
  actorTokenId: string
  firstInitiativeTokenId?: string
  targetHasKnockbackNow?: boolean
  rollD20: (label: string, targetName: string) => Promise<number>
  rollValues: (count: number, sides: number, label: string, targetName: string) => Promise<number[]>
  enemyDodgePreview: (
    target: Token,
    attacker: Character,
    skill: CombatSkill,
  ) => EnemyDodgePreviewForPacket | null
  chooseCooldownReductionSkillId: (caster: Character, amount: number, reason: string) => string | undefined
  confirmPushTarget: (target: Token) => Promise<boolean>
}

export interface SingleAttackTargetPacketBuildResult {
  targetPacket: HeadlessPlayerAttackPacket
  skillRank: number
  packetIsCrit: boolean
  attackRollHit: boolean
  shouldRollDamage: boolean
}

export async function buildSingleAttackTargetPacket(
  input: SingleAttackTargetPacketBuildInput,
): Promise<SingleAttackTargetPacketBuildResult> {
  const {
    actor,
    skill,
    targetToken,
    targetChar,
    doubleArrow,
    actionIsCrit,
    liveRound,
    actorTokenId,
    firstInitiativeTokenId,
    targetHasKnockbackNow,
    rollD20,
    rollValues,
    enemyDodgePreview,
    chooseCooldownReductionSkillId,
    confirmPushTarget,
  } = input

  const huntingComboRankForAttack = huntingComboTraitRankForPacket(actor)
  const huntingComboIgnoresDodge = huntingComboRankForAttack > 0 && (targetToken.huntingMarkStacks ?? 0) > 0
  const preciseStrikeReady = !!actor.combatBuffs?.preciseStrikeReady
  const outOfBreathForAttack = isOutOfBreath(actor)
  const calmSpiritCritBonus = actor.combatBuffs?.calmSpiritCritBonusPercent ?? 0
  const needsAttackRoll = outOfBreathForAttack || calmSpiritCritBonus > 0
  const attackAbility: AbilityKey = skill.tags?.includes('melee') ? 'str' : 'dex'
  const targetAcForAttack = huntingComboIgnoresDodge
    ? 0
    : targetChar
      ? getAc(targetChar)
      : (getTokenTargetAc(targetToken) ?? 12)
  const attackRollD20 = needsAttackRoll ? await rollD20(`${skill.name} D20`, targetToken.label) : undefined
  const critThreshold = calmSpiritCritThresholdForPacket(actor)
  const attackRollPreview =
    needsAttackRoll && attackRollD20 != null
      ? resolveRangedAttackRoll(actor, skill, targetAcForAttack, !!doubleArrow, {
          d20: attackRollD20,
          damageValues: [],
          ability: attackAbility,
          critThreshold,
          forceCrit: preciseStrikeReady,
        })
      : undefined
  const attackRollHit = attackRollPreview?.hit ?? true
  const packetIsCrit = !!attackRollPreview?.isCrit || preciseStrikeReady || !!actionIsCrit
  const attackRollPacket =
    needsAttackRoll && attackRollD20 != null
      ? {
          d20: attackRollD20,
          ability: attackAbility,
          targetAc: targetAcForAttack,
          critThreshold,
          forceCrit: preciseStrikeReady || undefined,
        }
      : undefined

  const dodgePreview = attackRollHit && !huntingComboIgnoresDodge ? enemyDodgePreview(targetToken, actor, skill) : null
  const targetDodgeD20 = dodgePreview?.decision.shouldDodge
    ? await rollD20('enemy dodge D20', targetToken.label)
    : undefined
  const expectedTargetDodged =
    targetDodgeD20 != null && dodgePreview
      ? targetDodgeD20 + dodgePreview.attackBonus < dodgePreview.targetAc
      : false
  const damageDiceCount = doubleArrow ? attackDamageDiceCount(skill, true) : skill.damageCount
  const shouldRollDamage = attackRollHit && !expectedTargetDodged
  const diceValues = shouldRollDamage
    ? await rollValues(damageDiceCount, skill.damageSides, `${skill.name} damage`, targetToken.label)
    : undefined
  const skillRank = skill.skillTreeId ? getSkillRank(actor, skill.skillTreeId) : 0
  const windKickTreatsTargetAsKnocked =
    skill.skillTreeId === 'windKickCombo' && actor.combatBuffs?.windKickTreatKnockbackTargetId === targetToken.id
  const targetKnockedForWindKick =
    skill.skillTreeId === 'windKickCombo' &&
    (!!targetToken.knockbackTurns ||
      !!targetChar?.conditions.includes(KNOCKBACK_STATUS_LABEL) ||
      windKickTreatsTargetAsKnocked)
  const targetKnockedForEagleStrike =
    skill.skillTreeId === 'eagleStrike' && !!targetHasKnockbackNow
  const burstKickExtraD6 =
    shouldRollDamage && skill.skillTreeId === 'burstKick' ? (actor.combatBuffs?.burstKickExtraD6 ?? 0) : 0
  const extraDamageGroups: Array<{ values: number[]; sides: number }> = []
  const pushExtraDamage = async (count: number, sides: number, label: string) => {
    if (count <= 0) return
    extraDamageGroups.push({
      values: await rollValues(count, sides, label, targetToken.label),
      sides,
    })
  }

  const doubleArrowTrait = doubleArrow ? findClassTrait(actor, 'doubleArrow') : undefined
  const doubleArrowExtraSides = doubleArrowTrait ? doubleArrowExtraDamageSides(doubleArrowTrait.level) : undefined
  if (shouldRollDamage && doubleArrowExtraSides) {
    await pushExtraDamage(1, doubleArrowExtraSides, `${skill.name} 双箭额外伤害`)
  }

  const shadowVeilApplies = actor.combatBuffs?.shadowVeilTargetId === targetToken.id
  if (shouldRollDamage && shadowVeilApplies) {
    await pushExtraDamage(1, 6, `${skill.name} 影遁之术额外伤害`)
  }

  const calmMindTrait = findClassTrait(actor, 'calmMind')
  if (shouldRollDamage && calmMindTrait && isCalmMindActive(actor) && calmMindTrait.level > 0) {
    await pushExtraDamage(calmMindTrait.level, 6, `${skill.name} 静心额外伤害`)
  }

  const huntingMarkRank = huntingMarkTraitRankForPacket(actor)
  if (shouldRollDamage && huntingMarkRank > 0 && (targetToken.huntingMarkStacks ?? 0) > 0) {
    await pushExtraDamage(huntingMarkRank, 8, `${skill.name} 狩猎印记额外伤害`)
  }

  const animalMasteryTrait = findClassTrait(actor, 'animalMastery')
  if (shouldRollDamage && animalMasteryTrait && isBeastLikeTargetForPacket(targetToken)) {
    await pushExtraDamage(animalMasteryTrait.level, 6, `${skill.name} animal mastery extra damage`)
  }

  const arcaneDevourTrait = findClassTrait(actor, 'arcaneDevour')
  if (shouldRollDamage && arcaneDevourTrait && isMagicDamageSkill(skill)) {
    await pushExtraDamage(arcaneDevourTrait.level, 6, `${skill.name} arcane devour extra damage`)
  }

  const comboFistTrait = actor.combatBuffs?.galeComboReady ? findClassTrait(actor, 'comboFist') : undefined
  if (shouldRollDamage && comboFistTrait) {
    await pushExtraDamage(comboFistTrait.level, 6, `${skill.name} combo fist extra damage`)
  }

  const piercingInsightTrait = findClassTrait(actor, 'piercingInsight')
  const targetHp = targetChar?.currentHp ?? targetToken.hp ?? targetToken.maxHp ?? 0
  const targetMaxHp = targetChar?.maxHp ?? targetToken.maxHp ?? targetHp
  const piercingInsightThreshold =
    piercingInsightTrait && targetMaxHp > 0 ? piercingInsightHpThresholdPercent(piercingInsightTrait.level) / 100 : 0
  const piercingInsightApplies =
    shouldRollDamage &&
    !!piercingInsightTrait &&
    targetMaxHp > 0 &&
    targetHp / targetMaxHp < piercingInsightThreshold
  if (piercingInsightApplies && piercingInsightTrait) {
    await pushExtraDamage(piercingInsightExtraD4(piercingInsightTrait.level), 4, `${skill.name} 看破额外伤害`)
  }

  const silentDrawTrait = findClassTrait(actor, 'silentDraw')
  const silentDrawApplies =
    shouldRollDamage &&
    !!silentDrawTrait &&
    !actor.combatBuffs?.silentDrawUsed &&
    liveRound === 1 &&
    firstInitiativeTokenId === actorTokenId
  if (silentDrawApplies && silentDrawTrait) {
    await pushExtraDamage(silentDrawTrait.level, 6, `${skill.name} 无声起弦额外伤害`)
  }

  if (burstKickExtraD6 > 0) {
    await pushExtraDamage(burstKickExtraD6, 6, `${skill.name} 捆绑射击额外伤害`)
  }

  if (shouldRollDamage && targetKnockedForWindKick) {
    await pushExtraDamage(1, 6, `${skill.name} 击飞目标额外伤害`)
  }

  if (shouldRollDamage && skill.skillTreeId === 'eagleStrike') {
    await pushExtraDamage(eagleStrikeExtraDiceCountForPacket(skillRank), 6, `${skill.name} eagle strike knockback damage`)
  }

  const targetHasMagicState =
    !!targetToken.burningTurns ||
    !!targetToken.igniteTurns ||
    !!targetToken.poisonTurns ||
    !!targetToken.stunTurns ||
    !!targetToken.knockbackTurns ||
    !!targetToken.restrainedTurns ||
    !!targetToken.vulnerableTurns ||
    (targetChar?.conditions.length ?? 0) > 0
  if (shouldRollDamage && skill.skillTreeId === 'antiMagicArrow' && targetHasMagicState) {
    await pushExtraDamage(2, 6, `${skill.name} 魔法状态额外伤害`)
  }

  const postCritDamageGroups: Array<{ values: number[]; sides: number }> = []
  const pushPostCritDamage = async (count: number, sides: number, label: string) => {
    if (count <= 0) return
    postCritDamageGroups.push({
      values: await rollValues(count, sides, label, targetToken.label),
      sides,
    })
  }
  const explosiveArrowCritDice =
    shouldRollDamage && packetIsCrit && skill.skillTreeId === 'explosiveArrow'
      ? skillRank >= 5
        ? 4
        : skillRank >= 2
          ? 3
          : 2
      : 0
  await pushPostCritDamage(explosiveArrowCritDice, 6, `${skill.name} explosive arrow crit fire`)

  const explosiveArrowTrait = findClassTrait(actor, 'explosiveArrow')
  if (shouldRollDamage && packetIsCrit && explosiveArrowTrait) {
    await pushPostCritDamage(explosiveArrowTrait.level, 12, `${skill.name} explosive arrow feature fire`)
  }
  const explosiveArrowBurnTurns =
    postCritDamageGroups.length > 0 ? (skill.skillTreeId === 'explosiveArrow' && skillRank >= 4 ? 2 : 1) : undefined
  const effectAbility: AbilityKey | undefined =
    shouldRollDamage && skill.skillTreeId === 'burstKick' && skillRank >= 3
      ? 'con'
      : shouldRollDamage && skill.skillTreeId === 'rageShot' && skillRank >= 3
        ? 'str'
        : shouldRollDamage && skill.skillTreeId === 'bindShot'
          ? 'str'
          : shouldRollDamage && skill.skillTreeId === 'eagleStrike'
            ? 'dex'
            : undefined
  const effectSaveD20 = effectAbility ? await rollD20(`${skill.name} effect save D20`, targetToken.label) : undefined
  const effectSaveD20Second =
    shouldRollDamage && skill.skillTreeId === 'eagleStrike' && skillRank >= 5
      ? await rollD20(`${skill.name} effect save disadvantage D20`, targetToken.label)
      : undefined
  const cooldownReductionAmount = shouldRollDamage && skill.skillTreeId === 'refluxMagicArrow' ? 1 : 0
  const cooldownReductionSkillId =
    cooldownReductionAmount > 0
      ? chooseCooldownReductionSkillId(actor, cooldownReductionAmount, `${skill.name} 命中`)
      : undefined
  const pushTargetOnHit =
    shouldRollDamage && skill.skillTreeId === 'windKickCombo' && skillRank >= 3
      ? await confirmPushTarget(targetToken)
      : false
  const armorPiercingApplies = canUseArmorPiercing(actor, skill, packetIsCrit)

  return {
    targetPacket: {
      targetTokenId: targetToken.id,
      damageDiceCount,
      diceValues,
      extraDamageGroups: extraDamageGroups.length > 0 ? extraDamageGroups : undefined,
      postCritDamageGroups: postCritDamageGroups.length > 0 ? postCritDamageGroups : undefined,
      halveDamageOnRangeFeet:
        skill.skillTreeId === 'clusterShot'
          ? { minExclusive: 10, maxInclusive: 20 }
          : undefined,
      targetDodgeD20,
      attackRoll: attackRollPacket,
      isCrit: packetIsCrit || undefined,
      targetDodgeMode: dodgePreview?.decision.shouldDodge ? 'attempt' : 'skip',
      ignoreTargetDodge: huntingComboIgnoresDodge || undefined,
      additionalCritMultiplier:
        huntingComboIgnoresDodge && packetIsCrit
          ? 0.2 + (huntingComboRankForAttack - 1) * 0.05
          : undefined,
      effectSave:
        effectAbility && effectSaveD20 != null
          ? {
              ability: effectAbility,
              d20: effectSaveD20,
              d20Second: effectSaveD20Second,
              disadvantage: skill.skillTreeId === 'eagleStrike' && skillRank >= 5,
            }
          : undefined,
      stunOnFailedEffectSave: skill.skillTreeId === 'burstKick' && skillRank >= 3,
      knockbackOnFailedEffectSave: skill.skillTreeId === 'eagleStrike',
      knockbackTurns: skill.skillTreeId === 'eagleStrike' ? KNOCKBACK_DEFAULT_TURNS : undefined,
      restrainedOnFailedEffectSave:
        (skill.skillTreeId === 'rageShot' && skillRank >= 3) ||
        (skill.skillTreeId === 'bindShot' && skillRank >= 4),
      pullOnFailedEffectSave: skill.skillTreeId === 'bindShot',
      pullCells: skill.skillTreeId === 'bindShot' ? 2 : undefined,
      smallOrMediumOnly: skill.skillTreeId === 'bindShot' || skill.skillTreeId === 'rageShot',
      grantBurstKickExtraD6OnHit: skill.skillTreeId === 'bindShot' ? 1 : undefined,
      clearBurstKickExtraD6OnUse: skill.skillTreeId === 'burstKick' && (actor.combatBuffs?.burstKickExtraD6 ?? 0) > 0,
      pushTargetOnHit,
      pushCells: pushTargetOnHit ? 1 : undefined,
      selfCooldownReductionOnHit:
        skill.skillTreeId === 'windKickCombo' && targetKnockedForWindKick && skillRank >= 5
          ? 1
          : targetKnockedForEagleStrike
            ? skillRank >= 4
              ? 3
              : 2
            : undefined,
      clearWindKickTreatKnockbackOnUse: windKickTreatsTargetAsKnocked,
      clearActorConditionOnHit: skill.skillTreeId === 'riseKick' ? '倒地' : undefined,
      grantFreeMoveFeetOnHit:
        skill.skillTreeId === 'riseKick' && skillRank >= 4
          ? 10
          : skill.skillTreeId === 'shadowStepShot'
            ? skillRank >= 4
              ? 15
              : 10
            : skill.skillTreeId === 'shadowDance'
              ? 15
              : undefined,
      grantDisengageOnHit: skill.skillTreeId === 'shadowStepShot' || skill.skillTreeId === 'shadowDance',
      grantWindKickTreatKnockbackOnHit: skill.skillTreeId === 'shadowDance' && skillRank >= 3,
      burningOnHit: postCritDamageGroups.length > 0,
      burningTurns: explosiveArrowBurnTurns,
      igniteOnHit: postCritDamageGroups.length > 0,
      igniteTurns: explosiveArrowBurnTurns,
      cooldownReductionSkillId,
      cooldownReductionAmount: cooldownReductionSkillId ? cooldownReductionAmount : undefined,
      vulnerableOnHit: skill.skillTreeId === 'antiMagicArrow' && skillRank >= 3,
      vulnerableTurns: 1,
      clearTargetStatusesOnHit: skill.skillTreeId === 'antiMagicArrow' && skillRank >= 4,
      selfCooldownReductionPerClearedStatus: skill.skillTreeId === 'antiMagicArrow' && skillRank >= 5,
      armorPiercingSplashOnCrit: armorPiercingApplies || undefined,
      armorPiercingRangeFeet: 15,
      spendArmorPiercingUseOnSplash: armorPiercingApplies || undefined,
      clearDoubleArrowReadyOnUse: doubleArrow || undefined,
      spendDoubleArrowUseOnHit: doubleArrow || undefined,
      clearPreciseStrikeReadyOnHit: preciseStrikeReady || undefined,
      spendPreciseStrikeUseOnHit: preciseStrikeReady || undefined,
      clearShadowVeilTargetOnUse: shadowVeilApplies || undefined,
      clearCalmSpiritCritBonusOnUse: calmSpiritCritBonus > 0 || undefined,
      addHuntingMarkOnDamage: huntingMarkRank > 0 || undefined,
      markSilentDrawUsedOnHit: silentDrawApplies || undefined,
    },
    skillRank,
    packetIsCrit,
    attackRollHit,
    shouldRollDamage,
  }
}

export interface ArrowSequenceTargetPacketBuildInput {
  actor: Character
  skill: CombatSkill
  targets: Token[]
  resolveTarget?: (target: Token) => Token
  rollD20: (label: string, targetName: string) => Promise<number>
  rollValues: (count: number, sides: number, label: string, targetName: string) => Promise<number[]>
  enemyDodgePreview: (
    target: Token,
    attacker: Character,
    skill: CombatSkill,
  ) => EnemyDodgePreviewForPacket | null
}

export interface ArrowSequenceTargetPacketBuildResult {
  targetPackets: HeadlessPlayerAttackPacket[]
  skillRank: number
  damagePacketCount: number
}

export async function buildArrowSequenceTargetPackets(
  input: ArrowSequenceTargetPacketBuildInput,
): Promise<ArrowSequenceTargetPacketBuildResult> {
  const { actor, skill, targets, resolveTarget, rollD20, rollValues, enemyDodgePreview } = input
  const perPacketDiceCount = Math.max(1, skill.damageCount)
  const packetPlans: Array<{
    target: Token
    targetDodgeD20?: number
    targetDodgeMode: 'attempt' | 'skip'
    expectedDodged: boolean
    effectSaveD20?: number
  }> = []
  let damagePacketCount = 0
  const skillRank = skill.skillTreeId ? getSkillRank(actor, skill.skillTreeId) : 0

  for (const target of targets) {
    const liveTarget = resolveTarget?.(target) ?? target
    const dodgePreview = enemyDodgePreview(liveTarget, actor, skill)
    const shouldDodge = !!dodgePreview?.decision.shouldDodge
    const targetDodgeD20 = shouldDodge ? await rollD20('敌人闪避 D20', liveTarget.label) : undefined
    const expectedDodged =
      targetDodgeD20 != null && dodgePreview
        ? targetDodgeD20 + dodgePreview.attackBonus < dodgePreview.targetAc
        : false
    const effectSaveD20 =
      !expectedDodged && skill.skillTreeId === 'rageShot' && skillRank >= 3
        ? await rollD20('怒气爆射力量豁免 D20', liveTarget.label)
        : undefined
    if (!expectedDodged) damagePacketCount += 1
    packetPlans.push({
      target,
      targetDodgeD20,
      targetDodgeMode: shouldDodge ? 'attempt' : 'skip',
      expectedDodged,
      effectSaveD20,
    })
  }

  const allPacketsTargetSame = targets.length > 0 && targets.every((target) => target.id === targets[0].id)
  const shouldEncircleStun =
    skill.skillTreeId === 'encircle' &&
    skillRank >= 5 &&
    allPacketsTargetSame &&
    targets.length >= Math.max(1, skill.arrowShots ?? 1) &&
    packetPlans.every((plan) => !plan.expectedDodged)
  const encircleStunSaveD20 = shouldEncircleStun
    ? await rollD20(`${skill.name} 体质豁免 D20`, targets[0].label)
    : undefined
  const allDamageValues =
    damagePacketCount > 0
      ? await rollValues(
          perPacketDiceCount * damagePacketCount,
          skill.damageSides,
          `${skill.name} 伤害`,
          targets[0]?.label ?? skill.name,
        )
      : []
  let damageCursor = 0
  let encircleStunAssigned = false
  const targetPackets = packetPlans.map((plan) => {
    const diceValues = plan.expectedDodged
      ? undefined
      : allDamageValues.slice(damageCursor, damageCursor + perPacketDiceCount)
    if (!plan.expectedDodged) damageCursor += perPacketDiceCount
    const applyEncircleStun = !plan.expectedDodged && encircleStunSaveD20 != null && !encircleStunAssigned
    if (applyEncircleStun) encircleStunAssigned = true
    return {
      targetTokenId: plan.target.id,
      diceValues,
      targetDodgeD20: plan.targetDodgeD20,
      targetDodgeMode: plan.targetDodgeMode,
      effectSave:
        plan.effectSaveD20 != null
          ? { ability: 'str' as const, d20: plan.effectSaveD20 }
          : applyEncircleStun
            ? { ability: 'con' as const, d20: encircleStunSaveD20 }
            : undefined,
      restrainedOnFailedEffectSave: plan.effectSaveD20 != null,
      smallOrMediumOnly: skill.skillTreeId === 'rageShot',
      stunOnFailedEffectSave: applyEncircleStun,
      noMoveOnHit: skill.skillTreeId === 'encircle',
      noMoveTurns: skill.skillTreeId === 'encircle' ? 1 : undefined,
    }
  })

  return { targetPackets, skillRank, damagePacketCount }
}

export interface AoeTargetPacketBuildInput {
  actor: Character
  skill: CombatSkill
  targets: Token[]
  saveMode?: 'half' | 'none' | 'fail-half'
  shouldStun: boolean
  resolveTargetCharacter?: (target: Token) => Character | undefined
  targetHasKnockbackNow: (target: Token, targetChar?: Character) => boolean
  rollD20: (label: string, targetName: string) => Promise<number>
  rollValues: (count: number, sides: number, label: string, targetName: string) => Promise<number[]>
}

export interface AoeTargetPacketBuildResult {
  targetPackets: HeadlessAoeTargetPacket[]
}

export async function buildAoeTargetPackets(input: AoeTargetPacketBuildInput): Promise<AoeTargetPacketBuildResult> {
  const {
    actor,
    skill,
    targets,
    saveMode,
    shouldStun,
    resolveTargetCharacter,
    targetHasKnockbackNow,
    rollD20,
    rollValues,
  } = input
  const takeoffTrait = skill.skillTreeId === 'whirlwindKick' ? findClassTrait(actor, 'takeoff') : undefined
  const targetPackets: HeadlessAoeTargetPacket[] = []

  for (const target of targets) {
    const targetChar = resolveTargetCharacter?.(target)
    const extraDamageGroups: Array<{ values: number[]; sides: number }> = []
    if (takeoffTrait && targetHasKnockbackNow(target, targetChar)) {
      const count = Math.min(3, takeoffTrait.level)
      extraDamageGroups.push({
        values: await rollValues(count, 6, `${skill.name} takeoff extra damage`, target.label),
        sides: 6,
      })
    }
    if (!saveMode) {
      targetPackets.push({
        targetTokenId: target.id,
        saveD20: undefined,
        stunSaveD20: undefined,
        extraDamageGroups: extraDamageGroups.length > 0 ? extraDamageGroups : undefined,
      })
      continue
    }
    const targetName = targetChar?.name ?? target.label
    const saveD20 = await rollD20('敏捷豁免 D20', targetName)
    const stunSaveD20 = shouldStun ? await rollD20('体质豁免 D20', targetName) : undefined
    targetPackets.push({
      targetTokenId: target.id,
      saveD20,
      stunSaveD20,
      extraDamageGroups: extraDamageGroups.length > 0 ? extraDamageGroups : undefined,
    })
  }

  return { targetPackets }
}

function eagleStrikeExtraDiceCountForPacket(rank: number): number {
  if (rank <= 0) return 0
  return rank === 1 ? 3 : 4
}

function windTraceExtraDiceCountForAoe(
  skillTreeId: string | undefined,
  rank: number,
  caster: Character,
  token: Token,
  aoeTargetCount?: number,
): number {
  if (skillTreeId !== 'windTraceShot') return 0
  let count = 0
  if ((aoeTargetCount ?? 0) === 1) count += 2
  if (rank >= 2 && isCalmMindActive(caster)) count += 1
  if (rank >= 3) count += token.huntingMarkStacks ?? 0
  return count
}

function huntingMarkTraitRankForPacket(caster?: Character): number {
  return caster ? (findClassTrait(caster, 'huntingMark')?.level ?? 0) : 0
}

function huntingComboTraitRankForPacket(caster?: Character): number {
  return caster ? (findClassTrait(caster, 'huntingCombo')?.level ?? 0) : 0
}

function calmSpiritCritThresholdForPacket(caster?: Character): number {
  const bonus = caster?.combatBuffs?.calmSpiritCritBonusPercent ?? 0
  return Math.max(1, 20 - Math.floor(bonus / 5))
}

function isBeastLikeTargetForPacket(token: Token): boolean {
  const key = `${token.poolId ?? ''} ${token.label}`.toLowerCase()
  return [
    'wolf',
    'bear',
    'spider',
    'slime',
    'owlbear',
    'harpy',
    '兽',
    '野兽',
    '动物',
    '狼',
    '熊',
    '蜘蛛',
  ].some((word) => key.includes(word))
}

export type SingleAttackDisplayPlan =
  | {
      ok: false
      reason: 'invalid-attack'
    }
  | {
      ok: true
      resolved: HeadlessEventOf<'attack-resolved'>
      formula: string
      roll?: DiceRoll
      apLog: {
        amount: number
        action: string
        detail: string
      }
      combatLog: {
        text: string
        kind: 'attack' | 'damage'
      }
    }

export function planSingleAttackDisplay(input: {
  actor: Character
  skill: CombatSkill
  targetToken: Token
  events: HeadlessCombatEvent[]
}): SingleAttackDisplayPlan {
  const { actor, skill, targetToken, events } = input
  const resolved = attackResolvedEvent(events)
  if (!resolved) return { ok: false, reason: 'invalid-attack' }

  const dodgeEvent = targetDodgeResolvedEvent(events)
  const formula = resolved.hit
    ? `${resolved.damageValues.join(' + ')}${
        skill.damageBonus ? ` + ${skill.damageBonus}` : ''
      } = ${resolved.damageBeforeDefense}，攻防修正${resolved.modifier >= 0 ? '+' : '-'}${Math.abs(
        resolved.modifier,
      )}（差值${resolved.diff}），最终${resolved.total}`
    : '目标闪避成功，未造成伤害'
  const roll: DiceRoll | undefined = resolved.hit
    ? {
        values: resolved.damageValues,
        sides: skill.damageSides,
        bonus: resolved.total - resolved.diceTotal,
        total: resolved.total,
        label: `${skill.name} · headless DM`,
        formula,
        targetName: targetToken.label,
      }
    : undefined
  const dodgeText = dodgeEvent
    ? `，${targetToken.label} 闪避判定 ${dodgeEvent.d20Value}+${dodgeEvent.attackBonus}=${dodgeEvent.total} vs AC ${dodgeEvent.targetAc}，${
        dodgeEvent.dodged ? '成功' : '失败'
      }`
    : ''

  return {
    ok: true,
    resolved,
    formula,
    roll,
    apLog: {
      amount: resolved.waivedAp ? 0 : resolved.apCost,
      action: `使用 ${skill.name}`,
      detail: `目标 ${targetToken.label}`,
    },
    combatLog: {
      text: `${actor.name} 使用 ${skill.name} → ${targetToken.label}${dodgeText}，${
        resolved.hit ? `伤害 ${formula}` : formula
      }`,
      kind: resolved.hit ? 'damage' : 'attack',
    },
  }
}

export interface ArrowSequenceDisplayPlan {
  resolvedEvents: HeadlessEventOf<'attack-resolved'>[]
  roll?: DiceRoll
  combatLog: {
    text: string
    kind: 'attack' | 'damage'
  }
}

export function planArrowSequenceDisplay(input: {
  actor: Character
  skill: CombatSkill
  targets: Token[]
  events: HeadlessCombatEvent[]
  targetLabelById?: (tokenId: string) => string
}): ArrowSequenceDisplayPlan {
  const { actor, skill, targets, events, targetLabelById } = input
  const resolvedEvents = attackResolvedEvents(events)
  const damageValues = resolvedEvents.flatMap((event) => event.damageValues)
  const total = resolvedEvents.reduce((sum, event) => sum + event.total, 0)
  const diceTotal = damageValues.reduce((sum, value) => sum + value, 0)
  const roll: DiceRoll | undefined =
    damageValues.length > 0
      ? {
          values: damageValues,
          sides: skill.damageSides,
          bonus: total - diceTotal,
          total,
          label: `${skill.name} · ${resolvedEvents.length} 段`,
          formula: resolvedEvents
            .map((event, index) =>
              event.hit
                ? `第 ${index + 1} 段 ${event.damageValues.join(' + ')}，攻防修正${
                    event.modifier >= 0 ? '+' : ''
                  }${event.modifier}，最终 ${event.total}`
                : `第 ${index + 1} 段被闪避`,
            )
            .join('；'),
          targetName: targets[0]?.label ?? skill.name,
        }
      : undefined

  return {
    resolvedEvents,
    roll,
    combatLog: {
      text: `${actor.name} 使用 ${skill.name}：${resolvedEvents
        .map((event, index) =>
          event.hit
            ? `第 ${index + 1} 段→${targetLabelById?.(event.targetTokenId) ?? event.targetTokenId} ${event.total} 点`
            : `第 ${index + 1} 段被闪避`,
        )
        .join('；')}。`,
      kind: total > 0 ? 'damage' : 'attack',
    },
  }
}

export interface AoeAttackDisplayPlan {
  resolvedEvents: HeadlessEventOf<'aoe-target-resolved'>[]
  roll: DiceRoll
  combatLog: {
    text: string
    kind: 'attack' | 'damage'
  }
}

export function planAoeAttackDisplay(input: {
  actor: Character
  skill: CombatSkill
  diceValues: number[]
  cellCount: number
  targetCount: number
  events: HeadlessCombatEvent[]
  targetLabelById?: (tokenId: string) => string
}): AoeAttackDisplayPlan {
  const { actor, skill, diceValues, cellCount, targetCount, events, targetLabelById } = input
  const resolvedEvents = aoeTargetResolvedEvents(events)
  const total = resolvedEvents.reduce((sum, event) => sum + event.total, 0)
  const diceTotal = diceValues.reduce((sum, value) => sum + value, 0)
  const roll: DiceRoll = {
    values: diceValues,
    sides: skill.damageSides,
    bonus: total - diceTotal,
    total,
    label: `${skill.name} · 覆盖 ${cellCount} 格`,
    formula: `${diceValues.join(' + ')}${skill.damageBonus ? ` + ${skill.damageBonus}` : ''}`,
    targetName: resolvedEvents
      .map((event) => `${targetLabelById?.(event.targetTokenId) ?? event.targetTokenId} ${event.total}`)
      .join('，'),
  }

  return {
    resolvedEvents,
    roll,
    combatLog: {
      text: `${actor.name} 结算 ${skill.name}：覆盖 ${cellCount} 格，${targetCount} 名目标在范围内。${resolvedEvents
        .map((event) => {
          const label = targetLabelById?.(event.targetTokenId) ?? event.targetTokenId
          const saveText =
            event.saveD20 != null
              ? `，敏捷豁免 ${event.saveD20}+${event.saveMod} vs DC${event.saveDc} ${
                  event.saveSuccess ? '成功半伤' : '失败全伤'
                }`
              : ''
          return `${label} ${event.total} 点${saveText}`
        })
        .join('；')}`,
      kind: total > 0 ? 'damage' : 'attack',
    },
  }
}

function expandRepeatedAttackTargets(skill: CombatSkill, targets: Token[]): Token[] {
  if ((skill.skillTreeId === 'multiShot' || skill.skillTreeId === 'encircle') && targets.length === 1) {
    const shots = Math.max(1, skill.arrowShots ?? 1)
    return Array.from({ length: shots }, () => targets[0])
  }
  return targets
}
