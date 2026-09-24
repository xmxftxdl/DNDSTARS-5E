import { describe, it, expect } from 'vitest'
import * as runtime from './dnd5eSrdAuditedSpellActivities'
import * as authoring from '../../../../scripts/content/srdSpellActivities.authoring'
import { DND5E_SRD_SPELL_CATALOG } from '../spellCatalog'
describe('declarative SRD migration parity', () => {
 it('preserves all spell definitions, Activities, and native overrides', () => {
  for (const spell of DND5E_SRD_SPELL_CATALOG) {
   expect(runtime.dnd5eSrdAuditedSpellDefinitionV1(spell.id)).toStrictEqual(authoring.dnd5eSrdAuditedSpellDefinitionV1(spell.id))
   expect(runtime.dnd5eSrdAuditedSpellActivityV1(spell.id)).toStrictEqual(authoring.dnd5eSrdAuditedSpellActivityV1(spell.id))
   expect(runtime.dnd5eSrdAuditedCoreOverrideSpellActivityV1(spell.id)).toStrictEqual(authoring.dnd5eSrdAuditedCoreOverrideSpellActivityV1(spell.id))
  }
 })
 it('preserves every registration and triggered Activity', () => {
  expect(runtime.dnd5eSrdAuditedFullContentDefinitionsV1()).toStrictEqual(authoring.dnd5eSrdAuditedFullContentDefinitionsV1())
  expect(runtime.dnd5eSrdAuditedPartialContentDefinitionsV1()).toStrictEqual(authoring.dnd5eSrdAuditedPartialContentDefinitionsV1())
  expect(runtime.dnd5eSrdAuditedManualContentDefinitionsV1()).toStrictEqual(authoring.dnd5eSrdAuditedManualContentDefinitionsV1())
 })
 it('preserves summon eligibility including invalid and fractional slots', () => {
  for(const slot of [-1,0,4,5,6,7,8,9,10,8.5,NaN,Infinity]) {
   expect(runtime.dnd5eConjureCelestialChoicesAtSlotV1(slot)).toStrictEqual(authoring.dnd5eConjureCelestialChoicesAtSlotV1(slot))
   expect(runtime.dnd5eConjureElementalChoicesAtSlotV1(slot)).toStrictEqual(authoring.dnd5eConjureElementalChoicesAtSlotV1(slot))
   expect(runtime.dnd5eConjureFeyChoicesAtSlotV1(slot)).toStrictEqual(authoring.dnd5eConjureFeyChoicesAtSlotV1(slot))
  }
  for(const formation of ['one-cr-2','two-cr-1','four-cr-half','eight-cr-quarter','invalid','__proto__']) {
   expect(runtime.dnd5eConjureMinorElementalChoicesForFormationV1(formation)).toStrictEqual(authoring.dnd5eConjureMinorElementalChoicesForFormationV1(formation))
   expect(runtime.dnd5eConjureWoodlandBeingChoicesForFormationV1(formation)).toStrictEqual(authoring.dnd5eConjureWoodlandBeingChoicesForFormationV1(formation))
  }
 })
})
