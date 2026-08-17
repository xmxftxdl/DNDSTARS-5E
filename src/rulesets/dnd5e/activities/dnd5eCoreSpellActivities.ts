import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import {
  getRegisteredContentDefinition,
  listRegisteredContentDefinitionPackages,
  type RegisteredContentDefinition,
} from '../../../domain/content/contentDefinitionRegistry'
import type { SkillAoeTargeting } from '../../../lib/skillTargeting'
import {
  DND5E_SRD_COMBAT_SPELLS,
  type Dnd5eSrdSpellDefinition,
} from '../spells'
import { dnd5eActivityWithDerivedAutomationV1 } from '../plugins/pluginMechanicsRegistry'
import type {
  Dnd5eActivityCheckV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityTargetV1,
} from './dnd5eActivityContracts'
import { registerDnd5eUnifiedContentPackageV1 } from './dnd5eUnifiedContentRegistry'

export const DND5E_CORE_SPELL_PACKAGE_ID = 'srd-5.1'
export const DND5E_CORE_SPELL_PACKAGE_VERSION = '1.0.0'

const FULL_AUTOMATION = automationCapabilityFromLegacyStatus('full')

function areaTarget(
  area: SkillAoeTargeting,
  maximumTargets: number,
  includeSelf: boolean,
): Dnd5eActivityTargetV1 {
  if (area.shape === 'circle') return {
    kind: 'area', relation: 'any', origin: area.origin, shape: 'circle',
    // Legacy zero-radius circles are point-placement effects. Activity V1 uses
    // a one-foot marker so the target remains spatial without claiming a cell-wide area.
    radiusFeet: Math.max(1, area.radiusFeet), minimumRadiusFeet: area.minimumRadiusFeet,
    placeRangeFeet: area.placeRangeFeet, maximumTargets, includeSelf,
  }
  if (area.shape === 'rect') return {
    kind: 'area', relation: 'any', origin: 'point', shape: 'rect',
    lengthFeet: area.heightFeet, widthFeet: area.widthFeet, heightFeet: 5,
    minimumLengthFeet: area.minimumHeightFeet, minimumWidthFeet: area.minimumWidthFeet,
    placeRangeFeet: area.placeRangeFeet, maximumTargets, includeSelf,
    rotatable: area.rotatable,
  }
  if (area.shape === 'line') return {
    kind: 'area', relation: 'any', origin: 'self', shape: 'line',
    lengthFeet: area.lengthFeet, widthFeet: area.widthFeet,
    minimumLengthFeet: area.minimumLengthFeet, minimumWidthFeet: area.minimumWidthFeet,
    placeRangeFeet: area.aimRangeFeet, maximumTargets, includeSelf,
  }
  return {
    kind: 'area', relation: 'any', origin: 'self', shape: 'cone',
    lengthFeet: area.lengthFeet, minimumLengthFeet: area.minimumLengthFeet,
    placeRangeFeet: area.aimRangeFeet, maximumTargets, includeSelf,
  }
}

function spellTarget(spell: Dnd5eSrdSpellDefinition): Dnd5eActivityTargetV1 {
  const maximumTargets = spell.maximumTargets ?? 256
  if (spell.area) return areaTarget(spell.area, maximumTargets, spell.areaIncludesSelf === true)
  if (spell.rangeFeet === 0) return { kind: 'self' }
  return {
    kind: 'creature',
    relation: spell.target === 'hostile' ? 'enemy' : spell.target === 'ally' ? 'ally' : 'any',
    rangeFeet: spell.rangeFeet,
    count: maximumTargets,
    includeSelf: spell.target !== 'hostile',
    requiresLineOfSight: spell.requiresVisibleTarget === true || spell.requiresVisibleTarget === 'primary',
  }
}

function spellChecks(spell: Dnd5eSrdSpellDefinition): readonly Dnd5eActivityCheckV1[] | undefined {
  if (spell.effect === 'spell-attack' || spell.sustainedAttack?.resolution === 'spell-attack') return [{
    id: 'spell-attack', kind: 'attack-roll', rollId: 'spell-attack-d20',
    attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } },
    rollMode: 'host-derived', delivery: spell.spellAttackMode, scope: 'per-target',
  }]
  const ability = spell.saveAbility ?? spell.unwillingSaveAbility
  if (!ability) return undefined
  return [{
    id: 'spell-save', kind: 'saving-throw', rollId: 'spell-save-d20', ability,
    dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
    rollMode: 'host-derived', scope: 'per-target',
  }]
}

