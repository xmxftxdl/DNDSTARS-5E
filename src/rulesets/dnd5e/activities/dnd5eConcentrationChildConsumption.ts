import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

/** Removing a concentration child ends its spell; a replacement cannot still depend on that spell. */
export function dnd5eConcentrationChildConsumptionIssues(activities: readonly Dnd5eActivityDefinitionV1[]): string[] {
 const effects = activities.flatMap(activity => activity.effects ?? [])
 const issues: string[] = []
 for (const activity of activities) for (const outcome of activity.outcomes) {
  for (const operation of outcome.operations) {
   if (operation.kind !== 'remove-effect' || operation.target !== 'actor' || operation.source !== 'self') continue
   for (const removed of effects.filter(effect => effect.id === operation.effectId)) {
    const parent = removed.sourceLink?.sourceRequiresEffect
    if (!parent || !(removed.concentration || removed.duration.kind === 'concentration')) continue
    const dependent = outcome.operations.some(next => next.kind === 'apply-effect' && next.target === 'actor' &&
      activity.effects?.some(effect => effect.id === next.effectId && effect.sourceLink?.sourceRequiresEffect === parent))
    if (dependent) issues.push(`Activity ${activity.id} 消耗专注子效果 ${removed.id} 会结束主体 ${parent}，但同一结果又施加依赖该主体的效果。一次性授权应采用非专注持续时间并用 sourceLink 绑定主体；不要通过删除专注效果消耗授权。`)
   }
  }
 }
 return [...new Set(issues)]
}
