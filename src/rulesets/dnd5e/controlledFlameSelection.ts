import type { Dnd5eFlameIntent } from './controlledFlame'
import { prepareDnd5eControlledFlameMapChange } from './controlledFlameMap'

type Scene = Omit<Parameters<typeof prepareDnd5eControlledFlameMapChange>[0], 'selection'>
export type ControlledFlameSelection = { lightId: string; mapId?: string; destinationId?: string; effectId?: string }

/** Host-generated choices contain only IDs; eligibility is always checked against the live scene. */
export function controlledFlameSelectionOptions(scene: Scene, intent: Dnd5eFlameIntent) {
  const lights = scene.geometries.find(value => value.mapId === scene.map.id)?.lights ?? []
  const options: { id: string; label: string; selection: ControlledFlameSelection }[] = []
  const add = (selection: ControlledFlameSelection, label: string) => {
    const request = intent.kind === 'dismiss'
      ? { dismissEffectId: selection.effectId! }
      : { lightId: selection.lightId, change: intent.kind === 'spread'
        ? { kind: 'spread' as const, destinationId: selection.destinationId! } : intent }
    if (prepareDnd5eControlledFlameMapChange({ ...scene, selection: request }).ok) {
      options.push({ id: JSON.stringify(selection), label, selection })
    }
  }
  const sources = intent.kind === 'dismiss' ? scene.geometries : scene.geometries.filter(value => value.mapId === scene.map.id)
  for (const geometry of sources) for (const light of geometry.lights ?? []) {
    if (!light.controlledFlame) continue
    const label = `${light.label || '火焰'} (${light.points[0]?.x}, ${light.points[0]?.y})`
    if (intent.kind === 'dismiss') {
      for (const effect of light.controlledFlame.alterations) {
        if (effect.casterId !== scene.casterId || effect.expiresAtWorldMinute <= scene.worldMinute) continue
        add({ lightId: light.id, mapId: geometry.mapId, effectId: effect.id }, `${geometry.mapId === scene.map.id ? '当前地图' : geometry.mapId} · ${label} · ${effect.kind === 'shape' ? '形状' : '照明'} · ${effect.id}`)
      }
    } else if (intent.kind === 'spread') {
      for (const destination of lights) {
        if (!destination.controlledFlame?.fuelAvailable || destination.id === light.id) continue
        add({ lightId: light.id, destinationId: destination.id }, `${label} → ${destination.label || '燃料'} (${destination.points[0]?.x}, ${destination.points[0]?.y})`)
      }
    } else add({ lightId: light.id }, label)
  }
  return options
}

/** Cancellation and forged/stale choices fail closed; the caller must not commit resource costs. */
export async function requestControlledFlameSelection(input: {
  readScene: () => Scene
  intent: Dnd5eFlameIntent
  choose: (options: { id: string; label: string }[]) => Promise<unknown>
}): Promise<ControlledFlameSelection | undefined> {
  const options = controlledFlameSelectionOptions(input.readScene(), input.intent)
  if (!options.length) return undefined
  const id = await input.choose(options.map(({ id, label }) => ({ id, label })))
  if (typeof id !== 'string' || !options.some(option => option.id === id)) return undefined
  return controlledFlameSelectionOptions(input.readScene(), input.intent).find(option => option.id === id)?.selection
}
