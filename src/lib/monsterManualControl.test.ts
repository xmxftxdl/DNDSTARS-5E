import { describe, expect, it } from 'vitest'
import type { Token } from '../store/maps'
import {
  buildDnd5eManualMonsterContinuationAttack,
  dnd5eManualMonsterActionIndexById,
  dnd5eManualMonsterActionSelection,
  dnd5eManualMonsterJumpMaximumFeet,
  dnd5eManualMonsterMovementTargetingFeet,
  dnd5eManualMonsterMultiattackContinuation,
} from './monsterManualControl'

const giantScorpion: Token = {
  id: 'giant-scorpion',
  label: '巨蝎',
  x: 0,
  y: 0,
  color: '#a855f7',
  emoji: '🦂',
  size: 2,
  type: 'enemy',
  poolId: 'srd-5.1:giant-scorpion',
  hp: 52,
  maxHp: 52,
}

describe('manual monster action identity', () => {
  it('maps the clicked stable action id to the canonical SRD index', () => {
    expect(dnd5eManualMonsterActionIndexById(
      giantScorpion,
      'sting',
      // Reproduces a presentation list index that no longer matches the
      // canonical [claw, multiattack, sting] order.
      1,
    )).toBe(2)
    expect(dnd5eManualMonsterActionSelection(giantScorpion, 2)?.action.id)
      .toBe('sting')
  })

  it('retains the rendered index for legacy actions without stable ids', () => {
    expect(dnd5eManualMonsterActionIndexById(
      giantScorpion,
      undefined,
      1,
    )).toBe(1)
  })
})

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

describe('manual staged monster actions', () => {
  const sphinx = (remaining: number): Token => ({
    id: 'androsphinx',
    label: '雄性斯芬克斯',
    x: 0,
    y: 0,
    color: '#f59e0b',
    emoji: '🦁',
    size: 3,
    type: 'enemy',
    poolId: 'srd-5.1:androsphinx',
    hp: 199,
    maxHp: 199,
    dnd5eCombatState: {
      monsterActionUsesByActionId: {
        roar: { current: remaining, max: 3 },
      },
    },
  })

  it('selects the only legal Roar stage from the live per-day counter', () => {
    expect(dnd5eManualMonsterActionSelection(sphinx(3), 2))
      .toMatchObject({ areaVariantId: 'first-roar', areaEffect: { name: '第一次咆哮' } })
    expect(dnd5eManualMonsterActionSelection(sphinx(2), 2))
      .toMatchObject({ areaVariantId: 'second-roar', areaEffect: { name: '第二次咆哮' } })
    expect(dnd5eManualMonsterActionSelection(sphinx(1), 2))
      .toMatchObject({ areaVariantId: 'third-roar', areaEffect: { name: '第三次咆哮' } })
  })
})

describe('manual monster jump targeting', () => {
  it('limits a standing long jump to half the monster Strength score', () => {
    expect(dnd5eManualMonsterJumpMaximumFeet('standing-jump', 8)).toBe(4)
    expect(dnd5eManualMonsterMovementTargetingFeet({
      kind: 'standing-jump',
      movementRemainingFeet: 30,
      strengthScore: 8,
    })).toBe(4)
  })

  it('applies Jump spell multipliers without exceeding remaining movement', () => {
    expect(dnd5eManualMonsterMovementTargetingFeet({
      kind: 'standing-jump',
      movementRemainingFeet: 30,
      strengthScore: 8,
      jumpDistanceMultiplier: 3,
    })).toBe(12)
    expect(dnd5eManualMonsterMovementTargetingFeet({
      kind: 'standing-jump',
      movementRemainingFeet: 10,
      strengthScore: 8,
      jumpDistanceMultiplier: 3,
    })).toBe(10)
  })
})
