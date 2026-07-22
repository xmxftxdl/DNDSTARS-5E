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

function legacyHeadlessAction(definition: Dnd5eCustomHeadlessActionDraft): Dnd5ePluginHeadlessActionDefinition {
  return {
    id: definition.id,
    execution: 'trusted',
    rolls: definition.effects.flatMap((effect, index) => {
      if (effect.kind !== 'damage' && effect.kind !== 'healing') return []
      return [{
        id: `effect-${index}`,
        label: `${definition.label} · ${effect.kind === 'damage' ? '伤害' : '治疗'}`,
        count: effect.dice.count,
        sides: effect.dice.sides,
        modifier: effect.dice.modifier ?? 0,
        visibility: 'public' as const,
      }]
    }),
    resolve(context) {
      if (
        definition.requiredInterruptOptionId &&
        context.action.interruptChoiceId !== definition.requiredInterruptOptionId
      ) return context.fail('invalid-plugin-action')
      const targets = context.targets.length > 0
        ? context.targets
        : context.target
          ? [context.target]
          : [context.actor]
      if (targets.length < 1) return context.fail('invalid-target')
      for (const [index, effect] of definition.effects.entries()) {
        const roll = context.rolls[`effect-${index}`]
        if ((effect.kind === 'damage' || effect.kind === 'healing') && !roll) return context.fail('invalid-dice')
        for (const target of targets) {
          if (effect.kind === 'damage') context.dealDamage(target.id, roll.total, effect.damageType)
          else if (effect.kind === 'healing') context.heal(target.id, roll.total)
          else context.applyStandardCondition(target.id, effect.condition, effect.duration)
        }
      }
      return context.succeed()
    },
  }
}

function registerLegacyContributions(api: Dnd5eRulesPluginApi, draft: Dnd5eCustomRulesPluginDraft): void {
  for (const action of draft.headlessActions ?? []) api.registerHeadlessAction(legacyHeadlessAction(action))
  for (const race of draft.races) api.registerRace(race)
  for (const background of draft.backgrounds) api.registerBackground(background)
  for (const feature of draft.features) api.registerFeature(feature)
  for (const spell of draft.spells) api.registerSpell(spell)
  for (const item of draft.items) api.registerItem(item)
  for (const method of draft.abilityGenerationMethods) api.registerAbilityGenerationMethod(method)
}

export function dnd5eRulesPluginFromDeclarativePackageV1(
  value: Dnd5eDeclarativeRulesPackageV1,
): Dnd5eRulesPlugin {
  const legacy = value.legacy == null ? undefined : value.legacy as Dnd5eCustomRulesPluginDraft
  const hasLegacy = !!legacy && (
    legacy.races.length + legacy.backgrounds.length + legacy.features.length + legacy.spells.length +
    legacy.items.length + legacy.abilityGenerationMethods.length > 0
  )
  if (hasLegacy) {
    const errors = validateDnd5eCustomRulesPluginDraft({ ...legacy, subclasses: [] })
    if (errors.length > 0) throw new Error(errors.join('\n'))
  }
  return {
    manifest: { ...value.manifest },
    setup(api) {
      if (hasLegacy) registerLegacyContributions(api, legacy!)
      for (const subclass of value.subclasses) api.registerDeclarativeSubclass(subclass)
    },
  }
}
