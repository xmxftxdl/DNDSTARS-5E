import type { BattleMap } from '../../../store/maps'

export interface Dnd5eActivityTurnClock {
  schemaVersion: 1
  combatId: string
  turnKey: string
  sequence: number
  previousTurnKey?: string
  cursor?: { tokenId: string; slotId: string; round: number; initiativeIndex: number }
}

export function normalizeDnd5eActivityTurnClock(value: unknown): Dnd5eActivityTurnClock | undefined {
  const clock=value as Dnd5eActivityTurnClock | undefined
  if (!clock || clock.schemaVersion!==1 || typeof clock.combatId!=='string' || !clock.combatId ||
    typeof clock.turnKey!=='string' || !clock.turnKey || !Number.isSafeInteger(clock.sequence) || clock.sequence<0 ||
    (clock.previousTurnKey!=null && (typeof clock.previousTurnKey!=='string'||!clock.previousTurnKey))) return undefined
  const cursor=clock.cursor
  const validCursor=cursor && typeof cursor.tokenId==='string' && !!cursor.tokenId &&
    typeof cursor.slotId==='string' && !!cursor.slotId && Number.isSafeInteger(cursor.round) && cursor.round>=0 &&
    Number.isSafeInteger(cursor.initiativeIndex) && cursor.initiativeIndex>=0 &&
    `${cursor.round}:${cursor.slotId}`===clock.turnKey
  return {schemaVersion:1,combatId:clock.combatId,turnKey:clock.turnKey,sequence:clock.sequence,previousTurnKey:clock.previousTurnKey,
    ...(validCursor ? {cursor:{tokenId:cursor.tokenId,slotId:cursor.slotId,round:cursor.round,initiativeIndex:cursor.initiativeIndex}} : {})}
}

/** Explicit Host combat initialization; refreshing an existing combat is a no-op. */
export function initializeDnd5eActivityTurnClock(map: BattleMap, combatId: string, turnKey: string): BattleMap {
  if (!combatId || !turnKey) throw new Error('Invalid activity turn clock')
  if (map.dnd5eActivityTurnClock?.combatId===combatId) return map
  return {...map,dnd5eActivityTurnClock:{schemaVersion:1,combatId,turnKey,sequence:0},
    dnd5eDelayedSummons:map.dnd5eDelayedSummons?.map(entry=>entry.status==='pending' && entry.combatId!=null && entry.combatId!==combatId
      ? entry.dueAfterCombatWorldSecond!=null
        ? {...entry,combatId:undefined,dueWorldSecond:entry.dueAfterCombatWorldSecond,dueAfterCombatWorldSecond:undefined,
          queuedAfterTurnKey:undefined,queuedAfterTurnSequence:undefined,sourceTurn:undefined,request:{...entry.request,combatId:undefined}}
        : {...entry,status:'cancelled',reason:'combat-replaced'} : entry)}
}

/** Compare the exact prior cursor and sequence; never infer order from wall time. */
export function advanceDnd5eActivityTurnClock(input: {
  map: BattleMap; combatId: string; fromTurnKey: string; toTurnKey: string; expectedSequence: number
}): {ok:true;map:BattleMap;clock:Dnd5eActivityTurnClock;advanced:boolean} | {ok:false;reason:'stale-activity-turn-transition'} {
  const clock=input.map.dnd5eActivityTurnClock
  const fail={ok:false as const,reason:'stale-activity-turn-transition' as const}
  if (!clock || clock.combatId!==input.combatId || !input.fromTurnKey || !input.toTurnKey ||
    !Number.isSafeInteger(input.expectedSequence) || input.expectedSequence<0 || input.expectedSequence>=Number.MAX_SAFE_INTEGER) return fail
  if (clock.turnKey===input.toTurnKey && clock.previousTurnKey===input.fromTurnKey && clock.sequence===input.expectedSequence+1) {
    return {ok:true,map:input.map,clock,advanced:false}
  }
  if (clock.sequence!==input.expectedSequence || clock.turnKey!==input.fromTurnKey || input.fromTurnKey===input.toTurnKey) return fail
  const next:Dnd5eActivityTurnClock={schemaVersion:1,combatId:input.combatId,sequence:clock.sequence+1,turnKey:input.toTurnKey,previousTurnKey:input.fromTurnKey}
  return {ok:true,map:{...input.map,dnd5eActivityTurnClock:next},clock:next,advanced:true}
}
