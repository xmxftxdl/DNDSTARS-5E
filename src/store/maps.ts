import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Dnd5eMonsterLegendaryMovementGrant } from '../rulesets/dnd5e/monsterLegendaryMovement'
import {
  clampTokenPositionToMap,
  defaultTokenSizeForMap,
  realignTokensToGrid,
  snapTokenToGridCenter,
} from '../lib/gridCombat'
import { applyGridDetectPatch, type GridDetectResult } from '../lib/gridDetect'
import {
  assignEnemyVisualVariants,
  enemyTemplateToTokenPatch,
  getEnemyVisualPresentation,
  type EnemyTemplate,
} from '../lib/enemyPool'
import { dnd5eEncounterGridOffset, dnd5eEncounterRoster, type Dnd5eEncounterEntry } from '../rulesets/dnd5e/encounterBuilder'
import { putImage, deleteImage, pruneOrphanImages } from '../lib/imageStore'
import {
  loadSharedResource,
  saveSharedResourceWithResult,
  type SharedResourceSaveResult,
} from '../composition/browserSharedRoomResources'
import { canWriteSharedState, isPlayerPort } from '../lib/appMode'
import { getRoomSession } from '../lib/roomSession'
import { decideApply, type MonotonicState } from '../lib/monotonicGuard'
import type { Dnd5eTimedEffect } from '../rulesets/dnd5e/timedEffects'
import type { Dnd5eActiveEffectInstance } from '../rulesets/dnd5e/activeEffects'
import type { Dnd5eSpellAuthorityRecordV1 } from '../rulesets/dnd5e/spellAuthorityState'
import type { Dnd5eClassId } from '../rulesets/dnd5e/classes'
import type { Dnd5eMinorIllusionConfigV1 } from '../lib/sharedCombatTypes'
import {
  applyDnd5eEffectiveVisionProfile,
  compileDnd5eEffectiveVisionProfile,
} from '../../shared/dnd5e-vision-profile.mjs'
import type { Dnd5eMonsterMechanicTriggerSnapshot } from '../application/combat/dnd5eCombatRules'
import type { Dnd5eHitPointMaximumReductionLedger } from '../rulesets/dnd5e/hitPointMaximumReductions'
import type { Dnd5eConditionalDamageDefense } from '../rulesets/dnd5e/damageDefenses'
import type { Dnd5eLimitedMagicImmunityRule } from '../rulesets/dnd5e/monsterGenericAbilities'
import type { Dnd5eActivityWeaponAttackGrantV1 } from '../rulesets/dnd5e/activities/dnd5eActivityWeaponAttackGrant'
import type {
  Dnd5eDamageType,
  Dnd5eMonsterBehaviorPreferenceV1,
  Dnd5eMonsterTargetingPreferenceV1,
} from '../rulesets/dnd5e/monsters'
import {
  normalizeDnd5eMonsterBehaviorPreference,
  normalizeDnd5eMonsterTargetingPreference,
} from '../rulesets/dnd5e/monsterAutomation'
import {
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  validateDnd5eActiveEffectsStrict,
} from '../rulesets/dnd5e/activeEffects'
import { migrateDnd5eCombatStateEffects } from '../rulesets/dnd5e/legacyActiveEffectMigration'
import {
  DND5E_PERSISTENT_AREA_DURATION_MAX_ROUNDS,
  normalizeDnd5ePersistentAreaLighting,
  normalizeDnd5ePersistentAreaBlocking,
  normalizeDnd5ePersistentAreaGrantedActivity,
  normalizeDnd5ePersistentAreaOccupantModifiers,
  normalizeDnd5ePersistentAreaTurnLifecycle,
  normalizeDnd5ePersistentAreaVerticalSnapshot,
  normalizeDnd5ePersistentAreaVisual,
  normalizeDnd5ePersistentAreaTriggerSnapshot,
  normalizeDnd5ePersistentAreaWeaponHitBonusDamage,
  normalizeDnd5eHallowAreaState,
  normalizeDnd5eHallucinatoryTerrainAreaState,
  normalizeDnd5eProgrammedIllusionAreaState,
  type Dnd5ePersistentAreaAnchorMode,
  type Dnd5ePersistentAreaMovementDeclaration,
  type Dnd5ePersistentAreaSourceFollower,
  type Dnd5ePersistentAreaTurnLifecycle,
  type Dnd5ePersistentAreaGrantedActivity,
  type Dnd5ePersistentAreaLighting,
  type Dnd5ePersistentAreaBlocking,
  type Dnd5ePersistentAreaObscuration,
  type Dnd5ePersistentAreaOccupantModifiers,
  type Dnd5ePersistentAreaSourceKind,
  type Dnd5ePersistentAreaVisual,
  type Dnd5ePersistentAreaTriggerReceipt,
  type Dnd5ePersistentAreaTriggerSnapshot,
  type Dnd5ePersistentAreaVerticalSnapshot,
  type Dnd5ePersistentAreaWeaponHitBonusDamage,
  type Dnd5eHallowAreaState,
  type Dnd5eHallucinatoryTerrainAreaState,
  type Dnd5eProgrammedIllusionAreaState,
} from '../rulesets/dnd5e/persistentAreaTypes'
import {
  getDnd5eCoreSpellAreaDeclaration,
  reconcileDnd5ePersistentAreaAnchors,
} from '../rulesets/dnd5e/coreSpellAreas'
import {
  creatureSizeToTokenSize,
  normalizeCreatureSize,
  normalizeCreatureTypes,
  sizeFromTokenSize,
  type CreatureSize,
  type CreatureType,
} from '../lib/monsterTypes'
import {
  normalizeTokenMovementAnimation,
  tokenMovementAnimationForObservation,
  type TokenMovementAnimation,
} from '../lib/tokenMovementAnimation'
import { campaignLightIsActive, type CampaignLightSourceKind } from '../lib/campaignTime'
import type { EnemyPlayerVisibleDetail } from '../lib/enemyPlayerVisibleDetail'
import {
  normalizeDnd5eSuppressedTokenStatusMarkerIds,
  normalizeDnd5eTokenStatusMarkers,
  type Dnd5eTokenStatusMarker,
} from '../rulesets/dnd5e/tokenStatusMarkers'
import {
  normalizeDnd5eMapObjectStateV1,
  type Dnd5eMapObjectStateV1,
} from '../rulesets/dnd5e/mapObjectState'
import {
  normalizeDnd5eMagicMouthStateV1,
  type Dnd5eMagicMouthStateV1,
} from '../rulesets/dnd5e/magicMouth'
import {
  normalizeMapViewportNotes,
  type MapViewportNote,
} from '../lib/mapViewportNotes'
function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

let lastSharedMapsSnapshot = ''
let lastSharedMapsUpdatedAt = 0
let lastLocalMapsWriteAt = 0
const lastAppliedMapsRevisionByRoom = new Map<string, number>()
const LOCAL_TOKEN_HIT_POINT_EDIT_TTL_MS = 30000
const PENDING_LOCAL_TOKEN_HIT_POINT_EDITS_STORAGE_KEY = 'stars-map-token-hit-point-edits-v1'
type PendingLocalTokenHitPointEdit = {
  hp?: number
  maxHp?: number
  hasHp: boolean
  hasMaxHp: boolean
  updatedAt: number
}
const pendingLocalTokenHitPointEdits = new Map<string, PendingLocalTokenHitPointEdit>()
let pendingLocalTokenHitPointEditsHydrated = false

const pendingTokenKey = (mapId: string, tokenId: string) => `${mapId}:${tokenId}`

/**
 * Serializes full-map persistence without letting rapid edits build an
 * unbounded FIFO of stale snapshots. One request may be in flight while a
 * single trailing request is retained; every newer request replaces that
 * trailing payload.
 *
 * Callers that require durability wait for their generation (or a newer one)
 * to save successfully. Best-effort callers keep the historical fire-and-
 * forget behavior and resolve even when the final underlying save fails.
 */
export function createLatestMapsPublishPump<T>(
  persist: (
    value: T,
    options: { retryPendingHitPoints: boolean },
  ) => Promise<void>,
  resolveLatestValue?: () => T,
): (
  value: T,
  options?: { retryPendingHitPoints?: boolean; requireSaved?: boolean },
) => Promise<void> {
  type PendingPublish = {
    generation: number
    value: T
    retryPendingHitPoints: boolean
  }
  type PublishWaiter = {
    generation: number
    requireSaved: boolean
    resolve: () => void
    reject: (reason: unknown) => void
  }

  let generation = 0
  let running = false
  let pending: PendingPublish | null = null
  let waiters: PublishWaiter[] = []

  const settleThrough = (
    savedGeneration: number,
    outcome?: { failure: unknown },
  ) => {
    const completed = waiters.filter((waiter) => waiter.generation <= savedGeneration)
    waiters = waiters.filter((waiter) => waiter.generation > savedGeneration)
    for (const waiter of completed) {
      if (outcome && waiter.requireSaved) waiter.reject(outcome.failure)
      else waiter.resolve()
    }
  }

  const drain = async () => {
    if (running) return
    running = true
    try {
      while (pending) {
        const request = pending
        pending = null
        try {
          await persist(resolveLatestValue?.() ?? request.value, {
            retryPendingHitPoints: request.retryPendingHitPoints,
          })
          settleThrough(request.generation)
        } catch (error) {
          // TypeScript does not model assignments made by publish calls while
          // the awaited persistence promise is suspended.
          const trailing = pending as PendingPublish | null
          if (trailing) {
            // A failed HP write must retain its conflict-retry semantics when a
            // newer non-HP snapshot has already replaced the trailing request.
            trailing.retryPendingHitPoints =
              trailing.retryPendingHitPoints || request.retryPendingHitPoints
            continue
          }
          settleThrough(request.generation, { failure: error })
        }
      }
    } finally {
      running = false
      // A caller cannot normally enqueue between the final loop check and this
      // assignment, but retaining this guard makes the pump robust to unusual
      // thenables used by tests or integrations.
      if (pending) void drain()
    }
  }

  return (value, options = {}) => {
    const requestedGeneration = ++generation
    const promise = new Promise<void>((resolve, reject) => {
      waiters.push({
        generation: requestedGeneration,
        requireSaved: options.requireSaved === true,
        resolve,
        reject,
      })
    })
    pending = {
      generation: requestedGeneration,
      value,
      retryPendingHitPoints:
        options.retryPendingHitPoints === true ||
        pending?.retryPendingHitPoints === true,
    }
    if (!running) void drain()
    return promise
  }
}

function pendingTokenEditStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function persistPendingLocalTokenHitPointEdits(): void {
  const storage = pendingTokenEditStorage()
  if (!storage) return
  try {
    if (pendingLocalTokenHitPointEdits.size === 0) {
      storage.removeItem(PENDING_LOCAL_TOKEN_HIT_POINT_EDITS_STORAGE_KEY)
      return
    }
    storage.setItem(
      PENDING_LOCAL_TOKEN_HIT_POINT_EDITS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(pendingLocalTokenHitPointEdits)),
    )
  } catch {
    // localStorage 不可用时仍保留内存保护。
  }
}

