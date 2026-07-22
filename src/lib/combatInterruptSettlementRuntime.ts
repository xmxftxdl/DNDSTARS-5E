import type { DmAdjudicationInterruptResponse } from './combatInterruptProtocol'
import type { DmCombatInterruptSettlement } from './combatInterruptDmSettlement'

export interface PendingCombatInterruptChannel<T> {
  current: {
    id: string
    resolve: (value: T) => void
  } | null
}

export interface DmCombatInterruptSettlementChannels {
  opportunityAttack: PendingCombatInterruptChannel<boolean>
  protection: PendingCombatInterruptChannel<boolean>
  shieldSpell: PendingCombatInterruptChannel<boolean>
  counterspell: PendingCombatInterruptChannel<boolean>
  uncannyDodge: PendingCombatInterruptChannel<boolean>
  deflectMissiles: PendingCombatInterruptChannel<boolean>
  savingThrowReroll: PendingCombatInterruptChannel<boolean>
  bardicInspiration: PendingCombatInterruptChannel<boolean>
  cuttingWords: PendingCombatInterruptChannel<boolean>
  darkOnesOwnLuck: PendingCombatInterruptChannel<boolean>
  strokeOfLuck: PendingCombatInterruptChannel<boolean>
  empoweredSpell: PendingCombatInterruptChannel<string[]>
  standAgainstTide: PendingCombatInterruptChannel<string | undefined>
  dmAdjudication: PendingCombatInterruptChannel<DmAdjudicationInterruptResponse>
}

interface ApplyDmCombatInterruptSettlementsInput {
  settlements: readonly DmCombatInterruptSettlement[]
  channels: DmCombatInterruptSettlementChannels
  settle: (settlement: DmCombatInterruptSettlement) => Promise<void>
  clearDmAdjudicationPrompt: () => void
}

function takePending<T>(channel: PendingCombatInterruptChannel<T>, id: string) {
  const pending = channel.current
  if (!pending || pending.id !== id) return undefined
  channel.current = null
  return pending
}

async function settlePending<T>(
  input: ApplyDmCombatInterruptSettlementsInput,
  settlement: DmCombatInterruptSettlement,
  channel: PendingCombatInterruptChannel<T>,
  value: T,
) {
  const pending = takePending(channel, settlement.id)
  if (!pending) return
  await input.settle(settlement)
  pending.resolve(value)
}

export async function applyDmCombatInterruptSettlements(
  input: ApplyDmCombatInterruptSettlementsInput,
): Promise<void> {
  for (const settlement of input.settlements) {
    switch (settlement.kind) {
      case 'opportunity-attack':
        await settlePending(input, settlement, input.channels.opportunityAttack, settlement.useOpportunityAttack)
        break
      case 'protection':
        await settlePending(input, settlement, input.channels.protection, settlement.useProtection)
        break
      case 'shield-spell':
        await settlePending(input, settlement, input.channels.shieldSpell, settlement.useShieldSpell)
        break
      case 'counterspell':
        await settlePending(input, settlement, input.channels.counterspell, settlement.useCounterspell)
        break
      case 'uncanny-dodge':
        await settlePending(input, settlement, input.channels.uncannyDodge, settlement.useUncannyDodge)
        break
      case 'deflect-missiles':
        await settlePending(input, settlement, input.channels.deflectMissiles, settlement.accept)
        break
      case 'saving-throw-reroll':
        await settlePending(input, settlement, input.channels.savingThrowReroll, settlement.useSavingThrowReroll)
        break
      case 'bardic-inspiration':
        await settlePending(input, settlement, input.channels.bardicInspiration, settlement.useBardicInspiration)
        break
      case 'cutting-words':
        await settlePending(input, settlement, input.channels.cuttingWords, settlement.useCuttingWords)
        break
      case 'dark-ones-own-luck':
        await settlePending(input, settlement, input.channels.darkOnesOwnLuck, settlement.useDarkOnesOwnLuck)
        break
      case 'stroke-of-luck':
        await settlePending(input, settlement, input.channels.strokeOfLuck, settlement.useStrokeOfLuck)
        break
      case 'empowered-spell':
        await settlePending(input, settlement, input.channels.empoweredSpell, settlement.rerollKeys)
        break
      case 'stand-against-tide':
        await settlePending(input, settlement, input.channels.standAgainstTide, settlement.targetTokenId)
        break
      case 'dm-adjudication': {
        const pending = takePending(input.channels.dmAdjudication, settlement.id)
        if (!pending) break
        input.clearDmAdjudicationPrompt()
        pending.resolve(settlement.response)
        break
      }
      default:
        break
    }
  }
}
