import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, dnd5eActiveSolidMaterialTraversals,
  normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { normalizeDnd5eSolidMaterialTraversal } from './solidMaterialTraversal'

const rule = { materials: ['earth', 'stone'] as const, endInside: 'eject-end-source-stun-until-next-turn-end' as const }
it('preserves the traversal rule and source binding across reload and excludes suspended effects', () => {
  const effect = createDnd5eMechanicalEffect({ definitionId: 'test:solid-traversal', label: 'Solid traversal',
    source: { kind: 'spell', actorId: 'caster', rulesId: 'test:spell', magical: true }, targetId: 'caster',
    modifiers: { solidMaterialTraversal: rule } })
  expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(true)
  const loaded = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
  expect(dnd5eActiveSolidMaterialTraversals(loaded)).toEqual([{ effect: loaded[0], rule }])
  expect(loaded[0].source.actorId).toBe('caster')
  expect(dnd5eActiveSolidMaterialTraversals([{ ...effect, suspendedBy: ['antimagic'] }])).toEqual([])
})

it.each([{}, { ...rule, materials: [] }, { ...rule, materials: ['stone', 'stone'] },
  { ...rule, materials: ['metal'] }, { ...rule, endInside: 'ignore' }, { ...rule, extra: true }])(
  'rejects an unsafe or malformed traversal rule %j', invalid => {
    expect(normalizeDnd5eSolidMaterialTraversal(invalid)).toBeUndefined()
    const effect = createDnd5eMechanicalEffect({ definitionId: 'test:solid-traversal', label: 'Test',
      source: { kind: 'dm' }, targetId: 'caster' })
    expect(validateDnd5eActiveEffectsStrict([{ ...effect, modifiers: { solidMaterialTraversal: invalid } }]).ok).toBe(false)
  },
)
