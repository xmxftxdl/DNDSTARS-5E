import { describe, expect, it } from 'vitest'
import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { Token } from '../store/maps'
import type { Character } from '../types/character'
import { decideTurnAction, hasActionableActor, pruneInitiativeForToken, pruneRecovery } from './combatTokens'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token', label: 'Token', x: 0, y: 0, color: '#fff', emoji: '', size: 1, type: 'player',
    ...patch,
  }
}

function entry(tokenId: string): InitiativeEntry {
  return { tokenId, label: tokenId, emoji: '', color: '#fff', roll: 10 }
}

describe('turn routing', () => {
  it('routes live D&D actors and skips non-combat tokens', () => {
    const hero = { id: 'hero', currentHp: 10, conditions: [] } as unknown as Character
    expect(decideTurnAction(token({ type: 'npc', hp: 10, maxHp: 10 }), [])).toBe('skip')
    expect(decideTurnAction(token({ type: 'obstacle', hp: 10, maxHp: 10 }), [])).toBe('skip')
    expect(decideTurnAction(token({ type: 'enemy', hp: 10, maxHp: 10 }), [])).toBe('enemy')
    expect(decideTurnAction(token({ type: 'player', characterId: 'hero' }), [hero])).toBe('player')
  })

  it('prunes missing tokens and skips defeated tokens', () => {
    expect(decideTurnAction(undefined, [])).toBe('prune')
    expect(decideTurnAction(token({ type: 'enemy', hp: 0, maxHp: 10 }), [])).toBe('skip')
  })

  it('parks initiative when there is no live player or enemy', () => {
    const nonActors = [
      token({ id: 'npc', type: 'npc', hp: 10, maxHp: 10 }),
      token({ id: 'wall', type: 'obstacle', hp: 10, maxHp: 10 }),
    ]
    expect(hasActionableActor([entry('npc'), entry('wall')], nonActors, [])).toBe(false)
    const withEnemy = [...nonActors, token({ id: 'enemy', type: 'enemy', hp: 10, maxHp: 10 })]
    expect(hasActionableActor([entry('npc'), entry('enemy')], withEnemy, [])).toBe(true)
  })

  it('uses standard incapacitating conditions instead of legacy counters', () => {
    const stunnedEnemy = token({
      id: 'enemy', type: 'enemy', hp: 10, maxHp: 10,
      dnd5eCombatState: { schemaVersion: 2, conditions: ['stunned'] },
    })
    const hero = {
      id: 'hero', currentHp: 10, conditions: ['stunned'],
      dnd5eCombatState: { schemaVersion: 2 },
    } as Character
    expect(decideTurnAction(stunnedEnemy, [])).toBe('skip')
    expect(decideTurnAction(token({ id: 'hero-token', type: 'player', characterId: 'hero' }), [hero])).toBe('skip')
  })
})

describe('initiative recovery', () => {
  const keyFor = (round: number, index: number, tokenId: string) => `${round}-${index}-${tokenId}`

  it('advances after pruning onto an actor that already acted', () => {
    expect(pruneRecovery([entry('solo')], 0, 3, new Set([keyFor(3, 0, 'solo')]), keyFor).advance).toBe(true)
    expect(pruneRecovery([entry('solo')], 0, 3, new Set(), keyFor).advance).toBe(false)
    expect(pruneRecovery([], 0, 3, new Set(), keyFor).advance).toBe(false)
  })

  it('clamps initiative after removing the current last token', () => {
    const pruned = pruneInitiativeForToken([entry('a'), entry('b'), entry('c')], 2, 'c')
    expect(pruned.order.map((item) => item.tokenId)).toEqual(['a', 'b'])
    expect(pruned.index).toBe(1)
  })
})
