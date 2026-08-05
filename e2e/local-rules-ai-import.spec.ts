import { expect, test, type Route } from '@playwright/test'

const DM = `http://127.0.0.1:${Math.max(1_024, Number(process.env.STARS_E2E_PORT_BASE) || 6_173)}`
const ACCOUNT_SESSION_KEY = 'stars-account-session:v1'
const ROOM_SESSION_KEY = 'stars-room-session:v1'
const BRIDGE_TOKEN_KEY = 'astral-trace:local-ai-bridge-token:v1'
const MODEL_ID = 'external:e2e-openai'
const UI_TIMEOUT = 20_000

const SOURCE_STAT_BLOCK = `伊利法统领虚体
中型类人生物（红龙裔），守序中立
AC：14（法师护甲）
HP：35（5d8+10）
速度：30尺
力量18，敏捷12，体质14，智力16，感知10，魅力19
技能：说服+6，察觉+2，洞悉+2，隐匿+3，运动+6
豁免：体质+4，魅力+6
伤害抗性：火焰
感官：被动察觉12
语言：通用语，龙语
挑战等级：3
吐息武器：他可以使用动作呼出破坏性的能
量。使用吐息时，他15尺锥状内的每个生物都必须进行一次敏捷豁免（dc14），豁免失
败者将受到2d6点伤害。豁免成功则伤害减 半。
不退斗志：当他的血量低于10时，他造成的所有伤害获得额外1d6的加值
施法：作为一个2级施法者，其施法主属性为魅力（豁免dc14，法术加值+6）
戏法：火焰箭，冰冻射线，光亮术，鸣雷破
一环（3法术位，目前只剩2）：命令术，法师护甲，混乱箭
动作
法杖敲击：近战武器攻击，单一目标，命中
+6，伤害：8（1d6+4）钝击伤害
呼唤伊利法军（充能6）
其可以使用一个动作祈唤（期间视为专注），在下一个其回合开始时，1d3个伊利法军兵就会出现在战场上。`

const ILIFA_SOLDIER = `伊利法军兵
中型类人生物，守序中立
AC：13
HP：11（2d8+2）
速度：30尺
力量14，敏捷12，体质12，智力10，感知10，魅力10
感官：被动察觉10
语言：通用语，龙语
挑战等级：1/4
动作
长矛：近战武器攻击，命中+4，触及5尺，单一目标。命中：5（1d6+2）穿刺伤害。`

const MODEL_DRAFT = {
  schemaVersion: 1,
  contentJson: JSON.stringify({
    name: 'DM 本地规则',
    version: '1.0.0',
    races: [],
    backgrounds: [],
    features: [],
    feats: [],
    spells: [],
    items: [],
    abilityGenerationMethods: [],
    headlessActions: [],
    subclasses: [],
    monsters: [{
      id: 'ilifa-commander-phantom',
      slug: 'ilifa-commander-phantom',
      name: '伊利法统领虚体',
      size: 'Medium',
      armorClass: 14,
      hitPoints: 35,
      skills: {},
      challenge: '3',
    }],
  }),
  assumptions: [],
  unsupported: [],
}

function jsonResponse(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'Access-Control-Allow-Origin': DM,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Private-Network': 'true',
    },
    body: JSON.stringify(body),
  })
}

