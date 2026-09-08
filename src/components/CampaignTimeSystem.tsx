import { useEffect, useMemo, useRef, useState } from 'react'
import { BellRing, CheckCircle2, Coffee, MoonStar, X } from 'lucide-react'
import {
  formatCampaignTime,
  type CampaignRestRecoveryEntry,
  type SharedCampaignTimeState,
  type CampaignTimeAdvance,
  type CampaignTimer,
} from '../lib/campaignTime'
import { useCampaignTimeStore } from '../store/campaignTime'
import {
  hasHydratedSharedCharactersForCurrentRoom,
  useCharacterStore,
} from '../store/characters'
import { useMapGeometryStore } from '../store/mapGeometry'
import { useMapStore, type BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import {
  mapGeometryTerrainElevationAtPoint,
  type MapGeometryState,
} from '../lib/mapGeometry'
import { getRoomSession } from '../lib/roomSession'
import { roomOwnedPlayerCharacters } from '../lib/playerView'
import { completeDnd5eWallOfStoneForCampaignTime } from '../rulesets/dnd5e/wallOfStonePermanence'
import {
  advanceDnd5eCampaignTimedActiveEffects,
  dnd5eCampaignTimeControlledDescentDistanceFeet,
} from '../rulesets/dnd5e/campaignTimeRules'
import {
  advanceDnd5eHitPointMaximumReductionDurations,
  normalizeDnd5eHitPointMaximumReductionLedger,
} from '../rulesets/dnd5e/hitPointMaximumReductions'
import {
  expireDnd5ePluginAreasAtWorldMinute,
  reconcileDnd5ePluginAreasAndConcentrationOnMap,
} from '../rulesets/dnd5e/pluginAreas'
import Dnd5eShortRestRecoveryActions from './Dnd5eShortRestRecoveryActions'
import {
  campaignRestReceiptBaselineIds,
  latestCampaignRestAdvanceForViewer,
} from './campaignRestNotificationModel'

const RECOVERY_CATEGORY_LABELS: Record<CampaignRestRecoveryEntry['category'], string> = {
  'hit-points': '生命值',
  'hit-dice': '生命骰',
  'feature-resource': '特性与法术资源',
  'item-resource': '魔法物品与充能',
  state: '状态',
}

function restReceiptStorageKey(): string {
  const session = getRoomSession()
  return `stars-rest-recovery-receipts-v2:${session?.roomId ?? 'local'}:${session?.memberId ?? session?.role ?? 'local'}`
}

function readRestReceipts(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const value = JSON.parse(window.localStorage.getItem(restReceiptStorageKey()) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeRestReceipts(receipts: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(restReceiptStorageKey(), JSON.stringify([...receipts].slice(-64)))
  } catch {
    // 浏览器禁止持久化时，当前会话内的 ref 仍可防止重复弹窗。
  }
}

function recoveryValue(entry: CampaignRestRecoveryEntry): string | null {
  if (entry.before == null && entry.after == null) return null
  const maximum = entry.maximum == null ? '' : ` / ${entry.maximum}`
  if (entry.before == null) return `${entry.after ?? 0}${maximum}`
  if (entry.after == null || entry.before === entry.after) return `${entry.before}${maximum}`
  return `${entry.before} → ${entry.after}${maximum}`
}

export function canReconcileCampaignTimeCharacters(input: {
  isDm: boolean
  clockHydratedRoomId: string | null
  currentRoomId: string
  charactersHydrated: boolean
}): boolean {
  return input.isDm &&
    input.clockHydratedRoomId === input.currentRoomId &&
    input.charactersHydrated
}

export function campaignTimeCharacterReconciliationKey(
  roomId: string,
  clock: SharedCampaignTimeState,
): string {
  return `${roomId}:${clock.worldMinute}:${clock.advances.at(-1)?.id ?? ''}:${clock.updatedAt}`
}

export function projectDnd5eCampaignTimeAirborneTokens(input: {
  maps: readonly BattleMap[]
  geometryMaps: readonly MapGeometryState[]
  characters: readonly Character[]
  clock: SharedCampaignTimeState
}): {
  maps: BattleMap[]
  airborneCharacterIds: ReadonlySet<string>
  descendedCharacterIds: ReadonlySet<string>
} {
  const charactersById = new Map(input.characters.map((character) => [character.id, character]))
  const geometryByMapId = new Map(input.geometryMaps.map((geometry) => [geometry.mapId, geometry]))
  const airborneCharacterIds = new Set<string>()
  const descendedCharacterIds = new Set<string>()
  const maps = input.maps.map((map) => {
    let changed = false
    const geometry = geometryByMapId.get(map.id)
    const tokens = map.tokens.map((token) => {
      if (!token.characterId) return token
      const character = charactersById.get(token.characterId)
      if (!character) return token
      const groundElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, token)
      const elevationFeet = Math.max(groundElevationFeet, token.elevationFeet ?? groundElevationFeet)
      if (elevationFeet <= groundElevationFeet + 1e-4) return token
      airborneCharacterIds.add(character.id)
      const appliedMinute = character.dnd5eWorldTimeAppliedMinute
      const elapsedMinutes = Number.isSafeInteger(appliedMinute)
        ? Math.max(0, input.clock.worldMinute - appliedMinute!)
        : 0
      const descentDistanceFeet = dnd5eCampaignTimeControlledDescentDistanceFeet(
        character,
        elapsedMinutes,
      )
      if (descentDistanceFeet <= 0) return token
      const nextElevationFeet = Math.max(groundElevationFeet, elevationFeet - descentDistanceFeet)
      if (Math.abs(nextElevationFeet - elevationFeet) <= 1e-4) return token
      changed = true
      descendedCharacterIds.add(character.id)
      return { ...token, elevationFeet: nextElevationFeet }
    })
    return changed ? { ...map, tokens } : map
  })
  return { maps, airborneCharacterIds, descendedCharacterIds }
}

export function projectDnd5eCampaignTimeCreatureTokens(input: {
  maps: readonly BattleMap[]
  characters: readonly Character[]
  clock: SharedCampaignTimeState
}): { maps: BattleMap[]; changed: boolean } {
  const tokensById = new Map(input.maps.flatMap((map) => map.tokens).map((token) => [token.id, token]))
  const charactersById = new Map(input.characters.map((character) => [character.id, character]))
  let changed = false
  const maps = input.maps.map((map) => {
    let mapChanged = false
    const tokens = map.tokens.map((token) => {
      if (token.characterId || token.type === 'obstacle') return token
      const effects = token.dnd5eCombatState?.activeEffects ?? []
      const storedMinute = token.dnd5eWorldTimeAppliedMinute
      const sourceMinutes = effects.flatMap((effect) => {
        const sourceToken = effect.source.actorId ? tokensById.get(effect.source.actorId) : undefined
        const sourceCharacter = sourceToken?.characterId
          ? charactersById.get(sourceToken.characterId)
          : undefined
        const minute = sourceToken?.dnd5eWorldTimeAppliedMinute ?? sourceCharacter?.dnd5eWorldTimeAppliedMinute
        return Number.isSafeInteger(minute) && Number(minute) >= 0 ? [Number(minute)] : []
      })
      const baselineMinute = Number.isSafeInteger(storedMinute) && Number(storedMinute) >= 0
        ? Number(storedMinute)
        : sourceMinutes.length > 0
          ? Math.min(...sourceMinutes)
          : input.clock.worldMinute
      const elapsedMinutes = Math.max(0, input.clock.worldMinute - baselineMinute)
      let nextToken = token
      if (
        token.dnd5eSummon?.persistent === true &&
        token.dnd5eSummon.controlEnded !== true &&
        Number.isSafeInteger(token.dnd5eSummon.controlExpiresAtWorldMinute) &&
        input.clock.worldMinute >= Number(token.dnd5eSummon.controlExpiresAtWorldMinute)
      ) {
        nextToken = {
          ...nextToken,
          dnd5eSummon: { ...nextToken.dnd5eSummon!, controlEnded: true },
        }
      }
      if (elapsedMinutes > 0 && token.dnd5eCombatState) {
        const maximumReduction = advanceDnd5eHitPointMaximumReductionDurations(
          normalizeDnd5eHitPointMaximumReductionLedger(
            token.dnd5eCombatState.hitPointMaximumReductionLedger,
          ),
          elapsedMinutes * 10,
        )
        const projectedMaximum = maximumReduction.maximum ?? token.maxHp ?? token.hp ?? 1
        const projected = advanceDnd5eCampaignTimedActiveEffects({
          id: token.id,
          name: token.label,
          rulesetId: 'dnd5e-2014-srd-5.1',
          currentHp: Math.min(token.hp ?? projectedMaximum, projectedMaximum),
          maxHp: projectedMaximum,
          conditions: token.dnd5eCombatState.conditions ?? [],
          concentrating: token.dnd5eCombatState.concentrationSpellId != null,
          dnd5eCombatState: {
            ...token.dnd5eCombatState,
            hitPointMaximumReductionLedger: maximumReduction.ledger,
          },
          dnd5eWorldTimeAppliedMinute: baselineMinute,
        } as Character, elapsedMinutes)
        nextToken = {
          ...nextToken,
          hp: token.hp == null ? token.hp : projected.currentHp,
          maxHp: token.maxHp == null ? token.maxHp : projected.maxHp,
          dnd5eCombatState: {
            ...token.dnd5eCombatState,
            ...projected.dnd5eCombatState,
            conditions: projected.conditions?.length ? [...projected.conditions] : undefined,
          },
        }
      }
      if (nextToken.dnd5eWorldTimeAppliedMinute !== input.clock.worldMinute) {
        nextToken = { ...nextToken, dnd5eWorldTimeAppliedMinute: input.clock.worldMinute }
      }
      if (nextToken === token) return token
      mapChanged = true
      changed = true
      return nextToken
    })
    return mapChanged ? { ...map, tokens } : map
  })
  return { maps, changed }
}

export function projectDnd5eCampaignTimeCreatedObjects(input: {
  maps: readonly BattleMap[]
  worldMinute: number
}): { maps: BattleMap[]; changed: boolean; removedTokenIds: string[] } {
  let changed = false
  const removedTokenIds: string[] = []
  const maps = input.maps.map((map) => {
    const tokens = map.tokens.filter((token) => {
      const creation = token.type === 'obstacle' ? token.dnd5eObjectState?.creation : undefined
      if (!creation || input.worldMinute < creation.expiresAtWorldMinute) return true
      removedTokenIds.push(token.id)
      changed = true
      return false
    })
    return tokens.length === map.tokens.length ? map : { ...map, tokens }
  })
  return { maps, changed, removedTokenIds }
}

export default function CampaignTimeSystem({ isDm }: { isDm: boolean }) {
  const clock = useCampaignTimeStore((state) => state.state)
  const hydratedRoomId = useCampaignTimeStore((state) => state.hydratedRoomId)
  const mutate = useCampaignTimeStore((state) => state.mutate)
  const characters = useCharacterStore((state) => state.characters)
  const maps = useMapStore((state) => state.maps)
  const geometryMaps = useMapGeometryStore((state) => state.maps)
  const [notification, setNotification] = useState<CampaignTimer | null>(null)
  const [restAdvance, setRestAdvance] = useState<CampaignTimeAdvance | null>(null)
  const seenTimerIds = useRef(new Set<string>())
  const seenRestIds = useRef(readRestReceipts())
  const restBaselineReady = useRef(false)
  const characterReconciliationKeyRef = useRef<string | null>(null)
  const creatureTokenReconciliationKeyRef = useRef<string | null>(null)
  const roomSession = getRoomSession()
  const currentRoomId = roomSession?.roomId ?? '__local__'
  const playerOwnedCharacterIds = useMemo(() => {
    if (roomSession?.role !== 'player') return new Set<string>()
    return new Set(roomOwnedPlayerCharacters(characters, roomSession.roomId, roomSession.memberId)
      .map((character) => character.id))
  }, [characters, roomSession?.memberId, roomSession?.role, roomSession?.roomId])

  useEffect(() => {
    // Both stores are persisted locally. On a document reload they initially
    // contain old browser snapshots, so reconciling either one before both room
    // resources hydrate can overwrite newer authoritative character state.
    const reconciliationKey = campaignTimeCharacterReconciliationKey(currentRoomId, clock)
    const creatureTokenKey = `${currentRoomId}:${clock.worldMinute}:${maps
      .flatMap((map) => map.tokens)
      .filter((token) => !token.characterId && token.type !== 'obstacle')
      .map((token) => token.id)
      .sort()
      .join(',')}`
    const canReconcile = canReconcileCampaignTimeCharacters({
      isDm,
      clockHydratedRoomId: hydratedRoomId,
      currentRoomId,
      charactersHydrated: hasHydratedSharedCharactersForCurrentRoom(),
    })
    if (canReconcile && (
      characterReconciliationKeyRef.current !== reconciliationKey ||
      creatureTokenReconciliationKeyRef.current !== creatureTokenKey
    )) {
      // Character/map store updates are also dependencies of this effect so
      // hydration can open the gate. Once one authoritative clock snapshot has
      // entered reconciliation, those ordinary updates must not start another
      // shared-character reload inside a long-cast atomic commit window.
      characterReconciliationKeyRef.current = reconciliationKey
      creatureTokenReconciliationKeyRef.current = creatureTokenKey
      void (async () => {
        const currentMaps = useMapStore.getState().maps
        const permanence = completeDnd5eWallOfStoneForCampaignTime({
          maps: currentMaps,
          characters: useCharacterStore.getState().characters,
          worldMinute: clock.worldMinute,
        })
        if (permanence.completedAreaIds.length > 0) {
          const mapStore = useMapStore.getState()
          for (const completedMap of permanence.maps) {
            const currentMap = currentMaps.find((map) => map.id === completedMap.id)
            if (currentMap === completedMap) continue
            mapStore.applyAuthorityMapUpdate(completedMap.id, {
              dnd5ePluginAreas: completedMap.dnd5ePluginAreas,
            })
          }
          await mapStore.saveSharedNow()
        }
        const mapStore = useMapStore.getState()
        let expiryCharacters: readonly Character[] = useCharacterStore.getState().characters
        let expiredAnyArea = false
        for (const currentMap of mapStore.maps) {
          const expiredMap = expireDnd5ePluginAreasAtWorldMinute(currentMap, clock.worldMinute)
          if (expiredMap === currentMap) continue
          const reconciled = reconcileDnd5ePluginAreasAndConcentrationOnMap(
            currentMap,
            expiryCharacters,
            0,
            expiredMap,
          )
          mapStore.applyAuthorityMapUpdate(currentMap.id, {
            dnd5ePluginAreas: reconciled.map.dnd5ePluginAreas,
            tokens: reconciled.map.tokens,
          })
          if (reconciled.characters !== expiryCharacters) {
            for (const character of reconciled.characters) {
              const previous = expiryCharacters.find((candidate) => candidate.id === character.id)
              if (previous && JSON.stringify(previous) !== JSON.stringify(character)) {
                useCharacterStore.getState().applyAuthorityUpdate(character.id, character)
              }
            }
            expiryCharacters = reconciled.characters
          }
          expiredAnyArea = true
        }
        if (expiredAnyArea) await mapStore.saveSharedNow()
        const createdObjectProjection = projectDnd5eCampaignTimeCreatedObjects({
          maps: useMapStore.getState().maps,
          worldMinute: clock.worldMinute,
        })
        if (createdObjectProjection.changed) {
          const mapStore = useMapStore.getState()
          for (const projectedMap of createdObjectProjection.maps) {
            const currentMap = mapStore.maps.find((map) => map.id === projectedMap.id)
            if (currentMap === projectedMap) continue
            mapStore.applyAuthorityMapUpdate(projectedMap.id, { tokens: projectedMap.tokens })
          }
          await mapStore.saveSharedNow()
        }
        const creatureTokenProjection = projectDnd5eCampaignTimeCreatureTokens({
          maps: useMapStore.getState().maps,
          characters: useCharacterStore.getState().characters,
          clock,
        })
        if (creatureTokenProjection.changed) {
          const mapStore = useMapStore.getState()
          for (const projectedMap of creatureTokenProjection.maps) {
            const currentMap = mapStore.maps.find((map) => map.id === projectedMap.id)
            if (currentMap === projectedMap) continue
            mapStore.applyAuthorityMapUpdate(projectedMap.id, { tokens: projectedMap.tokens })
          }
          await mapStore.saveSharedNow()
        }
        const airborneProjection = projectDnd5eCampaignTimeAirborneTokens({
          maps: useMapStore.getState().maps,
          geometryMaps: useMapGeometryStore.getState().maps,
          characters: useCharacterStore.getState().characters,
          clock,
        })
        await useCharacterStore.getState().reconcileCampaignTimeAndSave(clock, {
          airborneCharacterIds: airborneProjection.airborneCharacterIds,
        })
        if (airborneProjection.descendedCharacterIds.size > 0) {
          const mapStore = useMapStore.getState()
          for (const projectedMap of airborneProjection.maps) {
            const currentMap = mapStore.maps.find((map) => map.id === projectedMap.id)
            if (currentMap === projectedMap) continue
            mapStore.applyAuthorityMapUpdate(projectedMap.id, { tokens: projectedMap.tokens })
          }
          await mapStore.saveSharedNow()
        }
        useMapStore.getState().expireTimedLights(clock.worldMinute)
        useMapGeometryStore.getState().expireTimedLights(clock.worldMinute)
      })().catch((error) => {
        if (characterReconciliationKeyRef.current === reconciliationKey) {
          characterReconciliationKeyRef.current = null
        }
        if (creatureTokenReconciliationKeyRef.current === creatureTokenKey) {
          creatureTokenReconciliationKeyRef.current = null
        }
        console.error('[campaign-time] reconciliation failed', error)
      })
    }
  }, [characters, clock, currentRoomId, geometryMaps, hydratedRoomId, isDm, maps])

  useEffect(() => {
    if (notification) return
    const newlyExpired = clock.timers.find((timer) =>
      timer.status === 'expired' && !seenTimerIds.current.has(timer.id),
    )
    if (newlyExpired) setNotification(newlyExpired)
  }, [clock.timers, notification])

  useEffect(() => {
    if (hydratedRoomId !== currentRoomId || restBaselineReady.current) return
    let changed = false
    for (const advanceId of campaignRestReceiptBaselineIds(clock.advances)) {
      if (!seenRestIds.current.has(advanceId)) {
        seenRestIds.current.add(advanceId)
        changed = true
      }
    }
    if (changed) writeRestReceipts(seenRestIds.current)
    restBaselineReady.current = true
  }, [clock.advances, currentRoomId, hydratedRoomId])

  useEffect(() => {
    if (hydratedRoomId !== currentRoomId || !restBaselineReady.current || restAdvance) return
    const unseen = latestCampaignRestAdvanceForViewer(clock.advances, {
      isDm,
      playerOwnedCharacterIds,
      seenIds: seenRestIds.current,
    })
    if (!unseen) return
    for (const advance of clock.advances) {
      if (
        advance.id !== unseen.id &&
        (advance.kind === 'short-rest' || advance.kind === 'long-rest')
      ) seenRestIds.current.add(advance.id)
    }
    writeRestReceipts(seenRestIds.current)
    setRestAdvance(unseen)
  }, [clock.advances, currentRoomId, hydratedRoomId, isDm, playerOwnedCharacterIds, restAdvance])

  const close = () => {
    if (!notification) return
    seenTimerIds.current.add(notification.id)
    setNotification(null)
  }
  const closeRest = () => {
    if (!restAdvance) return
    seenRestIds.current.add(restAdvance.id)
    writeRestReceipts(seenRestIds.current)
    setRestAdvance(null)
  }
  return (
    <>
      {restAdvance && <div className="fixed inset-0 z-[520] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="rest-recovery-title" className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-indigo-300/20 bg-slate-950 shadow-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-300">
                {restAdvance.kind === 'long-rest' ? <MoonStar className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
                权威休息结算
              </p>
              <h2 id="rest-recovery-title" className="mt-2 text-xl font-bold text-slate-100">
                {restAdvance.kind === 'long-rest' ? '长休恢复完成' : '短休恢复完成'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{formatCampaignTime(restAdvance.toWorldMinute)} · 以下结果已同步至角色卡</p>
            </div>
            <button type="button" onClick={closeRest} className="rounded-xl border border-white/10 p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="关闭休息结算"><X className="h-5 w-5" /></button>
          </header>
          <div className="overflow-y-auto px-5 py-5 sm:px-7">
            <div className="grid gap-4 lg:grid-cols-2">
              {restAdvance.restRecoveryReports?.map((report) => (
                <article key={report.characterId} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate font-semibold text-slate-100">{report.characterName}</h3>
                    <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">已结算</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {report.entries.map((entry, index) => {
                      const value = recoveryValue(entry)
                      const positive = entry.outcome === 'restored' || entry.outcome === 'cleared'
                      return <div key={`${entry.category}:${entry.label}:${index}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${positive ? 'text-emerald-300' : entry.outcome === 'blocked' ? 'text-amber-300' : 'text-slate-600'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-200">{entry.label}</p>
                              {value && <span className="font-mono text-xs font-bold text-indigo-200">{value}</span>}
                            </div>
                            <p className="mt-1 text-[10px] text-slate-500">{RECOVERY_CATEGORY_LABELS[entry.category]}{entry.detail ? ` · ${entry.detail}` : ''}</p>
                          </div>
                        </div>
                      </div>
                    })}
                  </div>
                  {restAdvance.kind === 'short-rest' && playerOwnedCharacterIds.has(report.characterId) && (
                    <Dnd5eShortRestRecoveryActions
                      advance={restAdvance}
                      characterId={report.characterId}
                    />
                  )}
                </article>
              ))}
            </div>
          </div>
          <footer className="border-t border-white/10 px-5 py-4 sm:px-7">
            <button type="button" onClick={closeRest} className="w-full rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-400">确认恢复结果</button>
          </footer>
        </section>
      </div>}

      {notification && <div className="fixed right-5 top-5 z-[400] w-80 rounded-2xl border border-amber-400/30 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">
            {notification.kind === 'concentration' ? '非战斗专注到期' : '战役提醒到期'}
          </p>
          <p className="mt-1 break-words text-sm text-slate-300">{notification.label}</p>
          <p className="mt-2 text-[11px] text-slate-500">{formatCampaignTime(clock)}</p>
          {isDm && (
            <button
              type="button"
              onClick={() => void mutate({ operation: 'dismiss-timer', timerId: notification.id }).then(close)}
              className="mt-3 rounded-lg bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-400/25"
            >
              确认并归档
            </button>
          )}
        </div>
        <button type="button" onClick={close} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200" title="关闭提醒">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>}
    </>
  )
}
