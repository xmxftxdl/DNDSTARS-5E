import type { BattleMap, Token } from '../../store/maps'
import type { MapGeometryState } from '../../lib/mapGeometry'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'
import { planDnd5eMapObjectFlight, type Dnd5eMapObjectFlightLimits } from './mapObjectFlight'

/** Host-owned continuation. Admission/consumption must share the cast's atomic commit. */
export interface Dnd5eObjectFlightDeparture {
  schemaVersion: 1
  id: string
  sourceMapId: string
  actionId: string
  operationId: string
  actorId: string
  packageId: string
  activityId: string
  object: Token
  departure: { x: number; y: number; elevationFeet: number }
  angleDegrees: number
  pitchDegrees: number
  remainingFeet: number
  limits: Dnd5eMapObjectFlightLimits
  slotLevel: number
  saveDc: number
  saveAbility: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
  damage: number
  damageType: string
  successfulTargetIds: string[]
  status: 'pending' | 'completed'
  settlementId?: string
}

const idValid = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 500
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const damageTypes = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder']

export function normalizeDnd5eObjectFlightDepartures(value: unknown): Dnd5eObjectFlightDeparture[] | undefined {
  if (!Array.isArray(value) || !value.length || value.length > 4096) return undefined
  const entries = value.map(normalizeDnd5eObjectFlightDeparture)
  if (entries.some(entry => !entry) || new Set(entries.map(entry => entry!.id)).size !== entries.length) return undefined
  return entries as Dnd5eObjectFlightDeparture[]
}

