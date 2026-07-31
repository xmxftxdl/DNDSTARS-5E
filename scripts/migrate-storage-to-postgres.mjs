import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  openSqliteAccountStore,
  readLegacyAccountSnapshot,
} from './account-storage-sqlite.mjs'
import { openPostgresStorage } from './postgres-storage.mjs'

function argument(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? String(process.argv[index + 1] ?? '') : fallback
}

function emptyRegistry() {
  return {
    schemaVersion: 1,
    entries: [],
    reports: [],
    creators: [],
    entitlements: [],
    orders: [],
    paymentEvents: [],
    ledgerEntries: [],
    payouts: [],
  }
}

function normalizeRegistry(value) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1) return emptyRegistry()
  const normalized = emptyRegistry()
  for (const key of Object.keys(normalized).filter((key) => key !== 'schemaVersion')) {
    normalized[key] = Array.isArray(value[key]) ? value[key] : []
  }
  return normalized
}

const sharedRoot = path.resolve(argument('shared-root', process.env.STARS_SHARED_ROOT ?? '/data'))
const sqlitePath = path.resolve(argument(
  'sqlite',
  process.env.STARS_DATABASE_PATH ?? path.join(sharedRoot, 'astraltrace.sqlite'),
))
const databaseUrl = argument('database-url', process.env.STARS_DATABASE_URL ?? '')
const source = argument('source', 'sqlite')
const dryRun = process.argv.includes('--dry-run')

const snapshot = source === 'json'
  ? await readLegacyAccountSnapshot(sharedRoot)
  : await (async () => {
      const sqlite = await openSqliteAccountStore(sqlitePath)
      try {
        return { ...sqlite.exportSnapshot(), invalid: [] }
      } finally {
        sqlite.close()
      }
    })()

if (snapshot.invalid.length > 0) {
  throw new Error(`account-migration-source-invalid:${snapshot.invalid.length}`)
}

let marketplaceRegistry = emptyRegistry()
try {
  marketplaceRegistry = normalizeRegistry(JSON.parse(
    await readFile(path.join(sharedRoot, 'lobby', 'plugin-registry.json'), 'utf8'),
  ))
} catch {}

const summary = {
  source,
  accounts: snapshot.entries.length,
  identities: snapshot.identities.length,
  campaigns: snapshot.entries.reduce(
    (total, entry) => total + (Array.isArray(entry.account.campaigns) ? entry.account.campaigns.length : 0),
    0,
  ),
  orders: marketplaceRegistry.orders.length,
  ledgerEntries: marketplaceRegistry.ledgerEntries.length,
  payouts: marketplaceRegistry.payouts.length,
}

if (dryRun) {
  process.stdout.write(`${JSON.stringify({ dryRun: true, ...summary }, null, 2)}\n`)
  process.exit(0)
}

const postgres = await openPostgresStorage(databaseUrl)
try {
  const accounts = await postgres.importSnapshot(snapshot.entries, snapshot.identities)
  const marketplace = await postgres.mutateMarketplaceRegistry(
    normalizeRegistry,
    emptyRegistry,
    (current) => {
      const currentHasData = current.entries.length > 0 ||
        current.orders.length > 0 ||
        current.ledgerEntries.length > 0 ||
        current.payouts.length > 0
      if (currentHasData && JSON.stringify(current) !== JSON.stringify(marketplaceRegistry)) {
        throw new Error('postgres-marketplace-registry-not-empty')
      }
      return marketplaceRegistry
    },
  )
  process.stdout.write(`${JSON.stringify({
    dryRun: false,
    ...summary,
    accounts,
    marketplaceSchemaVersionImported: marketplace.schemaVersion,
    diagnostics: await postgres.diagnostics(),
  }, null, 2)}\n`)
} finally {
  await postgres.close()
}
