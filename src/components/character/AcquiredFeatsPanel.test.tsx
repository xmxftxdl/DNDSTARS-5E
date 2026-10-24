import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { Character } from '../../types/character'
import AcquiredFeatsPanel from './AcquiredFeatsPanel'

vi.mock('../../rulesets/dnd5e/plugins/pluginContentCatalog', () => ({
  dnd5ePluginFeatDefinition: (id: string) => id === 'test:feat'
    ? { name: '测试专长', summary: '简述', description: '已获得的专长说明' }
    : undefined,
}))

function render(featIds: string[] = []) {
  return renderToStaticMarkup(createElement(AcquiredFeatsPanel, {
    character: { dnd5eFeatIds: featIds } as Character,
  }))
}

it('shows only acquired feats with descriptions, without acquisition labels', () => {
  const html = render(['test:feat', 'srd5.1:grappler', 'test:feat'])
  expect(html).toContain('已获得的专长说明')
  expect(html).toContain('擒抱者')
  expect(html.match(/<article/g)).toHaveLength(2)
  expect(html).not.toContain('创建／升级')
  expect(render()).not.toContain('测试专长')
})

it('retains unknown feat IDs when their rules package is unavailable', () => {
  const html = render(['missing:feat'])
  expect(html).toContain('missing:feat')
  expect(html).toContain('对应规则包未加载')
})

it('shows an explicit empty state', () => {
  expect(render()).toContain('暂无已获得的专长')
})