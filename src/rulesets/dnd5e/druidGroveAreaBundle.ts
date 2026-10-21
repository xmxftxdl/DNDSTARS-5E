import { prepareDnd5eGroveAnnualCast } from './druidGroveAnnualCasting'
import type { GridCell } from '../../lib/gridCombat'
import type { Character } from '../../types/character'
import type { Dnd5ePluginArea } from '../../store/maps'
import { prepareDnd5eDruidGroveFog } from './druidGroveFog'
import { prepareDnd5eDruidGroveUndergrowth } from './druidGroveUndergrowth'
import { prepareDnd5eDruidGroveSpikeGrowth } from './druidGroveSpikeGrowth'
import { prepareDnd5eDruidGroveWindWalls, normalizeDnd5eGroveWindWall } from './druidGroveWindWalls'
import { prepareDnd5eDruidGroveGusts } from './druidGroveGusts'
import { prepareDnd5eDruidGroveGuardians } from './druidGroveGuardians'
import { hashDnd5eArcaneLockPasswordV1 } from './mapObjectState'
import { prepareDnd5eDruidGroveMapPlacement } from './druidGroveMapPlacement'

export type Dnd5eDruidGroveExtraEffect =
  | { kind: 'none' }
  | { kind: 'spike-growth'; center: GridCell }
  | { kind: 'wind-walls'; walls: Parameters<typeof prepareDnd5eDruidGroveWindWalls>[0]['walls'] }
  | { kind: 'gusts'; winds: Parameters<typeof prepareDnd5eDruidGroveGusts>[0]['winds'] }

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key))
const cell = (value: unknown): value is GridCell => record(value) && keys(value, ['col', 'row']) &&
  Number.isSafeInteger(value.col) && Number.isSafeInteger(value.row)

/** Reject mixed choices instead of silently ignoring another effect in imported data. */
export function normalizeDnd5eDruidGroveExtraEffect(value: unknown): Dnd5eDruidGroveExtraEffect | undefined {
  if (!record(value)) return undefined
  if (value.kind === 'none' && keys(value, ['kind'])) return { kind: 'none' }
  if (value.kind === 'spike-growth' && keys(value, ['kind', 'center']) && cell(value.center)) {
    return { kind: 'spike-growth', center: { ...value.center } }
  }
  if (value.kind === 'gusts' && keys(value, ['kind', 'winds']) && Array.isArray(value.winds) && value.winds.length === 2 &&
    value.winds.every(wind => record(wind) && keys(wind, ['origin', 'aim']) && cell(wind.origin) && cell(wind.aim))) {
    return { kind: 'gusts', winds: value.winds.map(wind => ({ origin: { ...wind.origin }, aim: { ...wind.aim } })) }
  }
  if (value.kind === 'wind-walls' && keys(value, ['kind', 'walls']) && Array.isArray(value.walls) && value.walls.length === 2) {
    const walls = value.walls.map(normalizeDnd5eGroveWindWall)
    if (walls.every((wall): wall is NonNullable<typeof wall> => !!wall)) return { kind: 'wind-walls', walls }
  }
  return undefined
}

/** Pure Host preparation, including guardian replacements. Does not spend resources or commit a cast. */
export function prepareDnd5eDruidGroveAreaBundle(input: Parameters<typeof prepareDnd5eDruidGroveFog>[0] & { extra: unknown; secretPhrase?: string; characters?: readonly Character[] }) {
  const passwordDigest = input.secretPhrase == null ? undefined : hashDnd5eArcaneLockPasswordV1(input.secretPhrase)
  if (input.secretPhrase != null && !passwordDigest) return { ok: false as const, reason: 'invalid-grove-password' }
  const extra = normalizeDnd5eDruidGroveExtraEffect(input.extra)
  if (!extra) return { ok: false as const, reason: 'invalid-extra-effect' }
  const placement = prepareDnd5eDruidGroveMapPlacement(input)
  if (!placement.ok) return placement
  const fog = prepareDnd5eDruidGroveFog(input)
  if (!fog.ok) return fog
  const undergrowth = prepareDnd5eDruidGroveUndergrowth(input)
  if (!undergrowth.ok) return undergrowth
  const additional = extra.kind === 'spike-growth' ? prepareDnd5eDruidGroveSpikeGrowth({ ...input, center: extra.center })
    : extra.kind === 'wind-walls' ? prepareDnd5eDruidGroveWindWalls({ ...input, walls: extra.walls })
      : extra.kind === 'gusts' ? prepareDnd5eDruidGroveGusts({ ...input, winds: extra.winds })
        : { ok: true as const, areas: [] as Dnd5ePluginArea[] }
  if (!additional.ok) return additional
  const guardians = prepareDnd5eDruidGroveGuardians(input)
  if (!guardians.ok) return guardians
  const areas = [...fog.areas, ...undergrowth.areas, ...additional.areas,
    ...(guardians.boundary ? [guardians.boundary] : [])].map(area => ({ ...area, groveVolume: structuredClone(placement.volume),
      ...(passwordDigest ? { grovePasswordDigest: passwordDigest } : {}) }))
  if (input.map.dnd5ePluginAreas?.some(area => areas.some(created => created.id === area.id) ||
    (area.effectGroup?.castId === input.source.castId && area.sourceTokenId === input.source.tokenId && area.pluginId === input.source.pluginId))) {
    return { ok: false as const, reason: 'grove-cast-already-present' }
  }
  const annual = prepareDnd5eGroveAnnualCast({ history: input.map.dnd5eGroveAnnualCasting, source: input.source, volume: placement.volume, worldMinute: input.worldMinute })
  if (!annual.ok) return annual
  if (annual.permanent) for (const area of areas) {
    area.permanent = true
    area.expiresAtWorldMinute = undefined
  }
  const replacements = new Map(guardians.plans.map(plan => [plan.guardian.id, plan.guardian]))
  return { ok: true as const, areas, extra, guardianPlans: guardians.plans,
    preparedMap: { ...input.map,
      dnd5eGroveAnnualCasting: annual.history,
      tokens: input.map.tokens.map(token => replacements.get(token.id) ?? token),
      dnd5ePluginAreas: [...(input.map.dnd5ePluginAreas ?? []), ...areas],
    },
  }
}