/** Fail closed rather than quietly dropping an unresolved object's receipt. */
export function normalizeDnd5eObjectFlightDeparture(value: unknown): Dnd5eObjectFlightDeparture | undefined {
  try {
    const entry = value as Dnd5eObjectFlightDeparture
    if (!entry || entry.schemaVersion !== 1 ||
      ![entry.id, entry.sourceMapId, entry.actionId, entry.operationId, entry.actorId, entry.packageId, entry.activityId].every(idValid) ||
      !entry.object || !idValid(entry.object.id) || entry.object.type !== 'obstacle' || entry.object.obstacleKind === 'marker' ||
      ![entry.object.x, entry.object.y, entry.object.size, entry.departure.x, entry.departure.y, entry.departure.elevationFeet,
        entry.angleDegrees, entry.pitchDegrees, entry.remainingFeet, entry.damage,
        entry.limits.minimumWeightPounds, entry.limits.maximumWeightPounds, entry.limits.additionalWeightPoundsPerSlot, entry.limits.distanceFeet].every(finite) ||
      entry.object.size <= 0 || !finite(entry.object.hp ?? entry.object.maxHp) || (entry.object.hp ?? entry.object.maxHp ?? 0) <= 0 ||
      !normalizeDnd5eMapObjectStateV1(entry.object.dnd5eObjectState) ||
      entry.angleDegrees < 0 || entry.angleDegrees >= 360 || Math.abs(entry.pitchDegrees) > 90 ||
      entry.remainingFeet <= 0 || entry.remainingFeet > entry.limits.distanceFeet || entry.damage < 0 ||
      !Number.isInteger(entry.slotLevel) || entry.slotLevel < entry.limits.baseSlotLevel || entry.slotLevel > 9 ||
      !Number.isInteger(entry.limits.baseSlotLevel) || entry.limits.baseSlotLevel < 0 || entry.limits.baseSlotLevel > 9 ||
      entry.limits.minimumWeightPounds < 0 || entry.limits.maximumWeightPounds < entry.limits.minimumWeightPounds || entry.limits.additionalWeightPoundsPerSlot < 0 ||
      !Number.isInteger(entry.saveDc) || entry.saveDc < 1 || entry.saveDc > 40 ||
      !['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(entry.saveAbility) || !damageTypes.includes(entry.damageType) ||
      !Array.isArray(entry.successfulTargetIds) || entry.successfulTargetIds.length > 4096 ||
      !entry.successfulTargetIds.every(idValid) || new Set(entry.successfulTargetIds).size !== entry.successfulTargetIds.length ||
      !['pending', 'completed'].includes(entry.status) ||
      (entry.status === 'pending' ? entry.settlementId != null : !idValid(entry.settlementId))) return undefined
    const state = normalizeDnd5eMapObjectStateV1(entry.object.dnd5eObjectState)!
    const maxWeight = entry.limits.maximumWeightPounds + (entry.slotLevel - entry.limits.baseSlotLevel) * entry.limits.additionalWeightPoundsPerSlot
    if (state.weightPounds == null || state.wornOrCarried || state.weightPounds < entry.limits.minimumWeightPounds || state.weightPounds > maxWeight) return undefined
    return structuredClone(entry)
  } catch { return undefined }
}

export function captureDnd5eObjectFlightDeparture(input: {
  map: BattleMap; geometry?: MapGeometryState; objectId: string; limits: Dnd5eMapObjectFlightLimits
  slotLevel: number; angleDegrees: number; pitchDegrees?: number
  actionId: string; operationId: string; actorId: string; packageId: string; activityId: string
  saveDc: number; saveAbility: Dnd5eObjectFlightDeparture['saveAbility']; damage: number; damageType: string
  successfulTargetIds: string[]
}): Dnd5eObjectFlightDeparture | undefined {
  const flight = planDnd5eMapObjectFlight(input)
  if (!flight.ok || flight.plan.stop?.kind !== 'map-boundary') return undefined
  // Only the all-success path can leave this scene. A missing or additional save
  // cannot be converted into a departure to avoid an unresolved local target.
  const targetIds = flight.plan.creatures.map(target => target.tokenId)
  if (targetIds.length !== input.successfulTargetIds.length || targetIds.some((id, i) => id !== input.successfulTargetIds[i])) return undefined
  return normalizeDnd5eObjectFlightDeparture({
    schemaVersion: 1, id: `object-flight:${input.actionId}:${input.operationId}`,
    sourceMapId: input.map.id, actionId: input.actionId, operationId: input.operationId, actorId: input.actorId, packageId: input.packageId, activityId: input.activityId,
    object: input.map.tokens.find(token => token.id === input.objectId),
    departure: { ...flight.plan.to, elevationFeet: flight.plan.destinationElevationFeet },
    angleDegrees: input.angleDegrees, pitchDegrees: input.pitchDegrees ?? 0,
    remainingFeet: input.limits.distanceFeet * (1 - flight.plan.stop.t), limits: input.limits, slotLevel: input.slotLevel,
    saveDc: input.saveDc, saveAbility: input.saveAbility, damage: input.damage, damageType: input.damageType,
    successfulTargetIds: input.successfulTargetIds, status: 'pending',
  })
}

/** DM supplies the corresponding scene entry point; no resource or damage reroll. */
export function planDnd5eObjectFlightArrival(input: {
  entry: Dnd5eObjectFlightDeparture; map: BattleMap; geometry?: MapGeometryState
  point: { x: number; y: number; elevationFeet: number }
}) {
  const entry = normalizeDnd5eObjectFlightDeparture(input.entry), { map, point } = input
  if (!entry || entry.status !== 'pending' || ![point.x, point.y, point.elevationFeet].every(finite) ||
    point.x < 0 || point.y < 0 || point.x > map.width || point.y > map.height ||
    map.tokens.some(token => token.id === entry.object.id)) return undefined
  const object = { ...structuredClone(entry.object), ...point }
  const resumedMap = { ...map, tokens: [...map.tokens, object] }
  const flight = planDnd5eMapObjectFlight({ map: resumedMap, geometry: input.geometry,
    objectId: object.id, limits: { ...entry.limits, distanceFeet: entry.remainingFeet },
    slotLevel: entry.slotLevel, angleDegrees: entry.angleDegrees, pitchDegrees: entry.pitchDegrees })
  if (!flight.ok) return undefined
  return { map: resumedMap, localContactIds: flight.plan.creatures.map(contact => contact.tokenId),
    plan: { ...flight.plan, creatures: flight.plan.creatures.filter(contact => !entry.successfulTargetIds.includes(contact.tokenId)) },
    damage: entry.damage, damageType: entry.damageType, saveDc: entry.saveDc, saveAbility: entry.saveAbility }
}

export function completeDnd5eObjectFlightDeparture(entry: Dnd5eObjectFlightDeparture, settlementId: string) {
  const normalized = normalizeDnd5eObjectFlightDeparture(entry)
  if (!normalized || !idValid(settlementId) || (normalized.status === 'completed' && normalized.settlementId !== settlementId)) return undefined
  return { ...normalized, status: 'completed' as const, settlementId }
}
