/** Positions are in feet, independent of map pixel scale. Parts are not creatures. */
export interface MultipartPosition { x: number; y: number; z: number }
export interface MultipartHead {
  id: string
  alive: boolean
  position: MultipartPosition
  movementSpent: number
  actionSpent: boolean
  grappledTargetId?: string
  swallowedTargetIds: string[]
  singingThroughTurn?: number
}
export interface MultipartCreatureState {
  schemaVersion: 1
  body: MultipartPosition
  bodyDead?: boolean
  heads: MultipartHead[]
  damageRemainder: number
  pendingHeadDeaths: number
  extraOpportunityReactionsSpent: number
  turn: number
  nextHeadNumber: number
  lastHumanoidConsumedMinute?: number
  lastRegrowthRestId?: string
  lastRegrowthMinute?: number
  restStartedMinute?: number
  learnedLanguages?: string[]
  lastLegendaryWindowKey?: string
  consumed: {targetId:string;name:string;minute:number;requiem:boolean;rewriteMinutesByActorId:Record<string,number>}[]
  /** Initiative identity survives map snapshot rebuilds. */
  turnKey?: string
  multiattackStarted?: boolean
  /** Synchronous origin override; cleared before every committed result. */
  activeHeadId?: string
}
const finitePosition = (p: MultipartPosition) => [p.x, p.y, p.z].every(Number.isFinite)
export const multipartDistance = (a: MultipartPosition, b: MultipartPosition) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z)

export function createMultipartCreature(body: MultipartPosition, count = 4): MultipartCreatureState {
  if (!finitePosition(body) || !Number.isInteger(count) || count < 1 || count > 9) throw new Error('invalid-multipart-creature')
  return { schemaVersion: 1, body: {...body}, heads: Array.from({length: count}, (_,i) => ({
    id: `head-${i+1}`, alive: true, position: {...body}, movementSpent: 0, actionSpent: false, swallowedTargetIds: [],
  })), damageRemainder: 0, pendingHeadDeaths: 0, extraOpportunityReactionsSpent: 0, turn: 0, nextHeadNumber: count+1, consumed: [] }
}

export function livingMultipartHeads(state: MultipartCreatureState): MultipartHead[] {
  return state.heads.filter(head => head.alive)
}

/** Call once per committed shared HP damage event, never once per intersecting part. */
export function recordMultipartDamage(state: MultipartCreatureState, damage: number, bodyDead: boolean): void {
  if (!Number.isSafeInteger(damage) || damage < 0) throw new Error('invalid-multipart-damage')
  if (bodyDead) {
    state.bodyDead=true
    state.pendingHeadDeaths = livingMultipartHeads(state).length
    return
  }
  const total = state.damageRemainder + damage
  state.damageRemainder = total % 50
  state.pendingHeadDeaths = Math.min(livingMultipartHeads(state).length, state.pendingHeadDeaths + Math.floor(total/50))
}

/** The Host must request the DM's choice rather than silently choosing a head. */
export function severMultipartHead(state: MultipartCreatureState, id: string): { released: string[]; position: MultipartPosition } {
  const head = state.heads.find(h => h.id === id && h.alive)
  if (!head || state.pendingHeadDeaths < 1) throw new Error('invalid-head-death-choice')
  const released = [...head.swallowedTargetIds, ...(head.grappledTargetId ? [head.grappledTargetId] : [])]
  head.alive = false
  head.swallowedTargetIds = []
  delete head.grappledTargetId
  delete head.singingThroughTurn
  state.pendingHeadDeaths--
  return {released, position: {...head.position}}
}

export function moveMultipartHead(state: MultipartCreatureState, id: string, to: MultipartPosition, pathFeet: number): void {
  const head = state.heads.find(h => h.id === id && h.alive)
  if (!head || state.pendingHeadDeaths || !finitePosition(to) || !Number.isFinite(pathFeet) ||
      pathFeet < multipartDistance(head.position, to)-1e-6 ||
      head.movementSpent + pathFeet > 30+1e-6 || multipartDistance(state.body,to)>300+1e-6) {
    throw new Error('invalid-head-movement')
  }
  head.position = {...to}
  head.movementSpent += pathFeet
}