function hydratePendingLocalTokenHitPointEdits(): void {
  if (pendingLocalTokenHitPointEditsHydrated) return
  pendingLocalTokenHitPointEditsHydrated = true
  const storage = pendingTokenEditStorage()
  if (!storage) return
  try {
    const raw = storage.getItem(PENDING_LOCAL_TOKEN_HIT_POINT_EDITS_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, Partial<PendingLocalTokenHitPointEdit>>
    for (const [key, pending] of Object.entries(parsed)) {
      const updatedAt = Number(pending.updatedAt)
      if (!key || !Number.isFinite(updatedAt)) continue
      pendingLocalTokenHitPointEdits.set(key, {
        hp: pending.hasHp && Number.isFinite(Number(pending.hp)) ? Number(pending.hp) : undefined,
        maxHp: pending.hasMaxHp && Number.isFinite(Number(pending.maxHp)) ? Number(pending.maxHp) : undefined,
        hasHp: pending.hasHp === true,
        hasMaxHp: pending.hasMaxHp === true,
        updatedAt,
      })
    }
  } catch {
    try {
      storage.removeItem(PENDING_LOCAL_TOKEN_HIT_POINT_EDITS_STORAGE_KEY)
    } catch {
      // Ignore storage implementations that reject reads and writes.
    }
  }
}

export function markPendingLocalTokenHitPointEdit(
  mapId: string,
  tokenId: string,
  patch: Pick<Partial<Token>, 'hp' | 'maxHp'>,
  now: number = Date.now(),
): void {
  const hasHp = Object.prototype.hasOwnProperty.call(patch, 'hp')
  const hasMaxHp = Object.prototype.hasOwnProperty.call(patch, 'maxHp')
  if (!hasHp && !hasMaxHp) return
  hydratePendingLocalTokenHitPointEdits()
  pendingLocalTokenHitPointEdits.set(pendingTokenKey(mapId, tokenId), {
    hp: patch.hp,
    maxHp: patch.maxHp,
    hasHp,
    hasMaxHp,
    updatedAt: now,
  })
  persistPendingLocalTokenHitPointEdits()
}

function clearPendingLocalTokenHitPointEdit(mapId: string, tokenId: string): void {
  if (!pendingLocalTokenHitPointEdits.delete(pendingTokenKey(mapId, tokenId))) return
  persistPendingLocalTokenHitPointEdits()
}

export function clearPendingLocalTokenHitPointEditsForTest(): void {
  pendingLocalTokenHitPointEdits.clear()
  pendingLocalTokenHitPointEditsHydrated = true
  persistPendingLocalTokenHitPointEdits()
}

export function resetPendingLocalTokenHitPointEditMemoryForTest(): void {
  pendingLocalTokenHitPointEdits.clear()
  pendingLocalTokenHitPointEditsHydrated = false
}

export function mergePendingLocalTokenHitPointEdits(
  sharedMaps: BattleMap[],
  now: number = Date.now(),
): BattleMap[] {
  hydratePendingLocalTokenHitPointEdits()
  let pendingChanged = false
  for (const [key, pending] of pendingLocalTokenHitPointEdits) {
    if (now - pending.updatedAt > LOCAL_TOKEN_HIT_POINT_EDIT_TTL_MS) {
      pendingLocalTokenHitPointEdits.delete(key)
      pendingChanged = true
    }
  }
  if (pendingLocalTokenHitPointEdits.size === 0) {
    if (pendingChanged) persistPendingLocalTokenHitPointEdits()
    return sharedMaps
  }
  const maps = sharedMaps.map((map) => ({
    ...map,
    tokens: map.tokens.map((token) => {
      const key = pendingTokenKey(map.id, token.id)
      const pending = pendingLocalTokenHitPointEdits.get(key)
      if (!pending) return token
      const acknowledged =
        (!pending.hasHp || token.hp === pending.hp) &&
        (!pending.hasMaxHp || token.maxHp === pending.maxHp)
      if (acknowledged) {
        pendingLocalTokenHitPointEdits.delete(key)
        pendingChanged = true
        return token
      }
      return {
        ...token,
        ...(pending.hasHp ? { hp: pending.hp } : {}),
        ...(pending.hasMaxHp ? { maxHp: pending.maxHp } : {}),
      }
    }),
  }))
  if (pendingChanged) persistPendingLocalTokenHitPointEdits()
  return maps
}

export interface SharedMapsState {
  maps: BattleMap[]
  selectedId: string | null
  updatedAt?: number
  _sync?: {
    schemaVersion: 1
    revision: number
    writerId: string
    writtenAt: number
  }
}

function sharedMapsRoomKey(): string {
  return getRoomSession()?.roomId ?? '__local__'
}

export function shouldApplySharedMapsSnapshot(input: {
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

function rememberAppliedMapsRevision(revision?: number): void {
  if (!Number.isInteger(revision) || Number(revision) < 0) return
  const roomKey = sharedMapsRoomKey()
  const previous = lastAppliedMapsRevisionByRoom.get(roomKey) ?? -1
  if (Number(revision) > previous) {
    lastAppliedMapsRevisionByRoom.set(roomKey, Number(revision))
  }
}

export async function saveMapsStateWithPendingHitPointRetry(input: {
  payload: SharedMapsState
  retryPendingHitPoints: boolean
  save: (payload: SharedMapsState) => Promise<SharedResourceSaveResult>
  load: () => Promise<SharedMapsState | null>
  now?: () => number
  maximumAttempts?: number
}): Promise<{ result: SharedResourceSaveResult; payload: SharedMapsState }> {
  const maximumAttempts = Math.max(1, Math.min(5, Math.floor(input.maximumAttempts ?? 3)))
  const now = input.now ?? Date.now
  let payload = input.payload
  let result: SharedResourceSaveResult = { status: 'failed' }

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    result = await input.save(payload)
    if (result.status === 'saved') {
      if (input.retryPendingHitPoints) {
        // The authoritative server now contains these exact values. Clear the
        // temporary anti-bounce projection instead of keeping it alive for 30s.
        mergePendingLocalTokenHitPointEdits(payload.maps, payload.updatedAt ?? now())
      }
      return { result, payload }
    }
    if (
      !input.retryPendingHitPoints ||
      result.status !== 'conflict' ||
      attempt >= maximumAttempts - 1
    ) return { result, payload }

    const shared = await input.load()
    if (!shared?.maps) return { result, payload }
    const updatedAt = Math.max(
      now(),
      (payload.updatedAt ?? 0) + 1,
      (shared.updatedAt ?? 0) + 1,
    )
    payload = {
      maps: mergePendingLocalTokenHitPointEdits(shared.maps, updatedAt).map((map) => ({
        ...map,
        tokens: map.tokens.map(stripViewerControlProjection),
      })),
      selectedId: payload.selectedId ?? shared.selectedId,
      updatedAt,
    }
  }
  return { result, payload }
}

function applyTokenPatchToSharedMaps(
  maps: BattleMap[],
  mapId: string,
  tokenId: string,
  patch: Partial<Token>,
): BattleMap[] | null {
  const updatesAnchorGeometry = tokenPatchUpdatesPersistentAreaAnchor(patch)
  let matched = false
  const nextMaps = maps.map((map) => {
    if (map.id !== mapId) return map
    const patchedMap = {
      ...map,
      tokens: map.tokens.map((token) => {
        if (token.id !== tokenId) return token
        matched = true
        const next = { ...token, ...patch }
        return {
          ...next,
          ...clampTokenPositionToMap(next, next, map),
        }
      }),
    }
    return updatesAnchorGeometry
      ? reconcilePersistentAreasAnchoredToToken(patchedMap, tokenId)
      : patchedMap
  })
  return matched ? nextMaps : null
}

function tokenPatchUpdatesPersistentAreaAnchor(patch: Partial<Token>): boolean {
  return (['x', 'y', 'elevationFeet', 'size'] as const).some((key) =>
    Object.prototype.hasOwnProperty.call(patch, key),
  )
}

function persistentAreaAnchoredToToken(area: Dnd5ePluginArea, tokenId: string): boolean {
  if (area.sourceFollower && area.sourceTokenId === tokenId) return true
  if (
    area.interposition &&
    (area.sourceTokenId === tokenId || area.interposition.targetTokenId === tokenId)
  ) return true
  return (
    area.anchorMode === 'source-token' || area.anchorMode === 'target-token' || area.anchorMode === 'effect-token'
  ) && (area.anchorTokenId ?? area.sourceTokenId) === tokenId
}

/**
 * Re-anchor only the persistent areas owned by this Token patch. The general
 * reconciler deliberately understands terrain elevation and the exact grid
 * semantics; filtering its result here prevents one unrelated Token patch
 * from silently changing another Token's area.
 */
function reconcilePersistentAreasAnchoredToToken(map: BattleMap, tokenId: string): BattleMap {
  const areas = map.dnd5ePluginAreas ?? []
  const affectedAreas = areas.filter((area) => persistentAreaAnchoredToToken(area, tokenId))
  if (affectedAreas.length < 1) return map
  const reconciled = reconcileDnd5ePersistentAreaAnchors(map)
  const reconciledById = new Map((reconciled.dnd5ePluginAreas ?? []).map((area) => [area.id, area]))
  const affectedEffectTokenIds = new Set(affectedAreas.flatMap((area) =>
    area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : [],
  ))
  const reconciledTokenById = new Map(reconciled.tokens.map((token) => [token.id, token]))
  return {
    ...map,
    tokens: map.tokens.flatMap((token) => {
      if (!affectedEffectTokenIds.has(token.id)) return [token]
      const reconciledToken = reconciledTokenById.get(token.id)
      return reconciledToken ? [reconciledToken] : []
    }),
    dnd5ePluginAreas: areas.flatMap((area) => {
      if (!persistentAreaAnchoredToToken(area, tokenId)) return [area]
      const reconciledArea = reconciledById.get(area.id)
      return reconciledArea ? [reconciledArea] : []
    }),
  }
}

/**
 * Projects the exact Token fields and linked persistent areas from the maps
 * payload that won CAS. They must land in one Store update: projecting only
 * the invisible effect Token briefly exposes the old area anchor when the
 * drag preview is released, which looks like Flaming Sphere jumping back.
 */
export function committedTokenAnchorProjectionFromSharedMaps(
  currentMap: BattleMap,
  committedMaps: BattleMap[],
  tokenId: string,
  patch: Partial<Token>,
): Pick<BattleMap, 'tokens' | 'dnd5ePluginAreas'> | null {
  const committedMap = committedMaps.find((map) => map.id === currentMap.id)
  const committedPatch = committedTokenPatchFromSharedMaps(
    committedMaps,
    currentMap.id,
    tokenId,
    patch,
  )
  if (!committedMap || !committedPatch) return null

  if (!tokenPatchUpdatesPersistentAreaAnchor(patch)) {
    const tokens = currentMap.tokens.map((token) =>
      token.id === tokenId ? { ...token, ...committedPatch } : token,
    )
    return { tokens, dnd5ePluginAreas: currentMap.dnd5ePluginAreas }
  }

  const currentAnchors = (currentMap.dnd5ePluginAreas ?? [])
    .filter((area) => persistentAreaAnchoredToToken(area, tokenId))
  const committedAnchors = (committedMap.dnd5ePluginAreas ?? [])
    .filter((area) => persistentAreaAnchoredToToken(area, tokenId))
  const committedAnchorById = new Map(committedAnchors.map((area) => [area.id, area]))
  const currentAnchorIds = new Set(currentAnchors.map((area) => area.id))
  const linkedEffectTokenIds = new Set([...currentAnchors, ...committedAnchors].flatMap((area) =>
    area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : [],
  ))
  const committedTokenById = new Map(committedMap.tokens.map((token) => [token.id, token]))
  const currentTokenIds = new Set(currentMap.tokens.map((token) => token.id))
  const tokens = [
    ...currentMap.tokens.flatMap((token) => {
      if (token.id === tokenId) return [{ ...token, ...committedPatch }]
      if (!linkedEffectTokenIds.has(token.id)) return [token]
      const committedToken = committedTokenById.get(token.id)
      return committedToken ? [committedToken] : []
    }),
    ...committedMap.tokens.filter((token) =>
      linkedEffectTokenIds.has(token.id) && !currentTokenIds.has(token.id),
    ),
  ]
  const dnd5ePluginAreas = [
    ...(currentMap.dnd5ePluginAreas ?? []).flatMap((area) => {
      if (!persistentAreaAnchoredToToken(area, tokenId)) return [area]
      const committed = committedAnchorById.get(area.id)
      return committed ? [committed] : []
    }),
    ...committedAnchors.filter((area) => !currentAnchorIds.has(area.id)),
  ]
  return { tokens, dnd5ePluginAreas }
}

/**
 * Reads back exactly the fields written by one Token patch from the payload
 * that won the server CAS. A maps invalidation can arrive while the request is
 * in flight and temporarily project an older Token into the local Store; the
 * caller uses this patch after the save succeeds so releasing the drag preview
 * cannot expose that older position.
 */
export function committedTokenPatchFromSharedMaps(
  maps: BattleMap[],
  mapId: string,
  tokenId: string,
  patch: Partial<Token>,
): Partial<Token> | null {
  const committedToken = maps
    .find((map) => map.id === mapId)
    ?.tokens.find((token) => token.id === tokenId)
  if (!committedToken) return null
  return Object.fromEntries(
    (Object.keys(patch) as Array<keyof Token>).map((key) => [key, committedToken[key]]),
  ) as Partial<Token>
}

/**
 * Persists one authoritative Token patch without replacing unrelated remote
 * map changes. On a CAS conflict the command is rebased onto the newest server
 * snapshot and retried, so two rapid DM moves cannot make either Token jump
 * back merely because another map write landed between them.
 */
export async function saveMapsStateWithTokenPatchRetry(input: {
  payload: SharedMapsState
  mapId: string
  tokenId: string
  patch: Partial<Token>
  save: (payload: SharedMapsState) => Promise<SharedResourceSaveResult>
  load: () => Promise<SharedMapsState | null>
  now?: () => number
  maximumAttempts?: number
}): Promise<{ result: SharedResourceSaveResult; payload: SharedMapsState }> {
  const maximumAttempts = Math.max(1, Math.min(5, Math.floor(input.maximumAttempts ?? 4)))
  const now = input.now ?? Date.now
  const initialMaps = applyTokenPatchToSharedMaps(
    input.payload.maps,
    input.mapId,
    input.tokenId,
    input.patch,
  )
  if (!initialMaps) throw new Error('map-token-patch-target-missing')
  let payload: SharedMapsState = {
    ...input.payload,
    maps: initialMaps.map((map) => ({
      ...map,
      tokens: map.tokens.map(stripViewerControlProjection),
    })),
  }
  let result: SharedResourceSaveResult = { status: 'failed' }

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    result = await input.save(payload)
    if (result.status === 'saved') return { result, payload }
    if (result.status !== 'conflict' || attempt >= maximumAttempts - 1) {
      return { result, payload }
    }

    const shared = await input.load()
    if (!shared?.maps) return { result, payload }
    const rebasedMaps = applyTokenPatchToSharedMaps(
      shared.maps,
      input.mapId,
      input.tokenId,
      input.patch,
    )
    if (!rebasedMaps) throw new Error('map-token-patch-target-missing-after-conflict')
    payload = {
      maps: rebasedMaps.map((map) => ({
        ...map,
        tokens: map.tokens.map(stripViewerControlProjection),
      })),
      selectedId: shared.selectedId ?? payload.selectedId,
      updatedAt: Math.max(
        now(),
        (payload.updatedAt ?? 0) + 1,
        (shared.updatedAt ?? 0) + 1,
      ),
    }
  }
  return { result, payload }
}

export function mergePlayerTokenCombatFields(localMaps: BattleMap[], sharedMaps: BattleMap[]): BattleMap[] {
  const observedAt = Date.now()
  const sharedMapById = new Map(sharedMaps.map((map) => [map.id, map]))
  return localMaps.map((map) => {
    const sharedMap = sharedMapById.get(map.id)
    if (!sharedMap) return map
    const sharedTokenById = new Map(sharedMap.tokens.map((token) => [token.id, token]))
    return {
      ...map,
      // Item areas are DM-authoritative combat entities. A player-side map write
      // must never resurrect a cleared trap or erase a newly placed hazard.
      dnd5eItemAreas: sharedMap.dnd5eItemAreas,
      dnd5ePluginAreas: sharedMap.dnd5ePluginAreas,
      tokens: [
        ...map.tokens.flatMap((token) => {
        const sharedToken = sharedTokenById.get(token.id)
        if (!sharedToken) return token.type === 'player' ? [token] : []
        // Token positions are resolved by the DM authority, including player
        // tokens. Player movement uses action requests, so a stale local map
        // snapshot must never undo forced movement such as Thunderwave.
        const authoritativePosition = {
          x: sharedToken.x,
          y: sharedToken.y,
          elevationFeet: sharedToken.elevationFeet,
        }
        return [{
          ...token,
          ...authoritativePosition,
          hp: sharedToken.hp,
          maxHp: sharedToken.maxHp,
          creatureTypes: sharedToken.creatureTypes,
          creatureSize: sharedToken.creatureSize,
          size: sharedToken.size,
          dnd5eSide: sharedToken.dnd5eSide,
          viewerControlled: sharedToken.viewerControlled,
          dnd5eTargetingPreference: sharedToken.dnd5eTargetingPreference,
          dnd5eBehaviorPreference: sharedToken.dnd5eBehaviorPreference,
          visualVariantId: sharedToken.visualVariantId,
          dnd5eCombatState: sharedToken.dnd5eCombatState,
          dnd5eSummon: sharedToken.dnd5eSummon,
          dnd5eSpellEffect: sharedToken.dnd5eSpellEffect,
          movementAnimation: localSharedMovementAnimation({
            local: token.movementAnimation,
            shared: sharedToken.movementAnimation,
            observedAt,
          }),
        }]
        }),
        ...sharedMap.tokens.filter((token) => !map.tokens.some((local) => local.id === token.id)),
      ],
    }
  })
}

function localSharedMovementAnimation(input: {
  local?: TokenMovementAnimation
  shared?: TokenMovementAnimation
  observedAt: number
}): TokenMovementAnimation | undefined {
  if (!input.shared) return undefined
  // Preserve a previously rebased local copy while the authoritative event id
  // is unchanged. Re-running the rebase on every SSE invalidation would keep a
  // Token moving forever instead of allowing it to reach the final coordinate.
  if (input.local?.id === input.shared.id) return input.local
  return tokenMovementAnimationForObservation(input.shared, input.observedAt)
}

function stripViewerControlProjection(token: Token): Omit<Token, 'viewerControlled'> {
  const { viewerControlled, ...persisted } = token
  void viewerControlled
  return persisted
}

async function persistMapsState(
  state: Pick<MapState, 'maps' | 'selectedId'>,
  options: { retryPendingHitPoints: boolean },
): Promise<void> {
  let maps = state.maps
  if (isPlayerPort()) {
    const shared = await loadSharedResource<SharedMapsState>('maps')
    if (shared?.maps) maps = mergePlayerTokenCombatFields(maps, shared.maps)
  }
  const persistedMaps = maps.map((map) => ({
    ...map,
    tokens: map.tokens.map(stripViewerControlProjection),
  }))
  const updatedAt = Math.max(Date.now(), lastSharedMapsUpdatedAt + 1, lastLocalMapsWriteAt + 1)
  const payload: SharedMapsState = { maps: persistedMaps, selectedId: state.selectedId, updatedAt }
  lastLocalMapsWriteAt = updatedAt
  const saved = await saveMapsStateWithPendingHitPointRetry({
    payload,
    retryPendingHitPoints: options.retryPendingHitPoints,
    save: (nextPayload) => saveSharedResourceWithResult('maps', nextPayload),
    load: () => loadSharedResource<SharedMapsState>('maps'),
  })
  const result = saved.result
  if (result.status !== 'saved') {
    lastLocalMapsWriteAt = lastSharedMapsUpdatedAt
    throw new Error(`maps-save-rejected:${result.status}`)
  }
  rememberAppliedMapsRevision(result.revision)
  lastLocalMapsWriteAt = saved.payload.updatedAt ?? lastLocalMapsWriteAt
  lastSharedMapsUpdatedAt = saved.payload.updatedAt ?? Date.now()
  lastSharedMapsSnapshot = JSON.stringify(saved.payload)
}

const enqueueLatestMapsPublish = createLatestMapsPublishPump(
  persistMapsState,
  () => {
    const state = useMapStore.getState()
    return { maps: state.maps, selectedId: state.selectedId }
  },
)

function publishMapsState(
  state: Pick<MapState, 'maps' | 'selectedId'>,
  options: { retryPendingHitPoints?: boolean; requireSaved?: boolean } = {},
): Promise<void> {
  return enqueueLatestMapsPublish(state, options)
}

export type Dnd5eTokenSide = 'player' | 'enemy'

export interface EnemyPlacementOptions {
  side?: Dnd5eTokenSide
}

export interface Token {
  id: string
  label: string
  x: number // 画布坐标（图片像素）
  y: number
  color: string // 边框/底色
  emoji: string
  /** 仅供渲染投影使用：关联角色的完整立绘，不写入地图存档。 */
  portrait?: string
  /** 仅供渲染投影使用：关联角色手动裁切后的地图 Token。 */
  tokenPortrait?: string
  /** 怪物/NPC 立绘存放于共享图片通道，地图状态只保存引用。 */
  portraitImageId?: string
  /** Square map-token crop for monsters; portraitImageId remains the legacy fallback. */
  tokenPortraitImageId?: string
  size: number // 直径（格数的倍数，1 = 一格）
  type: 'player' | 'enemy' | 'npc' | 'obstacle'
  /** 可选的 5e 战斗阵营。未设置时仍由 type 推导；友方怪物使用 player。 */
  dnd5eSide?: Dnd5eTokenSide
  /** 玩家读取地图时由服务端临时投影；不会作为 DM 地图数据持久化。 */
  viewerControlled?: boolean
  /** Player-only projection explaining truths perceived through active truesight. */
  dnd5eTruesightPerception?: {
    ethereal?: true
    originalForm?: true
    visualIllusion?: true
  }
  creatureTypes?: CreatureType[]
  creatureSize?: CreatureSize
  characterId?: string // 关联的角色（点击 token 即可调出其技能栏）
  hp?: number // 生命值（用于未关联角色的敌人/NPC）
  maxHp?: number
  /** 玩家端是否在 Token 上方显示血量条（DM 始终显示；默认对玩家可见） */
  showHpOnToken?: boolean
  /** 玩家端点击时是否显示怪物详情（DM 始终显示；默认对玩家可见） */
  showDetailOnToken?: boolean
  /** 已投影到该未关联生物 Token 的权威战役分钟；用于探索态 ActiveEffect 计时。 */
  dnd5eWorldTimeAppliedMinute?: number
  /** DM 绑定到 NPC 的商店；玩家地图投影只使用这个短 ID 打开公开店面。 */
  merchantShopId?: string
  /**
   * Presentation-only map annotations. They never grant a condition, modifier,
   * action, or other Headless rule by themselves.
   */
  dnd5eTokenStatusMarkers?: Dnd5eTokenStatusMarker[]
  /** Derived badge instances hidden by the DM; underlying Headless rules remain active. */
  dnd5eSuppressedStatusMarkerIds?: string[]
  /** DM 明确公开的房间怪物详情快照；不包含工坊目录或内联美术。 */
  playerVisibleEnemyDetail?: EnemyPlayerVisibleDetail
  /** 来自怪物池的模板 id */
  poolId?: string
  /** 内置怪物外观变体；只持久化短 ID，图片由客户端静态资源解析。 */
  visualVariantId?: string
  /** DM 对单个怪物实例设置的自动攻击目标偏好。 */
  dnd5eTargetingPreference?: Dnd5eMonsterTargetingPreferenceV1
  /** DM 对单个怪物实例设置的确定性战术行为风格。 */
  dnd5eBehaviorPreference?: Dnd5eMonsterBehaviorPreferenceV1
  /** 由声明式 Headless 事务创建的召唤物；Token 仍由 DM 操作，side 只表示战斗阵营。 */
  dnd5eSummon?: {
    schemaVersion: 1
    pluginId: string
    featureId: string
    sourceCharacterId: string
    sourceTokenId: string
    createdRound: number
    expiresAfterRound: number
    concentrationId?: string
    side: 'player' | 'enemy'
    persistent?: true
    persistAfterConcentrationCompletes?: true
    /** This controlled summon remains until its printed expiry, but becomes hostile if concentration ends. */
    becomesHostileAfterConcentrationEnds?: true
    /** True once the permanent creature is no longer commanded by the caster. */
    controlEnded?: true
    createdWorldMinute?: number
    /** Animate Dead command authority ends at this campaign minute unless reasserted. */
    controlExpiresAtWorldMinute?: number
    minimumMaximumHitPoints?: number
    maximumHitPointBonus?: number
    armorClassBonus?: number
    weaponAttackBonus?: number
    weaponDamageBonus?: number
    savingThrowBonus?: number
    proficientSkillCheckBonus?: number
    weaponAttacksMagical?: true
    attacksPerAction?: number
    shareSelfSpellsRangeFeet?: number
    cannotAttack?: true
    walkingSpeedFeet?: number
    dismissAfterDamageRounds?: number
    dismissAtRound?: number
    /**
     * Host snapshot of the mapped object replaced by True Polymorph. It is
     * restored at the creature's current position if the spell ends before
     * permanence; a completed one-hour concentration discards the snapshot.
     */
    truePolymorphOriginalObject?: {
      schemaVersion: 1
      id: string
      label: string
      x: number
      y: number
      color: string
      emoji: string
      size: number
      hp?: number
      maxHp?: number
      obstacleKind?: string
      elevationFeet?: number
      portraitImageId?: string
      tokenPortraitImageId?: string
      showHpOnToken?: boolean
      showDetailOnToken?: boolean
      visibilityMode?: 'line-of-sight' | 'always' | 'dm-only'
      lightSource?: Token['lightSource']
      dnd5eObjectState?: Dnd5eMapObjectStateV1
    }
  }
  /** Persistent duplicate created by the generic duplicate-creature Activity operation. */
  dnd5eSimulacrum?: {
    schemaVersion: 1
    sourceTokenId: string
    subjectTokenId: string
    sourceCharacterId: string
    sourceActivityId: string
    createdRound: number
    level: number
    proficiencyBonus: number
    abilities: Record<import('../lib/dnd').AbilityKey, number>
    armorClass: number
    maximumHitPoints: number
    speed: number
    sizeRank: number
    creatureType?: string
    saveDc?: number
    classLevels?: Record<string, number>
    classResources: Record<string, { current: number; maximum: number }>
    cannotIncreaseLevel: true
    cannotRegainSpellSlots: true
    cannotRegainHitPoints: true
  }
  /** 无战斗属性的核心法术实体；位置与生命周期只由 DM Headless 区域事务控制。 */
  dnd5eSpellEffect?: {
    schemaVersion: 1
    spellId: string
    sourceCharacterId: string
    sourceTokenId: string
    createdRound: number
    expiresAfterRound: number
    concentrationId?: string
    /** Adds this invisible/movable spell entity as a vision origin for its source character. */
    shareVisionWithSource?: true
    /** Keep the authoritative drag hitbox while suppressing the ordinary Token portrait/body. */
    hiddenBody?: true
    /** Rendered only to the source character and DM; authority still retains the token. */
    visibleToSourceOnly?: true
    /** Non-creature Mirror Image projection; it never becomes an attack target or blocks a cell. */
    projectionKind?: 'attack-decoy'
    /** Exact ActiveEffect pool whose remaining count owns this projection. */
    sourceEffectId?: string
    /** Stable one-based position inside the authoritative decoy pool. */
    projectionIndex?: number
  }
  /** Host-owned lock state for an obstacle used as a container or other map object. */
  dnd5eObjectState?: Dnd5eMapObjectStateV1
  /** 未关联角色的生物在 5e Headless 战斗中的持久状态。 */
  dnd5eCombatState?: {
    activityExtraTurnGroup?: import('../application/combat/dnd5eCombatRules').Dnd5eCombatant['classState']['activityExtraTurnGroup']
    activityExtraTurnSuspension?: import('../application/combat/dnd5eCombatRules').Dnd5eCombatant['classState']['activityExtraTurnSuspension']
    slowDelayedSpell?: import('../application/combat/dnd5eCombatRules').Dnd5eCombatant['classState']['slowDelayedSpell']
    schemaVersion?: typeof DND5E_COMBAT_STATE_SCHEMA_VERSION
    /**
     * An unlinked creature at 0 HP is alive and stable.
     * Literal `true` keeps malformed/legacy falsey values out of persisted state.
     */
    stableAtZero?: true
    /** 权威状态实例；由 DM/Headless 写入并通过房间资源同步。 */
    activeEffects?: Dnd5eActiveEffectInstance[]
    /** Host-authored long-lived spell authority records. */
    spellAuthorityRecords?: Record<string, Dnd5eSpellAuthorityRecordV1>
    spellControlledByActorId?: string
    spellControlMentalAbilities?: Pick<Record<import('../lib/dnd').AbilityKey, number>, 'int' | 'wis' | 'cha'>
    spellControlledBodyMentalAbilities?: Pick<Record<import('../lib/dnd').AbilityKey, number>, 'int' | 'wis' | 'cha'>
    caltropsSpeedPenaltyFeet?: number
    /** Stable per-turn attack count used by effects such as Slowing Breath. */
    attacksMadeTurnKey?: string
    attacksMadeThisTurn?: number
    /** Consecutive on-foot movement immediately preceding a possible running jump. */
    runningJumpApproachFeet?: number
    temporaryHp?: number
    undeadFortitudePending?: { dc: number; damage: number; sourceId?: string }
    monsterOnHitSavePending?: {
      sourceId: string
      actionId: string
      ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
      dc: number
      condition: 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled' | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified' | 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious' | 'disease'
      chargeFollowUp?: {
        actionId: string
        referencedActionId: string
        requiredTargetCondition: 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled' | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified' | 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious'
        turnKey: string
      }
    }
    monsterTriggeredBonusAction?: {
      schemaVersion: 1
      combatId: string
      round: number
      turnKey: string
      actionId: string
      referencedActionId: string
      targetId: string
      requiredTargetCondition: 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled' | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified' | 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious'
    }
    activeEffectDamageSavePendingIds?: string[]
    activeEffectDamageSavePendingModes?: Record<string, 'normal' | 'advantage'>
    /** Authoritative death/body state retained for unlinked creatures. */
    deathRound?: number
    deathInitiativeIndex?: number
    /** Host-confirmed cause used by resurrection magic that excludes death from old age. */
    deathCause?: 'other' | 'old-age'
    /** Host-confirmed state of the soul for magic that requires it to be free and willing. */
    soulReturnStatus?: 'free-willing' | 'unwilling' | 'not-free'
    bodyPresent?: boolean
    missingBodyParts?: string[]
    /** A missing essential body part or organ prevents revival that cannot restore parts. */
    vitalBodyPartsMissing?: boolean
    /** Universal d20 penalty from resurrection magic; recovers on long rests. */
    resurrectionPenalty?: { value: number; recoveryPerLongRest: number }
    /** 当前临时生命值若由英雄气概提供，记录来源以便法术结束时精确撤销。 */
    temporaryHitPointsSource?: { actorId: string; rulesId: 'heroism' | 'enhance-ability' }
    /** Recoverable maximum-HP reductions for this unlinked creature. */
    hitPointMaximumReductionLedger?: Dnd5eHitPointMaximumReductionLedger
    /** Ability reductions are reapplied from the immutable stat block after a map reload. */
    abilityScoreReductionLedger?: readonly {
      id: string
      ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
      amount: number
      recovery: 'short-or-long-rest' | 'restoration-magic'
      recoveryGroupId?: string
    }[]
    bardicInspirationDie?: number
    bardicInspirationSourceId?: string
    bardicInspirationRoundsRemaining?: number
    /** 已权威结算的回合开始键（combatId:round:stable slotId）。 */
    turnStartResolvedTurnKey?: string
    /** Reckless is active until this creature's next authoritative turn start. */
    recklessAttackTurnKey?: string
    monsterReactiveAvailableTurnKey?: string
    monsterReactiveUsedTurnKey?: string
    surprisedCombatId?: string
    surpriseResolvedCombatId?: string
    countercharmRoundsRemaining?: number
    intimidatingPresenceSourceId?: string
    intimidatingPresenceRoundsRemaining?: number
    intimidatingPresenceImmunityRoundsBySource?: Record<string, number>
    natureSanctuaryImmunityRoundsByTarget?: Record<string, number>
    turnedByClericId?: string
    turnedRoundsRemaining?: number
    holyNimbusRoundsRemaining?: number
    draconicPresenceImmunityRoundsBySource?: Record<string, number>
    monsterFrightfulPresenceImmunityRoundsBySource?: Record<string, number>
    monsterActionImmunityRoundsByKey?: Record<string, number>
    conditions?: string[]
    stunnedByActorId?: string
    stunnedAppliedTurnKey?: string
    openHandNoReactionsAppliedTurnKeysBySource?: Record<string, string>
    quiveringPalmTargetId?: string
    tranquilityActive?: boolean
    declarativeUsedTurnKeys?: Record<string, string>
    declarativeTransactionIds?: string[]
    /** One-shot weapon attack credentials granted by unified Activities. */
    activityWeaponAttackGrants?: Record<string, Dnd5eActivityWeaponAttackGrantV1>
    declarativeAttackRetargetImmunityFeatureIds?: string[]
    declarativeWardPools?: Record<string, { current: number; max: number }>
    /** Imported save-pressure markers keyed by source combatant. */
    spellSavePressureBySource?: Record<string, {
      appliedTurnKey: string
      sourceTurnsRemaining: number
    }>
    bonusProneEligibleTargetIds?: string[]
    bonusProneEligibleTurnKey?: string
    monsterMechanicRollModifiers?: Array<{
      id: string
      mechanicOwnerId: string
      mechanicId: string
      roll: 'attack' | 'damage' | 'saving-throw'
      mode: 'bonus' | 'advantage' | 'disadvantage'
      bonus?: number
    }>
    pendingMonsterMechanicTriggers?: Record<string, Dnd5eMonsterMechanicTriggerSnapshot>
    monsterMechanicTriggerSequence?: number
    monsterMechanicMovementTurnKey?: string
    monsterMechanicMovementFeet?: number
    monsterMechanicMovementOrigin?: { x: number; y: number }
    monsterMechanicMovementLast?: { x: number; y: number }
    monsterMechanicMovementStraight?: boolean
    hiddenCheckTotal?: number
    hideInPlainSightPrepared?: boolean
    utilityProjectionAttackAdvantage?: {
      featureId: string
      targetId: string
      turnKey: string
    }
    nextD20Advantage?: {
      featureId: string
      rollKinds: Array<'attack' | 'ability-check' | 'saving-throw'>
    }
    postSpellRandomTableCheck?: {
      featureId: string
      spellId: string
      spellLevel: number
      slotLevel: number
      castingClassId: Dnd5eClassId
      forceTable: boolean
    }
    postSpellRandomTableManualAdjudication?: {
      id: string
      featureId: string
      sourceSpellId: string
      tableRoll: number
      outcomeId?: string
    }
    concentrationSpellId?: string
    concentrationSpellLevel?: number
    concentrationTargetIds?: string[]
    concentrationRoundsRemaining?: number
    concentrationStartedTurnKey?: string
    lastCompletedConcentration?: {
      spellId: string
      completedRound?: number
      completedWorldMinute?: number
    }
    concentrationEffectsBySource?: Record<string, string>
    wildShapeFormId?: string
    wildShapeMode?: 'wild-shape' | 'polymorph' | 'true-polymorph' | 'animal-shapes' | 'shapechange'
    wildShapeSourceActorId?: string
    wildShapeSourceActivityId?: string
    wildShapeMaximumChallengeRating?: number
    wildShapeMaximumSizeRank?: number
    shapechangeEquipmentDisposition?: 'drop' | 'merge' | 'wear'
    wildShapeCurrentHp?: number
    wildShapeRoundsRemaining?: number
    wildShapePermanent?: boolean
    wildShapePermanentAfterConcentrationCompletes?: boolean
    wildShapeOriginalCurrentHp?: number
    wildShapeOriginalMaxHp?: number
    wildShapeOriginalArmorClass?: number
    wildShapeOriginalSpeed?: number
    wildShapeOriginalMovementSpeeds?: { walk: number; climb?: number; swim?: number; fly?: number; hover?: boolean }
    wildShapeOriginalSizeRank?: number
    wildShapeOriginalAbilities?: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>
    wildShapeOriginalSavingThrowBonuses?: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>>
    wildShapeOriginalSavingThrowProficiencies?: Array<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'>
    wildShapeOriginalSkillProficiencies?: string[]
    wildShapeOriginalPassivePerception?: number
    wildShapeOriginalStatBlockId?: string
    wildShapeOriginalCreatureType?: string
    wildShapeOriginalDamageVulnerabilities?: Dnd5eDamageType[]
    wildShapeOriginalDamageResistances?: Dnd5eDamageType[]
    wildShapeOriginalDamageImmunities?: Dnd5eDamageType[]
    wildShapeOriginalDamageDefenseRules?: Dnd5eConditionalDamageDefense[]
    wildShapeOriginalMagicResistance?: boolean
    wildShapeOriginalLimitedMagicImmunity?: Dnd5eLimitedMagicImmunityRule
    wildShapeOriginalWeaponAttacksMagical?: boolean
    wildShapeOriginalConditionImmunities?: string[]
    viciousMockeryAttackDisadvantage?: boolean
    helpedAttackSourceId?: string
    helpedAttackSourceTurnKey?: string
    shieldSpellActive?: boolean
    legendaryResistanceUses?: number
    monsterLegendaryActionPoints?: number
    monsterLegendaryMovement?: Dnd5eMonsterLegendaryMovementGrant
    monsterLairActionRoundUsed?: number
    monsterLairActionLastId?: string
    monsterRechargeReadyByActionId?: Record<string, boolean>
    monsterActionUsesByActionId?: Record<string, { current: number; max: number }>
    monsterSpellSlots?: Record<string, { current: number; max: number }>
    monsterSpellUsesBySpellId?: Record<string, { current: number; max: number }>
    monsterMultiattackContinuation?: {
      schemaVersion: 1
      combatId: string
      round: number
      turnKey: string
      parentActionId: string
      nextOccurrenceIndex: number
      sequenceActionIds: string[]
      targetIds: string[]
      hitByOccurrence: boolean[]
    }
    monsterShapechangeOriginalStatBlockId?: string
    monsterShapechangeFormId?: string
    /** Moonbeam areas whose light currently prevents another transformation. */
    shapechangerReversionAreaIds?: string[]
    monsterRegenerationSuppressedDamageTypes?: Dnd5eDamageType[]
    monsterRegenerationPendingAtZero?: boolean
    monsterBerserk?: boolean
    monsterDamageAversionActive?: boolean
    monsterDamageAversionSourceActorId?: string
    monsterHydraHeadCount?: number
    monsterHydraHeadsLostSinceLastTurn?: number
    monsterHydraDamageTurnKey?: string
    monsterHydraDamageTakenThisTurn?: number
    monsterHydraHeadSeveredTurnKey?: string
    monsterHydraFireDamageSinceLastTurn?: boolean
    monsterSwallowedInternalDamageTurnKey?: string
    monsterSwallowedInternalDamageBySourceId?: Record<string, number>
    /** 由 Headless 按有效承伤累计；DM 可在怪物面板中调整。 */
    monsterThreatByTargetId?: Record<string, number>
    hurlThroughHellSourceId?: string
    hurlThroughHellDamage?: number
    hurlThroughHellAppliedTurnKey?: string
  }
  obstacleKind?: string
  /** Token 底部相对地图地面的高度；用于墙体跨越、视线和效果线。 */
  elevationFeet?: number
  /** 覆盖地图几何中的默认视野半径。 */
  visionRangeFeet?: number
  /** 2014 规则中的黑暗视觉距离；0 或缺失表示没有黑暗视觉。 */
  darkvisionRangeFeet?: number
  /** Room-scoped rules projection; stores only a resolved number, never source content. */
  dnd5eCharacterDarkvisionRangeFeet?: number
  /** Sees normally in nonmagical darkness, such as Devil's Sight. */
  darknessSightRangeFeet?: number
  /** Sees normally through magical darkness, such as Devil's Sight. */
  magicalDarknessSightRangeFeet?: number
  /** 特殊感官由地图快照投影到 Headless；距离外仍按普通视线判定。 */
  blindsightRangeFeet?: number
  tremorsenseRangeFeet?: number
  truesightRangeFeet?: number
  /** 魔鬼视界等明确能力；普通黑暗视觉不会设置此字段。 */
  canSeeMagicalDarkness?: boolean
  /** Token 携带的火把、法术或物品光源。 */
  lightSource?: {
    enabled: boolean
    brightRadiusFeet: number
    dimRadiusFeet: number
    color: string
    /** The light counts as sunlight for rules that consume sunlight exposure. */
    sunlight?: true
    sourceKind?: CampaignLightSourceKind
    startedAtWorldMinute?: number
    durationMinutes?: number
    expiresAtWorldMinute?: number
  }
  /** 玩家端可见性：动态视野、始终显示，或仅 DM 可见。 */
  visibilityMode?: 'line-of-sight' | 'always' | 'dm-only'
  /** 服务端安全投影：知道其位置，但尚未真正看见该生物。 */
  perceptionVisibility?: 'detected-unseen'
  /** DM 权威路径；各端只按路径做本地插值，最终坐标仍以 x/y 为准。 */
  movementAnimation?: TokenMovementAnimation
}

type LegacyTokenSave = Omit<Partial<Token>, 'dnd5eCombatState'> & {
  burningTurns?: number
  igniteTurns?: number
  poisonTurns?: number
  knockbackTurns?: number
  stunTurns?: number
  restrainedTurns?: number
  vulnerableTurns?: number
  noMoveTurns?: number
  illusionDanceTurns?: number
  huntingMarkStacks?: number
  dnd5eCombatState?: NonNullable<Token['dnd5eCombatState']> & {
    timedEffects?: Dnd5eTimedEffect[]
  }
}

export interface BattleMap {
  id: string
  name: string
  width: number
  height: number
  gridSize: number // 每格像素（1 格 = 5 尺）
  gridOffsetX: number
  gridOffsetY: number
  showGrid: boolean
  /** 上传时识别到底图自带网格 */
  builtinGridDetected?: boolean
  feetPerCell?: number
  /** 叠加网格颜色 #RRGGBB */
  gridColor?: string
  /** 叠加网格不透明度 0–1 */
  gridOpacity?: number
  /** 显示地图格子的 X/Y 坐标轴 */
  showCoordinates?: boolean
  /** 勾选后玩家、敌人和 NPC 拖放时吸附到格心。 */
  snapMonstersToGrid?: boolean
  /** 由 D&D 5e Headless 物品事务创建的持久地图区域。 */
  dnd5eItemAreas?: Dnd5eItemArea[]
  /** 由规则包声明、DM Headless 事务创建的持续范围实体。 */
  dnd5ePluginAreas?: Dnd5ePluginArea[]
  /** 独立于 Konva 世界坐标的屏幕贴层；地图平移与缩放不会移动这些内容。 */
  viewportNotes?: MapViewportNote[]
  tokens: Token[]
}

export type Dnd5eItemAreaKind = 'ball-bearings' | 'caltrops' | 'hunting-trap'

export interface Dnd5eItemArea {
  id: string
  kind: Dnd5eItemAreaKind
  sourceCharacterId: string
  sourceTokenId: string
  sourceItemTemplateId: string
  sourceItemName: string
  cells: Array<{ col: number; row: number }>
  createdAt: number
  /** 捕猎陷阱触发后解除武装，并记录当前被困 token。 */
  armed: boolean
  triggeredTokenId?: string
}

export interface Dnd5ePluginArea {
  id: string
  pluginId: string
  featureId: string
  /** 旧存档缺省为 plugin-feature；核心 SRD 法术使用 core-spell。 */
  sourceKind?: Dnd5ePersistentAreaSourceKind
  coreSpellId?: string
  /** Content-neutral projection identity used by feature spell origins and attack predicates. */
  utilityProjectionId?: string
  /** Core spellcasting source captured when the area was created. */
  castingClassId?: Dnd5eClassId
  slotLevel?: number
  /** Class-derived save DC captured at creation; spell attacks use DC - 8. */
  sourceSpellSaveDc?: number
  label: string
  color: string
  sourceCharacterId: string
  sourceTokenId: string
  cells: Array<{ col: number; row: number }>
  createdRound: number
  expiresAfterRound: number
  /** Exploration-time creation boundary captured from the authoritative campaign clock. */
  createdWorldMinute?: number
  /** Finite areas expire when the authoritative campaign clock reaches this minute. */
  expiresAtWorldMinute?: number
  /** Until-dispelled areas ignore the synthetic combat-round expiry sentinel. */
  permanent?: true
  /** Host-owned mapped-object enchantment and its bounded open-text payload. */
  magicMouth?: Dnd5eMagicMouthStateV1
  /** Host-approved declaration shown with a Minor Illusion map marker. */
  minorIllusion?: Dnd5eMinorIllusionConfigV1
  /** 到达指定轮次后，在来源 Token 的回合结束边界移除。 */
  expiresAtSourceTurnEndAfterRound?: number
  /** Core Web-only lifecycle state: unsupported webs collapse at the caster's turn start; ignited cubes burn for one round. */
  webState?: {
    unsupportedCollapseAtRound?: number
    burningCells?: Array<{
      col: number
      row: number
      ignitedRound: number
      expiresAtRound: number
      expiresAtTurnTokenId: string
    }>
  }
  concentrationId?: string
  /** fixed 保持落点；source-token 跟随施法者；effect-token 跟随独立法术实体。 */
  anchorMode?: Dnd5ePersistentAreaAnchorMode
  anchorTokenId?: string
  anchorCell?: { col: number; row: number }
  /** Authoritative vertical extent; absent preserves legacy unbounded-column behavior. */
  vertical?: Dnd5ePersistentAreaVerticalSnapshot
  movement?: Dnd5ePersistentAreaMovementDeclaration
  /** Independent effect-token following and load contract. */
  sourceFollower?: Dnd5ePersistentAreaSourceFollower
  /** Host-owned source-turn evolution; progress fields make retries idempotent. */
  lifecycle?: Dnd5ePersistentAreaTurnLifecycle
  lifecycleAdvances?: number
  lifecycleLastTurnKey?: string
  /** 区域内移动成本倍数；例如灵体卫士为 2。 */
  movementCostMultiplier?: number
  relation?: 'any' | 'ally' | 'enemy'
  includeSelf?: boolean
  excludedTargetIds?: string[]
  /** 隐蔽区域只投影给来源角色与 DM，直到 DM 将其揭示。 */
  hiddenFromPlayers?: boolean
  /** 与权威视线判定共享的声明式光照/魔法黑暗。 */
  lighting?: Dnd5ePersistentAreaLighting
  /** Permanent Hallow choices captured at cast time. */
  hallow?: Dnd5eHallowAreaState
  /** Hallucinatory Terrain's selected natural-terrain appearance. */
  hallucinatoryTerrain?: Dnd5eHallucinatoryTerrainAreaState
  /** Programmed Illusion's selected form and trigger-sense declaration. */
  programmedIllusion?: Dnd5eProgrammedIllusionAreaState
  /** A bounded interior light level that overrides brighter ambient light inside this area. */
  illuminationOverride?: 'dim' | 'darkness'
  /** Non-light visibility volume, such as smoke, gas or underwater ink. */
  obscuration?: Dnd5ePersistentAreaObscuration
  /** Rules projected only while a creature occupies this area. */
  occupantModifiers?: Dnd5ePersistentAreaOccupantModifiers
  /** Physical blocking supplied by a wall-like area. */
  blocking?: Dnd5ePersistentAreaBlocking
  /**
   * Host-resolved movement rule for an entity interposed between its source
   * and one selected target. The target id and Strength branch are captured
   * when the command resolves; clients never infer either value from prose.
   */
  interposition?: {
    targetTokenId: string
    mode: 'blocked' | 'difficult-terrain'
  }
  /** Host-projected weapon-hit rider for eligible creatures currently in this area. */
  weaponHitBonusDamage?: Dnd5ePersistentAreaWeaponHitBonusDamage
  /** Closed rules facts for a spell-created map entity such as Unseen Servant. */
  entityProfile?: {
    armorClass: number
    hitPoints: number
    strength: number
    dexterity?: number
    cannotAttack: boolean
    invisible: boolean
  }
  /** Host-owned current HP for a spell-created entity; absent legacy values start at maximum HP. */
  entityCurrentHitPoints?: number
  /** Host-validated active controls available only while this area exists. */
  grantedActivities?: Dnd5ePersistentAreaGrantedActivity[]
  /** Activity ids whose one-time activate-on-create use has been consumed. */
  grantedActivityUseReceipts?: string[]
  /** Optional independent light origins for one multi-point spell area. */
  lightingAnchorCells?: Array<{ col: number; row: number }>
  /** Dancing Lights presentation selected at cast time. */
  dancingLightsForm?: 'lights' | 'humanoid'
  visual?: Dnd5ePersistentAreaVisual
  /** Exact host-approved Wall of Fire placement used by presentation and turn-end damage. */
  wallOfFireGeometry?: {
    shape: 'line' | 'ring'
    angleDegrees: number
    damagingSide: 'left' | 'right' | 'inside' | 'outside'
    lengthFeet?: number
    diameterFeet?: number
  }
  triggers?: Dnd5ePersistentAreaTriggerSnapshot[]
  triggerReceipts?: Dnd5ePersistentAreaTriggerReceipt[]
  /** Remove a fixed area as soon as its source Token leaves it. */
  sourceExitBehavior?: 'remove-area'
  /** Remove a source-anchored area if source movement encloses an affected creature. */
  sourceOverlapBehavior?: 'remove-area'
}

/** 地图存档 V17：规范化可选、受限的持久区域垂直快照。 */
export const MAPS_PERSIST_VERSION = 20

const TOKEN_TYPES: ReadonlyArray<Token['type']> = ['player', 'enemy', 'npc', 'obstacle']

/** 将旧或残缺 token 规整为当前 D&D 5e Token。 */
function normalizeToken(raw: unknown): Token {
  const legacy = (raw ?? {}) as LegacyTokenSave
  const {
    portrait: _projectedPortrait,
    tokenPortrait: _projectedTokenPortrait,
    viewerControlled: _projectedViewerControlled,
    burningTurns: _burningTurns,
    igniteTurns: _igniteTurns,
    poisonTurns: _poisonTurns,
    knockbackTurns: _knockbackTurns,
    stunTurns: _stunTurns,
    restrainedTurns: _restrainedTurns,
    vulnerableTurns: _vulnerableTurns,
    noMoveTurns: _noMoveTurns,
    illusionDanceTurns: _illusionDanceTurns,
    huntingMarkStacks: _huntingMarkStacks,
    dnd5eCombatState: legacyCombatState,
    ...t
  } = legacy
  const type = TOKEN_TYPES.includes(t.type as Token['type']) ? (t.type as Token['type']) : 'enemy'
  const preset = TOKEN_PRESETS[type]
  const rawSize = Number.isFinite(t.size) && (t.size as number) > 0 ? (t.size as number) : 1
  const creatureSize =
    normalizeCreatureSize(t.creatureSize) ?? (type === 'enemy' || type === 'npc' ? sizeFromTokenSize(rawSize) : undefined)
  const creatureTypes = normalizeCreatureTypes(t.creatureTypes)
  const rawSummon = t.dnd5eSummon
  const rawTruePolymorphObject = rawSummon?.truePolymorphOriginalObject
  const truePolymorphOriginalObject = rawTruePolymorphObject &&
    rawTruePolymorphObject.schemaVersion === 1 &&
    typeof rawTruePolymorphObject.id === 'string' && !!rawTruePolymorphObject.id &&
    typeof rawTruePolymorphObject.label === 'string' &&
    Number.isFinite(rawTruePolymorphObject.x) && Number.isFinite(rawTruePolymorphObject.y) &&
    typeof rawTruePolymorphObject.color === 'string' &&
    typeof rawTruePolymorphObject.emoji === 'string' &&
    Number.isFinite(rawTruePolymorphObject.size) && rawTruePolymorphObject.size > 0
    ? {
        schemaVersion: 1 as const,
        id: rawTruePolymorphObject.id,
        label: rawTruePolymorphObject.label.slice(0, 160),
        x: Number(rawTruePolymorphObject.x),
        y: Number(rawTruePolymorphObject.y),
        color: rawTruePolymorphObject.color,
        emoji: rawTruePolymorphObject.emoji,
        size: Number(rawTruePolymorphObject.size),
        hp: Number.isFinite(rawTruePolymorphObject.hp) ? Math.max(0, Number(rawTruePolymorphObject.hp)) : undefined,
        maxHp: Number.isFinite(rawTruePolymorphObject.maxHp) ? Math.max(1, Number(rawTruePolymorphObject.maxHp)) : undefined,
        obstacleKind: typeof rawTruePolymorphObject.obstacleKind === 'string' ? rawTruePolymorphObject.obstacleKind : undefined,
        elevationFeet: Number.isFinite(rawTruePolymorphObject.elevationFeet) ? Math.max(0, Number(rawTruePolymorphObject.elevationFeet)) : undefined,
        portraitImageId: typeof rawTruePolymorphObject.portraitImageId === 'string' ? rawTruePolymorphObject.portraitImageId : undefined,
        tokenPortraitImageId: typeof rawTruePolymorphObject.tokenPortraitImageId === 'string' ? rawTruePolymorphObject.tokenPortraitImageId : undefined,
        showHpOnToken: typeof rawTruePolymorphObject.showHpOnToken === 'boolean' ? rawTruePolymorphObject.showHpOnToken : undefined,
        showDetailOnToken: typeof rawTruePolymorphObject.showDetailOnToken === 'boolean' ? rawTruePolymorphObject.showDetailOnToken : undefined,
        visibilityMode: rawTruePolymorphObject.visibilityMode === 'always' || rawTruePolymorphObject.visibilityMode === 'dm-only' || rawTruePolymorphObject.visibilityMode === 'line-of-sight'
          ? rawTruePolymorphObject.visibilityMode
          : undefined,
        lightSource: rawTruePolymorphObject.lightSource ? { ...rawTruePolymorphObject.lightSource } : undefined,
        dnd5eObjectState: rawTruePolymorphObject.dnd5eObjectState
          ? normalizeDnd5eMapObjectStateV1(rawTruePolymorphObject.dnd5eObjectState)
          : undefined,
      }
    : undefined
  const dnd5eSummon = rawSummon && typeof rawSummon === 'object' &&
    rawSummon.schemaVersion === 1 &&
    typeof rawSummon.pluginId === 'string' && !!rawSummon.pluginId &&
    typeof rawSummon.featureId === 'string' && !!rawSummon.featureId &&
    typeof rawSummon.sourceCharacterId === 'string' && !!rawSummon.sourceCharacterId &&
    typeof rawSummon.sourceTokenId === 'string' && !!rawSummon.sourceTokenId &&
    Number.isInteger(rawSummon.createdRound) && Number(rawSummon.createdRound) >= 0 &&
    Number.isInteger(rawSummon.expiresAfterRound) && Number(rawSummon.expiresAfterRound) >= Number(rawSummon.createdRound) &&
    Number(rawSummon.expiresAfterRound) - Number(rawSummon.createdRound) + 1 <= 14_400 &&
    (rawSummon.concentrationId == null || (typeof rawSummon.concentrationId === 'string' && !!rawSummon.concentrationId)) &&
    (rawSummon.persistent == null || rawSummon.persistent === true) &&
    (rawSummon.persistAfterConcentrationCompletes == null || rawSummon.persistAfterConcentrationCompletes === true) &&
    (rawSummon.becomesHostileAfterConcentrationEnds == null || rawSummon.becomesHostileAfterConcentrationEnds === true) &&
    (rawSummon.controlEnded == null || rawSummon.controlEnded === true) &&
    (rawSummon.createdWorldMinute == null || (Number.isSafeInteger(rawSummon.createdWorldMinute) && Number(rawSummon.createdWorldMinute) >= 0)) &&
    (rawSummon.controlExpiresAtWorldMinute == null || (
      Number.isSafeInteger(rawSummon.controlExpiresAtWorldMinute) &&
      Number(rawSummon.controlExpiresAtWorldMinute) >= Number(rawSummon.createdWorldMinute ?? 0)
    )) &&
    (rawSummon.persistAfterConcentrationCompletes !== true || (
      typeof rawSummon.concentrationId === 'string' && !!rawSummon.concentrationId && rawSummon.persistent !== true
    )) &&
    (rawSummon.becomesHostileAfterConcentrationEnds !== true || (
      typeof rawSummon.concentrationId === 'string' && !!rawSummon.concentrationId &&
      rawSummon.persistent !== true && rawSummon.persistAfterConcentrationCompletes !== true
    )) &&
    (rawSummon.controlEnded !== true || rawSummon.concentrationId == null) &&
    (rawSummon.minimumMaximumHitPoints == null || (Number.isInteger(rawSummon.minimumMaximumHitPoints) && Number(rawSummon.minimumMaximumHitPoints) >= 1 && Number(rawSummon.minimumMaximumHitPoints) <= 1_000_000)) &&
    (rawSummon.maximumHitPointBonus == null || (Number.isInteger(rawSummon.maximumHitPointBonus) && Number(rawSummon.maximumHitPointBonus) >= 0 && Number(rawSummon.maximumHitPointBonus) <= 1_000_000)) &&
    (rawSummon.armorClassBonus == null || (Number.isInteger(rawSummon.armorClassBonus) && Number(rawSummon.armorClassBonus) >= 0 && Number(rawSummon.armorClassBonus) <= 1_000)) &&
    (rawSummon.weaponAttackBonus == null || (Number.isInteger(rawSummon.weaponAttackBonus) && Number(rawSummon.weaponAttackBonus) >= 0 && Number(rawSummon.weaponAttackBonus) <= 1_000)) &&
    (rawSummon.weaponDamageBonus == null || (Number.isInteger(rawSummon.weaponDamageBonus) && Number(rawSummon.weaponDamageBonus) >= 0 && Number(rawSummon.weaponDamageBonus) <= 1_000_000)) &&
    (rawSummon.savingThrowBonus == null || (Number.isInteger(rawSummon.savingThrowBonus) && Number(rawSummon.savingThrowBonus) >= 0 && Number(rawSummon.savingThrowBonus) <= 1_000)) &&
    (rawSummon.proficientSkillCheckBonus == null || (Number.isInteger(rawSummon.proficientSkillCheckBonus) && Number(rawSummon.proficientSkillCheckBonus) >= 0 && Number(rawSummon.proficientSkillCheckBonus) <= 1_000)) &&
    (rawSummon.weaponAttacksMagical == null || rawSummon.weaponAttacksMagical === true) &&
    (rawSummon.attacksPerAction == null || (Number.isInteger(rawSummon.attacksPerAction) && Number(rawSummon.attacksPerAction) >= 1 && Number(rawSummon.attacksPerAction) <= 10)) &&
    (rawSummon.shareSelfSpellsRangeFeet == null || (Number.isInteger(rawSummon.shareSelfSpellsRangeFeet) && Number(rawSummon.shareSelfSpellsRangeFeet) >= 5 && Number(rawSummon.shareSelfSpellsRangeFeet) <= 10_000)) &&
    (rawSummon.cannotAttack == null || rawSummon.cannotAttack === true) &&
    (rawSummon.walkingSpeedFeet == null || (Number.isInteger(rawSummon.walkingSpeedFeet) && Number(rawSummon.walkingSpeedFeet) >= 0 && Number(rawSummon.walkingSpeedFeet) <= 1_000)) &&
    (rawSummon.dismissAfterDamageRounds == null || (Number.isInteger(rawSummon.dismissAfterDamageRounds) && Number(rawSummon.dismissAfterDamageRounds) >= 1 && Number(rawSummon.dismissAfterDamageRounds) <= 10_000)) &&
    (rawSummon.dismissAtRound == null || (Number.isInteger(rawSummon.dismissAtRound) && Number(rawSummon.dismissAtRound) >= Number(rawSummon.createdRound) && Number(rawSummon.dismissAtRound) <= Number(rawSummon.expiresAfterRound))) &&
    (rawSummon.truePolymorphOriginalObject == null || truePolymorphOriginalObject != null) &&
    (rawSummon.side === 'player' || rawSummon.side === 'enemy')
    ? {
        schemaVersion: 1 as const,
        pluginId: rawSummon.pluginId,
        featureId: rawSummon.featureId,
        sourceCharacterId: rawSummon.sourceCharacterId,
        sourceTokenId: rawSummon.sourceTokenId,
        createdRound: rawSummon.createdRound,
        expiresAfterRound: rawSummon.expiresAfterRound,
        concentrationId: rawSummon.concentrationId,
        side: rawSummon.side,
        persistent: rawSummon.persistent === true ? true as const : undefined,
        persistAfterConcentrationCompletes: rawSummon.persistAfterConcentrationCompletes === true ? true as const : undefined,
        becomesHostileAfterConcentrationEnds: rawSummon.becomesHostileAfterConcentrationEnds === true ? true as const : undefined,
        controlEnded: rawSummon.controlEnded === true ? true as const : undefined,
        createdWorldMinute: rawSummon.createdWorldMinute,
        controlExpiresAtWorldMinute: rawSummon.controlExpiresAtWorldMinute,
        minimumMaximumHitPoints: rawSummon.minimumMaximumHitPoints,
        maximumHitPointBonus: rawSummon.maximumHitPointBonus,
        armorClassBonus: rawSummon.armorClassBonus,
        weaponAttackBonus: rawSummon.weaponAttackBonus,
        weaponDamageBonus: rawSummon.weaponDamageBonus,
        savingThrowBonus: rawSummon.savingThrowBonus,
        proficientSkillCheckBonus: rawSummon.proficientSkillCheckBonus,
        weaponAttacksMagical: rawSummon.weaponAttacksMagical === true ? true as const : undefined,
        attacksPerAction: rawSummon.attacksPerAction,
        shareSelfSpellsRangeFeet: rawSummon.shareSelfSpellsRangeFeet,
        cannotAttack: rawSummon.cannotAttack === true ? true as const : undefined,
        walkingSpeedFeet: rawSummon.walkingSpeedFeet,
        dismissAfterDamageRounds: rawSummon.dismissAfterDamageRounds,
        dismissAtRound: rawSummon.dismissAtRound,
        truePolymorphOriginalObject,
      }
    : undefined
  const rawSpellEffect = t.dnd5eSpellEffect
  const attackDecoyProjectionValid = rawSpellEffect && typeof rawSpellEffect === 'object' &&
    rawSpellEffect.projectionKind === 'attack-decoy' &&
    rawSpellEffect.spellId === 'mirror-image' &&
    typeof rawSpellEffect.sourceEffectId === 'string' && !!rawSpellEffect.sourceEffectId &&
    Number.isInteger(rawSpellEffect.projectionIndex) &&
    Number(rawSpellEffect.projectionIndex) >= 1 && Number(rawSpellEffect.projectionIndex) <= 20
  const dnd5eSpellEffect = rawSpellEffect && typeof rawSpellEffect === 'object' &&
    t.type === 'obstacle' &&
    rawSpellEffect.schemaVersion === 1 &&
    typeof rawSpellEffect.spellId === 'string' && !!rawSpellEffect.spellId &&
    typeof rawSpellEffect.sourceCharacterId === 'string' && !!rawSpellEffect.sourceCharacterId &&
    typeof rawSpellEffect.sourceTokenId === 'string' && !!rawSpellEffect.sourceTokenId &&
    Number.isInteger(rawSpellEffect.createdRound) && Number(rawSpellEffect.createdRound) >= 0 &&
    Number.isInteger(rawSpellEffect.expiresAfterRound) &&
    Number(rawSpellEffect.expiresAfterRound) >= Number(rawSpellEffect.createdRound) &&
    Number(rawSpellEffect.expiresAfterRound) - Number(rawSpellEffect.createdRound) + 1 <= DND5E_PERSISTENT_AREA_DURATION_MAX_ROUNDS &&
    (rawSpellEffect.concentrationId == null ||
      (typeof rawSpellEffect.concentrationId === 'string' && !!rawSpellEffect.concentrationId)) &&
    (rawSpellEffect.shareVisionWithSource == null || rawSpellEffect.shareVisionWithSource === true) &&
    (rawSpellEffect.hiddenBody == null || rawSpellEffect.hiddenBody === true) &&
    (rawSpellEffect.visibleToSourceOnly == null || rawSpellEffect.visibleToSourceOnly === true) &&
    (rawSpellEffect.projectionKind == null || attackDecoyProjectionValid)
    ? {
        schemaVersion: 1 as const,
        spellId: rawSpellEffect.spellId,
        sourceCharacterId: rawSpellEffect.sourceCharacterId,
        sourceTokenId: rawSpellEffect.sourceTokenId,
        createdRound: rawSpellEffect.createdRound,
        expiresAfterRound: rawSpellEffect.expiresAfterRound,
        concentrationId: rawSpellEffect.concentrationId,
        shareVisionWithSource: rawSpellEffect.shareVisionWithSource === true ? true as const : undefined,
        hiddenBody: rawSpellEffect.hiddenBody === true ? true as const : undefined,
        visibleToSourceOnly: rawSpellEffect.visibleToSourceOnly === true ? true as const : undefined,
        projectionKind: attackDecoyProjectionValid ? 'attack-decoy' as const : undefined,
        sourceEffectId: attackDecoyProjectionValid ? rawSpellEffect.sourceEffectId : undefined,
        projectionIndex: attackDecoyProjectionValid ? Number(rawSpellEffect.projectionIndex) : undefined,
      }
    : undefined
  const rawSimulacrum = t.dnd5eSimulacrum
  const simulacrumAbilitiesValid = rawSimulacrum && typeof rawSimulacrum === 'object' &&
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].every((ability) =>
      Number.isInteger(rawSimulacrum.abilities?.[ability as keyof typeof rawSimulacrum.abilities]) &&
      Number(rawSimulacrum.abilities?.[ability as keyof typeof rawSimulacrum.abilities]) >= 1 &&
      Number(rawSimulacrum.abilities?.[ability as keyof typeof rawSimulacrum.abilities]) <= 30)
  const dnd5eSimulacrum = rawSimulacrum && typeof rawSimulacrum === 'object' &&
    rawSimulacrum.schemaVersion === 1 &&
    typeof rawSimulacrum.sourceTokenId === 'string' && !!rawSimulacrum.sourceTokenId &&
    typeof rawSimulacrum.subjectTokenId === 'string' && !!rawSimulacrum.subjectTokenId &&
    typeof rawSimulacrum.sourceCharacterId === 'string' && !!rawSimulacrum.sourceCharacterId &&
    typeof rawSimulacrum.sourceActivityId === 'string' && !!rawSimulacrum.sourceActivityId &&
    Number.isInteger(rawSimulacrum.createdRound) && Number(rawSimulacrum.createdRound) >= 0 &&
    Number.isInteger(rawSimulacrum.level) && Number(rawSimulacrum.level) >= 0 && Number(rawSimulacrum.level) <= 30 &&
    Number.isInteger(rawSimulacrum.maximumHitPoints) && Number(rawSimulacrum.maximumHitPoints) >= 1 &&
    simulacrumAbilitiesValid && rawSimulacrum.cannotIncreaseLevel === true &&
    rawSimulacrum.cannotRegainSpellSlots === true &&
    rawSimulacrum.cannotRegainHitPoints === true
      ? structuredClone(rawSimulacrum)
      : undefined
  const dnd5eObjectState = t.type === 'obstacle'
    ? normalizeDnd5eMapObjectStateV1(t.dnd5eObjectState)
    : undefined
  const invalidCurrentEffects = legacyCombatState?.schemaVersion === DND5E_COMBAT_STATE_SCHEMA_VERSION &&
    !validateDnd5eActiveEffectsStrict(legacyCombatState.activeEffects).ok
  const migratedEffects = legacyCombatState && !invalidCurrentEffects
    ? migrateDnd5eCombatStateEffects({
        targetId: typeof t.id === 'string' && t.id ? t.id : 'legacy-token',
        state: legacyCombatState,
        conditions: legacyCombatState.conditions,
      })
    : undefined
  const {
    timedEffects: _legacyTimedEffects,
    stableAtZero: _legacyStableAtZero,
    ...nativeCombatState
  } = legacyCombatState ?? {}
  const stableAtZero = !t.characterId && t.hp === 0 && _legacyStableAtZero === true
    ? true as const
    : undefined
  const monsterThreatByTargetId = legacyCombatState?.monsterThreatByTargetId &&
    typeof legacyCombatState.monsterThreatByTargetId === 'object'
    ? Object.fromEntries(Object.entries(legacyCombatState.monsterThreatByTargetId).flatMap(([targetId, value]) =>
        targetId.length > 0 && targetId.length <= 160 && Number.isFinite(value) && Number(value) >= 0
          ? [[targetId, Math.min(1_000_000_000, Math.floor(Number(value)))]]
          : [],
      ))
    : undefined
  void _burningTurns
  void _projectedPortrait
  void _projectedTokenPortrait
  void _projectedViewerControlled
  void _igniteTurns
  void _poisonTurns
  void _knockbackTurns
  void _stunTurns
  void _restrainedTurns
  void _vulnerableTurns
  void _noMoveTurns
  void _illusionDanceTurns
  void _huntingMarkStacks
  void _legacyTimedEffects
  return {
    ...t,
    id: typeof t.id === 'string' && t.id ? t.id : uid(),
    label: typeof t.label === 'string' ? t.label : '',
    x: Number.isFinite(t.x) ? (t.x as number) : 0,
    y: Number.isFinite(t.y) ? (t.y as number) : 0,
    color: typeof t.color === 'string' && t.color ? t.color : preset.color,
    emoji: typeof t.emoji === 'string' && t.emoji ? t.emoji : preset.emoji,
    portraitImageId: typeof t.portraitImageId === 'string' && /^[a-z0-9_-]{1,160}$/i.test(t.portraitImageId)
      ? t.portraitImageId
      : undefined,
    tokenPortraitImageId: typeof t.tokenPortraitImageId === 'string' && /^[a-z0-9_-]{1,160}$/i.test(t.tokenPortraitImageId)
      ? t.tokenPortraitImageId
      : undefined,
    visualVariantId: typeof t.visualVariantId === 'string' && /^[a-z0-9_-]{1,80}$/i.test(t.visualVariantId)
      ? t.visualVariantId
      : undefined,
    dnd5eTokenStatusMarkers: normalizeDnd5eTokenStatusMarkers(t.dnd5eTokenStatusMarkers),
    dnd5eSuppressedStatusMarkerIds: normalizeDnd5eSuppressedTokenStatusMarkerIds(
      t.dnd5eSuppressedStatusMarkerIds,
    ),
    size: creatureSize ? creatureSizeToTokenSize(creatureSize) : rawSize,
    type,
    merchantShopId: type === 'npc' && typeof t.merchantShopId === 'string' &&
      /^[a-z0-9:._-]{1,180}$/i.test(t.merchantShopId)
      ? t.merchantShopId
      : undefined,
    dnd5eSide: t.dnd5eSide === 'player' || t.dnd5eSide === 'enemy'
      ? t.dnd5eSide
      : undefined,
    creatureTypes: creatureTypes.length > 0 ? creatureTypes : undefined,
    creatureSize,
    dnd5eTargetingPreference: normalizeDnd5eMonsterTargetingPreference(t.dnd5eTargetingPreference),
    dnd5eBehaviorPreference: normalizeDnd5eMonsterBehaviorPreference(t.dnd5eBehaviorPreference),
    dnd5eSummon,
    dnd5eSimulacrum,
    dnd5eSpellEffect,
    dnd5eObjectState,
    elevationFeet: Number.isFinite(t.elevationFeet) ? Math.max(-1_000, Math.min(10_000, t.elevationFeet as number)) : undefined,
    visionRangeFeet: Number.isFinite(t.visionRangeFeet) ? Math.max(0, Math.min(10_000, t.visionRangeFeet as number)) : undefined,
    darkvisionRangeFeet: Number.isFinite(t.darkvisionRangeFeet) ? Math.max(0, Math.min(10_000, t.darkvisionRangeFeet as number)) : undefined,
    dnd5eCharacterDarkvisionRangeFeet: Number.isFinite(t.dnd5eCharacterDarkvisionRangeFeet)
      ? Math.max(0, Math.min(10_000, t.dnd5eCharacterDarkvisionRangeFeet as number))
      : undefined,
    darknessSightRangeFeet: Number.isFinite(t.darknessSightRangeFeet) ? Math.max(0, Math.min(10_000, t.darknessSightRangeFeet as number)) : undefined,
    magicalDarknessSightRangeFeet: Number.isFinite(t.magicalDarknessSightRangeFeet) ? Math.max(0, Math.min(10_000, t.magicalDarknessSightRangeFeet as number)) : undefined,
    blindsightRangeFeet: Number.isFinite(t.blindsightRangeFeet) ? Math.max(0, Math.min(10_000, t.blindsightRangeFeet as number)) : undefined,
    tremorsenseRangeFeet: Number.isFinite(t.tremorsenseRangeFeet) ? Math.max(0, Math.min(10_000, t.tremorsenseRangeFeet as number)) : undefined,
    truesightRangeFeet: Number.isFinite(t.truesightRangeFeet) ? Math.max(0, Math.min(10_000, t.truesightRangeFeet as number)) : undefined,
    canSeeMagicalDarkness: t.canSeeMagicalDarkness === true ? true : undefined,
    lightSource: t.lightSource && typeof t.lightSource === 'object' &&
      Number.isFinite(t.lightSource.brightRadiusFeet) && Number.isFinite(t.lightSource.dimRadiusFeet) &&
      typeof t.lightSource.enabled === 'boolean' && typeof t.lightSource.color === 'string'
      ? {
          enabled: t.lightSource.enabled,
          brightRadiusFeet: Math.max(0, Math.min(10_000, t.lightSource.brightRadiusFeet)),
          dimRadiusFeet: Math.max(0, Math.min(10_000, t.lightSource.dimRadiusFeet)),
          color: /^#[0-9a-f]{6}$/i.test(t.lightSource.color) ? t.lightSource.color : '#fbbf24',
          ...(t.lightSource.sunlight === true ? { sunlight: true as const } : {}),
          sourceKind: ['permanent', 'torch', 'candle', 'lamp', 'hooded-lantern', 'spell', 'custom'].includes(String(t.lightSource.sourceKind))
            ? t.lightSource.sourceKind as CampaignLightSourceKind
            : undefined,
          startedAtWorldMinute: Number.isSafeInteger(t.lightSource.startedAtWorldMinute) && Number(t.lightSource.startedAtWorldMinute) >= 0
            ? Number(t.lightSource.startedAtWorldMinute)
            : undefined,
          durationMinutes: Number.isSafeInteger(t.lightSource.durationMinutes) && Number(t.lightSource.durationMinutes) > 0
            ? Number(t.lightSource.durationMinutes)
            : undefined,
          expiresAtWorldMinute: Number.isSafeInteger(t.lightSource.expiresAtWorldMinute) && Number(t.lightSource.expiresAtWorldMinute) >= 0
            ? Number(t.lightSource.expiresAtWorldMinute)
            : undefined,
        }
      : undefined,
    visibilityMode: t.visibilityMode === 'always' || t.visibilityMode === 'dm-only' || t.visibilityMode === 'line-of-sight'
      ? t.visibilityMode
      : undefined,
    perceptionVisibility: t.perceptionVisibility === 'detected-unseen' ? t.perceptionVisibility : undefined,
    movementAnimation: normalizeTokenMovementAnimation(t.movementAnimation),
    dnd5eWorldTimeAppliedMinute:
      Number.isSafeInteger(t.dnd5eWorldTimeAppliedMinute) && Number(t.dnd5eWorldTimeAppliedMinute) >= 0
        ? Number(t.dnd5eWorldTimeAppliedMinute)
        : undefined,
    dnd5eCombatState: legacyCombatState && !invalidCurrentEffects
      ? {
          ...nativeCombatState,
          stableAtZero,
          monsterThreatByTargetId,
          schemaVersion: migratedEffects!.schemaVersion,
          activeEffects: migratedEffects!.activeEffects,
          conditions: migratedEffects!.conditions.length > 0 ? migratedEffects!.conditions : undefined,
      }
      : invalidCurrentEffects
        ? {
            ...nativeCombatState,
            stableAtZero,
            monsterThreatByTargetId,
            schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
            activeEffects: undefined,
            conditions: undefined,
          }
        : undefined,
  }
}

