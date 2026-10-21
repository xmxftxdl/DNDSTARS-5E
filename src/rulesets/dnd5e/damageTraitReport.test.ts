import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { readDnd5eDeclaredDamageTraitReport } from './damageTraitReport'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import { DND5E_DAMAGE_TYPES } from './damageTypes'

const target = (): Parameters<typeof readDnd5eDeclaredDamageTraitReport>[0] => ({
  classState: {} as Dnd5eCombatant['classState'],
  damageImmunities: ['poison'],
  damageResistances: ['fire', 'fire'],
  damageVulnerabilities: ['cold'],
  damageDefenseRules: [{
    outcome: 'resistant', damageTypes: ['slashing'], delivery: 'weapon-attack',
    magical: false, weaponMaterialNot: 'silvered', reason: 'private-monster-feature',
  }],
})

it('preserves conditional defenses without leaking internal rule identities or aliasing Host state', () => {
  const original = target(), before = structuredClone(original)
  const report = readDnd5eDeclaredDamageTraitReport(original)
  expect(report).toEqual({
    immunities: ['poison'], resistances: ['fire'], vulnerabilities: ['cold'],
    conditional: [{ outcome: 'resistant', damageTypes: ['slashing'], delivery: 'weapon-attack',
      magical: false, weaponMaterialNot: 'silvered' }],
  })
  report.immunities.push('acid')
  ;(report.conditional[0].damageTypes as string[]).push('piercing')
  expect(original).toEqual(before)
})

it('makes divination protection indistinguishable from no damage defenses', () => {
  const protectedTarget = target()
  protectedTarget.classState.activeEffects = [createDnd5eMechanicalEffect({
    id: 'secret', definitionId: 'secret', label: 'Secret', targetId: 'target',
    source: { kind: 'spell', actorId: 'target' },
    modifiers: { spellTargetingImmunitySchools: ['divination'] },
  })]
  const unprotected = target()
  unprotected.damageImmunities = []
  unprotected.damageResistances = []
  unprotected.damageVulnerabilities = []
  unprotected.damageDefenseRules = []
  expect(readDnd5eDeclaredDamageTraitReport(protectedTarget)).toEqual(readDnd5eDeclaredDamageTraitReport(unprotected))
  expect(JSON.stringify(readDnd5eDeclaredDamageTraitReport(protectedTarget))).not.toContain('secret')
})

it('includes effect-granted defenses and removes suppressed resistance from conditional rules', () => {
  const actor = target()
  actor.classState.activeEffects = [createDnd5eMechanicalEffect({
    id: 'defenses', definitionId: 'defenses', label: 'Defenses', targetId: 'target',
    source: { kind: 'spell', actorId: 'target' },
    modifiers: { damageImmunity: 'acid', damageResistance: 'lightning',
      damageVulnerability: 'thunder', suppressDamageResistance: 'slashing' },
  })]
  const report = readDnd5eDeclaredDamageTraitReport(actor)
  expect(report.immunities).toEqual(['poison', 'acid'])
  expect(report.resistances).toEqual(['fire', 'lightning'])
  expect(report.vulnerabilities).toEqual(['cold', 'thunder'])
  expect(report.conditional).toEqual([])
})

it('reports all-damage grants while respecting type-specific suppression', () => {
  const actor = target()
  actor.classState.activeEffects = [createDnd5eMechanicalEffect({
    id: 'all', definitionId: 'all', label: 'All', targetId: 'target',
    source: { kind: 'spell', actorId: 'target' },
    modifiers: { resistanceToAllDamage: true, vulnerabilityToAllDamage: true,
      suppressDamageResistance: 'fire' },
  })]
  const report = readDnd5eDeclaredDamageTraitReport(actor)
  expect(new Set(report.resistances)).toEqual(new Set(DND5E_DAMAGE_TYPES.filter(type => type !== 'fire')))
  expect(new Set(report.vulnerabilities)).toEqual(new Set(DND5E_DAMAGE_TYPES))
  expect(actor.damageResistances).toEqual(['fire', 'fire'])
})

it('retains attack and delivery restrictions on effect-granted resistance', () => {
  const actor = target()
  actor.classState.activeEffects = [createDnd5eMechanicalEffect({
    id: 'conditional', definitionId: 'conditional', label: 'Conditional', targetId: 'target',
    source: { kind: 'spell', actorId: 'target' },
    modifiers: { conditionalDamageResistances: [{
      damageTypes: ['cold'], sourceMagical: true, attackOnly: true,
      deliveries: ['spell', 'weapon-attack'],
    }] },
  })]
  const report = readDnd5eDeclaredDamageTraitReport(actor)
  expect(report.resistances).not.toContain('cold')
  expect(report.conditional.slice(1)).toEqual([
    { outcome: 'resistant', damageTypes: ['cold'], magical: true, attackOnly: true, delivery: 'spell' },
    { outcome: 'resistant', damageTypes: ['cold'], magical: true, attackOnly: true, delivery: 'weapon-attack' },
  ])
})
