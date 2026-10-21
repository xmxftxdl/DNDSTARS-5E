import { describe, expect, it } from 'vitest'
import { activeRulesExtensionNames } from './activeRulesExtensionNames'

describe('active extension name inventory', () => {
  it('groups by owner and category, with unique trimmed names and stable category order', () => {
    const groups = activeRulesExtensionNames([
      { category: 'spell', id: 's', ownerPluginId: 'one', name: ' 火焰 ' },
      { category: 'spell', id: 'duplicate', ownerPluginId: 'one', name: '火焰' },
      { category: 'race', id: 'r', ownerPluginId: 'one', name: '精灵' },
      { category: 'feature', id: 'f', ownerPluginId: 'two', name: '隐匿' },
      { category: 'item', id: 'empty', ownerPluginId: 'one', name: ' ' },
    ])
    expect(groups.get('one')).toEqual([
      { label: '种族', names: ['精灵'] }, { label: '法术', names: ['火焰'] },
    ])
    expect(groups.get('two')).toEqual([{ label: '特性', names: ['隐匿'] }])
    expect(groups.get('absent')).toBeUndefined()
  })
})
