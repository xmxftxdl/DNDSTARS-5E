import { describe, expect, it } from 'vitest'
import { DND5E_SRD_MONSTERS } from './monsters'
import { dnd5eMonsterActionAutomation, validateDnd5eMonsterCatalog, validateDnd5eMonsterSchema } from './monsterSchema'

describe('D&D 5e monster action schema', () => {
  it('keeps every current SRD monster action structurally valid', () => {
    expect(validateDnd5eMonsterCatalog(DND5E_SRD_MONSTERS)).toEqual([])
  })

  it('rejects an on-hit rule that exists only as prose', () => {
    const monster = structuredClone(DND5E_SRD_MONSTERS[0])
    const weapon = monster.actions.find((action) => action.kind === 'weapon-attack')!
    weapon.attack!.onHit = '目标倒地。'
    weapon.attack!.onHitRule = undefined
    expect(dnd5eMonsterActionAutomation(weapon)).toBe('invalid')
    expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
      actionId: weapon.id, code: 'unstructured-on-hit-rule',
    }))
  })
})
