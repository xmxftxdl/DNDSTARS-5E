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
