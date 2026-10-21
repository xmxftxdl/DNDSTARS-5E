import { Line, Rect } from 'react-konva'
import type { BattleMap } from '../../store/maps'
import { effectiveDnd5eActiveEffects } from '../../rulesets/dnd5e/activeEffects'
import { mapGeometryVisibilityPolygon, type MapGeometryState } from '../../lib/mapGeometry'
import { compileDnd5eEffectiveVisionProfile } from '../../../shared/dnd5e-vision-profile.mjs'

/** Render in its own Konva Layer so cutouts cannot erase ordinary fog. */
export function PersonalPerceptionMask({ map, geometry, viewerCharacterId, worldMinute }: {
  map: BattleMap; geometry?: MapGeometryState; viewerCharacterId?: string | null; worldMinute: number
}) {
  const owned = map.tokens.filter(token => viewerCharacterId
    ? token.characterId === viewerCharacterId
    : token.viewerControlled === true)
  if (!owned.length || owned.some(token => compileDnd5eEffectiveVisionProfile({token}).sightRangeLimitFeet == null &&
    !effectiveDnd5eActiveEffects(token.dnd5eCombatState?.activeEffects).some(effect => effect.initialSpaceBoundary))) return null
  return <>
    <Rect name="personal-perception-cover" x={0} y={0} width={map.width} height={map.height}
      fill="#05070f" opacity={1} listening={false} />
    {owned.map(viewer => {
      const polygon = mapGeometryVisibilityPolygon({ map, geometry, viewer, forceEnabled:true, worldMinute })
      return polygon.length >= 3 ? <Line key={viewer.id} name="personal-perception-cutout"
        points={polygon.flatMap(point => [point.x,point.y])} closed fill="#000"
        globalCompositeOperation="destination-out" listening={false} /> : null
    })}
  </>
}
