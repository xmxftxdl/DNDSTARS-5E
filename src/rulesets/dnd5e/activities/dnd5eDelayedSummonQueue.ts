import { isIndependentCorpseSummon, validDelayedSourceIdentity, type Dnd5eDelayedSourceIdentity } from './dnd5eIndependentCorpseSummon'
import type { BattleMap } from '../../../store/maps'
import type { Character } from '../../../types/character'
import type { applyDnd5eActivityMapHandoffsV1, Dnd5eActivityMapHandoffResultV1 } from './dnd5eActivityMapInteraction'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eCombatEvent } from '../headlessCombatEngine'

type MapRequest = Parameters<typeof applyDnd5eActivityMapHandoffsV1>[0]
export type Dnd5eDelayedSummonRequest = Omit<MapRequest, 'map' | 'characters' | 'round' | 'worldMinute' | 'delayedSourceIdentity'>
export type Dnd5eDelayedSummonInitiative = Pick<Dnd5eActivityMapHandoffResultV1['initiativeEntries'][number], 'roll' | 'initiativeCalculation'>
export interface Dnd5eDelayedSummonEntry {
  schemaVersion: 1
  id: string
  combatId?: string
  /** Absolute campaign seconds for an exploration cast, not a wall-clock timer. */
  dueWorldSecond?: number
  /** Used only after the owning combat has ended. */
  dueAfterCombatWorldSecond?: number
  queuedRound: number
  queuedAfterTurnKey?: string
  queuedAfterTurnSequence?: number
  sourceTokenId: string
  sourceIdentity?: Dnd5eDelayedSourceIdentity
  sourceTurn?: { round: number; slotIds: string[]; index: number }
  request: Dnd5eDelayedSummonRequest
  initiativeResults?: readonly Dnd5eDelayedSummonInitiative[]
  status: 'pending' | 'completed' | 'cancelled' | 'blocked'
  settledTurnKey?: string
  reason?: string
}

type TurnSlot = { tokenId: string; slotId?: string }
function validSourceTurn(turn: Dnd5eDelayedSummonEntry['sourceTurn']): boolean {
  return !!turn && Number.isSafeInteger(turn.round) && turn.round>=1 && Array.isArray(turn.slotIds) &&
    turn.slotIds.length>0 && turn.slotIds.length<=4096 && turn.slotIds.every(id=>typeof id==='string'&&!!id) &&
    new Set(turn.slotIds).size===turn.slotIds.length && Number.isSafeInteger(turn.index) && turn.index>=0 && turn.index<turn.slotIds.length
}

function validTiming(entry: { combatId?: string; dueWorldSecond?: number; queuedAfterTurnKey?: string; queuedAfterTurnSequence?: number }): boolean {
  if (entry.dueWorldSecond != null) return Number.isSafeInteger(entry.dueWorldSecond) && entry.dueWorldSecond >= 0 &&
    entry.combatId == null && entry.queuedAfterTurnKey == null && entry.queuedAfterTurnSequence == null
  return typeof entry.combatId === 'string' && !!entry.combatId && typeof entry.queuedAfterTurnKey === 'string' && !!entry.queuedAfterTurnKey &&
    Number.isSafeInteger(entry.queuedAfterTurnSequence) && Number(entry.queuedAfterTurnSequence) >= 0
}

