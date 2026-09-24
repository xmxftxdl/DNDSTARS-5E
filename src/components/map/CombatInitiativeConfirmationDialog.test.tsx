import { initiativeResultLogDetails } from '../../pages/mapsPageHelpers'
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
    expect(moved.map((candidate) => candidate.initiativeCalculation?.d20)).toEqual([13, 16, 10])
    expect(original.map((candidate) => candidate.tokenId)).toEqual(['hero', 'dragon', 'mage'])
    expect(original.map((candidate) => candidate.roll)).toEqual([18, 15, 12])
    expect(moveInitiativeConfirmationEntry(moved, 'dragon:normal', -1)).toBe(moved)
  })

  it('swaps two non-adjacent combatants while preserving their own original dice evidence', () => {
    const original = [entry('hero', '英雄', 18), entry('dragon', '幼龙', 15), entry('mage', '法师', 12)]

    const swapped = swapInitiativeConfirmationEntries(original, 'hero:normal', 'mage:normal')

    expect(swapped.map((candidate) => candidate.tokenId)).toEqual(['mage', 'dragon', 'hero'])
    expect(swapped.map((candidate) => candidate.roll)).toEqual([18, 15, 12])
    expect(swapped.map((candidate) => candidate.initiativeCalculation?.d20)).toEqual([10, 13, 16])
    expect(original.map((candidate) => candidate.tokenId)).toEqual(['hero', 'dragon', 'mage'])
  })

  it('keeps a poisoned fighter disadvantage out of the wizard log after a DM swap', () => {
    const fighter: InitiativeEntry = {...entry('fighter', 'Test02', 22), initiativeCalculation:{rolls:[18,19],d20:18,modifier:4,mode:'disadvantage'}}
    const wizard: InitiativeEntry = {...entry('wizard', '新冒险者', 13), initiativeCalculation:{rolls:[10],d20:10,modifier:3,mode:'normal'}}
    const original = [fighter, wizard]
    const swapped = swapInitiativeConfirmationEntries(original, 'fighter:normal', 'wizard:normal')
    expect(initiativeResultLogDetails(swapped)).toEqual([
      '1. 新冒险者：d20 10 + 先攻调整值（+3） = 13｜DM 调整先攻为 22',
      '2. Test02：d20（18、19，劣势取低 18） + 先攻调整值（+4） = 22｜DM 调整先攻为 13',
    ])
    const restored = swapInitiativeConfirmationEntries(swapped, 'wizard:normal', 'fighter:normal')
    expect(restored).toEqual(original)
    const html = renderToStaticMarkup(<CombatInitiativeConfirmationDialog entries={swapped} surprisedCount={0} submitting={false} onEntriesChange={() => undefined} onCancel={() => undefined} onConfirm={() => undefined} />)
    expect(html).toContain('d20 10 +3 = 13｜DM 调整先攻为 22')
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
    expect(html).toContain('原始骰值、加值及优势／劣势保留')
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
