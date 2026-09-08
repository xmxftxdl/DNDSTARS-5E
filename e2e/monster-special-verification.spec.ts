import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.codex-temp/monster-verification-20260904')
const destination = path.join(root, 'ui-cases', 'specials')
fs.mkdirSync(destination, { recursive: true })
const start = Number(process.env.STARS_MONSTER_SPECIAL_START) || 0
const end = Number(process.env.STARS_MONSTER_SPECIAL_END) || 7
async function clickMapPoint(page: Page, point: { x: number; y: number }) {
  const canvas = page.getByTestId('map-canvas')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const viewport = await canvas.evaluate(element => ({
    x: Number(element.getAttribute('data-viewport-x')),
    y: Number(element.getAttribute('data-viewport-y')),
    scale: Number(element.getAttribute('data-viewport-scale')),
  }))
  await page.mouse.click(box!.x + viewport.x + point.x * viewport.scale,
    box!.y + viewport.y + point.y * viewport.scale)
}
for (let index = start; index < end; index += 1) test('special:' + index, async ({ browser, request }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const dm = await context.newPage()
  const player = await context.newPage()
  const fixture = await context.newPage()
  const evidence: Record<string, unknown> = { index, mode: 'specials', startedAt: new Date().toISOString() }
  const read = async (name: string) => {
    const response = await request.get('http://127.0.0.1:6973/api/state/' + name, { timeout: 45_000, maxRetries: 2 })
    expect(response.ok()).toBe(true)
    return response.json()
  }
  try {
    await fixture.goto('http://127.0.0.1:6973/.codex-temp/monster-verification-20260904/ui-controller.html')
    await fixture.locator('#mode').selectOption('specials')
    await fixture.getByLabel('场景编号', { exact: true }).fill(String(index))
    await fixture.getByRole('button', { name: '载入当前场景', exact: true }).click()
    await expect(fixture.getByRole('status')).toHaveText('场景已就绪', { timeout: 45_000 })
    const scene = JSON.parse(await fixture.locator('#scenario').innerText())
    const initial = JSON.parse(await fixture.locator('#result').innerText())
    Object.assign(evidence, scene, initial)
    await Promise.all([dm.goto('http://127.0.0.1:6973/campaign/local/maps'), player.goto('http://127.0.0.1:6974/campaign/local/maps')])
    await expect(player.getByRole('button', { name: /^验证目标，先攻 / })).toBeVisible({ timeout: 45_000 })
    await expect(player.getByText('正在等待 DM 同步战斗状态', { exact: true })).not.toBeVisible({ timeout: 45_000 })
    await expect.poll(async () => (await read('characters')).characters[0]?.maxHp).toBe(320)
    evidence.before = await read('maps')
    if (!scene.legendary) {
      await dm.getByRole('button', { name: '展开怪物控制台', exact: true }).click()
      const action = dm.getByTestId('manual-monster-action-' + scene.actionId)
      await expect(action).toHaveText('提交 DM 裁定 · ' + scene.actionName)
      evidence.status = 'passed'
      evidence.scope = '真实控制台显示 DM 裁定入口；不再把未完成的三束闪电当作普通范围动作。'
      return
    }
    await player.getByTestId('player-end-turn-top').click()
    if (!scene.actionId) {
      await expect.poll(async () => (await read('combat')).initiativeIndex, { timeout: 45_000 }).toBe(1)
      await expect(dm.getByTestId('legendary-action-window')).not.toBeVisible()
      evidence.status = 'passed'
      evidence.scope = '玩家真实结束回合；雾化吸血鬼没有非法传奇动作窗口。'
      return
    }
    const window = dm.getByTestId('legendary-action-window')
    await expect(window).toBeVisible({ timeout: 45_000 })
    evidence.window = await window.innerText()
    await window.getByRole('button').filter({ has: dm.getByText(scene.actionName, { exact: true }) }).click()
    await dm.getByTestId('legendary-action-use').click()
    if (scene.movement !== 'none') {
      const overlay = dm.getByTestId('dnd5e-activity-map-targeting-overlay')
      await expect(overlay).toBeVisible({ timeout: 60_000 })
      evidence.movementPrompt = await overlay.innerText()
      const current = await read('maps')
      const purchased = current.maps[0].tokens.find((token: { id: string }) => token.id === 'actor')
      evidence.afterPurchase = purchased
      expect(purchased.dnd5eCombatState.monsterLegendaryMovement.maximumFeet)
        .toBe(scene.slug === 'adult-red-dragon' ? 40 : 30)
      if (scene.movement === 'cancel') await overlay.getByRole('button', { name: '取消本次 Activity', exact: true }).click()
      else await clickMapPoint(dm, { x: 175, y: 175 })
    }
    await expect.poll(async () => (await read('combat')).initiativeIndex, { timeout: 60_000 }).toBe(1)
    const after = await read('maps')
    evidence.after = after
    const actor = after.maps[0].tokens.find((token: { id: string }) => token.id === 'actor')
    expect(actor.dnd5eCombatState.monsterLegendaryActionPoints).toBe(scene.actionId.includes('wing-attack') ? 1 : 2)
    expect(actor.x).toBe(initial.actorPosition.x)
    expect(actor.y).toBe(initial.actorPosition.y - (scene.movement === 'move' ? 70 : 0))
    if (scene.movement === 'move') expect(actor.dnd5eCombatState.monsterLegendaryMovement).toBeUndefined()
    await dm.getByTestId('combat-log-toggle').click()
    const log = dm.getByTestId('combat-log-dock').getByText(new RegExp(scene.name + '使用传奇动作')).first()
    await expect(log).toBeVisible()
    const dmLog = await log.innerText()
    evidence.dmLog = dmLog
    await player.getByTestId('combat-log-toggle').click()
    await expect(player.getByTestId('combat-log-dock').getByText(dmLog, { exact: true })).toBeVisible({ timeout: 30_000 })
    evidence.playerLog = evidence.dmLog
    const hero = (await read('characters')).characters[0]
    evidence.afterHp = hero.currentHp
    evidence.conditions = hero.conditions
    if (scene.actionId.includes('wing-attack')) {
      expect(hero.currentHp).toBeLessThan(320)
      expect(hero.currentHp).toBeGreaterThanOrEqual(300)
    } else expect(hero.currentHp).toBe(320)
    evidence.status = 'passed'
  } catch (error) {
    evidence.status = 'failed'
    evidence.error = String(error)
    evidence.dmText = await dm.locator('body').innerText().catch(() => '')
    evidence.playerText = await player.locator('body').innerText().catch(() => '')
    throw error
  } finally {
    evidence.finishedAt = new Date().toISOString()
    await dm.screenshot({ path: path.join(destination, String(index).padStart(2, '0') + '.png') }).catch(() => {})
    fs.writeFileSync(path.join(destination, String(index).padStart(2, '0') + '.json'), JSON.stringify(evidence, null, 2))
    await context.close()
  }
})
