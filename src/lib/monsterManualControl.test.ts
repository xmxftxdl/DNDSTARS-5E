import { describe, expect, it } from 'vitest'
import type { Token } from '../store/maps'
import {
  buildDnd5eManualMonsterContinuationAttack,
  dnd5eMonsterAttackExecutionMode,
  dnd5eManualMonsterMultiattackContinuation,
} from './monsterManualControl'

function owlbearWithContinuation(overrides: Partial<Token> = {}): Token {
  return {
    id: 'owlbear',
    label: '枭熊',
    x: 25,
    y: 25,
    color: '#a855f7',
    emoji: '🦉',
    size: 2,
    type: 'enemy',
    poolId: 'srd-5.1:owlbear',
    hp: 59,
    maxHp: 59,
    dnd5eCombatState: {
      monsterMultiattackContinuation: {
        schemaVersion: 1,
        combatId: 'combat',
        round: 1,
        turnKey: 'combat:1:owlbear',
        parentActionId: 'multiattack',
        nextOccurrenceIndex: 1,
        sequenceActionIds: ['beak', 'claws'],
        targetIds: ['hero'],
        hitByOccurrence: [true],
      },
    },
    ...overrides,
  }
}

const hero: Token = {
  id: 'hero',
  label: '冒险者',
  x: 75,
  y: 25,
  color: '#38bdf8',
  emoji: '🧙',
  size: 1,
  type: 'player',
  characterId: 'hero-character',
}

describe('manual monster Multiattack continuation', () => {
  it('keeps a fresh DM-selected parent action out of the disabled AI loop', () => {
    expect(dnd5eMonsterAttackExecutionMode({
      actionKind: 'multiattack',
      manualControl: true,
      hasContinuationStep: false,
    })).toBe('manual-full-multiattack')
    expect(dnd5eMonsterAttackExecutionMode({
      actionKind: 'multiattack',
      manualControl: false,
      hasContinuationStep: false,
    })).toBe('automatic-sequential-multiattack')
    expect(dnd5eMonsterAttackExecutionMode({
      actionKind: 'weapon-attack',
      manualControl: true,
      hasContinuationStep: true,
    })).toBe('single')
  })

  it('projects the exact next occurrence from the Headless receipt', () => {
    expect(dnd5eManualMonsterMultiattackContinuation(owlbearWithContinuation()))
      .toMatchObject({
        parentActionId: 'multiattack',
        occurrenceIndex: 1,
        occurrenceNumber: 2,
        occurrenceCount: 2,
        actionId: 'claws',
        actionIndex: 2,
      })
  })

  it('builds one continuation attack instead of replaying the parent action', () => {
    const actor = owlbearWithContinuation()
    const live = dnd5eManualMonsterMultiattackContinuation(actor)!
    const result = buildDnd5eManualMonsterContinuationAttack({
      actor,
      target: hero,
      requested: live,
    })

    expect(result).toMatchObject({
      attacked: true,
      attackerTokenId: actor.id,
      targetTokenId: hero.id,
      actionIndex: 2,
      multiattackStep: {
        mode: 'continue',
        parentActionId: 'multiattack',
        occurrenceIndex: 1,
      },
    })
    expect(result?.attackTargetTokenIds).toEqual([hero.id])
  })

  it('rejects a stale click after the Headless receipt has advanced', () => {
    const actor = owlbearWithContinuation()
    const requested = dnd5eManualMonsterMultiattackContinuation(actor)!
    const advanced = owlbearWithContinuation({
      dnd5eCombatState: {
        monsterMultiattackContinuation: undefined,
      },
    })
    expect(buildDnd5eManualMonsterContinuationAttack({
      actor: advanced,
      target: hero,
      requested,
    })).toBeUndefined()
  })
})
