import type { Token } from '../../../store/maps'
import { mapGeometryCoverFromPoint, mapGeometryTokenElevation, mapGeometryEntityBodyHeightFeet } from '../../../lib/mapGeometry'
import { dnd5eTargetArmorClassForAttack, type Dnd5eHeadlessCombatState } from '../headlessCombatEngine'

/** Source-relative Host AC, including effects, cover, equipment and class defenses. */
export function dnd5eActivityAttackDefenses(state: Dnd5eHeadlessCombatState, actorId: string, targetId: string, origin?: Token) {
  const scene = state.companionScene
  const target = scene?.map.tokens.find(token => token.id === targetId)
  const cover = origin && scene && target ? mapGeometryCoverFromPoint({ map: scene.map, geometry: scene.geometry ?? undefined,
    from: origin, to: target, fromElevationFeet: mapGeometryTokenElevation(scene.geometry ?? undefined, origin),
    toElevationFeet: mapGeometryTokenElevation(scene.geometry ?? undefined, target),
    fromEyeHeightFeet: 0, toEyeHeightFeet: (mapGeometryEntityBodyHeightFeet(target) ?? 5) / 2 }) : undefined
  return {
    default: dnd5eTargetArmorClassForAttack(state, actorId, targetId, undefined, cover),
    melee: dnd5eTargetArmorClassForAttack(state, actorId, targetId, 'melee', cover),
    ranged: dnd5eTargetArmorClassForAttack(state, actorId, targetId, 'ranged', cover),
    spell: dnd5eTargetArmorClassForAttack(state, actorId, targetId, 'spell', cover),
  }
}
