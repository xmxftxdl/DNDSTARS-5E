import {
  createCombatInterrupt,
  type CombatInterruptContribution,
  type SharedCombatInterruptQueueState,
} from './combatInterruptQueue'
import {
  isCombatInterruptKind,
  type CombatInterruptByKind,
  type RollConfirmationInterruptPayload,
  type RollConfirmationInterruptResponse,
} from './combatInterruptProtocol'
import {
  answerInterruptWindow,
  appendRollLedgerEntry,
  closeInterruptWindow,
  commitCombatTransaction,
  createCombatTransaction,
  openInterruptWindow,
  replaceLedgerDie,
  type RollLedgerKind,
} from './combatTransaction'
import type { D20EnemyModifierOption } from './d20InterruptPolicy'

const CONTINUE_OPTION_ID = 'continue'

function rollConfirmationGenerationKey(
  interrupt: CombatInterruptByKind<'roll-confirmation'>,
): string {
  const modifierKey = (interrupt.payload.eligibleModifiers ?? [])
    .map((entry) => [
      entry.characterId,
      entry.featureId,
      entry.modifierKind ?? 'replace-d20',
      entry.rerollScope ?? '',
      entry.direction ?? '',
    ].join(':'))
    .sort()
    .join('|')
  return [
    interrupt.mapId,
    interrupt.payload.transaction.combatId ?? '',
    interrupt.actorCharId ?? '',
    interrupt.payload.label,
    interrupt.payload.targetName ?? '',
    interrupt.payload.visibility,
    interrupt.payload.reason ?? '',
    modifierKey,
  ].join('\u001f')
}

/**
 * A page reconnect can restart the suspended automation that created a public
 * d20 window. Keep only the latest generation of an otherwise identical
 * window. A completed latest generation intentionally suppresses older
 * pending copies so they cannot reappear as ghost prompts after settlement.
 */
export function currentD20RollConfirmations(
  queue: Pick<SharedCombatInterruptQueueState, 'interrupts'>,
): CombatInterruptByKind<'roll-confirmation'>[] {
  const latestByKey = new Map<string, CombatInterruptByKind<'roll-confirmation'>>()
  for (const interrupt of queue.interrupts) {
    if (!isCombatInterruptKind(interrupt, 'roll-confirmation')) continue
    const key = rollConfirmationGenerationKey(interrupt)
    const previous = latestByKey.get(key)
    if (
      !previous ||
      interrupt.createdAt > previous.createdAt ||
      (interrupt.createdAt === previous.createdAt && interrupt.id > previous.id)
    ) latestByKey.set(key, interrupt)
  }
  return [...latestByKey.values()]
    .filter((interrupt) => interrupt.status === 'pending' || interrupt.status === 'waiting-for-dm')
    .sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id))
}

export function findCurrentD20RollConfirmation(
  queue: Pick<SharedCombatInterruptQueueState, 'interrupts'>,
  prototype: CombatInterruptByKind<'roll-confirmation'>,
): CombatInterruptByKind<'roll-confirmation'> | undefined {
  const key = rollConfirmationGenerationKey(prototype)
  return currentD20RollConfirmations(queue)
    .find((interrupt) => rollConfirmationGenerationKey(interrupt) === key)
}

function requireText(value: string, field: string, maxLength = 240): string {
  const normalized = value.trim().slice(0, maxLength)
  if (!normalized) throw new Error(`invalid-roll-confirmation-${field}`)
  return normalized
}

function requireD20(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new Error('invalid-roll-confirmation-d20')
  }
  return value
}

