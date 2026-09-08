import type { Character } from '../../types/character'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'
import { dnd5eStandardConditionId } from './conditions'
import type { Dnd5eActivityTargetV1 } from './activities/dnd5eActivityContracts'

/**
 * SRD 5.1 spell visibility audit.
 *
 * `required` means the target or placement clause explicitly requires sight.
 * `conditional` means sight matters only to one mode, a later activation, or a
 * choice such as Spirit Guardians' exclusions. `not-required` only records the
 * absence of an explicit sight clause; it never grants Headless automation.
 */
export type Dnd5eSpellVisibilityRequirement = 'required' | 'conditional' | 'not-required'

const REQUIRED_SIGHT_SPELL_IDS = new Set<string>([
  'acid-splash',
  'animal-friendship',
  'animal-messenger',
  'animal-shapes',
  'arcane-hand',
  'bane',
  'banishment',
  'black-tentacles',
  'blight',
  'blindness-deafness',
  'call-lightning',
  'chain-lightning',
  'charm-person',
  'command',
  'compulsion',
  'conjure-animals',
  'conjure-celestial',
  'conjure-fey',
  'conjure-minor-elementals',
  'conjure-woodland-beings',
  'counterspell',
  'demiplane',
  'disintegrate',
  'divine-word',
  'dominate-beast',
  'dominate-monster',
  'dominate-person',
  'earthquake',
  'enlarge-reduce',
  'enthrall',
  'eyebite',
  'fabricate',
  'faithful-hound',
  'feeblemind',
  'finger-of-death',
  'flesh-to-stone',
  'floating-disk',
  'gate',
  'geas',
  'guardian-of-faith',
  'harm',
  'haste',
  'heal',
  'healing-word',
  'heat-metal',
  'hellish-rebuke',
  'hideous-laughter',
  'hold-monster',
  'hold-person',
  'hunters-mark',
  'imprisonment',
  'irresistible-dance',
  'knock',
  'levitate',
  'magic-circle',
  'magic-missile',
  'magic-mouth',
  'major-image',
  'maze',
  'mass-heal',
  'mass-healing-word',
  'mass-suggestion',
  'meteor-swarm',
  'misty-step',
  'modify-memory',
  'passwall',
  'phantasmal-killer',
  'poison-spray',
  'polymorph',
  'power-word-kill',
  'power-word-stun',
  'prayer-of-healing',
  'prismatic-wall',
  'sacred-flame',
  'seeming',
  'storm-of-vengeance',
  'suggestion',
  'telekinesis',
  'teleport',
  'true-polymorph',
  'vicious-mockery',
  'water-breathing',
  'water-walk',
  'wind-walk',
])

const CONDITIONAL_SIGHT_SPELL_IDS = new Set<string>([
  'arcane-sword',
  'blink',
  'detect-magic',
  'detect-thoughts',
  'find-traps',
  'magic-jar',
  'spirit-guardians',
  'wish',
])

export function dnd5eSpellVisibilityRequirement(
  spellId: string,
): Dnd5eSpellVisibilityRequirement {
  if (REQUIRED_SIGHT_SPELL_IDS.has(spellId)) return 'required'
  if (CONDITIONAL_SIGHT_SPELL_IDS.has(spellId)) return 'conditional'
  return 'not-required'
}

export const DND5E_REQUIRED_SIGHT_SPELL_IDS: ReadonlySet<string> = REQUIRED_SIGHT_SPELL_IDS
export const DND5E_CONDITIONAL_SIGHT_SPELL_IDS: ReadonlySet<string> = CONDITIONAL_SIGHT_SPELL_IDS

type Dnd5eVisibleTargetRequirement = boolean | 'primary' | 'placement' | undefined

/** Host-authoritative condition check shared by both core spell cast pipelines. */
export function dnd5eCharacterIsBlinded(
  character: Pick<Character, 'conditions' | 'dnd5eCombatState'>,
): boolean {
  return dnd5eConditionsFromActiveEffects(
    character.dnd5eCombatState?.activeEffects,
    character.conditions,
  ).some((condition) => dnd5eStandardConditionId(condition) === 'blinded')
}

/** True when the spell text/Activity contract requires the caster to see its target or placement. */
export function dnd5eSpellTargetRequiresSight(input: {
  requiresVisibleTarget?: Dnd5eVisibleTargetRequirement
  activityTarget?: Dnd5eActivityTargetV1
}): boolean {
  if (
    input.requiresVisibleTarget === true ||
    input.requiresVisibleTarget === 'primary' ||
    input.requiresVisibleTarget === 'placement'
  ) return true
  return input.activityTarget?.kind !== 'self' && input.activityTarget?.requiresLineOfSight === true
}
