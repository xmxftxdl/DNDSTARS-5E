import { expect, type Locator, type Page } from '@playwright/test'

export interface CreateCoreFighterOptions {
  name: string
  abilityMethod?: 'standard-array' | 'roll-4d6'
  targetLevel?: number
}

export async function finishFighterLevelOneChoices(dialog: Locator) {
  const classSkills = dialog.getByRole('heading', { name: '战士职业技能' }).locator('..')
  await classSkills.getByRole('button').nth(0).click()
  await classSkills.getByRole('button').nth(1).click()

  const fightingStyles = dialog.getByRole('heading', { name: '战斗风格' }).locator('..')
  await fightingStyles.getByRole('button').first().click()
}

/**
 * Drive the current direct D&D 5e character-creation flow. The helper avoids
 * coupling unrelated E2E cases to the retired beginner/experienced wizard.
 */
export async function createCoreFighter(
  page: Page,
  options: CreateCoreFighterOptions,
) {
  const method = options.abilityMethod ?? 'standard-array'
  await page.getByRole('button', { name: '新建角色' }).click()
  const dialog = page.getByRole('dialog', { name: '创建角色' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('textbox', { name: '角色名称' }).fill(options.name)
  await dialog.getByRole('combobox', { name: '起始职业' }).selectOption({ label: '战士' })
  await dialog.getByRole('button', { name: '生成属性' }).click()
  await dialog.getByRole('button', {
    name: method === 'roll-4d6' ? /4d6 去最低值/ : /标准数组/,
  }).click()
  await dialog.getByRole('button', { name: '开始分配' }).click()

  if (method === 'roll-4d6') {
    for (const ability of ['力量', '敏捷', '体质', '智力', '感知', '魅力']) {
      await dialog.getByRole('button', { name: /投掷 4d6/ }).click()
      await dialog.getByText(ability, { exact: true }).locator('../..').getByRole('button').click()
    }
  }

  await dialog.getByRole('button', { name: '选择种族与背景' }).click()
  if (options.targetLevel && options.targetLevel > 1) {
    await dialog.getByRole('combobox', { name: '起始等级' }).selectOption(String(options.targetLevel))
  }
  await dialog.getByRole('button', { name: '处理 1 级选择' }).click()
  await finishFighterLevelOneChoices(dialog)
  await dialog.getByRole('button', { name: '选择起始装备' }).click()
  await dialog.getByRole('button', { name: '检查角色' }).click()
  await dialog.getByRole('button', { name: '创建角色' }).click()
}
