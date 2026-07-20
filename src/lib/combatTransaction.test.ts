import { describe, expect, it } from 'vitest'
import {
  activeInterruptWindow,
  answerInterruptWindow,
  appendRollLedgerEntry,
  closeInterruptWindow,
  commitCombatTransaction,
  createCombatTransaction,
  openInterruptWindow,
  rerollLedgerDie,
  rollLedgerTotal,
  rollbackCombatTransaction,
} from './combatTransaction'

function transaction() {
  return createCombatTransaction({ id: 'tx-1', mapId: 'map-1', actorId: 'hero', actionId: 'attack-1', actionKind: 'weapon-attack', now: 1 })
}

describe('CombatTransaction', () => {
  it('records an immutable roll ledger and every reroll', () => {
    const rolled = appendRollLedgerEntry(transaction(), {
      id: 'attack-roll', kind: 'attack', label: '长剑攻击', dice: { sides: 20, values: [4] }, modifier: 6,
      visibility: 'public', sourceId: 'hero', targetId: 'goblin', createdAt: 2,
    })
    const rerolled = rerollLedgerDie(rolled, {
      entryId: 'attack-roll', dieIndex: 0, replacementValue: 17, sourceId: 'item-1', sourceLabel: '命运之刃',
      spentResource: { characterId: 'hero', instanceId: 'item-1', resourceId: 'charges', amount: 1 }, now: 3,
    })

    expect(rolled.rollLedger.entries[0].dice.values).toEqual([4])
    expect(rerolled.rollLedger.entries[0].dice.values).toEqual([17])
    expect(rerolled.rollLedger.entries[0].rerolls[0]).toMatchObject({ previousValue: 4, replacementValue: 17 })
    expect(rollLedgerTotal(rerolled.rollLedger.entries[0])).toBe(23)
  })

  it('locks the transaction while an interrupt window is open', () => {
    const waiting = openInterruptWindow(transaction(), {
      id: 'reroll-window', phase: 'before-hit', audience: 'actor', title: '是否重掷？',
      options: [{ id: 'keep', label: '保留' }, { id: 'reroll', label: '重掷' }], defaultOptionId: 'keep',
      timeoutPolicy: 'rollback', expiresAt: 100, openedAt: 2,
    })
    expect(waiting.status).toBe('waiting-for-interrupt')
    expect(activeInterruptWindow(waiting)?.id).toBe('reroll-window')
    expect(() => commitCombatTransaction(waiting)).toThrow('interrupt-window-still-open')

    const answered = answerInterruptWindow(waiting, 'reroll-window', 'reroll', 3)
    const closed = closeInterruptWindow(answered, 'reroll-window', 4)
    expect(commitCombatTransaction(closed, 5).status).toBe('committed')
  })

  it('rolls back the open window and prevents later writes', () => {
    const waiting = openInterruptWindow(transaction(), {
      id: 'dm-window', phase: 'before-damage', audience: 'dm', title: 'DM 调整',
      options: [{ id: 'continue', label: '继续' }], defaultOptionId: 'continue', timeoutPolicy: 'wait-for-dm', openedAt: 2,
    })
    const rolledBack = rollbackCombatTransaction(waiting, 'dm-disconnected', 3)
    expect(rolledBack.status).toBe('rolled-back')
    expect(rolledBack.interruptWindows[0].status).toBe('rolled-back')
    expect(() => appendRollLedgerEntry(rolledBack, {
      id: 'late', kind: 'other', label: '晚到骰', dice: { sides: 6, values: [1] }, modifier: 0, visibility: 'public',
    })).toThrow('combat-transaction-terminal')
  })
})
