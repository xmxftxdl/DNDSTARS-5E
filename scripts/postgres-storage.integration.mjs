import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openPostgresStorage } from './postgres-storage.mjs'

const databaseUrl = String(process.env.STARS_TEST_DATABASE_URL ?? '').trim()
if (!databaseUrl) {
  throw new Error('STARS_TEST_DATABASE_URL is required')
}

const scriptRoot = path.dirname(fileURLToPath(import.meta.url))
const sharedRoot = await mkdtemp(path.join(os.tmpdir(), 'astraltrace-postgres-integration-'))
const accountId = 'ABCDEFGHJKLM'
const campaignId = 'MNPQRSTUV234'
const createdAt = Date.now()

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
  const fallback = emptyRegistry()
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1) return fallback
  for (const key of Object.keys(fallback).filter((key) => key !== 'schemaVersion')) {
    fallback[key] = Array.isArray(value[key]) ? value[key] : []
  }
  return fallback
}

const account = {
  version: 1,
  accountId,
  displayName: 'PostgreSQL 集成测试账号',
  createdAt,
  updatedAt: createdAt,
  auth: {
    usernameKey: 'postgres-integration',
    channel: 'email',
    destination: 'postgres-integration@example.invalid',
    destinationVerifiedAt: createdAt,
  },
  sessions: [{
    tokenHash: 'postgres-integration-session-token-hash',
    clientId: 'postgres-integration-client',
    createdAt,
    lastSeenAt: createdAt,
  }],
  campaigns: [{
    schemaVersion: 1,
    campaignId,
    ownerAccountId: accountId,
    name: 'PostgreSQL 恢复测试战役',
    rulesetId: 'dnd5e-2014-srd-5.1',
    archived: false,
    roomCount: 2,
    lastRoomId: 'PGTEST',
    aiWorkspace: {
      schemaVersion: 1,
      updatedAt: createdAt,
      jobs: [{
        schemaVersion: 2,
        jobId: 'cb2ec8e3-742a-48f5-ad6b-20eb797a8ed7',
        accountId,
        campaignId,
        taskKind: 'campaign-analysis',
        executionMode: 'local-runner',
        providerId: 'local-bridge',
        modelId: 'qwen3.5:35b',
        promptVersion: 'pdf-campaign-analysis-v2',
        idempotencyKey: 'postgres-ai-job-0001',
        sourceAssets: [{ assetId: 'pdf-1', name: '模组.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }],
        input: { depth: 'deep' },
        status: 'review-required',
        revision: 3,
        progress: { stage: 'review-required', current: 1, total: 1, message: '等待 DM 审阅' },
        lease: null,
        artifact: null,
        failure: null,
        createdAt,
        updatedAt: createdAt,
      }],
    },
    createdAt,
    updatedAt: createdAt,
  }],
}

const pendingOrder = {
  orderId: 'order-postgres-integration',
  accountId,
  publisherAccountId: 'NPQRSTUV2345',
  productId: 'product-postgres-integration',
  version: '1.0.0',
  status: 'pending',
  currency: 'CNY',
  amountMinor: 9900,
  createdAt,
  updatedAt: createdAt,
}

const sourceRegistry = {
  ...emptyRegistry(),
  orders: [pendingOrder],
}

try {
  const accountRoot = path.join(sharedRoot, 'lobby', 'accounts')
  await mkdir(accountRoot, { recursive: true })
  await writeFile(
    path.join(accountRoot, `${accountId}.json`),
    JSON.stringify(account),
    'utf8',
  )
  await writeFile(
    path.join(sharedRoot, 'lobby', 'plugin-registry.json'),
    JSON.stringify(sourceRegistry),
    'utf8',
  )

  const migration = spawnSync(process.execPath, [
    path.join(scriptRoot, 'migrate-storage-to-postgres.mjs'),
    '--source', 'json',
    '--shared-root', sharedRoot,
    '--database-url', databaseUrl,
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      STARS_DATABASE_URL: databaseUrl,
      STARS_SHARED_ROOT: sharedRoot,
    },
  })
  if (migration.status !== 0) {
    process.stderr.write(migration.stderr)
    throw new Error(`PostgreSQL migration failed with status ${migration.status}`)
  }
  const migrationResult = JSON.parse(migration.stdout)
  assert.equal(migrationResult.accounts.created, 1)
  assert.equal(migrationResult.campaigns, 1)
  assert.equal(migrationResult.orders, 1)

  const postgres = await openPostgresStorage(databaseUrl)
  try {
    assert.deepEqual(await postgres.readAccount(accountId), account)
    const diagnostics = await postgres.diagnostics()
    assert.equal(diagnostics.accounts, 1)
    assert.equal(diagnostics.campaigns, 1)
    assert.equal(diagnostics.sessions, 1)
    assert.equal(diagnostics.identities, 2)
    assert.equal(diagnostics.aiJobs, 1)
    assert.equal(diagnostics.orders, 1)
    assert.equal(diagnostics.integrity, 'ok')

    const paidAt = createdAt + 1_000
    const paidRegistry = await postgres.mutateMarketplaceRegistry(
      normalizeRegistry,
      emptyRegistry,
      (current) => ({
        ...current,
        orders: current.orders.map((order) => order.orderId === pendingOrder.orderId
          ? { ...order, status: 'paid', updatedAt: paidAt }
          : order),
        paymentEvents: [{
          provider: 'integration',
          providerEventId: 'payment-postgres-integration',
          orderId: pendingOrder.orderId,
          receivedAt: paidAt,
        }],
        ledgerEntries: [{
          entryId: 'ledger-postgres-integration',
          orderId: pendingOrder.orderId,
          beneficiaryAccountId: pendingOrder.publisherAccountId,
          kind: 'creator-share',
          currency: 'CNY',
          amountMinor: 5940,
          availableAt: paidAt,
          createdAt: paidAt,
        }],
        payouts: [{
          payoutId: 'payout-postgres-integration',
          creatorAccountId: pendingOrder.publisherAccountId,
          status: 'pending',
          currency: 'CNY',
          amountMinor: 5940,
          createdAt: paidAt,
          updatedAt: paidAt,
        }],
      }),
    )
    assert.equal(paidRegistry.orders[0].status, 'paid')
    assert.equal((await postgres.diagnostics()).ledgerEntries, 1)
    assert.equal((await postgres.diagnostics()).payouts, 1)

    await assert.rejects(
      postgres.mutateMarketplaceRegistry(
        normalizeRegistry,
        emptyRegistry,
        (current) => ({
          ...current,
          ledgerEntries: current.ledgerEntries.map((entry) => ({
            ...entry,
            amountMinor: entry.amountMinor + 1,
          })),
        }),
      ),
      /marketplace-ledger-entry-conflict/,
    )
    const afterConflict = await postgres.readMarketplaceRegistry(normalizeRegistry)
    assert.equal(afterConflict.ledgerEntries[0].amountMinor, 5940)
  } finally {
    await postgres.close()
  }

  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    accountId,
    campaignId,
    migratedOrders: 1,
    immutableLedgerConflictRejected: true,
  })}\n`)
} finally {
  await rm(sharedRoot, { recursive: true, force: true })
}