/** 把任意旧形状的单张地图规整为当前 BattleMap 形状（缺字段填默认，tokens 逐个规整）。 */
function normalizeMap(raw: unknown): BattleMap {
  const m = (raw ?? {}) as Partial<BattleMap>
  const tokens = Array.isArray(m.tokens) ? m.tokens.map(normalizeToken) : []
  const dnd5eItemAreas = Array.isArray(m.dnd5eItemAreas)
    ? m.dnd5eItemAreas.flatMap((rawArea) => {
        const area = (rawArea ?? {}) as Partial<Dnd5eItemArea>
        if (
          typeof area.id !== 'string' || !area.id ||
          !['ball-bearings', 'caltrops', 'hunting-trap'].includes(area.kind ?? '')
        ) return []
        const cells = Array.isArray(area.cells)
          ? area.cells.flatMap((cell) => Number.isInteger(cell?.col) && Number.isInteger(cell?.row)
              ? [{ col: cell!.col, row: cell!.row }]
              : [])
          : []
        if (cells.length < 1) return []
        return [{
          id: area.id,
          kind: area.kind as Dnd5eItemAreaKind,
          sourceCharacterId: typeof area.sourceCharacterId === 'string' ? area.sourceCharacterId : '',
          sourceTokenId: typeof area.sourceTokenId === 'string' ? area.sourceTokenId : '',
          sourceItemTemplateId: typeof area.sourceItemTemplateId === 'string' ? area.sourceItemTemplateId : '',
          sourceItemName: typeof area.sourceItemName === 'string' ? area.sourceItemName : '物品区域',
          cells,
          createdAt: Number.isFinite(area.createdAt) ? area.createdAt! : 0,
          armed: area.armed !== false,
          triggeredTokenId: typeof area.triggeredTokenId === 'string' ? area.triggeredTokenId : undefined,
        } satisfies Dnd5eItemArea]
      })
    : []
  const dnd5ePluginAreas = Array.isArray(m.dnd5ePluginAreas)
    ? m.dnd5ePluginAreas.flatMap((rawArea) => {
      const area = (rawArea ?? {}) as Partial<Dnd5ePluginArea>
        const cells = Array.isArray(area.cells)
          ? area.cells.flatMap((cell) => Number.isInteger(cell?.col) && Number.isInteger(cell?.row)
              ? [{ col: cell!.col, row: cell!.row }]
              : [])
          : []
        if (
          typeof area.id !== 'string' || !area.id || typeof area.pluginId !== 'string' || !area.pluginId ||
          typeof area.featureId !== 'string' || !area.featureId || cells.length < 1 ||
          !Number.isInteger(area.createdRound) || !Number.isInteger(area.expiresAfterRound) ||
          area.createdRound! < 0 || area.expiresAfterRound! < area.createdRound! ||
          area.expiresAfterRound! - area.createdRound! + 1 > (
            area.sourceKind === 'core-spell' || (typeof area.coreSpellId === 'string' && area.coreSpellId.length > 0)
              ? DND5E_PERSISTENT_AREA_DURATION_MAX_ROUNDS
              : 14_400
          )
        ) return []
        const triggers = Array.isArray(area.triggers)
          ? area.triggers.flatMap((trigger) => {
              const normalized = normalizeDnd5ePersistentAreaTriggerSnapshot(trigger)
              return normalized ? [normalized] : []
            })
          : []
        const triggerIds = new Set(triggers.flatMap((trigger) => [
          trigger.id,
          ...(trigger.frequencyGroupId ? [trigger.frequencyGroupId] : []),
        ]))
        const triggerReceipts = Array.isArray(area.triggerReceipts)
          ? area.triggerReceipts.flatMap((receipt) =>
              receipt && triggerIds.has(receipt.triggerId) && typeof receipt.targetTokenId === 'string' &&
              receipt.targetTokenId && Number.isInteger(receipt.round) && receipt.round >= 0 &&
              (receipt.turnKey == null || (typeof receipt.turnKey === 'string' && !!receipt.turnKey && receipt.turnKey.length <= 160)) &&
              typeof receipt.transactionId === 'string' && receipt.transactionId
                ? [{
                    triggerId: receipt.triggerId,
                    targetTokenId: receipt.targetTokenId,
                    round: receipt.round,
                    turnKey: receipt.turnKey,
                    transactionId: receipt.transactionId,
                    damage: Number.isInteger(receipt.damage) && receipt.damage! >= 0 && receipt.damage! <= 1_000_000
                      ? receipt.damage
                      : undefined,
                    savingThrowSucceeded: typeof receipt.savingThrowSucceeded === 'boolean'
                      ? receipt.savingThrowSucceeded
                      : undefined,
                  }]
                : [],
            ).slice(-2_048)
          : []
        const sourceKind: Dnd5ePersistentAreaSourceKind = area.sourceKind === 'core-spell'
          ? 'core-spell'
          : 'plugin-feature'
        const coreSpellId = sourceKind === 'core-spell' && typeof area.coreSpellId === 'string' && area.coreSpellId
          ? area.coreSpellId
          : undefined
        if (sourceKind === 'core-spell' && !coreSpellId) return []
        const createdWorldMinute = Number.isSafeInteger(area.createdWorldMinute) && Number(area.createdWorldMinute) >= 0
          ? Number(area.createdWorldMinute)
          : undefined
        const expiresAtWorldMinute = Number.isSafeInteger(area.expiresAtWorldMinute) &&
          createdWorldMinute != null && Number(area.expiresAtWorldMinute) > createdWorldMinute
          ? Number(area.expiresAtWorldMinute)
          : undefined
        if (
          (area.createdWorldMinute != null && createdWorldMinute == null) ||
          (area.expiresAtWorldMinute != null && expiresAtWorldMinute == null)
        ) return []
        const castingClassId = sourceKind === 'core-spell' && [
          'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
          'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
        ].includes(String(area.castingClassId))
          ? area.castingClassId as Dnd5eClassId
          : undefined
        const magicMouth = area.magicMouth
          ? normalizeDnd5eMagicMouthStateV1(area.magicMouth)
          : undefined
        if (area.magicMouth != null && !magicMouth) return []
        const minorIllusion = (() => {
          const candidate = area.minorIllusion
          if (!candidate || (candidate.mode !== 'image' && candidate.mode !== 'sound')) return undefined
          const description = candidate.description?.trim()
          if (!description || description.length > 500) return undefined
          if (candidate.mode === 'image') {
            if (candidate.soundVolume != null || candidate.soundPattern != null) return undefined
            return { mode: 'image' as const, description }
          }
          if (
            !['whisper', 'normal', 'scream'].includes(String(candidate.soundVolume)) ||
            !['continuous', 'intermittent', 'discrete'].includes(String(candidate.soundPattern))
          ) return undefined
          return {
            mode: 'sound' as const,
            description,
            soundVolume: candidate.soundVolume!,
            soundPattern: candidate.soundPattern!,
          }
        })()
        if (area.minorIllusion != null && !minorIllusion) return []
        const anchorMode: Dnd5ePersistentAreaAnchorMode =
          area.anchorMode === 'source-token' || area.anchorMode === 'target-token' || area.anchorMode === 'effect-token'
            ? area.anchorMode
            : 'fixed'
        const anchorCell = area.anchorCell && Number.isInteger(area.anchorCell.col) && Number.isInteger(area.anchorCell.row)
          ? { col: area.anchorCell.col, row: area.anchorCell.row }
          : { ...cells[0] }
        const movement = area.movement &&
          (area.movement.economy === 'action' || area.movement.economy === 'bonus-action' || area.movement.economy === 'none') &&
          Number.isFinite(area.movement.maximumFeet) && area.movement.maximumFeet > 0 && area.movement.maximumFeet <= 1_000
          ? {
              economy: area.movement.economy,
              maximumFeet: Math.floor(area.movement.maximumFeet),
              ...(Number.isFinite(area.movement.maximumBarrierHeightFeet) &&
                Number(area.movement.maximumBarrierHeightFeet) > 0 &&
                Number(area.movement.maximumBarrierHeightFeet) <= 1_000
                ? { maximumBarrierHeightFeet: Number(area.movement.maximumBarrierHeightFeet) }
                : {}),
              ...(Number.isFinite(area.movement.maximumGapWidthFeet) &&
                Number(area.movement.maximumGapWidthFeet) > 0 &&
                Number(area.movement.maximumGapWidthFeet) <= 1_000
                ? { maximumGapWidthFeet: Number(area.movement.maximumGapWidthFeet) }
                : {}),
              ...(Number.isFinite(area.movement.maximumDistanceFromSourceFeet) &&
                Number(area.movement.maximumDistanceFromSourceFeet) > 0 &&
                Number(area.movement.maximumDistanceFromSourceFeet) <= 10_000
                ? { maximumDistanceFromSourceFeet: Math.floor(Number(area.movement.maximumDistanceFromSourceFeet)) }
                : {}),
              ...(area.movement.endWhenExceedingSourceDistance === true
                ? { endWhenExceedingSourceDistance: true as const }
                : {}),
            }
          : undefined
        const lighting = area.lighting ? normalizeDnd5ePersistentAreaLighting(area.lighting) : undefined
        if (area.lighting != null && !lighting) return []
        const hallow = area.hallow ? normalizeDnd5eHallowAreaState(area.hallow) : undefined
        if (area.hallow != null && !hallow) return []
        const hallucinatoryTerrain = area.hallucinatoryTerrain
          ? normalizeDnd5eHallucinatoryTerrainAreaState(area.hallucinatoryTerrain)
          : undefined
        if (area.hallucinatoryTerrain != null && !hallucinatoryTerrain) return []
        const programmedIllusion = area.programmedIllusion
          ? normalizeDnd5eProgrammedIllusionAreaState(area.programmedIllusion)
          : undefined
        if (area.programmedIllusion != null && !programmedIllusion) return []
        const occupantModifiers = area.occupantModifiers
          ? normalizeDnd5ePersistentAreaOccupantModifiers(area.occupantModifiers)
          : undefined
        const sourceFollower = area.sourceFollower &&
          Number.isFinite(area.sourceFollower.stationaryWithinFeet) &&
          Number(area.sourceFollower.stationaryWithinFeet) > 0 &&
          Number.isFinite(area.sourceFollower.maximumSeparationFeet) &&
          Number(area.sourceFollower.maximumSeparationFeet) > Number(area.sourceFollower.stationaryWithinFeet) &&
          Number(area.sourceFollower.maximumSeparationFeet) <= 100_000
          ? {
              stationaryWithinFeet: Number(area.sourceFollower.stationaryWithinFeet),
              maximumSeparationFeet: Number(area.sourceFollower.maximumSeparationFeet),
              ...(Number.isFinite(area.sourceFollower.maximumStepHeightFeet) && Number(area.sourceFollower.maximumStepHeightFeet) > 0
                ? { maximumStepHeightFeet: Number(area.sourceFollower.maximumStepHeightFeet) }
                : {}),
              ...(Number.isFinite(area.sourceFollower.carryingCapacityPounds) && Number(area.sourceFollower.carryingCapacityPounds) > 0
                ? { carryingCapacityPounds: Number(area.sourceFollower.carryingCapacityPounds) }
                : {}),
            }
          : undefined
        const lifecycle = area.lifecycle
          ? normalizeDnd5ePersistentAreaTurnLifecycle(area.lifecycle)
          : undefined
        if (area.lifecycle != null && !lifecycle) return []
        if (area.occupantModifiers != null && !occupantModifiers) return []
        const blocking = area.blocking
          ? normalizeDnd5ePersistentAreaBlocking(area.blocking)
          : undefined
        if (area.blocking != null && !blocking) return []
        const interposition = area.interposition &&
          typeof area.interposition.targetTokenId === 'string' &&
          area.interposition.targetTokenId.length > 0 &&
          area.interposition.targetTokenId.length <= 160 &&
          (area.interposition.mode === 'blocked' || area.interposition.mode === 'difficult-terrain')
          ? {
              targetTokenId: area.interposition.targetTokenId,
              mode: area.interposition.mode,
            }
          : undefined
        if (area.interposition != null && !interposition) return []
        const weaponHitBonusDamage = area.weaponHitBonusDamage
          ? normalizeDnd5ePersistentAreaWeaponHitBonusDamage(area.weaponHitBonusDamage)
          : undefined
        if (area.weaponHitBonusDamage != null && !weaponHitBonusDamage) return []
        const entityProfile = area.entityProfile &&
          Number.isInteger(area.entityProfile.armorClass) && Number(area.entityProfile.armorClass) >= 1 && Number(area.entityProfile.armorClass) <= 40 &&
          Number.isInteger(area.entityProfile.hitPoints) && Number(area.entityProfile.hitPoints) >= 1 && Number(area.entityProfile.hitPoints) <= 1_000_000 &&
          Number.isInteger(area.entityProfile.strength) && Number(area.entityProfile.strength) >= 1 && Number(area.entityProfile.strength) <= 30 &&
          typeof area.entityProfile.cannotAttack === 'boolean' && typeof area.entityProfile.invisible === 'boolean'
          ? { ...area.entityProfile }
          : undefined
        if (area.entityProfile != null && !entityProfile) return []
        const entityCurrentHitPoints = entityProfile
          ? area.entityCurrentHitPoints == null
            ? entityProfile.hitPoints
            : Number.isInteger(area.entityCurrentHitPoints) &&
                Number(area.entityCurrentHitPoints) >= 1 &&
                Number(area.entityCurrentHitPoints) <= entityProfile.hitPoints
              ? Number(area.entityCurrentHitPoints)
              : undefined
          : undefined
        if (entityProfile && entityCurrentHitPoints == null) return []
        if (!entityProfile && area.entityCurrentHitPoints != null) return []
        const grantedActivities = Array.isArray(area.grantedActivities)
          ? area.grantedActivities.flatMap((grant) => {
              const normalized = normalizeDnd5ePersistentAreaGrantedActivity(grant)
              return normalized ? [normalized] : []
            }).slice(0, 8)
          : []
        const areaCellKeys = new Set(cells.map((cell) => `${cell.col}:${cell.row}`))
        const webState = area.sourceKind === 'core-spell' && area.coreSpellId === 'web' && area.webState
          ? {
              unsupportedCollapseAtRound:
                Number.isInteger(area.webState.unsupportedCollapseAtRound) &&
                Number(area.webState.unsupportedCollapseAtRound) >= area.createdRound! &&
                Number(area.webState.unsupportedCollapseAtRound) <= area.expiresAfterRound!
                  ? Number(area.webState.unsupportedCollapseAtRound)
                  : undefined,
              burningCells: Array.isArray(area.webState.burningCells)
                ? area.webState.burningCells.slice(0, 256).flatMap((cell) =>
                    Number.isInteger(cell?.col) && Number.isInteger(cell?.row) &&
                    areaCellKeys.has(`${cell.col}:${cell.row}`) &&
                    Number.isInteger(cell?.ignitedRound) && Number(cell.ignitedRound) >= area.createdRound! &&
                    Number.isInteger(cell?.expiresAtRound) && Number(cell.expiresAtRound) >= Number(cell.ignitedRound) &&
                    Number(cell.expiresAtRound) <= area.expiresAfterRound! &&
                    typeof cell?.expiresAtTurnTokenId === 'string' && !!cell.expiresAtTurnTokenId
                      ? [{
                          col: Number(cell.col),
                          row: Number(cell.row),
                          ignitedRound: Number(cell.ignitedRound),
                          expiresAtRound: Number(cell.expiresAtRound),
                          expiresAtTurnTokenId: cell.expiresAtTurnTokenId,
                        }]
                      : [],
                  )
                : undefined,
            }
          : undefined
        if (
          area.grantedActivities != null &&
          (!Array.isArray(area.grantedActivities) || grantedActivities.length !== area.grantedActivities.length)
        ) return []
        const vertical = area.vertical != null
          ? normalizeDnd5ePersistentAreaVerticalSnapshot(area.vertical)
          : undefined
        if (area.vertical != null && !vertical) return []
        const normalizedVisual = area.visual
          ? normalizeDnd5ePersistentAreaVisual(area.visual)
          : undefined
        const visual = normalizedVisual ?? (
          sourceKind === 'core-spell' && coreSpellId
            ? getDnd5eCoreSpellAreaDeclaration(coreSpellId)?.visual
            : undefined
        )
        const wallOfFireGeometry = (coreSpellId === 'wall-of-fire' || coreSpellId === 'blade-barrier') && area.wallOfFireGeometry &&
          (area.wallOfFireGeometry.shape === 'line' || area.wallOfFireGeometry.shape === 'ring') &&
          Number.isFinite(area.wallOfFireGeometry.angleDegrees) &&
          ['left', 'right', 'inside', 'outside'].includes(area.wallOfFireGeometry.damagingSide)
          ? {
              shape: area.wallOfFireGeometry.shape,
              angleDegrees: ((Number(area.wallOfFireGeometry.angleDegrees) % 360) + 360) % 360,
              damagingSide: area.wallOfFireGeometry.damagingSide,
              lengthFeet: Number.isInteger(area.wallOfFireGeometry.lengthFeet) &&
                Number(area.wallOfFireGeometry.lengthFeet) >= 5 && Number(area.wallOfFireGeometry.lengthFeet) <= (coreSpellId === 'blade-barrier' ? 100 : 60)
                ? Number(area.wallOfFireGeometry.lengthFeet)
                : coreSpellId === 'blade-barrier' ? 100 : 60,
              diameterFeet: Number.isInteger(area.wallOfFireGeometry.diameterFeet) &&
                Number(area.wallOfFireGeometry.diameterFeet) >= 5 && Number(area.wallOfFireGeometry.diameterFeet) <= (coreSpellId === 'blade-barrier' ? 60 : 20)
                ? Number(area.wallOfFireGeometry.diameterFeet)
                : coreSpellId === 'blade-barrier' ? 60 : 20,
            }
          : undefined
        return [{
          id: area.id,
          pluginId: area.pluginId,
          featureId: area.featureId,
          sourceKind,
          coreSpellId,
          utilityProjectionId: typeof area.utilityProjectionId === 'string' &&
            /^[a-z0-9][a-z0-9-]{0,99}$/.test(area.utilityProjectionId)
            ? area.utilityProjectionId
            : undefined,
          castingClassId,
          slotLevel: Number.isInteger(area.slotLevel) && Number(area.slotLevel) >= 0 && Number(area.slotLevel) <= 9
            ? Number(area.slotLevel)
            : undefined,
          sourceSpellSaveDc: Number.isInteger(area.sourceSpellSaveDc) &&
            Number(area.sourceSpellSaveDc) >= 1 && Number(area.sourceSpellSaveDc) <= 40
              ? Number(area.sourceSpellSaveDc)
              : undefined,
          label: typeof area.label === 'string' && area.label && area.label.length <= 120 ? area.label : '扩展规则区域',
          color: typeof area.color === 'string' && /^#[0-9a-f]{6}$/i.test(area.color) ? area.color : '#8b5cf6',
          sourceCharacterId: typeof area.sourceCharacterId === 'string' ? area.sourceCharacterId : '',
          sourceTokenId: typeof area.sourceTokenId === 'string' ? area.sourceTokenId : '',
          cells,
          createdRound: area.createdRound!,
          expiresAfterRound: area.expiresAfterRound!,
          createdWorldMinute,
          expiresAtWorldMinute,
          permanent: area.permanent === true ? true : undefined,
          magicMouth,
          minorIllusion,
          expiresAtSourceTurnEndAfterRound:
            Number.isInteger(area.expiresAtSourceTurnEndAfterRound) &&
            Number(area.expiresAtSourceTurnEndAfterRound) >= area.createdRound! &&
            Number(area.expiresAtSourceTurnEndAfterRound) <= area.expiresAfterRound!
              ? Number(area.expiresAtSourceTurnEndAfterRound)
              : undefined,
          webState: webState && (
            webState.unsupportedCollapseAtRound != null || (webState.burningCells?.length ?? 0) > 0
          ) ? {
              unsupportedCollapseAtRound: webState.unsupportedCollapseAtRound,
              burningCells: webState.burningCells?.length ? webState.burningCells : undefined,
            } : undefined,
          concentrationId: typeof area.concentrationId === 'string' ? area.concentrationId : undefined,
          anchorMode,
          anchorTokenId: typeof area.anchorTokenId === 'string' && area.anchorTokenId
            ? area.anchorTokenId
            : anchorMode === 'source-token' ? area.sourceTokenId : undefined,
          anchorCell,
          vertical,
          movement,
          sourceFollower,
          lifecycle,
          lifecycleAdvances: Number.isInteger(area.lifecycleAdvances) && Number(area.lifecycleAdvances) >= 0 && Number(area.lifecycleAdvances) <= 14_400
            ? Number(area.lifecycleAdvances)
            : undefined,
          lifecycleLastTurnKey: typeof area.lifecycleLastTurnKey === 'string' && area.lifecycleLastTurnKey.length <= 160
            ? area.lifecycleLastTurnKey
            : undefined,
          movementCostMultiplier: Number.isFinite(area.movementCostMultiplier) &&
            Number(area.movementCostMultiplier) >= 1 && Number(area.movementCostMultiplier) <= 10
            ? Number(area.movementCostMultiplier)
            : undefined,
          relation: area.relation === 'ally' || area.relation === 'enemy' ? area.relation : 'any',
          includeSelf: area.includeSelf === true,
          excludedTargetIds: Array.isArray(area.excludedTargetIds)
            ? [...new Set(area.excludedTargetIds.filter((id): id is string => typeof id === 'string' && !!id))]
            : undefined,
          hiddenFromPlayers: area.hiddenFromPlayers === true,
          lighting,
          hallow,
          hallucinatoryTerrain,
          programmedIllusion,
          illuminationOverride: area.illuminationOverride === 'dim' || area.illuminationOverride === 'darkness'
            ? area.illuminationOverride
            : undefined,
          obscuration: area.obscuration &&
            (area.obscuration.kind === 'light' || area.obscuration.kind === 'heavy') &&
            (area.obscuration.sourceCanSeeThrough == null ||
              typeof area.obscuration.sourceCanSeeThrough === 'boolean')
            ? {
                kind: area.obscuration.kind,
                sourceCanSeeThrough: area.obscuration.sourceCanSeeThrough === true,
              }
            : undefined,
          occupantModifiers,
          blocking,
          interposition,
          entityProfile,
          entityCurrentHitPoints,
          weaponHitBonusDamage,
          grantedActivities: grantedActivities.length > 0 ? grantedActivities : undefined,
          grantedActivityUseReceipts: Array.isArray(area.grantedActivityUseReceipts)
            ? [...new Set(area.grantedActivityUseReceipts.filter((id): id is string =>
                typeof id === 'string' && grantedActivities.some((grant) => grant.activityId === id),
              ))]
            : undefined,
          lightingAnchorCells: Array.isArray(area.lightingAnchorCells)
            ? area.lightingAnchorCells.flatMap((cell) => Number.isInteger(cell?.col) && Number.isInteger(cell?.row)
              ? [{ col: Number(cell.col), row: Number(cell.row) }]
              : [])
            : undefined,
          dancingLightsForm: coreSpellId === 'dancing-lights' && area.dancingLightsForm === 'humanoid'
            ? 'humanoid'
            : coreSpellId === 'dancing-lights' ? 'lights' : undefined,
          visual: visual ? { ...visual } : undefined,
          wallOfFireGeometry,
          triggers: triggers.length > 0 ? triggers : undefined,
          triggerReceipts: triggerReceipts.length > 0 ? triggerReceipts : undefined,
          sourceExitBehavior: area.sourceExitBehavior === 'remove-area' ? 'remove-area' : undefined,
          sourceOverlapBehavior: area.sourceOverlapBehavior === 'remove-area' ? 'remove-area' : undefined,
        } satisfies Dnd5ePluginArea]
      })
    : []
  return {
    ...m,
    id: typeof m.id === 'string' && m.id ? m.id : uid(),
    name: typeof m.name === 'string' ? m.name : '未命名地图',
    width: Number.isFinite(m.width) ? (m.width as number) : 0,
    height: Number.isFinite(m.height) ? (m.height as number) : 0,
    gridSize: Number.isFinite(m.gridSize) && (m.gridSize as number) > 0 ? (m.gridSize as number) : 70,
    gridOffsetX: Number.isFinite(m.gridOffsetX) ? (m.gridOffsetX as number) : 0,
    gridOffsetY: Number.isFinite(m.gridOffsetY) ? (m.gridOffsetY as number) : 0,
    showGrid: typeof m.showGrid === 'boolean' ? m.showGrid : true,
    dnd5eItemAreas,
    dnd5ePluginAreas,
    viewportNotes: normalizeMapViewportNotes(m.viewportNotes),
    tokens,
  }
}

