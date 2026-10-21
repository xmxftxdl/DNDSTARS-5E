import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseDnd5eContentPackageV2, encodeDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin, dnd5ePluginFeatureDefinition } from './pluginApi'

it('imports and re-exports the isolated browser completion package with guarded single-use grants', () => {
  const bytes = readFileSync('e2e/fixtures/interaction-completion.dndstars5e')
  const pkg = parseDnd5eContentPackageV2(new Uint8Array(bytes).buffer)
  expect(pkg).toBeDefined()
  const reloaded = parseDnd5eContentPackageV2(encodeDnd5eContentPackageV2(pkg!))!
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(reloaded))
  try {
    expect(dnd5ePluginFeatureDefinition('test.timed:prepare')).toBeDefined()
    expect(dnd5ePluginFeatureDefinition('test.timed:prepare')?.action).toBeDefined()
    expect(dnd5ePluginFeatureDefinition('test.timed:finish')).toBeDefined()
    expect(reloaded.content.activities?.find(row => row.id === 'prepare')?.effects?.[0].completionGrant).toMatchObject({ singleUse: true, bindTarget: 'bearer', recipient: 'source' })
    expect(reloaded.content.activities?.find(row => row.id === 'finish')?.requiresEffectGrant).toBe(true)
  } finally { dispose() }
})
