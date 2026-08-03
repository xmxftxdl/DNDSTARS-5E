#!/usr/bin/env node

import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const jsonOutput = process.argv.includes('--json')
const vite = await createServer({
  root,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  const coverage = await vite.ssrLoadModule('/src/rulesets/dnd5e/monsterHeadlessCoverage.ts')
  const report = coverage.auditDnd5eMonsterHeadlessCoverage()
  const ratchet = coverage.DND5E_MONSTER_HEADLESS_COVERAGE_RATCHET
  const verification = coverage.verifyDnd5eMonsterHeadlessCoverageRatchet(report)
  const summary = {
    schemaVersion: 1,
    evidencePolicy: {
      actions: 'valid structured action plus executable composite children; prose/name matches do not count',
      spells: 'structured core spell definition accepted by the monster compatibility gate',
      traits: 'explicit headless declaration plus structured rule payload; prose/name matches do not count',
    },
    monsters: report.monsterCount,
    actions: report.actions.summary,
    spells: report.spells.summary,
    traits: report.traits.summary,
    ratchet,
    verification,
  }

  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    const action = summary.actions.effective
    const spell = summary.spells
    const trait = summary.traits
    console.log('D&D 5e monster Headless coverage (structured evidence only)')
    console.log(`Monsters: ${summary.monsters}`)
    console.log(
      `Actions: ${action.headless}/${summary.actions.total} Headless; ` +
      `${action.dmAdjudication} DM; ${action.unstructured} unstructured; ` +
      `${action.blockedByChild} child-blocked; ${action.invalid} invalid`,
    )
    console.log(
      `Spells: ${spell.full}/${spell.total} full; ${spell.manual} manual; ${spell.missing} missing`,
    )
    console.log(
      `Traits: ${trait.headlessWithRule}/${trait.total} Headless with rule; ` +
      `${trait.headlessWithoutRule} unproven Headless claims; ` +
      `${trait.dmAdjudication} DM; ${trait.implicit} implicit`,
    )
    console.log(verification.passed ? 'Ratchet: PASS' : 'Ratchet: FAIL')
    for (const violation of verification.violations) console.error(`- ${violation}`)
  }

  if (!verification.passed) process.exitCode = 1
} finally {
  await vite.close()
}
