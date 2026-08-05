import type { MapGeometryPathTree } from '../../lib/mapPathfinding'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eActiveEffectInstance } from './activeEffects'
import type { MonsterDecisionCandidate } from './monsterDecisionContracts'
import type { Dnd5eMonsterStatBlock } from './monsters'
import type {
  Dnd5eMonsterTurnPlan,
  Dnd5eMonsterTurnPlannerOptions,
} from './monsterTurnPlan'

interface HitPointProjection {
  current: number
  maximum: number
}

export interface MonsterEscapeCandidateServices<TReconciliation> {
  activeEffects(
    target: Token,
    characters: readonly Character[],
  ): readonly Dnd5eActiveEffectInstance[]
  hitPoints(target: Token, characters: readonly Character[]): HitPointProjection
  linkedRootEffects(
    target: Token,
    characters: readonly Character[],
    reconciliation?: TReconciliation,
  ): readonly Dnd5eActiveEffectInstance[]
  successProbability(input: {
    enemy: Token
    monster: Dnd5eMonsterStatBlock
    source: Token
    characters: readonly Character[]
    effects: readonly Dnd5eActiveEffectInstance[]
    effect: Dnd5eActiveEffectInstance
    fixedDc: boolean
  }): number
}

export function createMonsterEscapeDecisionCandidates<TReconciliation>(input: {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  characters: readonly Character[]
  canUseAction: boolean
  reconciledActiveEffects?: TReconciliation
}, services: MonsterEscapeCandidateServices<TReconciliation>): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  if (!input.canUseAction) return []
  const effects = services.activeEffects(input.enemy, input.characters)
  const hp = services.hitPoints(input.enemy, input.characters)
  return services.linkedRootEffects(
    input.enemy,
    input.characters,
    input.reconciledActiveEffects,
  )
    .filter((effect) =>
      (
        effect.escapeCheck?.economy === 'action' ||
        (
          effect.source.rulesId === 'basic-action:grapple' &&
          effect.relation?.sourceActionId === 'basic-action:grapple'
        )
      ) &&
      input.map.tokens.some((candidate) =>
        candidate.id === effect.source.actorId &&
        services.hitPoints(candidate, input.characters).current > 0))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((effect) => {
      const source = input.map.tokens.find((candidate) => candidate.id === effect.source.actorId)!
      const fixedDc = effect.escapeCheck?.economy === 'action'
      const successProbability = services.successProbability({
        enemy: input.enemy,
        monster: input.monster,
        source,
        characters: input.characters,
        effects,
        effect,
        fixedDc,
      })
      const restrained = effects.some((candidate) =>
        candidate.standardCondition === 'restrained' &&
        candidate.dependsOnEffectId === effect.id)
      const escapeControlValue = restrained
        ? fixedDc ? 120 : 180
        : 45
      return {
        id: fixedDc
          ? `escape-active-effect:${effect.id}`
          : `escape-grapple:${effect.id}:${source.id}`,
        kind: 'control' as const,
        payload: {
          moved: false,
          attacked: false,
          attackerTokenId: input.enemy.id,
          targetTokenId: source.id,
          ...(fixedDc
            ? {
                escapeActiveEffect: {
                  effectId: effect.id,
                  dc: effect.escapeCheck!.dc,
                },
              }
            : { escapeGrapple: { grapplerId: source.id } }),
          message: `${input.enemy.label} 尝试挣脱 ${source.label} 的控制。`,
        },
        metrics: {
          expectedDamage: 0,
          targetCurrentHp: hp.current,
          targetMaximumHp: hp.maximum,
          hitProbability: successProbability,
          controlValue: successProbability * escapeControlValue,
          targetDistanceFeet: 0,
          preferredDistanceFeet: 0,
          movementFeet: 0,
          distanceImprovementFeet: 0,
          defensiveCoverBonus: 0,
          opportunityAttackRisk: 0,
          attacksThisTurn: false,
          consumesAction: true,
          dodges: false,
          dashes: false,
          usesNimbleEscape: false,
          usesPreciseCoverRoute: false,
        },
      }
    })
}

interface ReleaseTacticalCandidateInput<TReconciliation> {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  target: Token
  characters: readonly Character[]
  canUseBonusAction: boolean
  canUseAction: boolean
  combatId?: string
  round?: number
  preferredTargetId?: string
  simulationOptimization?: Dnd5eMonsterTurnPlannerOptions['simulationOptimization']
  exactRouteTrees?: Map<string, MapGeometryPathTree>
  reconciledActiveEffects: TReconciliation
}

export interface MonsterReleaseCandidateServices<TReconciliation> {
  linkedRootEffects(
    target: Token,
    characters: readonly Character[],
    reconciliation: TReconciliation,
  ): readonly Dnd5eActiveEffectInstance[]
  activeEffectsAfterRelease(
    reconciliation: TReconciliation,
    targetId: string,
    effectId: string,
  ): TReconciliation
  tacticalCandidates(
    input: ReleaseTacticalCandidateInput<TReconciliation>,
  ): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[]
}

export function createMonsterReleaseDecisionCandidates<TReconciliation>(input: {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  targets: readonly Token[]
  characters: readonly Character[]
  canUseBonusAction: boolean
  canUseAction: boolean
  combatId?: string
  round?: number
  preferredTargetId?: string
  simulationOptimization?: Dnd5eMonsterTurnPlannerOptions['simulationOptimization']
  exactRouteTrees?: Map<string, MapGeometryPathTree>
  reconciledActiveEffects?: TReconciliation
  currentTacticalCandidates: readonly MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[]
}, services: MonsterReleaseCandidateServices<TReconciliation>): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  const reconciled = input.reconciledActiveEffects
  if (!reconciled) return []
  const currentIds = new Set(input.currentTacticalCandidates.map((candidate) => candidate.id))
  const candidates = new Map<string, MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>>()

  for (const heldTarget of input.map.tokens) {
    const roots = services.linkedRootEffects(
      heldTarget,
      input.characters,
      reconciled,
    ).filter((effect) => effect.relation?.sourceActorId === input.enemy.id)
    for (const root of roots) {
      const releasedEffects = services.activeEffectsAfterRelease(
        reconciled,
        heldTarget.id,
        root.id,
      )
      const unlocked = input.targets.flatMap((target) => services.tacticalCandidates({
        map: input.map,
        enemy: input.enemy,
        monster: input.monster,
        target,
        characters: input.characters,
        canUseBonusAction: input.canUseBonusAction,
        canUseAction: input.canUseAction,
        combatId: input.combatId,
        round: input.round,
        preferredTargetId: input.preferredTargetId,
        simulationOptimization: input.simulationOptimization,
        exactRouteTrees: input.exactRouteTrees,
        reconciledActiveEffects: releasedEffects,
      }))
      for (const candidate of unlocked) {
        if (currentIds.has(candidate.id)) continue
        const id = `release-grapple:${heldTarget.id}:${root.id}:${candidate.id}`
        candidates.set(id, {
          ...candidate,
          id,
          payload: {
            ...candidate.payload,
            releaseGrapple: { targetId: heldTarget.id, effectId: root.id },
            message: `${input.enemy.label} 释放对 ${heldTarget.label} 的控制；${candidate.payload.message}`,
          },
        })
      }
    }
  }
  return [...candidates.values()]
}
