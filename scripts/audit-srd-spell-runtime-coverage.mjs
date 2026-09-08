#!/usr/bin/env node

import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const jsonOutput = process.argv.includes('--json')
const detailsOutput = process.argv.includes('--details')
const vite = await createServer({
  root,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  const audited = await vite.ssrLoadModule(
    '/src/rulesets/dnd5e/activities/dnd5eSrdAuditedSpellActivities.ts',
  )
  const mechanics = await vite.ssrLoadModule(
    '/src/rulesets/dnd5e/plugins/pluginMechanicsRegistry.ts',
  )
  const fullRows = audited.DND5E_SRD_AUDITED_FULL_SPELL_IDS.map((id) => {
    const activity = audited.dnd5eSrdAuditedSpellActivityV1(id)
    const analysis = mechanics.dnd5eActivityAutomationAnalysisV1(activity)
    return {
      id,
      level: analysis.capability.level,
      missingComponents: analysis.missingComponents,
    }
  })
  const partialRows = audited.DND5E_SRD_AUDITED_PARTIAL_SPELL_IDS.map((id) => {
    const activity = audited.dnd5eSrdAuditedSpellActivityV1(id)
    const analysis = mechanics.dnd5eActivityAutomationAnalysisV1(activity)
    return {
      id,
      level: analysis.capability.level,
      manualBoundaries: analysis.missingComponents.filter((component) =>
        component === 'operation:manual-adjudication').length,
      missingComponents: analysis.missingComponents,
    }
  })
  const countLevels = (rows) => Object.fromEntries(
    ['full', 'assisted', 'dm-adjudication', 'unsupported', 'display-only'].map((level) => [
      level,
      rows.filter((row) => row.level === level).length,
    ]),
  )
  const missingComponentCounts = Object.entries(Object.fromEntries(
    fullRows.flatMap((row) => row.missingComponents).map((component) => [component, 0]),
  )).reduce((counts, [component]) => ({
    ...counts,
    [component]: fullRows.filter((row) => row.missingComponents.includes(component)).length,
  }), {})
  const report = {
    schemaVersion: 1,
    evidencePolicy: 'Activity operations/effects plus registered concrete Host consumers; declared labels are ignored',
    targetFull: { total: fullRows.length, levels: countLevels(fullRows) },
    targetPartial: { total: partialRows.length, levels: countLevels(partialRows) },
    missingComponentCounts,
    fullRows,
    partialRows,
  }
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log('D&D 5e SRD spell runtime coverage (executable Activity evidence only)')
    console.log(`Full targets: ${report.targetFull.levels.full}/${report.targetFull.total} full; ${report.targetFull.levels.assisted} assisted`)
    console.log(`Partial targets: ${report.targetPartial.levels.assisted}/${report.targetPartial.total} assisted`)
    console.log('Missing Host consumers:')
    for (const [component, count] of Object.entries(missingComponentCounts)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))) {
      console.log(`${count}\t${component}`)
    }
    if (detailsOutput) {
      console.log('Assisted full-target spells:')
      for (const row of fullRows.filter((entry) => entry.level !== 'full')) {
        console.log(`${row.id}\t${row.missingComponents.join(',')}`)
      }
    }
  }
} finally {
  await vite.close()
}
