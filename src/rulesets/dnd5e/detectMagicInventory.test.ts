import { describe, expect, it } from 'vitest'
import { formatDnd5eCombatLogDetails } from '../../lib/combatLogDetails'
import { createDnd5eMechanicalEffect } from './activeEffects'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5ePersistentDetectionReports,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'

const abilities = { str: 10, dex: 10, con: 10, int: 16, wis: 16, cha: 10 } as const

function combatant(id: string, initiative: number, patch = {}) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities,
    proficiencyBonus: 3,
    armorClass: 12,
    currentHp: 20,
    maxHp: 20,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

describe('Detect Magic inventory projection', () => {
  it('detects every carried magic item but only reveals visible worn or held item auras', () => {
    const detector = combatant('detector', 30, { concentrating: true })
    detector.classState.concentrationSpellId = 'detect-magic'
    detector.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'detect-magic-effect',
      definitionId: 'activity:detect-magic:persistent-detection:detect-magic-persistent-detection:extension',
      label: '侦测魔法',
      source: {
        kind: 'spell', actorId: detector.id, rulesId: 'detect-magic',
        spellLevel: 1, magical: true,
      },
      targetId: detector.id,
      duration: {
        type: 'concentration', sourceActorId: detector.id,
        concentrationId: 'detect-magic',
      },
      legacyCondition: 'persistent-detection:magic:30',
    })]
    const wornRing = combatant('ring-wearer', 20, {
      controller: 'dm',
      inventoryMagicItems: [{
        instanceId: 'ring-instance',
        templateId: 'srd-5.1:magic-item:ring-of-protection',
        displayName: '防护戒指',
        equippedSlot: 'ring-1',
      }],
    })
    const packedWand = combatant('wand-carrier', 10, {
      controller: 'dm',
      inventoryMagicItems: [{
        instanceId: 'wand-instance',
        templateId: 'srd-5.1:magic-item:wand-of-magic-missiles',
        displayName: '魔法飞弹魔杖',
        containerInstanceId: 'backpack-instance',
      }],
    })
    const state = startDnd5eHeadlessCombat('detect-magic-inventory', [
      detector, wornRing, packedWand,
    ])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(detector.id, wornRing.id)]: 10,
      [dnd5eCombatantPairKey(detector.id, packedWand.id)]: 20,
    }

    const report = dnd5ePersistentDetectionReports(state, detector.id)[0]
    expect(report).toMatchObject({ spellId: 'detect-magic', mode: 'magic', rangeFeet: 30 })
    expect(report?.presences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetId: wornRing.id,
        categories: ['magic', 'magic-item'],
        sourceRulesIds: ['magic-item:srd-5.1:magic-item:ring-of-protection'],
        magicItemNames: ['防护戒指'],
        auraVisible: true,
      }),
      expect.objectContaining({
        targetId: packedWand.id,
        categories: ['magic', 'magic-item'],
        sourceRulesIds: [],
        auraVisible: false,
      }),
    ]))

    const details = formatDnd5eCombatLogDetails([{
      type: 'spell-detection-updated',
      actorId: detector.id,
      spellId: 'detect-magic',
      mode: 'magic',
      revealAuras: true,
      presences: report?.presences ?? [],
    }], {
      resolveName: (id) => ({
        detector: '测试牧师',
        'ring-wearer': '戒指佩戴者',
        'wand-carrier': '魔杖携带者',
      })[id] ?? id,
    })
    expect(details).toContain(
      '测试牧师｜侦测魔法更新｜戒指佩戴者（10 尺；魔法、魔法物品；魔法物品 防护戒指；来源 magic-item:srd-5.1:magic-item:ring-of-protection）',
    )
    expect(details.join('\n')).not.toContain('魔杖携带者')
    expect(details.join('\n')).not.toContain('魔法飞弹魔杖')
  })

  it('reports sensed magic without leaking a contained item when no aura is visible', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'spell-detection-updated',
      actorId: 'detector',
      spellId: 'detect-magic',
      mode: 'magic',
      revealAuras: true,
      presences: [{
        targetId: 'carrier', distanceFeet: 10,
        categories: ['magic', 'magic-item'], sourceRulesIds: [], auraVisible: false,
      }],
    }], { resolveName: (id) => id })

    expect(details).toEqual([
      'detector｜侦测魔法更新｜30 尺内感知到魔法存在；当前没有可见的承载魔法目标可显化灵光',
    ])
  })
})
