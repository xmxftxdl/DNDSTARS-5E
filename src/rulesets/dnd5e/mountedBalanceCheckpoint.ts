import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import { planDnd5eDismountPlacement, type Dnd5eDismountDirection } from './mountedPlacement'
import { planDnd5eMapResultApplication } from './mapBridge'
import { previewDnd5eMountedBalance, resolveDnd5eMountedBalanceAfterAction,
  type Dnd5eMountedBalanceChoice, type Dnd5eMountedBalanceRequest, type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState, type Dnd5eCombatEvent } from './headlessCombatEngine'

const directions: readonly Dnd5eDismountDirection[] = ['north','northeast','east','southeast','south','southwest','west','northwest']

/** Forced mounts and their passengers each enter areas; dismounts can have zero movement cost. */
export function dnd5eBasicActionAreaMovementTargets(events: readonly Dnd5eCombatEvent[]): string[] {
  return [...new Set(events.flatMap(event => event.type === 'moved' &&
    (event.from.x !== event.to.x || event.from.y !== event.to.y || event.fromElevationFeet !== event.toElevationFeet)
    ? [event.actorId] : []))]
}

/** Collects Host-owned decisions without publishing the provisional attack or any resource changes. */
export async function settleDnd5eMountedBalanceCheckpoint(input: {
  before: Dnd5eHeadlessCombatState
  result: Dnd5eActionResult
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  isCurrent?: () => boolean
  save: (request: Dnd5eMountedBalanceRequest) => Promise<{ choice: Dnd5eMountedBalanceChoice; success: boolean }>
  reaction: (request: Dnd5eMountedBalanceRequest) => Promise<boolean>
  landing: (request: Dnd5eMountedBalanceRequest, directions: readonly Dnd5eDismountDirection[]) => Promise<Dnd5eDismountDirection | undefined>
  damage: (request: Dnd5eMountedBalanceRequest, count: number) => Promise<readonly number[]>
}) {
  const requests = previewDnd5eMountedBalance(input.before, input.result)
  if (!requests.length) return { result: input.result }
  const fail = () => ({ result: { ok: false, state: input.before, events: [], reason: 'invalid-target' } as Dnd5eActionResult })
  const choices: Record<string, Dnd5eMountedBalanceChoice> = {}, fallingRolls: Record<string, readonly number[]> = {}
  const projection = { map: structuredClone(input.map), characters: structuredClone(input.characters),
    characterIdByCombatantId: { ...input.characterIdByCombatantId } }
  let projected = planDnd5eMapResultApplication({ ...projection, state: structuredClone(input.result.state), events: structuredClone([...input.result.events]) }).map
  for (const request of requests) {
    if (input.isCurrent?.() === false) return fail()
    let falls = request.cause === 'mount-prone'
    const choice: Dnd5eMountedBalanceChoice = falls
      ? { useReaction: request.canUseReaction && await input.reaction(request) }
      : await input.save(request).then(save => { falls = !save.success; return save.choice })
    choices[request.riderId] = choice
    if (input.isCurrent?.() === false) return fail()
    if (!falls) continue
    const legal = directions.filter(direction => planDnd5eDismountPlacement(projected, request.riderId, request.mountId, direction))
    if (!legal.length) return fail()
    const direction = await input.landing(request, legal)
    if (input.isCurrent?.() === false) return fail()
    if (!direction || !legal.includes(direction)) return fail()
    const to = planDnd5eDismountPlacement(projected, request.riderId, request.mountId, direction)
    if (!to) return fail()
    const groundElevationFeet = mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(projected.id), to)
    choice.landing = { ...to, groundElevationFeet }
    const rider = input.result.state.combatants[request.riderId]
    const height = (rider.elevationFeet ?? rider.groundElevationFeet ?? 0) - groundElevationFeet
    if (height < 0) return fail()
    const count = Math.min(20, Math.floor(height / 10))
    if (count > 0) fallingRolls[request.riderId] = await input.damage(request, count)
    // Reserve this landing before asking for another rider's destination.
    projected = { ...projected, tokens: projected.tokens.map(token => token.id === request.riderId ? { ...token, ...to, elevationFeet: groundElevationFeet } : token) }
  }
  if (input.isCurrent?.() === false) return fail()
  const result = resolveDnd5eMountedBalanceAfterAction(input.before, input.result, choices, fallingRolls)
  return { result, application: result.ok ? planDnd5eMapResultApplication({ ...projection, state: result.state, events: [...result.events] }) : undefined }
}
