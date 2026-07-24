import { describe, expect, it } from 'vitest'
import { dnd5eSpellActionIcon } from './dnd5eActionIcons'
import {
  buildDnd5eCombatActionDescriptors,
  moveDnd5eCombatHotbarAction,
  reconcileDnd5eCombatHotbarPreference,
  resolveDnd5eCombatSpellSlotSelection,
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
        level: 3, castingTime: 'action', targeting: 'area', castingClassId: 'wizard',
        defaultSlotLevel: 3,
        availableSlotLevels: [3, 4], available: true,
      }],
      items: [{
        instanceId: 'potion-1', label: '治疗药水', description: '恢复生命值。', icon: dnd5eSpellActionIcon({ id: 'potion', name: '治疗药水' }),
        economy: 'action', targeting: 'creature', quantity: 2, usable: true,
      }],
    })
    expect(descriptors.every((entry) => entry.schemaVersion === 1)).toBe(true)
    expect(descriptors.find((entry) => entry.id === 'spell:wizard:fireball')).toMatchObject({
      sourceKind: 'spell',
      targeting: 'area',
      availableSlotLevels: [3, 4],
      command: { kind: 'cast-spell', slotLevel: 3 },
      enabled: true,
    })
    expect(resolveDnd5eCombatSpellSlotSelection(
      descriptors.find((entry) => entry.id === 'spell:wizard:fireball')!,
    )).toEqual({ ok: true, slotLevel: 3, explicitlyConfigured: false })
    expect(descriptors.find((entry) => entry.id === 'item:potion-1')).toMatchObject({ sourceKind: 'item', targeting: 'creature', enabled: true })
    expect(descriptors.find((entry) => entry.id === 'feature:class-actions')).toMatchObject({ sourceKind: 'feature', targeting: 'configure', enabled: true })
    expect(descriptors.find((entry) => entry.id === 'system:move')?.icon.motif).toBe('move')
    expect(descriptors.find((entry) => entry.id === 'system:weapon-attack')?.icon.motif).toBe('melee-attack')
    expect(descriptors.find((entry) => entry.id === 'system:dash')?.icon.motif).toBe('dash')
    expect(descriptors.find((entry) => entry.id === 'system:disengage')?.icon.motif).toBe('disengage')
    expect(descriptors.find((entry) => entry.id === 'system:dodge')?.icon.motif).toBe('dodge')
    expect(descriptors.find((entry) => entry.id === 'system:end-turn')?.command).toEqual({ kind: 'end-turn' })
  })

  it('左键保留法术基础环位，不能把更高的可用法术位静默当成升环', () => {
    const [fireball] = build({
      spells: [{
        id: 'fireball', label: '火球术', description: '基础伤害 8d6。', icon: dnd5eSpellActionIcon({ id: 'fireball', name: '火球术' }),
        level: 3, castingTime: 'action', targeting: 'area', castingClassId: 'wizard',
        defaultSlotLevel: 3,
        availableSlotLevels: [4],
        available: true,
      }],
    }).filter((entry) => entry.id === 'spell:wizard:fireball')

    expect(fireball.command).toEqual({
      kind: 'cast-spell',
      spellId: 'fireball',
      castingClassId: 'wizard',
      slotLevel: 3,
    })
    expect(fireball.availableSlotLevels).toEqual([4])
    expect(resolveDnd5eCombatSpellSlotSelection(fireball)).toEqual({
      ok: false,
      reason: '3 环位不可用；普通施放不会自动升环，请右键选择可用的更高环位。',
    })
    expect(resolveDnd5eCombatSpellSlotSelection(fireball, 4)).toEqual({
      ok: true,
      slotLevel: 4,
      explicitlyConfigured: true,
    })
  })

  it('根据行动经济和等待状态给出不可用原因', () => {
    const noAction = build({ actionRemaining: 0 })
    expect(noAction.find((entry) => entry.id === 'system:weapon-attack')).toMatchObject({ enabled: false, disabledReason: '本回合动作已用尽。' })
    const pending = build({ pending: true })
    expect(pending.every((entry) => !entry.enabled)).toBe(true)
    expect(pending[0].disabledReason).toContain('等待 DM')
  })

  it('将施法特性生成为可预激活的独立快捷栏命令', () => {
    const [feature] = build({
      features: [{
        id: 'evocation-sculpt-spells',
        label: '法术塑形',
        description: '保护范围内的友方。',
        icon: dnd5eSpellActionIcon({ id: 'sculpt-spell', name: '法术塑形' }),
        modifier: 'evocation-sculpt-spells',
        resource: { label: '术法点', current: 3, maximum: 5 },
      }],
    }).filter((entry) => entry.id === 'feature:evocation-sculpt-spells')

    expect(feature).toMatchObject({
      sourceKind: 'feature',
      targeting: 'none',
      command: { kind: 'toggle-spell-modifier', modifier: 'evocation-sculpt-spells' },
      resource: { label: '术法点', current: 3, maximum: 5 },
      enabled: true,
    })
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
