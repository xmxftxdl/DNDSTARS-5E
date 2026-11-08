import { effectiveDnd5eActiveEffects, normalizeDnd5eActiveEffects } from './activeEffects'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import type { Dnd5eSensoryDeceptionObservation } from './sensoryDeceptionPresence'

/** Builds positive evidence from Host state; it cannot certify unmodelled scene magic absent. */
export function dnd5eCombatantSensoryDeceptionObservation(input: {
  target: Pick<Dnd5eCombatant, 'shapechanger' | 'classState' | 'concentrating'>
  distanceFeet?: number
  samePlane?: boolean
  /** Canonical source lookup, never a guess based on a token or spell's display name. */
  spellSchool: (rulesId: string) => string | undefined
}): Dnd5eSensoryDeceptionObservation {
  const effects = effectiveDnd5eActiveEffects(normalizeDnd5eActiveEffects(input.target.classState.activeEffects))
  const illusion = effects.some(effect => effect.source.kind === 'spell' && !!effect.source.rulesId &&
    input.spellSchool(effect.source.rulesId) === 'illusion')
  const disguised = effects.some(effect => effect.disguisedCreatureIdentity != null)
  const form = input.target.classState.monsterShapechangeFormId
  const original = input.target.classState.monsterShapechangeOriginalStatBlockId
  const alteredShapechanger = input.target.shapechanger === true && !!form && !!original && form !== original
  const noUnresolvedMagic = !input.target.concentrating && effects.every(effect =>
    effect.source.kind !== 'spell' && effect.source.magical !== true && !effect.disguisedCreatureIdentity)
  return {
    distanceFeet: input.distanceFeet,
    samePlane: input.samePlane,
    ...(illusion ? { illusion: true } : noUnresolvedMagic ? {illusion:false} : {}),
    shapechangerOutsideOriginalForm: alteredShapechanger,
    ...(disguised ? { sensoryDeceivingMagic: true } : noUnresolvedMagic ? {sensoryDeceivingMagic:false} : {}),
  }
}