export function moveMultipartBody(state: MultipartCreatureState, to: MultipartPosition): void {
  if (!finitePosition(to)) throw new Error('invalid-body-movement')
  const delta = {x:to.x-state.body.x, y:to.y-state.body.y, z:to.z-state.body.z}
  for (const head of livingMultipartHeads(state)) head.position = {
    x:head.position.x+delta.x,y:head.position.y+delta.y,z:head.position.z+delta.z,
  }
  state.body = {...to}
}

export function beginMultipartTurn(state: MultipartCreatureState): void {
  state.turn++
  state.multiattackStarted = false
  state.extraOpportunityReactionsSpent = 0
  for (const head of livingMultipartHeads(state)) { head.movementSpent=0; head.actionSpent=false }
}

export function endMultipartTurn(state: MultipartCreatureState): void {
  for (const head of state.heads) if (head.singingThroughTurn != null && head.singingThroughTurn<=state.turn) delete head.singingThroughTurn
}

export function consumeMultipartHeadAction(state: MultipartCreatureState, id: string): MultipartHead {
  const head=state.heads.find(h=>h.id===id&&h.alive)
  if (!head || head.actionSpent || state.pendingHeadDeaths) throw new Error('head-action-unavailable')
  head.actionSpent=true
  return head
}

export function consumeMultipartOpportunityReaction(state: MultipartCreatureState): void {
  const available=Math.max(0,livingMultipartHeads(state).length-1)
  if (state.pendingHeadDeaths || state.extraOpportunityReactionsSpent>=available) throw new Error('head-reaction-unavailable')
  state.extraOpportunityReactionsSpent++
}

/** A unique completed rest can regrow at most one head; no healing is implied. */
export function regrowMultipartHead(state: MultipartCreatureState, restId: string, minute: number): boolean {
  if (!restId || !Number.isFinite(minute)) throw new Error('invalid-head-regrowth')
  if (state.lastRegrowthRestId===restId || (state.lastRegrowthMinute != null && minute <= state.lastRegrowthMinute)) return false
  state.lastRegrowthRestId=restId
  state.lastRegrowthMinute=minute
  const alive=livingMultipartHeads(state).length
  const ate=state.lastHumanoidConsumedMinute
  if (state.bodyDead || alive>=9 || state.pendingHeadDeaths || ate==null || minute<ate || minute-ate>1440) return false
  const freeNumber = Array.from({length:9}, (_,i)=>i+1).find(n=>!state.heads.some(h=>h.alive && h.id===`head-${n}`))!
  state.heads = state.heads.filter(h=>h.id!==`head-${freeNumber}`)
  state.nextHeadNumber = Math.max(state.nextHeadNumber,freeNumber+1)
  state.heads.push({id:`head-${freeNumber}`,alive:true,position:{...state.body},movementSpent:0,actionSpent:false,swallowedTargetIds:[]})
  return true
}

/** All parts identify the same creature. Distinct heads must never duplicate an area hit. */
export function multipartAreaTargetIds(
  creatures: readonly { id: string; position: MultipartPosition; multipart?: MultipartCreatureState }[],
  contains: (position: MultipartPosition) => boolean,
): string[] {
  return [...new Set(creatures.filter(creature => contains(creature.position) ||
    (creature.multipart && livingMultipartHeads(creature.multipart).some(head => contains(head.position))))
    .map(creature => creature.id))]
}

export function multipartHeadOrigins(state: MultipartCreatureState): MultipartPosition[] {
  return livingMultipartHeads(state).map(head => ({ ...head.position }))
}

/** An attack on a neck is an attack on the shared creature, not a head HP pool. */
export function multipartDistanceToBody(position: MultipartPosition, state: MultipartCreatureState): number {
  let distance = multipartDistance(position, state.body)
  for (const head of livingMultipartHeads(state)) {
    const a = state.body, b = head.position
    const dx = b.x-a.x, dy = b.y-a.y, dz = b.z-a.z
    const lengthSquared = dx*dx+dy*dy+dz*dz
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
      ((position.x-a.x)*dx+(position.y-a.y)*dy+(position.z-a.z)*dz)/lengthSquared))
    distance = Math.min(distance, multipartDistance(position, {x:a.x+t*dx,y:a.y+t*dy,z:a.z+t*dz}))
  }
  return distance
}

/** Resolve every head immediately when the shared creature dies. */
export function killMultipartCreature(state: MultipartCreatureState): ReturnType<typeof severMultipartHead>[] {
  state.bodyDead=true
  state.pendingHeadDeaths = livingMultipartHeads(state).length
  return livingMultipartHeads(state).map(head => severMultipartHead(state, head.id))
}
