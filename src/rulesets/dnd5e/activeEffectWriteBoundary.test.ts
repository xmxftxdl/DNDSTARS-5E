import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rulesRoot = new URL('./', import.meta.url)
const runtimeFiles = readdirSync(rulesRoot)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .filter((name) => name !== 'activeEffects.ts' && name !== 'timedEffects.ts' && name !== 'legacyActiveEffectMigration.ts')

describe('ActiveEffect authoritative write boundary', () => {
  it('forbids runtime condition mutation outside the projection commit', () => {
    const allowedProjectionAssignments = new Set([
      'endTurnAction.ts:actorCombatant.conditions = dnd5eConditionsFromActiveEffects(actorCombatant.classState.activeEffects)',
      'headlessCombatEngine.ts:target.conditions = dnd5eConditionsFromActiveEffects(effects)',
      'headlessCombatEngine.ts:target.conditions = dnd5eConditionsFromActiveEffects(normalized)',
    ])
    for (const name of runtimeFiles) {
      const source = readFileSync(new URL(name, rulesRoot), 'utf8')
      expect(source, `${name} must not push condition strings`).not.toMatch(/conditions\.push\s*\(/)
      for (const line of source.split(/\r?\n/).map((entry) => entry.trim())) {
        if (!/\b\w+\.conditions\s*=/.test(line)) continue
        expect(allowedProjectionAssignments.has(`${name}:${line}`), `${name}: ${line}`).toBe(true)
      }
    }
  })

  it('forbids creation or progression of legacy timedEffects in runtime code', () => {
    for (const name of runtimeFiles) {
      const source = readFileSync(new URL(name, rulesRoot), 'utf8')
      expect(source, `${name} must not create timedEffects arrays`).not.toMatch(/timedEffects\s*:\s*\[/)
      expect(source, `${name} must not assign timedEffects`).not.toMatch(/\.timedEffects\s*=/)
      expect(source, `${name} must not use the retired timed condition writer`).not.toContain('applyDnd5eTimedConditionEffect')
    }
  })

  it('keeps timedEffects imports confined to the legacy save importer', () => {
    for (const name of readdirSync(rulesRoot).filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))) {
      const source = readFileSync(new URL(name, rulesRoot), 'utf8')
      if (!source.includes("from './timedEffects'")) continue
      expect(name).toBe('legacyActiveEffectMigration.ts')
    }
  })
})
