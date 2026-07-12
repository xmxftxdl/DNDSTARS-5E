import type { Character, CharacterResourceState } from '../types/character'
import {
  classDefinitionForCharacter,
  type ClassResourceDefinition,
  type ClassResourceReset,
} from './classDefinitionRegistry'
import { maxQiForLevel } from './classResourceRules'

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

export function classResourceDefinitions(character: Character): readonly ClassResourceDefinition[] {
  return (classDefinitionForCharacter(character)?.resources ?? []).filter((resource) => resource.isAvailable(character))
}

export function classResourceDefinition(character: Character, key: string): ClassResourceDefinition | undefined {
  return classResourceDefinitions(character).find((resource) => resource.key === key)
}

export function getClassResource(character: Character, key: string): CharacterResourceState | undefined {
  const definition = classResourceDefinition(character, key)
  if (!definition) {
    if (key === 'qi' && typeof character.qi === 'number' && Number.isFinite(character.qi)) {
      return clampResource(character.qi, maxQiForLevel(character.level))
    }
    return undefined
  }
  const structured = character.classResources?.[key]
  const legacyCurrent = key === 'qi' ? character.qi : undefined
  return clampResource(structured?.current ?? legacyCurrent, definition.max(character))
}

export function getClassResourceCurrent(character: Character, key: string): number {
  return getClassResource(character, key)?.current ?? 0
}

function withLegacyResourceMirror(character: Character, resources: Record<string, CharacterResourceState>): Character {
  return {
    ...character,
    classResources: Object.keys(resources).length > 0 ? resources : undefined,
    qi: resources.qi?.current,
  }
}

export function syncCharacterClassResources(character: Character): Character {
  const available = classResourceDefinitions(character)
  const registeredKeys = new Set(
    classDefinitionForCharacter(character)?.resources?.map((resource) => resource.key) ?? [],
  )
  const resources = Object.fromEntries(
    Object.entries(character.classResources ?? {}).filter(([key]) => !registeredKeys.has(key)),
  )
  for (const definition of available) {
    const existing = character.classResources?.[definition.key]
    const legacyCurrent = definition.key === 'qi' ? character.qi : undefined
    resources[definition.key] = clampResource(existing?.current ?? legacyCurrent, definition.max(character))
  }
  return withLegacyResourceMirror(character, resources)
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
  return withLegacyResourceMirror(character, resources)
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