test('AI monster conversion is Host-compiled and opens an editable workshop draft', async ({
  page,
  request,
}) => {
  const now = Date.now()
  const accountResponse = await request.post(`${DM}/api/accounts`, {
    data: {
      displayName: `AI import E2E ${now}`,
      clientId: `local-rules-ai-import-${now}`,
    },
  })
  expect(accountResponse.status()).toBe(201)
  const account = (await accountResponse.json() as {
    session: { accountId: string; displayName: string; sessionToken: string; createdAt: number }
  }).session
  const roomResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: `AI import room ${now}`,
      displayName: account.displayName,
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `local-rules-ai-room-${now}`,
      activePlugins: [],
    },
  })
  expect(roomResponse.status()).toBe(201)
  const room = await roomResponse.json() as {
    roomId: string
    roomName: string
    rulesetId: 'dnd5e-2014-srd-5.1'
    createdAt: number
    member: {
      memberId: string
      roomToken: string
      clientId: string
      role: 'dm'
      displayName: string
    }
  }

  let generationJobId = ''
  await page.route('http://127.0.0.1:47431/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': DM,
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Private-Network': 'true',
        },
      })
      return
    }
    if (path === '/api/healthz') {
      await jsonResponse(route, 200, { schemaVersion: 1, paired: true })
      return
    }
    if (path === '/api/models') {
      await jsonResponse(route, 200, {
        schemaVersion: 1,
        engines: { external: 'ready' },
        models: [{
          schemaVersion: 1,
          providerId: 'external-account',
          id: MODEL_ID,
          displayName: 'E2E OpenAI',
          contextWindowTokens: 128_000,
          capabilities: ['text-generation', 'structured-output'],
          supportedTasks: ['resource-structuring'],
        }],
      })
      return
    }
    if (path === '/api/generate-structured' && request.method() === 'POST') {
      const body = request.postDataJSON() as { request: { jobId: string; maxOutputTokens?: number } }
      generationJobId = body.request.jobId
      expect(body.request.maxOutputTokens).toBe(16_384)
      await jsonResponse(route, 202, {
        schemaVersion: 1,
        bridgeJobId: 'bridge-e2e-job',
        status: 'running',
      })
      return
    }
    if (path === '/api/generate-structured/bridge-e2e-job') {
      await jsonResponse(route, 200, {
        schemaVersion: 1,
        bridgeJobId: 'bridge-e2e-job',
        status: 'completed',
        result: {
          schemaVersion: 1,
          jobId: generationJobId,
          providerId: 'external-account',
          modelId: MODEL_ID,
          output: MODEL_DRAFT,
        },
      })
      return
    }
    await jsonResponse(route, 404, { error: 'not-found' })
  })

  await page.context().addInitScript(([accountKey, session, roomKey, roomSession, bridgeKey]) => {
    localStorage.setItem(accountKey, JSON.stringify(session))
    localStorage.setItem(roomKey, JSON.stringify(roomSession))
    sessionStorage.setItem(bridgeKey, 'e2e-bridge-token'.padEnd(48, 'x'))
  }, [
    ACCOUNT_SESSION_KEY,
    account,
    ROOM_SESSION_KEY,
    {
      roomId: room.roomId,
      roomName: room.roomName,
      rulesetId: room.rulesetId,
      createdAt: room.createdAt,
      ...room.member,
    },
    BRIDGE_TOKEN_KEY,
  ] as const)

  await page.goto(`${DM}/campaign/${room.roomId}/dm-tools/workshop`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('option', { name: 'E2E OpenAI' })).toBeAttached({ timeout: 15_000 })
  await page.getByTestId('local-room-json-paste-input').fill(SOURCE_STAT_BLOCK)
  await page.getByTestId('local-room-ai-convert').click()

  const preview = page.getByTestId('local-room-ai-preview')
  await expect(preview).toBeVisible({ timeout: 25_000 })
  await expect(page.getByTestId('local-room-ai-routing-result')).toContainText('当前使用单模型 E2E OpenAI')
  const draft = JSON.parse(await page.getByTestId('local-room-ai-draft-json').inputValue()) as {
    features: unknown[]
    monsters: Array<{
      id: string
      name: string
      actions: Array<{ id: string; name: string; automation: string }>
      traits: Array<{ name: string; description: string }>
      headlessMechanics: Array<{ automation: string }>
      spellcasting?: { spells?: Array<{ id: string; name: string; level: number }> }
    }>
  }
  expect(draft.features).toEqual([])
  expect(draft.monsters).toHaveLength(1)
  expect(draft.monsters[0]).toMatchObject({
    id: 'room-monster:ilifa-commander-phantom',
    name: '伊利法统领虚体',
    actions: expect.arrayContaining([expect.objectContaining({ name: '法杖敲击', automation: 'headless' })]),
    headlessMechanics: [expect.objectContaining({ automation: 'full' })],
  })
  expect(draft.monsters[0].actions).toHaveLength(2)
  expect(draft.monsters[0].actions.map((action) => action.name)).not.toContain('+6，伤害')
  expect(draft.monsters[0].traits).toEqual(expect.arrayContaining([expect.objectContaining({
      name: '吐息武器',
      description: expect.stringContaining('能量。使用吐息时'),
    })]))
  expect(draft.monsters[0].traits.map((trait) => trait.name)).not.toContain('量')
  expect(draft.monsters[0].traits.some((trait) => trait.name.startsWith('败者将受到'))).toBe(false)
  expect(draft.monsters[0].traits.map((trait) => trait.name)).not.toEqual(expect.arrayContaining(['施法', '戏法']))
  expect(draft.monsters[0].spellcasting?.spells).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: '鸣雷破', level: 0 }),
    expect.objectContaining({ name: '混乱箭', level: 1 }),
  ]))

  const workshop = page.getByTestId('monster-workshop-dialog')
  await expect(workshop).toBeVisible({ timeout: UI_TIMEOUT })
  await expect(workshop.getByText('已载入 AI 转换的“伊利法统领虚体”；请处理顶部待确认项。')).toBeVisible()
  await expect(workshop.getByTestId('monster-workshop-review-dashboard')).toContainText('DM 审核摘要', { timeout: UI_TIMEOUT })
  await expect(workshop.getByText(/草稿已自动保存/)).toBeVisible()
  await expect(workshop.getByLabel('中文名称')).toHaveValue('伊利法统领虚体')
  await expect(workshop.getByLabel('AC', { exact: true })).toHaveValue('14')
  const contentAnalysis = workshop.getByTestId('monster-workshop-content-analysis')
  await expect(contentAnalysis).toContainText('2 个法术尚无可执行定义')
  await expect(contentAnalysis).toContainText('伊利法军兵')
  await contentAnalysis.getByRole('button', { name: '粘贴从属怪物并解析' }).click()
  await workshop.getByTestId('monster-workshop-supplement-input').fill(ILIFA_SOLDIER)
  await workshop.getByTestId('monster-workshop-supplement-parse').click()
  await expect(workshop.getByText('已解析并加入从属怪物“伊利法军兵”')).toBeVisible({ timeout: UI_TIMEOUT })
  await expect(contentAnalysis).toContainText('已解析为 room-monster:')
  await expect(workshop.getByRole('button', { name: /伊利法军兵/ })).toBeVisible()
  await workshop.getByRole('button', { name: '转为 Headless 范围动作' }).first().click()
  await expect(workshop.getByLabel('吐息武器范围形状')).toHaveValue('cone')
  await expect(workshop.getByLabel('吐息武器长度')).toHaveValue('15')
  await expect(workshop.getByLabel('吐息武器豁免属性')).toHaveValue('dex')
  await expect(workshop.getByLabel('吐息武器豁免 DC')).toHaveValue('14')
  await expect(workshop.getByLabel('吐息武器伤害骰')).toHaveValue('2d6')
  const areaValidation = workshop.locator('[data-testid^="monster-area-action-validation-"]').first()
  await expect(areaValidation).toContainText('尚未接入 Headless：请选择伤害类型')
  await workshop.getByLabel('吐息武器伤害类型').selectOption('fire')
  await expect(areaValidation).toContainText('Headless 验证通过')
  await expect(workshop.getByTestId('monster-workshop-review-dashboard')).not.toContainText('吐息武器：请选择伤害类型')
  await expect(workshop.getByTestId('monster-workshop-review-dashboard')).toContainText('必填 0')

  const staffActionId = draft.monsters[0].actions.find((action) => action.name === '法杖敲击')?.id
  expect(staffActionId).toBeTruthy()
  const staffEditor = workshop.locator(`#monster-workshop-action-${staffActionId}`)
  const staffCollapseButton = staffEditor.getByRole('button').first()
  if (await staffCollapseButton.getAttribute('aria-expanded') === 'false') await staffCollapseButton.click()
  await staffEditor.getByLabel('每动作次数').fill('2')

  await workshop.getByTestId('monster-headless-sandbox-open').click()
  const sandbox = workshop.getByTestId('monster-headless-sandbox')
  await expect(sandbox).toBeVisible({ timeout: UI_TIMEOUT })
  await sandbox.getByTestId('monster-headless-sandbox-action').selectOption({ label: '法杖敲击 · 攻击' })
  await sandbox.getByLabel('沙盒目标 AC').fill('14')
  await sandbox.getByLabel('沙盒目标 HP').fill('35')
  await sandbox.getByLabel('沙盒固定 d20').fill('10')
  await sandbox.getByRole('button', { name: '按当前 d20 复现' }).click()
  await expect(sandbox.getByTestId('monster-headless-sandbox-result')).toContainText('权威事务已接受 · 法杖敲击', { timeout: UI_TIMEOUT })
  await expect(sandbox.getByTestId('monster-headless-sandbox-result')).toContainText('攻击总值 16 对 AC 14')
  await expect(sandbox.getByTestId('monster-headless-sandbox-result')).toContainText('Headless 事件链')

  await sandbox.getByTestId('monster-headless-sandbox-action').selectOption({ label: '多重攻击 · 多重攻击' })
  await sandbox.getByLabel('沙盒目标 HP').fill('35')
  await sandbox.getByLabel('沙盒固定 d20').fill('10')
  await sandbox.getByRole('button', { name: '按当前 d20 复现' }).click()
  await expect(sandbox.getByTestId('monster-headless-sandbox-result')).toContainText('权威事务已接受 · 多重攻击')
  await expect(sandbox.getByTestId('monster-headless-sandbox-result')).toContainText('共结算 2 次攻击，命中 2 次')

  await sandbox.getByTestId('monster-headless-sandbox-action').selectOption({ label: '吐息武器 · 范围豁免' })
  await sandbox.getByLabel('沙盒目标豁免加值').fill('2')
  await sandbox.getByLabel('沙盒固定 d20').fill('5')
  await sandbox.getByRole('button', { name: '按当前 d20 复现' }).click()
  await expect(sandbox.getByTestId('monster-headless-sandbox-result')).toContainText('权威事务已接受 · 吐息武器', { timeout: UI_TIMEOUT })
  await expect(sandbox.getByTestId('monster-headless-sandbox-result')).toContainText('豁免失败')
  await expect(sandbox.getByTestId('monster-headless-sandbox-result')).toContainText('DEX 豁免 7 对 DC 14')

  await workshop.getByLabel('中文名称').fill('伊利法统领虚体（修订）')
  await workshop.getByRole('button', { name: '校验并加入扩展草稿' }).click()
  await expect(workshop.getByText('已将“伊利法统领虚体（修订）”加入扩展草稿。')).toBeVisible({ timeout: UI_TIMEOUT })
  await expect(workshop.getByRole('button', { name: /伊利法统领虚体（修订）/ })).toBeVisible()

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('local-room-ai-draft-restored')).toContainText('已自动恢复当前房间的 AI 转换草稿', { timeout: UI_TIMEOUT })
  await expect(page.getByTestId('local-room-json-paste-input')).toHaveValue(SOURCE_STAT_BLOCK)
  await expect(page.getByTestId('local-room-ai-draft-json')).not.toHaveValue('')
  const restoredBuilder = page.getByTestId('custom-rules-plugin-builder')
  await expect(restoredBuilder.getByText('已自动恢复当前房间的本地草稿。')).toBeVisible({ timeout: UI_TIMEOUT })
  await expect(restoredBuilder.getByText('伊利法统领虚体（修订）', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: '删除 AI 草稿' }).click()
  await page.getByRole('dialog', { name: '删除 AI 转换草稿' }).getByRole('button', { name: '确认删除草稿' }).click()
  await expect(page.getByTestId('local-room-json-paste-input')).toHaveValue('')
  await expect(page.getByTestId('local-room-ai-preview')).toBeHidden()

  await restoredBuilder.getByRole('button', { name: '删除当前房间草稿' }).click()
  await page.getByRole('dialog', { name: '删除当前房间草稿' }).getByRole('button', { name: '确认删除草稿' }).click()
  await expect(restoredBuilder.getByText('伊利法统领虚体（修订）', { exact: true })).toHaveCount(0)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('local-room-json-paste-input')).toHaveValue('')
  await expect(page.getByTestId('custom-rules-plugin-builder').getByText('伊利法统领虚体（修订）', { exact: true })).toHaveCount(0)
})
