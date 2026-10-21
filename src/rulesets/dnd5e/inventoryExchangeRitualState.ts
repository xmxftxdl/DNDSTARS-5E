import type { Character } from '../../types/character'
import { dnd5eConditionIncapacitated } from './conditions'
import { validDnd5eInventoryExchangeSelection, type Dnd5eInventoryExchangeSelection } from './inventoryExchangeSelection'
export interface Dnd5eInventoryExchangeRitual {
  schemaVersion: 1
  commandId: string
  packageId: string
  packageVersion: string
  activityId: string
  definition: string
  selection: string
  startedWorldMinute: number
  completesWorldMinute: number
  inventoryRevision: number
}

/** Restore selection for UI continuation; settlement still revalidates the saved identity. */
export function dnd5eInventoryExchangeSavedSelection(record: Dnd5eInventoryExchangeRitual): Dnd5eInventoryExchangeSelection | undefined {
  try {
    const raw: unknown = JSON.parse(record.selection)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return
    const value = raw as Record<string, unknown>
    if (Object.keys(value).some(key => !['revision', 'inputs', 'coins', 'original', 'outputTemplateId'].includes(key))) return
    const selection = { expectedInventoryRevision: value.revision, inputs: value.inputs, coins: value.coins,
      ...(value.original == null ? {} : { originalInstanceId: value.original }),
      ...(value.outputTemplateId == null ? {} : {outputTemplateId:value.outputTemplateId}) }
    return validDnd5eInventoryExchangeSelection(selection) && selection.expectedInventoryRevision === record.inventoryRevision ? selection : undefined
  } catch { return undefined }
}
export function normalizeDnd5eInventoryExchangeRitual(value: unknown): Dnd5eInventoryExchangeRitual | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const v = value as Record<string, unknown>
  if (v.schemaVersion !== 1 || !['commandId','packageId','packageVersion','activityId'].every(key => typeof v[key] === 'string' && (v[key] as string).length > 0 && (v[key] as string).length <= 160) ||
    typeof v.definition !== 'string' || !v.definition || v.definition.length > 200000 ||
    typeof v.selection !== 'string' || !v.selection || v.selection.length > 30000 ||
    !['startedWorldMinute','completesWorldMinute','inventoryRevision'].every(key => Number.isSafeInteger(v[key]) && Number(v[key]) >= 0) ||
    Number(v.completesWorldMinute) <= Number(v.startedWorldMinute)) return undefined
  return { schemaVersion: 1, commandId: v.commandId as string, packageId: v.packageId as string, packageVersion: v.packageVersion as string,
    activityId: v.activityId as string, definition: v.definition, selection: v.selection, startedWorldMinute: Number(v.startedWorldMinute),
    completesWorldMinute: Number(v.completesWorldMinute), inventoryRevision: Number(v.inventoryRevision) }
}

/** Called on an observed authoritative interruption; later recovery cannot revive this record. */
export function interruptDnd5eInventoryExchangeRitual(character: Character): Character {
  const inventory = character.dnd5eInventory
  if (!inventory?.pendingExchangeRitual) return character
  const revision = (inventory.revision ?? 0) + 1
  return { ...character, dnd5eInventory: { ...inventory, pendingExchangeRitual: undefined,
    revision: Number.isSafeInteger(revision) ? revision : inventory.revision } }
}
export function dnd5eInventoryExchangeRitualActorUnavailable(character: Pick<Character, 'conditions' | 'currentHp'>): boolean {
  return character.currentHp <= 0 || dnd5eConditionIncapacitated(character)
}
export function reconcileDnd5eInventoryExchangeRitualActor(character: Character): Character {
  return dnd5eInventoryExchangeRitualActorUnavailable(character) ? interruptDnd5eInventoryExchangeRitual(character) : character
}
