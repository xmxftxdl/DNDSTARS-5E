import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { loadSharedResource, saveSharedResourceWithResult } from '../lib/sharedApi'
import { isPlayerPort } from '../lib/appMode'
import { getRoomSession } from '../lib/roomSession'
import { getAccountSession } from '../lib/accountSession'
import { restoreClassResources, syncCharacterClassResources } from '../lib/classResources'
import { migrateLegacyCharacterFields } from '../lib/legacyCharacterMigration'
import { normalizeCharacterInitiativePortrait, normalizeCharacterPortrait, normalizeCharacterTokenPortrait } from '../lib/characterPortrait'
import { normalizeCharacterAvatar } from '../lib/characterAvatar'
import { defaultEquipmentForDnd5eCharacter, normalizeDnd5eCharacterEquipment } from '../rulesets/dnd5e/equipment'
import { dnd5eArmorClass } from '../rulesets/dnd5e/equipment'
import { syncDnd5eHitPoints } from '../rulesets/dnd5e/hitPoints'
import { applyDnd5eShortRestResourceFeatures, dnd5eClassDefinition } from '../rulesets/dnd5e/classes'
import {
  applyDnd5eInventoryGrantBundle,
  applyDnd5eInventoryMutation,
  normalizeDnd5eInventory,
  resolveDnd5eAttunementAfterShortRest,
  restoreDnd5eInventoryResources,
} from '../rulesets/dnd5e/items'
import { dnd5eTotalCharacterLevel, normalizeDnd5eClassLevels } from '../rulesets/dnd5e/multiclass'
import {
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  projectDnd5eActiveEffectState,
  validateDnd5eActiveEffectsStrict,
} from '../rulesets/dnd5e/activeEffects'
import { migrateDnd5eCombatStateEffects } from '../rulesets/dnd5e/legacyActiveEffectMigration'
import type {
  Dnd5eInventoryGrant,
  Dnd5eInventoryCurrencyGrant,
  Dnd5eInventoryMutation,
  Dnd5eInventoryMutationResult,
} from '../types/inventory'
import type { SharedCampaignTimeState } from '../lib/campaignTime'
import { applyDnd5eLongRestBenefits, reconcileDnd5eCharacterCampaignTime } from '../rulesets/dnd5e/campaignTimeRules'
import { canBenefitFromLongRest } from '../lib/campaignTime'
import { useCampaignTimeStore } from './campaignTime'

import type { Character } from '../types/character'
import type { LegacyCharacterSave } from '../types/legacyCharacter'

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

let lastSharedCharactersSnapshot = ''
// Legacy snapshots without server metadata still use this timestamp watermark.
let lastAppliedCharactersUpdatedAt = 0
// Cross-device ordering must use the server-issued revision. Client wall clocks
// are not comparable and can otherwise make an authoritative HP update look stale.
const lastAppliedCharactersRevisionByRoom = new Map<string, number>()
let characterSaveSeq = 0
const LOCAL_CHARACTER_CREATE_TTL_MS = 60000
const pendingLocalCharacterCreations = new Map<string, number>()
const LOCAL_CHARACTER_LEVEL_EDIT_TTL_MS = 30000
const PENDING_LOCAL_CHARACTER_LEVEL_EDITS_STORAGE_KEY = 'stars-character-level-edits-v1'
const pendingLocalCharacterLevelEdits = new Map<string, { level: number; updatedAt: number }>()
let pendingLocalCharacterLevelEditsHydrated = false
const LOCAL_CHARACTER_HIT_POINT_EDIT_TTL_MS = 30000
const PENDING_LOCAL_CHARACTER_HIT_POINT_EDITS_STORAGE_KEY = 'stars-character-hit-point-edits-v1'
type PendingLocalCharacterHitPointEdit = Partial<Pick<
  Character,
  'currentHp' | 'maxHp' | 'tempHp' | 'hitPointMaximumMode' | 'hitPointRolls' | 'hitPointDice'
>> & {
  updatedAt: number
}
const pendingLocalCharacterHitPointEdits = new Map<string, PendingLocalCharacterHitPointEdit>()
let pendingLocalCharacterHitPointEditsHydrated = false

function pendingLocalCharacterEditStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function persistPendingLocalCharacterLevelEdits(): void {
  const storage = pendingLocalCharacterEditStorage()
  if (!storage) return
  try {
    if (pendingLocalCharacterLevelEdits.size === 0) {
      storage.removeItem(PENDING_LOCAL_CHARACTER_LEVEL_EDITS_STORAGE_KEY)
      return
    }
    storage.setItem(
      PENDING_LOCAL_CHARACTER_LEVEL_EDITS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(pendingLocalCharacterLevelEdits)),
    )
  } catch {
    // localStorage may be unavailable or full. The in-memory guard still applies.
  }
}

function hydratePendingLocalCharacterLevelEdits(): void {
  if (pendingLocalCharacterLevelEditsHydrated) return
  pendingLocalCharacterLevelEditsHydrated = true
  const storage = pendingLocalCharacterEditStorage()
  if (!storage) return
  try {
    const raw = storage.getItem(PENDING_LOCAL_CHARACTER_LEVEL_EDITS_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, { level?: unknown; updatedAt?: unknown }>
    for (const [id, pending] of Object.entries(parsed)) {
      const level = Number(pending?.level)
      const updatedAt = Number(pending?.updatedAt)
      if (!id || !Number.isFinite(level) || !Number.isFinite(updatedAt)) continue
      pendingLocalCharacterLevelEdits.set(id, {
        level: Math.min(20, Math.max(1, Math.floor(level))),
        updatedAt,
      })
    }
  } catch {
    try {
      storage.removeItem(PENDING_LOCAL_CHARACTER_LEVEL_EDITS_STORAGE_KEY)
    } catch {
      // Ignore storage implementations that reject both reads and writes.
    }
  }
}

function gcPendingLocalCharacterLevelEdits(now: number = Date.now()): void {
  hydratePendingLocalCharacterLevelEdits()
  let changed = false
  for (const [id, pending] of pendingLocalCharacterLevelEdits) {
    if (now - pending.updatedAt > LOCAL_CHARACTER_LEVEL_EDIT_TTL_MS) {
      pendingLocalCharacterLevelEdits.delete(id)
      changed = true
    }
  }
  if (changed) persistPendingLocalCharacterLevelEdits()
}

export function markPendingLocalCharacterLevelEdit(id: string, level: number, now: number = Date.now()): void {
  hydratePendingLocalCharacterLevelEdits()
  pendingLocalCharacterLevelEdits.set(id, {
    level: Math.min(20, Math.max(1, Math.floor(level))),
    updatedAt: now,
  })
  persistPendingLocalCharacterLevelEdits()
}

export function clearPendingLocalCharacterLevelEditsForTest(): void {
  pendingLocalCharacterLevelEdits.clear()
  pendingLocalCharacterLevelEditsHydrated = true
  persistPendingLocalCharacterLevelEdits()
}

export function resetPendingLocalCharacterLevelEditMemoryForTest(): void {
  pendingLocalCharacterLevelEdits.clear()
  pendingLocalCharacterLevelEditsHydrated = false
}

/**
 * 本地等级编辑写入共享状态前，SSE/轮询仍可能读到旧快照。
 * 在服务端回显相同等级（确认写入）或保护窗口过期之前，旧快照不得把等级覆盖回去。
 */
export function mergePendingLocalCharacterLevelEdits(
  sharedCharacters: Character[],
  now: number = Date.now(),
): Character[] {
  gcPendingLocalCharacterLevelEdits(now)
  if (pendingLocalCharacterLevelEdits.size === 0) return sharedCharacters

  return sharedCharacters.map((character) => {
    const pending = pendingLocalCharacterLevelEdits.get(character.id)
    if (!pending) return character
    if (character.level === pending.level) {
      pendingLocalCharacterLevelEdits.delete(character.id)
      persistPendingLocalCharacterLevelEdits()
      return character
    }
    return { ...character, level: pending.level }
  })
}

function persistPendingLocalCharacterHitPointEdits(): void {
  const storage = pendingLocalCharacterEditStorage()
  if (!storage) return
  try {
    if (pendingLocalCharacterHitPointEdits.size === 0) {
      storage.removeItem(PENDING_LOCAL_CHARACTER_HIT_POINT_EDITS_STORAGE_KEY)
      return
    }
    storage.setItem(
      PENDING_LOCAL_CHARACTER_HIT_POINT_EDITS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(pendingLocalCharacterHitPointEdits)),
    )
  } catch {
    // The in-memory guard remains useful when localStorage is unavailable.
  }
}

