import type {
  Dnd5ePluginDiceRollDeclaration,
  Dnd5ePluginDiceRollResult,
} from '../pluginApi'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

interface ControlledActivityActor {
  id: string
  controller?: string
  conditions?: readonly string[]
  /** Effective sources supplied by the Host snapshot, not action payload. */
  charmedByActorIds?: readonly string[]
}

/**
 * A willing same-controller target does not physically roll the saving throw
 * for Activities that explicitly declare automaticFailureIfAllied. The
 * deterministic 1 values are only an executor receipt; no dice overlay is
 * shown and the executor records `allied-unresisted-failure` as the outcome.
 */
export function planDnd5eAutomaticAlliedSavingThrowRolls(input: {
  activity: Dnd5eActivityDefinitionV1
  willingTargetIds?: readonly string[]
  actor: ControlledActivityActor
  targets: readonly ControlledActivityActor[]
  declarations: readonly Dnd5ePluginDiceRollDeclaration[]
}): {
  declarations: Dnd5ePluginDiceRollDeclaration[]
  automaticRolls: Record<string, Dnd5ePluginDiceRollResult>
} {
  const automaticIds = new Set(input.activity.checks?.flatMap((check) => {
    if (
      check.kind !== 'saving-throw' ||
      check.scope !== 'per-target' ||
      (check.automaticFailureIfAllied !== true && check.allowWillingFailure !== true && check.automaticFailureIfCharmedByActor !== true)
    ) return []
    return input.targets.flatMap((target) =>
      (check.automaticFailureIfCharmedByActor && target.conditions?.includes('charmed') && target.charmedByActorIds?.includes(input.actor.id)) ||
      (check.allowWillingFailure && input.willingTargetIds?.includes(target.id)) || (check.automaticFailureIfAllied && (target.id === input.actor.id || target.controller === input.actor.controller))
        ? [`${check.rollId}:${target.id}`]
        : [])
  }) ?? [])
  const automaticRolls: Record<string, Dnd5ePluginDiceRollResult> = {}
  for (const declaration of input.declarations) {
    if (!automaticIds.has(declaration.id)) continue
    const values = Array.from({ length: declaration.count }, () => 1)
    const modifier = declaration.modifier ?? 0
    automaticRolls[declaration.id] = {
      values,
      modifier,
      total: values.reduce((sum, value) => sum + value, modifier),
    }
  }
  return {
    declarations: input.declarations.filter((declaration) => !automaticIds.has(declaration.id)),
    automaticRolls,
  }
}
