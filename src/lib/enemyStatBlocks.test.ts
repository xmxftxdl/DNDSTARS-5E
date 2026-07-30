import { describe, expect, it } from 'vitest'
import { getEnemyDerivedCombatStats, getEnemyMaxHp, enemyHasDerivedCombat } from './enemyCombatStats'
import { DND5E_SRD_ENEMY_POOL, ENEMY_POOL, enemyTemplateToTokenPatch } from './enemyPool'
import { getEnemyStatBlock, getPrimaryAttackAction } from './enemyStatBlocks'
import { DND5E_SRD_MONSTERS } from '../rulesets/dnd5e/monsters'

describe('SRD 5.1 monster stat-block adapter', () => {
  it('exposes only namespaced SRD catalog templates in the built-in pool', () => {
    expect(ENEMY_POOL).toBe(DND5E_SRD_ENEMY_POOL)
    expect(ENEMY_POOL.length).toBeGreaterThan(300)
    expect(ENEMY_POOL.every((entry) => entry.id.startsWith('srd-5.1:'))).toBe(true)
  })

  it('derives representative combat values from the canonical SRD stat block', () => {
    for (const id of ['srd-5.1:goblin', 'srd-5.1:wolf', 'srd-5.1:owlbear']) {
      const template = DND5E_SRD_ENEMY_POOL.find((entry) => entry.id === id)!
      const block = getEnemyStatBlock(id)
      const derived = getEnemyDerivedCombatStats(id)
      const primary = block ? getPrimaryAttackAction(block) : undefined
      expect(block, id).toBeDefined()
      expect(primary?.damageDice, id).toMatch(/^\d+d\d+(?:[+-]\d+)?$/)
      expect(derived, id).toMatchObject({
        ac: block?.ac,
        maxHp: block?.maxHp,
        toHit: primary?.toHit,
        damageDice: primary?.damageDice,
      })
      expect(enemyHasDerivedCombat(id)).toBe(true)
      const spawned = enemyTemplateToTokenPatch(template)
      expect(spawned.maxHp).toBe(template.maxHp)
      expect(getEnemyMaxHp(id)).toBe(template.maxHp)
    }
  })

  it('migrates a legacy bare slug without falling back to old custom stats', () => {
    expect(getEnemyStatBlock('goblin')).toMatchObject({ ac: 15, maxHp: 7 })
    expect(getEnemyStatBlock('slime')).toBeUndefined()
    expect(getEnemyStatBlock('mage-apprentice')).toBeUndefined()
  })

  it('keeps DM action indexes aligned with the canonical catalog after adding Multiattack variants', () => {
    for (const monster of DND5E_SRD_MONSTERS) {
      const displayed = getEnemyStatBlock(monster.id)?.actions
      expect(
        displayed?.map((action) => action.name),
        monster.id,
      ).toEqual(monster.actions.map((action) => action.name))
    }
  })
})