function hydratePendingLocalCharacterHitPointEdits(): void {
  if (pendingLocalCharacterHitPointEditsHydrated) return
  pendingLocalCharacterHitPointEditsHydrated = true
  const storage = pendingLocalCharacterEditStorage()
  if (!storage) return
  try {
    const raw = storage.getItem(PENDING_LOCAL_CHARACTER_HIT_POINT_EDITS_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, PendingLocalCharacterHitPointEdit>
    for (const [id, pending] of Object.entries(parsed)) {
      const updatedAt = Number(pending?.updatedAt)
      if (!id || !Number.isFinite(updatedAt)) continue
      const normalized: PendingLocalCharacterHitPointEdit = { updatedAt }
      if (Number.isFinite(pending.currentHp)) normalized.currentHp = Math.max(0, Math.floor(pending.currentHp!))
      if (Number.isFinite(pending.maxHp)) normalized.maxHp = Math.max(1, Math.floor(pending.maxHp!))
      if (Number.isFinite(pending.tempHp)) normalized.tempHp = Math.max(0, Math.floor(pending.tempHp!))
      if (pending.hitPointMaximumMode === 'fixed' || pending.hitPointMaximumMode === 'manual') {
        normalized.hitPointMaximumMode = pending.hitPointMaximumMode
      }
      if (
        Array.isArray(pending.hitPointRolls) && pending.hitPointRolls.length >= 1 && pending.hitPointRolls.length <= 20 &&
        pending.hitPointRolls.every((roll) => Number.isFinite(roll))
      ) normalized.hitPointRolls = pending.hitPointRolls.map((roll) => Math.max(1, Math.floor(roll)))
      if (
        Array.isArray(pending.hitPointDice) && pending.hitPointDice.length <= 20 &&
        pending.hitPointDice.every((pool) => Number.isFinite(pool?.sides) && Number.isFinite(pool?.current) && Number.isFinite(pool?.max))
      ) normalized.hitPointDice = pending.hitPointDice.map((pool) => ({
        sides: Math.max(2, Math.floor(pool.sides)),
        current: Math.max(0, Math.min(Math.floor(pool.max), Math.floor(pool.current))),
        max: Math.max(0, Math.floor(pool.max)),
      }))
      if (
        normalized.currentHp == null && normalized.maxHp == null && normalized.tempHp == null &&
        normalized.hitPointMaximumMode == null && normalized.hitPointRolls == null && normalized.hitPointDice == null
      ) continue
      pendingLocalCharacterHitPointEdits.set(id, normalized)
    }
  } catch {
    try {
      storage.removeItem(PENDING_LOCAL_CHARACTER_HIT_POINT_EDITS_STORAGE_KEY)
    } catch {
      // Ignore storage implementations that reject both reads and writes.
    }
  }
}

function gcPendingLocalCharacterHitPointEdits(now: number = Date.now()): void {
  hydratePendingLocalCharacterHitPointEdits()
  let changed = false
  for (const [id, pending] of pendingLocalCharacterHitPointEdits) {
    if (now - pending.updatedAt > LOCAL_CHARACTER_HIT_POINT_EDIT_TTL_MS) {
      pendingLocalCharacterHitPointEdits.delete(id)
      changed = true
    }
  }
  if (changed) persistPendingLocalCharacterHitPointEdits()
}

export function markPendingLocalCharacterHitPointEdit(
  id: string,
  patch: Partial<Pick<Character, 'currentHp' | 'maxHp' | 'tempHp' | 'hitPointMaximumMode' | 'hitPointRolls' | 'hitPointDice'>>,
  now: number = Date.now(),
): void {
  hydratePendingLocalCharacterHitPointEdits()
  const pending: PendingLocalCharacterHitPointEdit = { updatedAt: now }
  if (Number.isFinite(patch.currentHp)) pending.currentHp = Math.max(0, Math.floor(patch.currentHp!))
  if (Number.isFinite(patch.maxHp)) pending.maxHp = Math.max(1, Math.floor(patch.maxHp!))
  if (Number.isFinite(patch.tempHp)) pending.tempHp = Math.max(0, Math.floor(patch.tempHp!))
  if (patch.hitPointMaximumMode === 'fixed' || patch.hitPointMaximumMode === 'manual') {
    pending.hitPointMaximumMode = patch.hitPointMaximumMode
  }
  if (Array.isArray(patch.hitPointRolls) && patch.hitPointRolls.length >= 1 && patch.hitPointRolls.length <= 20) {
    pending.hitPointRolls = patch.hitPointRolls.map((roll) => Math.max(1, Math.floor(Number(roll) || 1)))
  }
  if (Array.isArray(patch.hitPointDice) && patch.hitPointDice.length <= 20) {
    pending.hitPointDice = patch.hitPointDice.map((pool) => ({ ...pool }))
  }
  if (
    pending.currentHp == null && pending.maxHp == null && pending.tempHp == null &&
    pending.hitPointMaximumMode == null && pending.hitPointRolls == null && pending.hitPointDice == null
  ) return
  pendingLocalCharacterHitPointEdits.set(id, pending)
  persistPendingLocalCharacterHitPointEdits()
}

function clearPendingLocalCharacterHitPointEdit(id: string): void {
  if (!pendingLocalCharacterHitPointEdits.delete(id)) return
  persistPendingLocalCharacterHitPointEdits()
}

export function clearPendingLocalCharacterHitPointEditsForTest(): void {
  pendingLocalCharacterHitPointEdits.clear()
  pendingLocalCharacterHitPointEditsHydrated = true
  persistPendingLocalCharacterHitPointEdits()
}

export function resetPendingLocalCharacterHitPointEditMemoryForTest(): void {
  pendingLocalCharacterHitPointEdits.clear()
  pendingLocalCharacterHitPointEditsHydrated = false
}

/**
 * 角色页生命值编辑在服务器回显确认前保留。客户端墙钟不可跨设备比较；
 * 并发顺序由共享资源的服务器 revision/CAS 负责，待确认值只按回显或 TTL 清除。
 */
export function mergePendingLocalCharacterHitPointEdits(
  sharedCharacters: Character[],
  now: number = Date.now(),
): Character[] {
  gcPendingLocalCharacterHitPointEdits(now)
  if (pendingLocalCharacterHitPointEdits.size === 0) return sharedCharacters
  return sharedCharacters.map((character) => {
    const pending = pendingLocalCharacterHitPointEdits.get(character.id)
    if (!pending) return character
    const acknowledged =
      (pending.currentHp == null || character.currentHp === pending.currentHp) &&
      (pending.maxHp == null || character.maxHp === pending.maxHp) &&
      (pending.tempHp == null || character.tempHp === pending.tempHp) &&
      (pending.hitPointMaximumMode == null || character.hitPointMaximumMode === pending.hitPointMaximumMode) &&
      (pending.hitPointRolls == null || JSON.stringify(character.hitPointRolls ?? []) === JSON.stringify(pending.hitPointRolls)) &&
      (pending.hitPointDice == null || JSON.stringify(character.hitPointDice ?? []) === JSON.stringify(pending.hitPointDice))
    if (acknowledged) {
      clearPendingLocalCharacterHitPointEdit(character.id)
      return character
    }
    return {
      ...character,
      ...(pending.currentHp == null ? {} : { currentHp: pending.currentHp }),
      ...(pending.maxHp == null ? {} : { maxHp: pending.maxHp }),
      ...(pending.tempHp == null ? {} : { tempHp: pending.tempHp }),
      ...(pending.hitPointMaximumMode == null ? {} : { hitPointMaximumMode: pending.hitPointMaximumMode }),
      ...(pending.hitPointRolls == null ? {} : { hitPointRolls: [...pending.hitPointRolls] }),
      ...(pending.hitPointDice == null ? {} : { hitPointDice: pending.hitPointDice.map((pool) => ({ ...pool })) }),
    }
  })
}

type FighterChoices = NonNullable<NonNullable<Character['dnd5eClassChoices']>['fighter']>

const PENDING_LOCAL_FIGHTER_CHOICES_TTL_MS = 30000
const PENDING_LOCAL_FIGHTER_CHOICES_STORAGE_KEY = 'stars-character-fighter-choices-v1'
const pendingLocalFighterChoices = new Map<string, { choices: FighterChoices; updatedAt: number }>()
let pendingLocalFighterChoicesHydrated = false

function cloneFighterChoices(choices: FighterChoices): FighterChoices {
  return {
    ...choices,
    fightingStyles: choices.fightingStyles ? [...choices.fightingStyles] : undefined,
    extensionChoices: choices.extensionChoices
      ? Object.fromEntries(Object.entries(choices.extensionChoices).map(([key, values]) => [key, [...values]]))
      : undefined,
  }
}

function fighterChoicesSnapshot(choices: FighterChoices | undefined): string {
  return JSON.stringify({
    subclass: choices?.subclass ?? null,
    fightingStyles: choices?.fightingStyles ?? [],
    extensionChoices: choices?.extensionChoices ?? {},
  })
}

function persistPendingLocalFighterChoices(): void {
  const storage = pendingLocalCharacterEditStorage()
  if (!storage) return
  try {
    if (pendingLocalFighterChoices.size === 0) {
      storage.removeItem(PENDING_LOCAL_FIGHTER_CHOICES_STORAGE_KEY)
      return
    }
    storage.setItem(
      PENDING_LOCAL_FIGHTER_CHOICES_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(pendingLocalFighterChoices)),
    )
  } catch {
    // The in-memory guard remains useful when localStorage is unavailable.
  }
}

