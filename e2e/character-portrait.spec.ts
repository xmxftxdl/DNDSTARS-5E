import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const SESSION_KEY = 'stars-room-session:v1'

interface Membership {
  roomId: string
  roomName: string
  rulesetId: 'dnd5e-2014-srd-5.1'
  createdAt: number
  member: {
    memberId: string
    roomToken: string
    clientId: string
    role: 'dm' | 'player'
    slot?: 'player1'
    displayName: string
  }
}

function sessionFrom(response: Membership) {
  return {
    roomId: response.roomId,
    roomName: response.roomName,
    rulesetId: response.rulesetId,
    createdAt: response.createdAt,
    ...response.member,
  }
}

test('人物立绘上传后随房间角色保存，并在刷新后恢复', async ({ page, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: '人物立绘 E2E',
      displayName: '立绘测试 DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `portrait-dm-${Date.now()}`,
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const created = await createdResponse.json() as Membership
  const joinedResponse = await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: { displayName: '立绘测试玩家', clientId: `portrait-player-${Date.now()}` },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const joined = await joinedResponse.json() as Membership

  const characterId = `portrait-${Date.now()}`
  const response = await request.put(`${DM}/api/state/characters?room=${created.roomId}`, {
    headers: {
      'X-Stars-Protocol': '5', 'X-Stars-Expected-Revision': '0',
      'X-Stars-Member': created.member.memberId, 'X-Stars-Room-Token': created.member.roomToken,
    },
    data: {
      characters: [{
        id: characterId,
        name: '立绘测试角色',
        player: joined.member.displayName,
        roomId: created.roomId,
        roomMemberId: joined.member.memberId,
        avatar: '⚔️',
        accent: 'from-amber-500 to-rose-500',
        rulesetId: 'dnd5e-2014-srd-5.1',
        race: '人类',
        charClass: '战士',
        level: 1,
        background: '士兵',
        abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
        savingThrows: ['str', 'con'],
        skills: ['athletics'],
        maxHp: 12,
        currentHp: 12,
        tempHp: 0,
        hitDice: '1d10',
        ac: 16,
        speed: 30,
        initiativeBonus: 2,
        saveDC: 12,
        passivePerception: 10,
        inspiration: 0,
        conditions: [],
        notes: '',
        dmNotes: '',
        visibleToPlayers: true,
        equipment: {},
      }],
      selectedId: characterId,
      updatedAt: Date.now(),
    },
  })
  expect(response.ok()).toBeTruthy()

  await page.goto(`${PLAYER}/characters`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [
    SESSION_KEY,
    sessionFrom(joined),
  ] as const)
  await page.reload({ waitUntil: 'domcontentloaded' })

  const editor = page.getByTestId('character-portrait-editor')
  await expect(editor).toBeVisible()
  await editor.getByLabel('上传人物立绘').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  })

  const cropDialog = page.getByRole('dialog', { name: '裁切地图 Token' })
  await expect(cropDialog).toBeVisible()
  const cropConfirm = cropDialog.getByRole('button', { name: '使用此取景' })
  await expect(cropConfirm).toBeVisible()
  const confirmBox = await cropConfirm.boundingBox()
  expect(confirmBox).not.toBeNull()
  expect(await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y)
    return hit?.closest('button')?.textContent ?? ''
  }, { x: confirmBox!.x + confirmBox!.width / 2, y: confirmBox!.y + confirmBox!.height / 2 })).toContain('使用此取景')

  await expect(editor.locator('img')).toHaveAttribute('src', /^data:image\/(?:webp|jpeg);base64,/)
  await expect.poll(async () => {
    const state = await (await request.get(`${DM}/api/state/characters?room=${created.roomId}`, {
      headers: { 'X-Stars-Member': joined.member.memberId, 'X-Stars-Room-Token': joined.member.roomToken },
    })).json() as {
      characters?: Array<{ id?: string; portrait?: string; initiativePortrait?: string }>
    }
    return state.characters?.find((character) => character.id === characterId)?.portrait ?? ''
  }, { timeout: 15_000 }).toMatch(/^data:image\/(?:webp|jpeg);base64,/)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('character-portrait-editor').locator('img')).toHaveAttribute(
    'src',
    /^data:image\/(?:webp|jpeg);base64,/,
  )
  await page.getByRole('button', { name: '编辑立绘' }).click()
  await expect(page.getByRole('dialog', { name: '编辑人物立绘' })).toBeVisible()
  await expect(page.getByLabel('上传先攻立绘')).toHaveCount(0)
  await page.getByRole('button', { name: '设置先攻取景' }).click()
  const initiativeCropDialog = page.getByRole('dialog', { name: '裁切先攻立绘' })
  await expect(initiativeCropDialog).toBeVisible()
  await initiativeCropDialog.getByRole('button', { name: '使用此取景' }).click()
  await expect.poll(async () => {
    const state = await (await request.get(`${DM}/api/state/characters?room=${created.roomId}`, {
      headers: { 'X-Stars-Member': joined.member.memberId, 'X-Stars-Room-Token': joined.member.roomToken },
    })).json() as { characters?: Array<{ id?: string; initiativePortrait?: string }> }
    return state.characters?.find((character) => character.id === characterId)?.initiativePortrait ?? ''
  }, { timeout: 15_000 }).toMatch(/^data:image\/(?:webp|jpeg);base64,/)
  await expect(page.getByRole('button', { name: 'AI 生成（稍后）' })).toBeDisabled()
})
