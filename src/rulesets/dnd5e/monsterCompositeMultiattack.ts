import type { Dnd5eMonsterAction } from './monsters'

export type Dnd5eMonsterCompositeStepSkipPolicy =
  | 'never'
  | 'optional'
  | 'when-resource-unavailable'

const STEP_SKIP_POLICIES: Readonly<Record<string, Dnd5eMonsterCompositeStepSkipPolicy>> =
  {
    ...Object.fromEntries(
      [
      'adult-black-dragon',
      'adult-blue-dragon',
      'adult-brass-dragon',
      'adult-bronze-dragon',
      'adult-copper-dragon',
      'adult-gold-dragon',
      'adult-green-dragon',
      'adult-red-dragon',
      'adult-silver-dragon',
      'adult-white-dragon',
      'ancient-black-dragon',
      'ancient-blue-dragon',
      'ancient-brass-dragon',
      'ancient-bronze-dragon',
      'ancient-copper-dragon',
      'ancient-gold-dragon',
      'ancient-green-dragon',
      'ancient-red-dragon',
      'ancient-silver-dragon',
      'ancient-white-dragon',
      ].map((slug) => [
        `srd-5.1:${slug}:multiattack:0`,
        'optional' as const,
      ]),
    ),
    'srd-5.1:gibbering-mouther:multiattack:1': 'when-resource-unavailable',
    'srd-5.1:nalfeshnee:multiattack:0': 'when-resource-unavailable',
    'srd-5.1:tarrasque:multiattack-frightful-presence:0': 'optional',
    'srd-5.1:tarrasque:multiattack-frightful-presence-and-swallow:0': 'optional',
    'srd-5.1:mummy:multiattack:0': 'optional',
    'srd-5.1:mummy-lord:multiattack:0': 'optional',
  }

export function dnd5eMonsterMultiattackChildIsCompositeSupported(
  action: Dnd5eMonsterAction | undefined,
): boolean {
  if (!action) return false
  if (action.kind === 'weapon-attack') return action.attack != null
  if (action.kind !== 'other' || !action.rule) return false
  return action.rule.kind === 'area-saving-throw' ||
    action.rule.kind === 'saving-throw-condition' ||
    action.rule.kind === 'source-linked-reel' ||
    action.rule.kind === 'source-linked-engulf' ||
    action.rule.kind === 'throw-linked-target'
}

export function dnd5eMonsterCompositeStepSkipPolicy(
  monsterId: string,
  actionId: string,
  sequenceIndex: number,
): Dnd5eMonsterCompositeStepSkipPolicy {
  return STEP_SKIP_POLICIES[`${monsterId}:${actionId}:${sequenceIndex}`] ?? 'never'
}
