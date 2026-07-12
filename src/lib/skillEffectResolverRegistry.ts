import type { AbilityKey } from './dnd'

export type AoeSaveMode = 'half' | 'none' | 'fail-half' | undefined

export interface AoeSkillEffectProfile {
  saveMode: AoeSaveMode
  knockbackOnFailedSave?: boolean
  stunOnFailedSave?: boolean
  selfCooldownReductionWhileCalm?: number
  takeoffBonusEligible?: boolean
  triggersGaleCombo?: boolean
  projectileKind?: 'focus'
  windTraceBonusEligible?: boolean
}

export interface SingleTargetSkillEffectProfile {
  requiredActorCondition?: string
  halveDamageOnRangeFeet?: { minExclusive: number; maxInclusive: number }
  effectSaveAbility?: AbilityKey
  effectSaveDisadvantage?: boolean
  stunOnFailedEffectSave?: boolean
  knockbackOnFailedEffectSave?: boolean
  restrainedOnFailedEffectSave?: boolean
  pullOnFailedEffectSave?: boolean
  pullCells?: number
  smallOrMediumOnly?: boolean
  grantBurstKickExtraD6OnHit?: number
  clearActorConditionOnHit?: string
  grantFreeMoveFeetOnHit?: number
  grantDisengageOnHit?: boolean
  grantWindKickTreatKnockbackOnHit?: boolean
  vulnerableOnHit?: boolean
  clearTargetStatusesOnHit?: boolean
  selfCooldownReductionPerClearedStatus?: boolean
  sequenceEffectSaveAbility?: AbilityKey
  allPacketsSameTargetStun?: { minRank: number; ability: AbilityKey }
  noMoveOnHit?: boolean
  noMoveTurns?: number
  consumesBurstKickStoredDamage?: boolean
  consumesWindKickKnockbackMarker?: boolean
  checksCurrentKnockback?: boolean
  bonusDamageWhenTargetKnockedD6?: number
  extraDamageD6?: number
  bonusDamageAgainstMagicState?: { count: number; sides: number }
  critFireDamage?: { count: number; sides: number; burnTurns: number }
  cooldownReductionAmount?: number
  offerPushTarget?: boolean
  selfCooldownReductionWhenTargetKnocked?: number
  suppressBaseStatusOnHit?: boolean
}

type AoeResolver = (rank: number) => AoeSkillEffectProfile
type SingleResolver = (rank: number) => SingleTargetSkillEffectProfile

const builtinAoeResolvers: Record<string, AoeResolver> = {
  focusShot: (rank) => ({ saveMode: 'fail-half', stunOnFailedSave: rank >= 4, projectileKind: 'focus' }),
  spiralBlade: () => ({ saveMode: 'none' }),
  windTraceShot: (rank) => ({
    saveMode: undefined,
    selfCooldownReductionWhileCalm: rank >= 4 ? 1 : undefined,
    windTraceBonusEligible: true,
  }),
  whirlwindKick: () => ({
    saveMode: 'half',
    knockbackOnFailedSave: true,
    takeoffBonusEligible: true,
    triggersGaleCombo: true,
  }),
}
const aoeResolvers = new Map<string, AoeResolver>(Object.entries(builtinAoeResolvers))

