import { useCallback, useEffect, useRef } from 'react'
import type { GridCell } from '../../lib/gridCombat'
import { publishSharedEvent, subscribeSharedEvent } from '../../lib/sharedApi'
import type { useDnd5eActivityMapTargeting } from './useDnd5eActivityMapTargeting'

type CellRequest = Parameters<ReturnType<typeof useDnd5eActivityMapTargeting>['beginCells']>[0]
interface Request { mapId: string; characterId: string; input: CellRequest }
interface Reply { mapId: string; characterId: string; receiptId: string; cells?: readonly GridCell[] }
const requestChannel = 'activity-placement-dm-to-player'
const replyChannel = 'activity-placement-player-to-dm'

export function playerOwnsActivityPlacement(request: Request, mapId: string | undefined, controlled: ReadonlySet<string>) {
  return request.mapId === mapId && controlled.has(request.characterId)
}

/** The caster chooses; the Host still validates the returned destination before committing. */
export function usePlayerActivityPlacement(config: {
  mode: string | null | undefined
  mapId?: string
  controlledCharacterIds: readonly string[]
  beginCells: (input: CellRequest) => Promise<readonly GridCell[] | undefined>
  beforePlayerPlacement: () => void
}) {
  const latest = useRef(config)
  latest.current = config
  const pending = useRef(new Map<string, { request: Request; finish: (cells?: readonly GridCell[]) => void }>())
  const received = useRef(new Map<string, Promise<readonly GridCell[] | undefined>>())
  useEffect(() => {
    const stopRequests = subscribeSharedEvent<Request>(requestChannel, request => {
      const current = latest.current
      if (current.mode !== 'player' || !playerOwnsActivityPlacement(request, current.mapId, new Set(current.controlledCharacterIds))) return
      let placement = received.current.get(request.input.receiptId)
      if (!placement) {
        current.beforePlayerPlacement()
        placement = current.beginCells(request.input)
        received.current.set(request.input.receiptId, placement)
        if (received.current.size > 64) received.current.delete(received.current.keys().next().value!)
      }
      void placement.then(cells => publishSharedEvent<Reply>(replyChannel, {
        mapId: request.mapId, characterId: request.characterId, receiptId: request.input.receiptId, cells,
      })).catch(() => undefined)
    })
    const stopReplies = subscribeSharedEvent<Reply>(replyChannel, reply => {
      if (latest.current.mode !== 'dm') return
      const entry = pending.current.get(reply.receiptId)
      if (!entry || reply.mapId !== entry.request.mapId || reply.characterId !== entry.request.characterId) return
      const valid = reply.cells == null || (Array.isArray(reply.cells) && reply.cells.length === entry.request.input.count &&
        reply.cells.every(cell => Number.isInteger(cell.col) && Number.isInteger(cell.row)))
      if (valid) entry.finish(reply.cells)
    })
    return () => { stopRequests(); stopReplies(); for (const entry of pending.current.values()) entry.finish() }
  }, [config.mapId, config.mode])
  return useCallback((input: CellRequest, characterId?: string) => {
    const current = latest.current
    if (current.mode !== 'dm' || !characterId) return current.beginCells(input)
    if (!current.mapId) return Promise.resolve(undefined)
    const request: Request = { mapId: current.mapId, characterId, input }
    return new Promise<readonly GridCell[] | undefined>(resolve => {
      const finish = (cells?: readonly GridCell[]) => {
        clearInterval(retry); clearTimeout(timeout)
        pending.current.delete(input.receiptId)
        resolve(cells)
      }
      const send = () => { void publishSharedEvent(requestChannel, request).catch(() => undefined) }
      const retry = setInterval(send, 1500)
      const timeout = setTimeout(() => finish(), 120000)
      pending.current.set(input.receiptId, { request, finish })
      send()
    })
  }, [])
}
