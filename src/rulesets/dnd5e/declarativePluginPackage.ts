import {
  validateDnd5eCustomRulesPluginDraft,
  type Dnd5eCustomHeadlessActionDraft,
  type Dnd5eCustomRulesPluginDraft,
} from './customRulesPlugin'
import type {
  Dnd5ePluginHeadlessActionDefinition,
  Dnd5eRulesPlugin,
  Dnd5eRulesPluginApi,
} from './pluginApi'
import type { Dnd5eDeclarativeRulesPackageV1 } from './declarativeSubclassAbility'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5eActivityFromCustomHeadlessAction } from './activities/legacyCustomHeadlessActivityAdapter'
import {
  DND5E_SPELLCASTING_CLASS_IDS,
  type Dnd5eSpellcastingClassId,
} from './spellbook'

const supportedSpellcastingClassIds = new Set<string>(DND5E_SPELLCASTING_CLASS_IDS)

/**
 * Early room packages could preserve catalog-only class ids (most commonly
 * `artificer`) beside supported 2014 classes. The current spell registry is
 * intentionally stricter, but rejecting the entire legacy package also keeps
 * every unrelated room rule offline. Remove only unsupported ids when at
 * least one supported class remains; genuinely unusable spell declarations
 * still fail normal validation.
 */
function normalizeLegacySpellClassIds(
  draft: Dnd5eCustomRulesPluginDraft,
): Dnd5eCustomRulesPluginDraft {
  const spells = draft.spells.map((spell) => {
    const classes = (spell.classes as readonly string[]).filter(
      (classId): classId is Dnd5eSpellcastingClassId => supportedSpellcastingClassIds.has(classId),
    )
    return classes.length > 0 && classes.length !== spell.classes.length
      ? { ...spell, classes }
      : spell
  })
  return spells.some((spell, index) => spell !== draft.spells[index])
    ? { ...draft, spells }
    : draft
}

export function dnd5eHeadlessActionFromDeclarativeDraft(
  definition: Dnd5eCustomHeadlessActionDraft,
): Dnd5ePluginHeadlessActionDefinition {
  return compileDnd5eActivityHeadlessAction(dnd5eActivityFromCustomHeadlessAction(definition))
}

function registerLegacyContributions(api: Dnd5eRulesPluginApi, draft: Dnd5eCustomRulesPluginDraft): void {
  for (const action of draft.headlessActions ?? []) api.registerHeadlessAction(dnd5eHeadlessActionFromDeclarativeDraft(action))
  for (const race of draft.races) api.registerRace(race)
  for (const background of draft.backgrounds) api.registerBackground(background)
  for (const feature of draft.features) api.registerFeature(feature)
  for (const feat of draft.feats ?? []) api.registerFeat(feat)
  for (const spell of draft.spells) api.registerSpell(spell)
  for (const item of draft.items) api.registerItem(item)
  for (const method of draft.abilityGenerationMethods) api.registerAbilityGenerationMethod(method)
  for (const monster of draft.monsters ?? []) api.registerMonster(monster)
}

export function dnd5eRulesPluginFromDeclarativePackageV1(
  value: Dnd5eDeclarativeRulesPackageV1,
): Dnd5eRulesPlugin {
  const legacy = value.legacy == null
    ? undefined
    : normalizeLegacySpellClassIds(value.legacy as Dnd5eCustomRulesPluginDraft)
  const hasLegacy = !!legacy && (
    legacy.races.length + legacy.backgrounds.length + legacy.features.length + (legacy.feats?.length ?? 0) + legacy.spells.length +
    legacy.items.length + legacy.abilityGenerationMethods.length + (legacy.monsters?.length ?? 0) > 0
  )
  if (hasLegacy) {
    const errors = validateDnd5eCustomRulesPluginDraft({ ...legacy, subclasses: [] })
    if (errors.length > 0) throw new Error(errors.join('\n'))
  }
  return {
    manifest: { ...value.manifest },
    setup(api) {
      if (hasLegacy) registerLegacyContributions(api, legacy!)
      for (const definition of value.classes ?? []) api.registerDeclarativeClass(definition)
      for (const subclass of value.subclasses) api.registerDeclarativeSubclass(subclass)
    },
  }
}
