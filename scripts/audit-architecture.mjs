import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const failures = []
const ratchetNotes = []
const ratchetDebt = []

const source = async (relativePath) => readFile(path.join(root, relativePath), 'utf8')
const lineCount = (value) => value.split(/\r?\n/).length
const imports = (value) => [...value.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)]
  .map((match) => match[1])
const architectureRatchet = JSON.parse(await source('scripts/architecture-ratchet.json'))
const budget = (key) => architectureRatchet.budgets[key]
const enforceRatchet = (key, label, actual) => {
  const entry = budget(key)
  if (!entry || !Number.isFinite(entry.maximum) || !Number.isFinite(entry.target)) {
    failures.push(`architecture ratchet entry ${key} is missing or invalid`)
    return
  }
  if (entry.target > entry.maximum) {
    failures.push(`architecture ratchet entry ${key} has target ${entry.target} above maximum ${entry.maximum}`)
    return
  }
  if (actual > entry.maximum) {
    failures.push(`${label} budget exceeded: ${actual} > ${entry.maximum}`)
    return
  }
  if (actual < entry.maximum && entry.maximum > entry.target) {
    ratchetNotes.push(`${label} improved to ${actual}; lower maximum from ${entry.maximum}`)
  }
  if (actual > entry.target) {
    ratchetDebt.push(`${label}: ${actual} (target ${entry.target})`)
  }
}

async function sourceFiles(relativeDirectory) {
  const directory = path.join(root, relativeDirectory)
  const entries = await readdir(directory, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const relative = path.join(relativeDirectory, entry.name)
    if (entry.isDirectory()) result.push(...await sourceFiles(relative))
    else if (/\.(?:ts|tsx|mjs)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name)) result.push(relative)
  }
  return result
}

async function enforceLayer(directory, forbiddenSegments) {
  for (const file of await sourceFiles(directory)) {
    for (const specifier of imports(await source(file))) {
      if (forbiddenSegments.some((segment) => specifier.includes(segment))) {
        failures.push(`${file} must not import ${specifier}`)
      }
    }
  }
}