export function normalizeDnd5eDelayedSummons(value: unknown): Dnd5eDelayedSummonEntry[] | undefined {
  if (!Array.isArray(value) || value.length > 4096) return undefined
  const ids = new Set<string>()
  const entries = value.flatMap((entry: Dnd5eDelayedSummonEntry) => {
    try {
      if (!entry || entry.schemaVersion !== 1 || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) ||
        !validTiming(entry) ||
        (entry.dueAfterCombatWorldSecond != null && (!entry.combatId || !Number.isSafeInteger(entry.dueAfterCombatWorldSecond) || entry.dueAfterCombatWorldSecond<0)) ||
        (entry.sourceTurn != null && (!entry.combatId || !validSourceTurn(entry.sourceTurn))) ||
        !Number.isSafeInteger(entry.queuedRound) || entry.queuedRound < 1 ||
        !['pending','completed','cancelled','blocked'].includes(entry.status) ||
        entry.request.combatId !== entry.combatId || entry.request.actorId !== entry.sourceTokenId ||
        typeof entry.sourceTokenId !== 'string' || !entry.sourceTokenId ||
        (entry.sourceIdentity != null && (!isIndependentCorpseSummon(entry.request.handoffs) || !validDelayedSourceIdentity(entry.sourceIdentity,entry.sourceTokenId))) ||
        typeof entry.request.packageId !== 'string' || typeof entry.request.actionId !== 'string' ||
        validateDnd5eActivityDefinitionV1(entry.request.activity).length > 0 ||
        !Array.isArray(entry.request.handoffs.summons) || !entry.request.handoffs.summons.length ||
        entry.request.handoffs.summons.some(summon => summon.timing !== 'source-next-turn-start' || !Number.isSafeInteger(summon.count) || summon.count < 1) ||
        Object.entries(entry.request.handoffs).some(([key, items]) => key !== 'summons' && Array.isArray(items) && items.length > 0) ||
        (entry.initiativeResults != null && (!Array.isArray(entry.initiativeResults) || entry.initiativeResults.length !== entry.request.handoffs.summons.reduce((sum,summon)=>sum+summon.count,0) || entry.initiativeResults.some(result=>!Number.isFinite(result?.roll))))) return []
      ids.add(entry.id)
      return [structuredClone(entry)]
    } catch { return [] }
  })
  return entries.length ? entries : undefined
}

/** Host-only admission, after dice and placement selection have been verified. */
export function enqueueDnd5eDelayedSummon(input: {
  map: BattleMap; request: Dnd5eDelayedSummonRequest; combatId?: string; round: number; turnKey?: string; turnSequence?: number; dueWorldSecond?: number; receiptId: string
  initiativeResults?: readonly Dnd5eDelayedSummonInitiative[]
  initiativeOrder?: readonly TurnSlot[]
  worldSecond?: number
}): BattleMap {
  const { request } = input
  if (!input.receiptId || !validTiming({combatId:input.combatId, dueWorldSecond:input.dueWorldSecond, queuedAfterTurnKey:input.turnKey, queuedAfterTurnSequence:input.turnSequence}) || !Number.isSafeInteger(input.round) || input.round < 1 ||
    request.combatId !== input.combatId || !input.map.tokens.some(token => token.id === request.actorId) ||
    !request.handoffs.summons.length || request.handoffs.summons.some(summon => summon.timing !== 'source-next-turn-start') ||
    Object.entries(request.handoffs).some(([key, value]) => key !== 'summons' && Array.isArray(value) && value.length > 0)) {
    throw new Error('Invalid delayed summon admission')
  }
  const entries = input.map.dnd5eDelayedSummons ?? []
  const previous = entries.find(entry => entry.id === input.receiptId)
  if (previous) {
    if (previous.combatId !== input.combatId || previous.dueWorldSecond !== input.dueWorldSecond || JSON.stringify(previous.request) !== JSON.stringify(request) || JSON.stringify(previous.initiativeResults)!==JSON.stringify(input.initiativeResults)) throw new Error('Conflicting delayed summon receipt')
    return input.map
  }
  if (entries.length >= 4096) throw new Error('Delayed summon receipt capacity reached')
  const source=input.map.tokens.find(token=>token.id===request.actorId)!
  const sourceIdentity=isIndependentCorpseSummon(request.handoffs)
    ? {id:source.id,characterId:source.characterId,type:source.type,label:source.label,emoji:source.emoji,color:source.color} : undefined
  let sourceTurn:Dnd5eDelayedSummonEntry['sourceTurn']
  const cursor=input.map.dnd5eActivityTurnClock?.cursor, order=input.initiativeOrder
  if(input.combatId && sourceIdentity && cursor && order?.length){
    const current=order.findIndex(slot=>(slot.slotId??slot.tokenId)===cursor.slotId)
    if(current>=0){
      for(let step=1;step<=order.length;step++){
        const index=(current+step)%order.length
        if(order[index].tokenId!==request.actorId)continue
        sourceTurn={round:cursor.round+(current+step>=order.length?1:0),slotIds:order.map(slot=>slot.slotId??slot.tokenId),index}
        if(!validSourceTurn(sourceTurn))throw Error('Invalid delayed source turn')
        break
      }
    }
  }
  const delay=request.handoffs.summons[0]?.explorationDelaySeconds
  const dueAfterCombatWorldSecond=input.combatId && Number.isSafeInteger(input.worldSecond) && Number(input.worldSecond)>=0 &&
    Number.isSafeInteger(delay) && Number(delay)>0 && request.handoffs.summons.every(summon=>summon.explorationDelaySeconds===delay)
    ? Number(input.worldSecond)+Number(delay) : undefined
  return { ...input.map, dnd5eDelayedSummons: [...entries, { schemaVersion: 1, id: input.receiptId,
    combatId: input.combatId, dueWorldSecond: input.dueWorldSecond, dueAfterCombatWorldSecond, queuedRound: input.round, queuedAfterTurnKey: input.turnKey, queuedAfterTurnSequence: input.turnSequence,
    sourceTokenId: request.actorId, sourceIdentity, sourceTurn, request: structuredClone(request), initiativeResults:structuredClone(input.initiativeResults), status: 'pending' }] }
}

