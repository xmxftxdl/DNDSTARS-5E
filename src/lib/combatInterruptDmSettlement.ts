import {
  findCombatInterrupt,
  isCombatInterruptExpired,
  type SharedCombatInterruptQueueState,
} from './combatInterruptQueue'
import {
  defaultCombatInterruptResponse,
  isCombatInterruptKind,
  type AgileLeapInterruptResponse,
  type DodgeInterruptResponse,
  type GaleComboDecision,
  type GaleComboInterruptResponse,
  type OpportunityAttackInterruptResponse,
  type StableMindInterruptResponse,
} from './combatInterruptProtocol'

export interface DmCombatInterruptPendingIds {
  dodge?: string
  stableMind?: string
  galeCombo?: string
  agileLeap?: string
  opportunityAttack?: string
}

export type DmCombatInterruptSettlement =
  | {
      kind: 'dodge'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: DodgeInterruptResponse
      wantsDodge: boolean
      dodgeD20?: number
    }
  | {
      kind: 'stable-mind'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: StableMindInterruptResponse
      useStableMind: boolean
    }
  | {
      kind: 'gale-combo'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: GaleComboInterruptResponse
      decision: GaleComboDecision
    }
  | {
      kind: 'agile-leap'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: AgileLeapInterruptResponse
      useAgileLeap: boolean
    }
  | {
      kind: 'opportunity-attack'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: OpportunityAttackInterruptResponse
      useOpportunityAttack: boolean
    }

export function resolveDmCombatInterruptSettlements(input: {
  queue: SharedCombatInterruptQueueState | null | undefined
  mapId: string
  now: number
  pending: DmCombatInterruptPendingIds
}): DmCombatInterruptSettlement[] {
  const queue = input.queue
  if (!queue || queue.mapId !== input.mapId) return []
  const settlements: DmCombatInterruptSettlement[] = []

  if (input.pending.dodge) {
    const interrupt = findCombatInterrupt(queue, input.pending.dodge)
    if (interrupt && isCombatInterruptKind(interrupt, 'dodge')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('dodge')
        settlements.push({
          kind: 'dodge',
          id: interrupt.id,
          reason: 'expired',
          finishResponse: response,
          wantsDodge: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as DodgeInterruptResponse | undefined
        settlements.push({
          kind: 'dodge',
          id: interrupt.id,
          reason: 'answered',
          finishResponse: response,
          wantsDodge: !!response?.wantsDodge,
          dodgeD20: response?.dodgeD20,
        })
      }
    }
  }

  if (input.pending.stableMind) {
    const interrupt = findCombatInterrupt(queue, input.pending.stableMind)
    if (interrupt && isCombatInterruptKind(interrupt, 'stable-mind')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('stable-mind')
        settlements.push({
          kind: 'stable-mind',
          id: interrupt.id,
          reason: 'expired',
          finishResponse: response,
          useStableMind: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as StableMindInterruptResponse | undefined
        settlements.push({
          kind: 'stable-mind',
          id: interrupt.id,
          reason: 'answered',
          finishResponse: response,
          useStableMind: !!response?.useStableMind,
        })
      }
    }
  }

  if (input.pending.galeCombo) {
    const interrupt = findCombatInterrupt(queue, input.pending.galeCombo)
    if (interrupt && isCombatInterruptKind(interrupt, 'gale-combo')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('gale-combo')
        settlements.push({
          kind: 'gale-combo',
          id: interrupt.id,
          reason: 'expired',
          finishResponse: response,
          decision: 'timeout',
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as GaleComboInterruptResponse | undefined
        settlements.push({
          kind: 'gale-combo',
          id: interrupt.id,
          reason: 'answered',
          finishResponse: response,
          decision: response?.useGaleCombo ? 'accepted' : 'declined',
        })
      }
    }
  }

  if (input.pending.agileLeap) {
    const interrupt = findCombatInterrupt(queue, input.pending.agileLeap)
    if (interrupt && isCombatInterruptKind(interrupt, 'agile-leap')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('agile-leap')
        settlements.push({
          kind: 'agile-leap',
          id: interrupt.id,
          reason: 'expired',
          finishResponse: response,
          useAgileLeap: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as AgileLeapInterruptResponse | undefined
        settlements.push({
          kind: 'agile-leap',
          id: interrupt.id,
          reason: 'answered',
          finishResponse: response,
          useAgileLeap: !!response?.useAgileLeap,
        })
      }
    }
  }

  if (input.pending.opportunityAttack) {
    const interrupt = findCombatInterrupt(queue, input.pending.opportunityAttack)
    if (interrupt && isCombatInterruptKind(interrupt, 'opportunity-attack')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('opportunity-attack')
        settlements.push({
          kind: 'opportunity-attack',
          id: interrupt.id,
          reason: 'expired',
          finishResponse: response,
          useOpportunityAttack: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as OpportunityAttackInterruptResponse | undefined
        settlements.push({
          kind: 'opportunity-attack',
          id: interrupt.id,
          reason: 'answered',
          finishResponse: response,
          useOpportunityAttack: !!response?.useOpportunityAttack,
        })
      }
    }
  }

  return settlements
}