interface PersistedMapState {
  maps?: unknown
  selectedId?: unknown
}

/**
 * 纯函数：把任意持久化快照（含 version 0 = 无版本的旧形状）迁移到当前形状。
 * 单独导出以便 T13 在不挂载组件、不碰 localStorage 的前提下单测。
 * 任何旧 `stars-maps` blob 都应被这里规整为可直接渲染、不崩溃的当前 MapState。
 */
export function migrateMapsState(persisted: unknown): Pick<MapState, 'maps' | 'selectedId'> {
  const p = (persisted ?? {}) as PersistedMapState
  const maps = Array.isArray(p.maps) ? p.maps.map(normalizeMap) : []
  const selectedId =
    typeof p.selectedId === 'string' && maps.some((m) => m.id === p.selectedId)
      ? (p.selectedId as string)
      : (maps[0]?.id ?? null)
  return { maps, selectedId }
}

/**
 * 角色 → token.hp 单向镜像的唯一真相源。
 * `Character.currentHp` 是关联 token 血量的权威；token.hp 只是它的镜像（玩家端合并/阵亡判定用）。
 * 所有改血路径（普通伤害 / DOT 每回合 / 静水回血 / 本地扩展效果）改完 character 后，
 * 都用本 helper 算出要写回 token 的 patch，保证 `token.hp === character.currentHp`、不被任何路径绕过。
 * 纯函数，便于单测：post-change 断言 patch.hp === character.currentHp。
 */
