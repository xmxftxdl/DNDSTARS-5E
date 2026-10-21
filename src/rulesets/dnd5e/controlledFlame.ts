import { controlledFlameAppearance } from '../../../shared/controlled-flame-state.mjs'
/** Explicit Host scene facts. A light's color or name is never proof of real fire. */
export interface Dnd5ePhysicalFlame {
  id: string
  magical: boolean
  burning: boolean
  extentFeet: number
  brightRadiusFeet: number
  dimRadiusFeet: number
  color: string
  alterations: Dnd5eFlameAlteration[]
  /** World feet, supplied by the scene adapter; required for expansion. */
  positionFeet?: { x: number; y: number; z: number }
  /** Explicit scene fuel fact. Absence never means available fuel. */
  fuelAvailable?: boolean
  /** Explicit Host fact; absence must not authorize unattended-object ignition. */
  custody?: 'unattended' | 'carried' | 'worn'
}

export interface Dnd5eFlameAlteration {
  id: string
  casterId: string
  appliedAtWorldMinute: number
  expiresAtWorldMinute: number
  kind: 'illumination' | 'shape'
  multiplier?: 0.5 | 1 | 2
  color?: string
  shape?: string
}

export type Dnd5eFlameChange =
  | { kind: 'ignite-touch' }
  | { kind: 'inspect' }
  | { kind: 'extinguish' }
  | { kind: 'spread'; destinationId: string }
  | { kind: 'illumination'; multiplier: 0.5 | 1 | 2; color?: string }
  | { kind: 'shape'; description: string }

/** Importable intent; scene selections are supplied separately and rechecked by Host. */
export type Dnd5eFlameIntent = (Exclude<Dnd5eFlameChange, { kind: 'spread' }> & { promptForAppearance?: boolean }) | { kind: 'spread' } | { kind: 'dismiss' }

export function expireDnd5eFlameAlterations(flames: readonly Dnd5ePhysicalFlame[], worldMinute: number): Dnd5ePhysicalFlame[] {
  if (!Number.isFinite(worldMinute) || worldMinute < 0) throw new Error('invalid-flame-clock')
  return flames.map(flame => ({ ...flame,
    alterations: flame.burning ? flame.alterations.filter(effect => effect.expiresAtWorldMinute > worldMinute) : [],
  }))
}

/** Base light is immutable: temporary changes never multiply an already modified radius. */
export function projectDnd5eControlledFlame(flame: Dnd5ePhysicalFlame, worldMinute: number) {
  return controlledFlameAppearance(flame, worldMinute)
}

type FlameResult = { ok: true; flames: Dnd5ePhysicalFlame[] } | { ok: false; reason: string }

