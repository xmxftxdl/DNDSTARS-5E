import path from 'node:path'
import process from 'node:process'
import { migrateLegacyAccountsToSqlite } from './account-storage-sqlite.mjs'

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

const sharedRoot = path.resolve(
  argumentValue('--root') ??
  process.env.STARS_SHARED_ROOT ??
  path.join(process.cwd(), '.stars-shared'),
)
const databasePath = path.resolve(
  argumentValue('--database') ??
  process.env.STARS_DATABASE_PATH ??
  path.join(sharedRoot, 'astraltrace.sqlite'),
)
const dryRun = process.argv.includes('--dry-run')

try {
  const report = await migrateLegacyAccountsToSqlite({ sharedRoot, databasePath, dryRun })
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error?.message ?? String(error),
    invalid: error?.invalid ?? [],
  }, null, 2))
  process.exitCode = 1
}
