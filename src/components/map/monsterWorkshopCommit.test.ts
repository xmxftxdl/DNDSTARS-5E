import { describe, expect, it, vi } from 'vitest'
import { buildDnd5eCustomMonster, createDnd5eCustomMonsterDraft } from '../../rulesets/dnd5e/customMonsterWorkshop'
import { dnd5eMonsterToEnemyTemplate, enemyTemplateToTokenPatch, getEnemyVisualPresentation } from '../../lib/enemyPool'
import { setDnd5eRoomMonsterCatalog } from '../../rulesets/dnd5e/roomMonsterCatalog'
import { commitDnd5eMonsterWorkshopMonster } from './monsterWorkshopCommit'

describe('monster workshop commit scope', () => {
  it('keeps an ordinary plugin save inside the extension draft', async () => {
    const monster = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    const onPluginMonstersChange = vi.fn()
    const upsertRoomMonster = vi.fn(async () => undefined)

    await expect(commitDnd5eMonsterWorkshopMonster({
      monster,
      pluginMode: true,
      destination: 'default',
      existingMonsters: [],
      onPluginMonstersChange,
      upsertRoomMonster,
    })).resolves.toEqual({ savedToPluginDraft: true, savedToCurrentRoom: false })

    expect(onPluginMonstersChange).toHaveBeenCalledWith([monster])
    expect(upsertRoomMonster).not.toHaveBeenCalled()
  })

  it('can also write a plugin monster into the room catalogue for map placement', async () => {
    const monster = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    const onPluginMonstersChange = vi.fn()
    const upsertRoomMonster = vi.fn(async () => undefined)

    await expect(commitDnd5eMonsterWorkshopMonster({
      monster,
      pluginMode: true,
      destination: 'current-room',
      existingMonsters: [],
      onPluginMonstersChange,
      upsertRoomMonster,
    })).resolves.toEqual({ savedToPluginDraft: true, savedToCurrentRoom: true })

    expect(onPluginMonstersChange).toHaveBeenCalledWith([monster])
    expect(upsertRoomMonster).toHaveBeenCalledWith(monster)
  })

  it('converts a room monster into a placeable enemy Token patch without rewriting its id', () => {
    const monster = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    const template = dnd5eMonsterToEnemyTemplate(monster)

    expect(enemyTemplateToTokenPatch(template)).toMatchObject({
      type: 'enemy',
      label: monster.name,
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
  })

  it('preserves AI portrait crops and falls back to the master portrait when crops are unfinished', () => {
    const master = 'data:image/webp;base64,bWFzdGVy'
    const token = 'data:image/webp;base64,dG9rZW4='
    const initiative = 'data:image/webp;base64,aW5pdGlhdGl2ZQ=='
    const cropped = buildDnd5eCustomMonster({
      ...createDnd5eCustomMonsterDraft(),
      portrait: master,
      tokenPortrait: token,
      initiativePortrait: initiative,
    })
    const unfinished = buildDnd5eCustomMonster({
      ...createDnd5eCustomMonsterDraft(),
      id: 'room-monster:unfinished-portrait',
      slug: 'unfinished-portrait',
      portrait: master,
    })

    expect(dnd5eMonsterToEnemyTemplate(cropped)).toMatchObject({
      tokenPortrait: token,
      initiativePortrait: initiative,
    })
    expect(dnd5eMonsterToEnemyTemplate(unfinished)).toMatchObject({
      tokenPortrait: master,
      initiativePortrait: master,
    })

    setDnd5eRoomMonsterCatalog([cropped])
    try {
      expect(getEnemyVisualPresentation(cropped.id)).toEqual({
        tokenPortrait: token,
        initiativePortrait: initiative,
      })
    } finally {
      setDnd5eRoomMonsterCatalog([])
    }
  })
})
