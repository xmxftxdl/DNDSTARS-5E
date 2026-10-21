import { areaExtinguishesExposedFlame } from './areaFlamePolicy'
import { persistentAreaHeightSlices } from '../../../shared/persistent-area-columns.mjs'
import type { MapGeometryLight } from '../../lib/mapGeometry'
import { campaignLightIsActive } from '../../lib/campaignTime'
import { isFlameLight, isFlameProtected } from '../../../shared/flame-light-concealment.mjs'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { STRONG_WIND_FLAME_RECEIPT_PREFIX, strongWindFlameReceiptKey } from './strongWindFlameReceipt'

export const GEOMETRY_WIND_FLAME_TARGET_PREFIX = 'geometry-light:'
const isProtected = isFlameProtected
const receiptKey = strongWindFlameReceiptKey

function within(map: BattleMap, area: Dnd5ePluginArea, light: MapGeometryLight): boolean {
  return persistentAreaHeightSlices(area).some(slice => withinSlice(map, slice, light))
}

function withinSlice(map: BattleMap, area: Dnd5ePluginArea, light: MapGeometryLight): boolean {
  const point = light.points[0]
  const col = Math.floor((point.x - map.gridOffsetX) / map.gridSize)
  const row = Math.floor((point.y - map.gridOffsetY) / map.gridSize)
  if (!area.cells.some(cell => cell.col === col && cell.row === row)) return false
  if (area.vertical?.mode === 'volume') {
    const base = area.vertical.baseElevationFeet
    if (area.vertical.shape === 'sphere' && area.anchorCell) {
      const center = map.tokens.find(token => token.id === (area.anchorTokenId ?? area.sourceTokenId) &&
        ['source-token','target-token','effect-token'].includes(area.anchorMode ?? '')) ?? {
        x: map.gridOffsetX + (area.anchorCell.col + .5) * map.gridSize,
        y: map.gridOffsetY + (area.anchorCell.row + .5) * map.gridSize,
      }
      const scale = (map.feetPerCell ?? 5) / map.gridSize, radius = area.vertical.heightFeet / 2
      if (((point.x-center.x)*scale)**2 + ((point.y-center.y)*scale)**2 +
          (light.elevationFeet-base-radius)**2 > radius**2 + 1e-8) return false
    }
    return light.elevationFeet >= base && light.elevationFeet < base + area.vertical.heightFeet
  }
  return true
}

/** Scene lights are physical points, never creature-sized proxy Tokens. */
export function prepareStrongWindGeometryFlames(input: {
  map: BattleMap; lights: readonly MapGeometryLight[]; worldMinute: number; round: number
}) {
  const liveAreas = (input.map.dnd5ePluginAreas ?? []).filter(area =>
    (area.extinguishesUnprotectedFlames || area.strongWind || (area.sourceKind === 'core-spell' && area.coreSpellId === 'gust-of-wind')) &&
    !area.modeState?.paused && (area.permanent || (area.expiresAtWorldMinute != null
      ? input.worldMinute < area.expiresAtWorldMinute : input.round <= area.expiresAfterRound)))
  let changed = false
  const areas = input.map.dnd5ePluginAreas?.map(area => {
    const receipts = area.triggerReceipts?.filter(r => {
      if (!r.triggerId.startsWith(STRONG_WIND_FLAME_RECEIPT_PREFIX) || !r.targetTokenId.startsWith(GEOMETRY_WIND_FLAME_TARGET_PREFIX)) return true
      const light = input.lights.find(l => GEOMETRY_WIND_FLAME_TARGET_PREFIX + l.id === r.targetTokenId)
      return !!light && liveAreas.includes(area) && within(input.map, area, light) && receiptKey(light) === r.triggerId
    })
    if (receipts?.length === area.triggerReceipts?.length) return area
    changed = true
    return { ...area, triggerReceipts: receipts }
  })
  const map = changed ? { ...input.map, dnd5ePluginAreas: areas } : input.map
  const lights = input.lights.map(light => {
    if (!campaignLightIsActive(light, input.worldMinute) ||
      !(isFlameLight(light) || (light.flame !== false && light.controlledFlame?.burning)) || isProtected(light) ||
      !liveAreas.some(area => (light.controlledFlame?.magical !== true || area.extinguishesUnprotectedFlames === 'torch-or-smaller') &&
        areaExtinguishesExposedFlame(area, light) && within(map, area, light))) return light
    return { ...light, enabled: false, controlledFlame: light.controlledFlame
      ? { ...light.controlledFlame, burning: false, alterations: [] } : undefined }
  })
  const candidates = liveAreas.filter(area => area.strongWind || (area.sourceKind === 'core-spell' && area.coreSpellId === 'gust-of-wind')).flatMap(area => lights.flatMap(light => {
    if (!campaignLightIsActive(light, input.worldMinute) || light.flame === false ||
      !(isFlameLight(light) || light.controlledFlame?.burning) ||
      light.controlledFlame?.magical === true || !isProtected(light) || !within(map, area, light)) return []
    const key = receiptKey(light), targetId = GEOMETRY_WIND_FLAME_TARGET_PREFIX + light.id
    const currentArea = map.dnd5ePluginAreas!.find(a => a.id === area.id)!
    if (currentArea.triggerReceipts?.some(r => r.triggerId === key && r.targetTokenId === targetId)) return []
    return [{ areaId: area.id, lightId: light.id, targetId, key, label: area.label, targetName: light.label }]
  }))
  return { map, lights, candidates }
}

export function settleStrongWindGeometryFlame(input: Parameters<typeof prepareStrongWindGeometryFlames>[0] & {
  candidate: ReturnType<typeof prepareStrongWindGeometryFlames>['candidates'][number]; d100: number; transactionId: string
}) {
  if (!Number.isInteger(input.d100) || input.d100 < 1 || input.d100 > 100 || !input.transactionId) return
  const prepared = prepareStrongWindGeometryFlames(input), c = input.candidate
  if (!prepared.candidates.some(value => value.areaId === c.areaId && value.lightId === c.lightId && value.key === c.key)) return
  return { map: { ...prepared.map, dnd5ePluginAreas: prepared.map.dnd5ePluginAreas?.map(area => area.id !== c.areaId ? area : {
    ...area, triggerReceipts: [...(area.triggerReceipts ?? []), { triggerId: c.key, targetTokenId: c.targetId,
      round: input.round, transactionId: `wind-flame:d100=${input.d100}:${input.transactionId}` }],
  }) }, lights: prepared.lights.map(light => light.id !== c.lightId || input.d100 > 50 ? light : {
    ...light, enabled: false, controlledFlame: light.controlledFlame ? { ...light.controlledFlame, burning: false, alterations: [] } : undefined,
  }) }
}
