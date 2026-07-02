import { describe, expect, it } from 'vitest'
import type { Token } from '../store/maps'
import type { Character, CombatSkill } from '../types/character'
import { buildEnemyDodgePreview } from './enemyDodgePreview'

const attacker = {
  id: 'archer',
  level: 11,
  abilities: {
    str: 25,
    dex: 40,
    con: 25,
    int: 25,
    wis: 25,
    cha: 25,
  },
  combatSkills: [],
} as unknown as Character

const basicShot = {
  id: 'basic-shot',
  name: 'Basic Shot',
  damageCount: 1,
  damageSides: 8,
  damageBonus: 0,
  tags: ['ranged'],
} as unknown as CombatSkill

const enemy = {
  id: 'enemy-token',
  type: 'enemy',
  label: 'Enemy',
  hp: 4,
  maxHp: 10,
} as unknown as Token

describe('enemy dodge preview', () => {
  it('does not preview when combat is inactive, target is not an enemy, or AP is unavailable', () => {
    expect(
      buildEnemyDodgePreview({
        combatActive: false,
        target: enemy,
        attacker,
        skill: basicShot,
        enemyAp: { current: 1, max: 2 },
      }),
    ).toBeNull()

    expect(
      buildEnemyDodgePreview({
        combatActive: true,
        target: { ...enemy, type: 'player' } as unknown as Token,
        attacker,
        skill: basicShot,
        enemyAp: { current: 1, max: 2 },
      }),
    ).toBeNull()

    expect(
      buildEnemyDodgePreview({
        combatActive: true,
        target: enemy,
        attacker,
        skill: basicShot,
        enemyAp: { current: 0, max: 2 },
      }),
    ).toBeNull()
  })

  it('builds the same dodge inputs formerly calculated by MapsPage', () => {
    const preview = buildEnemyDodgePreview({
      combatActive: true,
      target: enemy,
      attacker,
      skill: basicShot,
      enemyAp: { current: 1, max: 2 },
    })

    expect(preview).toMatchObject({
      attackBonus: 6,
      targetAc: 12,
      decision: {
        shouldDodge: true,
        lethal: true,
      },
    })
  })
})