function spellScaling(spell: Dnd5eSrdSpellDefinition): Dnd5eActivityDefinitionV1['scaling'] {
  if (spell.cantripScaling) return [{
    basis: 'custom-table',
    table: [{ level: 1, value: 1 }, { level: 5, value: 2 }, { level: 11, value: 3 }, { level: 17, value: 4 }],
    notes: 'Host spell transaction applies the canonical cantrip progression.',
  }]
  const hasSlotScaling = spell.dice.perHigherSlot != null || spell.fixedHealingPerHigherSlot != null ||
    spell.additionalTargetsPerHigherSlot != null || spell.additionalProjectilesPerHigherSlot != null ||
    spell.areaRadiusFeetPerHigherSlot != null || spell.additionalDamageComponents?.some((entry) => entry.dice.perHigherSlot != null)
  return hasSlotScaling ? [{
    basis: 'slot-level', baseLevel: spell.level,
    notes: 'Host spell transaction applies the structured higher-slot fields from the registered payload.',
  }] : undefined
}

/** Converts one built-in spell into the same Activity contract used by imported content. */
export function dnd5eCoreSpellActivityV1(spell: Dnd5eSrdSpellDefinition): Dnd5eActivityDefinitionV1 {
  const activation = spell.castingTime === 'bonus-action'
    ? { kind: 'bonus-action' as const, cost: 1 }
    : spell.castingTime === 'reaction'
      ? { kind: 'reaction' as const, cost: 1, reactionEvent: 'reaction-window' }
      : { kind: 'action' as const, cost: 1 }
  return dnd5eActivityWithDerivedAutomationV1({
    schemaVersion: 1,
    id: `spell:${spell.id}`,
    name: spell.name,
    description: spell.description,
    activation,
    invocation: spell.castingTime === 'reaction'
      ? { kind: 'triggered', event: 'reaction-window', confirmation: 'actor-choice', retention: 'single-event' }
      : { kind: 'active', confirmation: 'actor-choice' },
    target: spellTarget(spell),
    consumption: [
      ...(spell.level > 0 ? [{
        kind: 'spell-slot' as const, minimumLevel: spell.level, level: 'selected' as const,
        amount: 1 as const, consumeOn: 'resolve' as const,
      }] : []),
      {
        kind: 'action-economy' as const, economy: spell.castingTime,
        amount: 1 as const, consumeOn: 'resolve' as const,
      },
    ],
    checks: spellChecks(spell),
    outcomes: [{ id: 'host-settlement', when: { kind: 'always' }, operations: [] }],
    scaling: spellScaling(spell),
    automation: FULL_AUTOMATION,
    authorityBinding: {
      kind: 'core-spell-transaction', spellId: spell.id, execution: 'headless-event-engine',
    },
    legacySource: { kind: 'spell', id: spell.id },
  })
}

function coreSpellDefinitions(): readonly RegisteredContentDefinition[] {
  return DND5E_SRD_COMBAT_SPELLS.map((spell) => ({
    schemaVersion: 1,
    id: spell.id,
    namespace: DND5E_CORE_SPELL_PACKAGE_ID,
    version: DND5E_CORE_SPELL_PACKAGE_VERSION,
    kind: 'spell',
    name: spell.name,
    description: spell.description,
    source: {
      packageId: DND5E_CORE_SPELL_PACKAGE_ID,
      packageVersion: DND5E_CORE_SPELL_PACKAGE_VERSION,
    },
    payload: structuredClone(spell),
    activities: [dnd5eCoreSpellActivityV1(spell)],
    automation: FULL_AUTOMATION,
  }))
}

/** Re-establishes the built-in package after test/HMR registry resets. */
export function ensureDnd5eCoreSpellActivitiesRegisteredV1(): void {
  if (getRegisteredContentDefinition(DND5E_CORE_SPELL_PACKAGE_ID, 'spell', DND5E_SRD_COMBAT_SPELLS[0]!.id)) return
  if (listRegisteredContentDefinitionPackages().some((entry) => entry.packageId === DND5E_CORE_SPELL_PACKAGE_ID)) {
    throw new Error('The SRD 5.1 Unified Content package is incomplete')
  }
  registerDnd5eUnifiedContentPackageV1({
    packageId: DND5E_CORE_SPELL_PACKAGE_ID,
    packageVersion: DND5E_CORE_SPELL_PACKAGE_VERSION,
    definitions: coreSpellDefinitions(),
  })
}

export function getDnd5eCoreSpellRuntimeDefinitionV1(spellId: string): {
  packageId: typeof DND5E_CORE_SPELL_PACKAGE_ID
  spell: Dnd5eSrdSpellDefinition
  activity: Dnd5eActivityDefinitionV1
} | undefined {
  ensureDnd5eCoreSpellActivitiesRegisteredV1()
  const definition = getRegisteredContentDefinition(DND5E_CORE_SPELL_PACKAGE_ID, 'spell', spellId)
  const activity = definition?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined
  const spell = definition?.payload as Dnd5eSrdSpellDefinition | undefined
  if (!definition || !spell || !activity || activity.authorityBinding?.kind !== 'core-spell-transaction' ||
    activity.authorityBinding.spellId !== spellId) return undefined
  return { packageId: DND5E_CORE_SPELL_PACKAGE_ID, spell, activity }
}
