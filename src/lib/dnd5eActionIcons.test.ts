import { describe, expect, it } from 'vitest'
import { DND5E_SRD_ITEM_TEMPLATES } from '../rulesets/dnd5e/items'
import { DND5E_SRD_SPELL_CATALOG } from '../rulesets/dnd5e/spellCatalog'
import { dnd5eItemActionIcon, dnd5eSpellActionIcon } from './dnd5eActionIcons'

describe('D&D 5e combat action icon registry', () => {
  it('为全部 SRD 5.1 法术生成稳定图标', () => {
    expect(DND5E_SRD_SPELL_CATALOG).toHaveLength(319)
    const specs = DND5E_SRD_SPELL_CATALOG.map((spell) => dnd5eSpellActionIcon(spell))
    expect(specs.every((spec) => spec.key.startsWith('spell:') && spec.runeIndex >= 0 && spec.runeIndex < 8)).toBe(true)
    expect(new Set(specs.map((spec) => spec.key)).size).toBe(319)
    expect(dnd5eSpellActionIcon(DND5E_SRD_SPELL_CATALOG[0])).toEqual(specs[0])
  })

  it('为全部核心物品模板生成稳定图标', () => {
    const specs = DND5E_SRD_ITEM_TEMPLATES.map((item) => dnd5eItemActionIcon(item))
    expect(specs).toHaveLength(DND5E_SRD_ITEM_TEMPLATES.length)
    expect(specs.every((spec) => spec.key.startsWith('item:') && spec.accent.startsWith('#'))).toBe(true)
    expect(new Set(specs.map((spec) => spec.key)).size).toBe(DND5E_SRD_ITEM_TEMPLATES.length)
  })

  it('优先按伤害与用途选择视觉母题', () => {
    expect(dnd5eSpellActionIcon({ id: 'fireball', name: '火球术', damageType: 'fire' }).motif).toBe('fire')
    expect(dnd5eSpellActionIcon({ id: 'cure-wounds', name: '疗伤术' }).motif).toBe('healing')
    expect(dnd5eItemActionIcon({
      id: 'test-healing-potion', name: '测试治疗药水', category: 'consumable', icon: 'healing-potion',
      use: { economy: 'action', consumeQuantity: 1, effect: { kind: 'healing', dice: { count: 2, sides: 4, bonus: 2 } } },
    }).motif).toBe('healing')
  })

  it('让传讯术使用施法职业背景和专属透明前景', () => {
    const wizard = dnd5eSpellActionIcon({ id: 'message', name: '传讯术', castingClassId: 'wizard' })
    const bard = dnd5eSpellActionIcon({ id: 'message', name: '传讯术', castingClassId: 'bard' })
    expect(wizard).toMatchObject({
      background: '#3B82F6',
      asset: '/assets/icons/message-spell-action.png',
      assetMode: 'foreground',
      classBackdropId: 'wizard',
    })
    expect(bard.background).toBe('#D946EF')
    expect(bard.background).not.toBe(wizard.background)
  })

  it('为首批五个戏法绑定透明绘制前景', () => {
    const expected = {
      'minor-illusion': '/assets/icons/minor-illusion-spell-action.png',
      druidcraft: '/assets/icons/druidcraft-spell-action.png',
      'shocking-grasp': '/assets/icons/shocking-grasp-spell-action.png',
      'chill-touch': '/assets/icons/chill-touch-spell-action.png',
      'poison-spray': '/assets/icons/poison-spray-spell-action.png',
      fireball: '/assets/icons/fireball-spell-action.png',
      'wall-of-fire': '/assets/icons/wall-of-fire-spell-action.png',
      'fire-bolt': '/assets/icons/fire-bolt-spell-action.png',
      light: '/assets/icons/light-spell-action.png',
      'burning-hands': '/assets/icons/burning-hands-spell-action.png',
      shatter: '/assets/icons/shatter-spell-action.png',
      'true-strike': '/assets/icons/true-strike-spell-action.png',
      'ray-of-frost': '/assets/icons/ray-of-frost-spell-action.png',
      prestidigitation: '/assets/icons/prestidigitation-spell-action.png',
      'eldritch-blast': '/assets/icons/eldritch-blast-spell-action.png',
      thaumaturgy: '/assets/icons/thaumaturgy-spell-action.png',
      'produce-flame': '/assets/icons/produce-flame-spell-action.png',
      guidance: '/assets/icons/guidance-spell-action.png',
      'sacred-flame': '/assets/icons/sacred-flame-spell-action.png',
      'acid-splash': '/assets/icons/acid-splash-spell-action.png',
      resistance: '/assets/icons/resistance-spell-action.png',
      'spare-the-dying': '/assets/icons/spare-the-dying-spell-action.png',
    }
    for (const [id, asset] of Object.entries(expected)) {
      expect(dnd5eSpellActionIcon({ id, name: id, castingClassId: 'wizard' })).toMatchObject({
        asset,
        assetMode: 'foreground',
        classBackdropId: 'wizard',
      })
    }
  })
})
