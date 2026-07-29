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

  it('为全部戏法提供专属绘制缩略图', () => {
    expect(DND5E_SRD_SPELL_CATALOG).toHaveLength(319)
    for (const spell of DND5E_SRD_SPELL_CATALOG) {
      expect(dnd5eSpellActionIcon(spell).asset).toBe(`/assets/icons/${spell.id}-spell-action.png`)
    }
  })

  it('为全部核心物品模板生成稳定图标', () => {
    const specs = DND5E_SRD_ITEM_TEMPLATES.map((item) => dnd5eItemActionIcon(item))
    expect(specs).toHaveLength(DND5E_SRD_ITEM_TEMPLATES.length)
    expect(specs.every((spec) => spec.key.startsWith('item:') && spec.accent.startsWith('#'))).toBe(true)
    expect(new Set(specs.map((spec) => spec.key)).size).toBe(DND5E_SRD_ITEM_TEMPLATES.length)
  })

  it('为绘制魔法物品绑定前景资源与稀有度背景', () => {
    const adamantineArmor = DND5E_SRD_ITEM_TEMPLATES.find((item) => item.id === 'srd-5.1:magic-item:adamantine-armor')
    const amuletOfHealth = DND5E_SRD_ITEM_TEMPLATES.find((item) => item.id === 'srd-5.1:magic-item:amulet-of-health')
    expect(adamantineArmor).toBeDefined()
    expect(amuletOfHealth).toBeDefined()
    expect(dnd5eItemActionIcon(adamantineArmor!)).toMatchObject({
      asset: '/assets/icons/adamantine-armor-item-action.png',
      assetMode: 'foreground',
      rarityBackdropId: 'uncommon',
      background: '#237A4A',
    })
    expect(dnd5eItemActionIcon(amuletOfHealth!)).toMatchObject({
      asset: '/assets/icons/amulet-of-health-item-action.png',
      rarityBackdropId: 'rare',
      background: '#2563A8',
    })
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
      'mage-hand': '/assets/icons/mage-hand-spell-action.png',
      thaumaturgy: '/assets/icons/thaumaturgy-spell-action.png',
      'produce-flame': '/assets/icons/produce-flame-spell-action.png',
      guidance: '/assets/icons/guidance-spell-action.png',
      'sacred-flame': '/assets/icons/sacred-flame-spell-action.png',
      'acid-splash': '/assets/icons/acid-splash-spell-action.png',
      resistance: '/assets/icons/resistance-spell-action.png',
      'spare-the-dying': '/assets/icons/spare-the-dying-spell-action.png',
      'dancing-lights': '/assets/icons/dancing-lights-spell-action.png',
      shillelagh: '/assets/icons/shillelagh-spell-action.png',
      mending: '/assets/icons/mending-spell-action.png',
      'vicious-mockery': '/assets/icons/vicious-mockery-spell-action.png',
      sanctuary: '/assets/icons/sanctuary-spell-action.png',
      longstrider: '/assets/icons/longstrider-spell-action.png',
      'speak-with-animals': '/assets/icons/speak-with-animals-spell-action.png',
      'mage-armor': '/assets/icons/mage-armor-spell-action.png',
      'protection-from-evil-and-good': '/assets/icons/protection-from-evil-and-good-spell-action.png',
      'floating-disk': '/assets/icons/floating-disk-spell-action.png',
      shield: '/assets/icons/shield-spell-action.png',
      'animal-friendship': '/assets/icons/animal-friendship-spell-action.png',
      'find-familiar': '/assets/icons/find-familiar-spell-action.png',
      identify: '/assets/icons/identify-spell-action.png',
      'expeditious-retreat': '/assets/icons/expeditious-retreat-spell-action.png',
      alarm: '/assets/icons/alarm-spell-action.png',
      'purify-food-and-drink': '/assets/icons/purify-food-and-drink-spell-action.png',
      entangle: '/assets/icons/entangle-spell-action.png',
      'hideous-laughter': '/assets/icons/hideous-laughter-spell-action.png',
      thunderwave: '/assets/icons/thunderwave-spell-action.png',
      'hellish-rebuke': '/assets/icons/hellish-rebuke-spell-action.png',
      'cure-wounds': '/assets/icons/cure-wounds-spell-action.png',
      'hunters-mark': '/assets/icons/hunters-mark-spell-action.png',
      'charm-person': '/assets/icons/charm-person-spell-action.png',
      'illusory-script': '/assets/icons/illusory-script-spell-action.png',
      command: '/assets/icons/command-spell-action.png',
      'magic-missile': '/assets/icons/magic-missile-spell-action.png',
      'color-spray': '/assets/icons/color-spray-spell-action.png',
      'shield-of-faith': '/assets/icons/shield-of-faith-spell-action.png',
      'divine-favor': '/assets/icons/divine-favor-spell-action.png',
      goodberry: '/assets/icons/goodberry-spell-action.png',
      sleep: '/assets/icons/sleep-spell-action.png',
      jump: '/assets/icons/jump-spell-action.png',
      'comprehend-languages': '/assets/icons/comprehend-languages-spell-action.png',
      'silent-image': '/assets/icons/silent-image-spell-action.png',
      'false-life': '/assets/icons/false-life-spell-action.png',
      'faerie-fire': '/assets/icons/faerie-fire-spell-action.png',
      'guiding-bolt': '/assets/icons/guiding-bolt-spell-action.png',
      'disguise-self': '/assets/icons/disguise-self-spell-action.png',
      'unseen-servant': '/assets/icons/unseen-servant-spell-action.png',
      heroism: '/assets/icons/heroism-spell-action.png',
      grease: '/assets/icons/grease-spell-action.png',
      'feather-fall': '/assets/icons/feather-fall-spell-action.png',
      'fog-cloud': '/assets/icons/fog-cloud-spell-action.png',
      bane: '/assets/icons/bane-spell-action.png',
      'create-or-destroy-water': '/assets/icons/create-or-destroy-water-spell-action.png',
      'detect-poison-and-disease': '/assets/icons/detect-poison-and-disease-spell-action.png',
      'detect-magic': '/assets/icons/detect-magic-spell-action.png',
      'detect-evil-and-good': '/assets/icons/detect-evil-and-good-spell-action.png',
      'healing-word': '/assets/icons/healing-word-spell-action.png',
      'inflict-wounds': '/assets/icons/inflict-wounds-spell-action.png',
      bless: '/assets/icons/bless-spell-action.png',
      'calm-emotions': '/assets/icons/calm-emotions-spell-action.png',
      suggestion: '/assets/icons/suggestion-spell-action.png',
      'arcanists-magic-aura': '/assets/icons/arcanists-magic-aura-spell-action.png',
      'enlarge-reduce': '/assets/icons/enlarge-reduce-spell-action.png',
      'alter-self': '/assets/icons/alter-self-spell-action.png',
      augury: '/assets/icons/augury-spell-action.png',
      'continual-flame': '/assets/icons/continual-flame-spell-action.png',
      silence: '/assets/icons/silence-spell-action.png',
      'zone-of-truth': '/assets/icons/zone-of-truth-spell-action.png',
      'flaming-sphere': '/assets/icons/flaming-sphere-spell-action.png',
      'lesser-restoration': '/assets/icons/lesser-restoration-spell-action.png',
      'animal-messenger': '/assets/icons/animal-messenger-spell-action.png',
      'locate-animals-or-plants': '/assets/icons/locate-animals-or-plants-spell-action.png',
      'protection-from-poison': '/assets/icons/protection-from-poison-spell-action.png',
      'flame-blade': '/assets/icons/flame-blade-spell-action.png',
      'spike-growth': '/assets/icons/spike-growth-spell-action.png',
      'mirror-image': '/assets/icons/mirror-image-spell-action.png',
      'spiritual-weapon': '/assets/icons/spiritual-weapon-spell-action.png',
      'misty-step': '/assets/icons/misty-step-spell-action.png',
      'arcane-lock': '/assets/icons/arcane-lock-spell-action.png',
      'magic-weapon': '/assets/icons/magic-weapon-spell-action.png',
      'rope-trick': '/assets/icons/rope-trick-spell-action.png',
      'magic-mouth': '/assets/icons/magic-mouth-spell-action.png',
      'blindness-deafness': '/assets/icons/blindness-deafness-spell-action.png',
      'enhance-ability': '/assets/icons/enhance-ability-spell-action.png',
      'acid-arrow': '/assets/icons/acid-arrow-spell-action.png',
      'hold-person': '/assets/icons/hold-person-spell-action.png',
      'see-invisibility': '/assets/icons/see-invisibility-spell-action.png',
      'warding-bond': '/assets/icons/warding-bond-spell-action.png',
      'ray-of-enfeeblement': '/assets/icons/ray-of-enfeeblement-spell-action.png',
      'locate-object': '/assets/icons/locate-object-spell-action.png',
      'pass-without-trace': '/assets/icons/pass-without-trace-spell-action.png',
      'find-traps': '/assets/icons/find-traps-spell-action.png',
      'gentle-repose': '/assets/icons/gentle-repose-spell-action.png',
      'branding-smite': '/assets/icons/branding-smite-spell-action.png',
      'gust-of-wind': '/assets/icons/gust-of-wind-spell-action.png',
      'find-steed': '/assets/icons/find-steed-spell-action.png',
      'detect-thoughts': '/assets/icons/detect-thoughts-spell-action.png',
      'prayer-of-healing': '/assets/icons/prayer-of-healing-spell-action.png',
      web: '/assets/icons/web-spell-action.png',
      'spider-climb': '/assets/icons/spider-climb-spell-action.png',
      enthrall: '/assets/icons/enthrall-spell-action.png',
      'heat-metal': '/assets/icons/heat-metal-spell-action.png',
      'scorching-ray': '/assets/icons/scorching-ray-spell-action.png',
      levitate: '/assets/icons/levitate-spell-action.png',
      darkvision: '/assets/icons/darkvision-spell-action.png',
      darkness: '/assets/icons/darkness-spell-action.png',
      blur: '/assets/icons/blur-spell-action.png',
      knock: '/assets/icons/knock-spell-action.png',
      barkskin: '/assets/icons/barkskin-spell-action.png',
      invisibility: '/assets/icons/invisibility-spell-action.png',
      aid: '/assets/icons/aid-spell-action.png',
      moonbeam: '/assets/icons/moonbeam-spell-action.png',
      'animate-dead': '/assets/icons/animate-dead-spell-action.png',
      'stinking-cloud': '/assets/icons/stinking-cloud-spell-action.png',
      'hypnotic-pattern': '/assets/icons/hypnotic-pattern-spell-action.png',
      'beacon-of-hope': '/assets/icons/beacon-of-hope-spell-action.png',
      'bestow-curse': '/assets/icons/bestow-curse-spell-action.png',
      blink: '/assets/icons/blink-spell-action.png',
      'call-lightning': '/assets/icons/call-lightning-spell-action.png',
      clairvoyance: '/assets/icons/clairvoyance-spell-action.png',
      'conjure-animals': '/assets/icons/conjure-animals-spell-action.png',
      counterspell: '/assets/icons/counterspell-spell-action.png',
      'create-food-and-water': '/assets/icons/create-food-and-water-spell-action.png',
      daylight: '/assets/icons/daylight-spell-action.png',
      'dispel-magic': '/assets/icons/dispel-magic-spell-action.png',
      fear: '/assets/icons/fear-spell-action.png',
      fly: '/assets/icons/fly-spell-action.png',
      'gaseous-form': '/assets/icons/gaseous-form-spell-action.png',
      'glyph-of-warding': '/assets/icons/glyph-of-warding-spell-action.png',
      haste: '/assets/icons/haste-spell-action.png',
      'lightning-bolt': '/assets/icons/lightning-bolt-spell-action.png',
      'magic-circle': '/assets/icons/magic-circle-spell-action.png',
      'major-image': '/assets/icons/major-image-spell-action.png',
      'mass-healing-word': '/assets/icons/mass-healing-word-spell-action.png',
      'meld-into-stone': '/assets/icons/meld-into-stone-spell-action.png',
      nondetection: '/assets/icons/nondetection-spell-action.png',
      'phantom-steed': '/assets/icons/phantom-steed-spell-action.png',
      'plant-growth': '/assets/icons/plant-growth-spell-action.png',
      'protection-from-energy': '/assets/icons/protection-from-energy-spell-action.png',
      'remove-curse': '/assets/icons/remove-curse-spell-action.png',
      revivify: '/assets/icons/revivify-spell-action.png',
      sending: '/assets/icons/sending-spell-action.png',
      'sleet-storm': '/assets/icons/sleet-storm-spell-action.png',
      slow: '/assets/icons/slow-spell-action.png',
      'speak-with-dead': '/assets/icons/speak-with-dead-spell-action.png',
      'speak-with-plants': '/assets/icons/speak-with-plants-spell-action.png',
      'spirit-guardians': '/assets/icons/spirit-guardians-spell-action.png',
      'tiny-hut': '/assets/icons/tiny-hut-spell-action.png',
      tongues: '/assets/icons/tongues-spell-action.png',
      'vampiric-touch': '/assets/icons/vampiric-touch-spell-action.png',
      'water-breathing': '/assets/icons/water-breathing-spell-action.png',
      'water-walk': '/assets/icons/water-walk-spell-action.png',
      'wind-wall': '/assets/icons/wind-wall-spell-action.png',
      'arcane-eye': '/assets/icons/arcane-eye-spell-action.png',
      banishment: '/assets/icons/banishment-spell-action.png',
      'black-tentacles': '/assets/icons/black-tentacles-spell-action.png',
      blight: '/assets/icons/blight-spell-action.png',
      compulsion: '/assets/icons/compulsion-spell-action.png',
      confusion: '/assets/icons/confusion-spell-action.png',
      'conjure-minor-elementals': '/assets/icons/conjure-minor-elementals-spell-action.png',
      'conjure-woodland-beings': '/assets/icons/conjure-woodland-beings-spell-action.png',
      'control-water': '/assets/icons/control-water-spell-action.png',
      'death-ward': '/assets/icons/death-ward-spell-action.png',
      'dimension-door': '/assets/icons/dimension-door-spell-action.png',
      divination: '/assets/icons/divination-spell-action.png',
      'dominate-beast': '/assets/icons/dominate-beast-spell-action.png',
      fabricate: '/assets/icons/fabricate-spell-action.png',
    }
    for (const [id, asset] of Object.entries(expected)) {
      expect(dnd5eSpellActionIcon({ id, name: id, castingClassId: 'wizard' })).toMatchObject({
        asset,
        assetMode: 'foreground',
        classBackdropId: 'wizard',
      })
    }
  })

  it('为九种独立的强化护甲绑定各自图标和稀有度背景', () => {
    const cases = [
      ['armor-chain-mail-plus-1', 'armor-chain-mail-plus-1-item-action.png', 'rare', '#2563A8'],
      ['armor-chain-mail-plus-2', 'armor-chain-mail-plus-2-item-action.png', 'very-rare', '#7138A8'],
      ['armor-chain-mail-plus-3', 'armor-chain-mail-plus-3-item-action.png', 'legendary', '#B86A12'],
      ['armor-scale-mail-plus-1', 'armor-scale-mail-plus-1-item-action.png', 'rare', '#2563A8'],
      ['armor-scale-mail-plus-2', 'armor-scale-mail-plus-2-item-action.png', 'very-rare', '#7138A8'],
      ['armor-scale-mail-plus-3', 'armor-scale-mail-plus-3-item-action.png', 'legendary', '#B86A12'],
      ['armor-leather-armor-plus-1', 'armor-leather-armor-plus-1-item-action.png', 'rare', '#2563A8'],
      ['armor-leather-armor-plus-2', 'armor-leather-armor-plus-2-item-action.png', 'very-rare', '#7138A8'],
      ['armor-leather-armor-plus-3', 'armor-leather-armor-plus-3-item-action.png', 'legendary', '#B86A12'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('为下一组魔法护甲与盾牌绑定独立绘制图标', () => {
    const cases = [
      ['armor-of-invulnerability', 'armor-of-invulnerability-item-action.png', 'legendary', '#B86A12'],
      ['armor-of-resistance', 'armor-of-resistance-item-action.png', 'rare', '#2563A8'],
      ['armor-of-vulnerability', 'armor-of-vulnerability-item-action.png', 'rare', '#2563A8'],
      ['arrow-catching-shield', 'arrow-catching-shield-item-action.png', 'rare', '#2563A8'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('为屠戮之箭与三种魔法袋绑定独立绘制图标', () => {
    const cases = [
      ['arrow-of-slaying', 'arrow-of-slaying-item-action.png', 'very-rare', '#7138A8'],
      ['bag-of-beans', 'bag-of-beans-item-action.png', 'rare', '#2563A8'],
      ['bag-of-devouring', 'bag-of-devouring-item-action.png', 'very-rare', '#7138A8'],
      ['bag-of-holding', 'bag-of-holding-item-action.png', 'uncommon', '#237A4A'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('为戏法袋、力场珠与两种魔法腰带绑定独立绘制图标', () => {
    const cases = [
      ['bag-of-tricks', 'bag-of-tricks-item-action.png', 'uncommon', '#237A4A'],
      ['bead-of-force', 'bead-of-force-item-action.png', 'rare', '#2563A8'],
      ['belt-of-dwarvenkind', 'belt-of-dwarvenkind-item-action.png', 'rare', '#2563A8'],
      ['belt-of-giant-strength', 'belt-of-giant-strength-item-action.png', 'varies', '#326C8C'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('为狂战斧与三种魔法靴绑定独立绘制图标', () => {
    const cases = [
      ['berserker-axe', 'berserker-axe-item-action.png', 'rare', '#2563A8'],
      ['boots-of-elvenkind', 'boots-of-elvenkind-item-action.png', 'uncommon', '#237A4A'],
      ['boots-of-levitation', 'boots-of-levitation-item-action.png', 'rare', '#2563A8'],
      ['boots-of-speed', 'boots-of-speed-item-action.png', 'rare', '#2563A8'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('为奔跃靴、冬境靴、控水碗与箭术护腕绑定独立绘制图标', () => {
    const cases = [
      ['boots-of-striding-and-springing', 'boots-of-striding-and-springing-item-action.png', 'uncommon', '#237A4A'],
      ['boots-of-the-winterlands', 'boots-of-the-winterlands-item-action.png', 'uncommon', '#237A4A'],
      ['bowl-of-commanding-water-elementals', 'bowl-of-commanding-water-elementals-item-action.png', 'rare', '#2563A8'],
      ['bracers-of-archery', 'bracers-of-archery-item-action.png', 'uncommon', '#237A4A'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('为防御护腕、控火火盆、屏障胸针与飞行扫帚绑定独立绘制图标', () => {
    const cases = [
      ['bracers-of-defense', 'bracers-of-defense-item-action.png', 'rare', '#2563A8'],
      ['brazier-of-commanding-fire-elementals', 'brazier-of-commanding-fire-elementals-item-action.png', 'rare', '#2563A8'],
      ['brooch-of-shielding', 'brooch-of-shielding-item-action.png', 'uncommon', '#237A4A'],
      ['broom-of-flying', 'broom-of-flying-item-action.png', 'uncommon', '#237A4A'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('binds painted icons for the next four magic items', () => {
    const cases = [
      ['candle-of-invocation', 'candle-of-invocation-item-action.png', 'very-rare', '#7138A8'],
      ['cape-of-the-mountebank', 'cape-of-the-mountebank-item-action.png', 'rare', '#2563A8'],
      ['carpet-of-flying', 'carpet-of-flying-item-action.png', 'very-rare', '#7138A8'],
      ['censer-of-controlling-air-elementals', 'censer-of-controlling-air-elementals-item-action.png', 'rare', '#2563A8'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('binds painted icons for the chime, circlet, and magical cloaks', () => {
    const cases = [
      ['chime-of-opening', 'chime-of-opening-item-action.png', 'rare', '#2563A8'],
      ['circlet-of-blasting', 'circlet-of-blasting-item-action.png', 'uncommon', '#237A4A'],
      ['cloak-of-arachnida', 'cloak-of-arachnida-item-action.png', 'very-rare', '#7138A8'],
      ['cloak-of-displacement', 'cloak-of-displacement-item-action.png', 'rare', '#2563A8'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('binds painted icons for the next four magical cloaks', () => {
    const cases = [
      ['cloak-of-elvenkind', 'cloak-of-elvenkind-item-action.png', 'uncommon', '#237A4A'],
      ['cloak-of-protection', 'cloak-of-protection-item-action.png', 'uncommon', '#237A4A'],
      ['cloak-of-the-bat', 'cloak-of-the-bat-item-action.png', 'rare', '#2563A8'],
      ['cloak-of-the-manta-ray', 'cloak-of-the-manta-ray-item-action.png', 'uncommon', '#237A4A'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('binds painted icons for the crystal ball, magical cubes, and venom dagger', () => {
    const cases = [
      ['crystal-ball', 'crystal-ball-item-action.png', 'very-rare', '#7138A8'],
      ['cube-of-force', 'cube-of-force-item-action.png', 'rare', '#2563A8'],
      ['cubic-gate', 'cubic-gate-item-action.png', 'legendary', '#B86A12'],
      ['dagger-of-venom', 'dagger-of-venom-item-action.png', 'rare', '#2563A8'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('binds painted icons for the dancing sword, endless water, and magical decks', () => {
    const cases = [
      ['dancing-sword', 'dancing-sword-item-action.png', 'very-rare', '#7138A8'],
      ['decanter-of-endless-water', 'decanter-of-endless-water-item-action.png', 'uncommon', '#237A4A'],
      ['deck-of-illusions', 'deck-of-illusions-item-action.png', 'uncommon', '#237A4A'],
      ['deck-of-many-things', 'deck-of-many-things-item-action.png', 'legendary', '#B86A12'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('binds painted icons for the defender, demon armor, shackles, and dragon mail', () => {
    const cases = [
      ['defender', 'defender-item-action.png', 'legendary', '#B86A12'],
      ['demon-armor', 'demon-armor-item-action.png', 'very-rare', '#7138A8'],
      ['dimensional-shackles', 'dimensional-shackles-item-action.png', 'rare', '#2563A8'],
      ['dragon-scale-mail', 'dragon-scale-mail-item-action.png', 'very-rare', '#7138A8'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('binds painted icons for the dragon slayer and three magical dusts', () => {
    const cases = [
      ['dragon-slayer', 'dragon-slayer-item-action.png', 'rare', '#2563A8'],
      ['dust-of-disappearance', 'dust-of-disappearance-item-action.png', 'uncommon', '#237A4A'],
      ['dust-of-dryness', 'dust-of-dryness-item-action.png', 'uncommon', '#237A4A'],
      ['dust-of-sneezing-and-choking', 'dust-of-sneezing-and-choking-item-action.png', 'uncommon', '#237A4A'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('binds painted icons for the dwarven gear, efficient quiver, and efreeti bottle', () => {
    const cases = [
      ['dwarven-plate', 'dwarven-plate-item-action.png', 'very-rare', '#7138A8'],
      ['dwarven-thrower', 'dwarven-thrower-item-action.png', 'very-rare', '#7138A8'],
      ['efficient-quiver', 'efficient-quiver-item-action.png', 'uncommon', '#237A4A'],
      ['efreeti-bottle', 'efreeti-bottle-item-action.png', 'very-rare', '#7138A8'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === `srd-5.1:magic-item:${id}`)
      expect(item).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })
})