function hydratePendingLocalFighterChoices(): void {
  if (pendingLocalFighterChoicesHydrated) return
  pendingLocalFighterChoicesHydrated = true
  const storage = pendingLocalCharacterEditStorage()
  if (!storage) return
  try {
    const raw = storage.getItem(PENDING_LOCAL_FIGHTER_CHOICES_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, { choices?: FighterChoices; updatedAt?: unknown }>
    for (const [id, pending] of Object.entries(parsed)) {
      const updatedAt = Number(pending?.updatedAt)
      if (!id || !pending?.choices || !Number.isFinite(updatedAt)) continue
      pendingLocalFighterChoices.set(id, {
        choices: cloneFighterChoices(pending.choices),
        updatedAt,
      })
    }
  } catch {
    try {
      storage.removeItem(PENDING_LOCAL_FIGHTER_CHOICES_STORAGE_KEY)
    } catch {
      // Ignore storage implementations that reject both reads and writes.
    }
  }
}

function gcPendingLocalFighterChoices(now: number = Date.now()): void {
  hydratePendingLocalFighterChoices()
  let changed = false
  for (const [id, pending] of pendingLocalFighterChoices) {
    if (now - pending.updatedAt > PENDING_LOCAL_FIGHTER_CHOICES_TTL_MS) {
      pendingLocalFighterChoices.delete(id)
      changed = true
    }
  }
  if (changed) persistPendingLocalFighterChoices()
}

export function markPendingLocalFighterChoices(
  id: string,
  choices: FighterChoices,
  now: number = Date.now(),
): void {
  hydratePendingLocalFighterChoices()
  pendingLocalFighterChoices.set(id, { choices: cloneFighterChoices(choices), updatedAt: now })
  persistPendingLocalFighterChoices()
}

export function clearPendingLocalFighterChoicesForTest(): void {
  pendingLocalFighterChoices.clear()
  pendingLocalFighterChoicesHydrated = true
  persistPendingLocalFighterChoices()
}

export function resetPendingLocalFighterChoicesMemoryForTest(): void {
  pendingLocalFighterChoices.clear()
  pendingLocalFighterChoicesHydrated = false
}

export function mergePendingLocalFighterChoices(
  sharedCharacters: Character[],
  now: number = Date.now(),
): Character[] {
  gcPendingLocalFighterChoices(now)
  if (pendingLocalFighterChoices.size === 0) return sharedCharacters

  return sharedCharacters.map((character) => {
    const pending = pendingLocalFighterChoices.get(character.id)
    if (!pending) return character
    if (fighterChoicesSnapshot(character.dnd5eClassChoices?.fighter) === fighterChoicesSnapshot(pending.choices)) {
      pendingLocalFighterChoices.delete(character.id)
      persistPendingLocalFighterChoices()
      return character
    }
    return {
      ...character,
      dnd5eClassChoices: {
        ...character.dnd5eClassChoices,
        fighter: cloneFighterChoices(pending.choices),
      },
    }
  })
}

type GenericClassChoices = NonNullable<NonNullable<Character['dnd5eClassChoices']>['classes']>

const PENDING_LOCAL_CLASS_CHOICES_TTL_MS = 30000
const PENDING_LOCAL_CLASS_CHOICES_STORAGE_KEY = 'stars-character-class-choices-v1'
const pendingLocalClassChoices = new Map<string, { choices: GenericClassChoices; updatedAt: number }>()
let pendingLocalClassChoicesHydrated = false

function cloneGenericClassChoices(choices: GenericClassChoices): GenericClassChoices {
  return Object.fromEntries(Object.entries(choices).map(([classId, classChoices]) => [classId, {
    ...classChoices,
    selections: classChoices.selections
      ? Object.fromEntries(Object.entries(classChoices.selections).map(([groupId, values]) => [groupId, [...values]]))
      : undefined,
  }]))
}

function genericClassChoicesSnapshot(choices: GenericClassChoices | undefined): string {
  return JSON.stringify(choices ?? {})
}

function persistPendingLocalClassChoices(): void {
  const storage = pendingLocalCharacterEditStorage()
  if (!storage) return
  try {
    if (pendingLocalClassChoices.size === 0) {
      storage.removeItem(PENDING_LOCAL_CLASS_CHOICES_STORAGE_KEY)
      return
    }
    storage.setItem(PENDING_LOCAL_CLASS_CHOICES_STORAGE_KEY, JSON.stringify(Object.fromEntries(pendingLocalClassChoices)))
  } catch {
    // The in-memory guard remains useful when localStorage is unavailable.
  }
}

function hydratePendingLocalClassChoices(): void {
  if (pendingLocalClassChoicesHydrated) return
  pendingLocalClassChoicesHydrated = true
  const storage = pendingLocalCharacterEditStorage()
  if (!storage) return
  try {
    const raw = storage.getItem(PENDING_LOCAL_CLASS_CHOICES_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, { choices?: GenericClassChoices; updatedAt?: unknown }>
    for (const [id, pending] of Object.entries(parsed)) {
      const updatedAt = Number(pending?.updatedAt)
      if (!id || !pending?.choices || !Number.isFinite(updatedAt)) continue
      pendingLocalClassChoices.set(id, { choices: cloneGenericClassChoices(pending.choices), updatedAt })
    }
  } catch {
    try {
      storage.removeItem(PENDING_LOCAL_CLASS_CHOICES_STORAGE_KEY)
    } catch {
      // Ignore storage implementations that reject both reads and writes.
    }
  }
}

function gcPendingLocalClassChoices(now: number = Date.now()): void {
  hydratePendingLocalClassChoices()
  let changed = false
  for (const [id, pending] of pendingLocalClassChoices) {
    if (now - pending.updatedAt > PENDING_LOCAL_CLASS_CHOICES_TTL_MS) {
      pendingLocalClassChoices.delete(id)
      changed = true
    }
  }
  if (changed) persistPendingLocalClassChoices()
}

export function markPendingLocalClassChoices(id: string, choices: GenericClassChoices, now: number = Date.now()): void {
  hydratePendingLocalClassChoices()
  pendingLocalClassChoices.set(id, { choices: cloneGenericClassChoices(choices), updatedAt: now })
  persistPendingLocalClassChoices()
}

export function clearPendingLocalClassChoicesForTest(): void {
  pendingLocalClassChoices.clear()
  pendingLocalClassChoicesHydrated = true
  persistPendingLocalClassChoices()
}

export function resetPendingLocalClassChoicesMemoryForTest(): void {
  pendingLocalClassChoices.clear()
  pendingLocalClassChoicesHydrated = false
}

export function mergePendingLocalClassChoices(sharedCharacters: Character[], now: number = Date.now()): Character[] {
  gcPendingLocalClassChoices(now)
  if (pendingLocalClassChoices.size === 0) return sharedCharacters
  return sharedCharacters.map((character) => {
    const pending = pendingLocalClassChoices.get(character.id)
    if (!pending) return character
    if (genericClassChoicesSnapshot(character.dnd5eClassChoices?.classes) === genericClassChoicesSnapshot(pending.choices)) {
      pendingLocalClassChoices.delete(character.id)
      persistPendingLocalClassChoices()
      return character
    }
    return {
      ...character,
      dnd5eClassChoices: {
        ...character.dnd5eClassChoices,
        classes: cloneGenericClassChoices(pending.choices),
      },
    }
  })
}

const PENDING_LOCAL_PLUGIN_FEATURES_TTL_MS = 30000
const PENDING_LOCAL_PLUGIN_FEATURES_STORAGE_KEY = 'stars-character-plugin-features-v1'
const pendingLocalPluginFeatures = new Map<string, { featureIds: string[]; updatedAt: number }>()
let pendingLocalPluginFeaturesHydrated = false

function pluginFeatureIdsSnapshot(featureIds: readonly string[] | undefined): string {
  return JSON.stringify([...(featureIds ?? [])].sort())
}

function persistPendingLocalPluginFeatures(): void {
  const storage = pendingLocalCharacterEditStorage()
  if (!storage) return
  try {
    if (pendingLocalPluginFeatures.size === 0) {
      storage.removeItem(PENDING_LOCAL_PLUGIN_FEATURES_STORAGE_KEY)
      return
    }
    storage.setItem(
      PENDING_LOCAL_PLUGIN_FEATURES_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(pendingLocalPluginFeatures)),
    )
  } catch {
    // The in-memory guard remains useful when localStorage is unavailable.
  }
}

function hydratePendingLocalPluginFeatures(): void {
  if (pendingLocalPluginFeaturesHydrated) return
  pendingLocalPluginFeaturesHydrated = true
  const storage = pendingLocalCharacterEditStorage()
  if (!storage) return
  try {
    const raw = storage.getItem(PENDING_LOCAL_PLUGIN_FEATURES_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, { featureIds?: unknown; updatedAt?: unknown }>
    for (const [id, pending] of Object.entries(parsed)) {
      const updatedAt = Number(pending?.updatedAt)
      if (
        !id ||
        !Array.isArray(pending?.featureIds) ||
        !pending.featureIds.every((value) => typeof value === 'string') ||
        !Number.isFinite(updatedAt)
      ) continue
      pendingLocalPluginFeatures.set(id, {
        featureIds: [...new Set(pending.featureIds)],
        updatedAt,
      })
    }
  } catch {
    try {
      storage.removeItem(PENDING_LOCAL_PLUGIN_FEATURES_STORAGE_KEY)
    } catch {
      // Ignore storage implementations that reject both reads and writes.
    }
  }
}

function gcPendingLocalPluginFeatures(now: number = Date.now()): void {
  hydratePendingLocalPluginFeatures()
  let changed = false
  for (const [id, pending] of pendingLocalPluginFeatures) {
    if (now - pending.updatedAt > PENDING_LOCAL_PLUGIN_FEATURES_TTL_MS) {
      pendingLocalPluginFeatures.delete(id)
      changed = true
    }
  }
  if (changed) persistPendingLocalPluginFeatures()
}

export function markPendingLocalPluginFeatures(
  id: string,
  featureIds: readonly string[],
  now: number = Date.now(),
): void {
  hydratePendingLocalPluginFeatures()
  pendingLocalPluginFeatures.set(id, {
    featureIds: [...new Set(featureIds)],
    updatedAt: now,
  })
  persistPendingLocalPluginFeatures()
}

export function clearPendingLocalPluginFeaturesForTest(): void {
  pendingLocalPluginFeatures.clear()
  pendingLocalPluginFeaturesHydrated = true
  persistPendingLocalPluginFeatures()
}

export function resetPendingLocalPluginFeaturesMemoryForTest(): void {
  pendingLocalPluginFeatures.clear()
  pendingLocalPluginFeaturesHydrated = false
}

export function mergePendingLocalPluginFeatures(
  sharedCharacters: Character[],
  now: number = Date.now(),
): Character[] {
  gcPendingLocalPluginFeatures(now)
  if (pendingLocalPluginFeatures.size === 0) return sharedCharacters
  return sharedCharacters.map((character) => {
    const pending = pendingLocalPluginFeatures.get(character.id)
    if (!pending) return character
    if (pluginFeatureIdsSnapshot(character.dnd5ePluginFeatureIds) === pluginFeatureIdsSnapshot(pending.featureIds)) {
      pendingLocalPluginFeatures.delete(character.id)
      persistPendingLocalPluginFeatures()
      return character
    }
    return { ...character, dnd5ePluginFeatureIds: [...pending.featureIds] }
  })
}

/**
 * 删除墓碑：id ⇒ 删除时间戳。
 * 没有墓碑时，一次本地删除若落在 `setTimeout(saveCharacters,0)` 窗口内、或对端尚未看到该删除，
 * 对端一份仍含该角色的「全量数组」快照就会在 loadShared 里把它复活。墓碑在有界窗口内抑制复活：
 * loadShared 应用共享快照时过滤掉仍被墓碑标记的 id。
 * 窗口需 ≥ 轮询周期（characters 轮询 ~500ms，见 MapsPage）以覆盖一来回，并在过期后 GC，
 * 这样被删 id 之后可被复用（例如重新创建同名角色拿到回收 id 时不会被旧墓碑误杀）。
 */
const CHARACTER_TOMBSTONE_TTL_MS = 10000
const characterTombstones = new Map<string, number>()

/** 记录一条删除墓碑（id + 当前时间）。删除路径必须在写出快照前调用。 */
export function recordCharacterTombstone(id: string, now: number = Date.now()): void {
  characterTombstones.set(id, now)
}

/** 清掉超过 TTL 的墓碑，使被删 id 可被复用；返回存活墓碑数（便于测试）。 */
export function gcCharacterTombstones(now: number = Date.now()): number {
  for (const [id, ts] of characterTombstones) {
    if (now - ts > CHARACTER_TOMBSTONE_TTL_MS) characterTombstones.delete(id)
  }
  return characterTombstones.size
}

/** 该 id 当前是否仍被墓碑标记（自动顺带 GC 过期项）。 */
export function isCharacterTombstoned(id: string, now: number = Date.now()): boolean {
  gcCharacterTombstones(now)
  return characterTombstones.has(id)
}

/** 测试钩子：清空全部墓碑。 */
export function clearCharacterTombstonesForTest(): void {
  characterTombstones.clear()
}

function gcPendingLocalCharacterCreations(now: number = Date.now()): void {
  for (const [id, ts] of pendingLocalCharacterCreations) {
    if (now - ts > LOCAL_CHARACTER_CREATE_TTL_MS) pendingLocalCharacterCreations.delete(id)
  }
}

function markLocalCharacterCreationPending(id: string, now: number = Date.now()): void {
  pendingLocalCharacterCreations.set(id, now)
}

function isLocalCharacterCreationPending(id: string, now: number = Date.now()): boolean {
  gcPendingLocalCharacterCreations(now)
  return pendingLocalCharacterCreations.has(id)
}

export function clearPendingLocalCharacterCreationsForTest(): void {
  pendingLocalCharacterCreations.clear()
}

/**
 * 从待应用的共享角色数组中剔除仍被墓碑标记的角色，阻止已删除角色复活。
 * 纯函数，便于 T13 在不挂载组件、不碰 localStorage 的前提下单测。
 */
export function filterTombstonedCharacters(
  characters: Character[],
  now: number = Date.now(),
): Character[] {
  gcCharacterTombstones(now)
  if (characterTombstones.size === 0) return characters
  return characters.filter((c) => !characterTombstones.has(c.id))
}

const LEGACY_SAMPLE_CHARACTER_IDS = new Set([
  'sample-aria',
  'sample-thorne',
  'sample-adventurer',
  'sample-archer',
  'sample-vex',
])

/** Legacy showcase records must never enter a real room or a new local save. */
export function filterLegacySampleCharacters<T extends { id?: string }>(characters: readonly T[]): T[] {
  return characters.filter((character) => !character.id || !LEGACY_SAMPLE_CHARACTER_IDS.has(character.id))
}
interface SharedCharactersState {
  characters: Character[]
  selectedId: string | null
  updatedAt?: number
  _sync?: {
    schemaVersion: 1
    revision: number
    writerId: string
    writtenAt: number
  }
}

function sharedCharactersRoomKey(): string {
  return getRoomSession()?.roomId ?? '__local__'
}

export function shouldApplySharedCharactersSnapshot(input: {
  incomingRevision?: number
  lastAppliedRevision?: number
  incomingUpdatedAt?: number
  lastAppliedUpdatedAt?: number
}): boolean {
  const incomingRevision = Number(input.incomingRevision)
  const lastAppliedRevision = Number(input.lastAppliedRevision)
  if (Number.isInteger(incomingRevision) && incomingRevision >= 0) {
    return !Number.isInteger(lastAppliedRevision) ||
      lastAppliedRevision < 0 ||
      incomingRevision >= lastAppliedRevision
  }
  return (input.incomingUpdatedAt ?? 0) >= (input.lastAppliedUpdatedAt ?? 0)
}

export function mergePlayerWritableCharacter(local: Character, shared: Character): Character {
  const projectedEffects = projectDnd5eActiveEffectState(shared.dnd5eCombatState?.activeEffects)
  return {
    ...local,
    currentHp: shared.currentHp,
    maxHp: shared.maxHp,
    tempHp: shared.tempHp,
    conditions: projectedEffects.conditions,
    classResources: shared.classResources,
    dnd5eCombatState: shared.dnd5eCombatState
      ? {
          ...shared.dnd5eCombatState,
          schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
          activeEffects: projectedEffects.activeEffects?.map((effect) => ({
            ...effect,
            source: { ...effect.source },
            duration: { ...effect.duration },
            repeatSave: effect.repeatSave ? { ...effect.repeatSave } : undefined,
            breakOn: effect.breakOn ? [...effect.breakOn] : undefined,
          })),
        }
      : undefined,
    equipment: shared.equipment ? { ...shared.equipment } : undefined,
    dnd5eInventory: shared.dnd5eInventory
      ? {
          ...shared.dnd5eInventory,
          currency: shared.dnd5eInventory.currency ? { ...shared.dnd5eInventory.currency } : undefined,
          entries: shared.dnd5eInventory.entries.map((entry) => ({ ...entry })),
        }
      : undefined,
  }
}

export function mergeCharactersForSharedSave(
  localCharacters: Character[],
  sharedCharacters: Character[] | undefined,
  opts: { playerPort?: boolean; now?: number } = {},
): Character[] {
  const now = opts.now ?? Date.now()
  gcPendingLocalCharacterCreations(now)
  const shared = filterLegacySampleCharacters(
    filterTombstonedCharacters(sharedCharacters ?? [], now),
  ).map(finalizeCharacter)
  const sharedById = new Map(shared.map((ch) => [ch.id, ch]))
  const merged: Character[] = []

  for (const local of filterLegacySampleCharacters(localCharacters)) {
    if (isCharacterTombstoned(local.id, now)) continue
    const existsInShared = sharedById.has(local.id)
    if (opts.playerPort && !existsInShared && !isLocalCharacterCreationPending(local.id, now)) {
      continue
    }
    merged.push(finalizeCharacter(local))
  }

  const mergedIds = new Set(merged.map((ch) => ch.id))
  for (const sharedChar of shared) {
    if (!mergedIds.has(sharedChar.id)) merged.push(sharedChar)
  }
  return merged
}

function mergePendingLocalCharacterCreationsForLoad(
  sharedCharacters: Character[],
  localCharacters: Character[],
  now: number = Date.now(),
): Character[] {
  if (!isPlayerPort()) return sharedCharacters
  gcPendingLocalCharacterCreations(now)
  if (pendingLocalCharacterCreations.size === 0) return sharedCharacters

  const sharedIds = new Set(sharedCharacters.map((ch) => ch.id))
  for (const id of sharedIds) pendingLocalCharacterCreations.delete(id)

  const merged = [...sharedCharacters]
  const mergedIds = new Set(sharedIds)
  for (const local of localCharacters) {
    if (mergedIds.has(local.id)) continue
    if (!isLocalCharacterCreationPending(local.id, now)) continue
    if (isCharacterTombstoned(local.id, now)) continue
    merged.push(finalizeCharacter(local))
    mergedIds.add(local.id)
  }
  return merged
}

/** D&D 5e 2014 / SRD 5.1 角色派生字段默认值。 */
function combatDefaults() {
  return {
    saveDC: 12,
    passivePerception: 10,
    inspiration: 0,
  }
}

function emptyCharacter(): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: uid(),
    name: '新冒险者',
    player: '',
    avatar: '🧝',
    accent: 'from-arcane-500 to-arcane-600',
    race: '人类',
    charClass: '战士',
    dnd5eClassLevels: { fighter: 1 },
    level: 1,
    background: '侍僧',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 10,
    currentHp: 10,
    tempHp: 0,
    hitDice: '1d10',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    ...combatDefaults(),
    dnd5eClassChoices: { fighter: { subclass: 'champion', fightingStyles: [] } },
    equipment: defaultEquipmentForDnd5eCharacter({ charClass: '战士' }),
    conditions: [],
    backstory: '',
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
  }
}

