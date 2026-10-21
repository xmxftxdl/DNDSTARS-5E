import type { Character } from '../../types/character'
import type { Dnd5eCombatActionFeatureSource } from '../../lib/dnd5eCombatActionDescriptors'
import { dnd5eSpellActionIcon } from '../../lib/dnd5eActionIcons'
import { dnd5eIndependentSpellRulesForCharacter, DND5E_RACIAL_RESOURCE_KEYS } from '../../rulesets/dnd5e/racialAutomation'
import { dnd5eSpellbookEntryCastingTime, dnd5eSpellbookEntryDescription } from '../../rulesets/dnd5e/adjudicatedSpellAction'
import { dnd5eSpellbookEntryHasFullHeadlessAutomation, dnd5eSpellbookEntryCanUseStructuredCastRoute, type Dnd5eSpellbookEntry } from '../../rulesets/dnd5e/spellbook'
import { dnd5eSpellUsesNarrativeResolution } from '../../rulesets/dnd5e/spellNarrativeResolution'

/** Independent grants use their own fixed level and resource, never a class slot picker. */
export function independentSpellHotbarSources(input: {
  character: Character
  entries: ReadonlyMap<string, Dnd5eSpellbookEntry>
  exploration: boolean
  triggeredReactionSpellIds: readonly string[]
}): Dnd5eCombatActionFeatureSource[] {
  return dnd5eIndependentSpellRulesForCharacter(input.character).innateSpells.map(grant => {
    const entry = input.entries.get(grant.spellId)
    const castingTime = entry ? dnd5eSpellbookEntryCastingTime(entry) : 'unsupported'
    const economy = castingTime === 'action' || castingTime === 'bonus-action' || castingTime === 'reaction' ? castingTime : 'special'
    const unlimited = grant.resetOn === 'at-will'
    const remaining = input.character.classResources?.[DND5E_RACIAL_RESOURCE_KEYS.innateSpell(grant.spellId)]?.current ?? 0
    const structured = entry != null && (dnd5eSpellbookEntryHasFullHeadlessAutomation(entry) || dnd5eSpellbookEntryCanUseStructuredCastRoute(entry)) && !dnd5eSpellUsesNarrativeResolution(entry.id)
    const timingAllowed = castingTime === 'reaction' ? input.triggeredReactionSpellIds.includes(grant.spellId) : castingTime !== 'unsupported' || input.exploration
    return {
      id: `independent-spell:${grant.spellId}`,
      label: `${entry?.name ?? grant.spellId} · 独立施法`,
      description: `${entry ? dnd5eSpellbookEntryDescription(entry) : '法术资料尚未安装。'}\n以${({str:'力量',dex:'敏捷',con:'体质',int:'智力',wis:'感知',cha:'魅力'})[grant.ability]}施法；${unlimited ? '不限次数' : grant.resetOn === 'long-rest' ? '长休恢复一次' : '短休恢复一次'}，不消耗职业法术位。`,
      icon: dnd5eSpellActionIcon({id:grant.spellId,name:entry?.name??grant.spellId,level:entry?.level??grant.castAtLevel}),
      economy,
      targeting: 'configure',
      resource: unlimited ? undefined : {label:'免费',current:remaining,maximum:1},
      available: structured && timingAllowed && (unlimited || remaining > 0),
      unavailableReason: !structured ? '该法术资料缺失，或尚未接入独立施法的自动结算。' : !timingAllowed ? '当前没有对应的施法时机。' : '免费施法次数已耗尽。',
      command: {kind:'cast-independent-spell',spellId:grant.spellId,slotLevel:grant.castAtLevel},
    }
  })
}

