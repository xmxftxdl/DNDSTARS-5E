import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Dnd5ePluginArea } from '../../store/maps'
import Dnd5ePersistentAreaDetailPanel from './Dnd5ePersistentAreaDetailPanel'

describe('Dnd5ePersistentAreaDetailPanel', () => {
  it('显示持续区域的平面、高度、时长与专注字段', () => {
    const area: Dnd5ePluginArea = {
      id: 'silent-image-area',
      pluginId: 'srd-5.1',
      featureId: 'spell:silent-image',
      sourceKind: 'core-spell',
      coreSpellId: 'silent-image',
      label: '无声幻影',
      color: '#6366f1',
      sourceCharacterId: 'wizard',
      sourceTokenId: 'wizard-token',
      cells: Array.from({ length: 9 }, (_, index) => ({
        col: 4 + (index % 3),
        row: 7 + Math.floor(index / 3),
      })),
      createdRound: 42,
      expiresAfterRound: 142,
      concentrationId: 'silent-image',
      relation: 'any',
      includeSelf: false,
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 15 },
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area,
      sourceName: 'UI法术QA-法师A',
      feetPerCell: 5,
      currentRound: 42,
      onClose: () => undefined,
      onDelete: () => undefined,
    }))

    expect(html).toContain('9 格 · 15×15 尺')
    expect(html).toContain('15 尺（底部 0 尺）')
    expect(html).toContain('100 轮 · 剩余 100 轮')
    expect(html).toContain('silent-image')
  })

  it('不会把核心法术的到期边界多显示为一轮', () => {
    const area: Dnd5ePluginArea = {
      id: 'fog-cloud-area', pluginId: 'srd-5.1', featureId: 'spell:fog-cloud',
      sourceKind: 'core-spell', coreSpellId: 'fog-cloud', label: '云雾术', color: '#94a3b8',
      sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', cells: [{ col: 10, row: 5 }],
      createdRound: 1, expiresAfterRound: 601, concentrationId: 'fog-cloud',
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area, feetPerCell: 5, currentRound: 1, onClose: () => undefined, onDelete: () => undefined,
    }))
    expect(html).toContain('600 轮 · 剩余 600 轮')
    expect(html).not.toContain('601 轮')
  })

  it('显示云雾术的升环半径、球体高度、重度遮蔽与风力驱散规则', () => {
    const area: Dnd5ePluginArea = {
      id: 'fog-cloud-upcast-area', pluginId: 'srd-5.1', featureId: 'spell:fog-cloud',
      sourceKind: 'core-spell', coreSpellId: 'fog-cloud', slotLevel: 2,
      label: '云雾术', color: '#94a3b8', sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token',
      cells: Array.from({ length: 241 }, (_, index) => ({ col: index % 17, row: Math.floor(index / 17) })),
      createdRound: 2, expiresAfterRound: 602, concentrationId: 'fog-cloud',
      vertical: { mode: 'volume', baseElevationFeet: -40, heightFeet: 80, anchorOffsetFeet: -40 },
      obscuration: { kind: 'heavy' },
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area, feetPerCell: 5, currentRound: 2, onClose: () => undefined, onDelete: () => undefined,
    }))

    expect(html).toContain('半径 40 尺')
    expect(html).toContain('网格包围')
    expect(html).toContain('80 尺（底部 -40 尺）')
    expect(html).toContain('重度遮蔽')
    expect(html).toContain('时速至少 10 里')
    expect(html).toContain('由场景与 DM 通过语音处理')
  })

  it('斜向造风术显示规则线长与线宽，而不是把网格包围盒当成法术尺寸', () => {
    const area: Dnd5ePluginArea = {
      id: 'gust-area', pluginId: 'srd-5.1', featureId: 'spell:gust-of-wind',
      sourceKind: 'core-spell', coreSpellId: 'gust-of-wind', label: '造风术', color: '#7c3aed',
      sourceCharacterId: 'druid', sourceTokenId: 'druid-token',
      cells: [{ col: 9, row: 7 }, { col: 14, row: 20 }],
      createdRound: 1, expiresAfterRound: 11, concentrationId: 'gust-of-wind',
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area, feetPerCell: 5, currentRound: 1, onClose: () => undefined, onDelete: () => undefined,
    }))

    expect(html).toContain('2 格 · 60×10 尺（网格包围 30×70 尺）')
    expect(html).not.toContain('2 格 · 30×70 尺</dd>')
  })

  it('只在 DM 详情面板中显示地动术方框尺寸', () => {
    const area: Dnd5ePluginArea = {
      id: 'move-earth-area', pluginId: 'srd-5.1', featureId: 'spell:move-earth',
      sourceKind: 'core-spell', coreSpellId: 'move-earth', label: '地动术', color: '#d97706',
      sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token',
      cells: Array.from({ length: 16 }, (_, index) => ({
        col: 3 + (index % 4), row: 5 + Math.floor(index / 4),
      })),
      createdRound: 1, expiresAfterRound: 1_201, concentrationId: 'move-earth',
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area, feetPerCell: 5, currentRound: 1, onClose: () => undefined, onDelete: () => undefined,
    }))

    expect(html).toContain('区域尺寸')
    expect(html).toContain('20×20 尺')
    expect(html).not.toContain('16 格 · 20×20 尺')
  })

  it('旧战斗轮次回退时不会把剩余时长显示得比总时长更长', () => {
    const area: Dnd5ePluginArea = {
      id: 'zone-of-truth-area', pluginId: 'srd-5.1', featureId: 'spell:zone-of-truth',
      sourceKind: 'core-spell', coreSpellId: 'zone-of-truth', label: '诚实之域', color: '#3b82f6',
      sourceCharacterId: 'cleric', sourceTokenId: 'cleric-token', cells: [{ col: 10, row: 5 }],
      createdRound: 3, expiresAfterRound: 103,
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area, feetPerCell: 5, currentRound: 1, onClose: () => undefined, onDelete: () => undefined,
    }))
    expect(html).toContain('100 轮 · 剩余 100 轮')
    expect(html).not.toContain('剩余 102 轮')
  })

  it('显示法术实体的权威战斗字段', () => {
    const area: Dnd5ePluginArea = {
      id: 'unseen-servant-area', pluginId: 'srd-5.1', featureId: 'spell:unseen-servant',
      sourceKind: 'core-spell', coreSpellId: 'unseen-servant', label: '隐形仆役', color: '#94a3b8',
      sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', cells: [{ col: 4, row: 7 }],
      createdRound: 43, expiresAfterRound: 642,
      entityProfile: { armorClass: 10, hitPoints: 1, strength: 2, cannotAttack: true, invisible: true },
      entityCurrentHitPoints: 1,
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area, feetPerCell: 5, currentRound: 43, onClose: () => undefined, onDelete: () => undefined,
      onResolveEntityAttack: () => undefined,
    }))
    expect(html).toContain('AC 10 · HP 1/1')
    expect(html).toContain('力量 2 · 隐形 · 不能独立攻击')
    expect(html).toContain('d20 B（隐形劣势）')
    expect(html).toContain('结算对实体的攻击')
    expect(html).toContain('结算力量检定')
    expect(html).toContain('实体攻击（规则禁止）')
  })

  it('不再显示或触发遗留的魔嘴术物件附魔', () => {
    const area: Dnd5ePluginArea = {
      id: 'magic-mouth-area', pluginId: 'srd-5.1', featureId: 'spell:magic-mouth',
      sourceKind: 'core-spell', coreSpellId: 'magic-mouth', label: '魔嘴术', color: '#f59e0b',
      sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', cells: [{ col: 4, row: 7 }],
      createdRound: 1, expiresAfterRound: 999,
      magicMouth: {
        schemaVersion: 1,
        objectKind: 'obstacle-token',
        objectId: 'statue',
        objectLabel: '石像',
        message: '前方危险',
        trigger: '有人靠近',
        triggerMode: 'dm-observed',
        repeat: false,
      },
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area, feetPerCell: 5, currentRound: 1, onClose: () => undefined, onDelete: () => undefined,
    }))
    expect(html).not.toContain('魔嘴术物件附魔')
    expect(html).not.toContain('石像')
    expect(html).not.toContain('确认条件并触发讯息')
  })

  it('在 DM 区域详情中显示防护法阵的生物类型、方向与效果', () => {
    const area: Dnd5ePluginArea = {
      id: 'magic-circle-undead-exit', pluginId: 'srd-5.1', featureId: 'spell:magic-circle',
      sourceKind: 'core-spell', coreSpellId: 'magic-circle', label: '防护法阵', color: '#7c3aed',
      sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token',
      cells: [{ col: 8, row: 8 }, { col: 9, row: 8 }, { col: 8, row: 9 }, { col: 9, row: 9 }],
      anchorCell: { col: 8, row: 8 }, createdRound: 2, expiresAfterRound: 602,
      blocking: {
        movement: true,
        movementMode: 'exit',
        includedCreatureTypes: ['undead', '亡灵'],
      },
      occupantModifiers: {
        attacksAgainstOccupantDisadvantageCreatureTypes: ['undead'],
        conditionImmunitiesBySourceCreatureType: [{
          conditions: ['charmed', 'frightened', 'possessed'],
          sourceCreatureTypes: ['undead'],
        }],
        savingThrowAdvantagesBySourceCreatureType: [{ conditions: ['any'], sourceCreatureTypes: ['undead'] }],
      },
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area, feetPerCell: 5, currentRound: 2, onClose: () => undefined, onDelete: () => undefined,
    }))

    expect(html).toContain('防护类型')
    expect(html).toContain('亡灵')
    expect(html).toContain('反向法阵 · 禁止离开')
    expect(html).toContain('亡灵攻击法阵外目标时具有劣势')
    expect(html).toContain('法阵外目标免疫被其魅惑、恐慌或附身')
  })

  it('在 DM 区域详情中显示圣居的声明半径、结界选择、附加效果与豁免', () => {
    const area: Dnd5ePluginArea = {
      id: 'hallow-fire-vulnerability', pluginId: 'srd-5.1', featureId: 'spell:hallow',
      sourceKind: 'core-spell', coreSpellId: 'hallow', label: '圣居', color: '#f5d76e',
      sourceCharacterId: 'cleric', sourceTokenId: 'cleric-token',
      cells: Array.from({ length: 336 }, (_, index) => ({ col: index % 16, row: Math.floor(index / 16) })),
      anchorCell: { col: 3, row: 12 }, createdRound: 2, expiresAfterRound: 5_256_002,
      permanent: true,
      hallow: {
        additionalEffect: 'energy-vulnerability', damageType: 'fire',
        effectScope: 'creature-type', affectedCreatureType: 'fiend',
        wardedCreatureTypes: ['celestial', 'elemental', 'fiend', 'undead'],
      },
      triggers: [{
        id: 'hallow-effect-on-enter', label: '圣居·附加效果（进入）', timing: 'on-enter',
        savingThrow: { ability: 'cha', dc: 19, onSuccess: 'none', magical: true },
      }],
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area, feetPerCell: 5, currentRound: 2, onClose: () => undefined, onDelete: () => undefined,
    }))

    expect(html).toContain('336 格 · 半径 60 尺（网格包围 80×105 尺）')
    expect(html).toContain('全高度区域')
    expect(html).toContain('结界阻止')
    expect(html).toContain('天界生物、元素生物、邪魔、亡灵')
    expect(html).not.toContain('天界生物、元素生物、精类、邪魔、亡灵')
    expect(html).toContain('能量易伤（火焰）')
    expect(html).toContain('指定种类：邪魔')
    expect(html).toContain('魅力 DC 19；成功后忽略附加效果直至离开区域')
  })

  it('在 DM 区域详情中显示幻景地形的立方范围、外观与识破规则', () => {
    const area: Dnd5ePluginArea = {
      id: 'hallucinatory-terrain-road', pluginId: 'srd-5.1',
      featureId: 'spell:hallucinatory-terrain', sourceKind: 'core-spell',
      coreSpellId: 'hallucinatory-terrain', label: '幻景', color: '#8b5cf6',
      sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', slotLevel: 4,
      sourceSpellSaveDc: 19,
      cells: Array.from({ length: 900 }, (_, index) => ({
        col: index % 30, row: Math.floor(index / 30),
      })),
      anchorCell: { col: 15, row: 15 }, createdRound: 4, expiresAfterRound: 14_404,
      createdWorldMinute: 400, expiresAtWorldMinute: 1_840,
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 150 },
      hallucinatoryTerrain: { appearance: 'road' },
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area, feetPerCell: 5, currentRound: 4, onClose: () => undefined, onDelete: () => undefined,
    }))

    expect(html).toContain('900 格 · 150×150 尺')
    expect(html).toContain('150 尺（底部 0 尺）')
    expect(html).toContain('14400 轮 · 剩余 14400 轮')
    expect(html).toContain('不需专注')
    expect(html).toContain('幻景外观')
    expect(html).toContain('道路')
    expect(html).toContain('视觉、声音与气味')
    expect(html).toContain('触觉、人工结构、装备与生物')
    expect(html).toContain('智力（调查）DC 19')
    expect(html).toContain('模糊幻景')
  })

  it('在 DM 区域详情中显示预置幻影的形态、触发依据与循环规则', () => {
    const area: Dnd5ePluginArea = {
      id: 'programmed-illusion-creature', pluginId: 'srd-5.1',
      featureId: 'spell:programmed-illusion', sourceKind: 'core-spell',
      coreSpellId: 'programmed-illusion', label: '预置幻影', color: '#8b5cf6',
      sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', slotLevel: 6,
      sourceSpellSaveDc: 19,
      cells: Array.from({ length: 36 }, (_, index) => ({
        col: index % 6, row: Math.floor(index / 6),
      })),
      anchorCell: { col: 5, row: 5 }, createdRound: 4,
      expiresAfterRound: 5_256_004, permanent: true,
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 30 },
      programmedIllusion: { form: 'creature', triggerSense: 'auditory' },
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area, feetPerCell: 5, currentRound: 4, onClose: () => undefined, onDelete: () => undefined,
    }))

    expect(html).toContain('36 格 · 30×30 尺')
    expect(html).toContain('直到被解除')
    expect(html).toContain('幻影形态')
    expect(html).toContain('生物')
    expect(html).toContain('区域 30 尺内的听觉状况')
    expect(html).toContain('每次表演至多 5 分钟')
    expect(html).toContain('休眠 10 分钟')
    expect(html).toContain('智力（调查）检定对抗法术豁免 DC 19')
  })

  it('新预置幻影只保存大小，具体声明交给玩家与 DM', () => {
    const area: Dnd5ePluginArea = {
      id: 'programmed-illusion-table-declaration', pluginId: 'srd-5.1',
      featureId: 'spell:programmed-illusion', sourceKind: 'core-spell',
      coreSpellId: 'programmed-illusion', label: '预置幻影', color: '#8b5cf6',
      sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', slotLevel: 6,
      sourceSpellSaveDc: 19,
      cells: Array.from({ length: 16 }, (_, index) => ({
        col: index % 4, row: Math.floor(index / 4),
      })),
      anchorCell: { col: 5, row: 5 }, createdRound: 4,
      expiresAfterRound: 5_256_004, permanent: true,
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 30 },
    }
    const html = renderToStaticMarkup(createElement(Dnd5ePersistentAreaDetailPanel, {
      area, feetPerCell: 5, currentRound: 4, onClose: () => undefined, onDelete: () => undefined,
    }))

    expect(html).toContain('16 格 · 20×20 尺')
    expect(html).not.toContain('幻影形态')
    expect(html).not.toContain('触发依据')
    expect(html).toContain('具体外观、声音、行为和触发措辞由施法者通过房间语音声明')
    expect(html).toContain('每次表演至多 5 分钟')
    expect(html).toContain('智力（调查）检定对抗法术豁免 DC 19')
  })
})
