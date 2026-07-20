import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

test('人物立绘上传后随角色保存，并在刷新后恢复', async ({ page, request }) => {
  const characterId = `portrait-${Date.now()}`
  const response = await request.put(`${DM}/api/state/characters`, {
    data: {
      characters: [{
        id: characterId,
        name: '立绘测试角色',
        player: 'player1',
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
  const editor = page.getByTestId('character-portrait-editor')
  await expect(editor).toBeVisible()
  await editor.locator('input[type="file"]').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  })

  await expect(editor.locator('img')).toHaveAttribute('src', /^data:image\/(?:webp|jpeg);base64,/)
  await expect.poll(async () => {
    const state = await (await request.get(`${DM}/api/state/characters`)).json() as {
      characters?: Array<{ id?: string; portrait?: string }>
    }
    return state.characters?.find((character) => character.id === characterId)?.portrait ?? ''
  }, { timeout: 15_000 }).toMatch(/^data:image\/(?:webp|jpeg);base64,/)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('character-portrait-editor').locator('img')).toHaveAttribute(
    'src',
    /^data:image\/(?:webp|jpeg);base64,/,
  )
  await expect(page.getByRole('button', { name: 'AI 生成（稍后）' })).toBeDisabled()
})