/** Caller supplies authoritative visibility/range facts and commits action costs with this result. */
export function changeDnd5eNonmagicalFlame(input: {
  flames: readonly Dnd5ePhysicalFlame[]; flameId: string; casterId: string; actionId: string;
  worldMinute: number; distanceFeet: number; visible: boolean; change: Dnd5eFlameChange;
  /** Host geometry result, never a client-supplied authorization. */
  spreadPathClear?: boolean;
}): FlameResult {
  const fail = (reason: string): FlameResult => ({ ok: false, reason })
  if (!input.casterId || !input.actionId || !Number.isFinite(input.worldMinute) || input.worldMinute < 0) return fail('invalid-flame-declaration')
  const matches = input.flames.filter(flame => flame.id === input.flameId)
  const target = matches[0]
  if (input.change.kind === 'ignite-touch') {
    if (matches.length !== 1 || target.burning || target.fuelAvailable !== true ||
      target.custody !== 'unattended') return fail('invalid-unattended-fuel')
    if (!input.visible || !Number.isFinite(input.distanceFeet) || input.distanceFeet < 0 || input.distanceFeet > 5) {
      return fail('fuel-out-of-touch-range')
    }
    return { ok: true, flames: input.flames.map(flame => flame.id === target.id
      ? { ...flame, burning: true, alterations: [] } : flame) }
  }
  if (matches.length !== 1 || !target.burning || target.magical || !Number.isFinite(target.extentFeet) ||
    target.extentFeet <= 0 || target.extentFeet > 5) return fail('invalid-nonmagical-flame')
  if (!input.visible || !Number.isFinite(input.distanceFeet) || input.distanceFeet < 0 || input.distanceFeet > 60) return fail('flame-out-of-range-or-unseen')
  if (input.change.kind === 'inspect') return { ok: true, flames: [...input.flames] }
  const flames = expireDnd5eFlameAlterations(input.flames, input.worldMinute)
  if (flames.some(flame => flame.alterations.some(effect => effect.id === input.actionId))) return fail('flame-action-already-applied')
  if (input.change.kind === 'extinguish') return { ok: true, flames: flames.map(flame => flame.id === target.id ? {
    ...flame, burning: false, alterations: [],
  } : flame) }
  if (input.change.kind === 'spread') {
    const destinationId = input.change.destinationId
    const destinations = flames.filter(flame => flame.id === destinationId)
    const destination = destinations[0], from = target.positionFeet, to = destination?.positionFeet
    if (destinations.length !== 1 || destination.id === target.id || destination.burning || destination.magical ||
      destination.fuelAvailable !== true || !Number.isFinite(destination.extentFeet) || destination.extentFeet <= 0 || destination.extentFeet > 5 ||
      input.spreadPathClear !== true || !from || !to ||
      ![from.x, from.y, from.z, to.x, to.y, to.z].every(Number.isFinite) ||
      Math.abs(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) - 5) > 1e-6) return fail('invalid-flame-expansion')
    // Ignition is an instantaneous physical change. Do not copy temporary light
    // effects, invent fuel, or attach an expiry that would extinguish real fire.
    return { ok: true, flames: flames.map(flame => flame.id === destinationId ? { ...flame, burning: true, alterations: [] } : flame) }
  }
  if (flames.flatMap(flame => flame.alterations).filter(effect => effect.casterId === input.casterId).length >= 3) return fail('flame-effect-limit')
  let effect: Dnd5eFlameAlteration
  const common = { id: input.actionId, casterId: input.casterId,
    appliedAtWorldMinute: input.worldMinute, expiresAtWorldMinute: input.worldMinute + 60 }
  if (input.change.kind === 'illumination') {
    if (![0.5, 1, 2].includes(input.change.multiplier) || (input.change.color != null && !/^#[\da-f]{6}$/i.test(input.change.color))) return fail('invalid-flame-illumination')
    effect = { ...common, kind: 'illumination', multiplier: input.change.multiplier, color: input.change.color }
  } else if (input.change.kind === 'shape') {
    if (!input.change.description.trim() || input.change.description.length > 500) return fail('invalid-flame-shape')
    effect = { ...common, kind: 'shape', shape: input.change.description.trim() }
  } else return fail('invalid-flame-change')
  return { ok: true, flames: flames.map(flame => flame.id === target.id ? { ...flame, alterations: [...flame.alterations, effect] } : flame) }
}

/** Dismiss exactly one caster-owned alteration. The Activity caller must spend an action. */
export function dismissDnd5eFlameAlteration(flames: readonly Dnd5ePhysicalFlame[], casterId: string, effectId: string, worldMinute: number): FlameResult {
  const current = expireDnd5eFlameAlterations(flames, worldMinute)
  const effects = current.flatMap(flame => flame.alterations).filter(effect => effect.id === effectId)
  if (effects.length !== 1 || effects[0].casterId !== casterId) return { ok: false, reason: 'flame-effect-not-owned' }
  return { ok: true, flames: current.map(flame => ({ ...flame, alterations: flame.alterations.filter(effect => effect.id !== effectId) })) }
}
