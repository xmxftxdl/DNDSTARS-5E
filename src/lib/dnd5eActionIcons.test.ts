import { describe, expect, it } from 'vitest'
import { DND5E_SRD_ITEM_TEMPLATES } from '../rulesets/dnd5e/items'
import { DND5E_SRD_SPELL_CATALOG } from '../rulesets/dnd5e/spellCatalog'
import { DND5E_SRD_CLASS_DEFINITIONS } from '../rulesets/dnd5e/classes'
import { fighterProgression } from '../rulesets/dnd5e/fighter'
import { registerDnd5ePluginImageAsset } from '../rulesets/dnd5e/pluginAssets'
import {
  DND5E_CLASS_ICON_PALETTES,
  dnd5eClassFeatureActionIcon,
  dnd5eInventorySemanticIcon,
  dnd5eItemActionIcon,
  dnd5eSpellActionIcon,
} from './dnd5eActionIcons'

describe('D&D 5e combat action icon registry', () => {
  it('keeps the canonical class presentation colors stable', () => {
    expect(Object.fromEntries(Object.entries(DND5E_CLASS_ICON_PALETTES)
      .filter(([classId]) => classId !== 'monster')
      .map(([classId, palette]) => [classId, palette[0]])))
      .toEqual({
        barbarian: '#E5484D',
        bard: '#D946EF',
        cleric: '#FBBF24',
        druid: '#22C55E',
        fighter: '#94A3B8',
        monk: '#F97316',
        paladin: '#BAE6FD',
        ranger: '#65A30D',
        rogue: '#475569',
        sorcerer: '#FB7185',
        warlock: '#8B5CF6',
        wizard: '#3B82F6',
      })
    expect(DND5E_CLASS_ICON_PALETTES.monster[3]).toBe('#EF4444')
  })

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

  it('classifies every core weapon and armor into a concrete semantic SVG family', () => {
    const equipment = DND5E_SRD_ITEM_TEMPLATES.filter((item) =>
      item.id.startsWith('srd-5.1:equipment:'),
    )
    const semanticIcons = equipment.map((item) => dnd5eInventorySemanticIcon(item))

    expect(semanticIcons).not.toContain('generic')
    expect(new Set(semanticIcons)).toEqual(new Set([
      'sword', 'dagger', 'club', 'staff', 'hammer', 'sickle', 'spear', 'polearm',
      'trident', 'flail', 'bow', 'crossbow', 'sling', 'dart', 'whip', 'blowgun',
      'net', 'axe', 'shield', 'light-armor', 'medium-armor', 'heavy-armor',
    ]))
  })

  it('classifies common room-content tools, containers, books, transport, and games', () => {
    const semantic = (id: string, name: string, category: 'adventuring-gear' | 'container' | 'tool') =>
      dnd5eInventorySemanticIcon({ id, name, category, icon: 'generic' })

    expect(semantic('alchemists-supplies', '炼金工具', 'tool')).toBe('tool')
    expect(semantic('barrel', '木桶', 'container')).toBe('container')
    expect(semantic('book', '书籍', 'adventuring-gear')).toBe('book')
    expect(semantic('lute', '鲁特琴', 'tool')).toBe('instrument')
    expect(semantic('warhorse-mount', '战马（坐骑）', 'adventuring-gear')).toBe('mount')
    expect(semantic('wagon', '篷车', 'adventuring-gear')).toBe('vehicle')
    expect(semantic('sailing-ship', '帆船', 'adventuring-gear')).toBe('ship')
    expect(semantic('dragonchess-set', '龙棋套组', 'tool')).toBe('gaming-set')
    expect(semantic('cartographers-tools', '制图工具', 'tool')).toBe('tool')
  })

  it('保留旧原画资源但让内置魔法物品优先使用语义图标与稀有度背景', () => {
    const adamantineArmor = DND5E_SRD_ITEM_TEMPLATES.find((item) => item.id === 'srd-5.1:magic-item:adamantine-armor')
    const amuletOfHealth = DND5E_SRD_ITEM_TEMPLATES.find((item) => item.id === 'srd-5.1:magic-item:amulet-of-health')
    expect(adamantineArmor).toBeDefined()
    expect(amuletOfHealth).toBeDefined()
    expect(dnd5eItemActionIcon(adamantineArmor!)).toMatchObject({
      asset: '/assets/icons/adamantine-armor-item-action.png',
      assetMode: 'foreground',
      inventoryIconId: 'armor',
      preferSemanticGlyph: true,
      rarityBackdropId: 'uncommon',
      background: '#237A4A',
    })
    expect(dnd5eItemActionIcon(amuletOfHealth!)).toMatchObject({
      asset: '/assets/icons/amulet-of-health-item-action.png',
      inventoryIconId: 'magic-wondrous',
      preferSemanticGlyph: true,
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

  it('为所有内置职业与子职特性绑定职业模板和绘制前景', () => {
    const nonFighter = DND5E_SRD_CLASS_DEFINITIONS
      .filter((definition) => definition.id !== 'fighter')
      .flatMap((definition) => [...definition.features, ...definition.subclass.features]
        .map((feature) => ({ definition, feature })))
    const fighter = fighterProgression('champion').flatMap((entry) => entry.features.map((feature) => ({
      definition: { id: 'fighter' },
      feature,
    })))

    for (const { definition, feature } of [...nonFighter, ...fighter]) {
      expect(dnd5eClassFeatureActionIcon({
        id: feature.id,
        name: feature.name,
        classId: definition.id,
      })).toMatchObject({
        assetMode: 'foreground',
        classBackdropId: definition.id,
        background: DND5E_CLASS_ICON_PALETTES[definition.id][0],
      })
    }
  })

  it('让同一特性的等级升级复用绘图，同时保留职业色', () => {
    expect(dnd5eClassFeatureActionIcon({
      id: 'brutal-critical-3', name: '凶蛮重击', classId: 'barbarian',
    }).asset).toBe('/assets/icons/barbarian-brutal-critical-feature-action.png')
    expect(dnd5eClassFeatureActionIcon({
      id: 'asi-19', name: '属性值提升', classId: 'wizard',
    })).toMatchObject({
      asset: '/assets/icons/asi-feature-action.png',
      background: '#3B82F6',
      classBackdropId: 'wizard',
    })
  })

  it('tints registered custom spell artwork with the casting-class template', () => {
    const registered = registerDnd5ePluginImageAsset('test-ai-spell-icon', {
      id: 'starfire',
      mediaType: 'image/png',
      dataBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    })
    try {
      expect(dnd5eSpellActionIcon({
        id: 'custom-starfire',
        name: '星火矛',
        castingClassId: 'wizard',
        iconAssetId: registered.id,
      })).toMatchObject({
        assetMode: 'foreground',
        assetTreatment: 'transparent-foreground',
        classBackdropId: 'wizard',
        background: '#3B82F6',
      })
    } finally {
      registered.dispose()
    }
  })

  it('lets a plugin-supplied item image explicitly override the semantic SVG', () => {
    const registered = registerDnd5ePluginImageAsset('test-item-icon', {
      id: 'moonblade',
      mediaType: 'image/png',
      dataBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    })
    try {
      expect(dnd5eItemActionIcon({
        id: 'custom:moonblade',
        name: '月刃',
        category: 'equipment',
        icon: 'weapon',
        iconAssetId: registered.id,
      })).toMatchObject({
        inventoryIconId: 'sword',
        preferSemanticGlyph: false,
        assetMode: 'foreground',
        assetTreatment: 'transparent-foreground',
      })
    } finally {
      registered.dispose()
    }
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
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
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })

  it('binds painted icons for the elemental gem, elven chain, smoke bottle, and magical eyes', () => {
    const cases = [
      ['elemental-gem', 'elemental-gem-item-action.png', 'uncommon', '#237A4A'],
      ['elven-chain', 'elven-chain-item-action.png', 'rare', '#2563A8'],
      ['eversmoking-bottle', 'eversmoking-bottle-item-action.png', 'uncommon', '#237A4A'],
      ['eyes-of-charming', 'eyes-of-charming-item-action.png', 'uncommon', '#237A4A'],
      ['eyes-of-minute-seeing', 'eyes-of-minute-seeing-item-action.png', 'uncommon', '#237A4A'],
      ['eyes-of-the-eagle', 'eyes-of-the-eagle-item-action.png', 'uncommon', '#237A4A'],
      ['feather-token', 'feather-token-item-action.png', 'rare', '#2563A8'],
      ['figurine-of-wondrous-power', 'figurine-of-wondrous-power-item-action.png', 'varies', '#326C8C'],
      ['flame-tongue', 'flame-tongue-item-action.png', 'rare', '#2563A8'],
      ['folding-boat', 'folding-boat-item-action.png', 'rare', '#2563A8'],
      ['frost-brand', 'frost-brand-item-action.png', 'very-rare', '#7138A8'],
      ['gauntlets-of-ogre-power', 'gauntlets-of-ogre-power-item-action.png', 'uncommon', '#237A4A'],
      ['gem-of-brightness', 'gem-of-brightness-item-action.png', 'uncommon', '#237A4A'],
      ['gem-of-seeing', 'gem-of-seeing-item-action.png', 'rare', '#2563A8'],
      ['giant-slayer', 'giant-slayer-item-action.png', 'rare', '#2563A8'],
      ['glamoured-studded-leather-armor', 'glamoured-studded-leather-armor-item-action.png', 'rare', '#2563A8'],
      ['gloves-of-missile-snaring', 'gloves-of-missile-snaring-item-action.png', 'uncommon', '#237A4A'],
      ['gloves-of-swimming-and-climbing', 'gloves-of-swimming-and-climbing-item-action.png', 'uncommon', '#237A4A'],
      ['goggles-of-night', 'goggles-of-night-item-action.png', 'uncommon', '#237A4A'],
      ['hammer-of-thunderbolts', 'hammer-of-thunderbolts-item-action.png', 'legendary', '#B86A12'],
      ['handy-haversack', 'handy-haversack-item-action.png', 'rare', '#2563A8'],
      ['hat-of-disguise', 'hat-of-disguise-item-action.png', 'uncommon', '#237A4A'],
      ['headband-of-intellect', 'headband-of-intellect-item-action.png', 'uncommon', '#237A4A'],
      ['helm-of-brilliance', 'helm-of-brilliance-item-action.png', 'very-rare', '#7138A8'],
      ['helm-of-comprehending-languages', 'helm-of-comprehending-languages-item-action.png', 'uncommon', '#237A4A'],
      ['helm-of-telepathy', 'helm-of-telepathy-item-action.png', 'uncommon', '#237A4A'],
      ['helm-of-teleportation', 'helm-of-teleportation-item-action.png', 'rare', '#2563A8'],
      ['holy-avenger', 'holy-avenger-item-action.png', 'legendary', '#B86A12'],
      ['horn-of-blasting', 'horn-of-blasting-item-action.png', 'rare', '#2563A8'],
      ['horn-of-valhalla', 'horn-of-valhalla-item-action.png', 'varies', '#326C8C'],
      ['horseshoes-of-a-zephyr', 'horseshoes-of-a-zephyr-item-action.png', 'very-rare', '#7138A8'],
      ['horseshoes-of-speed', 'horseshoes-of-speed-item-action.png', 'rare', '#2563A8'],
      ['immovable-rod', 'immovable-rod-item-action.png', 'uncommon', '#237A4A'],
      ['instant-fortress', 'instant-fortress-item-action.png', 'rare', '#2563A8'],
      ['ioun-stone', 'ioun-stone-item-action.png', 'varies', '#326C8C'],
      ['iron-flask', 'iron-flask-item-action.png', 'legendary', '#B86A12'],
      ['javelin-of-lightning', 'javelin-of-lightning-item-action.png', 'uncommon', '#237A4A'],
      ['lantern-of-revealing', 'lantern-of-revealing-item-action.png', 'uncommon', '#237A4A'],
      ['luck-blade', 'luck-blade-item-action.png', 'legendary', '#B86A12'],
      ['mace-of-disruption', 'mace-of-disruption-item-action.png', 'rare', '#2563A8'],
      ['mace-of-smiting', 'mace-of-smiting-item-action.png', 'rare', '#2563A8'],
      ['mace-of-terror', 'mace-of-terror-item-action.png', 'rare', '#2563A8'],
      ['mantle-of-spell-resistance', 'mantle-of-spell-resistance-item-action.png', 'rare', '#2563A8'],
      ['manual-of-bodily-health', 'manual-of-bodily-health-item-action.png', 'very-rare', '#7138A8'],
      ['manual-of-gainful-exercise', 'manual-of-gainful-exercise-item-action.png', 'very-rare', '#7138A8'],
      ['manual-of-golems', 'manual-of-golems-item-action.png', 'very-rare', '#7138A8'],
      ['manual-of-quickness-of-action', 'manual-of-quickness-of-action-item-action.png', 'very-rare', '#7138A8'],
      ['medallion-of-thoughts', 'medallion-of-thoughts-item-action.png', 'uncommon', '#237A4A'],
      ['mirror-of-life-trapping', 'mirror-of-life-trapping-item-action.png', 'very-rare', '#7138A8'],
      ['mithral-armor', 'mithral-armor-item-action.png', 'uncommon', '#237A4A'],
      ['necklace-of-adaptation', 'necklace-of-adaptation-item-action.png', 'uncommon', '#237A4A'],
      ['necklace-of-fireballs', 'necklace-of-fireballs-item-action.png', 'rare', '#2563A8'],
      ['necklace-of-prayer-beads', 'necklace-of-prayer-beads-item-action.png', 'rare', '#2563A8'],
      ['nine-lives-stealer', 'nine-lives-stealer-item-action.png', 'very-rare', '#7138A8'],
      ['oathbow', 'oathbow-item-action.png', 'very-rare', '#7138A8'],
      ['oil-of-etherealness', 'oil-of-etherealness-item-action.png', 'rare', '#2563A8'],
      ['oil-of-sharpness', 'oil-of-sharpness-item-action.png', 'very-rare', '#7138A8'],
      ['oil-of-slipperiness', 'oil-of-slipperiness-item-action.png', 'uncommon', '#237A4A'],
      ['pearl-of-power', 'pearl-of-power-item-action.png', 'uncommon', '#237A4A'],
      ['periapt-of-health', 'periapt-of-health-item-action.png', 'uncommon', '#237A4A'],
      ['periapt-of-proof-against-poison', 'periapt-of-proof-against-poison-item-action.png', 'rare', '#2563A8'],
      ['periapt-of-wound-closure', 'periapt-of-wound-closure-item-action.png', 'uncommon', '#237A4A'],
      ['philter-of-love', 'philter-of-love-item-action.png', 'uncommon', '#237A4A'],
      ['pipes-of-haunting', 'pipes-of-haunting-item-action.png', 'uncommon', '#237A4A'],
      ['iron-bands-of-binding', 'iron-bands-of-binding-item-action.png', 'rare', '#2563A8'],
      ['marvelous-pigments', 'marvelous-pigments-item-action.png', 'very-rare', '#7138A8'],
      ['pipes-of-the-sewers', 'pipes-of-the-sewers-item-action.png', 'uncommon', '#237A4A'],
      ['plate-armor-of-etherealness', 'plate-armor-of-etherealness-item-action.png', 'legendary', '#B86A12'],
      ['portable-hole', 'portable-hole-item-action.png', 'rare', '#2563A8'],
      ['potion-of-animal-friendship', 'potion-of-animal-friendship-item-action.png', 'uncommon', '#237A4A'],
      ['potion-of-clairvoyance', 'potion-of-clairvoyance-item-action.png', 'rare', '#2563A8'],
      ['potion-of-climbing', 'potion-of-climbing-item-action.png', 'common', '#52606D'],
      ['potion-of-diminution', 'potion-of-diminution-item-action.png', 'rare', '#2563A8'],
      ['potion-of-flying', 'potion-of-flying-item-action.png', 'very-rare', '#7138A8'],
      ['potion-of-gaseous-form', 'potion-of-gaseous-form-item-action.png', 'rare', '#2563A8'],
      ['potion-of-giant-strength', 'potion-of-giant-strength-item-action.png', 'varies', '#326C8C'],
      ['potion-of-growth', 'potion-of-growth-item-action.png', 'uncommon', '#237A4A'],
      ['potion-of-heroism', 'potion-of-heroism-item-action.png', 'rare', '#2563A8'],
      ['potion-of-invisibility', 'potion-of-invisibility-item-action.png', 'very-rare', '#7138A8'],
      ['potion-of-mind-reading', 'potion-of-mind-reading-item-action.png', 'rare', '#2563A8'],
      ['potion-of-poison', 'potion-of-poison-item-action.png', 'uncommon', '#237A4A'],
      ['potion-of-resistance', 'potion-of-resistance-item-action.png', 'uncommon', '#237A4A'],
      ['potion-of-speed', 'potion-of-speed-item-action.png', 'very-rare', '#7138A8'],
      ['potion-of-water-breathing', 'potion-of-water-breathing-item-action.png', 'uncommon', '#237A4A'],
      ['restorative-ointment', 'restorative-ointment-item-action.png', 'uncommon', '#237A4A'],
      ['ring-of-animal-influence', 'ring-of-animal-influence-item-action.png', 'rare', '#2563A8'],
      ['ring-of-djinni-summoning', 'ring-of-djinni-summoning-item-action.png', 'legendary', '#B86A12'],
      ['ring-of-elemental-command', 'ring-of-elemental-command-item-action.png', 'legendary', '#B86A12'],
      ['ring-of-evasion', 'ring-of-evasion-item-action.png', 'rare', '#2563A8'],
      ['ring-of-feather-falling', 'ring-of-feather-falling-item-action.png', 'rare', '#2563A8'],
      ['ring-of-free-action', 'ring-of-free-action-item-action.png', 'rare', '#2563A8'],
      ['ring-of-invisibility', 'ring-of-invisibility-item-action.png', 'legendary', '#B86A12'],
      ['ring-of-jumping', 'ring-of-jumping-item-action.png', 'uncommon', '#237A4A'],
      ['ring-of-mind-shielding', 'ring-of-mind-shielding-item-action.png', 'uncommon', '#237A4A'],
      ['ring-of-protection', 'ring-of-protection-item-action.png', 'rare', '#2563A8'],
      ['ring-of-regeneration', 'ring-of-regeneration-item-action.png', 'very-rare', '#7138A8'],
      ['ring-of-resistance', 'ring-of-resistance-item-action.png', 'rare', '#2563A8'],
      ['ring-of-shooting-stars', 'ring-of-shooting-stars-item-action.png', 'very-rare', '#7138A8'],
      ['ring-of-spell-storing', 'ring-of-spell-storing-item-action.png', 'rare', '#2563A8'],
      ['ring-of-spell-turning', 'ring-of-spell-turning-item-action.png', 'legendary', '#B86A12'],
      ['ring-of-swimming', 'ring-of-swimming-item-action.png', 'uncommon', '#237A4A'],
      ['ring-of-telekinesis', 'ring-of-telekinesis-item-action.png', 'very-rare', '#7138A8'],
      ['ring-of-the-ram', 'ring-of-the-ram-item-action.png', 'rare', '#2563A8'],
      ['ring-of-three-wishes', 'ring-of-three-wishes-item-action.png', 'legendary', '#B86A12'],
      ['ring-of-warmth', 'ring-of-warmth-item-action.png', 'uncommon', '#237A4A'],
      ['ring-of-water-walking', 'ring-of-water-walking-item-action.png', 'uncommon', '#237A4A'],
      ['ring-of-x-ray-vision', 'ring-of-x-ray-vision-item-action.png', 'rare', '#2563A8'],
      ['robe-of-eyes', 'robe-of-eyes-item-action.png', 'rare', '#2563A8'],
      ['robe-of-scintillating-colors', 'robe-of-scintillating-colors-item-action.png', 'very-rare', '#7138A8'],
      ['robe-of-stars', 'robe-of-stars-item-action.png', 'very-rare', '#7138A8'],
      ['robe-of-the-archmagi', 'robe-of-the-archmagi-item-action.png', 'legendary', '#B86A12'],
      ['robe-of-useful-items', 'robe-of-useful-items-item-action.png', 'uncommon', '#237A4A'],
      ['rod-of-absorption', 'rod-of-absorption-item-action.png', 'very-rare', '#7138A8'],
      ['rod-of-alertness', 'rod-of-alertness-item-action.png', 'very-rare', '#7138A8'],
      ['rod-of-lordly-might', 'rod-of-lordly-might-item-action.png', 'legendary', '#B86A12'],
      ['rod-of-rulership', 'rod-of-rulership-item-action.png', 'rare', '#2563A8'],
      ['rod-of-security', 'rod-of-security-item-action.png', 'very-rare', '#7138A8'],
      ['rope-of-climbing', 'rope-of-climbing-item-action.png', 'uncommon', '#237A4A'],
      ['rope-of-entanglement', 'rope-of-entanglement-item-action.png', 'rare', '#2563A8'],
      ['scarab-of-protection', 'scarab-of-protection-item-action.png', 'legendary', '#B86A12'],
      ['scimitar-of-speed', 'scimitar-of-speed-item-action.png', 'very-rare', '#7138A8'],
      ['shield-of-missile-attraction', 'shield-of-missile-attraction-item-action.png', 'rare', '#2563A8'],
      ['slippers-of-spider-climbing', 'slippers-of-spider-climbing-item-action.png', 'uncommon', '#237A4A'],
      ['sovereign-glue', 'sovereign-glue-item-action.png', 'legendary', '#B86A12'],
      ['srd-5.1:spell-scroll:fireball', 'spell-scroll-item-action.png', 'uncommon', '#237A4A'],
      ['spellguard-shield', 'spellguard-shield-item-action.png', 'very-rare', '#7138A8'],
      ['sphere-of-annihilation', 'sphere-of-annihilation-item-action.png', 'legendary', '#B86A12'],
      ['staff-of-charming', 'staff-of-charming-item-action.png', 'rare', '#2563A8'],
      ['staff-of-fire', 'staff-of-fire-item-action.png', 'very-rare', '#7138A8'],
      ['staff-of-frost', 'staff-of-frost-item-action.png', 'very-rare', '#7138A8'],
      ['staff-of-healing', 'staff-of-healing-item-action.png', 'rare', '#2563A8'],
      ['staff-of-power', 'staff-of-power-item-action.png', 'very-rare', '#7138A8'],
      ['staff-of-striking', 'staff-of-striking-item-action.png', 'very-rare', '#7138A8'],
      ['staff-of-swarming-insects', 'staff-of-swarming-insects-item-action.png', 'very-rare', '#7138A8'],
      ['staff-of-the-magi', 'staff-of-the-magi-item-action.png', 'legendary', '#B86A12'],
      ['staff-of-the-python', 'staff-of-the-python-item-action.png', 'very-rare', '#7138A8'],
      ['staff-of-the-woodlands', 'staff-of-the-woodlands-item-action.png', 'rare', '#2563A8'],
      ['staff-of-thunder-and-lightning', 'staff-of-thunder-and-lightning-item-action.png', 'very-rare', '#7138A8'],
      ['staff-of-withering', 'staff-of-withering-item-action.png', 'rare', '#2563A8'],
      ['stone-of-controlling-earth-elementals', 'stone-of-controlling-earth-elementals-item-action.png', 'rare', '#2563A8'],
      ['stone-of-good-luck-luckstone', 'stone-of-good-luck-luckstone-item-action.png', 'uncommon', '#237A4A'],
      ['sun-blade', 'sun-blade-item-action.png', 'rare', '#2563A8'],
      ['sword-of-life-stealing', 'sword-of-life-stealing-item-action.png', 'rare', '#2563A8'],
      ['sword-of-sharpness', 'sword-of-sharpness-item-action.png', 'very-rare', '#7138A8'],
      ['sword-of-wounding', 'sword-of-wounding-item-action.png', 'rare', '#2563A8'],
      ['talisman-of-pure-good', 'talisman-of-pure-good-item-action.png', 'legendary', '#B86A12'],
      ['talisman-of-the-sphere', 'talisman-of-the-sphere-item-action.png', 'legendary', '#B86A12'],
      ['talisman-of-ultimate-evil', 'talisman-of-ultimate-evil-item-action.png', 'legendary', '#B86A12'],
      ['tome-of-clear-thought', 'tome-of-clear-thought-item-action.png', 'very-rare', '#7138A8'],
      ['tome-of-leadership-and-influence', 'tome-of-leadership-and-influence-item-action.png', 'very-rare', '#7138A8'],
      ['tome-of-understanding', 'tome-of-understanding-item-action.png', 'very-rare', '#7138A8'],
      ['trident-of-fish-command', 'trident-of-fish-command-item-action.png', 'uncommon', '#237A4A'],
      ['universal-solvent', 'universal-solvent-item-action.png', 'legendary', '#B86A12'],
      ['vicious-weapon', 'vicious-weapon-item-action.png', 'rare', '#2563A8'],
      ['vorpal-sword', 'vorpal-sword-item-action.png', 'legendary', '#B86A12'],
      ['wand-of-binding', 'wand-of-binding-item-action.png', 'rare', '#2563A8'],
      ['wand-of-enemy-detection', 'wand-of-enemy-detection-item-action.png', 'rare', '#2563A8'],
      ['wand-of-fear', 'wand-of-fear-item-action.png', 'rare', '#2563A8'],
      ['wand-of-fireballs', 'wand-of-fireballs-item-action.png', 'rare', '#2563A8'],
      ['wand-of-lightning-bolts', 'wand-of-lightning-bolts-item-action.png', 'rare', '#2563A8'],
      ['wand-of-magic-detection', 'wand-of-magic-detection-item-action.png', 'uncommon', '#237A4A'],
      ['wand-of-magic-missiles', 'wand-of-magic-missiles-item-action.png', 'uncommon', '#237A4A'],
      ['wand-of-paralysis', 'wand-of-paralysis-item-action.png', 'rare', '#2563A8'],
      ['wand-of-polymorph', 'wand-of-polymorph-item-action.png', 'very-rare', '#7138A8'],
      ['wand-of-secrets', 'wand-of-secrets-item-action.png', 'uncommon', '#237A4A'],
      ['wand-of-the-war-mage', 'wand-of-the-war-mage-item-action.png', 'varies', '#326C8C'],
      ['wand-of-web', 'wand-of-web-item-action.png', 'uncommon', '#237A4A'],
      ['wand-of-wonder', 'wand-of-wonder-item-action.png', 'rare', '#2563A8'],
      ['well-of-many-worlds', 'well-of-many-worlds-item-action.png', 'legendary', '#B86A12'],
      ['wind-fan', 'wind-fan-item-action.png', 'uncommon', '#237A4A'],
      ['winged-boots', 'winged-boots-item-action.png', 'uncommon', '#237A4A'],
      ['wings-of-flying', 'wings-of-flying-item-action.png', 'rare', '#2563A8'],
      ['orb-of-dragonkind', 'orb-of-dragonkind-item-action.png', 'artifact', '#A51D2D'],
    ] as const

    for (const [id, filename, rarityBackdropId, background] of cases) {
      const item = DND5E_SRD_ITEM_TEMPLATES.find((candidate) => candidate.id === (id.startsWith('srd-5.1:') ? id : `srd-5.1:magic-item:${id}`))
      expect(item, id).toBeDefined()
      expect(dnd5eItemActionIcon(item!)).toMatchObject({
        asset: `/assets/icons/${filename}`,
        assetMode: 'foreground',
        rarityBackdropId,
        background,
      })
    }
  })
})
