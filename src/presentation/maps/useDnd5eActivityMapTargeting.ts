import { useCallback, useRef, useState } from 'react'
import type { GridCell } from '../../lib/gridCombat'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import type { BattleMap } from '../../store/maps'
import { useMapStore } from '../../store/maps'
import { useCharacterStore } from '../../store/characters'
import { readBrowserSceneWorldMinute } from '../../composition/browserSceneClock'
import {
  dnd5eActivityMapTemplateV1,
  dnd5eActivitySummonPlacementCells,
  dnd5eActivityAreaRangeOriginCellV1,
  resolveDnd5eActivityAreaMapSelectionV1,
  type Dnd5eActivityAreaMapSelectionV1,
} from '../../rulesets/dnd5e/activities/dnd5eActivityMapInteraction'
import type { Dnd5eActivityTriggerAreaSelectionRequestV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityTriggerSettlement'

export interface Dnd5eActivityMapTargetingSession {
  kind: 'area' | 'summon' | 'movement' | 'surface'
  receiptId: string
  label: string
  actorTokenId: string
  originTokenId: string
  rangeOriginCell?: GridCell
  template: SkillAoeTargeting
  activity?: Dnd5eActivityTriggerAreaSelectionRequestV1['activity']
  requiredCells: number
  minimumCells?: number
  selectedCells: readonly GridCell[]
  allowedCells?: readonly GridCell[]
  resolveAllowedCells?: (map: BattleMap, selectedCells: readonly GridCell[]) => readonly GridCell[]
}

type PendingResolution =
  | { kind: 'area'; resolve: (value: Dnd5eActivityAreaMapSelectionV1 | undefined) => void }
  | { kind: 'cells'; resolve: (value: readonly GridCell[] | undefined) => void }

/** Browser-only state machine shared by all Activity map placement handoffs. */
export function useDnd5eActivityMapTargeting(onUnavailable?: (label: string) => void) {
  const [session, setSession] = useState<Dnd5eActivityMapTargetingSession | null>(null)
  const pendingRef = useRef<PendingResolution | null>(null)
  const unavailableRef = useRef(onUnavailable)
  unavailableRef.current = onUnavailable

  const cancel = useCallback(() => {
    pendingRef.current?.resolve(undefined)
    pendingRef.current = null
    setSession(null)
  }, [])

  const beginArea = useCallback((
    request: Pick<Dnd5eActivityTriggerAreaSelectionRequestV1, 'receiptId' | 'activity' | 'actorId'>,
    map: BattleMap,
  ): Promise<Dnd5eActivityAreaMapSelectionV1 | undefined> => {
    const actorToken = map.tokens.find((token) => token.id === request.actorId)
    const template = dnd5eActivityMapTemplateV1(request.activity)
    if (!actorToken || !template) return Promise.resolve(undefined)
    const rangeOriginCell = dnd5eActivityAreaRangeOriginCellV1({ activity: request.activity, map, actorToken })
    if (!rangeOriginCell) return Promise.resolve(undefined)
    // A self-centred radial trigger has no placement decision. Recipient
    // selection is handled separately by the authoritative trigger window.
    const target = request.activity.target
    if (target.kind === 'area' && target.origin === 'self' &&
      (target.shape === 'circle' || target.shape === 'sphere')) {
      return Promise.resolve(resolveDnd5eActivityAreaMapSelectionV1({
        activity: request.activity, map, actorToken, anchorCell: rangeOriginCell,
        characters: useCharacterStore.getState().characters,
        worldMinute: readBrowserSceneWorldMinute(),
      }))
    }
    pendingRef.current?.resolve(undefined)
    return new Promise((resolve) => {
      pendingRef.current = { kind: 'area', resolve }
      setSession({
        kind: 'area', receiptId: request.receiptId, label: request.activity.name,
        actorTokenId: actorToken.id, originTokenId: actorToken.id, template,
        rangeOriginCell,
        activity: request.activity, requiredCells: 1, selectedCells: [],
      })
    })
  }, [])

  const beginCells = useCallback((input: {
    receiptId: string
    kind: 'summon' | 'movement' | 'surface'
    label: string
    actorTokenId: string
    originTokenId: string
    rangeFeet: number
    count: number
    /** Enables toggle selection with an explicit Done button, including an empty selection. */
    minimumCells?: number
    allowedCells?: readonly GridCell[]
    resolveAllowedCells?: Dnd5eActivityMapTargetingSession['resolveAllowedCells']
    summonPlacement?: Omit<Parameters<typeof dnd5eActivitySummonPlacementCells>[0], 'selectedCells'>
  }): Promise<readonly GridCell[] | undefined> => {
    pendingRef.current?.resolve(undefined)
    const placement = input.summonPlacement
    const resolveAllowedCells = input.resolveAllowedCells ?? (placement
      ? (map: BattleMap, selectedCells: readonly GridCell[]) => dnd5eActivitySummonPlacementCells({
          ...placement, map, selectedCells, characters: useCharacterStore.getState().characters,
          sourceLimitMaps: useMapStore.getState().maps,
          worldMinute: readBrowserSceneWorldMinute(),
        }) : undefined)
    const allowedCells = placement ? resolveAllowedCells?.(placement.map, []) : input.allowedCells
    if (allowedCells?.length === 0 && input.minimumCells === 0) {
      pendingRef.current = null
      setSession(null)
      return Promise.resolve([])
    }
    if (allowedCells?.length === 0) {
      pendingRef.current = null
      setSession(null)
      unavailableRef.current?.(input.label)
      return Promise.resolve(undefined)
    }
    return new Promise((resolve) => {
      pendingRef.current = { kind: 'cells', resolve }
      setSession({
        kind: input.kind, receiptId: input.receiptId, label: input.label,
        actorTokenId: input.actorTokenId, originTokenId: input.originTokenId,
        template: { shape: 'circle', origin: 'self', radiusFeet: allowedCells ? 5 : Math.max(5, input.rangeFeet) },
        requiredCells: Math.max(1, input.count), minimumCells: input.minimumCells, selectedCells: [], allowedCells,
        resolveAllowedCells,
      })
    })
  }, [])

  const confirm = useCallback((input: {
    map: BattleMap
    cell: GridCell
    rectRotation: number
  }): { ok: true; completed: boolean } | { ok: false; reason: 'invalid-area' | 'duplicate-cell' } => {
    const pending = pendingRef.current
    if (!session || !pending) return { ok: false, reason: 'invalid-area' }
    if (session.kind === 'area' && session.activity && pending.kind === 'area') {
      const actorToken = input.map.tokens.find((token) => token.id === session.actorTokenId)
      const selection = actorToken ? resolveDnd5eActivityAreaMapSelectionV1({
        activity: session.activity, map: input.map, actorToken,
        characters: useCharacterStore.getState().characters,
        worldMinute: readBrowserSceneWorldMinute(),
        anchorCell: input.cell, rectRotation: input.rectRotation,
      }) : undefined
      if (!selection) return { ok: false, reason: 'invalid-area' }
      pending.resolve(selection)
      pendingRef.current = null
      setSession(null)
      return { ok: true, completed: true }
    }
    const allowedCells = session.resolveAllowedCells?.(input.map, session.selectedCells) ?? session.allowedCells
    if (allowedCells && !allowedCells.some(cell => cell.col === input.cell.col && cell.row === input.cell.row)) {
      setSession({ ...session, allowedCells })
      return { ok: false, reason: 'invalid-area' }
    }
    if (pending.kind !== 'cells') return { ok: false, reason: 'invalid-area' }
    if (session.selectedCells.some((selected) =>
      selected.col === input.cell.col && selected.row === input.cell.row)) {
      if (session.minimumCells != null) {
        setSession({ ...session, selectedCells: session.selectedCells.filter(cell => cell.col !== input.cell.col || cell.row !== input.cell.row) })
        return { ok: true, completed: false }
      }
      return { ok: false, reason: 'duplicate-cell' }
    }
    if (session.selectedCells.length >= session.requiredCells) return { ok: false, reason: 'invalid-area' }
    const selectedCells = [...session.selectedCells, { ...input.cell }]
    if (session.minimumCells == null && selectedCells.length >= session.requiredCells) {
      pending.resolve(selectedCells)
      pendingRef.current = null
      setSession(null)
      return { ok: true, completed: true }
    }
    setSession({ ...session, selectedCells, allowedCells: session.resolveAllowedCells?.(input.map, selectedCells) ?? allowedCells })
    return { ok: true, completed: false }
  }, [session])

  const finishCells = useCallback(() => {
    if (!session || session.minimumCells == null || pendingRef.current?.kind !== 'cells' ||
      session.selectedCells.length < session.minimumCells) return
    pendingRef.current.resolve(session.selectedCells)
    pendingRef.current = null
    setSession(null)
  }, [session])

  return { session, beginArea, beginCells, confirm, cancel, finishCells }
}
