import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Dnd5eActiveEffectDetailsDialog from './Dnd5eActiveEffectDetailsDialog'

describe('Dnd5eActiveEffectDetailsDialog', () => {
  it('shows the exact rule text for a virtual monster-trait Token instance', () => {
    const html = renderToStaticMarkup(
      <Dnd5eActiveEffectDetailsDialog
        targetName="血肉魔像"
        effects={[]}
        instance={{
          id: 'monster-trait:golem:fire-averse:1',
          tokenId: 'golem',
          kind: 'monster-trait',
          title: '畏火',
          description: '受到火焰伤害后，攻击检定和属性检定具有劣势。',
          statusId: 'fire-averse',
          sourceLabel: '血肉魔像 · 畏火',
          authority: 'headless',
        }}
        onRemove={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('血肉魔像 · 畏火')
    expect(html).toContain('怪物特性')
    expect(html).toContain('Headless 权威规则')
    expect(html).toContain('受到火焰伤害后，攻击检定和属性检定具有劣势。')
    expect(html).toContain('monster-trait:golem:fire-averse:1')
    expect(html).toContain('移除状态')
    expect(html).toContain('不会停用 Headless 规则')
  })

  it('shows rule text together with the selected ActiveEffect instance', () => {
    const html = renderToStaticMarkup(
      <Dnd5eActiveEffectDetailsDialog
        targetName="目标"
        instance={{
          id: 'effect:prone:one',
          tokenId: 'target',
          kind: 'active-effect',
          title: '倒地',
          description: '只能爬行或起身；自身攻击具有劣势。',
          statusId: 'prone',
          activeEffectId: 'effect:prone:one',
          sourceLabel: '战士',
          authority: 'headless',
        }}
        effects={[{
          schemaVersion: 1,
          id: 'effect:prone:one',
          definitionId: 'condition:prone',
          label: '倒地',
          kind: 'condition',
          standardCondition: 'prone',
          source: { kind: 'feature', actorName: '战士', rulesId: 'trip' },
          appliedAt: 1,
          duration: { type: 'permanent' },
          stackingKey: 'condition:prone',
          stackingPolicy: 'replace',
        }]}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('只能爬行或起身；自身攻击具有劣势。')
    expect(html).toContain('独立实例')
    expect(html).toContain('战士')
  })

  it('explains that removing a runtime monster state ends only the current trigger instance', () => {
    const html = renderToStaticMarkup(
      <Dnd5eActiveEffectDetailsDialog
        targetName="血肉魔像"
        effects={[]}
        instance={{
          id: 'monster-state:golem:damage-aversion:fire',
          tokenId: 'golem',
          kind: 'monster-state',
          title: '畏火已触发',
          description: '攻击检定和属性检定具有劣势。',
          statusId: 'monster-damage-aversion',
          authority: 'headless',
        }}
        onRemove={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('怪物状态')
    expect(html).toContain('移除状态')
    expect(html).toContain('会结束当前触发的怪物运行状态')
    expect(html).toContain('固有特性仍会保留')
  })
})
