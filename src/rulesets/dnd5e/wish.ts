import type {
  Dnd5eWishDeclarationV1,
  Dnd5eWishTargetV1,
} from '../../lib/sharedCombatTypes'
import { DND5E_DAMAGE_TYPES } from './damageTypes'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function normalizedText(value: unknown, maximumLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ')
  return normalized && normalized.length <= maximumLength ? normalized : undefined
}

function normalizedTargets(value: unknown, maximumTargets: number): Dnd5eWishTargetV1[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximumTargets) return undefined
  const targets = value.map((candidate) => {
    const raw = record(candidate)
    const tokenId = normalizedText(raw?.tokenId, 160)
    const name = normalizedText(raw?.name, 160)
    return tokenId && name ? { tokenId, name } : undefined
  })
  if (targets.some((target) => !target)) return undefined
  const normalized = targets as Dnd5eWishTargetV1[]
  return new Set(normalized.map((target) => target.tokenId)).size === normalized.length
    ? normalized
    : undefined
}

export function dnd5eWishDuplicateSpellFromInput(value: string) {
  const input = value.normalize('NFKC').trim().toLocaleLowerCase()
  if (!input) return undefined
  return DND5E_SRD_SPELL_CATALOG.find((spell) =>
    spell.level <= 8 && (
      spell.id.toLocaleLowerCase() === input ||
      spell.name.toLocaleLowerCase() === input ||
      spell.englishName.toLocaleLowerCase() === input
    ))
}

export function normalizeDnd5eWishDeclarationV1(value: unknown): Dnd5eWishDeclarationV1 | undefined {
  const raw = record(value)
  if (!raw || raw.schemaVersion !== 1 || typeof raw.mode !== 'string') return undefined

  if (raw.mode === 'duplicate-spell') {
    const spellId = normalizedText(raw.spellId, 160)
    const spellName = normalizedText(raw.spellName, 160)
    const spellLevel = Number(raw.spellLevel)
    const spell = spellId ? DND5E_SRD_SPELL_CATALOG.find((entry) => entry.id === spellId) : undefined
    if (!spell || spell.level > 8 || spell.name !== spellName || spell.level !== spellLevel) return undefined
    return { schemaVersion: 1, mode: raw.mode, spellId: spell.id, spellName: spell.name, spellLevel: spell.level }
  }

  if (raw.mode === 'create-object') {
    const objectDescription = normalizedText(raw.objectDescription, 500)
    const placementDescription = normalizedText(raw.placementDescription, 500)
    const valueGp = Number(raw.valueGp)
    const maximumDimensionFeet = Number(raw.maximumDimensionFeet)
    if (
      !objectDescription || !placementDescription ||
      !Number.isInteger(valueGp) || valueGp < 0 || valueGp > 25_000 ||
      !Number.isFinite(maximumDimensionFeet) || maximumDimensionFeet <= 0 || maximumDimensionFeet > 300
    ) return undefined
    return {
      schemaVersion: 1,
      mode: raw.mode,
      objectDescription,
      valueGp,
      maximumDimensionFeet,
      placementDescription,
    }
  }

  if (raw.mode === 'heal-and-restore') {
    const targets = normalizedTargets(raw.targets, 20)
    return targets ? { schemaVersion: 1, mode: raw.mode, targets } : undefined
  }

  if (raw.mode === 'grant-resistance') {
    const targets = normalizedTargets(raw.targets, 10)
    if (!targets || !DND5E_DAMAGE_TYPES.includes(raw.damageType as never)) return undefined
    return { schemaVersion: 1, mode: raw.mode, targets, damageType: raw.damageType as typeof DND5E_DAMAGE_TYPES[number] }
  }

  if (raw.mode === 'grant-immunity') {
    const targets = normalizedTargets(raw.targets, 10)
    const namedEffect = normalizedText(raw.namedEffect, 500)
    return targets && namedEffect
      ? { schemaVersion: 1, mode: raw.mode, targets, namedEffect }
      : undefined
  }

  if (raw.mode === 'reroll-last-round') {
    const rollDescription = normalizedText(raw.rollDescription, 500)
    if (!rollDescription || (raw.rollMode !== 'advantage' && raw.rollMode !== 'disadvantage')) return undefined
    return { schemaVersion: 1, mode: raw.mode, rollDescription, rollMode: raw.rollMode }
  }

  if (raw.mode === 'open-ended') {
    const exactWish = normalizedText(raw.exactWish, 2_000)
    return exactWish ? { schemaVersion: 1, mode: raw.mode, exactWish } : undefined
  }

  return undefined
}
