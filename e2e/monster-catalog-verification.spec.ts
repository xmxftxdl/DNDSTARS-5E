import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const directory = path.resolve('.codex-temp/monster-verification-20260904')
const dmBase = 'http://127.0.0.1:6973'
const playerBase = 'http://127.0.0.1:6974'
const catalog: { slug: string; name: string }[] = JSON.parse(fs.readFileSync(path.join(directory, 'catalog.json'), 'utf8'))
const weapons: { slug: string; actionId: string }[] = JSON.parse(fs.readFileSync(path.join(directory, 'weapon-ui-fixtures.json'), 'utf8'))
const challengeValue = (rating: string | undefined) => {
  const [numerator, denominator] = String(rating ?? '0').split('/').map(Number)
  return denominator ? numerator / denominator : numerator || 0
}
const mode = process.env.STARS_MONSTER_UI_MODE === 'weapons' ? 'weapons' : 'monsters'
const startIndex = Math.max(0, Number(process.env.STARS_MONSTER_UI_START) || 0)
const endIndex = Math.min(mode === 'weapons' ? weapons.length : catalog.length, Number(process.env.STARS_MONSTER_UI_END) || Infinity)
const verifiedSlugs = new Set<string>()
if (mode === 'monsters' && process.env.STARS_MONSTER_UI_SKIP_VERIFIED === '1') {
  const existingDirectory = path.join(directory, 'ui-cases', mode)
  for (const name of fs.existsSync(existingDirectory) ? fs.readdirSync(existingDirectory) : []) {
    if (!name.endsWith('.json')) continue
    const record = JSON.parse(fs.readFileSync(path.join(existingDirectory, name), 'utf8')) as { slug?: string; status?: string }
    if (record.slug && ['passed', 'inspect-only'].includes(record.status ?? '')) verifiedSlugs.add(record.slug)
  }
}
const orderedCatalog = [...catalog].sort((left: { name: string; challenge?: { rating?: string } }, right: { name: string; challenge?: { rating?: string } }) =>
  challengeValue(right.challenge?.rating) - challengeValue(left.challenge?.rating) ||
  left.name.localeCompare(right.name, 'zh-CN'))
const scenes = (mode === 'weapons' ? weapons : orderedCatalog).map((entry, index) => ({ ...entry, index }))
  .filter(entry => entry.index >= startIndex && entry.index < endIndex)
  .filter(entry => !verifiedSlugs.has(entry.slug))
  .filter(entry => {
    if (process.env.STARS_MONSTER_UI_RETRY_FAILED !== '1') return true
    const key = String(entry.index).padStart(3, '0') + '-' + entry.slug + ('actionId' in entry ? '-' + entry.actionId : '')
    const file = path.join(directory, 'ui-cases', mode, key + '.json')
    return fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).status === 'failed'
  })
const evidenceDirectory = path.join(directory, 'ui-cases', mode)
fs.mkdirSync(evidenceDirectory, { recursive: true })
let context: BrowserContext
let dm: Page
let player: Page
let fixture: Page

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  dm = await context.newPage()
  player = await context.newPage()
  fixture = await context.newPage()
  const response = await fixture.goto(`${dmBase}/.codex-temp/monster-verification-20260904/ui-controller.html`)
  expect(response?.status()).toBe(200)
  await fixture.locator('#mode').selectOption(mode)
})
test.afterAll(async () => { await context?.close() })
test.afterEach(async () => {
  await Promise.all([dm.goto('about:blank'), player.goto('about:blank')])
})

