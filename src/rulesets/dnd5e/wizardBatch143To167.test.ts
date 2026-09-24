import { describe, expect, it } from 'vitest'
import { dnd5eSpellbookEntries } from './spellbook'
import { dnd5eSrdAuditedFullContentDefinitionsV1, dnd5eSrdAuditedSpellActivityV1 } from './activities/dnd5eSrdAuditedSpellActivities'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './activities/dnd5eActivityExecutor'

const wizardIds = 'wish acid-arrow alarm alter-self animate-dead animate-objects antimagic-field antipathy-sympathy arcane-eye arcane-hand arcane-lock arcane-sword arcanists-magic-aura astral-projection'.split(' ')
const otherIds = 'wind-walk wind-wall word-of-recall zone-of-truth aid animal-friendship animal-messenger antilife-shell augury awaken bane'.split(' ')
const entries = dnd5eSpellbookEntries([])
function activity(id: string): Dnd5eActivityDefinitionV1 {
  const entry = dnd5eSrdAuditedFullContentDefinitionsV1().find(entry => entry.id === 'arcane-hand')!
  return (entry.activities as Dnd5eActivityDefinitionV1[]).find(activity => activity.id === id)!
}
const actor: Dnd5eActivityActorSnapshot = {
  id: 'caster', controller: 'player', level: 20, proficiencyBonus: 6,
  abilities: { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 10 },
  armorClass: 15, currentHp: 100, maxHp: 100, conditions: [], spellcastingAbilityModifier: 5,
}
describe('Wizard batch 143–167 live catalog and settlement', () => {
  it.each(wizardIds)('%s is available in the Wizard catalog with rules text', id => {
    expect(entries.find(entry => entry.id === id)).toMatchObject({ classes: expect.arrayContaining(['wizard']), catalogOnly: false })
    expect(entries.find(entry => entry.id === id)?.reference).toBeDefined()
  })
  it.each(otherIds)('%s does not leak into the 2014 Wizard list', id => {
    expect(entries.find(entry => entry.id === id)?.classes).not.toContain('wizard')
  })
  it.each([['forceful-hand', 'athletics', true], ['grasping-hand', 'acrobatics', false]] as const)(
    '%s resolves the correct resisting skill, rather than sharing the grapple choice', (mode, skill, success) => {
      const target = { ...actor, id: 'target', controller: 'dm' as const, sizeRank: 2,
        skillCheckModifiers: { athletics: 0, acrobatics: 15 } }
      const result = resolveDnd5eActivity({ activity: activity(`spell:arcane-hand:${mode}`), actor, targets: [target],
        rolls: { 'arcane-hand-strength-d20:target': { values: [10, 5] }, 'arcane-hand-target-d20:target': { values: [10] } },
        checkRollModes: { 'arcane-hand-contest:target:target': 'normal' },
        distanceFeetByTargetId: { target: 5 },
      })
      expect(result.ok, !result.ok ? result.details.join('; ') : '').toBe(true)
      if (result.ok) expect(result.checks[0]).toMatchObject({ opposedSkill: skill, success })
    })
  it('creates the eye at an unobstructed unseen point without treating nearby creatures as targets', () => {
    expect(dnd5eSrdAuditedSpellActivityV1('arcane-eye')?.target).toMatchObject({
      kind: 'area', radiusFeet: 0, requiresLineOfSight: false, requiresLineOfEffect: true, includeSelf: true,
    })
  })
  it('marks both Arcane Sword attack phases as melee spell attacks', () => {
    const initial = dnd5eSrdAuditedSpellActivityV1('arcane-sword')!
    const repeated = dnd5eSrdAuditedFullContentDefinitionsV1().find(entry => entry.id === 'arcane-sword')!.activities as Dnd5eActivityDefinitionV1[]
    for (const value of [initial, repeated.find(value => value.id === 'spell:arcane-sword:attack')!]) {
      expect(value.checks).toContainEqual(expect.objectContaining({ kind: 'attack-roll', delivery: 'melee' }))
    }
  })
})