export function createD20RollConfirmationInterrupt(input: {
  mapId: string
  combatId?: string
  rollId: string
  label: string
  targetName?: string
  originalValue: number
  rollerCharacterId?: string
  kind?: RollLedgerKind
  visibility?: 'public' | 'dm-only'
  reason?: 'enemy-feature' | 'dm-secret-roll'
  eligibleModifiers?: readonly D20EnemyModifierOption[]
  allowDmOverride?: boolean
  now?: number
}): CombatInterruptByKind<'roll-confirmation'> {
  const now = input.now ?? Date.now()
  const mapId = requireText(input.mapId, 'map-id')
  const rollId = requireText(input.rollId, 'roll-id')
  const label = requireText(input.label, 'label', 160)
  const originalValue = requireD20(input.originalValue)
  const actorId = input.rollerCharacterId?.trim() || 'system'
  let transaction = createCombatTransaction({
    id: `d20-confirmation:${rollId}`,
    mapId,
    combatId: input.combatId,
    actorId,
    actionId: rollId,
    actionKind: 'd20-roll-confirmation',
    now,
  })
  transaction = appendRollLedgerEntry(transaction, {
    id: rollId,
    kind: input.kind ?? 'other',
    label,
    dice: { sides: 20, values: [originalValue] },
    modifier: 0,
    visibility: input.visibility ?? 'public',
    sourceId: input.rollerCharacterId,
    createdAt: now,
  })
  transaction = openInterruptWindow(transaction, {
    id: `${rollId}:dm-confirmation`,
    phase: 'after-roll',
    audience: 'dm',
    title: '确认 d20 结果',
    description: 'DM 放行前，玩家可以声明使用特性替换这次投掷。',
    options: [{ id: CONTINUE_OPTION_ID, label: '确认并继续' }],
    defaultOptionId: CONTINUE_OPTION_ID,
    timeoutPolicy: 'wait-for-dm',
    openedAt: now,
  })
  const interrupt = createCombatInterrupt<RollConfirmationInterruptPayload, RollConfirmationInterruptResponse>({
    id: `roll-confirmation:${rollId}`,
    mapId,
    kind: 'roll-confirmation',
    actorCharId: input.rollerCharacterId,
    transactionId: transaction.id,
    phase: 'after-roll',
    timeoutPolicy: 'wait-for-dm',
    payload: {
      rollId,
      label,
      targetName: input.targetName?.trim().slice(0, 120) ?? '',
      originalValue,
      visibility: input.visibility ?? 'public',
      reason: input.reason,
      eligibleModifiers: input.eligibleModifiers?.map((entry) => ({
        characterId: requireText(entry.characterId, 'eligible-character-id', 160),
        featureId: requireText(entry.featureId, 'eligible-feature-id', 160),
        featureLabel: requireText(entry.featureLabel, 'eligible-feature-label', 120),
        ...(entry.modifierKind ? { modifierKind: entry.modifierKind } : {}),
        ...(entry.sourceTokenId ? { sourceTokenId: requireText(entry.sourceTokenId, 'eligible-source-token-id', 160) } : {}),
        ...(entry.dieSides != null ? { dieSides: entry.dieSides } : {}),
        ...(entry.direction ? { direction: entry.direction } : {}),
        ...(entry.rerollScope ? { rerollScope: entry.rerollScope } : {}),
        ...(entry.resourceCosts ? {
          resourceCosts: entry.resourceCosts.map((cost) => ({
            resourceKey: requireText(cost.resourceKey, 'eligible-resource-key', 160),
            amount: cost.amount,
          })),
        } : {}),
        ...(entry.decisionRequired === true ? { decisionRequired: true } : {}),
      })),
      allowDmOverride: input.allowDmOverride === true,
      transaction,
    },
    now,
  })
  return { ...interrupt, kind: 'roll-confirmation' }
}

