import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Dnd5eMapObjectDetailPanel from './Dnd5eMapObjectDetailPanel'

describe('Dnd5eMapObjectDetailPanel', () => {
  it('让 DM 从地图 UI 看见食物种类与全部污染状态', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel, {
      token: {
        id: 'object', label: '污染餐桌', x: 100, y: 100, color: '#94a3b8', emoji: '🪨',
        size: 2, type: 'obstacle',
        dnd5eObjectState: {
          schemaVersion: 1,
          consumable: { kind: 'food', contaminants: ['poison', 'disease'] },
        },
      },
      onUpdate: () => undefined,
      onDelete: () => undefined,
      onClose: () => undefined,
    }))

    expect(html).toContain('地图物件用途')
    expect(html).toContain('地图物件体型')
    expect(html).toContain('大型（2×2 格）')
    expect(html).toContain('非魔法食物')
    expect(html).toContain('毒素污染')
    expect(html).toContain('疾病污染')
    expect(html).toContain('当前：毒素、疾病')
    expect(html).toContain('物件耐久与法术属性')
    expect(html).toContain('地图物件当前耐久')
    expect(html).toContain('地图物件最大耐久')
    expect(html).toContain('魔法物件（不受粉碎音波的物件伤害）')
    expect(html).toContain('被穿戴或携带（不属于无人持有物件）')
  })

  it('让 DM 把地图物件标记为操纵死尸可识别的遗骸', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel, {
      token: {
        id: 'bones', label: '骨骸堆', x: 100, y: 100, color: '#94a3b8', emoji: '🦴',
        size: 1, type: 'obstacle',
        dnd5eObjectState: { schemaVersion: 1, remains: { kind: 'bone-pile' } },
      },
      onUpdate: () => undefined,
      onDelete: () => undefined,
      onClose: () => undefined,
    }))
    expect(html).toContain('骨骸堆（操纵死尸 → 骷髅）')
    expect(html).toContain('操纵死尸遗骸目标')
    expect(html).toContain('在原格生成一具骷髅')
  })

  it('显示造物术材质、升环尺寸、持续时间与材料禁用规则', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel, {
      token: {
        id: 'created', label: '宝石镶嵌木箱', x: 100, y: 100, color: '#a78bfa', emoji: '📦',
        size: 5, type: 'obstacle',
        dnd5eObjectState: {
          schemaVersion: 1,
          creation: {
            schemaVersion: 1,
            sourceTokenId: 'caster-token', sourceCharacterId: 'caster', sourceActionId: 'cast-1',
            slotLevel: 9, objectDescription: '宝石镶嵌木箱', materials: ['plant', 'gemstone'],
            edgeFeet: 25, createdWorldMinute: 100, expiresAtWorldMinute: 110,
            cannotBeSpellMaterial: true,
          },
        },
      },
      onUpdate: () => undefined,
      onDelete: () => undefined,
      onClose: () => undefined,
    }))
    expect(html).toContain('造物术制造物')
    expect(html).toContain('9 环 · 立方边长：25 尺')
    expect(html).toContain('植物材料、宝石')
    expect(html).toContain('持续：10 分钟')
    expect(html).toContain('不能作为其他法术的材料成分')
    expect(html).toContain('5×5 格')
  })

  it('让 DM 在地图物件详情中配置造水／枯水术的敞开容器和水量', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eMapObjectDetailPanel, {
      token: {
        id: 'cistern', label: '敞口蓄水池', x: 100, y: 100, color: '#22d3ee', emoji: '🪣',
        size: 2, type: 'obstacle',
        dnd5eObjectState: {
          schemaVersion: 1,
          consumable: { kind: 'drink', contaminants: [] },
          waterContainer: { schemaVersion: 1, open: true, capacityGallons: 50, waterGallons: 20 },
        },
      },
      onUpdate: () => undefined,
      onDelete: () => undefined,
      onClose: () => undefined,
    }))
    expect(html).toContain('储水容器')
    expect(html).toContain('储水容器敞开')
    expect(html).toContain('储水容器容量（加仑）')
    expect(html).toContain('储水容器当前水量（加仑）')
    expect(html).toContain('当前：20/50 加仑 · 敞开')
  })
})
