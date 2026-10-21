import { describe, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { bindDnd5eSpellMaterialEffects } from './spellMaterialEffectBindings'
import type { Dnd5eSpellMaterialConsumptionPlan } from './spellMaterials'

const controller = (id: string) => createDnd5eMechanicalEffect({
  id, definitionId: 'captive-soul', label: 'Bound controller', targetId: 'caster',
  source: { kind: 'spell', actorId: 'caster', rulesId: 'soul-cage', magical: true },
  duration: { type: 'permanent' },
})
const plan = (): Dnd5eSpellMaterialConsumptionPlan => ({
  expectedInventoryRevision: 1, requirementLabel: 'cage', optionLabel: 'cage',
  allocations: [{ instanceId: 'silver-cage-1', tag: 'silver-cage', quantity: 1, unitValueGp: 100,
    consumed: false, bindEffectId: 'captive-soul' }],
})

describe('physical spell material effect bindings', () => {
  it('binds only the newly created effect, retaining other removal conditions and JSON identity', () => {
    const old = controller('old')
    const fresh = { ...controller('new'), removal: { sourceLink: { sourceRequiresEffect: 'other' } } }
    const before = structuredClone([old, fresh])
    const result = bindDnd5eSpellMaterialEffects(plan(), [old], [old, fresh], [old])!
    expect(result[0]).toBe(old)
    expect(result[1].removal).toEqual({ sourceLink: { sourceRequiresEffect: 'other' }, onInventoryInstanceDestroyed: 'silver-cage-1' })
    expect(JSON.parse(JSON.stringify(result))[1].removal.onInventoryInstanceDestroyed).toBe('silver-cage-1')
    expect([old, fresh]).toEqual(before)
  })
  it('rejects missing, refreshed-only or ambiguous controllers without mutating effects', () => {
    const old = controller('old')
    for (const after of [[], [old], [controller('new'), controller('newer')]]) {
      const snapshot = structuredClone(after)
      expect(bindDnd5eSpellMaterialEffects(plan(), [old], after, [])).toBeUndefined()
      expect(after).toEqual(snapshot)
    }
  })
  it('rejects reusing an occupied cage but permits a separate cage', () => {
    const occupied = { ...controller('old'), removal: { onInventoryInstanceDestroyed: 'silver-cage-1' } }
    expect(bindDnd5eSpellMaterialEffects(plan(), [], [controller('new')], [occupied])).toBeUndefined()
    const other = plan()
    other.allocations[0].instanceId = 'silver-cage-2'
    expect(bindDnd5eSpellMaterialEffects(other, [], [controller('new')], [occupied])?.[0].removal?.onInventoryInstanceDestroyed).toBe('silver-cage-2')
  })
  it('rejects consumption, escrow and duplicate allocations atomically', () => {
    const consumed = plan(); consumed.allocations[0].consumed = true
    const stacked = plan(); stacked.allocations[0].quantity = 2
    const escrow = { ...plan(), consumptionTiming: 'spell-end' as const }
    const duplicate = plan(); duplicate.allocations = [...duplicate.allocations, ...duplicate.allocations]
    for (const invalid of [consumed, stacked, escrow, duplicate]) {
      expect(bindDnd5eSpellMaterialEffects(invalid, [], [controller('new')], [])).toBeUndefined()
    }
  })
})
