import type { Dnd5eBasicActionPayload } from '../../lib/sharedCombatTypes'

type BasicActionKind = Dnd5eBasicActionPayload['kind']

export function dnd5eBasicActionEconomyAvailable(input: {
  kind: BasicActionKind
  actionAvailable: boolean
  bonusActionAvailable: boolean
  usesBonusActionGrant?: boolean
}): boolean {
  if (input.kind === 'release-grapple') return true
  if (input.kind === 'other-bonus-action' || input.kind === 'command-animate-dead' || input.kind === 'command-animate-objects' || input.usesBonusActionGrant) {
    return input.bonusActionAvailable
  }
  return input.actionAvailable
}