for (const entry of scenes) test(`${mode}:${entry.index}:${entry.slug}${'actionId' in entry ? ':' + entry.actionId : ''}`, async ({ request }) => {
  const evidence: Record<string, unknown> = { index: entry.index, slug: entry.slug, mode, startedAt: new Date().toISOString() }
  const key = `${String(entry.index).padStart(3, '0')}-${entry.slug}${'actionId' in entry ? '-' + entry.actionId : ''}`
  try {
    // The fixture page prepares initial state only. All combat commands below
    // are clicks on the production DM UI; no store/dispatcher is invoked here.
    await fixture.getByLabel('场景编号', { exact: true }).fill(String(entry.index))
    await fixture.getByRole('button', { name: '载入当前场景', exact: true }).click()
    await expect(fixture.getByRole('status')).toHaveText('场景已就绪', { timeout: 30_000 })
    const scenario = JSON.parse(await fixture.locator('#scenario').innerText())
    Object.assign(evidence, scenario, JSON.parse(await fixture.locator('#result').innerText()))
    await Promise.all([
      dm.goto(`${dmBase}/campaign/local/maps`),
      player.goto(`${playerBase}/campaign/local/maps`),
    ])
    await dm.getByRole('button', { name: '展开怪物控制台', exact: true }).click()
    await expect(dm.getByRole('heading', { name: scenario.name, exact: true })).toBeVisible()
    evidence.dock = await dm.getByTestId('dm-monster-control-dock').innerText()
    if (!scenario.actionId) {
      evidence.status = 'inspect-only'
      evidence.limitation = 'No direct Headless weapon action; this case checks the actual dock only.'
      return
    }
    const readState = async (name: string) => {
      const response = await request.get(`${dmBase}/api/state/${name}`, { timeout: 45_000, maxRetries: 2 })
      expect(response.ok()).toBeTruthy()
      return response.json()
    }
    await expect.poll(async () => (await readState('characters')).characters.find((character: { id: string }) => character.id === 'hero')?.maxHp).toBe(320)
    const before = (await readState('characters')).characters.find((character: { id: string }) => character.id === 'hero')
    evidence.beforeHp = before.currentHp
    await expect(player.getByRole('button', { name: new RegExp('^验证目标，先攻 10，生命值 ') })).toBeVisible({ timeout: 45_000 })
    await expect(player.getByText('正在等待 DM 同步战斗状态', { exact: true })).not.toBeVisible({ timeout: 45_000 })
    await dm.getByTestId(`manual-monster-action-${scenario.actionId}`).click()
    const notice = dm.getByRole('button', { name: '知道了', exact: true })
    if (await notice.isVisible()) await notice.click()
    await dm.getByRole('button', { name: '验证目标 选择', exact: true }).click()
    const prefix = `${scenario.name} 使用${scenario.actionName}攻击 验证目标：`
    const logPattern = new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    await dm.getByRole('button', { name: /^Log(?: \d+)?$/ }).click()
    const log = dm.getByTestId('combat-log-dock').getByText(logPattern)
    await expect(log).toBeVisible({ timeout: 60_000 })
    evidence.dmLog = await log.innerText()
    expect(evidence.dmLog).not.toContain('本次行动未结算')
    const details = dm.getByText(/^查看 Headless 结算依据/).first()
    if (await details.isVisible()) await details.click()
    evidence.dmDetails = await dm.getByTestId('combat-log-dock').innerText()
    await player.getByRole('button', { name: /^Log(?: \d+)?$/ }).click()
    const playerLog = player.getByTestId('combat-log-dock').getByText(logPattern)
    await expect(playerLog).toHaveText(evidence.dmLog as string, { timeout: 30_000 })
    evidence.playerLog = await playerLog.innerText()
    const after = (await readState('characters')).characters.find((character: { id: string }) => character.id === 'hero')
    evidence.afterHp = after.currentHp
    evidence.afterMaximumHp = after.maxHp
    evidence.conditions = after.conditions
    await expect(player.getByRole('button', { name: new RegExp(`^验证目标，先攻 10，生命值 ${after.currentHp}/${after.maxHp}`) })).toBeVisible({ timeout: 30_000 })
    await expect(dm.getByTestId(`manual-monster-action-${scenario.actionId}`)).toBeDisabled()
    const maps = await readState('maps')
    evidence.actorState = maps.maps.find((map: { id: string }) => map.id === evidence.mapId)?.tokens.find((token: { id: string }) => token.id === 'actor')?.dnd5eCombatState
    evidence.status = 'passed'
  } catch (error) {
    evidence.status = 'failed'
    evidence.error = String(error)
    evidence.dmText = await dm.locator('body').innerText().catch(() => '')
    evidence.playerText = await player.locator('body').innerText().catch(() => '')
    await dm.screenshot({ path: path.join(evidenceDirectory, `${key}-failure.png`), fullPage: true }).catch(() => {})
    throw error
  } finally {
    evidence.finishedAt = new Date().toISOString()
    if (evidence.status !== 'failed') {
      await dm.screenshot({ path: path.join(evidenceDirectory, `${key}.png`) }).catch(() => {})
    }
    fs.writeFileSync(path.join(evidenceDirectory, `${key}.json`), JSON.stringify(evidence, null, 2))
  }
})
