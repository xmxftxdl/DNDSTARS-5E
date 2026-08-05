import { describe, expect, it, vi } from 'vitest'
import {
  persistEnemyTokenPortraitAssets,
  planEnemyTokenPortraitAssets,
} from './enemyTokenPortraitAssets'

const tokenPortrait = 'data:image/webp;base64,dG9rZW4='
const initiativePortrait = 'data:image/webp;base64,aW5pdGlhdGl2ZQ=='

describe('enemy token portrait assets', () => {
  it('stores separate map-token and initiative crops in the room image channel', async () => {
    const put = vi.fn(async () => true)
    const decode = vi.fn(async (source: string) => new Blob([source]))
    const plan = planEnemyTokenPortraitAssets('room:monster/1', {
      tokenPortrait,
      initiativePortrait,
    })
    expect(plan).toBeDefined()

    await expect(persistEnemyTokenPortraitAssets('room:monster/1', {
      tokenPortrait,
      initiativePortrait,
    }, { put, decode })).resolves.toEqual({
      tokenPortraitImageId: plan!.tokenPortraitImageId,
      portraitImageId: plan!.portraitImageId,
      imageIds: plan!.imageIds,
      shared: true,
    })
    expect(put).toHaveBeenCalledTimes(2)
    expect(decode).toHaveBeenNthCalledWith(1, tokenPortrait)
    expect(decode).toHaveBeenNthCalledWith(2, initiativePortrait)
  })

  it('stores a master-only portrait once and reuses it for both presentations', async () => {
    const put = vi.fn(async () => true)
    const decode = vi.fn(async () => new Blob())
    const plan = planEnemyTokenPortraitAssets('monster', {
      tokenPortrait,
      initiativePortrait: tokenPortrait,
    })

    await expect(persistEnemyTokenPortraitAssets('monster', {
      tokenPortrait,
      initiativePortrait: tokenPortrait,
    }, { put, decode })).resolves.toEqual({
      tokenPortraitImageId: plan!.tokenPortraitImageId,
      portraitImageId: plan!.portraitImageId,
      imageIds: plan!.imageIds,
      shared: true,
    })
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('changes room image ids when workshop artwork changes', () => {
    const first = planEnemyTokenPortraitAssets('monster', {
      tokenPortrait,
      initiativePortrait,
    })
    const same = planEnemyTokenPortraitAssets('monster', {
      tokenPortrait,
      initiativePortrait,
    })
    const changed = planEnemyTokenPortraitAssets('monster', {
      tokenPortrait: 'data:image/webp;base64,dXBkYXRlZA==',
      initiativePortrait,
    })

    expect(same).toEqual(first)
    expect(changed?.tokenPortraitImageId).not.toBe(first?.tokenPortraitImageId)
    expect(changed?.portraitImageId).toBe(first?.portraitImageId)
  })

  it('ignores bundled URLs because every client can resolve those directly', async () => {
    const put = vi.fn(async () => true)
    await expect(persistEnemyTokenPortraitAssets('goblin', {
      tokenPortrait: '/assets/portraits/goblin-token.png',
      initiativePortrait: '/assets/portraits/goblin-initiative.png',
    }, { put })).resolves.toBeUndefined()
    expect(put).not.toHaveBeenCalled()
  })
})