async function enforceNoRelativeImportCycles(directories) {
  const relativeFiles = (await Promise.all(directories.map((directory) => sourceFiles(directory)))).flat()
  const absoluteFiles = new Map(relativeFiles.map((file) => [path.resolve(root, file), file]))
  const graph = new Map()

  const resolveRelativeImport = (fromFile, specifier) => {
    if (!specifier.startsWith('.')) return null
    const base = path.resolve(path.dirname(fromFile), specifier)
    for (const candidate of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.mjs`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.tsx'),
      path.join(base, 'index.mjs'),
    ]) {
      if (absoluteFiles.has(candidate)) return candidate
    }
    return null
  }

  for (const absoluteFile of absoluteFiles.keys()) {
    graph.set(
      absoluteFile,
      imports(await readFile(absoluteFile, 'utf8'))
        .map((specifier) => resolveRelativeImport(absoluteFile, specifier))
        .filter(Boolean),
    )
  }

  const state = new Map()
  const stack = []
  const reported = new Set()
  const visit = (file) => {
    state.set(file, 'visiting')
    stack.push(file)
    for (const dependency of graph.get(file) ?? []) {
      if (!state.has(dependency)) {
        visit(dependency)
        continue
      }
      if (state.get(dependency) !== 'visiting') continue
      const cycleStart = stack.indexOf(dependency)
      const cycle = [...stack.slice(cycleStart), dependency]
      const cycleKey = [...new Set(cycle)].sort().join('|')
      if (!reported.has(cycleKey)) {
        reported.add(cycleKey)
        failures.push(
          `layer import cycle: ${cycle.map((entry) => absoluteFiles.get(entry)).join(' -> ')}`,
        )
      }
    }
    stack.pop()
    state.set(file, 'visited')
  }

  for (const file of absoluteFiles.keys()) {
    if (!state.has(file)) visit(file)
  }
}

await enforceLayer('src/domain', ['/pages/', '/components/', '/store/', '/application/', '/adapters/'])
await enforceLayer('src/application', ['/pages/', '/components/', '/store/', '/adapters/'])
await enforceLayer('src/ports', ['/pages/', '/components/', '/store/', '/application/', '/adapters/'])
await enforceNoRelativeImportCycles([
  'src/domain',
  'src/application',
  'src/ports',
  'src/adapters',
  'src/composition',
])

for (const directory of ['src/domain', 'src/application', 'src/ports']) {
  for (const file of await sourceFiles(directory)) {
    const value = await source(file)
    for (const forbidden of ['react', 'react-konva', 'konva', 'zustand']) {
      if (imports(value).some((specifier) => specifier === forbidden || specifier.startsWith(`${forbidden}/`))) {
        failures.push(`${file} must not import framework dependency ${forbidden}`)
      }
    }
    if (directory === 'src/domain' && imports(value).some((specifier) => specifier.startsWith('node:'))) {
      failures.push(`${file} Domain code must not import Node.js built-ins`)
    }
  }
}

const mapsPage = await source('src/pages/MapsPage.tsx')
const mapsWorkspacePage = await source('src/pages/MapsWorkspacePage.tsx')
const mapCanvas = await source('src/components/map/MapCanvas.tsx')
const mapViewportLayer = await source('src/presentation/maps/MapViewportLayer.tsx')
const mapPersistentAreaLayers = await source('src/components/map/MapPersistentAreaLayers.tsx')
const serverCore = await source('scripts/shared-server-core.mjs')
const pluginApi = await source('src/rulesets/dnd5e/pluginApi.ts')
const monsterTurnPlanner = await source('src/rulesets/dnd5e/monsterTurnPlanner.ts')
const prefixImportCount = (prefix) => imports(mapsWorkspacePage).filter((specifier) => specifier.startsWith(prefix)).length

enforceRatchet('mapsPageLines', 'MapsPage.tsx line', lineCount(mapsPage))
enforceRatchet('mapsWorkspacePageLines', 'MapsWorkspacePage.tsx line', lineCount(mapsWorkspacePage))
for (const [key, label, prefix] of [
  ['mapsPageRulesetImports', 'MapsWorkspacePage.tsx ruleset dependency', '../rulesets/'],
  ['mapsPageStoreImports', 'MapsWorkspacePage.tsx store dependency', '../store/'],
  ['mapsPageLibImports', 'MapsWorkspacePage.tsx lib dependency', '../lib/'],
]) {
  const count = prefixImportCount(prefix)
  enforceRatchet(key, label, count)
}
enforceRatchet('sharedServerCoreLines', 'shared-server-core.mjs line', lineCount(serverCore))
enforceRatchet('mapCanvasLines', 'MapCanvas.tsx line', lineCount(mapCanvas))
for (const [key, file] of [
  ['mapCombatEffectsLines', 'src/components/map/MapCombatEffects.tsx'],
  ['mapEffectPrimitivesLines', 'src/components/map/MapEffectPrimitives.tsx'],
  ['mapCantripEffectsLines', 'src/components/map/MapCantripEffects.tsx'],
  ['mapLeveledSpellEffectsLines', 'src/components/map/MapLeveledSpellEffects.tsx'],
  ['mapTokenNodeLines', 'src/components/map/MapTokenNode.tsx'],
  ['mapCanvasContractsLines', 'src/components/map/mapCanvasContracts.ts'],
  ['mapVisibilityLayersLines', 'src/components/map/MapVisibilityLayers.tsx'],
  ['mapGeometryLayersLines', 'src/components/map/MapGeometryLayers.tsx'],
  ['mapCanvasGeometryUtilsLines', 'src/components/map/mapCanvasGeometryUtils.ts'],
  ['mapPersistentAreaLayersLines', 'src/components/map/MapPersistentAreaLayers.tsx'],
  ['mapInteractionActionProcessorLines', 'src/pages/maps/mapInteractionActionProcessor.ts'],
]) {
  const count = lineCount(await source(file))
  enforceRatchet(key, `${file} line`, count)
}
enforceRatchet('pluginApiLines', 'pluginApi.ts line', lineCount(pluginApi))
enforceRatchet('monsterTurnPlannerLines', 'monsterTurnPlanner.ts line', lineCount(monsterTurnPlanner))
const mapCanvasLayerCount = [...mapCanvas.matchAll(/<Layer(?:\s|>)/g)].length
enforceRatchet('mapCanvasLayerCount', 'MapCanvas.tsx layer', mapCanvasLayerCount)
if (mapCanvas.includes('useCampaignTimeStore') || !mapCanvas.includes('worldMinute?: number')) {
  failures.push('MapCanvas.tsx must receive the campaign clock as a projection prop')
}

for (const forbidden of ["from '../lib/sharedApi'", 'headlessCombatEngine']) {
  if (mapsWorkspacePage.includes(forbidden)) {
    failures.push(`MapsPage.tsx must not depend on ${forbidden}`)
  }
}

for (const directory of ['src/pages', 'src/components', 'src/presentation', 'src/store']) {
  for (const file of await sourceFiles(directory)) {
    const directSharedApiImport = imports(await source(file)).some((specifier) =>
      specifier.endsWith('/lib/sharedApi') || specifier === '../lib/sharedApi')
    if (directSharedApiImport) {
      failures.push(`${file} must use the SharedRoomService composition boundary`)
    }
  }
}

for (const directory of ['src/pages', 'src/components', 'src/store']) {
  for (const file of await sourceFiles(directory)) {
    if ((await source(file)).includes('headlessCombatEngine')) {
      failures.push(`${file} must import the Application combat facade, not Headless internals`)
    }
  }
}

const requiredMigrations = [
  [mapsWorkspacePage, "from '../presentation/maps/combatViewModel'", 'MapsPage CombatViewModel projection'],
  [mapsWorkspacePage, "import('../presentation/maps/MapViewportLayer')", 'MapsPage lazy viewport boundary'],
  [mapViewportLayer, "from './SceneCanvas'", 'Viewport SceneCanvas boundary'],
  [mapsWorkspacePage, "from '../presentation/maps/useCombatInteraction'", 'MapsPage CombatInteraction boundary'],
  [mapsWorkspacePage, "from '../presentation/maps/useCombatDialog'", 'MapsPage combat dialog boundary'],
  [mapsWorkspacePage, "from '../presentation/maps/useDicePresentation'", 'MapsPage dice presentation boundary'],
  [mapsWorkspacePage, "from '../presentation/maps/DicePresentationOverlays'", 'MapsPage dice overlay boundary'],
  [mapsWorkspacePage, "from '../composition/browserCombatController'", 'MapsPage CombatController boundary'],
  [mapsWorkspacePage, "from '../application/maps/MovementHazardCoordinator'", 'MapsPage movement hazard boundary'],
  [mapsWorkspacePage, "from '../application/maps/ForcedMovementPersistentAreaCoordinator'", 'MapsPage forced-movement area boundary'],
  [pluginApi, "from './plugins/pluginDeclarativeCompiler'", 'plugin declarative compiler boundary'],
  [pluginApi, "from './plugins/pluginRegistryContracts'", 'plugin registry contract boundary'],
  [monsterTurnPlanner, "from './monsterSupportCandidateGenerators'", 'monster support candidate boundary'],
  [monsterTurnPlanner, "from './monsterStructuredSpecialCandidates'", 'monster structured special candidate boundary'],
  [monsterTurnPlanner, "from './monsterPersistentAreaHazardScoring'", 'monster persistent-area hazard scoring boundary'],
  [monsterTurnPlanner, "from './monsterControlCandidateGenerators'", 'monster control candidate boundary'],
  [mapViewportLayer, "from '../../composition/browserSceneClock'", 'MapCanvas campaign clock projection boundary'],
  [mapCanvas, "from './MapMeasureLine'", 'MapCanvas measurement projection boundary'],
  [mapCanvas, "from './Dnd5eItemAreaOverlays'", 'MapCanvas item-area overlay boundary'],
  [mapPersistentAreaLayers, "from './toxicCloudPresentation'", 'MapCanvas toxic-cloud presentation boundary'],
  [await source('src/store/roomCommands.ts'), "from '../application/commands/RoomCommandBus'", 'RoomCommandBus Application service'],
  [await source('src/composition/browserSharedRoomResources.ts'), 'browserSharedRoomService', 'Store SharedRoomService composition boundary'],
  [await source('src/domain/plugins/pluginKind.ts'), "'content-package'", 'plugin content/automation trust boundary'],
  [serverCore, "from './adapters/in-memory-sse-event-publisher.mjs'", 'server EventPublisher adapter'],
  [serverCore, "from './application/campaign-snapshot-catalog.mjs'", 'server snapshot Application service'],
  [serverCore, "from './application/server-security-config.mjs'", 'server security Application service'],
  [await source('scripts/shared-server-context.mjs'), 'createFileSystemServerStorage', 'server storage composition root'],
]
for (const [value, needle, label] of requiredMigrations) {
  if (!value.includes(needle)) failures.push(`missing architecture migration: ${label}`)
}

if (failures.length > 0) {
  console.error('Architecture audit failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

if (ratchetNotes.length > 0) {
  console.warn('Architecture ratchet can be tightened:')
  for (const note of ratchetNotes) console.warn(`- ${note}`)
}

if (ratchetDebt.length > 0) {
  console.log(`Architecture debt remains registered in scripts/architecture-ratchet.json (${ratchetDebt.length} budgets above target).`)
}

console.log(
  `Architecture audit passed: MapsPage ${lineCount(mapsPage)} lines; ` +
  `MapsWorkspacePage ${lineCount(mapsWorkspacePage)} lines; ` +
  `shared server ${lineCount(serverCore)} lines; dependency ratchets intact.`,
)
