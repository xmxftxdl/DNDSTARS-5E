import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildSelectedEnemyAttack, planEnemyTurn, clearEnemyAiWarnings } from './enemyAi'
import { getEnemyStatBlock } from './enemyStatBlocks'
import type { BattleMap, Token } from '../store/maps'

// 50px/格、无偏移：cell(c,r) 中心 = ((c+0.5)*50, (r+0.5)*50)，相邻格距离 = 1（近战触及）。
function makeMap(tokens: Token[]): BattleMap {
  return {
    id: 'm1',
    name: 'test',
    width: 1000,
    height: 1000,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens,
  }
}

function token(partial: Partial<Token> & Pick<Token, 'id' | 'type'>): Token {
  return {
    label: partial.id,
    x: 25,
    y: 25,
    color: '#fff',
    emoji: '🙂',
    size: 1,
    ...partial,
  } as Token
}

afterEach(() => {
  clearEnemyAiWarnings()
  vi.restoreAllMocks()
})

describe('[T7/AC1] buildEnemyAttack 按怪物真实结构化攻击数据投骰', () => {
  it('ogre / owlbear / goblin 近战攻击产出三种不同的 damageDice 标签', () => {
    const dice = ['ogre', 'owlbear', 'goblin'].map((poolId) => {
      // 敌人在 cell(0,0)，玩家在相邻 cell(1,0) → 近战触及。
      const enemy = token({ id: 'e', type: 'enemy', poolId, x: 25, y: 25 })
      const player = token({ id: 'p', type: 'player', x: 75, y: 25 })
      const result = planEnemyTurn(makeMap([enemy, player]), enemy, undefined, 2, { round: 2 })
      expect(result.attacked).toBe(true)
      const label = result.attack!.label
      const match = label.match(/(\d+d\d+)/)
      expect(match, `${poolId} 标签应含 XdY: ${label}`).toBeTruthy()
      return match![1]
    })
    // ogre=2d8、owlbear=1d10、goblin=1d6 → 三种各异。
    expect(new Set(dice).size).toBe(3)
    expect(dice).toContain('2d8')
    expect(dice).toContain('1d10')
    expect(dice).toContain('1d6')
  })

  // total/damage 不再是硬编码占位 1，而是按结构化骰估算（count*sides+bonus），
  // 与 attack.label/sides/bonus 自洽。
  it('近战 total/damage 反映真实估算伤害（非占位 1）', () => {
    const enemy = token({ id: 'e', type: 'enemy', poolId: 'ogre', x: 25, y: 25 })
    const player = token({ id: 'p', type: 'player', x: 75, y: 25 })
    const result = planEnemyTurn(makeMap([enemy, player]), enemy, undefined, 2, { round: 2 })
    expect(result.attacked).toBe(true)
    const attack = result.attack!
    const count = Number(attack.label.match(/(\d+)d\d+/)![1])
    const expected = count * attack.sides + attack.bonus
    expect(attack.total).toBe(expected)
    expect(result.damage).toBe(expected)
    expect(attack.total).toBeGreaterThan(1)
  })

  it('手动怪物回合保留 DM 选择的具体结构化攻击', () => {
    const enemy = token({ id: 'e', type: 'enemy', poolId: 'goblin', x: 25, y: 25 })
    const player = token({ id: 'p', type: 'player', x: 75, y: 25 })
    const actions = getEnemyStatBlock('goblin')?.actions ?? []
    const rangedIndex = actions.findIndex((action) => action.kind === 'ranged' && action.automation === 'headless')
    expect(rangedIndex).toBeGreaterThanOrEqual(0)

    const result = buildSelectedEnemyAttack(enemy, player, rangedIndex)
    expect(result).toMatchObject({
      attackerTokenId: enemy.id,
      targetTokenId: player.id,
      actionIndex: rangedIndex,
      attacked: true,
    })
    expect(result?.attack?.label).toContain(actions[rangedIndex].name)
  })

  it('手动怪物回合拒绝非攻击或非 Headless 动作', () => {
    const enemy = token({ id: 'e', type: 'enemy', poolId: 'goblin' })
    const player = token({ id: 'p', type: 'player' })
    expect(buildSelectedEnemyAttack(enemy, player, -1)).toBeUndefined()
  })
})

describe('[T7/AC2] AI 目标集合包含 npc/友方', () => {
  it('有玩家在场时仍优先打玩家（回归锚点）', () => {
    const enemy = token({ id: 'e', type: 'enemy', poolId: 'goblin', x: 25, y: 25 })
    const player = token({ id: 'p', type: 'player', x: 75, y: 25 })
    const npc = token({ id: 'n', type: 'npc', x: 75, y: 25 })
    const result = planEnemyTurn(makeMap([enemy, player, npc]), enemy, undefined, 2, { round: 2 })
    expect(result.attacked).toBe(true)
    // 玩家与 npc 同格等距，nearest 取先出现者（player 先入列）→ 仍打玩家。
    expect(result.targetTokenId).toBe('p')
  })

  it('只有 npc 友方的遭遇：enemy 攻击 npc（不再 no-op）', () => {
    const enemy = token({ id: 'e', type: 'enemy', poolId: 'goblin', x: 25, y: 25 })
    const npc = token({ id: 'n', type: 'npc', x: 75, y: 25 })
    const result = planEnemyTurn(makeMap([enemy, npc]), enemy, undefined, 2, { round: 2 })
    expect(result.attacked).toBe(true)
    expect(result.targetTokenId).toBe('n')
  })

  it('只有其他 enemy / 障碍时无目标（不打自己人）', () => {
    const enemy = token({ id: 'e', type: 'enemy', poolId: 'goblin', x: 25, y: 25 })
    const ally = token({ id: 'e2', type: 'enemy', poolId: 'goblin', x: 75, y: 25 })
    const obstacle = token({ id: 'o', type: 'obstacle', x: 125, y: 25 })
    const result = planEnemyTurn(makeMap([enemy, ally, obstacle]), enemy, undefined, 2, { round: 2 })
    expect(result.attacked).toBe(false)
  })

  it('把由 DM 操作但属于玩家阵营的召唤物视为目标', () => {
    const enemy = token({ id: 'e', type: 'enemy', poolId: 'goblin', x: 25, y: 25 })
    const summon = token({
      id: 'summon', type: 'enemy', x: 75, y: 25,
      dnd5eSummon: {
        schemaVersion: 1, pluginId: 'com.example', featureId: 'com.example:wolf',
        sourceCharacterId: 'hero', sourceTokenId: 'hero-token', createdRound: 1,
        expiresAfterRound: 10, side: 'player',
      },
    })
    const result = planEnemyTurn(makeMap([enemy, summon]), enemy, undefined, 2, { round: 2 })
    expect(result.attacked).toBe(true)
    expect(result.targetTokenId).toBe('summon')
  })
})

describe('[T7/AC6] 陈旧/缺失 poolId 回退仅按 token id 告警一次', () => {
  it('同一无 poolId token 多回合只 warn 一次；清空后可再 warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const enemy = token({ id: 'e', type: 'enemy', x: 25, y: 25 }) // 无 poolId
    const player = token({ id: 'p', type: 'player', x: 75, y: 25 })
    const map = makeMap([enemy, player])
    planEnemyTurn(map, enemy, undefined, 2, { round: 2 })
    planEnemyTurn(map, enemy, undefined, 2, { round: 3 })
    expect(warn).toHaveBeenCalledTimes(1)
    clearEnemyAiWarnings()
    planEnemyTurn(map, enemy, undefined, 2, { round: 4 })
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
