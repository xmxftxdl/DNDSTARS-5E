import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import { getDnd5eSrdMonster } from './monsters'
import { dnd5eMonsterToEnemyTemplate } from '../../lib/enemyPool'
import { parseDnd5eMonsterStatBlock } from './monsterSchema'
import {
  createDnd5eMonsterInstanceOverride,
  dnd5eMonsterOverrideTokenPatch,
  dnd5eMonsterOverrideSaveMatchesEditRequest,
  dnd5eMonsterOverrideTargets,
  isDnd5eMonsterInstanceOverride,
  updateDnd5eMonsterInstanceAbility,
} from './monsterInstanceOverride'

describe('DM monster instance overrides', () => {
  it('preserves Drow art and variants when an existing attribute override is loaded', () => {
    const original = getDnd5eSrdMonster('srd-5.1:drow')!
    const edited = updateDnd5eMonsterInstanceAbility(original, 'drow-a', 'str', 18)
    const before = dnd5eMonsterToEnemyTemplate(original)
    const after = dnd5eMonsterToEnemyTemplate(edited)
    expect(before.tokenPortrait).toBeTruthy()
    expect(after.tokenPortrait).toBe(before.tokenPortrait)
    expect(after.initiativePortrait).toBe(before.initiativePortrait)
    expect(after.visualVariants).toEqual(before.visualVariants)
    expect(after.emoji).toBe(before.emoji)
  })
  it('isolates inline ability edits and preserves the remaining monster mechanics', () => {
    const original = getDnd5eSrdMonster('srd-5.1:minotaur')!
    const shared = createDnd5eMonsterInstanceOverride({ monster: original, tokenId: 'herd', scope: 'same-template' })
    const edited = updateDnd5eMonsterInstanceAbility(shared, 'minotaur-a', 'str', 22)
    const other = updateDnd5eMonsterInstanceAbility(shared, 'minotaur-b', 'str', 12)
    expect(edited.id).not.toBe(other.id)
    expect(edited.abilities.str).toBe(22)
    expect(shared.abilities).toEqual(original.abilities)
    expect(edited.actions[0]!.attack).toMatchObject({ toHit: 8, damage: [{ bonus: 6, average: 19 }] })
    expect(edited.actions[0]!.description).toContain('19 (2d12 + 6)')
    expect(edited.actions[1]!.attack).toMatchObject({ toHit: 8, damage: [{ bonus: 6, average: 15 }] })
    expect(updateDnd5eMonsterInstanceAbility(edited, 'minotaur-a', 'str', 22).actions).toEqual(edited.actions)
    expect(edited.hitPoints).toEqual(original.hitPoints)
    expect(parseDnd5eMonsterStatBlock(edited)).toMatchObject({ ok: true })
    expect(() => updateDnd5eMonsterInstanceAbility(shared, 'a', 'str', 31)).toThrow()
  })

  it('repairs old overrides and does not apply Strength changes to Dexterity attacks', () => {
    const minotaur = getDnd5eSrdMonster('srd-5.1:minotaur')!
    const stale = createDnd5eMonsterInstanceOverride({ monster: minotaur, tokenId: 'a', scope: 'instance' })
    stale.abilities.str = 22
    expect(updateDnd5eMonsterInstanceAbility(stale, 'a', 'str', 22).actions[0]!.attack?.toHit).toBe(8)
    const drow = getDnd5eSrdMonster('srd-5.1:drow')!
    const edited = updateDnd5eMonsterInstanceAbility(drow, 'd', 'str', 22)
    for (const [index, action] of drow.actions.entries()) {
      expect(edited.actions[index]!.attack?.toHit).toBe(action.attack?.toHit)
      expect(edited.actions[index]!.attack?.damage).toEqual(action.attack?.damage)
    }
  })
  it('only applies the stat block that the token editor originally opened', () => {
    expect(dnd5eMonsterOverrideSaveMatchesEditRequest({
      requestedMonsterId: 'room-monster:dm-override-token-dragon',
      savedMonsterId: 'room-monster:dm-override-token-dragon',
    })).toBe(true)
    expect(dnd5eMonsterOverrideSaveMatchesEditRequest({
      requestedMonsterId: 'room-monster:dm-override-token-dragon',
      savedMonsterId: 'srd-5.1:purple-worm',
    })).toBe(false)
  })

  it('clones an SRD stat block into a stable room-owned override without losing mechanics', () => {
    const goblin = getDnd5eSrdMonster('srd-5.1:goblin')!
    const override = createDnd5eMonsterInstanceOverride({
      monster: goblin,
      tokenId: 'encounter:goblin-1',
      scope: 'instance',
    })

    expect(override).toMatchObject({
      id: 'room-monster:dm-override-token-encounter-goblin-1',
      slug: 'dm-override-token-encounter-goblin-1',
      source: 'DM 自定义',
      abilities: goblin.abilities,
      actions: goblin.actions,
      traits: goblin.traits,
    })
    expect(parseDnd5eMonsterStatBlock(override)).toMatchObject({ ok: true })
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

  it('repairs legacy override ids and removes unsupported token-id characters', () => {
    const goblin = getDnd5eSrdMonster('srd-5.1:goblin')!
    const repaired = createDnd5eMonsterInstanceOverride({
      monster: {
        ...goblin,
        id: 'room-monster:dm-override:token-old_token',
        slug: 'dm-override-token-old_token',
        source: 'DM 自定义',
      },
      tokenId: 'ignored',
      scope: 'instance',
    })
    expect(repaired.id).toBe('room-monster:dm-override-token-old-token')
    expect(parseDnd5eMonsterStatBlock(repaired)).toMatchObject({ ok: true })

    const created = createDnd5eMonsterInstanceOverride({
      monster: goblin,
      tokenId: 'map_token:1',
      scope: 'instance',
    })
    expect(created.id).toBe('room-monster:dm-override-token-map-token-1')
    expect(parseDnd5eMonsterStatBlock(created)).toMatchObject({ ok: true })
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
