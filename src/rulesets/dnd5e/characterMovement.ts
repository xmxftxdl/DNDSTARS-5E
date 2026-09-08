import type { Character } from '../../types/character'
import {
  dnd5eActiveClimbSpeedEqualsWalking,
  dnd5eActiveFlySpeed,
  dnd5eActiveSwimSpeedEqualsWalking,
} from './activeEffects'
import { dnd5eEffectiveWalkingSpeed } from './classes'
import { getDnd5eSrdMonster } from './monsters'

export interface Dnd5eCharacterMovementProfile {
  walkSpeed: number
  climbSpeed?: number
  swimSpeed?: number
  flySpeed?: number
  hover?: boolean
  maximumSpeed: number
}

export type Dnd5eCharacterMovementStateProjection = Pick<
  NonNullable<Character['dnd5eCombatState']>,
  'activeEffects' | 'wildShapeFormId'
>

/**
 * Projects the movement modes of the creature the character currently is.
 * A polymorphed character keeps its body fields for restoration, so map
 * movement must read the active monster form instead of those persisted fields.
 */
export function dnd5eEffectiveCharacterMovementProfile(
  character: Pick<
    Character,
    | 'charClass'
    | 'level'
    | 'dnd5eClassLevels'
    | 'speed'
    | 'equipment'
    | 'dnd5eInventory'
    | 'exhaustionLevel'
    | 'dnd5eCombatState'
    | 'dnd5eMovementSpeeds'
  >,
  projectedCombatState?: Dnd5eCharacterMovementStateProjection,
): Dnd5eCharacterMovementProfile {
  // During room synchronization the map token and character resource can be
  // observed one revision apart. The token carries the same Headless creature
  // form state, so accept it as a projection instead of briefly falling back
  // to the character's original body speeds on the player client.
  const effects = projectedCombatState?.activeEffects ??
    character.dnd5eCombatState?.activeEffects
  const creatureFormId = projectedCombatState?.wildShapeFormId ??
    character.dnd5eCombatState?.wildShapeFormId
  const creatureForm = creatureFormId
    ? getDnd5eSrdMonster(creatureFormId)
    : undefined
  const walkSpeed = Math.max(
    0,
    creatureForm?.speed.walk ?? dnd5eEffectiveWalkingSpeed(character),
  )
  const baseClimbSpeed = creatureForm?.speed.climb ?? character.dnd5eMovementSpeeds?.climb
  const baseSwimSpeed = creatureForm?.speed.swim ?? character.dnd5eMovementSpeeds?.swim
  const climbSpeed = dnd5eActiveClimbSpeedEqualsWalking(effects)
    ? Math.max(baseClimbSpeed ?? 0, walkSpeed)
    : baseClimbSpeed
  const swimSpeed = dnd5eActiveSwimSpeedEqualsWalking(effects)
    ? Math.max(baseSwimSpeed ?? 0, walkSpeed)
    : baseSwimSpeed
  const flySpeed = Math.max(
    creatureForm?.speed.fly ?? character.dnd5eMovementSpeeds?.fly ?? 0,
    dnd5eActiveFlySpeed(effects) ?? 0,
  ) || undefined
  const maximumSpeed = Math.max(
    walkSpeed,
    climbSpeed ?? 0,
    swimSpeed ?? 0,
    flySpeed ?? 0,
  )

  return {
    walkSpeed,
    climbSpeed,
    swimSpeed,
    flySpeed,
    hover: creatureForm?.speed.hover ?? character.dnd5eMovementSpeeds?.hover,
    maximumSpeed,
  }
}
