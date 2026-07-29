import { describe, expect, it } from 'vitest'
import {
  getDnd5eSrdMonster,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterTrait,
} from './monsters'

function srdMonster(slug: string): Dnd5eMonsterStatBlock {
  const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)
  if (!monster) throw new Error(`missing SRD monster: ${slug}`)
  return monster
}

function headlessTrait(
  slug: string,
  kind: string,
): Dnd5eMonsterTrait {
  const monster = srdMonster(slug)
  const traits = monster.traits.filter(
    (trait) =>
      trait.automation === 'headless' &&
      (trait.rule as { kind?: string } | undefined)?.kind === kind,
  )

  expect(traits, `${monster.id}:${kind}`).toHaveLength(1)
  return traits[0]
}

describe('SRD catalog precision attack trait declarations', () => {
  it('structures the Assassin Assassinate and 4d6 Sneak Attack traits', () => {
    expect(headlessTrait('assassin', 'assassinate').rule).toEqual({
      kind: 'assassinate',
      requiredRound: 1,
      advantageAgainst: 'target-not-yet-acted',
      automaticCriticalAgainst: 'currently-surprised',
    })

    expect(headlessTrait('assassin', 'sneak-attack').rule).toEqual({
      kind: 'sneak-attack',
      oncePerTurn: true,
      allyDistanceFeet: 5,
      requireNoDisadvantage: true,
      advantageOrAdjacentAlly: true,
      extraDamage: {
        average: 13,
        count: 4,
        sides: 6,
        bonus: 0,
        type: 'inherit-primary',
      },
    })
  })

  it('structures the Spy 2d6 Sneak Attack trait', () => {
    expect(headlessTrait('spy', 'sneak-attack').rule).toEqual({
      kind: 'sneak-attack',
      oncePerTurn: true,
      allyDistanceFeet: 5,
      requireNoDisadvantage: true,
      advantageOrAdjacentAlly: true,
      extraDamage: {
        average: 7,
        count: 2,
        sides: 6,
        bonus: 0,
        type: 'inherit-primary',
      },
    })
  })

  it('structures the Hobgoblin 2d6 Martial Advantage trait', () => {
    expect(headlessTrait('hobgoblin', 'martial-advantage').rule).toEqual({
      kind: 'martial-advantage',
      oncePerTurn: true,
      allyDistanceFeet: 5,
      requiresAdjacentAlly: true,
      extraDamage: {
        average: 7,
        count: 2,
        sides: 6,
        bonus: 0,
        type: 'inherit-primary',
      },
    })
  })
})
