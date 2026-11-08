import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eSpellTargetAttackRoll } from '../../application/combat/dnd5eCombatRules'
import { dnd5eForcedPullDestination, dnd5eRepellingBlastPushDestination } from '../../rulesets/dnd5e/spellAction'

type Fall = { toElevationFeet?: number; toGroundElevationFeet?: number; fallingDamageRolls?: number[] }
type Position = { x: number; y: number; elevationFeet?: number }
export async function planEldritchBlastMovement(input: {
  map: BattleMap; actor: Token; target: Token; push: boolean; pull: boolean
  positions: Map<string, Position>
  adjudicateFall: (target: Token, destination: Position) => Promise<Fall>
}) {
  const result: Partial<Dnd5eSpellTargetAttackRoll> = {}
  let pulled = false
  for (const kind of ['push', 'pull'] as const) {
    if (!input[kind]) continue
    const target = { ...input.target, ...input.positions.get(input.target.id) }
    const map = { ...input.map, tokens: input.map.tokens.map(token => ({ ...token, ...input.positions.get(token.id) })) }
    const movement = kind === 'push' ? dnd5eRepellingBlastPushDestination(map, input.actor, target)
      : dnd5eForcedPullDestination(map, input.actor, target, 10)
    if (movement.distanceFeet <= 0) continue
    const fall = await input.adjudicateFall(target, movement.to)
    input.positions.set(target.id, { ...movement.to, elevationFeet: fall.toElevationFeet ?? target.elevationFeet })
    if (kind === 'push') Object.assign(result, {
      repellingBlastPushTo: movement.to, repellingBlastPushDistanceFeet: movement.distanceFeet,
      repellingBlastPushToElevationFeet: fall.toElevationFeet, repellingBlastPushToGroundElevationFeet: fall.toGroundElevationFeet,
      repellingBlastFallingDamageRolls: fall.fallingDamageRolls,
    })
    else { pulled = true; Object.assign(result, {
      graspOfHadarPullTo: movement.to, graspOfHadarPullDistanceFeet: movement.distanceFeet,
      graspOfHadarPullToElevationFeet: fall.toElevationFeet, graspOfHadarPullToGroundElevationFeet: fall.toGroundElevationFeet,
      graspOfHadarFallingDamageRolls: fall.fallingDamageRolls,
    }) }
  }
  return { fields: result, pulled }
}
