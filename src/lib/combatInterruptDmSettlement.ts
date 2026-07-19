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
  type ProtectionInterruptResponse,
  type ShieldSpellInterruptResponse,
  type CounterspellInterruptResponse,
  type StableMindInterruptResponse,
  type UncannyDodgeInterruptResponse,
  type DeflectMissilesInterruptResponse,
  type SavingThrowRerollInterruptResponse,
  type BardicInspirationInterruptResponse,
  type CuttingWordsInterruptResponse,
  type DarkOnesOwnLuckInterruptResponse,
  type StrokeOfLuckInterruptResponse,
  type EmpoweredSpellInterruptResponse,
  type StandAgainstTideInterruptResponse,
  type DmAdjudicationInterruptResponse,
} from './combatInterruptProtocol'

export interface DmCombatInterruptPendingIds {
  dodge?: string
  stableMind?: string
  galeCombo?: string
  agileLeap?: string
  opportunityAttack?: string
  protection?: string
  shieldSpell?: string
  counterspell?: string
  uncannyDodge?: string
  deflectMissiles?: string
  savingThrowReroll?: string
  bardicInspiration?: string
  cuttingWords?: string
  darkOnesOwnLuck?: string
  strokeOfLuck?: string
  empoweredSpell?: string
  standAgainstTide?: string
  dmAdjudication?: string
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
  | {
      kind: 'uncanny-dodge'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: UncannyDodgeInterruptResponse
      useUncannyDodge: boolean
    }
  | {
      kind: 'deflect-missiles'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: DeflectMissilesInterruptResponse
      accept: boolean
    }
  | {
      kind: 'protection'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: ProtectionInterruptResponse
      useProtection: boolean
    }
  | {
      kind: 'shield-spell'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: ShieldSpellInterruptResponse
      useShieldSpell: boolean
    }
  | {
      kind: 'counterspell'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: CounterspellInterruptResponse
      useCounterspell: boolean
    }
  | {
      kind: 'saving-throw-reroll'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: SavingThrowRerollInterruptResponse
      useSavingThrowReroll: boolean
    }
  | {
      kind: 'bardic-inspiration'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: BardicInspirationInterruptResponse
      useBardicInspiration: boolean
    }
  | {
      kind: 'cutting-words'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: CuttingWordsInterruptResponse
      useCuttingWords: boolean
    }
  | {
      kind: 'dark-ones-own-luck'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: DarkOnesOwnLuckInterruptResponse
      useDarkOnesOwnLuck: boolean
    }
  | {
      kind: 'stroke-of-luck'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: StrokeOfLuckInterruptResponse
      useStrokeOfLuck: boolean
    }
  | {
      kind: 'empowered-spell'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: EmpoweredSpellInterruptResponse
      rerollKeys: string[]
    }
  | {
      kind: 'stand-against-tide'
      id: string
      reason: 'expired' | 'answered'
      finishResponse?: StandAgainstTideInterruptResponse
      targetTokenId?: string
    }
  | {
      kind: 'dm-adjudication'
      id: string
      reason: 'expired' | 'answered'
      finishResponse: DmAdjudicationInterruptResponse
      response: DmAdjudicationInterruptResponse
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

  if (input.pending.uncannyDodge) {
    const interrupt = findCombatInterrupt(queue, input.pending.uncannyDodge)
    if (interrupt && isCombatInterruptKind(interrupt, 'uncanny-dodge')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('uncanny-dodge')
        settlements.push({
          kind: 'uncanny-dodge', id: interrupt.id, reason: 'expired',
          finishResponse: response, useUncannyDodge: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as UncannyDodgeInterruptResponse | undefined
        settlements.push({
          kind: 'uncanny-dodge', id: interrupt.id, reason: 'answered',
          finishResponse: response, useUncannyDodge: !!response?.useUncannyDodge,
        })
      }
    }
  }

  if (input.pending.deflectMissiles) {
    const interrupt = findCombatInterrupt(queue, input.pending.deflectMissiles)
    if (interrupt && isCombatInterruptKind(interrupt, 'deflect-missiles')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('deflect-missiles')
        settlements.push({
          kind: 'deflect-missiles', id: interrupt.id, reason: 'expired',
          finishResponse: response, accept: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as DeflectMissilesInterruptResponse | undefined
        settlements.push({
          kind: 'deflect-missiles', id: interrupt.id, reason: 'answered',
          finishResponse: response, accept: !!response?.accept,
        })
      }
    }
  }

  if (input.pending.protection) {
    const interrupt = findCombatInterrupt(queue, input.pending.protection)
    if (interrupt && isCombatInterruptKind(interrupt, 'protection')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('protection')
        settlements.push({
          kind: 'protection', id: interrupt.id, reason: 'expired',
          finishResponse: response, useProtection: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as ProtectionInterruptResponse | undefined
        settlements.push({
          kind: 'protection', id: interrupt.id, reason: 'answered',
          finishResponse: response, useProtection: !!response?.useProtection,
        })
      }
    }
  }

  if (input.pending.shieldSpell) {
    const interrupt = findCombatInterrupt(queue, input.pending.shieldSpell)
    if (interrupt && isCombatInterruptKind(interrupt, 'shield-spell')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('shield-spell')
        settlements.push({
          kind: 'shield-spell', id: interrupt.id, reason: 'expired',
          finishResponse: response, useShieldSpell: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as ShieldSpellInterruptResponse | undefined
        settlements.push({
          kind: 'shield-spell', id: interrupt.id, reason: 'answered',
          finishResponse: response, useShieldSpell: !!response?.useShieldSpell,
        })
      }
    }
  }

  if (input.pending.counterspell) {
    const interrupt = findCombatInterrupt(queue, input.pending.counterspell)
    if (interrupt && isCombatInterruptKind(interrupt, 'counterspell')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('counterspell')
        settlements.push({
          kind: 'counterspell', id: interrupt.id, reason: 'expired',
          finishResponse: response, useCounterspell: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as CounterspellInterruptResponse | undefined
        settlements.push({
          kind: 'counterspell', id: interrupt.id, reason: 'answered',
          finishResponse: response, useCounterspell: !!response?.useCounterspell,
        })
      }
    }
  }

  if (input.pending.savingThrowReroll) {
    const interrupt = findCombatInterrupt(queue, input.pending.savingThrowReroll)
    if (interrupt && isCombatInterruptKind(interrupt, 'saving-throw-reroll')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('saving-throw-reroll')
        settlements.push({
          kind: 'saving-throw-reroll', id: interrupt.id, reason: 'expired',
          finishResponse: response, useSavingThrowReroll: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as SavingThrowRerollInterruptResponse | undefined
        settlements.push({
          kind: 'saving-throw-reroll', id: interrupt.id, reason: 'answered',
          finishResponse: response, useSavingThrowReroll: !!response?.useSavingThrowReroll,
        })
      }
    }
  }

  if (input.pending.bardicInspiration) {
    const interrupt = findCombatInterrupt(queue, input.pending.bardicInspiration)
    if (interrupt && isCombatInterruptKind(interrupt, 'bardic-inspiration')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('bardic-inspiration')
        settlements.push({
          kind: 'bardic-inspiration', id: interrupt.id, reason: 'expired',
          finishResponse: response, useBardicInspiration: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as BardicInspirationInterruptResponse | undefined
        settlements.push({
          kind: 'bardic-inspiration', id: interrupt.id, reason: 'answered',
          finishResponse: response, useBardicInspiration: !!response?.useBardicInspiration,
        })
      }
    }
  }

  if (input.pending.cuttingWords) {
    const interrupt = findCombatInterrupt(queue, input.pending.cuttingWords)
    if (interrupt && isCombatInterruptKind(interrupt, 'cutting-words')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('cutting-words')
        settlements.push({
          kind: 'cutting-words', id: interrupt.id, reason: 'expired',
          finishResponse: response, useCuttingWords: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as CuttingWordsInterruptResponse | undefined
        settlements.push({
          kind: 'cutting-words', id: interrupt.id, reason: 'answered',
          finishResponse: response, useCuttingWords: !!response?.useCuttingWords,
        })
      }
    }
  }

  if (input.pending.darkOnesOwnLuck) {
    const interrupt = findCombatInterrupt(queue, input.pending.darkOnesOwnLuck)
    if (interrupt && isCombatInterruptKind(interrupt, 'dark-ones-own-luck')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('dark-ones-own-luck')
        settlements.push({
          kind: 'dark-ones-own-luck', id: interrupt.id, reason: 'expired',
          finishResponse: response, useDarkOnesOwnLuck: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as DarkOnesOwnLuckInterruptResponse | undefined
        settlements.push({
          kind: 'dark-ones-own-luck', id: interrupt.id, reason: 'answered',
          finishResponse: response, useDarkOnesOwnLuck: !!response?.useDarkOnesOwnLuck,
        })
      }
    }
  }

  if (input.pending.strokeOfLuck) {
    const interrupt = findCombatInterrupt(queue, input.pending.strokeOfLuck)
    if (interrupt && isCombatInterruptKind(interrupt, 'stroke-of-luck')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('stroke-of-luck')
        settlements.push({
          kind: 'stroke-of-luck', id: interrupt.id, reason: 'expired',
          finishResponse: response, useStrokeOfLuck: false,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as StrokeOfLuckInterruptResponse | undefined
        settlements.push({
          kind: 'stroke-of-luck', id: interrupt.id, reason: 'answered',
          finishResponse: response, useStrokeOfLuck: !!response?.useStrokeOfLuck,
        })
      }
    }
  }

  if (input.pending.empoweredSpell) {
    const interrupt = findCombatInterrupt(queue, input.pending.empoweredSpell)
    if (interrupt && isCombatInterruptKind(interrupt, 'empowered-spell')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('empowered-spell')
        settlements.push({
          kind: 'empowered-spell', id: interrupt.id, reason: 'expired',
          finishResponse: response, rerollKeys: [],
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as EmpoweredSpellInterruptResponse | undefined
        settlements.push({
          kind: 'empowered-spell', id: interrupt.id, reason: 'answered',
          finishResponse: response, rerollKeys: Array.isArray(response?.rerollKeys) ? response.rerollKeys : [],
        })
      }
    }
  }

  if (input.pending.standAgainstTide) {
    const interrupt = findCombatInterrupt(queue, input.pending.standAgainstTide)
    if (interrupt && isCombatInterruptKind(interrupt, 'stand-against-tide')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('stand-against-tide')
        settlements.push({
          kind: 'stand-against-tide', id: interrupt.id, reason: 'expired',
          finishResponse: response,
        })
      } else if (interrupt.status === 'answered') {
        const response = interrupt.response as StandAgainstTideInterruptResponse | undefined
        const targetTokenId = typeof response?.targetTokenId === 'string'
          ? response.targetTokenId
          : undefined
        settlements.push({
          kind: 'stand-against-tide', id: interrupt.id, reason: 'answered',
          finishResponse: response, targetTokenId,
        })
      }
    }
  }

  if (input.pending.dmAdjudication) {
    const interrupt = findCombatInterrupt(queue, input.pending.dmAdjudication)
    if (interrupt && isCombatInterruptKind(interrupt, 'dm-adjudication')) {
      if (isCombatInterruptExpired(interrupt, input.now)) {
        const response = defaultCombatInterruptResponse('dm-adjudication')
        settlements.push({
          kind: 'dm-adjudication', id: interrupt.id, reason: 'expired',
          finishResponse: response, response,
        })
      } else if (interrupt.status === 'answered') {
        const supplied = interrupt.response as DmAdjudicationInterruptResponse | undefined
        const response: DmAdjudicationInterruptResponse = supplied?.decision === 'approved'
          ? { ...supplied, decision: 'approved', effects: Array.isArray(supplied.effects) ? supplied.effects : [] }
          : { decision: 'cancelled', effects: [], ...(supplied?.note ? { note: supplied.note } : {}) }
        settlements.push({
          kind: 'dm-adjudication', id: interrupt.id, reason: 'answered',
          finishResponse: response, response,
        })
      }
    }
  }

  return settlements
}
