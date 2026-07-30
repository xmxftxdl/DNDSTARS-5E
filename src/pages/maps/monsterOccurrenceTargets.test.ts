import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import {
  dnd5eMapKnownUnusedMonsterOccurrence,
  dnd5eMapMonsterOccurrenceTarget,
  dnd5eMapMonsterRandomRepeatTargetIds,
  dnd5eMapMonsterStableOccurrenceTargetIds,
} from './monsterOccurrenceTargets'

function token(id: string): Token {
  return {
    id,
    label: id,
    x: 0,
    y: 0,
    color: '',
    emoji: '',
    size: 1,
    type: 'player',
  }
}

describe('Maps monster occurrence targets', () => {
  it('resolves exact Roper/Kraken sequence targets by sequence index', () => {
    const fallback = token('fallback')
    const heroA = token('hero-a')
    const heroB = token('hero-b')
    const occurrences = [
      { sequenceIndex: 0, targetId: heroA.id },
      { sequenceIndex: 1, targetId: heroB.id },
      { sequenceIndex: 2, targetId: heroA.id },
    ]

    expect(dnd5eMapMonsterOccurrenceTarget(
      occurrences,
      [heroA, heroB],
      1,
      fallback,
    )).toBe(heroB)
    expect(dnd5eMapMonsterOccurrenceTarget(
      occurrences,
      [heroA, heroB],
      2,
      fallback,
    )).toBe(heroA)
  })

  it('falls back safely and trims random-repeat targets to the rolled count', () => {
    const fallback = token('fallback')
    expect(dnd5eMapMonsterOccurrenceTarget(
      [{ sequenceIndex: 0, targetId: 'missing' }],
      [],
      0,
      fallback,
    )).toBe(fallback)
    expect(dnd5eMapMonsterRandomRepeatTargetIds(
      ['hero-a', 'hero-b', 'hero-c', 'hero-d'],
      2,
    )).toEqual(['hero-a', 'hero-b'])
  })

  it('allocates a Tyrannosaurus bite and tail to stable different targets', () => {
    expect(dnd5eMapMonsterStableOccurrenceTargetIds({
      monsterId: 'srd-5.1:tyrannosaurus-rex',
      parentActionId: 'multiattack',
      actionIds: ['bite', 'tail'],
      candidateTargetIds: ['hero-c', 'hero-b', 'hero-a'],
      preferredTargetId: 'hero-c',
    })).toEqual(['hero-c', 'hero-a'])
  })

  it('backtracks Kraken flings onto only the three linked candidates', () => {
    const linked = new Set(['linked-a', 'linked-b', 'linked-c'])
    expect(dnd5eMapMonsterStableOccurrenceTargetIds({
      monsterId: 'srd-5.1:kraken',
      parentActionId: 'multiattack-flings',
      actionIds: ['fling', 'fling', 'fling'],
      candidateTargetIds: [
        'unlinked-preferred',
        'linked-c',
        'linked-b',
        'linked-a',
        'unlinked-other',
      ],
      preferredTargetId: 'unlinked-preferred',
      canTarget: ({ targetId }) => linked.has(targetId),
    })).toEqual(['linked-a', 'linked-b', 'linked-c'])
  })

  it('marks the Grick beak unused after its tentacles miss', () => {
    expect(dnd5eMapKnownUnusedMonsterOccurrence({
      monsterId: 'srd-5.1:grick',
      parentActionId: 'multiattack',
      sequenceIndex: 1,
      targetId: 'hero-a',
      settledOccurrences: [{
        sequenceIndex: 0,
        targetId: 'hero-a',
        hit: false,
      }],
    })).toBe('requires-previous-hit')
    expect(dnd5eMapKnownUnusedMonsterOccurrence({
      monsterId: 'srd-5.1:grick',
      parentActionId: 'multiattack',
      sequenceIndex: 1,
      targetId: 'hero-a',
      settledOccurrences: [{
        sequenceIndex: 0,
        targetId: 'hero-a',
        hit: true,
      }],
    })).toBeUndefined()
  })

  it('marks the Roper bite unused when no tendril relation is available', () => {
    expect(dnd5eMapKnownUnusedMonsterOccurrence({
      monsterId: 'srd-5.1:roper',
      parentActionId: 'multiattack',
      sequenceIndex: 5,
      targetId: 'hero-a',
      settledOccurrences: [],
      targetLinkedRelationAvailable: false,
    })).toBe('target-linked-relation-unavailable')
  })
})
