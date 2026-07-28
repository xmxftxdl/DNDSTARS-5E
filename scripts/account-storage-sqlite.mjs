import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export const ACCOUNT_DATABASE_SCHEMA_VERSION = 1
const ACCOUNT_ID_PATTERN = /^[A-HJ-NP-Z2-9]{12}$/
const CAMPAIGN_ID_PATTERN = ACCOUNT_ID_PATTERN
const IDENTITY_FILE_PATTERN = /^(username|email|phone)-([a-f0-9]{64})\.json$/i

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function accountIdentityDigest(kind, value) {
  return sha256(`${kind}:${value}`)
}

function normalizedInteger(value, fallback = 0) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback
}

function validateCampaign(campaign, accountId) {
  if (!plainObject(campaign)) throw new Error('invalid-campaign-record')
  if (!CAMPAIGN_ID_PATTERN.test(String(campaign.campaignId ?? ''))) {
    throw new Error('invalid-campaign-id')
  }
  if (campaign.ownerAccountId !== accountId) throw new Error('invalid-campaign-owner')
  if (typeof campaign.name !== 'string' || !campaign.name.trim()) {
    throw new Error('invalid-campaign-name')
  }
  if (typeof campaign.rulesetId !== 'string' || !campaign.rulesetId) {
    throw new Error('invalid-campaign-ruleset')
  }
  if (!Number.isFinite(campaign.createdAt) || !Number.isFinite(campaign.updatedAt)) {
    throw new Error('invalid-campaign-timestamp')
  }
}

export function validateAccountDocument(account) {
  if (!plainObject(account)) throw new Error('invalid-account-record')
  if (!ACCOUNT_ID_PATTERN.test(String(account.accountId ?? ''))) {
    throw new Error('invalid-account-id')
  }
  if (typeof account.displayName !== 'string' || !account.displayName.trim()) {
    throw new Error('invalid-account-display-name')
  }
  if (!Number.isFinite(account.createdAt) || !Number.isFinite(account.updatedAt)) {
    throw new Error('invalid-account-timestamp')
  }
  if (account.sessions != null && !Array.isArray(account.sessions)) {
    throw new Error('invalid-account-sessions')
  }
  if (account.campaigns != null && !Array.isArray(account.campaigns)) {
    throw new Error('invalid-account-campaigns')
  }
  for (const campaign of account.campaigns ?? []) validateCampaign(campaign, account.accountId)
  return account
}

function derivedIdentityRecords(account) {
  const records = []
  const auth = plainObject(account.auth) ? account.auth : null
  if (typeof auth?.usernameKey === 'string' && auth.usernameKey) {
    records.push({
      kind: 'username',
      digest: accountIdentityDigest('username', auth.usernameKey),
      accountId: account.accountId,
      createdAt: normalizedInteger(account.createdAt),
    })
  }
  if (
    (auth?.channel === 'email' || auth?.channel === 'phone') &&
    typeof auth.destination === 'string' &&
    auth.destination
  ) {
    records.push({
      kind: auth.channel,
      digest: accountIdentityDigest(auth.channel, auth.destination),
      accountId: account.accountId,
      createdAt: normalizedInteger(auth.destinationVerifiedAt, normalizedInteger(account.createdAt)),
    })
  }
  return records
}

function begin(db) {
  db.exec('BEGIN IMMEDIATE')
}

function rollbackQuietly(db) {
  try {
    db.exec('ROLLBACK')
  } catch {
    // The original database error remains more useful than a secondary rollback error.
  }
}

function transaction(db, work) {
  begin(db)
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    rollbackQuietly(db)
    throw error
  }
}

function initializeSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = FULL;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS accounts (
      account_id TEXT PRIMARY KEY,
      account_version INTEGER NOT NULL,
      display_name TEXT NOT NULL,
      document_json TEXT NOT NULL CHECK (json_valid(document_json)),
      document_sha256 TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      imported_from TEXT,
      imported_at INTEGER
    ) STRICT;

    CREATE TABLE IF NOT EXISTS account_sessions (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
      client_id TEXT,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS account_sessions_account_id
      ON account_sessions(account_id);

    CREATE TABLE IF NOT EXISTS account_identities (
      kind TEXT NOT NULL CHECK (kind IN ('username', 'email', 'phone')),
      identity_digest TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (kind, identity_digest)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS account_identities_account_id
      ON account_identities(account_id);

    CREATE TABLE IF NOT EXISTS campaigns (
      campaign_id TEXT PRIMARY KEY,
      owner_account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
      schema_version INTEGER NOT NULL,
      name TEXT NOT NULL,
      ruleset_id TEXT NOT NULL,
      archived INTEGER NOT NULL CHECK (archived IN (0, 1)),
      room_count INTEGER NOT NULL,
      last_room_id TEXT,
      document_json TEXT NOT NULL CHECK (json_valid(document_json)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS campaigns_owner_updated
      ON campaigns(owner_account_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS migration_sources (
      source_path TEXT PRIMARY KEY,
      source_sha256 TEXT NOT NULL,
      source_updated_at INTEGER NOT NULL,
      imported_at INTEGER NOT NULL
    ) STRICT;
  `)
  db.prepare(`
    INSERT OR IGNORE INTO schema_migrations(version, name, applied_at)
    VALUES (?, ?, ?)
  `).run(ACCOUNT_DATABASE_SCHEMA_VERSION, 'account-campaign-index-v1', Date.now())
}

function writeAccountProjections(db, account, identityRecords = []) {
  const accountId = account.accountId
  db.prepare('DELETE FROM account_sessions WHERE account_id = ?').run(accountId)
  db.prepare('DELETE FROM campaigns WHERE owner_account_id = ?').run(accountId)
  db.prepare('DELETE FROM account_identities WHERE account_id = ?').run(accountId)

  const insertSession = db.prepare(`
    INSERT INTO account_sessions(token_hash, account_id, client_id, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?)
  `)
  for (const session of account.sessions ?? []) {
    if (!plainObject(session) || typeof session.tokenHash !== 'string' || !session.tokenHash) continue
    insertSession.run(
      session.tokenHash,
      accountId,
      typeof session.clientId === 'string' ? session.clientId : null,
      normalizedInteger(session.createdAt),
      normalizedInteger(session.lastSeenAt, normalizedInteger(session.createdAt)),
    )
  }

  const insertCampaign = db.prepare(`
    INSERT INTO campaigns(
      campaign_id, owner_account_id, schema_version, name, ruleset_id, archived,
      room_count, last_room_id, document_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const campaign of account.campaigns ?? []) {
    insertCampaign.run(
      campaign.campaignId,
      accountId,
      normalizedInteger(campaign.schemaVersion, 1),
      campaign.name,
      campaign.rulesetId,
      campaign.archived === true ? 1 : 0,
      normalizedInteger(campaign.roomCount),
      typeof campaign.lastRoomId === 'string' && campaign.lastRoomId ? campaign.lastRoomId : null,
      JSON.stringify(campaign),
      normalizedInteger(campaign.createdAt),
      normalizedInteger(campaign.updatedAt),
    )
  }

  const identities = new Map()
  for (const identity of [...derivedIdentityRecords(account), ...identityRecords]) {
    if (
      !plainObject(identity) ||
      !['username', 'email', 'phone'].includes(identity.kind) ||
      !/^[a-f0-9]{64}$/i.test(String(identity.digest ?? '')) ||
      identity.accountId !== accountId
    ) continue
    identities.set(`${identity.kind}:${identity.digest.toLowerCase()}`, {
      ...identity,
      digest: identity.digest.toLowerCase(),
    })
  }
  const insertIdentity = db.prepare(`
    INSERT INTO account_identities(kind, identity_digest, account_id, created_at)
    VALUES (?, ?, ?, ?)
  `)
  for (const identity of identities.values()) {
    insertIdentity.run(
      identity.kind,
      identity.digest,
      accountId,
      normalizedInteger(identity.createdAt, normalizedInteger(account.createdAt)),
    )
  }
}

function writeAccountRow(db, account, options = {}) {
  validateAccountDocument(account)
  const documentJson = JSON.stringify(account)
  const documentSha256 = sha256(documentJson)
  const existing = db.prepare(`
    SELECT document_sha256, updated_at, revision
    FROM accounts
    WHERE account_id = ?
  `).get(account.accountId)

  if (options.createOnly && existing) {
    const error = new Error('account-already-exists')
    error.code = 'ACCOUNT_EXISTS'
    throw error
  }
  if (options.importing && existing) {
    if (existing.document_sha256 === documentSha256) return 'unchanged'
    if (Number(existing.updated_at) > Number(account.updatedAt)) return 'preserved'
    if (Number(existing.updated_at) === Number(account.updatedAt)) {
      const error = new Error(`account-import-conflict:${account.accountId}`)
      error.code = 'ACCOUNT_IMPORT_CONFLICT'
      throw error
    }
  }

  const revision = existing ? Number(existing.revision) + 1 : 1
  db.prepare(`
    INSERT INTO accounts(
      account_id, account_version, display_name, document_json, document_sha256,
      revision, created_at, updated_at, imported_from, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      account_version = excluded.account_version,
      display_name = excluded.display_name,
      document_json = excluded.document_json,
      document_sha256 = excluded.document_sha256,
      revision = excluded.revision,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      imported_from = COALESCE(excluded.imported_from, accounts.imported_from),
      imported_at = COALESCE(excluded.imported_at, accounts.imported_at)
  `).run(
    account.accountId,
    normalizedInteger(account.version, 1),
    account.displayName,
    documentJson,
    documentSha256,
    revision,
    normalizedInteger(account.createdAt),
    normalizedInteger(account.updatedAt),
    options.sourcePath ?? null,
    options.sourcePath ? Date.now() : null,
  )
  writeAccountProjections(db, account, options.identityRecords)
  if (options.sourcePath) {
    db.prepare(`
      INSERT INTO migration_sources(source_path, source_sha256, source_updated_at, imported_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(source_path) DO UPDATE SET
        source_sha256 = excluded.source_sha256,
        source_updated_at = excluded.source_updated_at,
        imported_at = excluded.imported_at
    `).run(options.sourcePath, documentSha256, normalizedInteger(account.updatedAt), Date.now())
  }
  return existing ? 'updated' : 'created'
}

export class SqliteAccountStore {
  constructor(databasePath) {
    this.databasePath = path.resolve(databasePath)
    this.db = new DatabaseSync(this.databasePath)
    try {
      initializeSchema(this.db)
    } catch (error) {
      this.db.close()
      throw error
    }
  }

  close() {
    this.db.close()
  }

  readAccount(accountId) {
    const row = this.db.prepare('SELECT document_json FROM accounts WHERE account_id = ?').get(accountId)
    return row ? JSON.parse(row.document_json) : null
  }

  findIdentity(kind, digest) {
    const row = this.db.prepare(`
      SELECT account_id FROM account_identities
      WHERE kind = ? AND identity_digest = ?
    `).get(kind, digest)
    return row?.account_id ?? null
  }

  createAccount(account, options = {}) {
    return transaction(this.db, () => writeAccountRow(this.db, account, {
      ...options,
      createOnly: true,
    }))
  }

  writeAccount(account, options = {}) {
    return transaction(this.db, () => writeAccountRow(this.db, account, options))
  }

  deleteAccount(accountId) {
    return transaction(this.db, () => {
      this.db.prepare('DELETE FROM accounts WHERE account_id = ?').run(accountId)
    })
  }

  importSnapshot(entries, identities = []) {
    const identitiesByAccount = new Map()
    for (const identity of identities) {
      const list = identitiesByAccount.get(identity.accountId) ?? []
      list.push(identity)
      identitiesByAccount.set(identity.accountId, list)
    }
    return transaction(this.db, () => {
      const report = { created: 0, updated: 0, unchanged: 0, preserved: 0 }
      for (const entry of entries) {
        const status = writeAccountRow(this.db, entry.account, {
          importing: true,
          sourcePath: entry.sourcePath,
          identityRecords: identitiesByAccount.get(entry.account.accountId) ?? [],
        })
        report[status] += 1
      }
      return report
    })
  }

  exportSnapshot() {
    return {
      entries: this.db.prepare(`
        SELECT account_id, document_json
        FROM accounts
        ORDER BY account_id
      `).all().map((row) => ({
        account: JSON.parse(row.document_json),
        sourcePath: `sqlite:${this.databasePath}#accounts/${row.account_id}`,
      })),
      identities: this.db.prepare(`
        SELECT kind, identity_digest, account_id, created_at
        FROM account_identities
        ORDER BY kind, identity_digest
      `).all().map((row) => ({
        kind: row.kind,
        digest: row.identity_digest,
        accountId: row.account_id,
        createdAt: Number(row.created_at),
      })),
    }
  }

  diagnostics() {
    const scalar = (table) => Number(this.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)
    return {
      schemaVersion: ACCOUNT_DATABASE_SCHEMA_VERSION,
      databasePath: this.databasePath,
      accounts: scalar('accounts'),
      campaigns: scalar('campaigns'),
      sessions: scalar('account_sessions'),
      identities: scalar('account_identities'),
      migrationSources: scalar('migration_sources'),
      integrity: this.db.prepare('PRAGMA integrity_check').get().integrity_check,
    }
  }
}

export async function openSqliteAccountStore(databasePath) {
  await mkdir(path.dirname(path.resolve(databasePath)), { recursive: true })
  return new SqliteAccountStore(databasePath)
}

export async function readLegacyAccountSnapshot(sharedRoot) {
  const accountRoot = path.join(path.resolve(sharedRoot), 'lobby', 'accounts')
  const entries = []
  const invalid = []
  let names = []
  try {
    names = await readdir(accountRoot)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  for (const name of names.filter((candidate) => /^[A-HJ-NP-Z2-9]{12}\.json$/.test(candidate)).sort()) {
    const sourcePath = path.join(accountRoot, name)
    try {
      const account = validateAccountDocument(JSON.parse(await readFile(sourcePath, 'utf8')))
      if (`${account.accountId}.json` !== name) throw new Error('account-file-id-mismatch')
      entries.push({ account, sourcePath })
    } catch (error) {
      invalid.push({ sourcePath, error: error?.message ?? String(error) })
    }
  }

  const identities = []
  const identityRoot = path.join(accountRoot, 'identities')
  let identityNames = []
  try {
    identityNames = await readdir(identityRoot)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  for (const name of identityNames.sort()) {
    const match = name.match(IDENTITY_FILE_PATTERN)
    if (!match) continue
    const sourcePath = path.join(identityRoot, name)
    try {
      const record = JSON.parse(await readFile(sourcePath, 'utf8'))
      if (!plainObject(record) || !ACCOUNT_ID_PATTERN.test(String(record.accountId ?? ''))) {
        throw new Error('invalid-identity-record')
      }
      identities.push({
        kind: match[1].toLowerCase(),
        digest: match[2].toLowerCase(),
        accountId: record.accountId,
        createdAt: normalizedInteger(record.createdAt),
        sourcePath,
      })
    } catch (error) {
      invalid.push({ sourcePath, error: error?.message ?? String(error) })
    }
  }
  return { entries, identities, invalid }
}

export async function migrateLegacyAccountsToSqlite(options) {
  const sharedRoot = path.resolve(options.sharedRoot)
  const databasePath = path.resolve(options.databasePath ?? path.join(sharedRoot, 'astraltrace.sqlite'))
  const snapshot = await readLegacyAccountSnapshot(sharedRoot)
  if (snapshot.invalid.length > 0) {
    const error = new Error(`legacy-account-snapshot-invalid:${snapshot.invalid.length}`)
    error.code = 'LEGACY_SNAPSHOT_INVALID'
    error.invalid = snapshot.invalid
    throw error
  }
  if (options.dryRun) {
    return {
      dryRun: true,
      databasePath,
      accounts: snapshot.entries.length,
      identities: snapshot.identities.length,
      campaigns: snapshot.entries.reduce(
        (total, entry) => total + (Array.isArray(entry.account.campaigns) ? entry.account.campaigns.length : 0),
        0,
      ),
    }
  }
  const store = await openSqliteAccountStore(databasePath)
  try {
    const importReport = store.importSnapshot(snapshot.entries, snapshot.identities)
    return {
      dryRun: false,
      databasePath,
      accounts: snapshot.entries.length,
      identities: snapshot.identities.length,
      campaigns: snapshot.entries.reduce(
        (total, entry) => total + (Array.isArray(entry.account.campaigns) ? entry.account.campaigns.length : 0),
        0,
      ),
      ...importReport,
      diagnostics: store.diagnostics(),
    }
  } finally {
    store.close()
  }
}
