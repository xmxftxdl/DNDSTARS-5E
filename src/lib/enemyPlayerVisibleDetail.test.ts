import { afterEach, describe, expect, it } from 'vitest'
import {
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterDraft,
} from '../rulesets/dnd5e/customMonsterWorkshop'
import { setDnd5eRoomMonsterCatalog } from '../rulesets/dnd5e/roomMonsterCatalog'
import { buildEnemyPlayerVisibleDetail } from './enemyPlayerVisibleDetail'

afterEach(() => setDnd5eRoomMonsterCatalog([]))

describe('player-visible enemy detail snapshot', () => {
  it('projects a room monster without publishing inline artwork', () => {
    const monster = buildDnd5eCustomMonster({
      ...createDnd5eCustomMonsterDraft(),
      portrait: 'data:image/webp;base64,bWFzdGVy',
      tokenPortrait: 'data:image/webp;base64,dG9rZW4=',
      initiativePortrait: 'data:image/webp;base64,aW5pdGlhdGl2ZQ==',
    })
    setDnd5eRoomMonsterCatalog([monster])

    const detail = buildEnemyPlayerVisibleDetail(monster.id)

    expect(detail).toMatchObject({
      schemaVersion: 1,
      monsterId: monster.id,
      statBlock: {
        ac: monster.armorClass.value,
        maxHp: monster.hitPoints.average,
      },
    })
    expect(JSON.stringify(detail)).not.toContain('data:image/')
  })

  it('does not duplicate the bundled SRD catalogue onto map tokens', () => {
    expect(buildEnemyPlayerVisibleDetail('srd-5.1:goblin')).toBeUndefined()
  })
})
