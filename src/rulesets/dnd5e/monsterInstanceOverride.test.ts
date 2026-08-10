import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import { getDnd5eSrdMonster } from './monsters'
import {
  createDnd5eMonsterInstanceOverride,
  dnd5eMonsterOverrideTokenPatch,
  dnd5eMonsterOverrideTargets,
  isDnd5eMonsterInstanceOverride,
} from './monsterInstanceOverride'

describe('DM monster instance overrides', () => {
  it('clones an SRD stat block into a stable room-owned override without losing mechanics', () => {
    const goblin = getDnd5eSrdMonster('srd-5.1:goblin')!
    const override = createDnd5eMonsterInstanceOverride({
      monster: goblin,
      tokenId: 'encounter:goblin-1',
      scope: 'instance',
    })

    expect(override).toMatchObject({
      id: 'room-monster:dm-override:token-encounter-goblin-1',
      slug: 'dm-override-token-encounter-goblin-1',
      source: 'DM 自定义',
      abilities: goblin.abilities,
      actions: goblin.actions,
      traits: goblin.traits,
    })
    expect(isDnd5eMonsterInstanceOverride(override.id)).toBe(true)
    expect(createDnd5eMonsterInstanceOverride({
      monster: override,
      tokenId: 'another-token',
      scope: 'instance',
    })).toEqual(override)
    expect(createDnd5eMonsterInstanceOverride({
      monster: goblin,
      tokenId: 'map-b-anchor',
      scope: 'same-template',
    }).id).not.toBe(createDnd5eMonsterInstanceOverride({
      monster: goblin,
      tokenId: 'map-a-anchor',
      scope: 'same-template',
    }).id)
  })

  it('selects either the current instance or every same-template enemy on the map', () => {
    const tokens = [
      { id: 'a', type: 'enemy', poolId: 'srd-5.1:goblin' },
      { id: 'b', type: 'enemy', poolId: 'srd-5.1:goblin' },
      { id: 'c', type: 'enemy', poolId: 'srd-5.1:wolf' },
      { id: 'player', type: 'player', poolId: 'srd-5.1:goblin' },
    ] as Token[]
    expect(dnd5eMonsterOverrideTargets({
      tokens, selectedTokenId: 'a', sourceMonsterId: 'srd-5.1:goblin', scope: 'instance',
    }).map((token) => token.id)).toEqual(['a'])
    expect(dnd5eMonsterOverrideTargets({
      tokens, selectedTokenId: 'a', sourceMonsterId: 'srd-5.1:goblin', scope: 'same-template',
    }).map((token) => token.id)).toEqual(['a', 'b'])

    const goblin = getDnd5eSrdMonster('srd-5.1:goblin')!
    const patch = dnd5eMonsterOverrideTokenPatch({
      monster: { ...goblin, size: '大型', hitPoints: { average: 5, dice: '1d10' } },
      currentHp: 7,
    })
    expect(patch).toMatchObject({ poolId: goblin.id, hp: 5, maxHp: 5, creatureSize: '大型' })
    expect(patch.size).toBeGreaterThan(1)
  })
})
