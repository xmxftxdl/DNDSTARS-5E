import type { Character } from '../types/character'
import type { LegacyCharacterSave } from '../types/legacyCharacter'
import { migrateDnd5eCombatStateEffects } from '../rulesets/dnd5e/legacyActiveEffectMigration'

const RETIRED_CHARACTER_KEYS = [
  'actionPoints',
  'currentAP',
  'mana',
  'maxMana',
  'traits',
  'combatSkills',
  'heroicInspiration',
  'archerLv1ChoiceDone',
  'archerLv3ChoiceDone',
  'traitChoicesDone',
  'combatBuffs',
  'featureUpgradePoints',
  'skillRanks',
  'qi',
  'bulletPuzzle',
] as const

export function migrateLegacyCharacterFields(input: LegacyCharacterSave): Partial<Character> {
  const migratedEffects = migrateDnd5eCombatStateEffects({
    targetId: input.id ?? 'legacy-character',
    state: input.dnd5eCombatState,
    conditions: input.conditions,
  })
  const core = { ...input } as Record<string, unknown>
  for (const key of RETIRED_CHARACTER_KEYS) delete core[key]
  const legacyState = input.dnd5eCombatState
  if (legacyState) {
    const { timedEffects: _timedEffects, ...nativeState } = legacyState
    void _timedEffects
    core.dnd5eCombatState = {
      ...nativeState,
      schemaVersion: migratedEffects.schemaVersion,
      activeEffects: migratedEffects.activeEffects,
    }
  }
  core.rulesetId = 'dnd5e-2014-srd-5.1'
  core.inspiration = input.inspiration ?? (input.heroicInspiration ? 1 : 0)
  core.conditions = migratedEffects.conditions
  return core as Partial<Character>
}
