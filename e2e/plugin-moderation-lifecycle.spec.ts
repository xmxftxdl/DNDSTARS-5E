import { createHash } from 'node:crypto'
import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test'

const REVIEW = 'http://127.0.0.1:6176'
const ACCOUNT_SESSION_KEY = 'stars-account-session:v1'

interface AccountSession {
  accountId: string
  displayName: string
  sessionToken: string
  createdAt: number
}

async function createAccount(
  request: APIRequestContext,
  displayName: string,
  clientId: string,
): Promise<AccountSession> {
  const response = await request.post(`${REVIEW}/api/accounts`, {
    data: { displayName, clientId },
  })
  expect(response.status()).toBe(201)
  return (await response.json() as { session: AccountSession }).session
}

async function installIdentity(context: BrowserContext, account: AccountSession): Promise<void> {
  await context.addInitScript(([key, session]) => {
    localStorage.setItem(key, JSON.stringify(session))
  }, [ACCOUNT_SESSION_KEY, account] as const)
}

function pluginPackage(pluginId: string, pluginName: string, version: string, publisher: string) {
  return {
    format: 'dndstars5e-declarative',
    schemaVersion: 1,
    manifest: {
      id: pluginId,
      name: pluginName,
      version,
      apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1',
      stateSchemaVersion: 1,
      manifestSchemaVersion: 1,
      minimumGameProtocolVersion: 5,
      dependencies: [],
      conflicts: [],
      declaredCapabilities: [],
      distributionPolicy: 'room-distributable',
      contentCategory: 'rules',
      publisher,
      license: 'CC0-1.0',
      description: '插件审核生命周期测试。',
    },
    subclasses: [],
    legacy: {
      manifest: { id: pluginId },
      races: [],
      backgrounds: [],
      features: [],
      spells: [],
      items: [],
      abilityGenerationMethods: [],
    },
  }
}

async function uploadVersion(
  request: APIRequestContext,
  publisher: AccountSession,
  pluginId: string,
  pluginName: string,
  version: string,
): Promise<void> {
  const bytes = Buffer.from(JSON.stringify(
    pluginPackage(pluginId, pluginName, version, publisher.displayName),
  ), 'utf8')
  const integrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
  const response = await request.put(
    `${REVIEW}/api/accounts/me/plugins/${encodeURIComponent(pluginId)}/versions/${version}`,
    {
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Stars-Account-Token': publisher.sessionToken,
        'X-Stars-Plugin-Version': version,
        'X-Stars-Plugin-Integrity': integrity,
        'X-Stars-Plugin-Filename': encodeURIComponent(`${pluginId}-${version}.dndstars5e`),
        'X-Stars-Plugin-Name': encodeURIComponent(pluginName),
        'X-Stars-Plugin-Publisher': encodeURIComponent(publisher.displayName),
        'X-Stars-Plugin-License': encodeURIComponent('CC0-1.0'),
        'X-Stars-Plugin-State-Schema': '1',
        'X-Stars-Plugin-Api-Version': '2',
        'X-Stars-Plugin-Ruleset': 'dnd5e-2014-srd-5.1',
        'X-Stars-Plugin-Description': encodeURIComponent('插件审核生命周期测试。'),
        'X-Stars-Plugin-Metadata': encodeURIComponent(JSON.stringify({
          manifestSchemaVersion: 1,
          minimumGameProtocolVersion: 5,
          dependencies: [],
          conflicts: [],
          declaredCapabilities: [],
          distributionPolicy: 'room-distributable',
          contentCategory: 'rules',
        })),
      },
      data: bytes,
    },
  )
  expect(response.status()).toBe(201)
}

async function requestPublication(
  request: APIRequestContext,
  publisher: AccountSession,
  pluginId: string,
  version: string,
): Promise<void> {
  const response = await request.post(
    `${REVIEW}/api/accounts/me/plugins/${encodeURIComponent(pluginId)}/versions/${version}/publication`,
    {
      headers: { 'X-Stars-Account-Token': publisher.sessionToken },
      data: { visibility: 'public', changelog: `提交 ${version}` },
    },
  )
  expect(response.status()).toBe(202)
}

