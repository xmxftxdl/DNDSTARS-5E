import type { Character, CharacterResourceState } from '../types/character'
import {
  classDefinitionForCharacter,
  mergeClassResourceDefinitions,
  type ClassResourceDefinition,
  type ClassResourceReset,
} from './classDefinitionRegistry'
import {
  dnd5ePluginClassResourceDefinitions,
  dnd5ePluginFeatResourceDefinitions,
} from '../rulesets/dnd5e/pluginApi'
import { dnd5eClassDefinition } from '../rulesets/dnd5e/classes'
import { dnd5eMulticlassPactSlots, dnd5eMulticlassSpellSlots, normalizeDnd5eClassLevels } from '../rulesets/dnd5e/multiclass'
import { dnd5eRacialResourceDefinitions } from '../rulesets/dnd5e/racialAutomation'
import { declarativeClassResourceDefinitionsV1 } from '../rulesets/dnd5e/declarativeClass'

function finiteNonNegative(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback
}

function clampResource(current: unknown, max: number): CharacterResourceState {
  const safeMax = finiteNonNegative(max, 0)
  return {
    current: Math.min(safeMax, finiteNonNegative(current, safeMax)),
    max: safeMax,
  }
}

function dnd5eClassViews(character: Character): Character[] {
  if (character.rulesetId !== 'dnd5e-2014-srd-5.1') return [character]
  const views = Object.entries(normalizeDnd5eClassLevels(character)).flatMap(([classId, level]) => {
    const definition = dnd5eClassDefinition(classId)
    return definition && level ? [{ ...character, charClass: definition.name, level }] : []
  })
  return views.length > 0 ? views : [character]
}

function registeredResourceDefinitions(character: Character): ClassResourceDefinition[] {
  const views = dnd5eClassViews(character)
  const definitions: ClassResourceDefinition[] = views.flatMap((view) => {
    const registered = classDefinitionForCharacter(view)?.resources
    const native = typeof registered === 'function' ? registered(view) : (registered ?? [])
    return [...native, ...dnd5ePluginClassResourceDefinitions(view), ...declarativeClassResourceDefinitionsV1(view)].map((definition) => ({
      ...definition,
      isAvailable: () => definition.isAvailable(view),
      max: () => definition.max(view),
      unlimited: definition.unlimited ? () => definition.unlimited!(view) : undefined,
    }))
  })
  if (character.rulesetId === 'dnd5e-2014-srd-5.1') {
    definitions.push(...dnd5ePluginFeatResourceDefinitions(character))
  }
  if (character.rulesetId !== 'dnd5e-2014-srd-5.1') return definitions

  const withoutSharedSlots = definitions.filter((definition) =>
    !definition.key.startsWith('dnd5e-spell-slot-') && definition.key !== 'dnd5e-pact-slot')
  const deduplicated = new Map(
    mergeClassResourceDefinitions(character, withoutSharedSlots)
      .map((definition) => [definition.key, definition]),
  )

  const slots = dnd5eMulticlassSpellSlots(character)
  slots.forEach((maximum, index) => {
    if (maximum < 1) return
    const spellLevel = index + 1
    deduplicated.set(`dnd5e-spell-slot-${spellLevel}`, {
      key: `dnd5e-spell-slot-${spellLevel}`,
      label: `${spellLevel}环法术位`,
      shortLabel: `${spellLevel}环`,
      isAvailable: () => true,
      max: () => maximum,
      resetOn: 'long-rest',
    })
  })
  const pact = dnd5eMulticlassPactSlots(character)
  if (pact) deduplicated.set('dnd5e-pact-slot', {
    key: 'dnd5e-pact-slot',
    label: `契约法术位（${pact.slotLevel}环）`,
    shortLabel: '契约位',
    isAvailable: () => true,
    max: () => pact.count,
    resetOn: 'short-rest',
  })
  for (const definition of dnd5eRacialResourceDefinitions(character)) {
    deduplicated.set(definition.key, definition)
  }
  return [...deduplicated.values()]
}

export function classResourceDefinitions(character: Character): readonly ClassResourceDefinition[] {
  return registeredResourceDefinitions(character).filter((resource) => resource.isAvailable(character))
}

export function classResourceDefinition(character: Character, key: string): ClassResourceDefinition | undefined {
  return classResourceDefinitions(character).find((resource) => resource.key === key)
}

