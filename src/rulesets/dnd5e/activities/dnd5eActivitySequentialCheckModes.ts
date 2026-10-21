import type { Dnd5eCombatant, Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import { dnd5eNextD20AdvantageApplies, type Dnd5eNextD20RollKind } from '../nextD20Advantage'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5eActivityCheckResult, Dnd5eActivityExecutionInput } from './dnd5eActivityExecutor'
import { dnd5eActivityHostSavingThrowModeV1 } from './dnd5eActivityPerTargetRolls'
import { dnd5eActivityHostActorCheckModeV1 } from './dnd5eActivityHostActorCheckMode'
import { dnd5eOpposedHostRollModes } from './dnd5eActivityOpposedChecks'

function priorRollKind(check: Dnd5eActivityCheckResult, actorId: string, ownerId: string): Dnd5eNextD20RollKind | undefined {
  if (check.automaticOutcome) return undefined
  if (check.kind === 'saving-throw') return check.targetId === ownerId ? 'saving-throw' : undefined
  if (check.kind === 'opposed-ability-check') {
    return actorId === ownerId || check.targetId === ownerId ? 'ability-check' : undefined
  }
  if (actorId !== ownerId) return undefined
  if (check.kind === 'concentration-check') return 'saving-throw'
  if (check.kind === 'attack-roll') return 'attack'
  if (check.kind === 'ability-check' || check.kind === 'skill-check') return 'ability-check'
  return undefined
}

/** Pure projection: preparation never consumes live Host state, including on a later failed check. */
export function dnd5eActivitySequentialCheckModesV1(input: {
  activity: Dnd5eActivityDefinitionV1
  state?: Dnd5eHeadlessCombatState
  grantingAreaId?: string
  actor: Dnd5eCombatant
  combatants: Readonly<Record<string, Dnd5eCombatant>>
  sourceDistanceFeet: (targetId: string) => number | undefined
}): NonNullable<Dnd5eActivityExecutionInput['resolveSequentialCheckRollModes']> {
  return (check, targetSnapshot, priorChecks) => {
    const project = (owner: Dnd5eCombatant) => {
      const spentKinds = priorChecks.flatMap(prior => {
        const kind = priorRollKind(prior, input.actor.id, owner.id)
        return kind != null && dnd5eNextD20AdvantageApplies(owner, kind) ? [kind] : []
      })
      return spentKinds.length ? { ...owner, classState: { ...owner.classState,
        nextD20Advantage: owner.classState.nextD20Advantage?.rollKinds.some(kind => spentKinds.includes(kind)) ? undefined : owner.classState.nextD20Advantage,
        activeEffects: owner.classState.activeEffects?.filter(effect => effect.suspendedBy?.length ||
          !effect.modifiers?.nextD20AdvantageRollKinds?.some(kind => spentKinds.includes(kind))),
      } } : owner
    }
    const projectedActor = project(input.actor)
    const actor = priorChecks.some(prior => prior.kind === 'concentration-check')
      ? { ...projectedActor, classState: { ...projectedActor.classState, concentrationCheckDisadvantagePendingSourceId: undefined } }
      : projectedActor
    const target = targetSnapshot ? input.combatants[targetSnapshot.id] : undefined
    const key = check.scope === 'per-target' ? `${check.id}:${targetSnapshot?.id}` : check.id
    if (check.kind === 'opposed-ability-check' && target) {
      const modes = dnd5eOpposedHostRollModes(check, actor, project(target))
      return { [`${key}:source`]: modes.source, [`${key}:source-final`]: modes.source,
        [`${key}:target`]: modes.target, [`${key}:target-final`]: modes.target }
    }
    if (check.kind === 'ability-check' || check.kind === 'skill-check' || check.kind === 'concentration-check') {
      return check.rollMode === 'host-derived' ? { [key]: dnd5eActivityHostActorCheckModeV1(actor, check) } : {}
    }
    if (check.kind !== 'saving-throw' || check.rollMode !== 'host-derived' || !target) return {}
    return { [key]: dnd5eActivityHostSavingThrowModeV1({
      state: input.state, grantingAreaId: input.grantingAreaId,
      activity: input.activity, actor, target: project(target), check,
      sourceDistanceFeet: input.sourceDistanceFeet(target.id),
    }) }
  }
}