test('插件人工审核支持通过、举报暂停和拒绝版本', async ({ browser, request }) => {
  test.setTimeout(120_000)
  const suffix = Date.now()
  const pluginId = `e2e.moderation-${suffix}`
  const pluginName = `审核插件 ${suffix}`
  const publisher = await createAccount(request, '审核发布者', `review-publisher-${suffix}`)
  const moderator = await createAccount(request, '审核管理员', `review-admin-${suffix}`)
  const reporter = await createAccount(request, '审核举报者', `review-reporter-${suffix}`)

  await uploadVersion(request, publisher, pluginId, pluginName, '1.0.0')
  await requestPublication(request, publisher, pluginId, '1.0.0')

  const adminContext = await browser.newContext()
  await installIdentity(adminContext, moderator)
  const adminPage = await adminContext.newPage()
  await adminPage.goto(`${REVIEW}/plugins`, { waitUntil: 'domcontentloaded' })
  await adminPage.getByRole('button', { name: '审核管理' }).click()
  const pending = adminPage.locator('article').filter({ hasText: `${pluginName} v1.0.0` })
  await expect(pending).toBeVisible()
  await pending.getByRole('button', { name: '通过' }).click()
  await expect(adminPage.getByText('插件版本已通过审核。')).toBeVisible()

  const reporterContext = await browser.newContext()
  await installIdentity(reporterContext, reporter)
  const reporterPage = await reporterContext.newPage()
  await reporterPage.goto(`${REVIEW}/plugins`, { waitUntil: 'domcontentloaded' })
  await reporterPage.getByRole('button', { name: '公开目录' }).click()
  await reporterPage.getByRole('textbox', { name: '搜索插件' }).fill(pluginId)
  await reporterPage.getByRole('button', { name: '搜索', exact: true }).click()
  const published = reporterPage.locator('article').filter({ hasText: pluginId })
  await expect(published).toBeVisible()
  reporterPage.once('dialog', (dialog) => dialog.accept('该版本需要安全复核'))
  await published.getByRole('button', { name: '举报' }).click()
  await expect(reporterPage.getByText('举报已提交，审核人员可以在管理队列中查看。')).toBeVisible()

  await adminPage.reload({ waitUntil: 'domcontentloaded' })
  await adminPage.getByRole('button', { name: '审核管理' }).click()
  const report = adminPage.locator('article').filter({ hasText: '该版本需要安全复核' })
  await expect(report).toBeVisible()
  adminPage.once('dialog', (dialog) => dialog.accept('等待发布者处理安全报告'))
  await report.getByRole('button', { name: '暂停该版本' }).click()
  await expect(adminPage.getByText('审核决定已保存。')).toBeVisible()

  const hiddenCatalog = await request.get(`${REVIEW}/api/plugins/catalog?q=${encodeURIComponent(pluginId)}`)
  await expect(hiddenCatalog.json()).resolves.toMatchObject({ plugins: [] })

  await uploadVersion(request, publisher, pluginId, pluginName, '1.0.1')
  await requestPublication(request, publisher, pluginId, '1.0.1')
  await adminPage.reload({ waitUntil: 'domcontentloaded' })
  await adminPage.getByRole('button', { name: '审核管理' }).click()
  const secondPending = adminPage.locator('article').filter({ hasText: `${pluginName} v1.0.1` })
  await expect(secondPending).toBeVisible()
  adminPage.once('dialog', (dialog) => dialog.accept('版本说明不足'))
  await secondPending.getByRole('button', { name: '拒绝' }).click()
  await expect(adminPage.getByText('审核决定已保存。')).toBeVisible()

  await reporterContext.close()
  await adminContext.close()
})
