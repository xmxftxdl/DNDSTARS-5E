import type { BattleMap } from '../../store/maps'
import type { Dnd5eMapResultPlan } from '../../rulesets/dnd5e'
import { createTokenMovementAnimation } from '../../lib/tokenMovementAnimation'

export interface AuthoritativeMovedEvent {
  type: 'moved'
  actorId: string
  from: { x: number; y: number }
  to: { x: number; y: number }
}

/**
 * Adds a host-authored path to forced movement results. The final coordinates
 * remain authoritative; clients only interpolate this signed snapshot.
 */
export function withForcedMovementPresentation(input: {
  application: Dnd5eMapResultPlan
  beforeMap: BattleMap
  events: readonly AuthoritativeMovedEvent[]
  transactionId: string
  issuedAt?: number
}): Dnd5eMapResultPlan {
  const paths = new Map<string, Array<{ x: number; y: number }>>()
  for (const event of input.events) {
    const before = input.beforeMap.tokens.find((token) => token.id === event.actorId)
    const path = paths.get(event.actorId) ?? [
      before ? { x: before.x, y: before.y } : { ...event.from },
    ]
    const last = path[path.length - 1]
    if (Math.hypot(last.x - event.from.x, last.y - event.from.y) >= 0.01) {
      path.push({ ...event.from })
    }
    path.push({ ...event.to })
    paths.set(event.actorId, path)
  }
  if (paths.size === 0) return input.application

  const changed = new Set(input.application.changedTokenIds)
  let decorated = false
  const tokens = input.application.map.tokens.map((token) => {
    const path = paths.get(token.id)
    if (!path || !changed.has(token.id)) return token
    const animation = createTokenMovementAnimation({
      id: `forced-move:${input.transactionId}:${token.id}`,
      path,
      finalPosition: { x: token.x, y: token.y },
      issuedAt: input.issuedAt,
    })
    if (!animation) return token
    decorated = true
    return { ...token, movementAnimation: animation }
  })
  return decorated
    ? { ...input.application, map: { ...input.application.map, tokens } }
    : input.application
}
