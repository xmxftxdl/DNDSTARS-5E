import { applyDnd5eActivityMapHandoffsV1 } from './dnd5eActivityMapInteraction'
import { enqueueDnd5eDelayedSummon, type Dnd5eDelayedSummonRequest } from './dnd5eDelayedSummonQueue'

type TurnSlot = {tokenId:string;slotId?:string}

type Request = Parameters<typeof applyDnd5eActivityMapHandoffsV1>[0]

/** Use only the persisted Host boundary, never infer one from UI round values. */
export function dnd5eActivityDelayedBoundary(map: Request['map'], receiptId: string, initiativeOrder?:readonly TurnSlot[]) {
  const clock = map.dnd5eActivityTurnClock
  return clock ? { combatId: clock.combatId, turnKey: clock.turnKey, turnSequence: clock.sequence, receiptId, initiativeOrder } : undefined
}
type Summon = Request['handoffs']['summons'][number]

/** Split original occurrence-indexed selections without rerolling group initiative. */
function selectSummons(input: Request, delayed: boolean) {
  const summons: Summon[] = []
  const cells: NonNullable<Request['selection']['summonCells']>[number][] = []
  const dice: number[] = []
  const indexes: number[] = []
  let originalIndex = 0
  for (const summon of input.handoffs.summons) {
    const include = (summon.timing !== 'immediate') === delayed
    if (include) summons.push(summon)
    for (let occurrence = 0; occurrence < summon.count; occurrence++, originalIndex++) {
      if (!include) continue
      indexes.push(originalIndex)
      // Corpse summons derive their cell from the corpse at appearance, but
      // still occupy an index in the original selection/initiative arrays.
      cells.push(input.selection.summonCells?.[originalIndex] ?? { col: 0, row: 0 })
      dice.push(input.selection.summonInitiativeD20s?.[summon.groupInitiative ? 0 : originalIndex] as number)
    }
  }
  // Each grouped proposal originally refers to dice[0]. Freeze that choice
  // into every occurrence, then prevent regrouping against the split list.
  return { indexes, summons: summons.map(summon => ({ ...summon, groupInitiative: undefined })),
    selection: { ...input.selection, summonCells: cells, summonInitiativeD20s: dice } }
}

/** One map result contains immediate changes and durable future work together. */
export function applyDnd5eActivityDeferredMapHandoffs(input: Request & {
  delayedBoundary?: { combatId: string; turnKey: string; turnSequence: number; receiptId: string; initiativeOrder?:readonly TurnSlot[] }
}): ReturnType<typeof applyDnd5eActivityMapHandoffsV1> | {
  ok: false; reason: 'invalid-delayed-summon-context' | 'delayed-summon-already-scheduled'
} {
  if (!input.handoffs.summons.some(summon => summon.timing !== 'immediate')) return applyDnd5eActivityMapHandoffsV1(input)
  const delays = input.handoffs.summons.filter(summon=>summon.timing!=='immediate').map(summon=>summon.explorationDelaySeconds)
  const delay=delays[0]
  const exploration = !input.combatId && Number.isSafeInteger(delay) && Number(delay)>0 && delays.every(value=>value===delay) &&
    Number.isSafeInteger(input.worldMinute) && Number(input.worldMinute)>=0 &&
    Number.isSafeInteger(input.worldSecondRemainder ?? 0) && (input.worldSecondRemainder ?? 0)>=0 && (input.worldSecondRemainder ?? 0)<60
  const boundary: {combatId?:string;turnKey?:string;turnSequence?:number;receiptId:string;dueWorldSecond?:number;initiativeOrder?:readonly TurnSlot[]} | undefined = exploration
    ? {receiptId:input.actionId,dueWorldSecond:Number(input.worldMinute)*60+(input.worldSecondRemainder??0)+Number(delay)}
    : input.delayedBoundary
  const clock = input.map.dnd5eActivityTurnClock
  if (!boundary || (!exploration && (boundary.combatId !== input.combatId || !boundary.receiptId || !boundary.turnKey ||
    !clock || clock.combatId !== boundary.combatId || clock.turnKey !== boundary.turnKey || clock.sequence !== boundary.turnSequence ||
    !Number.isSafeInteger(boundary.turnSequence) || Number(boundary.turnSequence) < 0)) ||
    input.handoffs.summons.some(summon => !['immediate','source-next-turn-start'].includes(summon.timing))) {
    return { ok: false, reason: 'invalid-delayed-summon-context' }
  }
  if (input.map.dnd5eDelayedSummons?.some(entry => entry.id === boundary.receiptId)) return { ok:false, reason:'delayed-summon-already-scheduled' }
  // Validate the entire batch with the original indexes before returning any
  // immediate mutation. Delayed tokens in this preview are never committed.
  const preview = applyDnd5eActivityMapHandoffsV1({ ...input,
    handoffs: { ...input.handoffs, summons: input.handoffs.summons.map(summon => ({ ...summon, timing: 'immediate' })) } })
  if (!preview.ok) return preview
  const immediate = selectSummons(input, false)
  const later = selectSummons(input, true)
  const applied = applyDnd5eActivityMapHandoffsV1({ ...input, selection: immediate.selection,
    handoffs: { ...input.handoffs, summons: immediate.summons } })
  if (!applied.ok) return applied
  const { map: _map, characters: _characters, sourceLimitMaps: _sourceLimitMaps, flameGeometries: _flameGeometries,
    round, worldMinute: _worldMinute, delayedBoundary: _boundary, ...stored } = input
  const request: Dnd5eDelayedSummonRequest = { ...stored, actionId: `${input.actionId}:delayed`, selection: later.selection,
    handoffs: { persistentAreas: [], movements: [], invocations: [], summons: later.summons } }
  try {
    const frozenInitiative = (index:number) => {
      const {roll,initiativeCalculation}=preview.initiativeEntries[index]
      return structuredClone({roll,initiativeCalculation})
    }
    const map = enqueueDnd5eDelayedSummon({ map: applied.map, request, round, ...boundary,
      worldSecond:input.worldMinute==null?undefined:input.worldMinute*60+(input.worldSecondRemainder??0),
      initiativeResults:later.indexes.map(frozenInitiative) })
    return { ...applied, map, initiativeEntries:applied.initiativeEntries.map((entry,index)=>({...entry,...frozenInitiative(immediate.indexes[index])})) }
  } catch { return { ok:false, reason:'invalid-delayed-summon-context' } }
}
