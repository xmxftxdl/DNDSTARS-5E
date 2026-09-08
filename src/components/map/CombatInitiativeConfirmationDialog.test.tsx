import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { InitiativeEntry } from './InitiativeTracker'
import CombatInitiativeConfirmationDialog from './CombatInitiativeConfirmationDialog'
import {
  moveInitiativeConfirmationEntry,
  swapInitiativeConfirmationEntries,
} from './combatInitiativeConfirmation'

const entry = (tokenId: string, label: string, roll: number): InitiativeEntry => ({
  slotId: `${tokenId}:normal`,
  tokenId,
  label,
  emoji: '◉',
  color: '#64748b',
  roll,
  initiativeCalculation: {
    rolls: [roll - 2],
    d20: roll - 2,
    modifier: 2,
    mode: 'normal',
  },
})

describe('CombatInitiativeConfirmationDialog', () => {
  it('reorders a selected initiative slot without mutating the draft', () => {
    const original = [entry('hero', '英雄', 18), entry('dragon', '幼龙', 15), entry('mage', '法师', 12)]

    const moved = moveInitiativeConfirmationEntry(original, 'dragon:normal', -1)

    expect(moved.map((candidate) => candidate.tokenId)).toEqual(['dragon', 'hero', 'mage'])
    expect(moved.map((candidate) => candidate.roll)).toEqual([18, 15, 12])
    expect(moved.map((candidate) => candidate.initiativeCalculation?.d20)).toEqual([16, 13, 10])
    expect(original.map((candidate) => candidate.tokenId)).toEqual(['hero', 'dragon', 'mage'])
    expect(original.map((candidate) => candidate.roll)).toEqual([18, 15, 12])
    expect(moveInitiativeConfirmationEntry(moved, 'dragon:normal', -1)).toBe(moved)
  })

  it('swaps two non-adjacent combatants together with their initiative dice ranks', () => {
    const original = [entry('hero', '英雄', 18), entry('dragon', '幼龙', 15), entry('mage', '法师', 12)]

    const swapped = swapInitiativeConfirmationEntries(original, 'hero:normal', 'mage:normal')

    expect(swapped.map((candidate) => candidate.tokenId)).toEqual(['mage', 'dragon', 'hero'])
    expect(swapped.map((candidate) => candidate.roll)).toEqual([18, 15, 12])
    expect(swapped.map((candidate) => candidate.initiativeCalculation?.d20)).toEqual([16, 13, 10])
    expect(original.map((candidate) => candidate.tokenId)).toEqual(['hero', 'dragon', 'mage'])
  })

  it('shows the authoritative roll breakdown and requires an explicit DM confirmation', () => {
    const html = renderToStaticMarkup(
      <CombatInitiativeConfirmationDialog
        entries={[entry('hero', '英雄', 18), entry('dragon', '幼龙', 15)]}
        surprisedCount={1}
        submitting={false}
        onEntriesChange={() => undefined}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect(html).toContain('确认先攻顺序')
    expect(html).toContain('调整顺序时会同步交换先攻骰值')
    expect(html).toContain('d20 16 +2 = 18')
    expect(html).toContain('选择 英雄 进行先攻互换')
    expect(html).toContain('1 名单位处于受突袭状态')
    expect(html).toContain('data-testid="initiative-confirm-submit"')
    expect(html).toContain('确认并开始第一回合')
  })

  it('supports a mandatory live-combat monster confirmation without start-combat copy', () => {
    const html = renderToStaticMarkup(
      <CombatInitiativeConfirmationDialog
        entries={[entry('dragon', '幼龙', 15)]}
        surprisedCount={0}
        submitting={false}
        title="确认新增怪物先攻"
        description="确认前不加入轮转。"
        footerHint="不会切换当前行动者。"
        confirmLabel="确认并加入当前战斗"
        dismissible={false}
        onEntriesChange={() => undefined}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect(html).toContain('确认新增怪物先攻')
    expect(html).toContain('确认并加入当前战斗')
    expect(html).not.toContain('取消确认先攻')
    expect(html).not.toContain('确认并开始第一回合')
  })
})
