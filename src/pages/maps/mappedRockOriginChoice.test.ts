import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { promptMappedRockOrigin } from './mappedRockOriginChoice'
const dialogs = vi.hoisted(() => ({ choose: vi.fn(), alert: vi.fn() }))
vi.mock('../../lib/appDialog', () => ({ showAppActionChoice: dialogs.choose, showAppAlert: dialogs.alert }))
const map = { gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
  dnd5ePluginAreas: [{ id: 'area', cells: [{ col: 1, row: 1 }] }],
  tokens: [
    { id: 'loose', label: '溪边岩石', type: 'obstacle', x: 75, y: 75, size: 1, dnd5eObjectState: { naturalFeature: 'rock', attached: false, wornOrCarried: false } },
    { id: 'fixed', label: '固定岩石', type: 'obstacle', x: 75, y: 75, size: 1, dnd5eObjectState: { naturalFeature: 'rock', attached: true, wornOrCarried: false } },
  ] } as unknown as BattleMap
beforeEach(() => { vi.clearAllMocks(); dialogs.choose.mockResolvedValue('loose') })
describe('mapped rock origin selection', () => {
  it('offers eligible named scene rocks and returns their token id', async () => {
    expect(await promptMappedRockOrigin(map, 'area', '自然之怒')).toBe('loose')
    expect(dialogs.choose.mock.calls[0][0].options).toEqual([{ id: 'loose', label: '溪边岩石 · 第 2 列，第 2 行' }])
  })
  it('cancellation does not select a default rock', async () => {
    dialogs.choose.mockResolvedValue(null)
    expect(await promptMappedRockOrigin(map, 'area', '自然之怒')).toBeNull()
  })
  it('missing grant explains why no selection is available', async () => {
    expect(await promptMappedRockOrigin(map, 'expired', '自然之怒')).toBeNull()
    expect(dialogs.choose).not.toHaveBeenCalled()
    expect(dialogs.alert).toHaveBeenCalledOnce()
  })
})
