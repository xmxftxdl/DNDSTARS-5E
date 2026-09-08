import { describe, expect, it } from 'vitest'
import {
  dnd5eActivityChoiceUsesMagicCircleGroups,
  dnd5eActivityChoiceUsesLevitateHeightStepper,
  dnd5eActivityChoiceUsesNondetectionTargetActions,
  dnd5eActivityChoiceUsesPlaneShiftModeActions,
  dnd5eActivityChoiceUsesSenseOriginActions,
  promptDnd5eActivityChoice,
} from './dnd5eActivityChoicePager'

const options = Array.from({ length: 29 }, (_, index) => ({
  id: `beast-${index + 1}`,
  label: `野兽 ${index + 1}`,
}))

describe('D&D 5e Activity choice pager', () => {
  it('shows a large Polymorph list as searchable scrolling rows', async () => {
    let actionOptions: Parameters<Parameters<typeof promptDnd5eActivityChoice>[0]['actionChoice']>[0] | undefined
    const selected = await promptDnd5eActivityChoice({
      ownerLabel: '变形术',
      choiceLabel: '生物形态',
      options,
      prompt: async () => {
        throw new Error('变形术不应回退到编号文本输入')
      },
      directionStepper: async () => null,
      choiceGroups: async () => null,
      actionChoice: async (input) => {
        actionOptions = input
        return 'beast-29'
      },
      notifyInvalid: () => undefined,
    })

    expect(actionOptions).toMatchObject({
      title: '变形术',
      message: '生物形态：请选择一个选项。',
      layout: 'list',
      searchable: true,
      searchPlaceholder: '搜索生物形态',
    })
    expect(actionOptions?.options).toHaveLength(29)
    expect(selected?.id).toBe('beast-29')
  })

  it('uses direction and five-foot controls for the complete Levitate height choice', async () => {
    const levitateOptions = [
      { id: 'down-20', label: '下降20尺' },
      { id: 'up-5', label: '上升5尺' },
      { id: 'down-5', label: '下降5尺' },
      { id: 'up-10', label: '上升10尺' },
      { id: 'down-10', label: '下降10尺' },
      { id: 'up-15', label: '上升15尺' },
      { id: 'down-15', label: '下降15尺' },
      { id: 'up-20', label: '上升20尺' },
    ]
    expect(dnd5eActivityChoiceUsesLevitateHeightStepper(levitateOptions)).toBe(true)

    let stepperOptions: Parameters<Parameters<typeof promptDnd5eActivityChoice>[0]['directionStepper']>[0] | undefined
    const selected = await promptDnd5eActivityChoice({
      ownerLabel: '浮空术',
      choiceLabel: '调整高度',
      options: levitateOptions,
      defaultOptionId: 'down-10',
      prompt: async () => {
        throw new Error('浮空术不应回退到编号文本输入')
      },
      directionStepper: async (input) => {
        stepperOptions = input
        return { direction: 'up', value: 15 }
      },
      choiceGroups: async () => null,
      actionChoice: async () => null,
      notifyInvalid: () => undefined,
    })

    expect(stepperOptions).toMatchObject({
      defaultDirection: 'down',
      defaultValue: 10,
      minValue: 5,
      maxValue: 20,
      step: 5,
      unit: '尺',
    })
    expect(selected).toMatchObject({ id: 'up-15', label: '上升15尺' })
  })

  it('shows unrelated activity choices as direct searchable rows', async () => {
    let stepperOpened = false
    let actionOptions: Parameters<Parameters<typeof promptDnd5eActivityChoice>[0]['actionChoice']>[0] | undefined
    const selected = await promptDnd5eActivityChoice({
      ownerLabel: '其他法术',
      choiceLabel: '效果',
      options: [{ id: 'a', label: '选项 A' }],
      prompt: async () => {
        throw new Error('通用选项不应回退到编号文本输入')
      },
      directionStepper: async () => {
        stepperOpened = true
        return null
      },
      choiceGroups: async () => null,
      actionChoice: async (input) => {
        actionOptions = input
        return 'a'
      },
      notifyInvalid: () => undefined,
    })
    expect(selected?.id).toBe('a')
    expect(stepperOpened).toBe(false)
    expect(actionOptions).toMatchObject({ layout: 'list', searchable: true })
  })

  it('composes Magic Circle creature and boundary cards into the existing option id', async () => {
    const magicCircleOptions = [
      { id: 'celestial-enter', label: '天界生物·禁止进入' },
      { id: 'celestial-exit', label: '天界生物·反向禁止离开' },
      { id: 'elemental-enter', label: '元素生物·禁止进入' },
      { id: 'elemental-exit', label: '元素生物·反向禁止离开' },
      { id: 'fey-enter', label: '精类·禁止进入' },
      { id: 'fey-exit', label: '精类·反向禁止离开' },
      { id: 'fiend-enter', label: '邪魔·禁止进入' },
      { id: 'fiend-exit', label: '邪魔·反向禁止离开' },
      { id: 'undead-enter', label: '亡灵·禁止进入' },
      { id: 'undead-exit', label: '亡灵·反向禁止离开' },
    ]
    expect(dnd5eActivityChoiceUsesMagicCircleGroups(magicCircleOptions)).toBe(true)

    let groups: Parameters<Parameters<typeof promptDnd5eActivityChoice>[0]['choiceGroups']>[0] | undefined
    const selected = await promptDnd5eActivityChoice({
      ownerLabel: '防护法阵',
      choiceLabel: '防护法阵效果',
      options: magicCircleOptions,
      defaultOptionId: 'fey-exit',
      prompt: async () => {
        throw new Error('防护法阵不应回退到编号文本输入')
      },
      directionStepper: async () => null,
      choiceGroups: async (input) => {
        groups = input
        return { values: { creature: 'undead', boundary: 'enter' } }
      },
      actionChoice: async () => null,
      notifyInvalid: () => undefined,
    })

    expect(groups).toMatchObject({
      defaultValues: { creature: 'fey', boundary: 'exit' },
      groups: [
        { id: 'creature', label: '生物类型' },
        { id: 'boundary', label: '法阵方向' },
      ],
    })
    expect(selected).toMatchObject({ id: 'undead-enter', label: '亡灵·禁止进入' })
  })

  it('shows Mislead sense origin as direct actions instead of numbered input', async () => {
    const senseOptions = [
      { id: 'projection', label: '投影' },
      { id: 'source', label: '本体' },
    ]
    expect(dnd5eActivityChoiceUsesSenseOriginActions(senseOptions)).toBe(true)

    let actionOptions: Parameters<Parameters<typeof promptDnd5eActivityChoice>[0]['actionChoice']>[0] | undefined
    const selected = await promptDnd5eActivityChoice({
      ownerLabel: '假象术·切换视听',
      choiceLabel: '视听来源',
      options: senseOptions,
      prompt: async () => {
        throw new Error('假象术切换视听不应回退到编号文本输入')
      },
      directionStepper: async () => null,
      choiceGroups: async () => null,
      actionChoice: async (input) => {
        actionOptions = input
        return 'source'
      },
      notifyInvalid: () => undefined,
    })

    expect(actionOptions).toMatchObject({
      title: '假象术·切换视听',
      message: '视听来源：选择本次视听来源。',
      options: [
        { id: 'projection', label: '投影' },
        { id: 'source', label: '本体' },
      ],
    })
    expect(selected).toEqual({ id: 'source', label: '本体' })
  })

  it('shows Nondetection target type as direct actions instead of numbered input', async () => {
    const targetOptions = [
      { id: 'willing-creature', label: '人物', description: '选择人物并添加状态。' },
      { id: 'place-or-mapped-object', label: '物件', description: '仅结算施法资源。' },
    ]
    expect(dnd5eActivityChoiceUsesNondetectionTargetActions(targetOptions)).toBe(true)

    let actionOptions: Parameters<Parameters<typeof promptDnd5eActivityChoice>[0]['actionChoice']>[0] | undefined
    const selected = await promptDnd5eActivityChoice({
      ownerLabel: '回避侦测',
      choiceLabel: '目标类型',
      options: targetOptions,
      prompt: async () => {
        throw new Error('回避侦测目标类型不应回退到编号文本输入')
      },
      directionStepper: async () => null,
      choiceGroups: async () => null,
      actionChoice: async (input) => {
        actionOptions = input
        return 'place-or-mapped-object'
      },
      notifyInvalid: () => undefined,
    })

    expect(actionOptions).toMatchObject({
      title: '回避侦测',
      message: '目标类型：选择人物或物件。',
      options: [
        { id: 'willing-creature', label: '人物' },
        { id: 'place-or-mapped-object', label: '物件' },
      ],
    })
    expect(selected).toEqual(targetOptions[1])
  })

  it('shows Plane Shift mode as direct willing or hostile actions', async () => {
    const modeOptions = [
      { id: 'willing-travel', label: '友方传送', description: '直接结算施法资源。' },
      { id: 'hostile-banishment', label: '敌方传送', description: '攻击命中后进行魅力豁免。' },
    ]
    expect(dnd5eActivityChoiceUsesPlaneShiftModeActions(modeOptions)).toBe(true)

    let actionOptions: Parameters<Parameters<typeof promptDnd5eActivityChoice>[0]['actionChoice']>[0] | undefined
    const selected = await promptDnd5eActivityChoice({
      ownerLabel: '异界传送',
      choiceLabel: '传送方式',
      options: modeOptions,
      prompt: async () => {
        throw new Error('异界传送方式不应回退到编号文本输入')
      },
      directionStepper: async () => null,
      choiceGroups: async () => null,
      actionChoice: async (input) => {
        actionOptions = input
        return 'hostile-banishment'
      },
      notifyInvalid: () => undefined,
    })

    expect(actionOptions).toMatchObject({
      title: '异界传送',
      message: '传送方式：选择友方传送或敌方传送。',
      options: [
        { id: 'willing-travel', label: '友方传送', tone: 'sky' },
        { id: 'hostile-banishment', label: '敌方传送', tone: 'rose' },
      ],
    })
    expect(actionOptions?.options.every((option) => option.description == null)).toBe(true)
    expect(selected).toEqual(modeOptions[1])
  })
})
