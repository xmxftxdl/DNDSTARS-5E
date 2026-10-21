/** The package declares the perceptible trigger; target selection remains Host validated. */
export type Dnd5eCompanionReady = {
  trigger: string
  actionKind: 'attack' | 'move' | 'interact-object' | 'other'
}

export function isDnd5eCompanionReady(value: unknown): value is Dnd5eCompanionReady {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const raw = value as Record<string, unknown>
  return Object.keys(raw).every(key => key === 'trigger' || key === 'actionKind') &&
    typeof raw.trigger === 'string' && raw.trigger.trim().length > 0 && raw.trigger.length <= 320 &&
    typeof raw.actionKind === 'string' && ['attack', 'move', 'interact-object', 'other'].includes(raw.actionKind)
}

export function isDnd5eCompanionReadyCommand(value: { command: string; ready?: unknown }): boolean {
  return value.command === 'ready' ? isDnd5eCompanionReady(value.ready) : value.ready == null
}

export function isDnd5eCompanionReadyTriggers(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length <= 64 && Object.entries(value).every(([id, trigger]) =>
      id.length > 0 && id.length <= 200 && typeof trigger === 'string' &&
      trigger.trim().length > 0 && trigger.length <= 320)
}
