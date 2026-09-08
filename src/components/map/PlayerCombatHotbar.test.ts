import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { dnd5eSpellActionIcon } from '../../lib/dnd5eActionIcons'
import { buildDnd5eCombatActionDescriptors, groupDnd5eCombatHotbarDescriptors } from '../../lib/dnd5eCombatActionDescriptors'
import PlayerCombatHotbar, {
  dnd5eHotbarActionRestrictionReason,
  dnd5eHotbarSpellTargeting,
  dnd5eHotbarSpellFallbackConfigurationLevel,
  dnd5eHotbarSpellTooltipLevel,
} from './PlayerCombatHotbar'
import { resolveDnd5eHotbarSpellCommand } from './playerCombatHotbarSpellCommand'
import { DND5E_QUARTERSTAFF, getDnd5eSrdCombatSpell } from '../../rulesets/dnd5e'
import { dnd5ePluginSpellActivity } from '../../rulesets/dnd5e/pluginSpellTransaction'
import { dnd5ePluginSpellDefinition } from '../../rulesets/dnd5e/plugins/pluginContentCatalog'

function character(): Character {
  return {
    id: 'hero', name: '冒险者', player: '玩家', avatar: '🧙', accent: 'from-violet-600 to-indigo-700',
    race: '人类', charClass: '战士', level: 1, background: '侍僧', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    savingThrows: ['str', 'con'], skills: [], maxHp: 12, currentHp: 8, tempHp: 0,
    hitDice: '1d10', ac: 16, speed: 30, initiativeBonus: 1, saveDC: 10,
    passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

describe('PlayerCombatHotbar', () => {
  it('describes Conjure Celestial as an actual map-position cast', () => {
    expect(dnd5eHotbarSpellTargeting(
      undefined,
      dnd5ePluginSpellActivity(dnd5ePluginSpellDefinition('conjure-celestial')),
    )).toBe('map-position')
  })

  it('does not expose a target picker for object-facing spells', () => {
    expect(dnd5eHotbarSpellTargeting(
      getDnd5eSrdCombatSpell('prestidigitation'),
      dnd5ePluginSpellActivity(dnd5ePluginSpellDefinition('prestidigitation')),
      'prestidigitation',
    )).toBe('none')
    expect(dnd5eHotbarSpellTargeting(
      getDnd5eSrdCombatSpell('light'),
      dnd5ePluginSpellActivity(dnd5ePluginSpellDefinition('light')),
    )).toBe('none')
    expect(dnd5eHotbarSpellTargeting(
      undefined,
      dnd5ePluginSpellActivity(dnd5ePluginSpellDefinition('identify')),
    )).toBe('none')
    expect(dnd5eHotbarSpellTargeting(
      getDnd5eSrdCombatSpell('demiplane'),
      dnd5ePluginSpellActivity(dnd5ePluginSpellDefinition('demiplane')),
      'demiplane',
    )).toBe('none')
  })

  it('opens explicit slot configuration instead of silently upcasting when the current slot is empty', () => {
    const descriptor = buildDnd5eCombatActionDescriptors({
      canAct: true,
      pending: false,
      actionRemaining: 1,
      bonusActionRemaining: 1,
      movementRemaining: 30,
      spells: [{
        id: 'knock', label: '敲击术', description: '打开锁具。',
        icon: dnd5eSpellActionIcon({ id: 'knock', name: '敲击术' }),
        level: 2, castingTime: 'action', targeting: 'area', castingClassId: 'wizard',
        defaultSlotLevel: 2, availableSlotLevels: [3, 5], ritualAvailable: false, available: true,
      }],
    }).find((entry) => entry.id === 'spell:wizard:knock')!

    expect(dnd5eHotbarSpellFallbackConfigurationLevel(descriptor)).toBe(3)
    expect(dnd5eHotbarSpellFallbackConfigurationLevel(descriptor, 5)).toBeUndefined()
    expect(dnd5eHotbarSpellFallbackConfigurationLevel({ ...descriptor, enabled: false })).toBeUndefined()
  })

  it('uses a direct cast command and configured slot for formerly adjudicated spells', () => {
    const descriptor = buildDnd5eCombatActionDescriptors({
      canAct: true,
      pending: false,
      actionRemaining: 1,
      bonusActionRemaining: 1,
      movementRemaining: 30,
      spells: [{
        id: 'seeming', label: '伪装术', description: '改变可见生物的外观。',
        icon: dnd5eSpellActionIcon({ id: 'seeming', name: '伪装术' }),
        level: 5, castingTime: 'action', targeting: 'configure', castingClassId: 'wizard',
        defaultSlotLevel: 5, availableSlotLevels: [5, 6], ritualAvailable: false, available: true,
      }],
    }).find((entry) => entry.id === 'spell:wizard:seeming')!

    expect(descriptor.command).toEqual({
      kind: 'cast-spell', spellId: 'seeming', castingClassId: 'wizard', slotLevel: 5,
    })
    expect(dnd5eHotbarSpellTooltipLevel(descriptor)).toBe(5)
    expect(dnd5eHotbarSpellTooltipLevel(descriptor, 6)).toBe(6)
  })

  it('preserves an armed Overchannel intent in the spell command submitted to the map', () => {
    const wizard = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '法师',
      level: 18,
      dnd5eClassLevels: { wizard: 18 },
      dnd5eClassChoices: {
        classes: { wizard: { subclass: 'evocation' } },
      },
    } as Character

    expect(resolveDnd5eHotbarSpellCommand(wizard, {
      kind: 'cast-spell',
      spellId: 'fireball',
      castingClassId: 'wizard',
      slotLevel: 3,
    }, 3, ['evocation-overchannel'])).toMatchObject({
      ok: true,
      command: {
        options: {
          overchannel: true,
          autoSubmitOnTargetSelection: true,
        },
      },
    })
  })

  it('applies Sculpt Spells to Prismatic Spray but does not let an ineligible Overchannel lock the spell', () => {
    const wizard = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '法师',
      level: 18,
      dnd5eClassLevels: { wizard: 18 },
      dnd5eClassChoices: {
        classes: { wizard: { subclass: 'evocation' } },
      },
    } as Character
    const command = {
      kind: 'cast-spell' as const,
      spellId: 'prismatic-spray',
      castingClassId: 'wizard',
      slotLevel: 7,
    }

    expect(resolveDnd5eHotbarSpellCommand(
      wizard,
      command,
      7,
      ['evocation-sculpt-spells'],
    )).toMatchObject({
      ok: true,
      command: { options: { sculptSpell: true, autoSubmitOnTargetSelection: false } },
    })
    const ignoredOverchannel = resolveDnd5eHotbarSpellCommand(
      wizard,
      command,
      7,
      ['evocation-overchannel'],
    )
    expect(ignoredOverchannel).toMatchObject({
      ok: true,
      command: { options: { autoSubmitOnTargetSelection: true } },
    })
    if (ignoredOverchannel.ok) {
      expect(ignoredOverchannel.command.options).not.toHaveProperty('overchannel')
    }
  })

  it('groups spells, items and basic actions into stable independent sections', () => {
    const icon = dnd5eSpellActionIcon({ id: 'fire-bolt', name: '火焰箭' })
    const descriptors = buildDnd5eCombatActionDescriptors({
      canAct: true,
      pending: false,
      actionRemaining: 1,
      bonusActionRemaining: 1,
      movementRemaining: 30,
      spells: [{
        id: 'fire-bolt', label: '火焰箭', description: '远程法术攻击。', icon,
        level: 0, castingTime: 'action', targeting: 'creature', castingClassId: 'wizard',
        defaultSlotLevel: 0,
        availableSlotLevels: [0], ritualAvailable: true, available: true,
      }],
      items: [{
        instanceId: 'potion', label: '治疗药水', description: '恢复生命值。', icon,
        economy: 'action', targeting: 'self', quantity: 2, usable: true,
      }],
    })
    const grouped = groupDnd5eCombatHotbarDescriptors(descriptors)
    expect(grouped.spells.map((entry) => entry.id)).toEqual(['spell:wizard:fire-bolt'])
    expect(grouped.spells[0]?.ritualAvailable).toBe(true)
    expect(grouped.items.map((entry) => entry.id)).toEqual(['item:potion'])
    expect(grouped.features.map((entry) => entry.id)).toEqual(['feature:class-actions'])
    expect(grouped.basics).toHaveLength(8)
    expect(grouped.basics.every((entry) => !['spell', 'item', 'feature'].includes(entry.sourceKind))).toBe(true)
  })

  it('blocks configuration panels that would expose actions forbidden by an explicit form whitelist', () => {
    const descriptors = buildDnd5eCombatActionDescriptors({
      canAct: true,
      pending: false,
      actionRemaining: 1,
      bonusActionRemaining: 1,
      movementRemaining: 30,
    })
    const otherActions = descriptors.find((entry) => entry.id === 'system:other-actions')!
    const classActions = descriptors.find((entry) => entry.id === 'feature:class-actions')!
    const restriction = {
      prohibited: ['attack', 'spellcasting', 'object-interaction', 'speech'] as const,
      allowedBasicActions: ['dash'] as const,
    }

    expect(dnd5eHotbarActionRestrictionReason(otherActions, restriction))
      .toBe('当前形态只允许规则明确列出的动作。')
    expect(dnd5eHotbarActionRestrictionReason(classActions, restriction))
      .toBe('当前形态只允许规则明确列出的动作。')
  })

  it('renders character status and all three action regions even when spell and item lists are empty', () => {
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: character(),
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))
    expect(html).toContain('data-testid="combat-hotbar-spells"')
    expect(html).toContain('data-testid="combat-hotbar-features"')
    expect(html).toContain('data-testid="combat-hotbar-items"')
    expect(html).toContain('data-testid="combat-hotbar-basics"')
    expect(html).toContain('8/12')
    expect(html).toContain('基础动作')
    expect(html).toContain('data-testid="combat-hotbar-basics-rail"')
    expect(html).toContain('aria-label="基础动作横向滑栏"')
    expect(html).toContain('aria-label="向左滚动基础动作"')
    expect(html).toContain('aria-label="向右滚动基础动作"')
    expect(html).toContain('左右滑动 · 拖拽排序')
    expect(html).toContain('data-testid="combat-hotbar-features-rail"')
    expect(html).toContain('aria-label="职业特性两行横向滑栏"')
    expect(html.match(/grid-rows-2/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('职业特性')
  })

  it('在战士职业特性栏直接显示回气和动作如潮', () => {
    const fighter: Character = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '战士',
      level: 4,
      dnd5eClassLevels: { fighter: 4 },
      classResources: {
        fighterSecondWind: { current: 1, max: 1 },
        fighterActionSurge: { current: 1, max: 1 },
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: fighter,
      canAct: true,
      pending: false,
      turnEconomy: {
        action: { current: 1, max: 1 },
        bonusAction: { current: 1, max: 1 },
        movement: { current: 30, max: 30 },
      },
      onCommand: () => undefined,
    }))

    expect(html).toContain('3 项 · 左右滑动')
    expect(html).toContain('aria-label="回气"')
    expect(html).toContain('aria-label="动作如潮"')
    expect(html).toContain('/assets/icons/fighter-second-wind-feature-action.png')
    expect(html).toContain('/assets/icons/fighter-action-surge-feature-action.png')
  })

  it('renders the complete hotbar during exploration and locks basic combat actions', () => {
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: character(),
      mode: 'exploration',
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))

    expect(html).toContain('data-mode="exploration"')
    expect(html).toContain('data-testid="combat-hotbar-spells"')
    expect(html).toContain('data-testid="combat-hotbar-features"')
    expect(html).toContain('data-testid="combat-hotbar-items"')
    expect(html).toContain('data-testid="combat-hotbar-basics"')
    expect(html).toContain('data-testid="combat-hotbar-character-portrait"')
    expect(html).toContain('aria-label="快速查看冒险者的人物卡"')
    expect(html).toMatch(/data-action-id="system:move"[^>]*aria-disabled="true"/)
    expect(html).toContain('基础动作只能在战斗中、轮到自己时使用。')
  })

  it('仅在探索模式开放分钟级长时间施法', () => {
    const wizard: Character = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '法师',
      level: 5,
      dnd5eClassLevels: { wizard: 5 },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['identify'] } } },
      },
      classResources: {
        'dnd5e-spell-slot-1': { current: 1, max: 4 },
      },
    }
    const render = (mode: 'combat' | 'exploration') => renderToStaticMarkup(
      createElement(PlayerCombatHotbar, {
        character: wizard,
        mode,
        canAct: true,
        pending: false,
        turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
        onCommand: () => undefined,
      }),
    )

    expect(render('exploration')).toMatch(/aria-label="鉴定术"[^>]*aria-disabled="false"/)
    expect(render('combat')).toMatch(/aria-label="鉴定术"[^>]*aria-disabled="true"/)
  })

  it('routes a non-Headless prepared spell through direct casting', () => {
    const wizard: Character = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '法师',
      level: 20,
      dnd5eClassLevels: { wizard: 20 },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['major-image'] } } },
      },
      classResources: {
        'dnd5e-spell-slot-3': { current: 3, max: 3 },
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: wizard,
      mode: 'exploration',
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))

    expect(html).toMatch(/data-command-kind="cast-spell"[^>]*aria-label="高等幻影"/)
  })

  it('routes an Activity-only SRD spell through direct casting', () => {
    const wizard: Character = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '法师',
      level: 20,
      dnd5eClassLevels: { wizard: 20 },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['project-image'] } } },
      },
      classResources: {
        'dnd5e-spell-slot-7': { current: 1, max: 2 },
        'dnd5e-spell-slot-9': { current: 1, max: 1 },
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: wizard,
      mode: 'exploration',
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))

    expect(html).toMatch(/data-command-kind="cast-spell"[^>]*aria-label="投影术"/)
    expect(html).not.toMatch(/data-command-kind="open-panel"[^>]*aria-label="投影术"/)
  })

  it('在探索与战斗快捷槽中都将治疗药水路由为真实使用动作', () => {
    const potionCharacter: Character = {
      ...character(),
      dnd5eInventory: {
        schemaVersion: 3,
        currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
        entries: [{
          instanceId: 'potion-1',
          templateId: 'srd-5.1:item:potion-of-healing',
          quantity: 2,
          identified: true,
          acquiredAt: 1,
          item: {
            id: 'srd-5.1:item:potion-of-healing',
            name: '旧存档治疗药水',
            category: 'consumable',
            icon: 'healing-potion',
            description: '旧存档快照。',
            rulesText: '旧存档快照。',
            stackable: true,
            source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
          },
        }],
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: potionCharacter,
      mode: 'exploration',
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))

    expect(html).toMatch(/data-testid="combat-item-quick-slot-1"[^>]*aria-label="治疗药水"/)
    expect(html).toMatch(/data-testid="combat-item-quick-slot-1"[^>]*data-command-kind="use-item"/)
    expect(html).toContain('>使用</span>')
    expect(html).not.toContain('治疗药水（打开背包查看）')
  })

  it('keeps an active grapple escape command visible in the default hotbar', () => {
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: character(),
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 0 } },
      grappleEscapes: [{
        grapplerTokenId: 'ankheg-token',
        grapplerLabel: '掘穴虫',
        dc: 13,
      }],
      onCommand: () => undefined,
    }))

    expect(html).toContain('aria-label="挣脱 掘穴虫 的擒抱"')
    expect(html).toContain('system:escape-grapple:ankheg-token')
  })

  it('在快捷栏显示当前角色可移动的炽焰法球附赠动作', () => {
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: character(),
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      movablePersistentAreas: [{
        id: 'flaming-sphere-area',
        label: '炽焰法球',
        economy: 'bonus-action',
        maximumFeet: 30,
        coreSpellId: 'flaming-sphere',
      }],
      onCommand: () => undefined,
    }))

    expect(html).toContain('aria-label="移动炽焰法球"')
    expect(html).toContain('data-action-id="feature:persistent-area-move:flaming-sphere-area"')
    expect(html).toContain('/assets/icons/flaming-sphere-spell-action.png')
    expect(html).toContain('>30<')
  })

  it('战斗外仍将持续区域附赠移动路由到地图移动，而不是职业特性面板', () => {
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: character(),
      mode: 'exploration',
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      movablePersistentAreas: [{
        id: 'dancing-lights-area',
        label: '舞光术光源',
        economy: 'bonus-action',
        maximumFeet: 60,
        coreSpellId: 'dancing-lights',
      }],
      onCommand: () => undefined,
    }))

    expect(html).toMatch(
      /data-action-id="feature:persistent-area-move:dancing-lights-area"[^>]*data-command-kind="move-persistent-area"/,
    )
    expect(html).not.toMatch(
      /data-action-id="feature:persistent-area-move:dancing-lights-area"[^>]*data-command-kind="open-panel"/,
    )
  })

  it('将高等幻影的现有实例显示为动作移动，而不是再次施法', () => {
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: character(),
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      movablePersistentAreas: [{
        id: 'major-image-area',
        label: '高等幻影',
        economy: 'action',
        maximumFeet: 240,
        destinationRangeFeet: 120,
        coreSpellId: 'major-image',
      }],
      onCommand: () => undefined,
    }))

    expect(html).toContain('aria-label="改变高等幻影位置"')
    expect(html).toContain('data-action-id="feature:persistent-area-move:major-image-area"')
    expect(html).toContain('data-command-kind="move-persistent-area"')
    expect(html).toContain('>120<')
  })

  it('战斗外仍将法术效果授予的后续动作路由到权威结算', () => {
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: character(),
      mode: 'exploration',
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      persistentAreaActivityControls: [{
        effectId: 'instant-summons-effect',
        featureId: 'srd-5.1:effect-control.spell:instant-summons:recall',
        activityId: 'spell:instant-summons:recall',
        label: '瞬间召唤·捏碎蓝宝石',
        economy: 'action',
        targeting: 'self',
      }],
      onCommand: () => undefined,
    }))

    expect(html).toMatch(
      /data-action-id="feature:granted-activity:instant-summons-effect:spell:instant-summons:recall"[^>]*data-command-kind="use-persistent-area-activity"/,
    )
    expect(html).not.toMatch(
      /data-action-id="feature:granted-activity:instant-summons-effect:spell:instant-summons:recall"[^>]*data-command-kind="open-panel"/,
    )
  })

  it('为部分自动化的燃火术恢复可执行的后续投掷快捷动作', () => {
    const druid: Character = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '德鲁伊',
      level: 20,
      dnd5eClassLevels: { druid: 20 },
      dnd5eClassChoices: {
        classes: { druid: { selections: { 'spell-cantrips': ['produce-flame'] } } },
      },
      dnd5eCombatState: {
        activeEffects: [{
          id: 'produce-flame-effect',
          schemaVersion: 1,
          appliedAt: 0,
          stackingKey: 'produce-flame-effect',
          stackingPolicy: 'replace',
          definitionId: 'srd-5.1:spell:produce-flame',
          label: '燃火术：可用动作投掷手中火焰',
          kind: 'buff',
          source: { kind: 'spell', actorId: 'hero', rulesId: 'produce-flame', spellLevel: 0 },
          duration: { type: 'rounds', remainingRounds: 100, tickOn: 'source-turn-start' },
          potency: 0,
        }],
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: druid,
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))

    expect(html).toContain('aria-label="投掷燃火术"')
    expect(html).toMatch(
      /data-action-id="feature:sustained-spell:produce-flame:produce-flame"[^>]*data-command-kind="cast-spell"/,
    )
    expect(html).not.toMatch(
      /data-action-id="feature:sustained-spell:produce-flame:produce-flame"[^>]*data-command-kind="open-panel"/,
    )
  })

  it('将权威地图实体的后续攻击显示为不消耗法术位的快捷动作', () => {
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: character(),
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      sustainedAreaControls: [{
        areaId: 'spiritual-weapon-area',
        spellId: 'spiritual-weapon',
        castingClassId: 'cleric',
        slotLevel: 4,
        controlId: 'spiritual-weapon',
        label: '移动并攻击：灵体武器',
        economy: 'bonus-action',
        targeting: 'creature',
      }],
      onCommand: () => undefined,
    }))

    expect(html).toContain('aria-label="移动并攻击：灵体武器"')
    expect(html).toContain('data-action-id="feature:sustained-spell:spiritual-weapon-area:spiritual-weapon"')
    expect(html).toContain('4环（默认）')
  })

  it('在法术栏位上方显示剩余法术位', () => {
    const wizard: Character = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '法师',
      level: 5,
      dnd5eClassLevels: { wizard: 5 },
      classResources: {
        'dnd5e-spell-slot-1': { current: 2, max: 4 },
        'dnd5e-spell-slot-2': { current: 0, max: 3 },
        'dnd5e-spell-slot-3': { current: 1, max: 2 },
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: wizard,
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))

    expect(html).toContain('data-testid="combat-hotbar-spell-slots"')
    expect(html.indexOf('combat-hotbar-spell-slots')).toBeLessThan(html.indexOf('>法术<'))
    expect(html).toContain('1环')
    expect(html).toContain('<strong class="text-[10px]">2</strong>/4')
    expect(html).toContain('<strong class="text-[10px]">0</strong>/3')
  })

  it('渲染由 MapsPage 共享的固定环位，并按该环位显示法术伤害', () => {
    const wizard: Character = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '法师',
      level: 5,
      dnd5eClassLevels: { wizard: 5 },
      dnd5eClassChoices: {
        classes: {
          wizard: {
            selections: { 'spell-prepared': ['magic-missile'] },
          },
        },
      },
      classResources: {
        'dnd5e-spell-slot-1': { current: 2, max: 4 },
        'dnd5e-spell-slot-3': { current: 1, max: 2 },
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: wizard,
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      selectedSpellSlotLevels: { 'spell:wizard:magic-missile': 3 },
      onSelectedSpellSlotLevelChange: () => undefined,
      onCommand: () => undefined,
    }))

    expect(html).toContain('aria-label="魔法飞弹"')
    expect(html).toContain('data-spell-slot-level="3"')
    expect(html).toContain('data-spell-slot-locked="true"')
    expect(html).toContain('5枚飞弹，每枚1d4+1力场伤害；合计5d4+5')
  })

  it('仅在 Host 声明坠落触发成立时开放羽落术反应', () => {
    const wizard: Character = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '法师',
      level: 20,
      dnd5eClassLevels: { wizard: 20 },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['feather-fall'] } } },
      },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 3 } },
    }
    const render = (triggeredReactionSpellIds: readonly string[]) => renderToStaticMarkup(
      createElement(PlayerCombatHotbar, {
        character: wizard,
        canAct: true,
        pending: false,
        turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
        triggeredReactionSpellIds,
        onCommand: () => undefined,
      }),
    )

    expect(render([])).toMatch(/aria-label="羽落术"[^>]*aria-disabled="true"/)
    expect(render(['feather-fall'])).toMatch(/aria-label="羽落术"[^>]*aria-disabled="false"/)

    const offTurn = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: wizard,
      canAct: false,
      canUseTriggeredReactions: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      triggeredReactionSpellIds: ['feather-fall'],
      onCommand: () => undefined,
    }))
    expect(offTurn).toMatch(/aria-label="羽落术"[^>]*aria-disabled="false"/)
    expect(offTurn).toMatch(/aria-label="武器攻击"[^>]*aria-disabled="true"/)
  })

  it('从角色实际选择生成可分页的通用施法修正图标', () => {
    const sorcerer: Character = {
      ...character(),
      charClass: '术士',
      level: 10,
      dnd5eClassLevels: { sorcerer: 10 },
      dnd5eClassChoices: {
        classes: {
          sorcerer: {
            subclass: 'draconic',
            selections: {
              metamagic: ['careful', 'quickened', 'empowered'],
              'dragon-ancestor': ['red-fire'],
            },
          },
        },
      },
      classResources: {
        'dnd5e-sorcery-points': { current: 10, max: 10 },
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: sorcerer,
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))
    expect(html).toContain('aria-label="谨慎法术"')
    expect(html).toContain('aria-label="强效法术"')
    expect(html).toContain('5 项 · 左右滑动')
    expect(html).toContain('aria-label="职业特性两行横向滑栏"')
  })

  it('道具栏固定显示七个快捷槽，并将第八格保留为完整背包入口', () => {
    const inventoryCharacter: Character = {
      ...character(),
      dnd5eInventory: {
        schemaVersion: 3,
        currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
        entries: Array.from({ length: 9 }, (_, index) => ({
          instanceId: `item-${index + 1}`,
          templateId: `template-${index + 1}`,
          quantity: 1,
          acquiredAt: index + 1,
          identified: true,
          item: {
            id: `template-${index + 1}`,
            name: `道具-${index + 1}`,
            category: 'adventuring-gear' as const,
            icon: 'generic' as const,
            description: `第 ${index + 1} 件道具`,
            rulesText: '由背包查看详情。',
            stackable: false,
            source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
          },
        })),
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: inventoryCharacter,
      canAct: true,
      pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))

    expect(html.match(/data-testid="combat-item-quick-slot-/g)).toHaveLength(7)
    expect(html).toContain('data-testid="combat-item-backpack"')
    expect(html).toContain('data-testid="combat-item-quick-grid"')
    expect(html).toContain('class="grid grid-cols-4 gap-1"')
    expect(html).toContain('快捷 7/7 · 背包 9')
    expect(html).toContain('>查看</span>')
    expect(html).toContain('aria-label="道具-7（打开背包查看）"')
    expect(html).not.toContain('aria-label="道具-8（打开背包查看）"')
  })

  it('变形术形态在快捷栏显示形态生命、继承怪物攻击，并锁定本体法术、武器与职业特性', () => {
    const polymorphedDruid: Character = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '德鲁伊', level: 20, dnd5eClassLevels: { druid: 20 },
      currentHp: 203, maxHp: 203,
      dnd5eClassChoices: {
        classes: { druid: { selections: { 'spell-prepared': ['poison-spray'] } } },
      },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 3 } },
      dnd5eCombatState: {
        wildShapeFormId: 'srd-5.1:tyrannosaurus-rex',
        wildShapeMode: 'polymorph', wildShapeCurrentHp: 136,
        wildShapeOriginalCurrentHp: 203,
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: polymorphedDruid,
      mode: 'combat', canAct: true, pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 30 } },
      onCommand: () => undefined,
    }))
    expect(html).toContain('>136/136<')
    expect(html).toContain('>霸王龙<')
    expect(html).toMatch(/aria-label="毒气喷溅"[^>]*aria-disabled="true"/)
    expect(html).toMatch(/aria-label="职业特性"[^>]*aria-disabled="true"/)
    expect(html).toMatch(/aria-label="霸王龙：多重攻击"[^>]*aria-disabled="false"/)
    expect(html).toMatch(/aria-label="霸王龙：啃咬"[^>]*aria-disabled="false"/)
    expect(html).toMatch(/aria-label="霸王龙：尾击"[^>]*aria-disabled="false"/)
    expect(html).toContain('变形术或动物形态期间不能施法')
  })

  it('形体变化的融入装备只锁定武器道具，并保留本体施法和正确形态标签', () => {
    const shapedWizard: Character = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '法师', level: 20, dnd5eClassLevels: { wizard: 20 },
      equipment: { mainWeapon: DND5E_QUARTERSTAFF },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['magic-missile'] } } },
      },
      classResources: {
        'dnd5e-spell-slot-1': { current: 1, max: 4 },
        'dnd5e-spell-slot-9': { current: 0, max: 1 },
      },
      dnd5eCombatState: {
        wildShapeFormId: 'srd-5.1:adult-black-dragon',
        wildShapeMode: 'shapechange',
        shapechangeEquipmentDisposition: 'merge',
        wildShapeCurrentHp: 195,
        wildShapeOriginalCurrentHp: 12,
      },
    }
    const html = renderToStaticMarkup(createElement(PlayerCombatHotbar, {
      character: shapedWizard,
      mode: 'combat', canAct: true, pending: false,
      turnEconomy: { action: { current: 1 }, bonusAction: { current: 1 }, movement: { current: 40 } },
      onCommand: () => undefined,
    }))
    expect(html).toContain('title="成年黑龙 · 形体变化"')
    expect(html).toMatch(/aria-label="魔法飞弹"[^>]*aria-disabled="false"/)
    expect(html).toMatch(/aria-label="攻击：长棍"[^>]*aria-disabled="true"/)
    expect(html).toContain('本体武器已融入法术形态')
  })
})
