import type { Character } from '../../types/character'

export interface Dnd5eRestActivityWindow {
  schemaVersion: 1
  characterId: string
  eventId: string
  event: 'short-rest-complete' | 'long-rest-complete'
  completedWorldMinute: number
  receipts: Record<string, 'used' | 'declined'>
}

const validMinute = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const identity = /^[a-z0-9][a-z0-9._:-]{0,255}$/
export const dnd5eRestActivityReceiptKey = (packageId: string, activityId: string) => JSON.stringify([packageId, activityId])

/** Reject a corrupt ledger as a whole; dropping individual receipts would allow replay. */
export function normalizeDnd5eRestActivityWindow(value: unknown, characterId: string): Dnd5eRestActivityWindow | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Partial<Dnd5eRestActivityWindow>
  if (raw.schemaVersion !== 1 || raw.characterId !== characterId || !validMinute(raw.completedWorldMinute) ||
    !['short-rest-complete','long-rest-complete'].includes(raw.event ?? '') ||
    raw.eventId !== `rest:${raw.event}:${raw.completedWorldMinute}` ||
    !raw.receipts || typeof raw.receipts !== 'object' || Array.isArray(raw.receipts)) return undefined
  const receipts = Object.entries(raw.receipts)
  if (receipts.length > 1024 || receipts.some(([key,status]) => {
    if (status !== 'used' && status !== 'declined') return true
    try { const ids:unknown=JSON.parse(key); return !Array.isArray(ids) || ids.length!==2 || ids.some(id=>typeof id!=='string'||!identity.test(id)) } catch { return true }
  })) return undefined
  return {schemaVersion:1,characterId,eventId:raw.eventId!,event:raw.event!,completedWorldMinute:raw.completedWorldMinute,receipts:Object.fromEntries(receipts)}
}

/** Called only after successful rest benefits, never from a client intent or historical baseline. */
export function recordDnd5eRestActivityWindow(character: Character, event: Dnd5eRestActivityWindow['event'], completedWorldMinute: number): Character {
  if (!validMinute(completedWorldMinute)) return character
  const current = normalizeDnd5eRestActivityWindow(character.dnd5eRestActivityWindow, character.id)
  if (character.dnd5eRestActivityWindow != null && !current) return character
  if (current && current.completedWorldMinute >= completedWorldMinute) return character
  return {...character,dnd5eRestActivityWindow:{schemaVersion:1,characterId:character.id,eventId:`rest:${event}:${completedWorldMinute}`,event,completedWorldMinute,receipts:{}}}
}

export function openDnd5eRestActivityWindow(character: Character, worldMinute: number): Dnd5eRestActivityWindow | undefined {
  const window = normalizeDnd5eRestActivityWindow(character.dnd5eRestActivityWindow, character.id)
  if (!window || !validMinute(worldMinute) || worldMinute !== window.completedWorldMinute) return undefined
  if (window.event === 'long-rest-complete' && character.dnd5eLastLongRestWorldMinute !== window.completedWorldMinute) return undefined
  return window
}

/** Caller commits this receipt with the effect/resource changes in the same character transaction. */
export function consumeDnd5eRestActivityWindow(character: Character, input: {worldMinute:number;eventId:string;packageId:string;activityId:string;outcome:'used'|'declined'}): Character | undefined {
  if (!identity.test(input.packageId) || !identity.test(input.activityId) || !['used','declined'].includes(input.outcome)) return undefined
  const window = openDnd5eRestActivityWindow(character,input.worldMinute)
  const key = dnd5eRestActivityReceiptKey(input.packageId,input.activityId)
  if (!window || window.eventId !== input.eventId || window.receipts[key] || Object.keys(window.receipts).length >= 1024) return undefined
  return {...character,dnd5eRestActivityWindow:{...window,receipts:{...window.receipts,[key]:input.outcome}}}
}
