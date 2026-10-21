import type { Dnd5ePluginArea } from '../../store/maps'
import {
  normalizeDnd5ePersistentAreaBlocking, normalizeDnd5ePersistentAreaOccupantModifiers,
  normalizeDnd5eDirectionalMovementDeclaration, normalizeDnd5eDirectionalMovementCost,
  normalizeDnd5ePersistentAreaTriggerDeclaration, normalizeDnd5ePersistentAreaTriggerSnapshot,
  resolveDnd5ePersistentAreaTriggerSourceDc,
  type Dnd5ePersistentAreaModeDeclaration, type Dnd5ePersistentAreaModeSnapshot, type Dnd5ePersistentAreaModeState,
} from './persistentAreaTypes'

export const DND5E_AREA_MODE_FIELDS = ['blocking', 'movementCostMultiplier', 'directionalMovementCost', 'occupantModifiers', 'obscuration', 'triggers'] as const
const idPattern = /^[a-z0-9][a-z0-9_.:-]{0,119}$/
const record = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined

function normalizeProfile(value: unknown, snapshot: boolean): Dnd5ePersistentAreaModeDeclaration | Dnd5ePersistentAreaModeSnapshot | undefined {
  const raw = record(value)
  if (!raw || typeof raw.id !== 'string' || !idPattern.test(raw.id) ||
    (raw.label != null && (typeof raw.label !== 'string' || !raw.label.trim() || raw.label.length > 120)) ||
    Object.keys(raw).some(key => !['id', 'label', ...DND5E_AREA_MODE_FIELDS].includes(key))) return undefined
  const blocking = raw.blocking == null ? undefined : normalizeDnd5ePersistentAreaBlocking(raw.blocking)
  const occupantModifiers = raw.occupantModifiers == null ? undefined : normalizeDnd5ePersistentAreaOccupantModifiers(raw.occupantModifiers)
  const directionalMovementCost = raw.directionalMovementCost == null ? undefined : snapshot
    ? normalizeDnd5eDirectionalMovementCost(raw.directionalMovementCost) : normalizeDnd5eDirectionalMovementDeclaration(raw.directionalMovementCost)
  const obscuration = record(raw.obscuration)
  if ((raw.blocking != null && !blocking) || (raw.occupantModifiers != null && !occupantModifiers) ||
    (raw.directionalMovementCost != null && !directionalMovementCost) ||
    (raw.movementCostMultiplier != null && (typeof raw.movementCostMultiplier !== 'number' || !Number.isFinite(raw.movementCostMultiplier) || raw.movementCostMultiplier < 1 || raw.movementCostMultiplier > 10)) ||
    (raw.obscuration != null && (!obscuration || !['light', 'heavy'].includes(String(obscuration.kind)) ||
      Object.keys(obscuration).some(key => !['kind', 'sourceCanSeeThrough', 'scope'].includes(key)) ||
      (obscuration.scope != null && obscuration.scope !== 'source-token') ||
      (obscuration.sourceCanSeeThrough != null && typeof obscuration.sourceCanSeeThrough !== 'boolean')))) return undefined
  if (raw.triggers != null && (!Array.isArray(raw.triggers) || raw.triggers.length > 16)) return undefined
  const triggers = Array.isArray(raw.triggers) ? raw.triggers.map(value => snapshot ? normalizeDnd5ePersistentAreaTriggerSnapshot(value) : normalizeDnd5ePersistentAreaTriggerDeclaration(value)) : undefined
  if (triggers?.some(value => !value) || (triggers && new Set(triggers.map(value => value!.id)).size !== triggers.length)) return undefined
  return { id: raw.id, label: raw.label as string | undefined, blocking, occupantModifiers,
    directionalMovementCost, movementCostMultiplier: raw.movementCostMultiplier as number | undefined,
    obscuration: obscuration ? { kind: obscuration.kind as 'light' | 'heavy', sourceCanSeeThrough: obscuration.sourceCanSeeThrough as boolean | undefined,
      ...(obscuration.scope === 'source-token' ? { scope: 'source-token' as const } : {}) } : undefined,
    triggers } as Dnd5ePersistentAreaModeDeclaration | Dnd5ePersistentAreaModeSnapshot
}

export function normalizeDnd5ePersistentAreaModeDeclarations(value: unknown): Dnd5ePersistentAreaModeDeclaration[] | undefined {
  if (!Array.isArray(value) || !value.length || value.length > 16) return undefined
  const profiles = value.map(profile => normalizeProfile(profile, false))
  if (profiles.some(profile => !profile) || new Set(profiles.map(profile => profile!.id)).size !== profiles.length) return undefined
  return profiles as Dnd5ePersistentAreaModeDeclaration[]
}

