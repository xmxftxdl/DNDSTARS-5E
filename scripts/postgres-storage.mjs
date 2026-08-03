import { createHash } from 'node:crypto'
import pg from 'pg'
import {
  accountIdentityDigest,
  validateAccountDocument,
} from './account-storage-sqlite.mjs'

export const POSTGRES_DATABASE_SCHEMA_VERSION = 3

const { Pool } = pg

function normalizedInteger(value, fallback = 0) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
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

async function transaction(pool, work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function initializeSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      account_id TEXT PRIMARY KEY,
      account_version INTEGER NOT NULL,
      display_name TEXT NOT NULL,
      document_json JSONB NOT NULL,
      document_sha256 TEXT NOT NULL,
      revision BIGINT NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      imported_from TEXT,
      imported_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS account_sessions (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
      client_id TEXT,
      created_at BIGINT NOT NULL,
      last_seen_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS account_sessions_account_id
      ON account_sessions(account_id);

    CREATE TABLE IF NOT EXISTS account_identities (
      kind TEXT NOT NULL CHECK (kind IN ('username', 'email', 'phone')),
      identity_digest TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
      created_at BIGINT NOT NULL,
      PRIMARY KEY (kind, identity_digest)
    );
    CREATE INDEX IF NOT EXISTS account_identities_account_id
      ON account_identities(account_id);

    CREATE TABLE IF NOT EXISTS campaigns (
      campaign_id TEXT PRIMARY KEY,
      owner_account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
      schema_version INTEGER NOT NULL,
      name TEXT NOT NULL,
      ruleset_id TEXT NOT NULL,
      archived BOOLEAN NOT NULL,
      room_count INTEGER NOT NULL,
      last_room_id TEXT,
      document_json JSONB NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS campaigns_owner_updated
      ON campaigns(owner_account_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS ai_jobs (
      job_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
      campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
      task_kind TEXT NOT NULL,
      execution_mode TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      status TEXT NOT NULL,
      revision BIGINT NOT NULL,
      idempotency_key TEXT NOT NULL,
      document_json JSONB NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      UNIQUE(account_id, campaign_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS ai_jobs_campaign_updated
      ON ai_jobs(campaign_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS ai_jobs_account_status
      ON ai_jobs(account_id, status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS migration_sources (
      source_path TEXT PRIMARY KEY,
      source_sha256 TEXT NOT NULL,
      source_updated_at BIGINT NOT NULL,
      imported_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marketplace_registry (
      singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
      schema_version INTEGER NOT NULL,
      revision BIGINT NOT NULL DEFAULT 0,
      document_json JSONB NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marketplace_orders (
      order_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      publisher_account_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_version TEXT NOT NULL,
      status TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount_minor BIGINT NOT NULL,
      document_json JSONB NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS marketplace_orders_account_created
      ON marketplace_orders(account_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS marketplace_orders_publisher_created
      ON marketplace_orders(publisher_account_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS marketplace_orders_status
      ON marketplace_orders(status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS marketplace_ledger_entries (
      entry_id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      beneficiary_account_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount_minor BIGINT NOT NULL,
      available_at BIGINT NOT NULL,
      document_json JSONB NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS marketplace_ledger_beneficiary
      ON marketplace_ledger_entries(beneficiary_account_id, currency, available_at);
    CREATE INDEX IF NOT EXISTS marketplace_ledger_order
      ON marketplace_ledger_entries(order_id);

    CREATE TABLE IF NOT EXISTS marketplace_payouts (
      payout_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      status TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount_minor BIGINT NOT NULL,
      document_json JSONB NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS marketplace_payouts_account_created
      ON marketplace_payouts(account_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS marketplace_payouts_status
      ON marketplace_payouts(status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS marketplace_payment_events (
      provider TEXT NOT NULL,
      provider_event_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      document_json JSONB NOT NULL,
      received_at BIGINT NOT NULL,
      PRIMARY KEY (provider, provider_event_id)
    );
  `)
  await pool.query(`
    INSERT INTO schema_migrations(version, name, applied_at)
    VALUES
      (1, 'accounts-campaigns-marketplace-v1', $1),
      (2, 'marketplace-immutable-conflict-guards', $1),
      (3, 'campaign-ai-jobs-v2', $1)
    ON CONFLICT(version) DO NOTHING
  `, [Date.now()])
}

async function writeAccountProjections(client, account, identityRecords = []) {
  const accountId = account.accountId
  await client.query('DELETE FROM account_sessions WHERE account_id = $1', [accountId])
  await client.query('DELETE FROM ai_jobs WHERE account_id = $1', [accountId])
  await client.query('DELETE FROM campaigns WHERE owner_account_id = $1', [accountId])
  await client.query('DELETE FROM account_identities WHERE account_id = $1', [accountId])

  for (const session of account.sessions ?? []) {
    if (!plainObject(session) || typeof session.tokenHash !== 'string' || !session.tokenHash) continue
    await client.query(`
      INSERT INTO account_sessions(token_hash, account_id, client_id, created_at, last_seen_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      session.tokenHash,
      accountId,
      typeof session.clientId === 'string' ? session.clientId : null,
      normalizedInteger(session.createdAt),
      normalizedInteger(session.lastSeenAt, normalizedInteger(session.createdAt)),
    ])
  }

  for (const campaign of account.campaigns ?? []) {
    await client.query(`
      INSERT INTO campaigns(
        campaign_id, owner_account_id, schema_version, name, ruleset_id, archived,
        room_count, last_room_id, document_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
    `, [
      campaign.campaignId,
      accountId,
      normalizedInteger(campaign.schemaVersion, 1),
      campaign.name,
      campaign.rulesetId,
      campaign.archived === true,
      normalizedInteger(campaign.roomCount),
      typeof campaign.lastRoomId === 'string' && campaign.lastRoomId ? campaign.lastRoomId : null,
      JSON.stringify(campaign),
      normalizedInteger(campaign.createdAt),
      normalizedInteger(campaign.updatedAt),
    ])
  }

  for (const campaign of account.campaigns ?? []) {
    const jobs = Array.isArray(campaign?.aiWorkspace?.jobs) ? campaign.aiWorkspace.jobs : []
    for (const job of jobs) {
      if (!plainObject(job) || typeof job.jobId !== 'string' || !job.jobId) continue
      await client.query(`
        INSERT INTO ai_jobs(
          job_id, account_id, campaign_id, task_kind, execution_mode, provider_id,
          model_id, status, revision, idempotency_key, document_json, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)
      `, [
        job.jobId,
        accountId,
        campaign.campaignId,
        String(job.taskKind ?? ''),
        String(job.executionMode ?? ''),
        String(job.providerId ?? ''),
        String(job.modelId ?? ''),
        String(job.status ?? ''),
        normalizedInteger(job.revision, 1),
        String(job.idempotencyKey ?? ''),
        JSON.stringify(job),
        normalizedInteger(job.createdAt),
        normalizedInteger(job.updatedAt, normalizedInteger(job.createdAt)),
      ])
    }
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
  for (const identity of identities.values()) {
    await client.query(`
      INSERT INTO account_identities(kind, identity_digest, account_id, created_at)
      VALUES ($1, $2, $3, $4)
    `, [
      identity.kind,
      identity.digest,
      accountId,
      normalizedInteger(identity.createdAt, normalizedInteger(account.createdAt)),
    ])
  }
}

async function writeAccountRow(client, account, options = {}) {
  validateAccountDocument(account)
  const documentJson = JSON.stringify(account)
  const documentSha256 = sha256(documentJson)
  const existingResult = await client.query(`
    SELECT document_sha256, updated_at, revision
    FROM accounts
    WHERE account_id = $1
    FOR UPDATE
  `, [account.accountId])
  const existing = existingResult.rows[0]

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
  await client.query(`
    INSERT INTO accounts(
      account_id, account_version, display_name, document_json, document_sha256,
      revision, created_at, updated_at, imported_from, imported_at
    ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)
    ON CONFLICT(account_id) DO UPDATE SET
      account_version = EXCLUDED.account_version,
      display_name = EXCLUDED.display_name,
      document_json = EXCLUDED.document_json,
      document_sha256 = EXCLUDED.document_sha256,
      revision = EXCLUDED.revision,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      imported_from = COALESCE(EXCLUDED.imported_from, accounts.imported_from),
      imported_at = COALESCE(EXCLUDED.imported_at, accounts.imported_at)
  `, [
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
  ])
  await writeAccountProjections(client, account, options.identityRecords)
  if (options.sourcePath) {
    await client.query(`
      INSERT INTO migration_sources(source_path, source_sha256, source_updated_at, imported_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(source_path) DO UPDATE SET
        source_sha256 = EXCLUDED.source_sha256,
        source_updated_at = EXCLUDED.source_updated_at,
        imported_at = EXCLUDED.imported_at
    `, [options.sourcePath, documentSha256, normalizedInteger(account.updatedAt), Date.now()])
  }
  return existing ? 'updated' : 'created'
}

function recordKey(collection, record) {
  if (collection === 'orders') return record?.orderId
  if (collection === 'ledgerEntries') return record?.entryId
  if (collection === 'payouts') return record?.payoutId
  if (collection === 'paymentEvents') {
    return record?.provider && record?.providerEventId
      ? `${record.provider}:${record.providerEventId}`
      : null
  }
  return null
}

function changedRecords(collection, before, after) {
  const previous = new Map((before ?? []).map((record) => [recordKey(collection, record), JSON.stringify(record)]))
  return (after ?? []).filter((record) => {
    const key = recordKey(collection, record)
    return key && previous.get(key) !== JSON.stringify(record)
  })
}

async function persistMarketplaceProjections(client, before, next) {
  for (const order of changedRecords('orders', before.orders, next.orders)) {
    const result = await client.query(`
      INSERT INTO marketplace_orders(
        order_id, account_id, publisher_account_id, product_id, product_version,
        status, currency, amount_minor, document_json, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
      ON CONFLICT(order_id) DO UPDATE SET
        status = EXCLUDED.status,
        document_json = EXCLUDED.document_json,
        updated_at = EXCLUDED.updated_at
      WHERE
        marketplace_orders.account_id = EXCLUDED.account_id AND
        marketplace_orders.publisher_account_id = EXCLUDED.publisher_account_id AND
        marketplace_orders.product_id = EXCLUDED.product_id AND
        marketplace_orders.product_version = EXCLUDED.product_version AND
        marketplace_orders.currency = EXCLUDED.currency AND
        marketplace_orders.amount_minor = EXCLUDED.amount_minor
      RETURNING order_id
    `, [
      order.orderId,
      order.accountId,
      order.publisherAccountId,
      order.productId,
      order.version,
      order.status,
      order.currency,
      order.amountMinor,
      JSON.stringify(order),
      normalizedInteger(order.createdAt),
      normalizedInteger(order.updatedAt, normalizedInteger(order.createdAt)),
    ])
    if (result.rowCount !== 1) throw new Error(`marketplace-order-conflict:${order.orderId}`)
  }
  for (const entry of changedRecords('ledgerEntries', before.ledgerEntries, next.ledgerEntries)) {
    const result = await client.query(`
      INSERT INTO marketplace_ledger_entries(
        entry_id, order_id, beneficiary_account_id, kind, currency, amount_minor,
        available_at, document_json, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
      ON CONFLICT(entry_id) DO NOTHING
      RETURNING entry_id
    `, [
      entry.entryId,
      entry.orderId,
      entry.beneficiaryAccountId,
      entry.kind,
      entry.currency,
      entry.amountMinor,
      normalizedInteger(entry.availableAt, normalizedInteger(entry.createdAt)),
      JSON.stringify(entry),
      normalizedInteger(entry.createdAt),
    ])
    if (result.rowCount !== 1) {
      const existing = await client.query(`
        SELECT document_json = $2::jsonb AS matches
        FROM marketplace_ledger_entries
        WHERE entry_id = $1
      `, [entry.entryId, JSON.stringify(entry)])
      if (existing.rows[0]?.matches !== true) {
        throw new Error(`marketplace-ledger-entry-conflict:${entry.entryId}`)
      }
    }
  }
  for (const payout of changedRecords('payouts', before.payouts, next.payouts)) {
    const result = await client.query(`
      INSERT INTO marketplace_payouts(
        payout_id, account_id, status, currency, amount_minor,
        document_json, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
      ON CONFLICT(payout_id) DO UPDATE SET
        status = EXCLUDED.status,
        document_json = EXCLUDED.document_json,
        updated_at = EXCLUDED.updated_at
      WHERE
        marketplace_payouts.account_id = EXCLUDED.account_id AND
        marketplace_payouts.currency = EXCLUDED.currency AND
        marketplace_payouts.amount_minor = EXCLUDED.amount_minor
      RETURNING payout_id
    `, [
      payout.payoutId,
      payout.creatorAccountId,
      payout.status,
      payout.currency,
      payout.amountMinor,
      JSON.stringify(payout),
      normalizedInteger(payout.createdAt),
      normalizedInteger(payout.updatedAt, normalizedInteger(payout.createdAt)),
    ])
    if (result.rowCount !== 1) throw new Error(`marketplace-payout-conflict:${payout.payoutId}`)
  }
  for (const event of changedRecords('paymentEvents', before.paymentEvents, next.paymentEvents)) {
    const result = await client.query(`
      INSERT INTO marketplace_payment_events(
        provider, provider_event_id, order_id, document_json, received_at
      ) VALUES ($1,$2,$3,$4::jsonb,$5)
      ON CONFLICT(provider, provider_event_id) DO NOTHING
      RETURNING provider_event_id
    `, [
      event.provider,
      event.providerEventId,
      event.orderId,
      JSON.stringify(event),
      normalizedInteger(event.receivedAt),
    ])
    if (result.rowCount !== 1) {
      const existing = await client.query(`
        SELECT order_id = $3 AND document_json = $4::jsonb AS matches
        FROM marketplace_payment_events
        WHERE provider = $1 AND provider_event_id = $2
      `, [event.provider, event.providerEventId, event.orderId, JSON.stringify(event)])
      if (existing.rows[0]?.matches !== true) {
        throw new Error(`marketplace-payment-event-conflict:${event.provider}:${event.providerEventId}`)
      }
    }
  }
}

export class PostgresStorage {
  constructor(pool, connectionLabel) {
    this.pool = pool
    this.connectionLabel = connectionLabel
  }

  async close() {
    await this.pool.end()
  }

  async readAccount(accountId) {
    const result = await this.pool.query(
      'SELECT document_json FROM accounts WHERE account_id = $1',
      [accountId],
    )
    return result.rows[0]?.document_json ?? null
  }

  async findIdentity(kind, digest) {
    const result = await this.pool.query(`
      SELECT account_id FROM account_identities
      WHERE kind = $1 AND identity_digest = $2
    `, [kind, digest])
    return result.rows[0]?.account_id ?? null
  }

  async createAccount(account, options = {}) {
    try {
      return await transaction(this.pool, (client) => writeAccountRow(client, account, {
        ...options,
        createOnly: true,
      }))
    } catch (error) {
      if (error?.code === '23505') {
        error.code = String(error.constraint ?? '').includes('accounts_pkey')
          ? 'ACCOUNT_EXISTS'
          : 'EEXIST'
      }
      throw error
    }
  }

  async writeAccount(account, options = {}) {
    return transaction(this.pool, (client) => writeAccountRow(client, account, options))
  }

  async deleteAccount(accountId) {
    await this.pool.query('DELETE FROM accounts WHERE account_id = $1', [accountId])
  }

  async importSnapshot(entries, identities = []) {
    const identitiesByAccount = new Map()
    for (const identity of identities) {
      const list = identitiesByAccount.get(identity.accountId) ?? []
      list.push(identity)
      identitiesByAccount.set(identity.accountId, list)
    }
    return transaction(this.pool, async (client) => {
      const report = { created: 0, updated: 0, unchanged: 0, preserved: 0 }
      for (const entry of entries) {
        const status = await writeAccountRow(client, entry.account, {
          importing: true,
          sourcePath: entry.sourcePath,
          identityRecords: identitiesByAccount.get(entry.account.accountId) ?? [],
        })
        report[status] += 1
      }
      return report
    })
  }

  async readMarketplaceRegistry(normalize) {
    const result = await this.pool.query(
      'SELECT document_json FROM marketplace_registry WHERE singleton = TRUE',
    )
    return result.rows[0] ? normalize(result.rows[0].document_json) : null
  }

  async mutateMarketplaceRegistry(normalize, fallback, updater) {
    return transaction(this.pool, async (client) => {
      const result = await client.query(`
        SELECT document_json, revision
        FROM marketplace_registry
        WHERE singleton = TRUE
        FOR UPDATE
      `)
      const before = result.rows[0] ? normalize(result.rows[0].document_json) : fallback()
      const next = normalize(await updater(before))
      await persistMarketplaceProjections(client, before, next)
      await client.query(`
        INSERT INTO marketplace_registry(singleton, schema_version, revision, document_json, updated_at)
        VALUES (TRUE, $1, 1, $2::jsonb, $3)
        ON CONFLICT(singleton) DO UPDATE SET
          schema_version = EXCLUDED.schema_version,
          revision = marketplace_registry.revision + 1,
          document_json = EXCLUDED.document_json,
          updated_at = EXCLUDED.updated_at
      `, [next.schemaVersion, JSON.stringify(next), Date.now()])
      return next
    })
  }

  async diagnostics() {
    const result = await this.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM accounts) AS accounts,
        (SELECT COUNT(*) FROM campaigns) AS campaigns,
        (SELECT COUNT(*) FROM account_sessions) AS sessions,
        (SELECT COUNT(*) FROM account_identities) AS identities,
        (SELECT COUNT(*) FROM ai_jobs) AS ai_jobs,
        (SELECT COUNT(*) FROM marketplace_orders) AS orders,
        (SELECT COUNT(*) FROM marketplace_ledger_entries) AS ledger_entries,
        (SELECT COUNT(*) FROM marketplace_payouts) AS payouts
    `)
    const row = result.rows[0]
    return {
      schemaVersion: POSTGRES_DATABASE_SCHEMA_VERSION,
      database: this.connectionLabel,
      accounts: Number(row.accounts),
      campaigns: Number(row.campaigns),
      sessions: Number(row.sessions),
      identities: Number(row.identities),
      aiJobs: Number(row.ai_jobs),
      orders: Number(row.orders),
      ledgerEntries: Number(row.ledger_entries),
      payouts: Number(row.payouts),
      integrity: 'ok',
    }
  }
}

export async function openPostgresStorage(connectionString, options = {}) {
  if (typeof connectionString !== 'string' || !connectionString.trim()) {
    throw new Error('STARS_DATABASE_URL is required for PostgreSQL storage')
  }
  const pool = new Pool({
    connectionString,
    max: Number.isSafeInteger(options.maxConnections) ? options.maxConnections : 10,
    connectionTimeoutMillis: Number.isSafeInteger(options.connectionTimeoutMillis)
      ? options.connectionTimeoutMillis
      : 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
    application_name: 'astraltrace-vtt',
  })
  try {
    await pool.query('SELECT 1')
    await initializeSchema(pool)
    return new PostgresStorage(pool, 'postgresql')
  } catch (error) {
    await pool.end().catch(() => {})
    throw error
  }
}
