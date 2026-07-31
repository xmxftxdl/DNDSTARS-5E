import { describe, expect, it } from 'vitest'
import { getDnd5eSrdMonster } from './monsters'

interface ExpectedDeathAreaRule {
  kind: 'death-area-saving-throw'
  ruleId: 'death-burst' | 'death-throes'
  area: {
    shape: 'circle'
    origin: 'self'
    radiusFeet: number
  }
  target: 'all-creatures-except-self'
  ability: 'con' | 'dex'
  dc: number
  damage?: {
    average: number
    count: number
    sides: number
    bonus: number
    type: 'fire' | 'slashing'
  }
  damageOnSuccessfulSave?: 'none' | 'half'
  conditionOnFailedSave?: {
    condition: 'blinded'
    durationRounds: number
    repeatSaveAtEndOfTargetTurn: boolean
  }
}

const DEATH_AREA_CASES: readonly {
  monsterId: string
  rule: ExpectedDeathAreaRule
}[] = [
  {
    monsterId: 'srd-5.1:balor',
    rule: {
      kind: 'death-area-saving-throw',
      ruleId: 'death-throes',
      area: { shape: 'circle', origin: 'self', radiusFeet: 30 },
      target: 'all-creatures-except-self',
      ability: 'dex',
      dc: 20,
      damage: {
        average: 70,
        count: 20,
        sides: 6,
        bonus: 0,
        type: 'fire',
      },
      damageOnSuccessfulSave: 'half',
    },
  },
  {
    monsterId: 'srd-5.1:dust-mephit',
    rule: {
      kind: 'death-area-saving-throw',
      ruleId: 'death-burst',
      area: { shape: 'circle', origin: 'self', radiusFeet: 5 },
      target: 'all-creatures-except-self',
      ability: 'con',
      dc: 10,
      conditionOnFailedSave: {
        condition: 'blinded',
        durationRounds: 10,
        repeatSaveAtEndOfTargetTurn: true,
      },
    },
  },
  {
    monsterId: 'srd-5.1:ice-mephit',
    rule: {
      kind: 'death-area-saving-throw',
      ruleId: 'death-burst',
      area: { shape: 'circle', origin: 'self', radiusFeet: 5 },
      target: 'all-creatures-except-self',
      ability: 'dex',
      dc: 10,
      damage: {
        average: 4,
        count: 1,
        sides: 8,
        bonus: 0,
        type: 'slashing',
      },
      damageOnSuccessfulSave: 'half',
    },
  },
  {
    monsterId: 'srd-5.1:magma-mephit',
    rule: {
      kind: 'death-area-saving-throw',
      ruleId: 'death-burst',
      area: { shape: 'circle', origin: 'self', radiusFeet: 5 },
      target: 'all-creatures-except-self',
      ability: 'dex',
      dc: 11,
      damage: {
        average: 7,
        count: 2,
        sides: 6,
        bonus: 0,
        type: 'fire',
      },
      damageOnSuccessfulSave: 'half',
    },
  },
  {
    monsterId: 'srd-5.1:magmin',
    rule: {
      kind: 'death-area-saving-throw',
      ruleId: 'death-burst',
      area: { shape: 'circle', origin: 'self', radiusFeet: 10 },
      target: 'all-creatures-except-self',
      ability: 'dex',
      dc: 11,
      damage: {
        average: 7,
        count: 2,
        sides: 6,
        bonus: 0,
        type: 'fire',
      },
      damageOnSuccessfulSave: 'half',
    },
  },
  {
    monsterId: 'srd-5.1:steam-mephit',
    rule: {
      kind: 'death-area-saving-throw',
      ruleId: 'death-burst',
      area: { shape: 'circle', origin: 'self', radiusFeet: 5 },
      target: 'all-creatures-except-self',
      ability: 'dex',
      dc: 10,
      damage: {
        average: 4,
        count: 1,
        sides: 8,
        bonus: 0,
        type: 'fire',
      },
      damageOnSuccessfulSave: 'none',
    },
  },
]

describe('SRD monster death-area and turn-start reaction catalog contracts', () => {
  it.each(DEATH_AREA_CASES)(
    'structures $monsterId as an authoritative death-area trait',
    ({ monsterId, rule }) => {
      const monster = getDnd5eSrdMonster(monsterId)
      const trait = monster?.traits.find((candidate) =>
        (candidate.rule as { kind?: string } | undefined)?.kind ===
          'death-area-saving-throw')

      expect(trait, monsterId).toBeDefined()
      expect(trait?.automation, monsterId).toBe('headless')
      expect(trait?.rule, monsterId).toEqual(rule)
    },
  )

  it('structures the Chain Devil Unnerving Mask as a turn-start reaction', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:chain-devil')
    const reaction = monster?.reactions?.find((candidate) =>
      candidate.id === 'unnerving-mask')

    expect(reaction).toMatchObject({
      id: 'unnerving-mask',
      automation: 'headless',
    })
    expect(reaction?.rule).toEqual({
      kind: 'turn-start-saving-throw-reaction',
      rangeFeet: 30,
      ability: 'wis',
      dc: 14,
      condition: 'frightened',
      duration: 'until-target-turn-end',
      magical: true,
      requiresMutualVisualSight: true,
    })
  })
})