/** V24 唯一旧存档入口：读取旧结构后立即转换成纯 D&D 5e 运行时角色。 */
export function normalizeCharacter(input: LegacyCharacterSave): Character {
  const originalEffectValidation = validateDnd5eActiveEffectsStrict(input.dnd5eCombatState?.activeEffects)
  const c = migrateLegacyCharacterFields(input)
  const d = combatDefaults()
  const experienceAwards = Array.isArray(c.dnd5eExperienceAwards)
    ? c.dnd5eExperienceAwards.filter((award) =>
        award && typeof award.combatId === 'string' && award.combatId.length > 0 && award.combatId.length <= 200 &&
        typeof award.mapId === 'string' && award.mapId.length > 0 && award.mapId.length <= 200 &&
        Number.isSafeInteger(award.xp) && award.xp >= 0 &&
        typeof award.awardedAt === 'number' && Number.isFinite(award.awardedAt) && award.awardedAt >= 0,
      ).slice(-128).map((award) => ({ ...award }))
    : undefined
  const normalized = {
    ...emptyCharacter(),
    ...c,
    // 强制旧存档进入当前 SRD 5.1 规则集，避免 undefined 覆盖默认规则。
    rulesetId: 'dnd5e-2014-srd-5.1',
    // Do not inherit emptyCharacter's fighter level when migrating a legacy
    // single-class save that did not yet have the multiclass field.
    dnd5eClassLevels: c.dnd5eClassLevels,
    avatar: normalizeCharacterAvatar(c.avatar),
    portrait: normalizeCharacterPortrait(c.portrait),
    initiativePortrait: normalizeCharacterInitiativePortrait(c.initiativePortrait),
    tokenPortrait: normalizeCharacterTokenPortrait(c.tokenPortrait),
    saveDC: c.saveDC ?? d.saveDC,
    passivePerception: c.passivePerception ?? d.passivePerception,
    inspiration: c.inspiration ?? d.inspiration,
    abilities: c.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: c.savingThrows ?? [],
    skills: c.skills ?? [],
    conditions: c.conditions ?? [],
    backstory: typeof c.backstory === 'string' ? c.backstory : '',
    experience: c.experience ?? 0,
    dnd5eExperienceAwards: experienceAwards,
    reputation: c.reputation ?? 0,
    classResources: c.classResources,
    equipment: c.equipment ?? defaultEquipmentForDnd5eCharacter({ charClass: c.charClass ?? '战士' }),
  } as Character
  normalized.dnd5eClassLevels = normalizeDnd5eClassLevels(normalized)
  normalized.level = dnd5eTotalCharacterLevel(normalized)
  normalized.equipment = normalizeDnd5eCharacterEquipment(normalized)
  const normalizedInventory = normalizeDnd5eInventory(normalized)
  // V2 数据损坏时 fail closed：不接受部分实例，也不从损坏投影恢复状态。
  if (input.dnd5eCombatState?.schemaVersion === DND5E_COMBAT_STATE_SCHEMA_VERSION && !originalEffectValidation.ok) {
    return {
      ...normalized,
      conditions: [],
      dnd5eCombatState: {
        ...normalized.dnd5eCombatState,
        schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
        activeEffects: undefined,
      },
      dnd5eInventory: normalizedInventory,
    }
  }
  const migratedEffects = migrateDnd5eCombatStateEffects({
    targetId: normalized.id,
    state: normalized.dnd5eCombatState,
    conditions: normalized.conditions,
  })
  return {
    ...normalized,
    conditions: migratedEffects.conditions,
    dnd5eCombatState: {
      ...normalized.dnd5eCombatState,
      schemaVersion: migratedEffects.schemaVersion,
      activeEffects: migratedEffects.activeEffects,
    },
    dnd5eInventory: normalizedInventory,
  }
}

