import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

/** A timed spell invoked by an owned rest feature uses the rest casting gate,
 * rather than an active-effect charge. Shape checks remain with validation. */
export function dnd5eRestSpellSensorActivity(activity:Dnd5eActivityDefinitionV1):boolean {
  return !!activity.spellInvocation && activity.legacySource?.kind!==undefined &&
    ['feature','subclass-ability','class','subclass','feat'].includes(activity.legacySource.kind) &&
    (activity.activation?.kind==='minute'||activity.activation?.kind==='hour') &&
    activity.invocation?.kind==='triggered' &&
    ['short-rest-complete','long-rest-complete'].includes(activity.invocation.event)
}
