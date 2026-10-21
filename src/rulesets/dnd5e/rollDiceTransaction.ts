import {dnd5eRollDiceRecipes, resolveDnd5eRollDiceModifiers, type Dnd5eRollDiceKind, type Dnd5eRollDiceRecipe} from './rollDiceModifiers'

type Effects = Parameters<typeof dnd5eRollDiceRecipes>[0]['effects']
export interface Dnd5eRollDiceAudit {
  recipe: Dnd5eRollDiceRecipe
  actorId: string
  kind: Dnd5eRollDiceKind
  values: readonly number[]
  amount: number
}
interface Scope {
  eventId: string
  rolls?: Readonly<Record<string, readonly number[]>>
  counts: Map<string, number>
  consumed: Set<string>
  onAudit?: (entry: Dnd5eRollDiceAudit) => void
}
// Headless resolution is synchronous. Nested actions share the outer roll ledger.
let scope: Scope | undefined
export interface Dnd5eRollDiceOccurrenceCount {
  actorId: string
  kind: Dnd5eRollDiceKind
  checkSlot?: string
  count: number
}
let occurrenceListener: ((counts: Dnd5eRollDiceOccurrenceCount[]) => void) | undefined

/** Read the successful root ledger, including checks that had no effect dice. */
export function captureDnd5eRollDiceOccurrences<T>(resolve: () => T) {
  const previous=occurrenceListener
  let occurrences:Dnd5eRollDiceOccurrenceCount[]=[]
  occurrenceListener=counts=>{occurrences=counts}
  try {return {result:resolve(),occurrences}} finally {occurrenceListener=previous}
}
let missingDiceListener: ((recipes: readonly Dnd5eRollDiceRecipe[]) => void) | undefined

/** Observe only missing dice from a synchronous speculative resolution; never substitute results. */
export function captureDnd5eMissingEffectDice<T>(resolve: () => T): {result: T; requests: readonly Dnd5eRollDiceRecipe[]} {
  const previous = missingDiceListener
  const requests = new Map<string,Dnd5eRollDiceRecipe>()
  missingDiceListener = recipes => recipes.forEach(recipe => requests.set(recipe.id, structuredClone(recipe)))
  try { return {result:resolve(),requests:[...requests.values()]} } finally { missingDiceListener = previous }
}

export function dnd5eRollDiceOccurrenceId(transactionId: string, actorId: string, kind: Dnd5eRollDiceKind, occurrence: number, checkSlot?: string): string {
  return JSON.stringify([transactionId, actorId, kind, occurrence, ...(checkSlot == null ? [] : [checkSlot])])
}

export const dnd5eRollDiceCheckSlot = (activityId: string, checkKey: string, subject: 'source' | 'target'): string =>
  JSON.stringify([activityId, checkKey, subject])

export type Dnd5eRollDicePreviewContext = Pick<Scope, 'eventId' | 'rolls'>

/** A preview can inspect the pending dice but cannot consume occurrences or append audit entries. */
export function withDnd5eRollDicePreview<T>(resolve: () => T, input?: Dnd5eRollDicePreviewContext): T {
  const previous = scope
  const current = previous ?? (input ? {...input, counts:new Map<string,number>(),consumed:new Set<string>()} : undefined)
  scope = current ? {...current, counts:new Map(current.counts),consumed:new Set(current.consumed),onAudit:undefined} : undefined
  try { return resolve() } finally { scope = previous }
}

export function withDnd5eRollDiceTransaction<T extends {ok: boolean}>(input: {
  eventId: string
  rolls?: Readonly<Record<string, readonly number[]>>
  onAudit?: (entry: Dnd5eRollDiceAudit) => void
}, resolve: () => T): T {
  if (scope) return resolve()
  if (input.rolls != null && (typeof input.rolls !== 'object' || Array.isArray(input.rolls))) throw new RangeError('roll-dice-unexpected')
  const current: Scope = {...input, counts: new Map(), consumed: new Set()}
  scope = current
  try {
    const result = resolve()
    if (result.ok && Object.keys(current.rolls ?? {}).some(id => !current.consumed.has(id))) throw new RangeError('roll-dice-unexpected')
    if(result.ok) occurrenceListener?.([...current.counts].map(([key,count])=>{
      const [actorId,kind,checkSlot]=JSON.parse(key)
      return {actorId,kind,...(checkSlot==null?{}:{checkSlot}),count}
    }))
    return result
  } finally { scope = undefined }
}

/** Explicit reaction dice are isolated, but their audit remains part of the parent commit. */
export function withDnd5eChildRollDiceTransaction<T extends {ok: boolean}>(
  input: Dnd5eRollDicePreviewContext, resolve: () => T,
): T {
  if (typeof input.eventId !== 'string' || !input.eventId || input.eventId.length > 512) throw new RangeError('roll-dice-context-invalid')
  const parent = scope, listener = occurrenceListener
  scope = undefined
  occurrenceListener = undefined
  try { return withDnd5eRollDiceTransaction({...input, onAudit: parent?.onAudit}, resolve) }
  finally { scope = parent; occurrenceListener = listener }
}

export function consumeDnd5eRollDiceModifier(actorId: string, effects: Effects, kind: Dnd5eRollDiceKind, checkSlot?: string): number {
  const current = scope
  const key = JSON.stringify([actorId, kind, ...(checkSlot == null ? [] : [checkSlot])])
  const occurrence = current?.counts.get(key) ?? 0
  current?.counts.set(key, occurrence + 1)
  const input = {actorId, effects, kind,
    eventId: dnd5eRollDiceOccurrenceId(current?.eventId ?? 'unscoped', actorId, kind, occurrence, checkSlot)}
  const recipes = dnd5eRollDiceRecipes(input)
  if (!recipes.length) return 0
  if (!current) throw new RangeError('roll-dice-transaction-required')
  const selected: Record<string, readonly number[]> = {}
  for (const recipe of recipes) if (current.rolls && Object.hasOwn(current.rolls, recipe.id)) selected[recipe.id] = current.rolls[recipe.id]
  const missing = recipes.filter(recipe => !Object.hasOwn(selected, recipe.id))
  if (missing.length) missingDiceListener?.(missing)
  const result = resolveDnd5eRollDiceModifiers(input, selected)
  result.audit.forEach((entry, index) => {
    current.consumed.add(entry.id)
    current.onAudit?.({recipe: recipes[index], actorId, kind, values: entry.values, amount: entry.amount})
  })
  return result.modifier
}