export function normalizeDnd5ePersistentAreaModeState(value: unknown): Dnd5ePersistentAreaModeState | undefined {
  const raw = record(value)
  if (!raw || Object.keys(raw).some(key => !['profiles', 'selectedModeId', 'paused', 'changeReceipts'].includes(key)) ||
    !Array.isArray(raw.profiles) || !raw.profiles.length || raw.profiles.length > 16 || typeof raw.selectedModeId !== 'string' ||
    typeof raw.paused !== 'boolean' || !Array.isArray(raw.changeReceipts) || raw.changeReceipts.length > 256 ||
    raw.changeReceipts.some(receipt => typeof receipt !== 'string' || !receipt || receipt.length > 512)) return undefined
  const profiles = raw.profiles.map(profile => normalizeProfile(profile, true))
  if (profiles.some(profile => !profile) || new Set(profiles.map(profile => profile!.id)).size !== profiles.length ||
    !profiles.some(profile => profile!.id === raw.selectedModeId)) return undefined
  return { profiles: profiles as Dnd5ePersistentAreaModeSnapshot[], selectedModeId: raw.selectedModeId, paused: raw.paused, changeReceipts: [...new Set(raw.changeReceipts as string[])] }
}

export function resolveDnd5ePersistentAreaModeState(input: {
  profiles: readonly Dnd5ePersistentAreaModeDeclaration[]; initialModeId: string;
  direction?: { dc: number; dr: number }; sourceSaveDc?: number; excludedTokenIds?: readonly string[]
}): Dnd5ePersistentAreaModeState | undefined {
  const declarations = normalizeDnd5ePersistentAreaModeDeclarations(input.profiles)
  if (!declarations || !declarations.some(profile => profile.id === input.initialModeId)) return undefined
  const profiles = declarations.map(profile => ({ ...profile,
    directionalMovementCost: profile.directionalMovementCost && input.direction ? { direction: { ...input.direction }, additionalFeetPerFoot: profile.directionalMovementCost.additionalFeetPerFoot } : undefined,
    triggers: profile.triggers?.map(trigger => {
      const resolved = resolveDnd5ePersistentAreaTriggerSourceDc(trigger, input.sourceSaveDc)
      return resolved && input.excludedTokenIds?.length ? { ...resolved, excludedTokenIds: [...input.excludedTokenIds] } : resolved
    }),
  }))
  if (declarations.some(profile => profile.directionalMovementCost && !input.direction) || profiles.some(profile => profile.triggers?.some(trigger => !trigger))) return undefined
  return normalizeDnd5ePersistentAreaModeState({ profiles, selectedModeId: input.initialModeId, paused: false, changeReceipts: [] })
}

/** Existing identity, expiry, concentration and trigger-frequency ledgers are retained. */
export function projectDnd5ePersistentAreaMode(area: Dnd5ePluginArea, modeState: Dnd5ePersistentAreaModeState): Dnd5ePluginArea {
  const profile = modeState.paused ? undefined : modeState.profiles.find(profile => profile.id === modeState.selectedModeId)
  return { ...area, modeState,
    blocking: profile?.blocking ? structuredClone(profile.blocking) : undefined,
    movementCostMultiplier: profile?.movementCostMultiplier,
    directionalMovementCost: profile?.directionalMovementCost ? structuredClone(profile.directionalMovementCost) : undefined,
    occupantModifiers: profile?.occupantModifiers ? structuredClone(profile.occupantModifiers) : undefined,
    obscuration: profile?.obscuration ? structuredClone(profile.obscuration) : undefined,
    triggers: profile?.triggers?.map(trigger => structuredClone(trigger)),
  }
}

export function changeDnd5ePersistentAreaMode(area: Dnd5ePluginArea, input: {
  change: 'select' | 'pause' | 'resume'; modeId?: string; receipt: string; direction?: {dc:number;dr:number}
}): Dnd5ePluginArea | undefined {
  const state = normalizeDnd5ePersistentAreaModeState(area.modeState)
  if (!state || !input.receipt || input.receipt.length > 512 || !['select', 'pause', 'resume'].includes(input.change) ||
    (input.change === 'select' ? !state.profiles.some(profile => profile.id === input.modeId) : input.modeId != null)) return undefined
  if (input.direction && (input.change !== 'select' || !normalizeDnd5eDirectionalMovementCost({direction:input.direction,additionalFeetPerFoot:1}))) return undefined
  if (state.changeReceipts.includes(input.receipt)) return area
  const next: Dnd5ePersistentAreaModeState = { ...state,
    profiles: input.direction ? state.profiles.map(profile => ({...profile,directionalMovementCost:profile.directionalMovementCost ? {...profile.directionalMovementCost,direction:{...input.direction!}} : undefined})) : state.profiles,
    selectedModeId: input.change === 'select' ? input.modeId! : state.selectedModeId,
    paused: input.change === 'pause', changeReceipts: [...state.changeReceipts, input.receipt].slice(-256) }
  return projectDnd5ePersistentAreaMode(area, next)
}

/** Retain lifetime usage receipts for inactive and paused profiles too. */
export function dnd5ePersistentAreaAllModeTriggers(area: Pick<Dnd5ePluginArea, 'triggers' | 'modeState'>) {
  return [...(area.triggers ?? []), ...(area.modeState?.profiles.flatMap(profile => profile.triggers ?? []) ?? [])]
}
