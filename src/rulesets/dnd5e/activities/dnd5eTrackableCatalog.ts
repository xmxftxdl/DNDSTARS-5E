import { listRegisteredContentDefinitionPackages } from '../../../domain/content/contentDefinitionRegistry'
import { ABILITIES, SKILLS } from '../../../lib/dnd'
import { DND5E_SRD_CLASS_DEFINITIONS } from '../classes'
import { DND5E_SRD_FEATS } from '../feats'
import { fighterProgression } from '../fighter'
import { DND5E_SRD_ITEM_TEMPLATES } from '../items'
import { DND5E_SRD_MONSTERS } from '../monsters'
import { DND5E_SRD_SPELL_CATALOG } from '../spellCatalog'
import {
  DND5E_TRACKABLE_DEFINITION_SCHEMA_VERSION,
  dnd5eTrackableDefinitionIdV1,
  type Dnd5eTrackableDefinitionKindV1,
  type Dnd5eTrackableDefinitionV1,
} from './dnd5eActivityIdentity'
import { listRegisteredDnd5eActivityPackages } from './dnd5eActivityRegistry'

const CORE_ACTIONS: readonly { kind: Dnd5eTrackableDefinitionKindV1; id: string; name: string }[] = [
  { kind: 'action', id: 'attack', name: '攻击动作' },
  { kind: 'attack', id: 'attack', name: '通用攻击' },
  { kind: 'attack', id: 'unarmed', name: '徒手攻击' },
  { kind: 'attack', id: 'opportunity-attack', name: '借机攻击' },
  { kind: 'movement', id: 'move', name: '移动' },
  { kind: 'movement', id: 'move-persistent-area', name: '移动持续区域' },
  { kind: 'action', id: 'dash', name: '疾走' },
  { kind: 'action', id: 'disengage', name: '撤离' },
  { kind: 'action', id: 'dodge', name: '闪避' },
  { kind: 'action', id: 'help', name: '协助' },
  { kind: 'action', id: 'hide', name: '躲藏' },
  { kind: 'action', id: 'ready', name: '准备' },
  { kind: 'action', id: 'search', name: '搜索' },
  { kind: 'action', id: 'use-object', name: '使用物件' },
  { kind: 'action', id: 'grapple', name: '擒抱' },
  { kind: 'action', id: 'shove', name: '推撞' },
  { kind: 'action', id: 'escape-grapple', name: '挣脱擒抱' },
  { kind: 'action', id: 'interact-object', name: '物件互动' },
  { kind: 'action', id: 'end-turn', name: '结束回合' },
  { kind: 'action', id: 'begin-turn', name: '开始回合' },
  { kind: 'rest', id: 'short-rest', name: '短休' },
  { kind: 'rest', id: 'long-rest', name: '长休' },
]

function definition(input: {
  namespace: string
  kind: Dnd5eTrackableDefinitionKindV1
  localId: string
  name: string
  legacyIds?: readonly string[]
  source: Dnd5eTrackableDefinitionV1['source']
}): Dnd5eTrackableDefinitionV1 {
  return {
    schemaVersion: DND5E_TRACKABLE_DEFINITION_SCHEMA_VERSION,
    definitionId: dnd5eTrackableDefinitionIdV1(input),
    namespace: input.namespace,
    kind: input.kind,
    localId: input.localId,
    name: input.name,
    legacyIds: input.legacyIds,
    source: input.source,
  }
}

