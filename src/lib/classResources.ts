import type { Character, CharacterResourceState } from '../types/character'
import {
  classDefinitionForCharacter,
  type ClassResourceDefinition,
  type ClassResourceReset,
} from './classDefinitionRegistry'
import { dnd5ePluginClassResourceDefinitions } from '../rulesets/dnd5e/pluginApi'
import { dnd5eClassDefinition } from '../rulesets/dnd5e/classes'
import { dnd5eMulticlassPactSlots, dnd5eMulticlassSpellSlots, normalizeDnd5eClassLevels } from '../rulesets/dnd5e/multiclass'
import { dnd5eRacialResourceDefinitions } from '../rulesets/dnd5e/racialAutomation'

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
  const definitions = views.flatMap((view) => {
    const registered = classDefinitionForCharacter(view)?.resources
    const native = typeof registered === 'function' ? registered(view) : (registered ?? [])
    return [...native, ...dnd5ePluginClassResourceDefinitions(view)].map((definition) => ({
      ...definition,
      isAvailable: () => definition.isAvailable(view),
      max: () => definition.max(view),
      unlimited: definition.unlimited ? () => definition.unlimited!(view) : undefined,
    }))
  })
  if (character.rulesetId !== 'dnd5e-2014-srd-5.1') return definitions

  const withoutSharedSlots = definitions.filter((definition) =>
    !definition.key.startsWith('dnd5e-spell-slot-') && definition.key !== 'dnd5e-pact-slot')
  const deduplicated = new Map<string, ClassResourceDefinition>()
  for (const definition of withoutSharedSlots) {
    const previous = deduplicated.get(definition.key)
    if (!previous) {
      deduplicated.set(definition.key, definition)
      continue
    }
    deduplicated.set(definition.key, {
      ...previous,
      isAvailable: () => previous.isAvailable(character) || definition.isAvailable(),
      max: () => Math.max(previous.max(character), definition.max()),
      unlimited: () => previous.unlimited?.(character) === true || definition.unlimited?.() === true,
    })
  }

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
    Object.entries(character.classResources ?? {}).filter(([key]) => !registeredKeys.has(key)),
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
