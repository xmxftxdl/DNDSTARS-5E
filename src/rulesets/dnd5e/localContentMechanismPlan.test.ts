import { describe, expect, it } from 'vitest'
import contracts from './declarativeSubclassAbility.ts?raw'
import { DND5E_AI_MECHANIC_INDEX, focusDnd5eSubclassContracts, validDnd5eLocalContentMechanismPlan } from './localContentMechanismPlan'
import { dnd5eLocalContentAiSdkGuide } from './localContentAiSdkGuide'

describe('bounded rule mechanism retrieval', () => {
  it('covers every mechanic in the public subclass contract, with no invisible inline alternatives', () => {
    const union = contracts.slice(contracts.indexOf('  mechanic?:'), contracts.indexOf('  canModifyEnemyD20?:'))
    expect(union).not.toMatch(/\|\s*\{/u)
    const names = [...union.matchAll(/\|\s*(Declarative\w+MechanicV1)/gu)].map(match => match[1])
    expect(names.length).toBeGreaterThan(30)
    expect(DND5E_AI_MECHANIC_INDEX.map(entry => entry.name).sort()).toEqual(names.sort())
  })
  it('indexes missed-melee redirection with its cross-field execution constraints', () => {
    const entry = DND5E_AI_MECHANIC_INDEX.find(entry => entry.kind === 'missed-melee-redirection')
    expect(entry?.text).toContain('trigger after-attack-miss')
    expect(entry?.text).toContain('cost.economy reaction')
    const focused = focusDnd5eSubclassContracts(contracts, { mechanics: ['missed-melee-redirection'], needsActivities: false, needsAreas: false })
    expect(focused).toContain('export interface DeclarativeMissedMeleeRedirectionMechanicV1')
    expect(focused).toContain('| DeclarativeMissedMeleeRedirectionMechanicV1')
    expect(focusDnd5eSubclassContracts(contracts, { mechanics: [], needsActivities: false, needsAreas: false })).not.toContain('export interface DeclarativeMissedMeleeRedirectionMechanicV1')
  })
  it('indexes actual declarations and retains the selected mechanic and shared contracts', () => {
    const plan = { mechanics: ['damage-mitigation-interrupt'], needsActivities: false, needsAreas: false }
    expect(DND5E_AI_MECHANIC_INDEX.length).toBeGreaterThan(30)
    expect(new Set(DND5E_AI_MECHANIC_INDEX.map(entry => entry.kind)).size).toBe(DND5E_AI_MECHANIC_INDEX.length)
    const focused = focusDnd5eSubclassContracts(contracts.slice(0, contracts.indexOf('const ID =')), plan)
    expect(focused).toContain('export interface DeclarativeDamageMitigationInterruptMechanicV1')
    expect(focused).toContain('reductionDice?:')
    expect(focused).toContain('export interface DeclarativeSubclassAbilityV1')
    expect(focused).not.toContain('export interface DeclarativeWardPoolMechanicV1')
    expect(focused).not.toContain('| DeclarativeWardPoolMechanicV1')
    const guide = dnd5eLocalContentAiSdkGuide('subclass', '原文', plan)
    expect(guide.length).toBeLessThan(dnd5eLocalContentAiSdkGuide('subclass', '原文').length * 0.7)
    expect(guide).toContain('includeSelf:false')
    expect(guide).toContain('export type Dnd5eAdvancementDefinitionV1')
    expect(guide).toContain("kind: 'build-grant'")
  })
  it('rejects fabricated and duplicated names without treating the plan as an executable configuration', () => {
    for (const mechanics of [['invented-mechanic'], ['ward-pool', 'ward-pool']]) {
      const plan = { mechanics, needsActivities: true, needsAreas: false }
      expect(validDnd5eLocalContentMechanismPlan(plan)).toBe(false)
      expect(() => focusDnd5eSubclassContracts(contracts, plan)).toThrow('invalid-rule-mechanism-plan')
    }
    expect(validDnd5eLocalContentMechanismPlan({ mechanics: [], needsActivities: false, needsAreas: false })).toBe(true)
  })
})
