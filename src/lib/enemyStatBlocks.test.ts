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

  it('projects legendary point maximums and per-action costs for the map UI', () => {
    expect(getEnemyStatBlock('srd-5.1:aboleth')).toMatchObject({
      legendaryActionPoints: 3,
      legendaryActions: expect.arrayContaining([
        expect.objectContaining({ id: 'tail-swipe', legendaryCost: 1 }),
        expect.objectContaining({ id: 'psychic-drain-costs-2-actions', legendaryCost: 2 }),
      ]),
    })
  })
  it('projects self-only planar toggles as executable UI actions', () => {
    for (const slug of ['ghost', 'succubus-incubus']) {
      expect(getEnemyStatBlock(`srd-5.1:${slug}`)?.actions
        .find((action) => action.id === 'etherealness')).toMatchObject({
        automation: 'headless',
        kind: 'self-special',
      })
    }
  })
  it('projects ordinary self teleports as executable UI actions', () => {
    for (const [slug, actionId] of [
      ['balor', 'teleport'],
      ['marilith', 'teleport'],
      ['nalfeshnee', 'teleport'],
      ['blink-dog', 'teleport-only'],
    ] as const) {
      expect(getEnemyStatBlock(`srd-5.1:${slug}`)?.actions
        .find((action) => action.id === actionId)).toMatchObject({
        automation: 'headless',
        kind: 'self-special',
      })
    }
  })
  it('projects Draining Kiss as a targeted Headless UI action', () => {
    expect(getEnemyStatBlock('srd-5.1:succubus-incubus')?.actions
      .find((action) => action.id === 'draining-kiss')).toMatchObject({
      automation: 'headless',
      kind: 'targeted-special',
    })
  })
})
