import { describe, expect, it } from 'vitest'
import { dnd5eAllocateMonsterMultiattackTargets } from './monsterMultiattackTargets'

describe('monster Multiattack occurrence target allocation', () => {
  it('uses stable split targets for the Tyrannosaurus', () => {
    const allocation = dnd5eAllocateMonsterMultiattackTargets({
      monsterId: 'srd-5.1:tyrannosaurus-rex',
      actionId: 'multiattack',
      actionIds: ['bite', 'tail'],
      candidates: [{ id: 'hero-b' }, { id: 'hero-a' }],
      preferredTargetId: 'hero-b',
    })

    expect(allocation).toEqual([
      { sequenceIndex: 0, actionId: 'bite', targetId: 'hero-b' },
      { sequenceIndex: 1, actionId: 'tail', targetId: 'hero-a' },
    ])
  })

  it('prefers a split Giant Crocodile target but retains one-target fallback', () => {
    const split = dnd5eAllocateMonsterMultiattackTargets({
      monsterId: 'srd-5.1:giant-crocodile',
      actionId: 'multiattack',
      actionIds: ['bite', 'tail'],
      candidates: [{ id: 'hero-a' }, { id: 'hero-b' }],
      preferredTargetId: 'hero-a',
    })
    const fallback = dnd5eAllocateMonsterMultiattackTargets({
      monsterId: 'srd-5.1:giant-crocodile',
      actionId: 'multiattack',
      actionIds: ['bite', 'tail'],
      candidates: [{ id: 'hero-a' }],
      preferredTargetId: 'hero-a',
    })

    expect(split?.map((entry) => entry.targetId)).toEqual([
      'hero-a',
      'hero-b',
    ])
    expect(fallback?.map((entry) => entry.targetId)).toEqual([
      'hero-a',
      'hero-a',
    ])
  })

  it('honours exact Host-authored Roper and Kraken occurrence targets', () => {
    const roper = dnd5eAllocateMonsterMultiattackTargets({
      monsterId: 'srd-5.1:roper',
      actionId: 'multiattack',
      actionIds: [
        'tendril',
        'tendril',
        'tendril',
        'tendril',
        'reel',
        'bite',
      ],
      candidates: [{ id: 'hero-a' }, { id: 'hero-b' }],
      requestedTargetIds: [
        'hero-a',
        'hero-b',
        'hero-a',
        'hero-b',
        'hero-a',
        'hero-a',
      ],
    })
    const kraken = dnd5eAllocateMonsterMultiattackTargets({
      monsterId: 'srd-5.1:kraken',
      actionId: 'multiattack-two-tentacles-and-fling',
      actionIds: ['tentacle', 'tentacle', 'fling'],
      candidates: [{ id: 'hero-a' }, { id: 'hero-b' }],
      requestedTargetIds: ['hero-a', 'hero-b', 'hero-a'],
    })

    expect(roper?.map((entry) => entry.targetId)).toEqual([
      'hero-a',
      'hero-b',
      'hero-a',
      'hero-b',
      'hero-a',
      'hero-a',
    ])
    expect(kraken?.map((entry) => entry.targetId)).toEqual([
      'hero-a',
      'hero-b',
      'hero-a',
    ])
  })
})