const builtinSingleResolvers: Record<string, SingleResolver> = {
  clusterShot: () => ({ halveDamageOnRangeFeet: { minExclusive: 10, maxInclusive: 20 } }),
  burstKick: (rank) => rank >= 3
    ? { effectSaveAbility: 'con', stunOnFailedEffectSave: true, consumesBurstKickStoredDamage: true }
    : { consumesBurstKickStoredDamage: true },
  rageShot: (rank) => rank >= 3
    ? {
        effectSaveAbility: 'str',
        sequenceEffectSaveAbility: 'str',
        restrainedOnFailedEffectSave: true,
        smallOrMediumOnly: true,
      }
    : { smallOrMediumOnly: true },
  encircle: () => ({
    allPacketsSameTargetStun: { minRank: 5, ability: 'con' },
    noMoveOnHit: true,
    noMoveTurns: 1,
  }),
  bindShot: (rank) => ({
    effectSaveAbility: 'str',
    restrainedOnFailedEffectSave: rank >= 4,
    pullOnFailedEffectSave: true,
    pullCells: 2,
    smallOrMediumOnly: true,
    grantBurstKickExtraD6OnHit: 1,
  }),
  eagleStrike: (rank) => ({
    effectSaveAbility: 'dex',
    effectSaveDisadvantage: rank >= 5,
    knockbackOnFailedEffectSave: true,
    checksCurrentKnockback: true,
    extraDamageD6: rank >= 2 ? 4 : 3,
    selfCooldownReductionWhenTargetKnocked: rank >= 4 ? 3 : 2,
  }),
  riseKick: (rank) => ({
    requiredActorCondition: '倒地',
    clearActorConditionOnHit: '倒地',
    grantFreeMoveFeetOnHit: rank >= 4 ? 10 : undefined,
  }),
  shadowStepShot: (rank) => ({
    grantFreeMoveFeetOnHit: rank >= 4 ? 15 : 10,
    grantDisengageOnHit: true,
  }),
  shadowDance: (rank) => ({
    grantFreeMoveFeetOnHit: 15,
    grantDisengageOnHit: true,
    grantWindKickTreatKnockbackOnHit: rank >= 3,
  }),
  antiMagicArrow: (rank) => ({
    vulnerableOnHit: rank >= 3,
    clearTargetStatusesOnHit: rank >= 4,
    selfCooldownReductionPerClearedStatus: rank >= 5,
    bonusDamageAgainstMagicState: { count: 2, sides: 6 },
  }),
  explosiveArrow: (rank) => ({
    suppressBaseStatusOnHit: true,
    critFireDamage: {
      count: rank >= 5 ? 4 : rank >= 2 ? 3 : 2,
      sides: 6,
      burnTurns: rank >= 4 ? 2 : 1,
    },
  }),
  refluxMagicArrow: () => ({ cooldownReductionAmount: 1 }),
  windKickCombo: (rank) => ({
    consumesWindKickKnockbackMarker: true,
    bonusDamageWhenTargetKnockedD6: 1,
    offerPushTarget: rank >= 3,
    selfCooldownReductionWhenTargetKnocked: rank >= 5 ? 1 : undefined,
  }),
}
const singleResolvers = new Map<string, SingleResolver>(Object.entries(builtinSingleResolvers))

export function registerSkillEffectResolver(input: {
  skillTreeId: string
  aoe?: AoeResolver
  singleTarget?: SingleResolver
}): () => void {
  if (input.aoe) aoeResolvers.set(input.skillTreeId, input.aoe)
  if (input.singleTarget) singleResolvers.set(input.skillTreeId, input.singleTarget)
  return () => {
    if (input.aoe && aoeResolvers.get(input.skillTreeId) === input.aoe) aoeResolvers.delete(input.skillTreeId)
    if (input.singleTarget && singleResolvers.get(input.skillTreeId) === input.singleTarget) {
      singleResolvers.delete(input.skillTreeId)
    }
  }
}

export function missingSkillActorCondition(
  skillTreeId: string | undefined,
  actorConditions: readonly string[],
): string | undefined {
  const required = resolveSingleTargetSkillEffects(skillTreeId, 1).requiredActorCondition
  return required && !actorConditions.includes(required) ? required : undefined
}

export function resolveAoeSkillEffects(skillTreeId: string | undefined, rank: number): AoeSkillEffectProfile {
  return skillTreeId ? (aoeResolvers.get(skillTreeId)?.(rank) ?? { saveMode: 'half' }) : { saveMode: 'half' }
}

export function resolveSingleTargetSkillEffects(
  skillTreeId: string | undefined,
  rank: number,
): SingleTargetSkillEffectProfile {
  return skillTreeId ? (singleResolvers.get(skillTreeId)?.(rank) ?? {}) : {}
}
