import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Dnd5eActiveEffectDetailsDialog from './Dnd5eActiveEffectDetailsDialog'

describe('Dnd5eActiveEffectDetailsDialog', () => {
  it('offers an explicit end-concentration action for a virtual concentration instance', () => {
    const html = renderToStaticMarkup(
      <Dnd5eActiveEffectDetailsDialog
        targetName="新冒险者"
        effects={[]}
        instance={{
          id: 'concentration:wizard-token:invisibility',
          tokenId: 'wizard-token',
          kind: 'concentration',
          title: '专注：隐形术',
          description: '该角色正在维持专注。',
          statusId: 'invisibility',
          sourceActorId: 'wizard-token',
          sourceLabel: '新冒险者',
          authority: 'headless',
        }}
        onRemove={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('结束专注')
    expect(html).toContain('同步解除由该法术维持的状态、地图区域、法术实体与召唤物')
    expect(html).not.toContain('>移除状态<')
  })

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
    expect(html).toContain('全部结构化字段（只读）')
    expect(html).toContain('&quot;definitionId&quot;: &quot;condition:prone&quot;')
  })

  it('shows Comprehend Languages semantic fields and raw audited payload', () => {
    const html = renderToStaticMarkup(
      <Dnd5eActiveEffectDetailsDialog
        targetName="法师"
        effects={[{
          schemaVersion: 1,
          id: 'effect:comprehend-languages',
          definitionId: 'srd-5.1:spell:comprehend-languages',
          label: '通晓语言',
          kind: 'buff',
          source: { kind: 'spell', actorName: '法师', rulesId: 'comprehend-languages' },
          appliedAt: 1,
          duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
          stackingKey: 'spell:comprehend-languages:法师',
          stackingPolicy: 'refresh-duration',
          modifiers: {
            languageCapabilities: {
              understandSpoken: 'all',
              understandWritten: 'literal-written',
              writtenRequiresTouch: true,
              writtenMinutesPerPage: 1,
            },
          },
        }]}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('口语理解')
    expect(html).toContain('所有听见的口语之字面含义')
    expect(html).toContain('必须触碰书写表面')
    expect(html).toContain('每页约 1 分钟')
    expect(html).toContain('&quot;understandSpoken&quot;: &quot;all&quot;')
  })

  it('shows both Tongues speech directions and its raw audited payload', () => {
    const html = renderToStaticMarkup(
      <Dnd5eActiveEffectDetailsDialog
        targetName="牧师"
        effects={[{
          schemaVersion: 1,
          id: 'effect:tongues',
          definitionId: 'srd-5.1:spell:tongues',
          label: '巧言术',
          kind: 'buff',
          source: { kind: 'spell', actorName: '法师', rulesId: 'tongues' },
          appliedAt: 1,
          duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
          stackingKey: 'spell:tongues:法师',
          stackingPolicy: 'replace',
          modifiers: {
            languageCapabilities: {
              understandSpoken: 'all',
              speechUnderstoodBy: 'any-creature-knowing-a-language',
            },
          },
        }]}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('口语理解')
    expect(html).toContain('所有听见的口语之字面含义')
    expect(html).toContain('话语可理解')
    expect(html).toContain('任何会至少一种语言且能听见目标的生物都能理解目标所说的话')
    expect(html).toContain('&quot;speechUnderstoodBy&quot;: &quot;any-creature-knowing-a-language&quot;')
  })

  it('labels a Compulsion repeat save as occurring after movement', () => {
    const html = renderToStaticMarkup(
      <Dnd5eActiveEffectDetailsDialog
        targetName="猿"
        effects={[{
          schemaVersion: 1,
          id: 'effect:compulsion',
          definitionId: 'activity:compulsion:compulsion-target:extension',
          label: '强迫术·受强迫',
          kind: 'debuff',
          source: { kind: 'spell', actorName: '吟游诗人', rulesId: 'compulsion' },
          appliedAt: 1,
          duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
          repeatSave: { ability: 'wis', dc: 19, timing: 'after-movement', onSuccess: 'remove' },
          stackingKey: 'spell:compulsion:猿',
          stackingPolicy: 'replace',
          legacyCondition: 'directional-compulsion:compulsion',
        }]}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('移动后：感知 DC 19')
    expect(html).not.toContain('每个目标回合结束：感知 DC 19')
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
