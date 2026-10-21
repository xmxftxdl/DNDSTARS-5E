import { normalizeDnd5eGroveVolume, type Dnd5eGroveVolume } from './druidGroveVolume'

/** Campaign days are 1440 authoritative world minutes; the default rules year is 365 days. */
export interface Dnd5eGroveAnnualCasting {
  pluginId: string
  spellId: string
  characterId: string
  volume: Dnd5eGroveVolume
  firstDay: number
  lastDay: number
  lastWorldMinute: number
  lastCastId: string
}
export function normalizeDnd5eGroveAnnualCasting(value: unknown): Dnd5eGroveAnnualCasting[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 1024).flatMap(raw => {
    if (!raw || typeof raw !== 'object') return []
    const volume = normalizeDnd5eGroveVolume(raw.volume)
    if (!volume || !['pluginId', 'spellId', 'characterId', 'lastCastId'].every(key =>
      typeof raw[key] === 'string' && raw[key].trim().length > 0 && raw[key].length <= 160) ||
      ![raw.firstDay, raw.lastDay, raw.lastWorldMinute].every(n => Number.isSafeInteger(n) && n >= 0) ||
      raw.firstDay > raw.lastDay || Math.floor(raw.lastWorldMinute / 1440) !== raw.lastDay) return []
    return [{ pluginId: raw.pluginId, spellId: raw.spellId, characterId: raw.characterId, volume,
      firstDay: raw.firstDay, lastDay: raw.lastDay, lastWorldMinute: raw.lastWorldMinute, lastCastId: raw.lastCastId }]
  })
}
function groveVolumeIdentity(volume: Dnd5eGroveVolume): string {
  const polygon = (points: { x: number; y: number }[]) => {
    const values = points.map(p => JSON.stringify([p.x, p.y]))
    if (values.length > 1 && values[0] === values.at(-1)) values.pop()
    const minimum = [...values].sort()[0]
    return values.flatMap((value, index) => value !== minimum ? [] : [
      JSON.stringify(values.map((_, offset) => values[(index + offset) % values.length])),
      JSON.stringify(values.map((_, offset) => values[(index - offset + values.length) % values.length])),
    ]).sort()[0]
  }
  return JSON.stringify([volume.minX, volume.minY, volume.widthPixels, volume.baseElevationFeet, volume.heightFeet,
    volume.excludedStructures.map(s => JSON.stringify([s.baseElevationFeet, s.heightFeet, polygon(s.points)])).sort()])
}
export function prepareDnd5eGroveAnnualCast(input: {
  history: readonly Dnd5eGroveAnnualCasting[] | undefined
  source: { pluginId: string; spellId: string; characterId: string; castId: string }
  volume: Dnd5eGroveVolume
  worldMinute: number
}) {
  const history = normalizeDnd5eGroveAnnualCasting(input.history)
  const day = Math.floor(input.worldMinute / 1440)
  const same = (entry: Dnd5eGroveAnnualCasting) => entry.pluginId === input.source.pluginId &&
    entry.spellId === input.source.spellId && entry.characterId === input.source.characterId &&
    groveVolumeIdentity(entry.volume) === groveVolumeIdentity(input.volume)
  const previous = history.find(same)
  if (!Number.isSafeInteger(input.worldMinute) || input.worldMinute < 0 ||
    (previous && (input.worldMinute < previous.lastWorldMinute || previous.lastCastId === input.source.castId))) {
    return { ok: false as const, reason: 'invalid-grove-casting-history' }
  }
  const firstDay = previous && day <= previous.lastDay + 1 ? previous.firstDay : day
  const entry: Dnd5eGroveAnnualCasting = { pluginId: input.source.pluginId, spellId: input.source.spellId,
    characterId: input.source.characterId, volume: structuredClone(input.volume), firstDay, lastDay: day,
    lastWorldMinute: input.worldMinute, lastCastId: input.source.castId }
  // Expired streaks cannot contribute to a future year; retain current streaks only.
  const retained = history.filter(e => !same(e) && e.lastDay >= day - 1)
  if (retained.length >= 1024) return { ok: false as const, reason: 'grove-casting-history-full' }
  return { ok: true as const, history: [...retained, entry], permanent: day - firstDay + 1 >= 365 }
}
