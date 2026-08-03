import { execFileSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const localRoot = path.join(root, 'local-content')
const distArgumentIndex = process.argv.indexOf('--dist')
const distRoot = path.resolve(
  root,
  distArgumentIndex >= 0 ? process.argv[distArgumentIndex + 1] ?? 'dist' : 'dist',
)

function fail(message) {
  console.error(`Local-content deployment boundary audit failed: ${message}`)
  process.exit(1)
}

function filesBelow(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? filesBelow(fullPath) : [fullPath]
  })
}

function requiresIgnore(fileName, pattern) {
  const filePath = path.join(root, fileName)
  if (!existsSync(filePath)) fail(`missing ${fileName}`)
  const lines = readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
  if (!lines.includes(pattern)) fail(`${fileName} must explicitly include ${pattern}`)
}

requiresIgnore('.gitignore', 'local-content/')
requiresIgnore('.dockerignore', 'local-content')

try {
  const tracked = execFileSync(
    'git',
    ['ls-files', '--', 'local-content'],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  ).trim()
  if (tracked) fail(`local-content contains a tracked file: ${tracked.split(/\r?\n/)[0]}`)
} catch (error) {
  if (error?.status === 1) throw error
}

const privateManifestIds = new Set()
const privateContentIds = new Set()
for (const file of filesBelow(localRoot).filter((entry) => entry.endsWith('.json'))) {
  let value
  try {
    value = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    continue
  }
  const manifestId = value?.manifest?.id
  if (typeof manifestId === 'string' && manifestId.length >= 8) {
    privateManifestIds.add(manifestId)
  }
  if (path.basename(file) !== 'collection.json' || value?.format !== 'dndstars5e-local-collection') {
    continue
  }
  for (const [category, descriptor] of Object.entries(value?.expected ?? {})) {
    if (!Array.isArray(descriptor?.ids)) continue
    for (const id of descriptor.ids) {
      if (typeof id !== 'string') continue
      const isStablePrivateId =
        category === 'subclasses' ||
        category === 'features' ||
        (category === 'races' && id.includes('-'))
      if (isStablePrivateId) privateContentIds.add(id)
    }
  }
}

function firstPrivateMarker(content) {
  for (const marker of [...privateManifestIds, ...privateContentIds]) {
    if (content.includes(marker)) return marker
  }
  return undefined
}

const deployableServerFiles = [
  'account-storage-sqlite.mjs',
  'art-asset-server.mjs',
  'postgres-storage.mjs',
  'server-observability.mjs',
  'shared-server-core.mjs',
  'shared-server-system-routes.mjs',
  'static-server.mjs',
  'tencent-verification-provider.mjs',
  'vite-server.mjs',
].map((file) => path.join(root, 'scripts', file)).filter(existsSync)

const deployableSourceFiles = [
  ...filesBelow(path.join(root, 'src')),
  ...filesBelow(path.join(root, 'shared')),
  ...deployableServerFiles,
].filter((file) =>
  /\.(?:ts|tsx|js|jsx|mjs|mts|json)$/.test(file) &&
  !/\.test\.[^.]+$/.test(file) &&
  !file.includes(`${path.sep}testFixtures${path.sep}`),
)
for (const file of deployableSourceFiles) {
  const source = readFileSync(file, 'utf8')
  if (/local-content[\\/]/.test(source)) {
    fail(`${path.relative(root, file)} imports local-content`)
  }
  const marker = firstPrivateMarker(source)
  if (marker) {
    fail(`${path.relative(root, file)} contains private content id: ${marker}`)
  }
}

if (!existsSync(distRoot) || !statSync(distRoot).isDirectory()) {
  fail(`production build directory not found: ${path.relative(root, distRoot)}`)
}
for (const file of filesBelow(distRoot)) {
  if (!/\.(?:html|js|css|json|map|txt)$/.test(file)) continue
  const content = readFileSync(file, 'utf8')
  const marker = firstPrivateMarker(content)
  if (marker) {
    fail(`production artifact ${path.relative(root, file)} contains private marker: ${marker}`)
  }
}

console.log(
  `Local-content boundary audit passed: private files and identifiers are absent from ${path.relative(root, distRoot)}.`,
)
