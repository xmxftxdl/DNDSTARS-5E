import type { Character } from '../../types/character'
import type { Dnd5eCombatActionFeatureSource } from '../../lib/dnd5eCombatActionDescriptors'
import { dnd5eSpellActionIcon } from '../../lib/dnd5eActionIcons'
import { dnd5eAlternateResourceSpellsForCharacter } from '../../rulesets/dnd5e/pluginApi'
import { dnd5eSpellbookEntryCastingTime, dnd5eAdjudicatedSpellElapsedCastingMinutes } from '../../rulesets/dnd5e/adjudicatedSpellAction'
import { dnd5eSpellbookEntryHasFullHeadlessAutomation, dnd5eSpellbookEntryCanUseStructuredCastRoute, type Dnd5eSpellbookEntry } from '../../rulesets/dnd5e/spellbook'
import { dnd5eSpellUsesNarrativeResolution } from '../../rulesets/dnd5e/spellNarrativeResolution'

export function alternateResourceSpellHotbarSources(input: {
  character: Character
  entries: ReadonlyMap<string, Dnd5eSpellbookEntry>
  exploration: boolean
  triggeredReactionSpellIds: readonly string[]
}): Dnd5eCombatActionFeatureSource[] {
  return dnd5eAlternateResourceSpellsForCharacter(input.character).flatMap(grant => {
    const entry = input.entries.get(grant.spellId)
    const time = entry ? dnd5eSpellbookEntryCastingTime(entry) : 'unsupported'
    const minutes = entry ? dnd5eAdjudicatedSpellElapsedCastingMinutes(entry, false) : 0
    const longCast = Number.isFinite(minutes) && minutes > 0
    const narrative = !!entry && entry.sourceKind === 'srd-core' && dnd5eSpellUsesNarrativeResolution(entry.id)
    const structured = !!entry && (dnd5eSpellbookEntryHasFullHeadlessAutomation(entry) || dnd5eSpellbookEntryCanUseStructuredCastRoute(entry)) && !dnd5eSpellUsesNarrativeResolution(entry.id)
    const timing = time === 'reaction' ? input.triggeredReactionSpellIds.includes(grant.spellId) : time !== 'unsupported' || (longCast && (structured || input.exploration))
    const pool = input.character.classResources?.[grant.resourceId]
    return grant.castLevelOptions.map<Dnd5eCombatActionFeatureSource>(option => ({
      id: `resource-spell:${grant.featureId}:${grant.grantId}:${option.slotLevel}`,
      label: `${entry?.name ?? grant.spellId} · ${option.slotLevel ? `${option.slotLevel}环` : '戏法'} · ${grant.featureName}`,
      description: `${grant.featureName}：消耗 ${option.resourceCost} 点资源，不消耗职业法术位。`,
      icon: dnd5eSpellActionIcon({ id: grant.spellId, name: entry?.name ?? grant.spellId, level: entry?.level ?? option.slotLevel }),
      economy: time === 'action' || time === 'bonus-action' || time === 'reaction' ? time : 'special',
      targeting: 'configure',
      resource: { label: `消耗 ${option.resourceCost}`, current: pool?.current ?? 0, maximum: pool?.max ?? 0 },
      available: (structured || narrative) && timing && !!pool && pool.current >= option.resourceCost,
      unavailableReason: !structured && !narrative ? '法术资料缺失或自动结算尚未就绪。' : !timing ? '当前没有对应的施法时机。' : '特性资源不足。',
      command: { kind: 'cast-resource-spell', spellId: grant.spellId, slotLevel: option.slotLevel, featureId: grant.featureId, grantId: grant.grantId },
    }))
  })
}
