// eslint error RATCHET: run eslint, sum errorCount, fail iff it EXCEEDS the
// checked-in baseline (.eslint-ratchet.json maxErrors). No-new-errors gate, not a clean bar —
// the repo carries a known error backlog (mostly the 7000-line MapsPage god object) that is being
// burned down task by task; this prevents NEW errors while allowing the backlog to shrink.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(repoRoot, '.eslint-ratchet.json')
const { maxErrors } = JSON.parse(readFileSync(baselinePath, 'utf8'))
const oversizedBaselinePath = path.join(repoRoot, '.eslint-maps-workspace-ratchet.json')
const { maxErrors: oversizedMaxErrors } = JSON.parse(readFileSync(oversizedBaselinePath, 'utf8'))
const eslintBin = path.join(repoRoot, 'node_modules', 'eslint', 'bin', 'eslint.js')
const cacheLocation = path.join(repoRoot, 'node_modules', '.cache', 'eslint', '.eslintcache')
const oversizedCacheLocation = path.join(repoRoot, 'node_modules', '.cache', 'eslint', '.eslintcache-maps-workspace')
const oversizedFileConfig = new Map([
  ['src/pages/MapsWorkspacePage.tsx', path.join(repoRoot, 'eslint.maps-workspace.config.js')],
])
const shardSize = 75

// Keep each ESLint process bounded. A single repository-wide process currently exceeds the
// 4 GiB CI heap before it can emit JSON, which turns the ratchet into a flaky infrastructure
// gate instead of a useful no-new-errors check.
const trackedFiles = spawnSync('git', [
  'ls-files',
  '--cached',
  '--others',
  '--exclude-standard',
  '-z',
], {
  cwd: repoRoot,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})

if (trackedFiles.error || trackedFiles.status !== 0) {
  console.error(
    '[eslint-ratchet] failed to enumerate repository files:',
    trackedFiles.error?.message ?? trackedFiles.stderr,
  )
  process.exit(2)
}

const lintFiles = trackedFiles.stdout
  .split('\0')
  .filter((file) => /\.tsx?$/.test(file))
  .sort()
const regularFiles = lintFiles.filter((file) => !oversizedFileConfig.has(file))
const shards = []
for (let offset = 0; offset < regularFiles.length; offset += shardSize) {
  shards.push({ files: regularFiles.slice(offset, offset + shardSize), config: null })
}
for (const [file, config] of oversizedFileConfig) {
  if (lintFiles.includes(file)) shards.push({ files: [file], config })
}

let standardErrorCount = 0
let oversizedErrorCount = 0
let warningCount = 0
const filesWithErrors = []
const shardCount = shards.length

for (const [index, shard] of shards.entries()) {
  const shardNumber = index + 1
  const profile = shard.config ? 'oversized-file profile' : 'standard profile'
  console.log(`[eslint-ratchet] linting shard ${shardNumber}/${shardCount} (${shard.files.length} files, ${profile})`)

  // ESLint exits 1 when lint errors are present; its JSON is still authoritative in that case.
  const result = spawnSync(process.execPath, [
    eslintBin,
    ...shard.files,
    '-f',
    'json',
    '--no-warn-ignored',
    ...(shard.config ? ['--config', shard.config] : []),
    '--cache',
    '--cache-location',
    shard.config ? oversizedCacheLocation : cacheLocation,
    '--cache-strategy',
    'content',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })

  if (result.error) {
    console.error(`[eslint-ratchet] shard ${shardNumber} failed to run:`, result.error.message)
    process.exit(2)
  }

  let report
  try {
    report = JSON.parse(result.stdout)
  } catch {
    console.error(
      `[eslint-ratchet] could not parse shard ${shardNumber} JSON output.`,
      `status=${result.status ?? 'null'} signal=${result.signal ?? 'none'} stdoutBytes=${result.stdout?.length ?? 0}`,
      `stderr:\n${result.stderr}`,
    )
    process.exit(2)
  }

  const shardErrorCount = report.reduce((sum, file) => sum + file.errorCount, 0)
  if (shard.config) oversizedErrorCount += shardErrorCount
  else standardErrorCount += shardErrorCount
  warningCount += report.reduce((sum, file) => sum + file.warningCount, 0)
  filesWithErrors.push(...report
    .filter((file) => file.errorCount > 0)
    .map((file) => ({
      filePath: path.relative(repoRoot, file.filePath),
      errorCount: file.errorCount,
      rules: [...new Set(file.messages
        .filter((message) => message.severity === 2)
        .map((message) => message.ruleId ?? 'parse-error'))],
    })))
}

console.log(
  `[eslint-ratchet] standardErrors=${standardErrorCount} (baseline ${maxErrors}), ` +
  `mapsWorkspaceErrors=${oversizedErrorCount} (baseline ${oversizedMaxErrors}), warnings=${warningCount}`,
)

if (standardErrorCount > maxErrors) {
  for (const file of filesWithErrors) {
    console.error(`[eslint-ratchet] ${file.filePath}: ${file.errorCount} errors (${file.rules.join(', ')})`)
  }
  console.error(
    `[eslint-ratchet] FAIL: ${standardErrorCount} standard-profile errors exceeds baseline ${maxErrors}. ` +
      `Fix the new errors, or if you intentionally reduced the count, lower maxErrors in .eslint-ratchet.json.`,
  )
  process.exit(1)
}

if (oversizedErrorCount > oversizedMaxErrors) {
  console.error(
    `[eslint-ratchet] FAIL: ${oversizedErrorCount} MapsWorkspace errors exceeds baseline ${oversizedMaxErrors}. ` +
      'Fix the new errors; do not raise .eslint-maps-workspace-ratchet.json.',
  )
  process.exit(1)
}

if (standardErrorCount < maxErrors) {
  console.warn(
    `[eslint-ratchet] NOTE: ${standardErrorCount} < baseline ${maxErrors}. ` +
      `You cleared errors — please lower maxErrors in .eslint-ratchet.json to ${standardErrorCount} to ratchet the gate down.`,
  )
}

if (oversizedErrorCount < oversizedMaxErrors) {
  console.warn(
    `[eslint-ratchet] NOTE: ${oversizedErrorCount} < MapsWorkspace baseline ${oversizedMaxErrors}. ` +
      `Lower .eslint-maps-workspace-ratchet.json to ${oversizedErrorCount}.`,
  )
}

console.log('[eslint-ratchet] PASS')
process.exit(0)
