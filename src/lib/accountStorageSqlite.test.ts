/// <reference types="node" />
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// The production repository is a runtime ESM module copied into the Node image.
// @ts-expect-error JavaScript module intentionally has no generated declaration file.
import * as accountStorageSqlite from '../../scripts/account-storage-sqlite.mjs'

const {
  accountIdentityDigest,
  migrateLegacyAccountsToSqlite,
  openSqliteAccountStore,
} = accountStorageSqlite

const roots: string[] = []

async function tempSharedRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'astraltrace-sqlite-'))
  roots.push(root)
  await mkdir(path.join(root, 'lobby', 'accounts', 'identities'), { recursive: true })
  return root
}

function accountDocument(updatedAt = 1_000) {
  return {
    version: 2,
    accountId: 'TPTDNMUCLM7H',
    displayName: '星痕测试员',
    auth: {
      schemaVersion: 1,
      username: 'AstralTester',
      usernameKey: 'astraltester',
      channel: 'email',
      destination: 'tester@example.com',
      destinationVerifiedAt: 900,
      password: { salt: 'salt', hash: 'hash' },
    },
    sessions: [{
      tokenHash: 'a'.repeat(64),
      clientId: 'browser-a',
      createdAt: 900,
      lastSeenAt: updatedAt,
    }],
    characters: [],
    campaigns: [{
      schemaVersion: 1,
      campaignId: 'Q5XL4RPS4QGF',
      ownerAccountId: 'TPTDNMUCLM7H',
      name: '永不褪色的冒险',
      description: '',
      rulesetId: 'dnd5e-2014-srd-5.1',
      archived: false,
      roomCount: 1,
      roomHistory: [{ roomId: 'QX9TMM', createdAt: 950 }],
      lastRoomId: 'QX9TMM',
      createdAt: 900,
      updatedAt,
    }],
    createdAt: 800,
    updatedAt,
  }
}

async function writeLegacyAccount(root: string, account = accountDocument()) {
  const accountFile = path.join(root, 'lobby', 'accounts', `${account.accountId}.json`)
  await writeFile(accountFile, JSON.stringify(account))
  const digest = accountIdentityDigest('username', account.auth.usernameKey)
  await writeFile(
    path.join(root, 'lobby', 'accounts', 'identities', `username-${digest}.json`),
    JSON.stringify({ version: 1, accountId: account.accountId, createdAt: 900 }),
  )
  return accountFile
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('SQLite 账号与战役索引迁移', () => {
  it('完整导入账号、身份、会话和战役，并可在重启后读取', async () => {
    const root = await tempSharedRoot()
    const databasePath = path.join(root, 'astraltrace.sqlite')
    await writeLegacyAccount(root)

    const report = await migrateLegacyAccountsToSqlite({ sharedRoot: root, databasePath })
    expect(report).toMatchObject({
      accounts: 1,
      identities: 1,
      campaigns: 1,
      created: 1,
      updated: 0,
      unchanged: 0,
    })
    expect(report.diagnostics).toMatchObject({
      accounts: 1,
      campaigns: 1,
      sessions: 1,
      identities: 2,
      integrity: 'ok',
    })

    const store = await openSqliteAccountStore(databasePath)
    expect(store.readAccount('TPTDNMUCLM7H')?.campaigns?.[0]?.name).toBe('永不褪色的冒险')
    expect(store.findIdentity('email', accountIdentityDigest('email', 'tester@example.com')))
      .toBe('TPTDNMUCLM7H')
    store.close()
  })

  it('重复迁移保持幂等，较新的 JSON 才会更新索引', async () => {
    const root = await tempSharedRoot()
    const databasePath = path.join(root, 'astraltrace.sqlite')
    const accountFile = await writeLegacyAccount(root)
    await migrateLegacyAccountsToSqlite({ sharedRoot: root, databasePath })

    const repeated = await migrateLegacyAccountsToSqlite({ sharedRoot: root, databasePath })
    expect(repeated).toMatchObject({ created: 0, updated: 0, unchanged: 1 })

    const newer = accountDocument(2_000)
    newer.displayName = '迁移后的名字'
    await writeFile(accountFile, JSON.stringify(newer))
    const updated = await migrateLegacyAccountsToSqlite({ sharedRoot: root, databasePath })
    expect(updated).toMatchObject({ created: 0, updated: 1, unchanged: 0 })

    const store = await openSqliteAccountStore(databasePath)
    expect(store.readAccount('TPTDNMUCLM7H')?.displayName).toBe('迁移后的名字')
    store.close()
  })

  it('损坏的旧账号会 fail closed，且不会产生部分导入', async () => {
    const root = await tempSharedRoot()
    const databasePath = path.join(root, 'astraltrace.sqlite')
    await writeLegacyAccount(root)
    await writeFile(path.join(root, 'lobby', 'accounts', 'Q5XL4RPS4QGF.json'), '{broken')

    await expect(migrateLegacyAccountsToSqlite({ sharedRoot: root, databasePath }))
      .rejects.toThrow('legacy-account-snapshot-invalid')

    await expect(readFile(databasePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('损坏的 SQLite 文件会在初始化时 fail closed', async () => {
    const root = await tempSharedRoot()
    const databasePath = path.join(root, 'astraltrace.sqlite')
    await writeFile(databasePath, 'not-a-sqlite-database')

    await expect(openSqliteAccountStore(databasePath)).rejects.toThrow()
  })
})