export function settleD20RollConfirmation(
  interrupt: CombatInterruptByKind<'roll-confirmation'>,
  acceptedContributionId?: string,
  now = Date.now(),
  dmOverrideValue?: number,
  adjustmentRoll?: number,
  choiceRerollValue?: number,
): RollConfirmationInterruptResponse {
  const originalValue = requireD20(interrupt.payload.originalValue)
  const requiredCharacterIds = new Set((interrupt.payload.eligibleModifiers ?? [])
    .filter((entry) => entry.modifierKind === 'choice-reroll' && entry.decisionRequired === true)
    .map((entry) => entry.characterId))
  const choiceDecisions = (interrupt.contributions ?? []).filter(
    (entry): entry is Extract<CombatInterruptContribution, { kind: 'choice-reroll' }> =>
      entry.kind === 'choice-reroll' && requiredCharacterIds.has(entry.characterId),
  )
  const invalidChoiceDecision = choiceDecisions.find((decision) =>
    !interrupt.payload.eligibleModifiers?.some((eligible) =>
      eligible.modifierKind === 'choice-reroll' &&
      eligible.characterId === decision.characterId &&
      eligible.featureId === decision.featureId &&
      eligible.featureLabel === decision.featureLabel &&
      (eligible.rerollScope === 'self-roll' || eligible.rerollScope === 'attack-against-self'),
    ))
  if (invalidChoiceDecision) throw new Error('invalid-roll-confirmation-choice-decision')
  if ([...requiredCharacterIds].some((characterId) =>
    !choiceDecisions.some((entry) => entry.characterId === characterId))) {
    throw new Error('roll-confirmation-player-decision-pending')
  }
  const requestedChoiceUse = choiceDecisions.find((entry) => entry.decision === 'use')
  if (requestedChoiceUse && acceptedContributionId !== requestedChoiceUse.id) {
    throw new Error('roll-confirmation-choice-reroll-must-be-used')
  }
  const windowId = `${interrupt.payload.rollId}:dm-confirmation`
  let transaction = interrupt.payload.transaction
  const contribution = acceptedContributionId
    ? interrupt.contributions?.find((entry) => entry.id === acceptedContributionId)
    : undefined
  let adjustment: RollConfirmationInterruptResponse['adjustment']
  let choiceReroll: RollConfirmationInterruptResponse['choiceReroll']
  if (contribution?.kind === 'replace-d20') {
    requireD20(contribution.replacementValue)
    transaction = replaceLedgerDie(transaction, {
      entryId: interrupt.payload.rollId,
      dieIndex: contribution.dieIndex,
      replacementValue: contribution.replacementValue,
      sourceId: contribution.featureId || contribution.characterId,
      sourceLabel: `${contribution.characterName} · ${contribution.featureLabel}`,
      now,
    })
  } else if (contribution?.kind === 'adjust-d20') {
    const eligible = interrupt.payload.eligibleModifiers?.find((entry) =>
      entry.characterId === contribution.characterId &&
      entry.featureId === contribution.featureId &&
      entry.featureLabel === contribution.featureLabel &&
      entry.modifierKind === 'adjust-d20' &&
      entry.direction === contribution.direction,
    )
    if (
      !eligible || !eligible.sourceTokenId || !Number.isInteger(eligible.dieSides) ||
      Number(eligible.dieSides) < 2 || Number(eligible.dieSides) > 100 ||
      !Number.isInteger(adjustmentRoll) || Number(adjustmentRoll) < 1 ||
      Number(adjustmentRoll) > Number(eligible.dieSides)
    ) throw new Error('invalid-roll-confirmation-adjustment')
    adjustment = {
      sourceId: eligible.sourceTokenId,
      featureId: contribution.featureId,
      direction: contribution.direction,
      roll: Number(adjustmentRoll),
    }
    transaction = appendRollLedgerEntry(transaction, {
      id: `${interrupt.payload.rollId}:adjustment`,
      kind: 'other',
      label: contribution.featureLabel,
      dice: { sides: Number(eligible.dieSides), values: [Number(adjustmentRoll)] },
      modifier: 0,
      visibility: interrupt.payload.visibility,
      sourceId: eligible.sourceTokenId,
      createdAt: now,
    })
  } else if (contribution?.kind === 'choice-reroll' && contribution.decision === 'use') {
    const eligible = interrupt.payload.eligibleModifiers?.find((entry) =>
      entry.characterId === contribution.characterId &&
      entry.featureId === contribution.featureId &&
      entry.featureLabel === contribution.featureLabel &&
      entry.modifierKind === 'choice-reroll',
    )
    if (
      !eligible ||
      (eligible.rerollScope !== 'self-roll' && eligible.rerollScope !== 'attack-against-self') ||
      !Array.isArray(eligible.resourceCosts) || eligible.resourceCosts.length < 1 ||
      eligible.resourceCosts.some((cost) =>
        !cost.resourceKey.trim() || !Number.isSafeInteger(cost.amount) || cost.amount < 1) ||
      !Number.isInteger(choiceRerollValue) || Number(choiceRerollValue) < 1 || Number(choiceRerollValue) > 20
    ) throw new Error('invalid-roll-confirmation-choice-reroll')
    const rerollValue = Number(choiceRerollValue)
    const selectedValue = eligible.rerollScope === 'attack-against-self'
      ? Math.min(originalValue, rerollValue)
      : Math.max(originalValue, rerollValue)
    transaction = appendRollLedgerEntry(transaction, {
      id: `${interrupt.payload.rollId}:choice-reroll`,
      kind: 'other',
      label: contribution.featureLabel,
      dice: { sides: 20, values: [rerollValue] },
      modifier: 0,
      visibility: interrupt.payload.visibility,
      sourceId: contribution.characterId,
      createdAt: now,
    })
    if (selectedValue !== originalValue) {
      transaction = replaceLedgerDie(transaction, {
        entryId: interrupt.payload.rollId,
        dieIndex: 0,
        replacementValue: selectedValue,
        sourceId: contribution.featureId,
        sourceLabel: `${contribution.characterName} · ${contribution.featureLabel}`,
        now,
      })
    }
    choiceReroll = {
      characterId: contribution.characterId,
      featureId: contribution.featureId,
      resourceCosts: eligible.resourceCosts.map((cost) => ({ ...cost })),
      scope: eligible.rerollScope,
      originalValue,
      rerollValue,
      selectedValue,
    }
  } else if (
    dmOverrideValue != null &&
    interrupt.payload.visibility === 'dm-only' &&
    interrupt.payload.allowDmOverride === true
  ) {
    const overrideValue = requireD20(dmOverrideValue)
    if (overrideValue !== originalValue) {
      transaction = replaceLedgerDie(transaction, {
        entryId: interrupt.payload.rollId,
        dieIndex: 0,
        replacementValue: overrideValue,
        sourceId: 'dm',
        sourceLabel: 'DM 暗骰修正',
        now,
      })
    }
  }
  transaction = answerInterruptWindow(transaction, windowId, CONTINUE_OPTION_ID, now)
  transaction = closeInterruptWindow(transaction, windowId, now)
  transaction = commitCombatTransaction(transaction, now)
  const finalValue = transaction.rollLedger.entries
    .find((entry) => entry.id === interrupt.payload.rollId)
    ?.dice.values[0] ?? originalValue
  return {
    decision: 'continue',
    finalValue,
    acceptedContributionId: contribution?.id,
    ...(adjustment ? { adjustment } : {}),
    ...(choiceReroll ? { choiceReroll } : {}),
    dmOverrideApplied: !contribution && dmOverrideValue != null && finalValue !== originalValue,
    transaction,
  }
}

