import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eLongRestBenefits, applyDnd5eShortRestBenefits } from './campaignTimeRules'
import { dnd5eAuguryRandomChance, dnd5eAugurySecretResult, recordDnd5eAuguryCast } from './auguryReliability'
import type { Dnd5eMapResultPlan } from './mapBridge'

it('persists escalating chance across reload and short rests, and clears it on long rest', () => {
  let actor = normalizeCharacter({ id: 'caster', name: 'Caster', charClass: '野蛮人', level: 10, currentHp: 40, maxHp: 40, equipment: {} })
  for (const [index, chance] of [0, 25, 50, 75, 100, 100].entries()) {
    expect(dnd5eAuguryRandomChance(actor)).toBe(chance)
    const plan = { characters: [actor], changedCharacterIds: [], changedTokenIds: [] } as unknown as Dnd5eMapResultPlan
    const recorded = recordDnd5eAuguryCast(plan, actor, `cast-${index}`)
    expect(recorded.changedCharacterIds).toContain(actor.id)
    expect(recorded.characterPatches?.[actor.id]?.dnd5eCombatState).toEqual(recorded.characters[0].dnd5eCombatState)
    expect(recordDnd5eAuguryCast(recorded, actor, `cast-${index}`)).toBe(recorded)
    actor = applyDnd5eShortRestBenefits(normalizeCharacter(JSON.parse(JSON.stringify(recorded.characters[0]))), index * 60)
  }
  expect(dnd5eAuguryRandomChance(applyDnd5eLongRestBenefits(actor, 1440))).toBe(0)
})

it('uses inclusive percentile boundaries and all four random omens', () => {
  for (const chance of [25, 50, 75, 100]) {
    expect(dnd5eAugurySecretResult(chance, chance, 1)).toContain('随机预兆：吉')
    if (chance < 100) expect(dnd5eAugurySecretResult(chance, chance + 1, 1)).toContain('未触发')
  }
  for (const [index, omen] of ['吉', '凶', '吉凶并存', '无'].entries()) {
    expect(dnd5eAugurySecretResult(100, 100, index + 1)).toContain(`随机预兆：${omen}。`)
  }
  expect(dnd5eAugurySecretResult(0, 1, 1)).toContain('未触发')
  expect(() => dnd5eAugurySecretResult(25, 0, 1)).toThrow()
  expect(() => dnd5eAugurySecretResult(25, 1, 5)).toThrow()
})