function finalizeCharacter(input: LegacyCharacterSave): Character {
  const normalized = normalizeCharacter(input)
  const withResources = syncCharacterClassResources(normalized)
  const withHitPoints = syncDnd5eHitPoints(withResources)
  return { ...withHitPoints, ac: dnd5eArmorClass(withHitPoints) }
}

/** 运行时类型不含旧字段；共享快照只复制 V24 核心结构。 */
export function serializeDnd5eCharacterSnapshot(character: Character): Character {
  return structuredClone(character)
}

function serializeDnd5eCharacterSnapshots(characters: readonly Character[]): Character[] {
  return characters.map(serializeDnd5eCharacterSnapshot)
}

function reconcileDnd5eClassLevelPatch(current: Character, patch: Partial<Character>): Partial<Character> {
  if (patch.dnd5eClassLevels) return patch
  if (patch.charClass != null) {
    const definition = dnd5eClassDefinition(patch.charClass)
    return definition
      ? { ...patch, dnd5eClassLevels: { [definition.id]: Math.max(1, Math.min(20, Math.floor(patch.level ?? current.level))) } }
      : patch
  }
  if (patch.level == null) return patch
  const levels = normalizeDnd5eClassLevels(current)
  const ids = Object.keys(levels) as Array<keyof typeof levels>
  if (ids.length !== 1) return { ...patch, level: current.level }
  return { ...patch, dnd5eClassLevels: { [ids[0]]: Math.max(1, Math.min(20, Math.floor(patch.level))) } }
}

