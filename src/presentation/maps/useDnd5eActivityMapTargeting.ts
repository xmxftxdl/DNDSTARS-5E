import { useCallback, useRef, useState } from 'react'
import type { GridCell } from '../../lib/gridCombat'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import type { BattleMap } from '../../store/maps'
import {
  dnd5eActivityMapTemplateV1,
  resolveDnd5eActivityAreaMapSelectionV1,
  type Dnd5eActivityAreaMapSelectionV1,
} from '../../rulesets/dnd5e/activities/dnd5eActivityMapInteraction'
import type { Dnd5eActivityTriggerAreaSelectionRequestV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityTriggerSettlement'

export interface Dnd5eActivityMapTargetingSession {
  kind: 'area' | 'summon' | 'movement'
  receiptId: string
  label: string
  actorTokenId: string
  originTokenId: string
  template: SkillAoeTargeting
  activity?: Dnd5eActivityTriggerAreaSelectionRequestV1['activity']
  requiredCells: number
  selectedCells: readonly GridCell[]
}

type PendingResolution =
  | { kind: 'area'; resolve: (value: Dnd5eActivityAreaMapSelectionV1 | undefined) => void }
  | { kind: 'cells'; resolve: (value: readonly GridCell[] | undefined) => void }

/** Browser-only state machine shared by all Activity map placement handoffs. */
export function useDnd5eActivityMapTargeting() {
  const [session, setSession] = useState<Dnd5eActivityMapTargetingSession | null>(null)
  const pendingRef = useRef<PendingResolution | null>(null)

  const cancel = useCallback(() => {
    pendingRef.current?.resolve(undefined)
    pendingRef.current = null
    setSession(null)
  }, [])

  const beginArea = useCallback((
    request: Dnd5eActivityTriggerAreaSelectionRequestV1,
    map: BattleMap,
  ): Promise<Dnd5eActivityAreaMapSelectionV1 | undefined> => {
    const actorToken = map.tokens.find((token) => token.id === request.actorId)
    const template = dnd5eActivityMapTemplateV1(request.activity)
    if (!actorToken || !template) return Promise.resolve(undefined)
    pendingRef.current?.resolve(undefined)
    return new Promise((resolve) => {
      pendingRef.current = { kind: 'area', resolve }
      setSession({
        kind: 'area', receiptId: request.receiptId, label: request.activity.name,
        actorTokenId: actorToken.id, originTokenId: actorToken.id, template,
        activity: request.activity, requiredCells: 1, selectedCells: [],
      })
    })
  }, [])

  const beginCells = useCallback((input: {
    receiptId: string
    kind: 'summon' | 'movement'
    label: string
    actorTokenId: string
    originTokenId: string
    rangeFeet: number
    count: number
  }): Promise<readonly GridCell[] | undefined> => {
    pendingRef.current?.resolve(undefined)
    return new Promise((resolve) => {
      pendingRef.current = { kind: 'cells', resolve }
      setSession({
        kind: input.kind, receiptId: input.receiptId, label: input.label,
        actorTokenId: input.actorTokenId, originTokenId: input.originTokenId,
        template: { shape: 'circle', origin: 'self', radiusFeet: Math.max(5, input.rangeFeet) },
        requiredCells: Math.max(1, input.count), selectedCells: [],
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
        anchorCell: input.cell, rectRotation: input.rectRotation,
      }) : undefined
      if (!selection) return { ok: false, reason: 'invalid-area' }
      pending.resolve(selection)
      pendingRef.current = null
      setSession(null)
      return { ok: true, completed: true }
    }
    if (pending.kind !== 'cells') return { ok: false, reason: 'invalid-area' }
    if (session.selectedCells.some((selected) =>
      selected.col === input.cell.col && selected.row === input.cell.row)) {
      return { ok: false, reason: 'duplicate-cell' }
    }
    const selectedCells = [...session.selectedCells, { ...input.cell }]
    if (selectedCells.length >= session.requiredCells) {
      pending.resolve(selectedCells)
      pendingRef.current = null
      setSession(null)
      return { ok: true, completed: true }
    }
    setSession({ ...session, selectedCells })
    return { ok: true, completed: false }
  }, [session])

  return { session, beginArea, beginCells, confirm, cancel }
}
