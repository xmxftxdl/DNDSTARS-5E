/// <reference types="node" />
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

let processHandle: ChildProcess | undefined
let root = ''
let base = ''
async function start(backend = 'json') {
  root = await mkdtemp(path.join(os.tmpdir(), 'stars-reset-'))
  const probe = createServer()
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = (probe.address() as { port: number }).port
  await new Promise<void>(resolve => probe.close(() => resolve()))
  await mkdir(path.join(root, 'dist'))
  await writeFile(path.join(root, 'dist/index.html'), '<title>test</title>')
  processHandle = spawn(process.execPath, ['scripts/static-server.mjs', '--host', '127.0.0.1', '--port', String(port), '--root', path.join(root, 'dist')], {
    cwd: path.resolve(__dirname, '../..'), stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'test', STARS_SECURITY_MODE: 'development', STARS_SHARED_ROOT: root,
      STARS_SHARED_SECRET: '', STARS_ACCOUNT_STORAGE: backend, STARS_DATABASE_PATH: path.join(root, 'accounts.sqlite'),
      STARS_EMAIL_VERIFICATION_WEBHOOK_URL: '', STARS_SMS_VERIFICATION_WEBHOOK_URL: '', STARS_VERIFICATION_WEBHOOK_URL: '',
      ASTRALTRACE_LOCAL_AI_CONFIG_DIR: path.join(root, 'ai'), ASTRALTRACE_LOCAL_VOICE_CONFIG_DIR: path.join(root, 'voice') },
  })
  base = `http://127.0.0.1:${port}`
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(`${base}/api/accounts/auth/config`)).ok) return } catch { /* booting */ }
    if (processHandle.exitCode != null) throw new Error('password-reset test server exited')
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('password-reset test server did not start')
}
afterEach(async () => {
  if (processHandle && processHandle.exitCode == null) {
    const stopped = new Promise<void>(resolve => processHandle!.once('exit', () => resolve()))
    processHandle.kill('SIGTERM')
    await stopped
  }
  if (root) await rm(root, { recursive: true, force: true })
})
function post(route: string, body: unknown, token?: string) {
  return fetch(`${base}/api/accounts/${route}`, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { 'X-Stars-Account-Token': token } : {}),
  }, body: JSON.stringify(body) })
}
async function verification(purpose = 'reset-password', destination = 'reset@example.com', channel = 'email') {
  const response = await post('auth/verification', { purpose, channel, destination })
  expect(response.status).toBe(201)
  return response.json() as Promise<{ challengeId: string; debugCode: string }>
}
async function register(channel = 'email', destination = 'reset@example.com') {
  const challenge = await verification('register', destination, channel)
  const response = await post('auth/register', { challengeId: challenge.challengeId, verificationCode: challenge.debugCode,
    username: '找回测试', password: 'OriginalPassword42', clientId: 'original-test-device' })
  expect(response.status).toBe(201)
  return (await response.json()).session as { accountId: string; sessionToken: string }
}
const resetBody = (challenge: { challengeId: string; debugCode: string }) => ({
  challengeId: challenge.challengeId, verificationCode: challenge.debugCode, newPassword: 'ChangedPassword42',
})

describe('forgotten account password HTTP flow', () => {
  it.each([['json', 'email'], ['sqlite', 'email'], ['json', 'phone']])('preserves data and revokes old credentials with %s storage and %s', async (backend, channel) => {
    await start(backend)
    const destination = channel === 'phone' ? '+8613812345678' : 'reset@example.com'
    const session = await register(channel, destination)
    const campaign = await post('me/campaigns', { name: '保留战役', rulesetId: 'dnd5e-2014-srd-5.1' }, session.sessionToken)
    expect(campaign.status).toBe(201)
    const character = await fetch(`${base}/api/accounts/me/characters/hero`, { method: 'PUT', headers: {
      'Content-Type': 'application/json', 'X-Stars-Account-Token': session.sessionToken,
    }, body: JSON.stringify({ id: 'hero', name: '保留角色', character: { id: 'hero', name: '保留角色' }, compatibility: {
      rulesetId: 'dnd5e-2014-srd-5.1', characterSchemaVersion: 1, minimumGameProtocolVersion: 1, lastSavedGameProtocolVersion: 1, requiredPlugins: [],
    } }) })
    expect(character.status).toBe(200)
    const challenge = await verification('reset-password', destination, channel)
    const sibling = await verification('reset-password', destination, channel)
    const registerWithReset = await post('auth/register', { challengeId: challenge.challengeId, verificationCode: challenge.debugCode,
      username: '另一个用户名', password: 'OriginalPassword42', clientId: 'purpose-test-device' })
    expect(registerWithReset.status).toBe(400)
    const attempts = await Promise.all([post('auth/reset-password', resetBody(challenge)), post('auth/reset-password', resetBody(challenge))])
    expect(attempts.map(value => value.status).sort()).toEqual([200, 400])
    expect((await post('auth/reset-password', resetBody(sibling))).status).toBe(400)
    expect((await fetch(`${base}/api/accounts/me`, { headers: { 'X-Stars-Account-Token': session.sessionToken } })).status).toBe(401)
    expect((await post('auth/login', { identifier: destination, password: 'OriginalPassword42', clientId: 'old-password-device' })).status).toBe(401)
    const login = await post('auth/login', { identifier: destination, password: 'ChangedPassword42', clientId: 'new-password-device' })
    expect(login.status).toBe(200)
    const next = (await login.json()).session
    expect(next.accountId).toBe(session.accountId)
    for (const [route, property, name] of [['campaigns', 'campaigns', '保留战役'], ['characters', 'characters', '保留角色']]) {
      const response = await fetch(`${base}/api/accounts/me/${route}`, { headers: { 'X-Stars-Account-Token': next.sessionToken } })
      expect(response.status).toBe(200)
      expect((await response.json())[property]).toEqual(expect.arrayContaining([expect.objectContaining({ name })]))
    }
  }, 20000)

  it('expires codes, limits wrong guesses and rate limits repeated sending', async () => {
    await start()
    await register()
    const expired = await verification()
    const file = path.join(root, 'lobby/accounts/verifications', `${expired.challengeId}.json`)
    const stored = JSON.parse(await readFile(file, 'utf8'))
    expect(JSON.stringify(stored)).not.toContain(`"${expired.debugCode}"`)
    await writeFile(file, JSON.stringify({ ...stored, expiresAt: 0 }))
    expect((await post('auth/reset-password', resetBody(expired))).status).toBe(400)
    const challenge = await verification()
    const wrongCode = challenge.debugCode === '000000' ? '111111' : '000000'
    for (let count = 0; count < 5; count++) expect((await post('auth/reset-password', {
      ...resetBody(challenge), verificationCode: wrongCode,
    })).status).toBe(400)
    expect((await post('auth/reset-password', resetBody(challenge))).status).toBe(429)
    expect((await post('auth/verification', { purpose: 'reset-password', channel: 'email', destination: 'reset@example.com' })).status).toBe(429)
  }, 20000)

  it('rejects registration codes, malformed passwords and unknown contacts', async () => {
    await start()
    const registration = await verification('register', 'unregistered@example.com')
    expect((await post('auth/reset-password', resetBody(registration))).status).toBe(400)
    const unknown = await verification('reset-password', 'unknown@example.com')
    expect(unknown).not.toHaveProperty('accountId')
    expect((await post('auth/reset-password', { ...resetBody(unknown), newPassword: 'short' })).status).toBe(400)
    expect((await post('auth/reset-password', { ...resetBody(unknown), verificationCode: '123456' })).status).toBe(400)
  }, 20000)
})
