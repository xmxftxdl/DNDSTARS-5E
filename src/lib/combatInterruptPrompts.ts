import type { Character } from '../types/character'
import {
  isCombatInterruptExpired,
  type CombatInterruptKind,
  type SharedCombatInterrupt,
  type SharedCombatInterruptQueueState,
} from './combatInterruptQueue'
import {
  isCombatInterruptKind,
  resolveCombatInterruptAnswerCandidate,
  type CombatInterruptAnswerContext,
  type CombatInterruptByKind,
} from './combatInterruptProtocol'

export type CombatInterruptSuppression = Partial<Record<CombatInterruptKind, ReadonlySet<string>>>

export interface CombatInterruptPrompt<K extends CombatInterruptKind> {
  interrupt: CombatInterruptByKind<K>
  character: Character
}

export interface CombatInterruptPromptSelection {
  dodge?: CombatInterruptPrompt<'dodge'>
  'stable-mind'?: CombatInterruptPrompt<'stable-mind'>
  'gale-combo'?: CombatInterruptPrompt<'gale-combo'>
  'agile-leap'?: CombatInterruptPrompt<'agile-leap'>
  'opportunity-attack'?: CombatInterruptPrompt<'opportunity-attack'>
}

export interface SharedDodgePromptView {
  id: string
  result: CombatInterruptByKind<'dodge'>['payload']['result']
  targetChar: Character
  expiresAt?: number
}

export interface SharedStableMindPromptView {
  id: string
  targetChar: Character
  fullDamage: number
  damageAfterSave: number
  saveD20: number
  saveMod: number
  saveTotal: number
  dc: number
  expiresAt?: number
}

export interface SharedGaleComboPromptView {
  id: string
  casterChar: Character
  triggerLabel: string
  expiresAt?: number
}

export interface SharedAgileLeapPromptView {
  id: string
  targetChar: Character
  feet: number
  uses: number
  maxUses: number
  expiresAt?: number
}

export interface SharedOpportunityAttackPromptView {
  id: string
  attackerChar: Character
  targetName: string
  expiresAt?: number
}

export interface CombatInterruptPromptViews {
  dodge?: SharedDodgePromptView
  stableMind?: SharedStableMindPromptView
  galeCombo?: SharedGaleComboPromptView
  agileLeap?: SharedAgileLeapPromptView
  opportunityAttack?: SharedOpportunityAttackPromptView
}

function findAnswerableInterrupt<K extends CombatInterruptKind>(
  pendingInterrupts: SharedCombatInterrupt[],
  kind: K,
  suppressedIds: ReadonlySet<string> | undefined,
  answerContext: CombatInterruptAnswerContext,
): CombatInterruptPrompt<K> | undefined {
  const interrupt = pendingInterrupts.find(
    (candidate): candidate is CombatInterruptByKind<K> =>
      isCombatInterruptKind(candidate, kind) && !suppressedIds?.has(candidate.id),
  )
  if (!interrupt) return undefined

  const candidate = resolveCombatInterruptAnswerCandidate(interrupt, answerContext)
  if (!candidate.canAnswer || !candidate.character) return undefined
  return { interrupt, character: candidate.character }
}

export function resolveCombatInterruptPromptSelection(input: {
  queue: SharedCombatInterruptQueueState | null | undefined
  mapId: string
  now: number
  answerContext: CombatInterruptAnswerContext
  suppressed: CombatInterruptSuppression
}): CombatInterruptPromptSelection {
  const queue = input.queue
  if (!queue || queue.mapId !== input.mapId) return {}
  const pendingInterrupts = queue.interrupts.filter(
    (interrupt) =>
      interrupt.mapId === input.mapId &&
      interrupt.status === 'pending' &&
      !isCombatInterruptExpired(interrupt, input.now),
  )

  return {
    dodge: findAnswerableInterrupt(pendingInterrupts, 'dodge', input.suppressed.dodge, input.answerContext),
    'stable-mind': findAnswerableInterrupt(
      pendingInterrupts,
      'stable-mind',
      input.suppressed['stable-mind'],
      input.answerContext,
    ),
    'gale-combo': findAnswerableInterrupt(
      pendingInterrupts,
      'gale-combo',
      input.suppressed['gale-combo'],
      input.answerContext,
    ),
    'agile-leap': findAnswerableInterrupt(
      pendingInterrupts,
      'agile-leap',
      input.suppressed['agile-leap'],
      input.answerContext,
    ),
    'opportunity-attack': findAnswerableInterrupt(
      pendingInterrupts,
      'opportunity-attack',
      input.suppressed['opportunity-attack'],
      input.answerContext,
    ),
  }
}

export function buildCombatInterruptPromptViews(
  selection: CombatInterruptPromptSelection,
): CombatInterruptPromptViews {
  const dodge = selection.dodge
  const stableMind = selection['stable-mind']
  const galeCombo = selection['gale-combo']
  const agileLeap = selection['agile-leap']
  const opportunityAttack = selection['opportunity-attack']

  return {
    dodge: dodge
      ? {
          id: dodge.interrupt.id,
          result: dodge.interrupt.payload.result,
          targetChar: dodge.character,
          expiresAt: dodge.interrupt.expiresAt,
        }
      : undefined,
    stableMind: stableMind
      ? {
          id: stableMind.interrupt.id,
          targetChar: stableMind.character,
          fullDamage: stableMind.interrupt.payload.fullDamage,
          damageAfterSave: stableMind.interrupt.payload.damageAfterSave,
          saveD20: stableMind.interrupt.payload.saveD20,
          saveMod: stableMind.interrupt.payload.saveMod,
          saveTotal: stableMind.interrupt.payload.saveTotal,
          dc: stableMind.interrupt.payload.dc,
          expiresAt: stableMind.interrupt.expiresAt,
        }
      : undefined,
    galeCombo: galeCombo
      ? {
          id: galeCombo.interrupt.id,
          casterChar: galeCombo.character,
          triggerLabel: galeCombo.interrupt.payload.triggerLabel,
          expiresAt: galeCombo.interrupt.expiresAt,
        }
      : undefined,
    agileLeap: agileLeap
      ? {
          id: agileLeap.interrupt.id,
          targetChar: agileLeap.character,
          feet: agileLeap.interrupt.payload.feet,
          uses: agileLeap.interrupt.payload.uses,
          maxUses: agileLeap.interrupt.payload.maxUses,
          expiresAt: agileLeap.interrupt.expiresAt,
        }
      : undefined,
    opportunityAttack: opportunityAttack
      ? {
          id: opportunityAttack.interrupt.id,
          attackerChar: opportunityAttack.character,
          targetName: opportunityAttack.interrupt.payload.targetName,
          expiresAt: opportunityAttack.interrupt.expiresAt,
        }
      : undefined,
  }
}