export function d20RollConfirmationPlayerDecisionsComplete(
  interrupt: CombatInterruptByKind<'roll-confirmation'>,
): boolean {
  const requiredCharacterIds = new Set((interrupt.payload.eligibleModifiers ?? [])
    .filter((entry) => entry.modifierKind === 'choice-reroll' && entry.decisionRequired === true)
    .map((entry) => entry.characterId))
  if (requiredCharacterIds.size < 1) return true
  return [...requiredCharacterIds].every((characterId) =>
    interrupt.contributions?.some((entry) =>
      entry.kind === 'choice-reroll' && entry.characterId === characterId) === true)
}

export function createD20ChoiceRerollContribution(input: {
  interruptId: string
  characterId: string
  characterName: string
  featureId: string
  featureLabel: string
  decision: 'use' | 'decline'
  now?: number
}): CombatInterruptContribution {
  const now = input.now ?? Date.now()
  const characterId = requireText(input.characterId, 'character-id', 160)
  return {
    id: `${requireText(input.interruptId, 'interrupt-id')}:${characterId}:choice-reroll`,
    kind: 'choice-reroll',
    characterId,
    characterName: requireText(input.characterName, 'character-name', 80),
    featureId: requireText(input.featureId, 'feature-id', 160),
    featureLabel: requireText(input.featureLabel, 'feature-label', 120),
    decision: input.decision,
    createdAt: now,
  }
}

export function createD20AdjustmentContribution(input: {
  interruptId: string
  characterId: string
  characterName: string
  featureId: string
  featureLabel: string
  direction: 'add' | 'subtract'
  now?: number
}): CombatInterruptContribution {
  const now = input.now ?? Date.now()
  const characterId = requireText(input.characterId, 'character-id', 160)
  return {
    id: `${requireText(input.interruptId, 'interrupt-id')}:${characterId}`,
    kind: 'adjust-d20',
    characterId,
    characterName: requireText(input.characterName, 'character-name', 80),
    featureId: requireText(input.featureId, 'feature-id', 160),
    featureLabel: requireText(input.featureLabel, 'feature-label', 120),
    direction: input.direction,
    createdAt: now,
  }
}

export function createD20ReplacementContribution(input: {
  interruptId: string
  characterId: string
  characterName: string
  featureId?: string
  featureLabel: string
  replacementValue: number
  now?: number
}): CombatInterruptContribution {
  const now = input.now ?? Date.now()
  const characterId = requireText(input.characterId, 'character-id', 160)
  const featureLabel = requireText(input.featureLabel, 'feature-label', 120)
  return {
    id: `${requireText(input.interruptId, 'interrupt-id')}:${characterId}`,
    kind: 'replace-d20',
    characterId,
    characterName: requireText(input.characterName, 'character-name', 80),
    featureId: input.featureId?.trim().slice(0, 160) || undefined,
    featureLabel,
    dieIndex: 0,
    replacementValue: requireD20(input.replacementValue),
    createdAt: now,
  }
}

export function resolvedD20Value(
  response: RollConfirmationInterruptResponse | undefined,
  fallback: number,
): number {
  return response?.decision === 'continue' && Number.isInteger(response.finalValue) &&
    Number(response.finalValue) >= 1 && Number(response.finalValue) <= 20
    ? Number(response.finalValue)
    : requireD20(fallback)
}

export function resolvedD20Adjustment(
  response: RollConfirmationInterruptResponse | undefined,
): RollConfirmationInterruptResponse['adjustment'] | undefined {
  const adjustment = response?.decision === 'continue' ? response.adjustment : undefined
  if (
    !adjustment || !adjustment.sourceId.trim() || !adjustment.featureId.trim() ||
    (adjustment.direction !== 'add' && adjustment.direction !== 'subtract') ||
    !Number.isInteger(adjustment.roll) || adjustment.roll < 1
  ) return undefined
  return adjustment
}