const DND5E_LEGACY_RESOURCE_LABELS: Readonly<Record<string, string>> = {
  fighterSecondWind: '回气',
  fighterActionSurge: '动作如潮',
  fighterIndomitable: '不屈',
  'dnd5e-rage': '狂暴',
  'dnd5e-bardic-inspiration': '诗人激励',
  'dnd5e-channel-divinity': '引导神力',
  'dnd5e-divine-intervention': '神圣干预',
  'dnd5e-wild-shape': '荒野形态',
  'dnd5e-natural-recovery': '自然恢复',
  'dnd5e-ki': '气',
  'dnd5e-wholeness-of-body': '身心合一',
  'dnd5e-divine-sense': '神圣感知',
  'dnd5e-lay-on-hands': '圣疗池',
  'dnd5e-cleansing-touch': '净化之触',
  'dnd5e-holy-nimbus': '神圣光轮',
  'dnd5e-stroke-of-luck': '幸运一击',
  'dnd5e-sorcery-points': '术法点',
  'dnd5e-dark-ones-own-luck': '黑暗赐福',
  'dnd5e-hurl-through-hell': '坠入地狱',
  'dnd5e-eldritch-master': '魔能宗师',
  'dnd5e-arcane-recovery': '奥术回想',
  'dnd5e-signature-spell-1': '招牌法术一',
  'dnd5e-signature-spell-2': '招牌法术二',
  'dnd5e-pact-slot': '契约法术位',
}

/**
 * Present persisted resource keys as player-facing labels even when an older
 * character contains resources from a class that is no longer active.
 */
export function classResourceDisplayLabel(character: Character, key: string): string {
  const registered = classResourceDefinition(character, key)
  if (registered) return registered.label
  const spellSlot = /^dnd5e-spell-slot-([1-9])$/.exec(key)
  if (spellSlot) return `${spellSlot[1]}环法术位`
  const mysticArcanum = /^dnd5e-mystic-arcanum-([6-9])$/.exec(key)
  if (mysticArcanum) return `秘法奥秘（${mysticArcanum[1]}环）`
  return DND5E_LEGACY_RESOURCE_LABELS[key] ?? '自定义资源'
}

export function getClassResource(character: Character, key: string): CharacterResourceState | undefined {
  const definition = classResourceDefinition(character, key)
  if (!definition) return undefined
  const structured = character.classResources?.[key]
  return clampResource(structured?.current, definition.max(character))
}

export function getClassResourceCurrent(character: Character, key: string): number {
  return getClassResource(character, key)?.current ?? 0
}

function withClassResources(character: Character, resources: Record<string, CharacterResourceState>): Character {
  return {
    ...character,
    classResources: Object.keys(resources).length > 0 ? resources : undefined,
  }
}

export function syncCharacterClassResources(character: Character): Character {
  const available = classResourceDefinitions(character)
  const registeredDefinitions = registeredResourceDefinitions(character)
  const registeredKeys = new Set(
    registeredDefinitions.map((resource) => resource.key),
  )
  const resources = Object.fromEntries(
    Object.entries(character.classResources ?? {}).filter(([key]) =>
      !registeredKeys.has(key) &&
      !(key in DND5E_LEGACY_RESOURCE_LABELS) &&
      !/^dnd5e-spell-slot-[1-9]$/.test(key)),
  )
  for (const definition of available) {
    const existing = character.classResources?.[definition.key]
    resources[definition.key] = clampResource(existing?.current, definition.max(character))
  }
  return withClassResources(character, resources)
}

export function updateClassResource(
  character: Character,
  key: string,
  update: (resource: CharacterResourceState) => number,
): Character | null {
  const current = getClassResource(character, key)
  if (!current) return null
  const resources = { ...(character.classResources ?? {}) }
  resources[key] = clampResource(update(current), current.max)
  return withClassResources(character, resources)
}

export function spendClassResource(character: Character, key: string, amount = 1): Character | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  const current = getClassResource(character, key)
  if (!current || current.current < amount) return null
  return updateClassResource(character, key, (resource) => resource.current - amount)
}

export function restoreClassResources(character: Character, reset: ClassResourceReset): Character {
  let next = syncCharacterClassResources(character)
  for (const definition of classResourceDefinitions(next)) {
    const shouldReset =
      definition.resetOn === reset ||
      (reset === 'long-rest' && definition.resetOn === 'short-rest') ||
      (reset === 'long-rest' && definition.resetOn === 'combat')
    if (!shouldReset) continue
    next = updateClassResource(next, definition.key, (resource) => resource.max) ?? next
  }
  return next
}