export function characterHpTokenPatch(char: {
  currentHp: number
  maxHp: number
}): Pick<Token, 'hp' | 'maxHp'> {
  return { hp: char.currentHp, maxHp: char.maxHp }
}

type CharacterTokenPresentation = {
  id: string
  name: string
  avatar: string
  portrait?: string
  tokenPortrait?: string
  race?: string
  dnd5eRaceId?: string
  darkvisionRangeFeet?: number
  dnd5eClassChoices?: unknown
  dnd5eCombatState?: {
    activeEffects?: Dnd5eActiveEffectInstance[]
  }
}

function projectTokenEffectiveVision(
  token: Token,
  character?: CharacterTokenPresentation,
): Token {
  const profile = compileDnd5eEffectiveVisionProfile({ token, character })
  if (
    (token.darkvisionRangeFeet ?? 0) === profile.darkvisionRangeFeet &&
    (token.darknessSightRangeFeet ?? 0) === profile.darknessSightRangeFeet &&
    (token.magicalDarknessSightRangeFeet ?? 0) === profile.magicalDarknessSightRangeFeet &&
    (token.blindsightRangeFeet ?? 0) === profile.blindsightRangeFeet &&
    (token.tremorsenseRangeFeet ?? 0) === profile.tremorsenseRangeFeet &&
    (token.truesightRangeFeet ?? 0) === profile.truesightRangeFeet
  ) return token
  return applyDnd5eEffectiveVisionProfile(token, profile)
}

