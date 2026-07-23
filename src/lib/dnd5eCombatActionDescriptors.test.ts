import { describe, expect, it } from 'vitest'
import { dnd5eSpellActionIcon } from './dnd5eActionIcons'
import {
  buildDnd5eCombatActionDescriptors,
  moveDnd5eCombatHotbarAction,
  reconcileDnd5eCombatHotbarPreference,
} from './dnd5eCombatActionDescriptors'

describe('CombatActionDescriptorV1', () => {
  const build = (patch: Partial<Parameters<typeof buildDnd5eCombatActionDescriptors>[0]> = {}) => buildDnd5eCombatActionDescriptors({
    canAct: true,
    pending: false,
    actionRemaining: 1,
    bonusActionRemaining: 1,
    movementRemaining: 30,
    ...patch,
  })

  it('统一生成基础动作、法术、物品和结束回合描述符', () => {
    const descriptors = build({
      spells: [{
        id: 'fireball', label: '火球术', description: '爆炸火焰。', icon: dnd5eSpellActionIcon({ id: 'fireball', name: '火球术' }),
        level: 3, castingTime: 'action', targeting: 'area', castingClassId: 'wizard', available: true,
      }],
      items: [{
        instanceId: 'potion-1', label: '治疗药水', description: '恢复生命值。', icon: dnd5eSpellActionIcon({ id: 'potion', name: '治疗药水' }),
        economy: 'action', targeting: 'creature', quantity: 2, usable: true,
      }],
    })
    expect(descriptors.every((entry) => entry.schemaVersion === 1)).toBe(true)
    expect(descriptors.find((entry) => entry.id === 'spell:wizard:fireball')).toMatchObject({ sourceKind: 'spell', targeting: 'configure', enabled: true })
    expect(descriptors.find((entry) => entry.id === 'item:potion-1')).toMatchObject({ sourceKind: 'item', targeting: 'creature', enabled: true })
    expect(descriptors.find((entry) => entry.id === 'feature:class-actions')).toMatchObject({ sourceKind: 'feature', targeting: 'configure', enabled: true })
    expect(descriptors.find((entry) => entry.id === 'system:move')?.icon.motif).toBe('move')
    expect(descriptors.find((entry) => entry.id === 'system:end-turn')?.command).toEqual({ kind: 'end-turn' })
  })

  it('根据行动经济和等待状态给出不可用原因', () => {
    const noAction = build({ actionRemaining: 0 })
    expect(noAction.find((entry) => entry.id === 'system:weapon-attack')).toMatchObject({ enabled: false, disabledReason: '本回合动作已用尽。' })
    const pending = build({ pending: true })
    expect(pending.every((entry) => !entry.enabled)).toBe(true)
    expect(pending[0].disabledReason).toContain('等待 DM')
  })

  it('恢复排序时移除旧动作、去重并追加新动作', () => {
    const descriptors = build()
    const preference = reconcileDnd5eCombatHotbarPreference({ schemaVersion: 1, actionIds: ['system:move', 'missing', 'system:move'], activePage: 99 }, descriptors)
    expect(preference.actionIds[0]).toBe('system:move')
    expect(preference.actionIds).not.toContain('missing')
    expect(new Set(preference.actionIds).size).toBe(preference.actionIds.length)
    expect(preference.activePage).toBeLessThanOrEqual(Math.ceil(preference.actionIds.length / 10) - 1)
  })

  it('支持拖拽重排且不丢动作', () => {
    expect(moveDnd5eCombatHotbarAction(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(moveDnd5eCombatHotbarAction(['a', 'b'], 'missing', 'a')).toEqual(['a', 'b'])
  })
})
