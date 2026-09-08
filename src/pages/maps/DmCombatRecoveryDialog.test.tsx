import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DmUndoTransactionSummary } from '../../ports/sharedRoomGateway'
import { DmCombatRecoveryImpactDetails } from './DmCombatRecoveryDialog'
import {
  combatRecoveryAffectedTransactions,
  combatRecoveryOperationTransactions,
} from './dmCombatRecoveryImpact'

function transaction(input: Partial<DmUndoTransactionSummary> & Pick<DmUndoTransactionSummary, 'transactionId' | 'label' | 'createdAt'>): DmUndoTransactionSummary {
  return {
    status: 'applied',
    resources: ['characters', 'maps', 'combat'],
    updatedAt: input.createdAt,
    combatRecoverable: true,
    ...input,
  }
}

describe('DM combat recovery impact details', () => {
  it('lists every server-cascade transaction from newest through the selected checkpoint', () => {
    const history = [
      transaction({ transactionId: 'latest', label: '结算玩家行动', createdAt: 300 }),
      transaction({ transactionId: 'sync', label: '更新 combat', createdAt: 250, resources: ['combat'] }),
      transaction({ transactionId: 'selected', label: '开始战斗', createdAt: 200 }),
      transaction({ transactionId: 'older', label: '旧事务', createdAt: 100 }),
    ]

    expect(combatRecoveryAffectedTransactions(history, 'selected').map((entry) => entry.transactionId))
      .toEqual(['latest', 'sync', 'selected'])
  })

  it('keeps internal snapshots in the server cascade but excludes them from the operation count', () => {
    const affected = [
      transaction({ transactionId: 'action', label: '结算玩家行动', createdAt: 500 }),
      transaction({ transactionId: 'combat-sync', label: '更新 combat', createdAt: 490, resources: ['combat'] }),
      transaction({ transactionId: 'stats', label: '更新 combat-statistics', createdAt: 480, resources: ['combat-statistics'] }),
      transaction({ transactionId: 'interrupt', label: '处理战斗中断', createdAt: 470, resources: ['combat-interrupts'] }),
      transaction({ transactionId: 'start', label: '开始战斗', createdAt: 400 }),
    ]

    expect(combatRecoveryOperationTransactions(affected).map((entry) => entry.transactionId))
      .toEqual(['action', 'start'])
  })

  it('renders a native expandable menu with transaction and resource details', () => {
    const html = renderToStaticMarkup(<DmCombatRecoveryImpactDetails transactions={[
      transaction({
        transactionId: 'action-1',
        label: '结算玩家行动',
        createdAt: new Date('2026-09-02T09:35:10').getTime(),
        resources: ['characters', 'maps', 'combat', 'map-geometry'],
      }),
    ]} />)

    expect(html).toContain('<details')
    expect(html).toContain('将撤回 1 个实际操作')
    expect(html).toContain('结算玩家行动')
    expect(html).toContain('角色与怪物（HP、资源、状态）')
    expect(html).toContain('墙体、门窗与地图几何')
  })

  it('collapses automatic combat synchronization instead of presenting it as extra operations', () => {
    const html = renderToStaticMarkup(<DmCombatRecoveryImpactDetails transactions={[
      transaction({ transactionId: 'action-1', label: '结算玩家行动', createdAt: 300 }),
      transaction({ transactionId: 'combat-sync', label: '更新 combat', createdAt: 290, resources: ['combat'] }),
      transaction({ transactionId: 'stats-sync', label: '更新 combat-statistics', createdAt: 280, resources: ['combat-statistics'] }),
      transaction({ transactionId: 'interrupt-sync', label: '处理战斗中断', createdAt: 270, resources: ['combat-interrupts'] }),
    ]} />)

    expect(html).toContain('将撤回 1 个实际操作')
    expect(html).toContain('另有 3 条关联状态同步')
    expect(html).toContain('结算玩家行动')
    expect(html).not.toContain('更新 combat</span>')
    expect(html).not.toContain('更新 combat-statistics</span>')
    expect(html).not.toContain('处理战斗中断</span>')
    expect(html).toContain('同步恢复：')
  })
})
