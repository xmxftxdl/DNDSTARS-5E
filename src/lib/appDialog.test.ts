import { afterEach, describe, expect, it } from 'vitest'
import {
  filterAppActionChoices,
  getAppDialogSnapshot,
  resetAppDialogsForTests,
  settleAppDialog,
  showAppActionChoice,
  showAppAlert,
  showAppChoiceGroups,
  showAppConfirm,
  showAppDirectionStepper,
  showAppPrompt,
  subscribeToAppDialogs,
} from './appDialog'

afterEach(() => resetAppDialogsForTests())

describe('app dialog queue', () => {
  it('queues dialogs and resolves them in display order', async () => {
    const updates: number[] = []
    const unsubscribe = subscribeToAppDialogs(() => {
      updates.push(getAppDialogSnapshot().queuedCount)
    })
    const confirm = showAppConfirm('确认继续？')
    const prompt = showAppPrompt('输入名称', '默认名称')

    const first = getAppDialogSnapshot()
    expect(first.active).toMatchObject({ kind: 'confirm', message: '确认继续？' })
    expect(first.queuedCount).toBe(1)
    expect(settleAppDialog(first.active!.id, true)).toBe(true)
    await expect(confirm).resolves.toBe(true)

    const second = getAppDialogSnapshot()
    expect(second.active).toMatchObject({ kind: 'prompt', defaultValue: '默认名称' })
    expect(settleAppDialog(second.active!.id, '新名称')).toBe(true)
    await expect(prompt).resolves.toBe('新名称')
    expect(getAppDialogSnapshot()).toEqual({ active: null, queuedCount: 0 })
    expect(updates.length).toBeGreaterThanOrEqual(4)
    unsubscribe()
  })

  it('keeps prompt cancellation distinct from an empty value', async () => {
    const cancelled = showAppPrompt('输入内容')
    const cancelledRequest = getAppDialogSnapshot().active!
    settleAppDialog(cancelledRequest.id, null)
    await expect(cancelled).resolves.toBeNull()

    const empty = showAppPrompt('输入内容')
    const emptyRequest = getAppDialogSnapshot().active!
    settleAppDialog(emptyRequest.id, '')
    await expect(empty).resolves.toBe('')
  })

  it('provides application defaults without calling browser dialog APIs', async () => {
    const alert = showAppAlert('保存完成')
    const request = getAppDialogSnapshot().active!
    expect(request).toMatchObject({
      kind: 'alert',
      title: '提示',
      confirmLabel: '知道了',
      message: '保存完成',
    })
    settleAppDialog(request.id, true)
    await expect(alert).resolves.toBeUndefined()
  })

  it('normalizes and resolves a direction stepper without using text input', async () => {
    const pending = showAppDirectionStepper({
      title: '浮空术',
      message: '调整高度',
      defaultDirection: 'down',
      defaultValue: 13,
      minValue: 5,
      maxValue: 20,
      step: 5,
      unit: '尺',
    })
    const request = getAppDialogSnapshot().active!
    expect(request).toMatchObject({
      kind: 'direction-stepper',
      confirmLabel: '确认',
      cancelLabel: '取消',
      stepperDefaultDirection: 'down',
      stepperDefaultValue: 15,
      stepperMinValue: 5,
      stepperMaxValue: 20,
      stepperStep: 5,
      stepperUnit: '尺',
    })
    settleAppDialog(request.id, { direction: 'up', value: 10 })
    await expect(pending).resolves.toEqual({ direction: 'up', value: 10 })
  })

  it('resolves grouped visual choices as stable ids', async () => {
    const pending = showAppChoiceGroups({
      title: '防护法阵',
      message: '选择法阵参数。',
      groups: [{
        id: 'creature',
        label: '生物类型',
        options: [
          { id: 'celestial', label: '天界生物' },
          { id: 'undead', label: '亡灵' },
        ],
      }, {
        id: 'boundary',
        label: '法阵方向',
        options: [
          { id: 'enter', label: '阻止进入' },
          { id: 'exit', label: '阻止离开' },
        ],
      }],
      defaultValues: { creature: 'undead', boundary: 'exit' },
    })
    const request = getAppDialogSnapshot().active!
    expect(request).toMatchObject({
      kind: 'choice-groups',
      choiceGroupDefaultValues: { creature: 'undead', boundary: 'exit' },
    })
    settleAppDialog(request.id, { values: { creature: 'celestial', boundary: 'enter' } })
    await expect(pending).resolves.toEqual({
      values: { creature: 'celestial', boundary: 'enter' },
    })
  })

  it('resolves a direct action choice without a numbered prompt', async () => {
    const pending = showAppActionChoice({
      title: '地图交互 · 门',
      message: '选择操作。',
      layout: 'list',
      searchable: true,
      searchPlaceholder: '搜索操作',
      options: [
        { id: 'open', label: '开门', tone: 'violet' },
        { id: 'break', label: '力量破门', tone: 'rose' },
      ],
    })
    const request = getAppDialogSnapshot().active!
    expect(request).toMatchObject({
      kind: 'action-choice',
      actionChoiceLayout: 'list',
      actionChoiceSearchable: true,
      actionChoiceSearchPlaceholder: '搜索操作',
      actionChoices: [
        { id: 'open', label: '开门', tone: 'violet' },
        { id: 'break', label: '力量破门', tone: 'rose' },
      ],
    })
    settleAppDialog(request.id, 'open')
    await expect(pending).resolves.toBe('open')
  })

  it('filters direct choices by normalized label, description, and id', () => {
    const choices = [
      { id: 'bat', label: '蝙蝠（CR 0）', description: '微型野兽' },
      { id: 'giant-ape', label: '巨猿（CR 7）', description: '超大型野兽' },
      { id: 'wolf', label: '狼（CR 1/4）', description: '中型野兽' },
    ]

    expect(filterAppActionChoices(choices, '巨猿')).toEqual([choices[1]])
    expect(filterAppActionChoices(choices, 'giant ape')).toEqual([choices[1]])
    expect(filterAppActionChoices(choices, '  ')).toEqual(choices)
  })
})