function builtinDefinitions(): Dnd5eTrackableDefinitionV1[] {
  const values: Dnd5eTrackableDefinitionV1[] = [
    ...CORE_ACTIONS.map((entry) => definition({
      namespace: 'core', kind: entry.kind, localId: entry.id, name: entry.name, source: 'core',
      legacyIds: [entry.id, `basic-action:${entry.id}`],
    })),
    ...DND5E_SRD_SPELL_CATALOG.map((spell) => definition({
      namespace: 'srd-5.1', kind: 'spell', localId: spell.id, name: spell.name, source: 'srd-5.1',
      legacyIds: [spell.id],
    })),
    ...DND5E_SRD_ITEM_TEMPLATES.map((item) => definition({
      namespace: 'srd-5.1', kind: 'item', localId: item.id, name: item.name, source: 'srd-5.1',
      legacyIds: [item.id],
    })),
    ...DND5E_SRD_ITEM_TEMPLATES.flatMap((item) => item.equipment?.dnd5e?.kind === 'weapon'
      ? [definition({
          namespace: 'srd-5.1', kind: 'attack', localId: item.equipment.id,
          name: `${item.name}攻击`, source: 'srd-5.1', legacyIds: [item.id, item.equipment.id],
        })]
      : []),
    ...SKILLS.map((skill) => definition({
      namespace: 'core', kind: 'skill', localId: skill.key, name: `${skill.label}检定`, source: 'core',
      legacyIds: [skill.key],
    })),
    ...ABILITIES.flatMap((ability) => [
      definition({
        namespace: 'core', kind: 'ability-check', localId: ability.key,
        name: `${ability.label}检定`, source: 'core', legacyIds: [ability.key],
      }),
      definition({
        namespace: 'core', kind: 'saving-throw', localId: ability.key,
        name: `${ability.label}豁免`, source: 'core', legacyIds: [ability.key],
      }),
    ]),
    ...DND5E_SRD_FEATS.map((feat) => definition({
      namespace: 'srd-5.1', kind: 'feat', localId: feat.id, name: feat.name, source: 'srd-5.1',
      legacyIds: [feat.id],
    })),
    ...DND5E_SRD_MONSTERS.flatMap((monster) => [
      ...monster.actions,
      ...(monster.bonusActions ?? []),
      ...(monster.reactions ?? []),
      ...(monster.legendaryActions ?? []),
      ...(monster.lairActions ?? []),
    ].map((action) => definition({
      namespace: 'srd-5.1',
      kind: 'monster-action',
      localId: `${monster.id}.${action.id}`,
      name: `${monster.name} · ${action.name}`,
      source: 'srd-5.1',
      legacyIds: [action.id],
    }))),
  ]
  for (const classDefinition of DND5E_SRD_CLASS_DEFINITIONS) {
    for (const feature of [...classDefinition.features, ...classDefinition.subclass.features]) {
      values.push(definition({
        namespace: 'srd-5.1', kind: 'feature', localId: `${classDefinition.id}.${feature.id}`,
        name: `${classDefinition.name} · ${feature.name}`, source: 'srd-5.1', legacyIds: [feature.id],
      }))
    }
  }
  for (const progression of fighterProgression('champion')) {
    for (const feature of progression.features) {
      values.push(definition({
        namespace: 'srd-5.1', kind: 'feature', localId: `fighter.${feature.id}`,
        name: `战士 · ${feature.name}`, source: 'srd-5.1', legacyIds: [feature.id],
      }))
    }
  }
  return values
}

function contentDefinitions(): Dnd5eTrackableDefinitionV1[] {
  return listRegisteredContentDefinitionPackages().flatMap((pkg) => pkg.definitions.flatMap((entry) => {
    const supportedKind = entry.kind === 'spell' || entry.kind === 'feature' || entry.kind === 'feat' ||
      entry.kind === 'item' || entry.kind === 'monster-action'
      ? entry.kind
      : undefined
    const root = supportedKind ? [definition({
      namespace: entry.namespace,
      kind: supportedKind,
      localId: entry.id,
      name: entry.name,
      source: 'content-package',
      legacyIds: [entry.id],
    })] : []
    const activities = (entry.activities ?? []).flatMap((activity) => {
      if (!activity || typeof activity !== 'object' || Array.isArray(activity)) return []
      const record = activity as Record<string, unknown>
      if (typeof record.id !== 'string' || !record.id || typeof record.name !== 'string' || !record.name) return []
      return [definition({
        namespace: entry.namespace,
        kind: 'activity',
        localId: record.id,
        name: `${entry.name} · ${record.name}`,
        source: 'content-package',
        legacyIds: [record.id],
      })]
    })
    return [...root, ...activities]
  }))
}

function registeredActivities(): Dnd5eTrackableDefinitionV1[] {
  return listRegisteredDnd5eActivityPackages().flatMap((pkg) => pkg.activities.map((activity) => definition({
    namespace: pkg.packageId,
    kind: 'activity',
    localId: activity.id,
    name: activity.name,
    source: 'content-package',
    legacyIds: [activity.id],
  })))
}

/** Returns the current stable-id catalog used by authoring UIs and diagnostics. */
export function listDnd5eTrackableDefinitionsV1(): readonly Dnd5eTrackableDefinitionV1[] {
  const byId = new Map<string, Dnd5eTrackableDefinitionV1>()
  for (const entry of [...builtinDefinitions(), ...contentDefinitions(), ...registeredActivities()]) {
    if (!byId.has(entry.definitionId)) byId.set(entry.definitionId, entry)
  }
  return [...byId.values()].sort((left, right) =>
    left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name, 'zh-CN'))
}

export function getDnd5eTrackableDefinitionV1(definitionId: string): Dnd5eTrackableDefinitionV1 | undefined {
  return listDnd5eTrackableDefinitionsV1().find((entry) => entry.definitionId === definitionId)
}