/** Reuse the same concentration identity stored on ordinary summoned creatures. */
export function dnd5eDelayedSummonSourceAvailable(entry: Dnd5eDelayedSummonEntry, map: BattleMap, characters: readonly Character[]): boolean {
  const token = map.tokens.find(candidate => candidate.id === entry.sourceTokenId)
  if (!token) return isIndependentCorpseSummon(entry.request.handoffs) && validDelayedSourceIdentity(entry.sourceIdentity,entry.sourceTokenId)
  const character = characters.find(candidate => candidate.id === token.characterId)
  const hp = character?.currentHp ?? token.hp ?? token.maxHp
  if (entry.request.handoffs.summons.some(summon => summon.sourceDeathBehavior === 'die')) {
    const dead = character ? character.currentHp <= 0 && (character.deathSaveFailures ?? 0) >= 3
      : hp != null && hp <= 0 && token.dnd5eCombatState?.stableAtZero !== true && token.dnd5eCombatState?.undeadFortitudePending == null && token.dnd5eCombatState?.monsterRegenerationPendingAtZero !== true
    if (dead) return false
  }
  if (!entry.request.handoffs.summons.some(summon => summon.concentration)) return true
  if (hp != null && hp <= 0) return false
  const concentrationId = entry.request.concentrationId ?? `activity:${entry.request.activity.id}`
  return (character?.dnd5eCombatState?.concentrationSpellId ?? token.dnd5eCombatState?.concentrationSpellId) === concentrationId
}

/** Apply to pre-existing tasks before admitting tasks from the new execution. */
export function cancelDnd5eDelayedSummonsForEvents(map: BattleMap, combatId: string, events: readonly Dnd5eCombatEvent[]): BattleMap {
  const ended = new Set(events.flatMap(event => event.type === 'class-state-changed' && event.stateKey === 'concentration' && !event.active ? [event.actorId] : []))
  let changed = false
  const entries = map.dnd5eDelayedSummons?.map(entry => {
    if (entry.status !== 'pending' || entry.combatId !== combatId || !ended.has(entry.sourceTokenId) || !entry.request.handoffs.summons.some(summon => summon.concentration)) return entry
    changed = true
    return { ...entry, status: 'cancelled' as const, reason: 'concentration-ended' }
  })
  return changed ? { ...map, dnd5eDelayedSummons: entries } : map
}

