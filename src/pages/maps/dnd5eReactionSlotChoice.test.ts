import { expect, it, vi } from 'vitest'
import { selectDnd5eReactionSlotLevel } from './dnd5eReactionSlotChoice'

it('preserves ordinary feature confirmation without opening a spell slot choice', async () => {
  const choose = vi.fn()
  expect(await selectDnd5eReactionSlotLevel(undefined, choose)).toEqual({ accepted: true })
  expect(choose).not.toHaveBeenCalled()
})
it('requires explicit selection even for one level and retains an explicit cancellation', async () => {
  let offered: readonly { id: string; label: string }[] = []
  const result = await selectDnd5eReactionSlotLevel([2, 1, 2], async options => { offered = options; return 'slot-2' })
  expect(offered.map(option => option.id)).toEqual(['slot-1', 'slot-2', 'decline'])
  expect(result).toEqual({ accepted: true, castLevel: 2 })
  expect(await selectDnd5eReactionSlotLevel([2], async () => 'decline')).toEqual({ accepted: false })
})
it.each([null, undefined, 'slot-9', '2', 2, 'slot-2 '])('rejects cancelled, timed out or unoffered choice %s', async choice => {
  expect(await selectDnd5eReactionSlotLevel([2], async () => choice)).toEqual({ accepted: false })
})
it.each([[], [0], [10], [1.5], [NaN]].map(levels => ({ levels })))('rejects malformed Host options $levels before presenting them', async ({ levels }) => {
  const choose = vi.fn()
  expect(await selectDnd5eReactionSlotLevel(levels, choose)).toEqual({ accepted: false })
  expect(choose).not.toHaveBeenCalled()
})
