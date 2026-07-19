import { describe, expect, it } from 'vitest'
import { getEnemyDerivedCombatStats, getEnemyMaxHp, enemyHasDerivedCombat } from './enemyCombatStats'
import { ENEMY_POOL, enemyTemplateToTokenPatch } from './enemyPool'
import { ENEMY_STAT_BLOCKS, getEnemyStatBlock, getPrimaryAttackAction } from './enemyStatBlocks'

describe('SRD monster stat blocks', () => {
  it('keeps the picker and stat-block id sets identical', () => {
    expect(Object.keys(ENEMY_STAT_BLOCKS).sort()).toEqual(ENEMY_POOL.map((entry) => entry.id).sort())
  })

  it('uses the stat block as the direct source of AC, HP, to-hit, and damage', () => {
    for (const template of ENEMY_POOL) {
      const block = getEnemyStatBlock(template.id)
      const derived = getEnemyDerivedCombatStats(template.id)
      expect(block, `${template.id} should have a stat block`).toBeDefined()
      expect(derived, `${template.id} should have combat stats`).toBeDefined()
      if (!block || !derived) continue

      const primary = getPrimaryAttackAction(block)
      expect(primary?.damageDice, `${template.id} should have a primary damage action`).toMatch(/^\d+d\d+(?:[+-]\d+)?$/)
      expect(typeof primary?.toHit, `${template.id} should have a to-hit bonus`).toBe('number')
      expect(derived).toMatchObject({
        ac: block.ac,
        maxHp: block.maxHp,
        toHit: primary?.toHit,
        damageDice: primary?.damageDice,
        damageType: primary?.damageType,
        attackName: primary?.name,
      })
      expect(enemyHasDerivedCombat(template.id)).toBe(true)
    }
  })

  it('keeps picker, spawned token, and combat HP in sync', () => {
    for (const template of ENEMY_POOL) {
      const spawned = enemyTemplateToTokenPatch(template)
      expect(spawned.maxHp).toBe(template.maxHp)
      expect(getEnemyMaxHp(template.id)).toBe(template.maxHp)
      expect(getEnemyDerivedCombatStats(template.id)?.maxHp).toBe(template.maxHp)
    }
  })

  it('retains SRD breath-weapon save metadata', () => {
    const greenBreath = ENEMY_STAT_BLOCKS['wyrmling-green'].actions.find((action) => action.kind === 'aoe')
    const redBreath = ENEMY_STAT_BLOCKS['wyrmling-red'].actions.find((action) => action.kind === 'aoe')
    expect(greenBreath).toMatchObject({ damageDice: '6d6', damageType: 'poison', save: { ability: 'con', dc: 11 } })
    expect(redBreath).toMatchObject({ damageDice: '4d6', damageType: 'fire', save: { ability: 'dex', dc: 12 } })
  })
})
