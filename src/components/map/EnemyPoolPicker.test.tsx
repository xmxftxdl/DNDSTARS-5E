import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { buildDnd5eCustomMonster, createDnd5eCustomMonsterDraft } from '../../rulesets/dnd5e/customMonsterWorkshop'
import EnemyPoolPicker from './EnemyPoolPicker'
import { composeDnd5eEnemyPool } from './enemyPoolComposition'

describe('EnemyPoolPicker room monster integration', () => {
  it('shows saved room monsters and exposes the room workshop to a DM', () => {
    const monster = buildDnd5eCustomMonster({
      ...createDnd5eCustomMonsterDraft(),
      name: '地图放置测试怪物',
      englishName: 'Map Placement Test Monster',
    })
    const pool = composeDnd5eEnemyPool([monster], [])
    expect(pool).toContainEqual(expect.objectContaining({
      id: monster.id,
      name: '地图放置测试怪物',
      maxHp: monster.hitPoints.average,
    }))

    const markup = renderToStaticMarkup(createElement(EnemyPoolPicker, {
      open: true,
      canManageCustom: true,
      onClose: vi.fn(),
      onPick: vi.fn(),
    }))

    expect(markup).toContain('房间怪物工坊')
  })
})
