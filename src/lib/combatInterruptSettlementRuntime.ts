import type {
  CounterspellInterruptResponse,
  DmAdjudicationInterruptResponse,
} from './combatInterruptProtocol'
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
  counterspell: PendingCombatInterruptChannel<CounterspellInterruptResponse>
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
  /** Keeps the originating Headless transaction blocked after the ruling until the DM resumes combat. */
  waitForDmAdjudicationResume?: (settlement: Extract<DmCombatInterruptSettlement, { kind: 'dm-adjudication' }>) => Promise<void>
}

function peekPending<T>(channel: PendingCombatInterruptChannel<T>, id: string) {
  const pending = channel.current
  if (!pending || pending.id !== id) return undefined
  return pending
}

async function settlePending<T>(
  input: ApplyDmCombatInterruptSettlementsInput,
  settlement: DmCombatInterruptSettlement,
  channel: PendingCombatInterruptChannel<T>,
  value: T,
) {
  const pending = peekPending(channel, settlement.id)
  if (!pending) return
  // Keep ownership of the suspended Headless continuation until persistence
  // succeeds. Clearing first turns any transient finish/rollback failure into
  // a permanent unresolved attack or save because the next queue refresh has
  // no resolver left to retry.
  await input.settle(settlement)
  if (channel.current?.id !== settlement.id) return
  channel.current = null
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
        await settlePending(
          input,
          settlement,
          input.channels.counterspell,
          settlement.finishResponse ?? { useCounterspell: settlement.useCounterspell },
        )
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
        const pending = peekPending(input.channels.dmAdjudication, settlement.id)
        if (!pending) break
        input.clearDmAdjudicationPrompt()
        await input.waitForDmAdjudicationResume?.(settlement)
        if (input.channels.dmAdjudication.current?.id !== settlement.id) break
        input.channels.dmAdjudication.current = null
        pending.resolve(settlement.response)
        break
      }
      default:
        break
    }
  }
}