/** 角色资料与内置怪物素材只在渲染时投影，不写入地图存档。 */
export function projectCharacterTokenPresentations(
  tokens: Token[],
  characters: readonly CharacterTokenPresentation[],
): Token[] {
  const charactersById = new Map(characters.map((character) => [character.id, character]))
  const tokensById = new Map(tokens.map((token) => [token.id, token]))
  let changed = false
  const projected = tokens.map((token) => {
    if (
      token.dnd5eSpellEffect?.spellId === 'mirror-image' &&
      token.dnd5eSpellEffect.projectionKind === 'attack-decoy'
    ) {
      const sourceToken = tokensById.get(token.dnd5eSpellEffect.sourceTokenId)
      const sourceCharacter = sourceToken?.characterId
        ? charactersById.get(sourceToken.characterId)
        : undefined
      const sourcePresentation = sourceToken?.poolId
        ? getEnemyVisualPresentation(sourceToken.poolId, sourceToken.visualVariantId)
        : undefined
      const emoji = sourceCharacter?.avatar || sourceToken?.emoji || token.emoji
      const portrait = sourceCharacter?.portrait ?? sourceToken?.portrait ??
        ((sourceToken?.portraitImageId ?? sourceToken?.tokenPortraitImageId)
          ? undefined
          : sourcePresentation?.initiativePortrait)
      const tokenPortrait = sourceCharacter?.tokenPortrait ?? sourceToken?.tokenPortrait ??
        ((sourceToken?.tokenPortraitImageId ?? sourceToken?.portraitImageId)
          ? undefined
          : sourcePresentation?.tokenPortrait)
      const visionToken = projectTokenEffectiveVision(token)
      if (
        emoji === token.emoji &&
        portrait === token.portrait &&
        tokenPortrait === token.tokenPortrait &&
        visionToken === token
      ) return token
      changed = true
      return {
        ...visionToken,
        emoji,
        portrait,
        tokenPortrait,
      }
    }
    if (!token.characterId) {
      const visionToken = projectTokenEffectiveVision(token)
      const presentation = token.poolId
        ? getEnemyVisualPresentation(token.poolId, token.visualVariantId)
        : undefined
      if (!presentation) {
        if (visionToken !== token) changed = true
        return visionToken
      }

      // Room image ids override inline/catalog artwork without distributing the
      // DM-only custom-monster source record to player clients.
      const portrait = (token.portraitImageId ?? token.tokenPortraitImageId)
        ? undefined
        : presentation.initiativePortrait
      const tokenPortrait = (token.tokenPortraitImageId ?? token.portraitImageId)
        ? undefined
        : presentation.tokenPortrait

      if (
        token.portrait === portrait &&
        token.tokenPortrait === tokenPortrait &&
        visionToken === token
      ) return token
      changed = true
      return {
        ...visionToken,
        portrait,
        tokenPortrait,
      }
    }
    const character = charactersById.get(token.characterId)
    if (!character) return token
    const emoji = character.avatar || token.emoji
    const label = character.name || token.label
    const portrait = character.portrait
    const tokenPortrait = character.tokenPortrait
    const visionToken = projectTokenEffectiveVision(token, character)
    if (
      emoji === token.emoji &&
      label === token.label &&
      portrait === token.portrait &&
      tokenPortrait === token.tokenPortrait &&
      visionToken === token
    ) return token
    changed = true
    return {
      ...visionToken,
      emoji,
      label,
      portrait,
      tokenPortrait,
    }
  })
  return changed ? projected : tokens
}

