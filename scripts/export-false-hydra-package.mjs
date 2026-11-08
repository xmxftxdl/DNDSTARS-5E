import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const vite = await createServer({ root, configFile: false, server: { middlewareMode: true, watch: null }, appType: 'custom' })
try {
  const { createFalseHydraPackage } = await vite.ssrLoadModule('/src/rulesets/dnd5e/testFixtures/falseHydraPackage.ts')
  const { encodeDnd5eContentPackageV2, parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } = await vite.ssrLoadModule('/src/rulesets/dnd5e/contentPackageV2.ts')
  const { registerDnd5eRulesPlugin } = await vite.ssrLoadModule('/src/rulesets/dnd5e/pluginApi.ts')
  const bytes = new Uint8Array(encodeDnd5eContentPackageV2(createFalseHydraPackage()))
  const parsed = parseDnd5eContentPackageV2(bytes.buffer)
  if (!parsed) throw new Error('Export did not pass reimport validation')
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(parsed))
  dispose()
  const output = resolve(root, 'local-content/exports/false-hydra-2014-room-1.0.0.dndstars5e')
  await mkdir(resolve(root, 'local-content/exports'), { recursive: true })
  await writeFile(output, bytes)
  const report = { output, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex'),
    validation: 'Package encode, reimport and plugin registration passed', requiredCore: 'false-hydra-v1', manifest: parsed.manifest }
  await writeFile(output + '.report.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  await vite.close()
}
