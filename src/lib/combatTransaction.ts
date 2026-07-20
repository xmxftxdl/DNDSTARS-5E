import type { CombatInterruptPhase, CombatInterruptTimeoutPolicy } from './combatInterruptQueue'

export const COMBAT_TRANSACTION_SCHEMA_VERSION = 1 as const

export type CombatTransactionStatus =
  | 'preparing'
  | 'waiting-for-interrupt'
  | 'resolving'
  | 'committed'
  | 'rolled-back'

export type RollLedgerKind = 'attack' | 'saving-throw' | 'damage' | 'healing' | 'ability-check' | 'other'
export type RollLedgerVisibility = 'public' | 'dm-only'

export interface RollLedgerReroll {
  dieIndex: number
  previousValue: number
  replacementValue: number
  sourceId: string
  sourceLabel: string
  spentResource?: { characterId: string; instanceId: string; resourceId: string; amount: number }
  createdAt: number
}

export interface RollLedgerEntry {
  id: string
  kind: RollLedgerKind
  label: string
  dice: { sides: number; values: number[] }
  modifier: number
  visibility: RollLedgerVisibility
  sourceId?: string
  targetId?: string
  rerolls: RollLedgerReroll[]
  createdAt: number
}

export interface RollLedger {
  entries: RollLedgerEntry[]
}

export type InterruptWindowStatus = 'open' | 'answered' | 'closed' | 'rolled-back'

export interface InterruptWindowOption {
  id: string
  label: string
  description?: string
}

export interface InterruptWindow {
  id: string
  phase: CombatInterruptPhase
  audience: 'actor' | 'target' | 'dm'
  status: InterruptWindowStatus
  title: string
  description?: string
  options: InterruptWindowOption[]
  defaultOptionId: string
  selectedOptionId?: string
  timeoutPolicy: CombatInterruptTimeoutPolicy
  expiresAt?: number
  openedAt: number
  answeredAt?: number
  closedAt?: number
}

export interface CombatTransaction {
  schemaVersion: typeof COMBAT_TRANSACTION_SCHEMA_VERSION
  id: string
  mapId: string
  combatId?: string
  actorId: string
  actionId: string
  actionKind: string
  status: CombatTransactionStatus
  rollLedger: RollLedger
  interruptWindows: InterruptWindow[]
  rollbackReason?: string
  createdAt: number
  updatedAt: number
}

