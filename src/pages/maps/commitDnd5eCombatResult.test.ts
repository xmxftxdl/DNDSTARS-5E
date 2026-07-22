import { describe, expect, it, vi } from 'vitest'
import type { Dnd5eMapResultPlan } from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'
import {
  applyDnd5eCombatResultApplication,
  commitDnd5eCombatResult,
} from './commitDnd5eCombatResult'

function plan(patch: Partial<Dnd5eMapResultPlan> = {}): Dnd5eMapResultPlan {
  const hero = { id: 'hero', name: 'Hero' } as Character
  const token = { id: 'token', label: 'Hero' } as Token
  return {
    map: { id: 'map', tokens: [token] } as BattleMap,
    characters: [hero],
    changedCharacterIds: ['hero'],
    changedTokenIds: ['token'],
    ...patch,
  }
}

describe('战斗结果提交协调器', () => {
  it('先完成全部预检，缺失记录时不会产生半提交', () => {
    const applyCharacter = vi.fn()
    const applyToken = vi.fn()
    expect(() => applyDnd5eCombatResultApplication({
      application: plan({ changedTokenIds: ['missing'] }),
      mapId: 'map', applyCharacter, applyToken,
    })).toThrow('combat-result-token-missing:missing')
    expect(applyCharacter).not.toHaveBeenCalled()
    expect(applyToken).not.toHaveBeenCalled()
  })

  it('拒绝把其他地图的 Headless 结果写入当前地图', () => {
    expect(() => applyDnd5eCombatResultApplication({
      application: plan(),
      mapId: 'other-map',
      applyCharacter: vi.fn(),
      applyToken: vi.fn(),
    })).toThrow('combat-result-map-mismatch:map:other-map')
  })

  it('去重后按角色再 Token 的顺序写入权威 Store', () => {
    const order: string[] = []
    const receipt = applyDnd5eCombatResultApplication({
      application: plan({
        changedCharacterIds: ['hero', 'hero'],
        changedTokenIds: ['token', 'token'],
      }),
      mapId: 'map',
      applyCharacter: (id) => order.push(`character:${id}`),
      applyToken: (_mapId, id) => order.push(`token:${id}`),
    })
    expect(order).toEqual(['character:hero', 'token:token'])
    expect(receipt).toEqual({ mapId: 'map', characterIds: ['hero'], tokenIds: ['token'] })
  })

  it('等待两个共享快照完成后才返回，并允许强制保存地图级变化', async () => {
    let resolveCharacters!: () => void
    let resolveMap!: () => void
    let completed = false
    const application = plan({ changedCharacterIds: [], changedTokenIds: [] })
    const committed = commitDnd5eCombatResult({
      application,
      mapId: 'map',
      applyCharacter: vi.fn(),
      applyToken: vi.fn(),
      saveCharacters: () => new Promise<void>((resolve) => { resolveCharacters = resolve }),
      saveMap: () => new Promise<void>((resolve) => { resolveMap = resolve }),
      forceSaveCharacters: true,
      forceSaveMap: true,
    })
    void committed.then(() => { completed = true })
    await Promise.resolve()
    expect(completed).toBe(false)
    resolveCharacters()
    await Promise.resolve()
    expect(completed).toBe(false)
    resolveMap()
    await committed
    expect(completed).toBe(true)
  })
})