const TOKEN_PRESETS = {
  player: { color: '#34d399', emoji: '🛡️' },
  enemy: { color: '#f87171', emoji: '👹' },
  npc: { color: '#fbbf24', emoji: '🧑' },
  obstacle: { color: '#94a3b8', emoji: '🪨' },
}

interface MapState {
  maps: BattleMap[]
  selectedId: string | null
  loadShared: (options?: { force?: boolean }) => Promise<void>
  saveSharedNow: () => Promise<void>
  saveAuthorityTokenPatch: (
    mapId: string,
    tokenId: string,
    patch: Partial<Token>,
  ) => Promise<void>
  select: (id: string | null) => void
  addMap: (meta: {
    name: string
    width: number
    height: number
    blob: Blob
    gridDetect?: GridDetectResult
  }) => Promise<string>
  updateMap: (id: string, patch: Partial<BattleMap>) => void
  removeMap: (id: string) => void
  addToken: (mapId: string, type: Token['type']) => void
  addEnemyFromPool: (mapId: string, template: EnemyTemplate, options?: EnemyPlacementOptions) => string | null
  addEncounterFromPool: (
    mapId: string,
    entries: readonly Dnd5eEncounterEntry[],
    options?: EnemyPlacementOptions,
  ) => string[]
  addCharacterToken: (
    mapId: string,
    payload: {
      characterId: string
      name: string
      emoji: string
      type?: Token['type']
      dnd5eCharacterDarkvisionRangeFeet?: number
    },
  ) => void
  updateToken: (mapId: string, tokenId: string, patch: Partial<Token>) => void
  applyAuthorityTokenUpdate: (
    mapId: string,
    tokenId: string,
    patch: Partial<Token>,
    options?: Partial<Token> | { protectHitPointsUntilAcknowledged?: boolean },
  ) => void
  applyAuthorityMapUpdate: (mapId: string, patch: Partial<BattleMap>) => void
  expireTimedLights: (worldMinute: number) => number
  removeToken: (mapId: string, tokenId: string) => void
  transferToken: (fromMapId: string, toMapId: string, tokenId: string, position: { x: number; y: number }) => boolean
}

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      maps: [],
      selectedId: null,
      loadShared: async (options) => {
        const shared = await loadSharedResource<SharedMapsState>('maps')
        if (!shared?.maps) {
          if (canWriteSharedState()) publishMapsState(get())
          return
        }
        // 单调 guard：丢弃 updatedAt 严格更旧的乱序/陈旧快照。
        // 旧实现仅在 !isPlayerPort() 时做此检查 —— 玩家端裸接受任意顺序的快照，乱序写会回退状态。
        // 现在 DM 与玩家两端都走同一纯 guard（decideApply），相等时落内容 equality 短路。
        const roomKey = sharedMapsRoomKey()
        const incomingRevision = shared._sync?.revision
        const lastAppliedRevision = lastAppliedMapsRevisionByRoom.get(roomKey)
        if (!shouldApplySharedMapsSnapshot({
          incomingRevision,
          lastAppliedRevision,
          incomingUpdatedAt: shared.updatedAt,
          lastAppliedUpdatedAt: lastSharedMapsUpdatedAt,
        })) {
          console.info('[maps-shared-stale-ignored]', {
            incomingRevision,
            lastAppliedRevision,
            sharedUpdatedAt: shared.updatedAt ?? 0,
            lastSharedMapsUpdatedAt,
          })
          return
        }
        const snapshot = JSON.stringify(shared)
        if (Number.isInteger(incomingRevision)) {
          lastAppliedMapsRevisionByRoom.set(roomKey, Number(incomingRevision))
          lastSharedMapsUpdatedAt = Math.max(lastSharedMapsUpdatedAt, shared.updatedAt ?? 0)
          if (snapshot === lastSharedMapsSnapshot && !options?.force) return
          lastSharedMapsSnapshot = snapshot
        } else {
          const prevGuard: MonotonicState = {
            lastUpdatedAt: lastSharedMapsUpdatedAt,
            lastSnapshot: lastSharedMapsSnapshot,
          }
          const decision = decideApply(prevGuard, shared.updatedAt ?? 0, snapshot)
          if (!decision.apply && !options?.force) return
          lastSharedMapsUpdatedAt = decision.next.lastUpdatedAt
          lastSharedMapsSnapshot = decision.next.lastSnapshot
        }
        const protectedMaps = mergePendingLocalTokenHitPointEdits(shared.maps)
        set({ maps: protectedMaps, selectedId: shared.selectedId ?? shared.maps[0]?.id ?? null })
        // 玩家端在 maps 同步落地后 GC 孤儿图片（已删 map 的本地 IndexedDB 副本）。
        if (isPlayerPort()) void pruneOrphanImages(shared.maps.flatMap((map) => [
          map.id,
          ...map.tokens.flatMap((token) => [token.portraitImageId, token.tokenPortraitImageId]
            .filter((imageId): imageId is string => !!imageId)),
        ]))
      },
      saveSharedNow: () => publishMapsState(get(), { requireSaved: true }),
      saveAuthorityTokenPatch: async (mapId, tokenId, patch) => {
        const state = get()
        const updatedAt = Math.max(Date.now(), lastSharedMapsUpdatedAt + 1, lastLocalMapsWriteAt + 1)
        const saved = await saveMapsStateWithTokenPatchRetry({
          payload: {
            maps: state.maps,
            selectedId: state.selectedId,
            updatedAt,
          },
          mapId,
          tokenId,
          patch,
          save: (payload) => saveSharedResourceWithResult('maps', payload),
          load: () => loadSharedResource<SharedMapsState>('maps'),
        })
        if (saved.result.status !== 'saved') {
          lastLocalMapsWriteAt = lastSharedMapsUpdatedAt
          throw new Error(`maps-token-patch-save-rejected:${saved.result.status}`)
        }
        rememberAppliedMapsRevision(saved.result.revision)
        lastLocalMapsWriteAt = saved.payload.updatedAt ?? updatedAt
        lastSharedMapsUpdatedAt = saved.payload.updatedAt ?? updatedAt
        lastSharedMapsSnapshot = JSON.stringify(saved.payload)
        const currentMap = get().maps.find((map) => map.id === mapId)
        const committedProjection = currentMap
          ? committedTokenAnchorProjectionFromSharedMaps(
              currentMap,
              saved.payload.maps,
              tokenId,
              patch,
            )
          : null
        if (!committedProjection) throw new Error('maps-token-patch-committed-target-missing')
        // Re-project the payload that actually won CAS before the command
        // promise resolves. The effect Token and any linked source/effect-token
        // areas are committed in one Store update so releasing MapCanvas's drag
        // preview cannot expose an older visible anchor.
        get().applyAuthorityMapUpdate(mapId, committedProjection)
      },
      select: (id) => {
        const selectedId = id && get().maps.some((map) => map.id === id) ? id : null
        if (get().selectedId === selectedId) return
        set({ selectedId })
        // selectedId is the room's authoritative active scene. DM map changes must travel through
        // the same revisioned maps resource as token/map edits so player invalidation subscribers
        // can follow immediately. Player clients remain read-only and only apply remote selection.
        if (canWriteSharedState()) publishMapsState(get())
      },

      addMap: async ({ name, width, height, blob, gridDetect }) => {
        const id = uid()
        const sharedImageSaved = await putImage(id, blob)
        if (getRoomSession() && !sharedImageSaved) {
          await deleteImage(id)
          throw new Error('地图图片未能上传到房间主机；已取消创建地图，请确认 DM 服务在线后重试。')
        }
        const gridPatch = gridDetect ? applyGridDetectPatch(gridDetect) : { builtinGridDetected: false }
        const map: BattleMap = {
          id,
          name,
          width,
          height,
          gridSize: gridPatch.gridSize ?? 70,
          gridOffsetX: gridPatch.gridOffsetX ?? 0,
          gridOffsetY: gridPatch.gridOffsetY ?? 0,
          showGrid: gridPatch.showGrid ?? true,
          builtinGridDetected: gridPatch.builtinGridDetected,
          feetPerCell: 5,
          gridColor: '#c4b5fd',
          gridOpacity: 0.28,
          showCoordinates: true,
          snapMonstersToGrid: true,
          dnd5eItemAreas: [],
          dnd5ePluginAreas: [],
          viewportNotes: [],
          tokens: [],
        }
        set((s) => ({ maps: [...s.maps, map], selectedId: id }))
        publishMapsState(get())
        return id
      },

      updateMap: (id, patch) => {
        set((s) => ({
          maps: s.maps.map((m) => {
            if (m.id !== id) return m
            const next = { ...m, ...patch }
            const gridChanged =
              (patch.gridSize != null && patch.gridSize !== m.gridSize) ||
              (patch.gridOffsetX != null && patch.gridOffsetX !== m.gridOffsetX) ||
              (patch.gridOffsetY != null && patch.gridOffsetY !== m.gridOffsetY)
            if (gridChanged) {
              next.tokens = realignTokensToGrid(next.tokens, next)
            }
            return next
          }),
        }))
        publishMapsState(get())
      },

      removeMap: (id) => {
        const removedMap = get().maps.find((map) => map.id === id)
        void deleteImage(id)
        const removedImageIds = new Set(removedMap?.tokens.flatMap((token) => [
          token.portraitImageId,
          token.tokenPortraitImageId,
        ].filter((imageId): imageId is string => !!imageId)) ?? [])
        for (const imageId of removedMap?.viewportNotes?.flatMap((note) => note.imageId ? [note.imageId] : []) ?? []) {
          removedImageIds.add(imageId)
        }
        for (const imageId of removedImageIds) {
          void deleteImage(imageId)
        }
        set((s) => {
          const maps = s.maps.filter((m) => m.id !== id)
          return { maps, selectedId: s.selectedId === id ? (maps[0]?.id ?? null) : s.selectedId }
        })
        publishMapsState(get())
      },

      addToken: (mapId, type) => {
        const map = get().maps.find((m) => m.id === mapId)
        if (!map) return
        const preset = TOKEN_PRESETS[type]
        const defaultHp = type === 'enemy' ? 20 : type === 'npc' ? 12 : type === 'obstacle' ? 10 : undefined
        const tokenSize = defaultTokenSizeForMap(map)
        const creatureSize = type === 'enemy' || type === 'npc' ? '中型' : undefined
        const spawnX = type === 'obstacle'
          ? Math.min(map.width - map.gridSize, map.width / 2 + map.gridSize * 4)
          : map.width / 2
        const spawnY = type === 'obstacle'
          ? Math.min(map.height - map.gridSize, map.height / 2 + map.gridSize * 2)
          : map.height / 2
        const spawn = snapTokenToGridCenter(spawnX, spawnY, { size: tokenSize, creatureSize }, map)
        const token: Token = {
          id: uid(),
          label: type === 'player' ? '玩家' : type === 'enemy' ? '敌人' : type === 'obstacle' ? '地图物件' : 'NPC',
          x: spawn.x,
          y: spawn.y,
          color: preset.color,
          emoji: preset.emoji,
          size: tokenSize,
          type,
          creatureTypes: type === 'enemy' ? ['魔物'] : undefined,
          creatureSize,
          hp: defaultHp,
          maxHp: defaultHp,
          dnd5eObjectState: type === 'obstacle'
            ? { schemaVersion: 1, magical: false, wornOrCarried: false }
            : undefined,
        }
        set((s) => ({
          maps: s.maps.map((m) => (m.id === mapId ? { ...m, tokens: [...m.tokens, token] } : m)),
        }))
        publishMapsState(get())
      },

      addEnemyFromPool: (mapId, template, options) => {
        const map = get().maps.find((m) => m.id === mapId)
        if (!map) return null
        const patch = enemyTemplateToTokenPatch(template)
        const spawn = snapTokenToGridCenter(
          map.width / 2,
          map.height / 2,
          { size: patch.size ?? defaultTokenSizeForMap(map), creatureSize: patch.creatureSize },
          map,
        )
        const token: Token = {
          id: uid(),
          label: patch.label ?? template.name,
          x: spawn.x,
          y: spawn.y,
          color: patch.color ?? '#f87171',
          emoji: patch.emoji ?? '👹',
          size: patch.size ?? defaultTokenSizeForMap(map),
          type: 'enemy',
          dnd5eSide: options?.side === 'player' ? 'player' : undefined,
          hp: patch.hp,
          maxHp: patch.maxHp,
          poolId: patch.poolId,
          visualVariantId: patch.visualVariantId,
          creatureTypes: patch.creatureTypes,
          creatureSize: patch.creatureSize,
          showHpOnToken: patch.showHpOnToken ?? true,
          showDetailOnToken: patch.showDetailOnToken ?? true,
        }
        set((s) => ({
          maps: s.maps.map((m) => (m.id === mapId ? { ...m, tokens: [...m.tokens, token] } : m)),
        }))
        publishMapsState(get())
        return token.id
      },
      addEncounterFromPool: (mapId, entries, options) => {
        const map = get().maps.find((candidate) => candidate.id === mapId)
        if (!map) return []
        const roster = assignEnemyVisualVariants(
          dnd5eEncounterRoster(entries),
          map.tokens,
        )
        if (roster.length === 0) return []
        const tokens = roster.map((template, index): Token => {
          const patch = enemyTemplateToTokenPatch(template)
          const offset = dnd5eEncounterGridOffset(index, roster.length)
          const spacing = Math.max(1, map.gridSize * 2)
          const spawn = snapTokenToGridCenter(
            map.width / 2 + offset.column * spacing,
            map.height / 2 + offset.row * spacing,
            { size: patch.size ?? defaultTokenSizeForMap(map), creatureSize: patch.creatureSize },
            map,
          )
          return {
            id: uid(), label: patch.label ?? template.name, x: spawn.x, y: spawn.y,
            color: patch.color ?? '#f87171', emoji: patch.emoji ?? '👾',
            size: patch.size ?? defaultTokenSizeForMap(map), type: 'enemy',
            dnd5eSide: options?.side === 'player' ? 'player' : undefined,
            hp: patch.hp, maxHp: patch.maxHp, poolId: patch.poolId,
            visualVariantId: patch.visualVariantId,
            creatureTypes: patch.creatureTypes, creatureSize: patch.creatureSize,
            showHpOnToken: patch.showHpOnToken ?? true,
            showDetailOnToken: patch.showDetailOnToken ?? true,
          }
        })
        set((state) => ({
          maps: state.maps.map((candidate) => candidate.id === mapId
            ? { ...candidate, tokens: [...candidate.tokens, ...tokens] }
            : candidate),
        }))
        publishMapsState(get())
        return tokens.map((token) => token.id)
      },
      addCharacterToken: (
        mapId,
        { characterId, name, emoji, type = 'player', dnd5eCharacterDarkvisionRangeFeet },
      ) => {
        const map = get().maps.find((m) => m.id === mapId)
        if (!map) return
        // A character sheet is a single authoritative combatant on a map.
        // Allowing the same characterId to be placed twice makes both tokens
        // project back into the same character record; whichever combatant is
        // applied last can then erase slots, concentration, or active effects
        // produced by the other token.
        if (map.tokens.some((token) => token.characterId === characterId)) return
        const preset = TOKEN_PRESETS[type]
        const tokenSize = defaultTokenSizeForMap(map)
        const spawn = snapTokenToGridCenter(map.width / 2, map.height / 2, { size: tokenSize }, map)
        const token: Token = {
          id: uid(),
          label: name,
          x: spawn.x,
          y: spawn.y,
          color: preset.color,
          emoji,
          size: tokenSize,
          type,
          characterId,
          dnd5eCharacterDarkvisionRangeFeet,
        }
        set((s) => ({
          maps: s.maps.map((m) => (m.id === mapId ? { ...m, tokens: [...m.tokens, token] } : m)),
        }))
        publishMapsState(get())
      },

      updateToken: (mapId, tokenId, patch) => {
        const updatesHitPoints =
          Object.prototype.hasOwnProperty.call(patch, 'hp') ||
          Object.prototype.hasOwnProperty.call(patch, 'maxHp')
        markPendingLocalTokenHitPointEdit(mapId, tokenId, patch)
        set((state) => {
          const maps = applyTokenPatchToSharedMaps(state.maps, mapId, tokenId, patch)
          return maps ? { maps } : state
        })
        publishMapsState(get(), { retryPendingHitPoints: updatesHitPoints })
      },

      applyAuthorityTokenUpdate: (mapId, tokenId, patch, options) => {
        const protectHitPointsUntilAcknowledged = !!options &&
          'protectHitPointsUntilAcknowledged' in options &&
          options.protectHitPointsUntilAcknowledged === true
        if (
          Object.prototype.hasOwnProperty.call(patch, 'hp') ||
          Object.prototype.hasOwnProperty.call(patch, 'maxHp')
        ) {
          if (protectHitPointsUntilAcknowledged) {
            markPendingLocalTokenHitPointEdit(mapId, tokenId, patch)
          } else {
            clearPendingLocalTokenHitPointEdit(mapId, tokenId)
          }
        }
        set((state) => {
          const maps = applyTokenPatchToSharedMaps(state.maps, mapId, tokenId, patch)
          return maps ? { maps } : state
        })
      },

      applyAuthorityMapUpdate: (mapId, patch) => {
        set((state) => ({
          maps: state.maps.map((map) => map.id === mapId ? { ...map, ...patch } : map),
        }))
      },

      expireTimedLights: (worldMinute) => {
        let expired = 0
        const maps = get().maps.map((map) => ({
            ...map,
            tokens: map.tokens.map((token) => {
              if (!token.lightSource?.enabled || campaignLightIsActive(token.lightSource, worldMinute)) return token
              expired += 1
              return { ...token, lightSource: { ...token.lightSource, enabled: false } }
            }),
          }))
        if (expired > 0) {
          set({ maps })
          publishMapsState(get())
        }
        return expired
      },

      removeToken: (mapId, tokenId) => {
        const removedToken = get().maps
          .find((map) => map.id === mapId)
          ?.tokens.find((token) => token.id === tokenId)
        for (const imageId of new Set([
          removedToken?.portraitImageId,
          removedToken?.tokenPortraitImageId,
        ].filter((candidate): candidate is string => !!candidate))) {
          void deleteImage(imageId)
        }
        set((s) => ({
          maps: s.maps.map((m) =>
            m.id === mapId ? { ...m, tokens: m.tokens.filter((t) => t.id !== tokenId) } : m,
          ),
        }))
        publishMapsState(get())
      },
      transferToken: (fromMapId, toMapId, tokenId, position) => {
        if (fromMapId === toMapId) {
          const currentMap = get().maps.find((map) => map.id === fromMapId)
          const currentToken = currentMap?.tokens.find((token) => token.id === tokenId)
          if (!currentMap || !currentToken) return false
          const boundedPosition = clampTokenPositionToMap(position, currentToken, currentMap)
          set((state) => ({
            maps: state.maps.map((map) => map.id === fromMapId ? {
              ...map,
              tokens: map.tokens.map((token) => token.id === tokenId
                ? { ...token, ...boundedPosition, movementAnimation: undefined }
                : token),
            } : map),
          }))
          publishMapsState(get())
          return true
        }
        const sourceMap = get().maps.find((map) => map.id === fromMapId)
        const targetMap = get().maps.find((map) => map.id === toMapId)
        const token = sourceMap?.tokens.find((candidate) => candidate.id === tokenId)
        if (!sourceMap || !targetMap || !token || targetMap.tokens.some((candidate) => candidate.id === tokenId)) return false
        const boundedPosition = clampTokenPositionToMap(position, token, targetMap)
        const moved = { ...token, ...boundedPosition, movementAnimation: undefined }
        set((state) => ({
          maps: state.maps.map((map) => map.id === fromMapId
            ? { ...map, tokens: map.tokens.filter((candidate) => candidate.id !== tokenId) }
            : map.id === toMapId
              ? { ...map, tokens: [...map.tokens, moved] }
              : map),
          selectedId: toMapId,
        }))
        publishMapsState(get())
        return true
      },
    }),
    {
      name: 'stars-maps',
      version: MAPS_PERSIST_VERSION,
      // 旧形状（version 0 = 此前无版本）经此迁移到当前形状，避免渲染期崩溃。
      migrate: (persisted) => migrateMapsState(persisted) as MapState,
    },
  ),
)
