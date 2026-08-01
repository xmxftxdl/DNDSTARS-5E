import { describe, expect, it, vi } from 'vitest'
import type { Dnd5eMapResultPlan } from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'
import {
  applyDnd5eCombatResultApplication,
  commitDnd5eCombatResult,
  mergeDnd5eCombatCharacterResult,
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
  it('保留事务提交时角色最新的法师法术书和准备法术', () => {
    const current: Character = {
      ...plan().characters[0],
      id: 'hero',
      currentHp: 30,
      dnd5eClassChoices: {
        classes: {
          wizard: {
            subclass: 'evocation',
            selections: {
              'wizard-spellbook': ['magic-missile', 'shield', 'fireball'],
              'spell-prepared': ['shield', 'fireball'],
            },
          },
        },
      },
    }
    const staleCombatResult: Character = {
      ...current,
      currentHp: 12,
      dnd5eClassChoices: {
        classes: {
          wizard: {
            subclass: 'evocation',
            selections: {
              'wizard-spellbook': ['magic-missile'],
              'spell-prepared': [],
            },
          },
        },
      },
    }

    const merged = mergeDnd5eCombatCharacterResult(current, staleCombatResult)

    expect(merged.currentHp).toBe(12)
    expect(merged.dnd5eClassChoices).toEqual(current.dnd5eClassChoices)
    expect(merged.dnd5eClassChoices?.classes?.wizard?.selections?.['spell-prepared'])
      .toEqual(['shield', 'fireball'])
  })

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

  it('地图级事务只提交一次完整地图，不暴露半完成 Token/区域状态', () => {
    const applyCharacter = vi.fn()
    const applyToken = vi.fn()
    const applyMap = vi.fn()
    const application = plan()
    applyDnd5eCombatResultApplication({
      application,
      mapId: 'map',
      applyCharacter,
      applyToken,
      applyMap,
      applicationMode: 'map',
    })
    expect(applyCharacter).toHaveBeenCalledOnce()
    expect(applyToken).not.toHaveBeenCalled()
    expect(applyMap).toHaveBeenCalledOnce()
    expect(applyMap).toHaveBeenCalledWith('map', application.map)
  })

  it('地图级事务在重复 Token 或缺少地图端口时 fail closed', () => {
    const duplicate = { id: 'token', label: 'duplicate' } as Token
    const applyCharacter = vi.fn()
    const applyMap = vi.fn()
    expect(() => applyDnd5eCombatResultApplication({
      application: plan({
        map: { id: 'map', tokens: [{ id: 'token', label: 'Hero' } as Token, duplicate] } as BattleMap,
      }),
      mapId: 'map',
      applyCharacter,
      applyToken: vi.fn(),
      applyMap,
      applicationMode: 'map',
    })).toThrow('combat-result-token-duplicate')
    expect(applyCharacter).not.toHaveBeenCalled()
    expect(applyMap).not.toHaveBeenCalled()

    expect(() => applyDnd5eCombatResultApplication({
      application: plan(),
      mapId: 'map',
      applyCharacter,
      applyToken: vi.fn(),
      applicationMode: 'map',
    })).toThrow('combat-result-map-application-port-missing')
    expect(applyCharacter).not.toHaveBeenCalled()
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

  it('propagates an authoritative persistence rejection to the transaction coordinator', async () => {
    await expect(commitDnd5eCombatResult({
      application: plan(),
      mapId: 'map',
      applyCharacter: vi.fn(),
      applyToken: vi.fn(),
      saveCharacters: async () => {
        throw new Error('characters-save-rejected:conflict')
      },
      saveMap: async () => undefined,
    })).rejects.toThrow('characters-save-rejected:conflict')
  })

  it('applies only declared combat patches so a newer DM edit is preserved', () => {
    const current = {
      id: 'hero',
      name: 'Hero',
      currentHp: 27,
      tempHp: 4,
      playerNotes: 'DM edited while dice were rolling',
    } as unknown as Character
    const staleResolved = {
      ...current,
      currentHp: 10,
      tempHp: 0,
      playerNotes: 'stale snapshot',
    }
    expect(mergeDnd5eCombatCharacterResult(current, staleResolved, {
      currentHp: 10,
      tempHp: 0,
    })).toMatchObject({
      currentHp: 10,
      tempHp: 0,
      playerNotes: 'DM edited while dice were rolling',
    })
  })

  it('uses one coupled persistence operation when an atomic saver is available', async () => {
    const saveAll = vi.fn(async () => undefined)
    const saveCharacters = vi.fn(async () => undefined)
    const saveMap = vi.fn(async () => undefined)
    await commitDnd5eCombatResult({
      application: plan(),
      mapId: 'map',
      applyCharacter: vi.fn(),
      applyToken: vi.fn(),
      saveAll,
      saveCharacters,
      saveMap,
    })
    expect(saveAll).toHaveBeenCalledOnce()
    expect(saveCharacters).not.toHaveBeenCalled()
    expect(saveMap).not.toHaveBeenCalled()
  })
})
