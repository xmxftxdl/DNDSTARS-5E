import { afterEach, describe, expect, it } from 'vitest'
import {
  getAppDialogSnapshot,
  resetAppDialogsForTests,
  settleAppDialog,
  showAppChoiceGroups,
} from '../../lib/appDialog'
import { promptDnd5eProtectionFromEnergyDamageType } from './protectionFromEnergyChoice'

afterEach(() => resetAppDialogsForTests())

describe('防护能量伤害类型选择', () => {
  it('列出五种规则允许的伤害类型，选择后通过确认返回稳定枚举值', async () => {
    const pending = promptDnd5eProtectionFromEnergyDamageType(showAppChoiceGroups)
    const request = getAppDialogSnapshot().active!

    expect(request).toMatchObject({
      kind: 'choice-groups',
      title: '防护能量伤害',
      message: '选择目标获得抗性的伤害类型。',
      confirmLabel: '确认',
      choiceGroupDefaultValues: { 'damage-type': 'fire' },
      choiceGroups: [{
        id: 'damage-type',
        label: '伤害类型',
        options: [
          { id: 'acid', label: '强酸' },
          { id: 'cold', label: '寒冷' },
          { id: 'fire', label: '火焰' },
          { id: 'lightning', label: '闪电' },
          { id: 'thunder', label: '雷鸣' },
        ],
      }],
    })

    settleAppDialog(request.id, { values: { 'damage-type': 'lightning' } })
    await expect(pending).resolves.toBe('lightning')
  })
})
