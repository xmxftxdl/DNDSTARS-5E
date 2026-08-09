import type { Dnd5eDamageType } from './damageTypes'
import type { Dnd5ePluginFeaturePassiveEffect } from './pluginFeaturePassiveEffectProtocol'

export interface Dnd5ePluginFeaturePassiveEffectSnapshot {
  featureId: string
  featureName: string
  effectId: string
  effect: Dnd5ePluginFeaturePassiveEffect
}

export interface Dnd5ePluginFeaturePassiveEffectApplication {
  featureId: string
  featureName: string
  effectId: string
  kind: 'damage-reduction'
  amount: number
}

export function dnd5ePluginFeaturePassiveEffectSnapshots(
  features: readonly {
    id: string
    name: string
    passiveEffects?: readonly Dnd5ePluginFeaturePassiveEffect[]
  }[],
): Dnd5ePluginFeaturePassiveEffectSnapshot[] | undefined {
  const snapshots = features.flatMap((feature) => (feature.passiveEffects ?? []).map((effect) => ({
    featureId: feature.id,
    featureName: feature.name,
    effectId: effect.id,
    effect: structuredClone(effect),
  })))
  return snapshots.length > 0 ? snapshots : undefined
}

export function resolveDnd5ePluginFeatureDamageReduction(input: {
  combatant: {
    currentHp: number
    maxHp: number
    pluginFeaturePassiveEffects?: readonly Dnd5ePluginFeaturePassiveEffectSnapshot[]
    classState: { declarativeUsedTurnKeys?: Record<string, string> }
  }
  amount: number
  damageTypes: readonly Dnd5eDamageType[]
  turnKey: string
}): {
  amount: number
  applications: Dnd5ePluginFeaturePassiveEffectApplication[]
} {
  const incomingAmount = Math.max(0, Math.floor(input.amount))
  let amount = incomingAmount
  const applications: Dnd5ePluginFeaturePassiveEffectApplication[] = []
  const snapshots = [...(input.combatant.pluginFeaturePassiveEffects ?? [])]
    .sort((left, right) => `${left.featureId}:${left.effectId}`.localeCompare(`${right.featureId}:${right.effectId}`))

  for (const snapshot of snapshots) {
    const effect = snapshot.effect
    if (amount <= 0 || effect.kind !== 'damage-reduction' || effect.trigger !== 'before-damage') continue
    if (
      effect.damageTypes?.length &&
      !effect.damageTypes.some((damageType) => input.damageTypes.includes(damageType))
    ) continue
    if (effect.minimumIncomingDamage != null && incomingAmount < effect.minimumIncomingDamage) continue
    if (
      effect.maximumCurrentHitPointPercent != null &&
      (
        input.combatant.maxHp <= 0 ||
        input.combatant.currentHp * 100 > input.combatant.maxHp * effect.maximumCurrentHitPointPercent
      )
    ) continue

    const ledgerKey = `plugin-passive:${snapshot.featureId}:${snapshot.effectId}`
    if (
      effect.oncePerTurn &&
      input.combatant.classState.declarativeUsedTurnKeys?.[ledgerKey] === input.turnKey
    ) continue

    const reduction = Math.min(amount, effect.amount)
    if (reduction <= 0) continue
    amount -= reduction
    if (effect.oncePerTurn) {
      input.combatant.classState.declarativeUsedTurnKeys = {
        ...input.combatant.classState.declarativeUsedTurnKeys,
        [ledgerKey]: input.turnKey,
      }
    }
    applications.push({
      featureId: snapshot.featureId,
      featureName: snapshot.featureName,
      effectId: snapshot.effectId,
      kind: 'damage-reduction',
      amount: reduction,
    })
  }

  return { amount, applications }
}
