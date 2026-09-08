import type { Dnd5ePluginFeatureAction } from '../pluginApi'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import {
  dnd5eActivityHeadlessCompatibility,
  dnd5eActivityManualAdjudicationOperationsV1,
} from './dnd5eActivityHeadlessCompiler'
import { dnd5eActivityMapTemplateV1 } from './dnd5eActivityMapInteraction'

/**
 * Projects an executable Unified Activity into the thin feature-action shape
 * consumed by map controls. The Activity remains the single source of truth;
 * this adapter only exposes activation and targeting metadata to the UI.
 */
export function dnd5ePluginFeatureActionFromActivityV1(
  activity: Dnd5eActivityDefinitionV1,
): Dnd5ePluginFeatureAction | undefined {
  if ((activity.consumption ?? []).some((consumption) =>
    !['action-economy', 'resource', 'spell-slot', 'movement'].includes(consumption.kind))) {
    return undefined
  }
  if (!dnd5eActivityHeadlessCompatibility(activity, {
    outerSpellTransaction: (activity.consumption ?? []).some((entry) => entry.kind === 'spell-slot'),
  }).supported) return undefined

  const economy = activity.activation.kind === 'action'
    ? 'action' as const
    : activity.activation.kind === 'bonus-action'
      ? 'bonusAction' as const
      : activity.activation.kind === 'reaction'
        ? 'reaction' as const
      : activity.activation.kind === 'free'
          ? 'none' as const
          : activity.activation.kind === 'movement'
            ? 'none' as const
          : undefined
  if (!economy) return undefined

  const targeting = activity.target.kind === 'self'
    ? { kind: 'self' as const }
    : activity.target.kind === 'creature'
      ? activity.target.count === 1
        ? {
            kind: 'single-creature' as const,
            relation: activity.target.relation,
            rangeFeet: activity.target.rangeFeet,
            includeSelf: activity.target.includeSelf,
          }
        : {
            kind: 'multiple-creatures' as const,
            relation: activity.target.relation,
            rangeFeet: activity.target.rangeFeet,
            maximumTargets: activity.target.count,
            includeSelf: activity.target.includeSelf,
          }
      : (() => {
          const template = dnd5eActivityMapTemplateV1(activity)
          return template
            ? {
                kind: 'area' as const,
                relation: activity.target.relation,
                includeSelf: activity.target.includeSelf,
                maximumTargets: activity.target.maximumTargets,
                template,
              }
            : undefined
        })()
  if (!targeting) return undefined

  const manualOperations = dnd5eActivityManualAdjudicationOperationsV1(activity)
  const oncePerTurnKeys = (activity.requirements ?? []).flatMap((requirement) =>
    requirement.kind === 'once-per-turn' ? [requirement.key] : [])
  return {
    id: activity.id,
    label: activity.name,
    description: activity.description,
    economy,
    targeting,
    ...(oncePerTurnKeys.length > 0 ? { oncePerTurnKeys } : {}),
    ...(manualOperations.length > 0 ? {
      interrupt: {
        prompt: manualOperations.map((operation) => operation.prompt).join('\n\n'),
        audience: 'dm' as const,
        options: [
          { id: 'dm-apply', label: '批准并继续结算' },
          { id: 'dm-cancel', label: '取消本次事务' },
        ],
        defaultOptionId: 'dm-cancel',
        cancelOptionId: 'dm-cancel',
      },
    } : {}),
  }
}
