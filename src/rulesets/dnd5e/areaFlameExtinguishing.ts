import type { MapGeometryLight } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { campaignLightIsActive } from '../../lib/campaignTime'
import { isFlameLight, isFlameProtected } from '../../../shared/flame-light-concealment.mjs'

/** The Host determines reach from the settled area, never from selected creature targets. */
export function extinguishDnd5eAreaFlames(input: {
  map: BattleMap
  lights: readonly MapGeometryLight[]
  worldMinute: number
  includeProtected?: boolean
  reachesToken: (token: Token) => boolean
  reachesLight: (light: MapGeometryLight) => boolean
}) {
  const changedTokenIds: string[] = []
  const changedLightIds: string[] = []
  if (!Number.isFinite(input.worldMinute) || input.worldMinute < 0) {
    throw new Error('invalid-flame-clock')
  }
  const tokens = input.map.tokens.map(token => {
    const light = token.lightSource
    if (!light?.enabled || !isFlameLight(light) || (!input.includeProtected && isFlameProtected(light)) || !input.reachesToken(token)) return token
    changedTokenIds.push(token.id)
    return { ...token, lightSource: undefined }
  })
  const lights = input.lights.map(light => {
    const actualFire = isFlameLight(light) || (light.flame !== false && light.controlledFlame?.burning === true)
    if (!campaignLightIsActive(light, input.worldMinute) || !actualFire || (!input.includeProtected && isFlameProtected(light)) || !input.reachesLight(light)) return light
    changedLightIds.push(light.id)
    return { ...light, enabled: false, controlledFlame: light.controlledFlame
      ? { ...light.controlledFlame, burning: false, alterations: [] } : undefined }
  })
  return {
    map: changedTokenIds.length ? { ...input.map, tokens } : input.map,
    lights: changedLightIds.length ? lights : input.lights,
    changedTokenIds,
    changedLightIds,
  }
}