export function createCombatTransaction(input: {
  id: string
  mapId: string
  combatId?: string
  actorId: string
  actionId: string
  actionKind: string
  now?: number
}): CombatTransaction {
  const now = input.now ?? Date.now()
  return {
    schemaVersion: COMBAT_TRANSACTION_SCHEMA_VERSION,
    id: input.id,
    mapId: input.mapId,
    combatId: input.combatId,
    actorId: input.actorId,
    actionId: input.actionId,
    actionKind: input.actionKind,
    status: 'preparing',
    rollLedger: { entries: [] },
    interruptWindows: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function appendRollLedgerEntry(
  transaction: CombatTransaction,
  input: Omit<RollLedgerEntry, 'rerolls' | 'createdAt'> & { createdAt?: number },
): CombatTransaction {
  assertMutable(transaction)
  if (!Number.isInteger(input.dice.sides) || input.dice.sides < 2) throw new Error('invalid-roll-ledger-die')
  if (input.dice.values.length < 1 || input.dice.values.some((value) => !Number.isInteger(value) || value < 1 || value > input.dice.sides)) {
    throw new Error('invalid-roll-ledger-values')
  }
  if (transaction.rollLedger.entries.some((entry) => entry.id === input.id)) throw new Error('duplicate-roll-ledger-entry')
  const createdAt = input.createdAt ?? Date.now()
  return {
    ...transaction,
    rollLedger: {
      entries: [...transaction.rollLedger.entries, {
        ...input,
        dice: { ...input.dice, values: [...input.dice.values] },
        rerolls: [],
        createdAt,
      }],
    },
    updatedAt: createdAt,
  }
}

export function rerollLedgerDie(
  transaction: CombatTransaction,
  input: {
    entryId: string
    dieIndex: number
    replacementValue: number
    sourceId: string
    sourceLabel: string
    spentResource?: RollLedgerReroll['spentResource']
    now?: number
  },
): CombatTransaction {
  assertMutable(transaction)
  const now = input.now ?? Date.now()
  let found = false
  const entries = transaction.rollLedger.entries.map((entry) => {
    if (entry.id !== input.entryId) return entry
    found = true
    const previousValue = entry.dice.values[input.dieIndex]
    if (previousValue == null) throw new Error('invalid-roll-ledger-die-index')
    if (!Number.isInteger(input.replacementValue) || input.replacementValue < 1 || input.replacementValue > entry.dice.sides) {
      throw new Error('invalid-roll-ledger-reroll-value')
    }
    const values = [...entry.dice.values]
    values[input.dieIndex] = input.replacementValue
    return {
      ...entry,
      dice: { ...entry.dice, values },
      rerolls: [...entry.rerolls, {
        dieIndex: input.dieIndex,
        previousValue,
        replacementValue: input.replacementValue,
        sourceId: input.sourceId,
        sourceLabel: input.sourceLabel,
        spentResource: input.spentResource,
        createdAt: now,
      }],
    }
  })
  if (!found) throw new Error('roll-ledger-entry-not-found')
  return { ...transaction, rollLedger: { entries }, updatedAt: now }
}

export function rollLedgerTotal(entry: RollLedgerEntry): number {
  return entry.dice.values.reduce((total, value) => total + value, entry.modifier)
}

export function openInterruptWindow(
  transaction: CombatTransaction,
  input: Omit<InterruptWindow, 'status' | 'openedAt' | 'answeredAt' | 'closedAt' | 'selectedOptionId'> & { openedAt?: number },
): CombatTransaction {
  assertMutable(transaction)
  if (transaction.interruptWindows.some((window) => window.status === 'open')) throw new Error('interrupt-window-already-open')
  if (transaction.interruptWindows.some((window) => window.id === input.id)) throw new Error('duplicate-interrupt-window')
  if (input.options.length < 1 || !input.options.some((option) => option.id === input.defaultOptionId)) {
    throw new Error('invalid-interrupt-window-options')
  }
  const openedAt = input.openedAt ?? Date.now()
  return {
    ...transaction,
    status: 'waiting-for-interrupt',
    interruptWindows: [...transaction.interruptWindows, { ...input, options: input.options.map((option) => ({ ...option })), status: 'open', openedAt }],
    updatedAt: openedAt,
  }
}

export function answerInterruptWindow(
  transaction: CombatTransaction,
  windowId: string,
  optionId: string,
  now = Date.now(),
): CombatTransaction {
  assertMutable(transaction)
  let found = false
  const interruptWindows = transaction.interruptWindows.map((window) => {
    if (window.id !== windowId) return window
    found = true
    if (window.status !== 'open') throw new Error('interrupt-window-not-open')
    if (!window.options.some((option) => option.id === optionId)) throw new Error('invalid-interrupt-window-option')
    return { ...window, status: 'answered' as const, selectedOptionId: optionId, answeredAt: now }
  })
  if (!found) throw new Error('interrupt-window-not-found')
  return { ...transaction, status: 'resolving', interruptWindows, updatedAt: now }
}

export function closeInterruptWindow(transaction: CombatTransaction, windowId: string, now = Date.now()): CombatTransaction {
  assertMutable(transaction)
  let found = false
  const interruptWindows = transaction.interruptWindows.map((window) => {
    if (window.id !== windowId) return window
    found = true
    if (window.status === 'rolled-back') throw new Error('interrupt-window-rolled-back')
    return { ...window, status: 'closed' as const, closedAt: now }
  })
  if (!found) throw new Error('interrupt-window-not-found')
  return { ...transaction, status: 'resolving', interruptWindows, updatedAt: now }
}

export function commitCombatTransaction(transaction: CombatTransaction, now = Date.now()): CombatTransaction {
  assertMutable(transaction)
  if (transaction.interruptWindows.some((window) => window.status === 'open')) throw new Error('interrupt-window-still-open')
  return { ...transaction, status: 'committed', updatedAt: now }
}

export function rollbackCombatTransaction(transaction: CombatTransaction, reason: string, now = Date.now()): CombatTransaction {
  assertMutable(transaction)
  return {
    ...transaction,
    status: 'rolled-back',
    rollbackReason: reason,
    interruptWindows: transaction.interruptWindows.map((window) => window.status === 'open'
      ? { ...window, status: 'rolled-back', closedAt: now }
      : window),
    updatedAt: now,
  }
}

export function activeInterruptWindow(transaction: CombatTransaction): InterruptWindow | undefined {
  return transaction.interruptWindows.find((window) => window.status === 'open')
}

function assertMutable(transaction: CombatTransaction): void {
  if (transaction.status === 'committed' || transaction.status === 'rolled-back') throw new Error('combat-transaction-terminal')
}