/** Only a Host turn event may drain this queue. Reloading a map never calls it. */
export function settleDnd5eDelayedSummonsAtTurnStart(input: {
  map: BattleMap; characters: readonly Character[]; combatId: string; round: number; turnKey: string; turnSequence: number; tokenId: string
  sourceLimitMaps?: readonly BattleMap[]
  initiativeOrder?: readonly TurnSlot[]
  slotId?: string
  worldMinute?: number
  apply: typeof applyDnd5eActivityMapHandoffsV1
  /** Checks concentration and other source lifecycle requirements at appearance. */
  sourceAvailable?: (entry: Dnd5eDelayedSummonEntry, map: BattleMap) => boolean
}): { map: BattleMap; results: Dnd5eActivityMapHandoffResultV1[] } {
  if (!input.combatId || !input.turnKey || !Number.isSafeInteger(input.round) || input.round < 1 || !Number.isSafeInteger(input.turnSequence) || input.turnSequence < 0) throw new Error('Invalid delayed summon boundary')
  let map = input.map
  const results: Dnd5eActivityMapHandoffResultV1[] = []
  for (const entry of input.map.dnd5eDelayedSummons ?? []) {
    if (entry.status !== 'pending') continue
    if (entry.dueWorldSecond == null && (entry.combatId !== input.combatId ||
      input.round < entry.queuedRound || input.turnSequence <= Number(entry.queuedAfterTurnSequence) || input.turnKey === entry.queuedAfterTurnKey)) continue
    let status: Dnd5eDelayedSummonEntry['status'] = 'cancelled'
    let reason: string | undefined = 'source-unavailable'
    const available = dnd5eDelayedSummonSourceAvailable(entry, map, input.characters) && (input.sourceAvailable?.(entry,map) ?? true)
    if (available) {
      if (entry.sourceTokenId !== input.tokenId) {
        const sourceInOrder=input.initiativeOrder?.some(slot=>slot.tokenId===entry.sourceTokenId)
        const departed=sourceInOrder===false || (sourceInOrder==null && !map.tokens.some(token=>token.id===entry.sourceTokenId))
        const anchor=entry.sourceTurn
        const index=anchor?.slotIds.indexOf(input.slotId??input.tokenId)??-1
        const reached=anchor && (input.round>anchor.round || (input.round===anchor.round && index>=anchor.index))
        if(!departed || !reached || !isIndependentCorpseSummon(entry.request.handoffs))continue
      }
      const result = input.apply({ ...structuredClone(entry.request), combatId:input.combatId, map, characters: input.characters,
        sourceLimitMaps: input.sourceLimitMaps, delayedSourceIdentity:entry.sourceIdentity,
        round: input.round, worldMinute: input.worldMinute,
        handoffs: { ...entry.request.handoffs, summons: entry.request.handoffs.summons.map(summon => ({ ...summon, timing: 'immediate' })) } })
      if (result.ok) {
        map = result.map
        results.push(entry.initiativeResults ? {...result,initiativeEntries:result.initiativeEntries.map((initiative,index)=>({...initiative,...entry.initiativeResults![index]}))} : result)
        status = 'completed'; reason = undefined
      }
      else { status = 'blocked'; reason = result.reason }
    }
    // Retain terminal receipts: replaying this event or re-admitting the same
    // committed action must never create another creature or reroll initiative.
    map = { ...map, dnd5eDelayedSummons: (map.dnd5eDelayedSummons ?? []).map(candidate => candidate.id === entry.id
      ? { ...candidate, status, reason, settledTurnKey: input.turnKey } : candidate) }
  }
  return { map, results }
}

/** Campaign-clock settlement for maps outside active combat. Active maps use source turn boundaries. */
export function settleDnd5eDelayedSummonsAtWorldSecond(input: {
  map: BattleMap; characters: readonly Character[]; worldSecond: number;
  sourceLimitMaps?: readonly BattleMap[]; apply: typeof applyDnd5eActivityMapHandoffsV1
}): { map: BattleMap; results: Dnd5eActivityMapHandoffResultV1[] } {
  if (!Number.isSafeInteger(input.worldSecond) || input.worldSecond < 0) throw new Error('Invalid delayed summon campaign time')
  let map=input.map
  let characters=input.characters
  const results:Dnd5eActivityMapHandoffResultV1[]=[]
  for(const entry of input.map.dnd5eDelayedSummons ?? []) {
    const due=entry.dueWorldSecond??entry.dueAfterCombatWorldSecond
    if(entry.status!=='pending' || due==null || input.worldSecond<due)continue
    let status:Dnd5eDelayedSummonEntry['status']='cancelled'
    let reason:string|undefined='source-unavailable'
    if(dnd5eDelayedSummonSourceAvailable(entry,map,characters)) {
      const result=input.apply({...entry.request,combatId:undefined,map,characters,delayedSourceIdentity:entry.sourceIdentity,round:entry.queuedRound,
        sourceLimitMaps:input.sourceLimitMaps,worldMinute:Math.floor(input.worldSecond/60),worldSecondRemainder:input.worldSecond%60,
        handoffs:{...entry.request.handoffs,summons:entry.request.handoffs.summons.map(summon=>({...summon,timing:'immediate'}))}})
      if(result.ok){map=result.map;characters=result.boundCharacters??characters;results.push(result);status='completed';reason=undefined}
      else{status='blocked';reason=result.reason}
    }
    map={...map,dnd5eDelayedSummons:(map.dnd5eDelayedSummons??[]).map(candidate=>candidate.id===entry.id?{...candidate,status,reason}:candidate)}
  }
  return {map,results}
}
