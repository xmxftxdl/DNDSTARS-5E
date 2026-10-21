import { dnd5eHasVoluntaryCompanionOrder } from './voluntaryCompanionOrder'
import { prepareDnd5eMapInteraction, type PreparedDnd5eMapInteraction } from './mapInteraction'
import { mapGeometryDoorPhysicalState } from '../../lib/mapGeometry'
import type { Dnd5eCombatant, Dnd5eHeadlessCombatState } from './headlessCombatEngine'

export type Dnd5eCompanionObjectInteraction = {
  mapId: string
  doorId: string
  operation: 'open' | 'close' | 'break'
} | { mapId: string; operation: 'pickup-item'; objectTokenId: string; expectedReceiptId: string; expectedQuantity: number }
  | { mapId: string; operation: 'interact-point'; sceneId: string; interactionPointId: string }

/** A bounded scene reference, never a caller-authored interaction result. */
export function normalizeDnd5eCompanionObjectInteraction(value: unknown): Dnd5eCompanionObjectInteraction | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (raw.operation === 'interact-point') {
    if (Object.keys(raw).some(key => !['mapId', 'operation', 'sceneId', 'interactionPointId'].includes(key)) ||
      !['mapId', 'sceneId', 'interactionPointId'].every(key => typeof raw[key] === 'string' && raw[key].length > 0 && raw[key].length <= 160)) return undefined
    return { mapId: raw.mapId as string, operation: 'interact-point', sceneId: raw.sceneId as string, interactionPointId: raw.interactionPointId as string }
  }
  if(raw.operation==='pickup-item') {
    if(Object.keys(raw).some(key=>!['mapId','operation','objectTokenId','expectedReceiptId','expectedQuantity'].includes(key)) ||
      typeof raw.mapId!=='string'||!raw.mapId||raw.mapId.length>160||typeof raw.objectTokenId!=='string'||!raw.objectTokenId||raw.objectTokenId.length>160||
      typeof raw.expectedReceiptId!=='string'||!raw.expectedReceiptId||raw.expectedReceiptId.length>300||
      !Number.isSafeInteger(raw.expectedQuantity)||Number(raw.expectedQuantity)<1||Number(raw.expectedQuantity)>1000)return undefined
    return {mapId:raw.mapId,operation:'pickup-item',objectTokenId:raw.objectTokenId,expectedReceiptId:raw.expectedReceiptId,expectedQuantity:Number(raw.expectedQuantity)}
  }
  if (Object.keys(raw).some(key => !['mapId', 'doorId', 'operation'].includes(key)) ||
    typeof raw.mapId !== 'string' || !raw.mapId || raw.mapId.length > 160 ||
    typeof raw.doorId !== 'string' || !raw.doorId || raw.doorId.length > 160 ||
    (raw.operation !== 'open' && raw.operation !== 'close' && raw.operation !== 'break')) return undefined
  return { mapId: raw.mapId, doorId: raw.doorId, operation: raw.operation }
}

export function dnd5eCompanionObjectExists(state: Dnd5eHeadlessCombatState, value: unknown): boolean {
  const selected = normalizeDnd5eCompanionObjectInteraction(value), scene = state.companionScene
  if (selected?.operation === 'interact-point') return scene?.map.id === selected.mapId &&
    scene.interactionScenes?.some(entry => entry.id === selected.sceneId && entry.mapId === selected.mapId &&
      entry.interactionPoints.some(point => point.id === selected.interactionPointId && point.enabled && point.visibleToPlayers)) === true
  if(selected?.operation==='pickup-item') {
    const token=scene?.map.tokens.find(token=>token.id===selected.objectTokenId),item=token?.dnd5eObjectState?.inventoryItem
    return scene?.map.id===selected.mapId && token?.type==='obstacle' && item?.receiptId===selected.expectedReceiptId && item?.quantity===selected.expectedQuantity
  }
  return !!selected && scene?.map.id === selected.mapId && scene.geometry?.doors.some(door => door.id === selected.doorId) === true
}

export function isDnd5eCompanionObjectSelections(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).length <= 100 && Object.entries(value).every(([key, selected]) =>
      !!key && key.length <= 160 && normalizeDnd5eCompanionObjectInteraction(selected) != null)
}

export function prepareDnd5eCompanionObjectInteraction(state: Dnd5eHeadlessCombatState, actor: Dnd5eCombatant,
  selected = actor.classState.companionCommand?.objectInteraction): (PreparedDnd5eMapInteraction & { alreadySatisfied: boolean }) | undefined {
  const scene = state.companionScene
  if (!selected || selected.operation==='pickup-item' || !dnd5eCompanionObjectExists(state, selected) || !scene) return undefined
  const token = scene.map.tokens.find(candidate => candidate.id === actor.id)
  if (!token || (token.dnd5eSummon?.controlEnded && !dnd5eHasVoluntaryCompanionOrder(token)) || actor.summonedUncontrolledSubtype) return undefined
  if (selected.operation === 'interact-point') {
    const result = prepareDnd5eMapInteraction({ map: scene.map, geometry: scene.geometry ?? undefined,
      actor: { ...token, ...actor.position, elevationFeet: actor.elevationFeet },
      payload: { operation: 'interact-point', interactionPointId: selected.interactionPointId },
      interactionPoints: scene.interactionScenes?.find(entry => entry.id === selected.sceneId)?.interactionPoints })
    return result.ok ? { ...result.prepared, alreadySatisfied: false } : undefined
  }
  const prepared = prepareDnd5eMapInteraction({ map: scene.map, geometry: scene.geometry ?? undefined,
    actor: { ...token, ...actor.position, elevationFeet: actor.elevationFeet },
    payload: { doorId: selected.doorId, operation: selected.operation, method: selected.operation === 'break' ? 'force' : 'interact' },
    combatId: state.combatId, round: state.round, worldMinute: scene.worldMinute })
  if (prepared.ok && prepared.prepared.nextDoorState) return { ...prepared.prepared, alreadySatisfied: false }
  // The ordinary interaction checks reach before returning these reasons.
  // A second recipient can observe success without paying for another action.
  const door = scene.geometry?.doors.find(door => door.id === selected.doorId)
  if (!prepared.ok && door && (prepared.reason === 'door-already-open' ||
    prepared.reason === 'door-not-open' && mapGeometryDoorPhysicalState(door) !== 'destroyed')) {
    return { door, interactionId: `${selected.operation}:${door.id}`, nextDoorState: selected.operation !== 'close' ? 'open' : 'closed',
      label: door.label, blindSearch: false, operation: selected.operation, method: 'interact',
      automaticSuccess: true, spendAction: false, turnCost: 'object-interaction',
      alreadySatisfied: true }
  }
  return undefined
}

export function dnd5eCompanionObjectInteractionId(selection: Dnd5eCompanionObjectInteraction): string {
  if (selection.operation === 'interact-point') return `scene-point:${selection.interactionPointId}`
  return selection.operation==='pickup-item'?`pickup-item:${selection.objectTokenId}`:`${selection.operation}:${selection.doorId}`
}