interface CharacterState {
  characters: Character[]
  selectedId: string | null
  loadShared: () => Promise<void>
  saveSharedNow: (updatedAt?: number) => Promise<number>
  select: (id: string | null) => void
  add: (name?: string) => string
  importCharacter: (character: Partial<Character>) => string
  attachAccountCharacter: (character: Character) => string
  update: (id: string, patch: Partial<Character>) => void
  updateSheetHitPoints: (
    id: string,
    patch: Partial<Pick<Character, 'currentHp' | 'maxHp' | 'tempHp' | 'hitPointDice'>>,
  ) => void
  applyAuthorityUpdate: (id: string, patch: Partial<Character>) => void
  applyInventoryMutation: (mutation: Dnd5eInventoryMutation) => Dnd5eInventoryMutationResult
  applyInventoryGrantBundle: (input: {
    characterId: string
    grants: readonly Dnd5eInventoryGrant[]
    currencyGrants?: readonly Dnd5eInventoryCurrencyGrant[]
    receiptId: string
  }) => Dnd5eInventoryMutationResult
  remove: (id: string) => void
  shortRestAll: () => void
  longRestAll: () => void
  reconcileCampaignTime: (clock: SharedCampaignTimeState) => {
    changed: boolean
    dawnsApplied: number
    longRestsApplied: number
    longRestsBlocked: number
  }
  reconcileCampaignTimeAndSave: (clock: SharedCampaignTimeState) => Promise<{
    changed: boolean
    dawnsApplied: number
    longRestsApplied: number
    longRestsBlocked: number
  }>
}

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set, get) => {
      const publishCharactersSnapshot = async (updatedAt: number = Date.now()) => {
        const seq = ++characterSaveSeq
        const characters = get().characters
        const selectedId = characters.some((ch) => ch.id === get().selectedId)
          ? get().selectedId
          : (characters[0]?.id ?? null)
        const payload: SharedCharactersState = {
          characters: serializeDnd5eCharacterSnapshots(characters),
          selectedId,
          updatedAt,
        }
        const result = await saveSharedResourceWithResult('characters', payload)
        if (result.status !== 'saved') {
          throw new Error(`characters-save-rejected:${result.status}`)
        }
        if (result.status === 'saved' && seq === characterSaveSeq) {
          lastSharedCharactersSnapshot = JSON.stringify(payload)
          if (Number.isInteger(result.revision)) {
            lastAppliedCharactersRevisionByRoom.set(sharedCharactersRoomKey(), Number(result.revision))
          }
        }
        if (seq !== characterSaveSeq) return updatedAt
        return updatedAt
      }
      let campaignTimeReconcileAndSavePromise: Promise<{
        changed: boolean
        dawnsApplied: number
        longRestsApplied: number
        longRestsBlocked: number
      }> | null = null

      const saveCharacters = () => {
        const seq = ++characterSaveSeq
        const save = async () => {
          let characters = get().characters
          const shared = await loadSharedResource<SharedCharactersState>('characters')
          if (seq !== characterSaveSeq) return
          if (shared?.characters) {
            if (isPlayerPort()) {
              const protectedSharedCharacters = mergePendingLocalCharacterHitPointEdits(
                shared.characters,
                Date.now(),
              )
              const sharedById = new Map(protectedSharedCharacters.map((ch) => [ch.id, ch]))
              characters = characters.map((ch) => {
                const sharedChar = sharedById.get(ch.id)
                if (!sharedChar) return ch
                return mergePlayerWritableCharacter(ch, sharedChar)
              })
            }
            characters = mergeCharactersForSharedSave(characters, shared.characters, {
              playerPort: isPlayerPort(),
            })
            set({ characters })
          }
          const selectedId = characters.some((ch) => ch.id === get().selectedId)
            ? get().selectedId
            : (characters[0]?.id ?? null)
          const payload: SharedCharactersState = {
            characters: serializeDnd5eCharacterSnapshots(characters),
            selectedId,
            updatedAt: Date.now(),
          }
          if (seq !== characterSaveSeq) return
          const result = await saveSharedResourceWithResult('characters', payload)
          if (result.status === 'saved' && seq === characterSaveSeq) {
            lastSharedCharactersSnapshot = JSON.stringify(payload)
            if (Number.isInteger(result.revision)) {
              lastAppliedCharactersRevisionByRoom.set(sharedCharactersRoomKey(), Number(result.revision))
            }
          }
        }
        void save()
      }

      const updateChar = (id: string, fn: (c: Character) => Character) =>
        {
          set((s) => ({ characters: s.characters.map((c) => (c.id === id ? fn(c) : c)) }))
          saveCharacters()
        }

      return {
        characters: [],
        selectedId: null,
        loadShared: async () => {
          const shared = await loadSharedResource<SharedCharactersState>('characters')
          if (!shared?.characters) {
            saveCharacters()
            return
          }
          const roomKey = sharedCharactersRoomKey()
          const incomingRevision = shared._sync?.revision
          const lastAppliedRevision = lastAppliedCharactersRevisionByRoom.get(roomKey)
          if (!shouldApplySharedCharactersSnapshot({
            incomingRevision,
            lastAppliedRevision,
            incomingUpdatedAt: shared.updatedAt,
            lastAppliedUpdatedAt: lastAppliedCharactersUpdatedAt,
          })) {
            console.info('[characters-shared-stale-ignored]', {
              incomingRevision,
              lastAppliedRevision,
              sharedUpdatedAt: shared.updatedAt ?? 0,
              lastAppliedCharactersUpdatedAt,
            })
            return
          }
          // DM 与玩家两端都丢弃严格更旧的乱序快照。
          const incomingUpdatedAt = shared.updatedAt ?? 0
          const withoutTombstones = filterTombstonedCharacters(shared.characters)
          const filteredSharedCharacters = filterLegacySampleCharacters(withoutTombstones)
          const legacySamplesMustBeRepublished = !isPlayerPort() &&
            filteredSharedCharacters.length !== withoutTombstones.length
          const sharedCharactersWithPendingLevels = mergePendingLocalCharacterLevelEdits(
            filteredSharedCharacters,
          )
          const sharedCharactersWithPendingChoices = mergePendingLocalFighterChoices(
            sharedCharactersWithPendingLevels,
          )
          const sharedCharactersWithAllPendingChoices = mergePendingLocalClassChoices(
            sharedCharactersWithPendingChoices,
          )
          const sharedCharactersWithPendingPluginFeatures = mergePendingLocalPluginFeatures(
            sharedCharactersWithAllPendingChoices,
          )
          const sharedCharactersWithPendingHitPoints = mergePendingLocalCharacterHitPointEdits(
            sharedCharactersWithPendingPluginFeatures,
            Date.now(),
          )
          const pendingLevelMustBeRepublished = sharedCharactersWithPendingLevels.some(
            (character, index) => character.level !== filteredSharedCharacters[index]?.level,
          )
          const pendingFighterChoicesMustBeRepublished = sharedCharactersWithPendingChoices.some(
            (character, index) => fighterChoicesSnapshot(character.dnd5eClassChoices?.fighter) !==
              fighterChoicesSnapshot(sharedCharactersWithPendingLevels[index]?.dnd5eClassChoices?.fighter),
          )
          const pendingClassChoicesMustBeRepublished = sharedCharactersWithAllPendingChoices.some(
            (character, index) => genericClassChoicesSnapshot(character.dnd5eClassChoices?.classes) !==
              genericClassChoicesSnapshot(sharedCharactersWithPendingChoices[index]?.dnd5eClassChoices?.classes),
          )
          const pendingPluginFeaturesMustBeRepublished = sharedCharactersWithPendingPluginFeatures.some(
            (character, index) => pluginFeatureIdsSnapshot(character.dnd5ePluginFeatureIds) !==
              pluginFeatureIdsSnapshot(sharedCharactersWithAllPendingChoices[index]?.dnd5ePluginFeatureIds),
          )
          const pendingHitPointsMustBeRepublished = sharedCharactersWithPendingHitPoints.some(
            (character, index) => {
              const incoming = sharedCharactersWithPendingPluginFeatures[index]
              return !!incoming && (
                character.currentHp !== incoming.currentHp || character.maxHp !== incoming.maxHp ||
                character.tempHp !== incoming.tempHp ||
                character.hitPointMaximumMode !== incoming.hitPointMaximumMode ||
                JSON.stringify(character.hitPointRolls ?? []) !== JSON.stringify(incoming.hitPointRolls ?? []) ||
                JSON.stringify(character.hitPointDice ?? []) !== JSON.stringify(incoming.hitPointDice ?? [])
              )
            },
          )
          const pendingCharacterEditMustBeRepublished =
            pendingLevelMustBeRepublished || pendingFighterChoicesMustBeRepublished ||
            pendingClassChoicesMustBeRepublished || pendingPluginFeaturesMustBeRepublished ||
            pendingHitPointsMustBeRepublished
          const snapshot = JSON.stringify(shared)
          // 普通重复快照可短路；若它仍落后于持久化的本地编辑，则必须重新应用并重试保存。
          if (snapshot === lastSharedCharactersSnapshot && !pendingCharacterEditMustBeRepublished) {
            // saveCharacters 会在 PUT 前记录本地 snapshot；服务端回显该 snapshot 时仍须推进
            // 单调水位，否则玩家端随后可能接受夹在旧水位与本次 ACK 之间的乱序快照。
            lastAppliedCharactersUpdatedAt = incomingUpdatedAt
            if (Number.isInteger(incomingRevision)) {
              lastAppliedCharactersRevisionByRoom.set(roomKey, Number(incomingRevision))
            }
            return
          }
          lastAppliedCharactersUpdatedAt = incomingUpdatedAt
          if (Number.isInteger(incomingRevision)) {
            lastAppliedCharactersRevisionByRoom.set(roomKey, Number(incomingRevision))
          }
          lastSharedCharactersSnapshot = snapshot
          // 先剔除仍被墓碑标记的角色，避免旧全量快照复活已删除角色。
          // 不得复活它。墓碑过期后（GC）该过滤自动失效，被删 id 可被复用。
          const currentRoomSession = getRoomSession()
          const currentAccount = getAccountSession()
          let accountOwnershipMustBeRepublished = false
          const sharedCharacters = sharedCharactersWithPendingHitPoints.map(finalizeCharacter).map((character) => {
            if (
              currentRoomSession?.role === 'player' && currentAccount &&
              character.roomId === currentRoomSession.roomId &&
              character.roomMemberId === currentRoomSession.memberId &&
              character.ownerAccountId !== currentAccount.accountId
            ) {
              accountOwnershipMustBeRepublished = true
              return { ...character, ownerAccountId: currentAccount.accountId }
            }
            return character
          })
          const dnd5eHitPointsMustBeRepublished = !isPlayerPort() && sharedCharacters.some((character, index) => {
            const incoming = sharedCharactersWithAllPendingChoices[index]
            if (character.rulesetId !== 'dnd5e-2014-srd-5.1' || !incoming) return false
            return character.maxHp !== incoming.maxHp ||
              character.currentHp !== incoming.currentHp ||
              character.hitDice !== incoming.hitDice ||
              character.hitPointMaximumMode !== incoming.hitPointMaximumMode ||
              JSON.stringify(character.hitPointRolls ?? []) !== JSON.stringify(incoming.hitPointRolls ?? []) ||
              JSON.stringify(character.hitPointDice ?? []) !== JSON.stringify(incoming.hitPointDice ?? [])
          })
          const retiredFieldsMustBeRepublished = !isPlayerPort() && sharedCharactersWithAllPendingChoices.some(
            (incoming) => {
              const legacy = incoming as LegacyCharacterSave
              return legacy.actionPoints != null || legacy.currentAP != null ||
                (legacy.combatSkills?.length ?? 0) > 0 || (legacy.traits?.length ?? 0) > 0 ||
                legacy.mana != null || legacy.maxMana != null || legacy.qi != null
            },
          )
          const localCharacters = get().characters
          const mergedSharedCharacters = mergePendingLocalCharacterCreationsForLoad(sharedCharacters, localCharacters)
          const sharedSelectedId =
            shared.selectedId && mergedSharedCharacters.some((ch) => ch.id === shared.selectedId)
              ? shared.selectedId
              : null
          const nextSelectedId = sharedSelectedId ?? mergedSharedCharacters[0]?.id ?? null
          set({
            characters: mergedSharedCharacters,
            selectedId:
              nextSelectedId && isCharacterTombstoned(nextSelectedId)
                ? (mergedSharedCharacters[0]?.id ?? null)
                : localCharacters.some((ch) => ch.id === get().selectedId && isLocalCharacterCreationPending(ch.id))
                  ? get().selectedId
                  : nextSelectedId,
          })
          // 页面可能在原 PUT 完成前刷新，另一端也可能发布更新较晚但内容较旧的全量数组。
          // 持久化的等级／战士选择覆盖旧快照并主动重试，直到服务端回显后清除待确认记录。
          if (
            pendingCharacterEditMustBeRepublished || dnd5eHitPointsMustBeRepublished ||
            retiredFieldsMustBeRepublished || legacySamplesMustBeRepublished || accountOwnershipMustBeRepublished
          ) {
            saveCharacters()
          }
        },
        saveSharedNow: publishCharactersSnapshot,
        select: (id) => set({ selectedId: id }),
        add: (name?: string) => {
          const c = emptyCharacter()
          const trimmed = name?.trim()
          if (trimmed) c.name = trimmed
          const roomSession = getRoomSession()
          if (roomSession?.role === 'player') {
            c.ownerAccountId = getAccountSession()?.accountId
            c.roomId = roomSession.roomId
            c.roomMemberId = roomSession.memberId
            c.player = roomSession.displayName
            c.visibleToPlayers = true
          }
          if (isPlayerPort()) markLocalCharacterCreationPending(c.id)
          set((s) => ({ characters: [...s.characters, c], selectedId: c.id }))
          saveCharacters()
          return c.id
        },
        importCharacter: (character) => {
          const id = uid()
          const roomSession = getRoomSession()
          const maxHp = Math.max(1, Number(character.maxHp ?? 10) || 10)
          const currentHp = Math.min(maxHp, Math.max(0, Number(character.currentHp ?? maxHp) || maxHp))
          const imported = finalizeCharacter({
            ...character,
            id,
            name: character.name?.trim() || 'Imported Adventurer',
            currentHp,
            maxHp,
            tempHp: Math.max(0, Number(character.tempHp ?? 0) || 0),
            conditions: character.conditions ?? [],
            visibleToPlayers: character.visibleToPlayers ?? true,
            ...(roomSession?.role === 'player' ? {
              ownerAccountId: getAccountSession()?.accountId,
              roomId: roomSession.roomId,
              roomMemberId: roomSession.memberId,
              player: roomSession.displayName,
              visibleToPlayers: true,
            } : {}),
          })
          if (isPlayerPort()) markLocalCharacterCreationPending(imported.id)
          set((s) => ({ characters: [...s.characters, imported], selectedId: id }))
          saveCharacters()
          return id
        },
        attachAccountCharacter: (character) => {
          const roomSession = getRoomSession()
          const account = getAccountSession()
          if (!roomSession || roomSession.role !== 'player' || !account || character.ownerAccountId !== account.accountId) {
            throw new Error('account-character-owner-mismatch')
          }
          const attached = finalizeCharacter({
            ...character,
            roomId: roomSession.roomId,
            roomMemberId: roomSession.memberId,
            ownerAccountId: account.accountId,
            player: roomSession.displayName,
            visibleToPlayers: true,
          })
          if (isPlayerPort()) markLocalCharacterCreationPending(attached.id)
          set((state) => ({
            characters: [
              ...state.characters.filter((candidate) => candidate.id !== attached.id),
              attached,
            ],
            selectedId: attached.id,
          }))
          saveCharacters()
          return attached.id
        },
        update: (id, patch) => {
          if (patch.level != null) markPendingLocalCharacterLevelEdit(id, patch.level)
          if (
            patch.currentHp != null || patch.maxHp != null || patch.tempHp != null ||
            patch.hitPointMaximumMode != null || patch.hitPointRolls != null || patch.hitPointDice != null
          ) {
            markPendingLocalCharacterHitPointEdit(id, patch)
          }
          if (patch.dnd5eClassChoices?.fighter) {
            markPendingLocalFighterChoices(id, patch.dnd5eClassChoices.fighter)
          }
          if (patch.dnd5eClassChoices?.classes) {
            markPendingLocalClassChoices(id, patch.dnd5eClassChoices.classes)
          }
          if (patch.dnd5ePluginFeatureIds) {
            markPendingLocalPluginFeatures(id, patch.dnd5ePluginFeatureIds)
          }
          const current = get().characters.find((character) => character.id === id)
          if (!current) return
          const adjustedPatch = reconcileDnd5eClassLevelPatch(current, patch)
          const next = finalizeCharacter({ ...current, ...adjustedPatch })
          const hitPointPlanChanged =
            patch.level != null || patch.charClass != null || patch.dnd5eClassLevels != null || patch.hitPointMaximumMode != null ||
            patch.hitPointRolls != null || (patch.abilities != null && patch.abilities.con !== current.abilities.con)
          if (hitPointPlanChanged) {
            markPendingLocalCharacterHitPointEdit(id, {
              ...(next.currentHp === current.currentHp ? {} : { currentHp: next.currentHp }),
              maxHp: next.maxHp,
              hitPointMaximumMode: next.hitPointMaximumMode,
              ...(next.hitPointRolls ? { hitPointRolls: next.hitPointRolls } : {}),
            })
          }
          updateChar(id, () => next)
        },
        updateSheetHitPoints: (id, patch) => {
          const current = get().characters.find((character) => character.id === id)
          if (!current) return
          const next = finalizeCharacter({ ...current, ...patch })
          markPendingLocalCharacterHitPointEdit(id, {
            ...(patch.currentHp == null && next.currentHp === current.currentHp ? {} : { currentHp: next.currentHp }),
            ...(patch.maxHp == null && next.maxHp === current.maxHp ? {} : { maxHp: next.maxHp }),
            ...(patch.tempHp == null && next.tempHp === current.tempHp ? {} : { tempHp: next.tempHp }),
            ...(patch.hitPointDice == null ? {} : { hitPointDice: next.hitPointDice?.map((pool) => ({ ...pool })) }),
          })
          updateChar(id, () => next)
        },
        applyAuthorityUpdate: (id, patch) => {
          if (patch.currentHp != null || patch.maxHp != null || patch.tempHp != null) {
            clearPendingLocalCharacterHitPointEdit(id)
          }
          return set((state) => ({
            characters: state.characters.map((character) =>
              character.id === id
                ? finalizeCharacter({ ...character, ...patch })
                : character,
            ),
          }))
        },
        applyInventoryMutation: (mutation) => {
          const result = applyDnd5eInventoryMutation(get().characters, mutation)
          if (!result.ok) return result
          set({ characters: result.characters })
          saveCharacters()
          return result
        },
        applyInventoryGrantBundle: (input) => {
          const result = applyDnd5eInventoryGrantBundle(get().characters, input)
          if (!result.ok || result.deduplicated) return result
          set({ characters: result.characters })
          saveCharacters()
          return result
        },
        remove: (id) => {
          // 先写删除墓碑，再同步发布快照。
          // 异步窗口曾是复活竞态的根源：删除已生效但快照尚未写出时，对端旧全量快照一旦在
          // loadShared 里被应用就会复活该角色。墓碑 + 同步 save 双保险关闭这个窗口。
          recordCharacterTombstone(id)
          set((s) => {
            const characters = s.characters.filter((c) => c.id !== id)
            return {
              characters,
              selectedId: s.selectedId === id ? (characters[0]?.id ?? null) : s.selectedId,
            }
          })
          saveCharacters()
        },
        shortRestAll: () => {
          set((s) => ({
            characters: s.characters.map((character) =>
              resolveDnd5eAttunementAfterShortRest(restoreDnd5eInventoryResources(
                applyDnd5eShortRestResourceFeatures(restoreClassResources({
                  ...character,
                  dnd5eCombatState: character.dnd5eCombatState ? {
                    ...character.dnd5eCombatState,
                    relentlessRageDc: undefined,
                    relentlessRagePendingDc: undefined,
                  } : undefined,
                }, 'short-rest')),
                'short-rest',
              )),
            ),
          }))
          saveCharacters()
        },
        longRestAll: () => {
          if (getRoomSession()) {
            void useCampaignTimeStore.getState().mutate({ operation: 'long-rest' }).catch((error) => {
              console.error('[战役时间] 长休事务失败', error)
            })
            return
          }
          // 无房间的本地/测试模式保留同步入口；房间内永远等待服务端时间事务后再结算。
          const completionWorldMinute = useCampaignTimeStore.getState().state.worldMinute + 8 * 60
          set((state) => ({
            characters: state.characters.map((character) =>
              canBenefitFromLongRest(character.dnd5eLastLongRestWorldMinute, completionWorldMinute)
                ? applyDnd5eLongRestBenefits(character, completionWorldMinute)
                : character),
          }))
          saveCharacters()
        },
        reconcileCampaignTime: (clock) => {
          let dawnsApplied = 0
          let longRestsApplied = 0
          let longRestsBlocked = 0
          const results = get().characters.map((character) => reconcileDnd5eCharacterCampaignTime(character, clock))
          const changed = results.some((result) => result.changed)
          for (const result of results) {
            dawnsApplied += result.dawnsApplied
            longRestsApplied += result.longRestsApplied
            longRestsBlocked += result.longRestsBlocked
          }
          if (changed) set({ characters: results.map((result) => result.character) })
          if (changed) saveCharacters()
          return { changed, dawnsApplied, longRestsApplied, longRestsBlocked }
        },
        reconcileCampaignTimeAndSave: async (clock) => {
          if (campaignTimeReconcileAndSavePromise) {
            await campaignTimeReconcileAndSavePromise
          }
          campaignTimeReconcileAndSavePromise = (async () => {
            let dawnsApplied = 0
            let longRestsApplied = 0
            let longRestsBlocked = 0
            const results = get().characters.map((character) => reconcileDnd5eCharacterCampaignTime(character, clock))
            const changed = results.some((result) => result.changed)
            for (const result of results) {
              dawnsApplied += result.dawnsApplied
              longRestsApplied += result.longRestsApplied
              longRestsBlocked += result.longRestsBlocked
            }
            if (changed) {
              set({ characters: results.map((result) => result.character) })
              await publishCharactersSnapshot()
            }
            return { changed, dawnsApplied, longRestsApplied, longRestsBlocked }
          })()
          try {
            return await campaignTimeReconcileAndSavePromise
          } finally {
            campaignTimeReconcileAndSavePromise = null
          }
        },

      }
    },
    {
      name: 'stars-characters',
      version: 24,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Omit<Partial<CharacterState>, 'characters'> & {
          characters?: LegacyCharacterSave[]
        }
        const characters = filterLegacySampleCharacters(p.characters ?? []).map(finalizeCharacter)
        const selectedId = characters.some((character) => character.id === p.selectedId)
          ? (p.selectedId ?? null)
          : (characters[0]?.id ?? null)
        return { ...p, characters, selectedId } as CharacterState
      },

      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Omit<Partial<CharacterState>, 'characters'> & {
          characters?: LegacyCharacterSave[]
        }
        const savedCharacters: readonly LegacyCharacterSave[] = p.characters ?? current.characters
        return {
          ...current,
          ...p,
          characters: filterLegacySampleCharacters(savedCharacters).map(finalizeCharacter),
        }
      },
    },
  ),
)
