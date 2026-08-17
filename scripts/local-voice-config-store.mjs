import { execFileSync } from 'node:child_process'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const LOCAL_VOICE_CONFIG_SCHEMA_VERSION = 1

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizedServerUrl(value) {
  const normalized = clean(value)
  const url = new URL(normalized)
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(hostname)
  if (url.protocol !== 'wss:' && !(loopback && url.protocol === 'ws:')) {
    throw new Error('local-voice-url-must-use-wss')
  }
  if (url.username || url.password) throw new Error('local-voice-url-must-not-contain-credentials')
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export function defaultLocalVoiceConfigDirectory({
  platform = process.platform,
  env = process.env,
  home = os.homedir(),
} = {}) {
  if (clean(env.ASTRALTRACE_LOCAL_VOICE_CONFIG_DIR)) return path.resolve(env.ASTRALTRACE_LOCAL_VOICE_CONFIG_DIR)
  if (platform === 'win32') {
    return path.resolve(clean(env.LOCALAPPDATA) || clean(env.APPDATA) || home, 'StarsApp', 'voice')
  }
  return path.resolve(clean(env.XDG_CONFIG_HOME) || path.join(home, '.config'), 'astraltrace', 'voice')
}

function pathsFor(directory, platform) {
  return {
    directory,
    config: path.join(directory, 'config.json'),
    secret: path.join(directory, platform === 'win32' ? 'secrets.dpapi' : 'secrets.enc.json'),
    key: path.join(directory, '.secrets.key'),
  }
}

async function atomicOwnerOnlyWrite(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, value, { encoding: 'utf8', mode: 0o600 })
  await chmod(temporary, 0o600).catch(() => undefined)
  await rename(temporary, file)
  await chmod(file, 0o600).catch(() => undefined)
}

const DPAPI_PROTECT = [
  'Add-Type -AssemblyName System.Security;',
  '$plain=[Console]::In.ReadToEnd();',
  '$bytes=[Text.Encoding]::UTF8.GetBytes($plain);',
  '$protected=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);',
  '[Console]::Out.Write([Convert]::ToBase64String($protected));',
].join('')

const DPAPI_UNPROTECT = [
  'Add-Type -AssemblyName System.Security;',
  '$encoded=[Console]::In.ReadToEnd().Trim();',
  '$protected=[Convert]::FromBase64String($encoded);',
  '$bytes=[Security.Cryptography.ProtectedData]::Unprotect($protected,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);',
  '[Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes));',
].join('')

function powershellDpapi(script, input) {
  return execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
    input,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 512 * 1024,
  }).trim()
}

async function fallbackKey(file) {
  try {
    const existing = Buffer.from((await readFile(file, 'utf8')).trim(), 'base64')
    if (existing.length === 32) return existing
  } catch {
    // Create a new owner-only key below.
  }
  const created = randomBytes(32)
  await atomicOwnerOnlyWrite(file, created.toString('base64'))
  return created
}

async function protectSecrets(secrets, files, platform) {
  const plaintext = JSON.stringify(secrets)
  if (platform === 'win32') {
    await atomicOwnerOnlyWrite(files.secret, powershellDpapi(DPAPI_PROTECT, plaintext))
    return 'windows-dpapi-current-user'
  }
  const key = await fallbackKey(files.key)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  await atomicOwnerOnlyWrite(files.secret, JSON.stringify({
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: encrypted.toString('base64'),
  }))
  return 'owner-key-aes-256-gcm'
}

async function unprotectSecrets(files, platform, kind) {
  const encoded = await readFile(files.secret, 'utf8')
  if (platform === 'win32' || kind === 'windows-dpapi-current-user') {
    return JSON.parse(powershellDpapi(DPAPI_UNPROTECT, encoded))
  }
  const envelope = JSON.parse(encoded)
  if (envelope?.algorithm !== 'aes-256-gcm') throw new Error('local-voice-secret-envelope-invalid')
  const key = await fallbackKey(files.key)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
  return JSON.parse(plaintext)
}

export async function saveLocalVoiceConfig(input, options = {}) {
  const platform = options.platform ?? process.platform
  const directory = options.directory ?? defaultLocalVoiceConfigDirectory({ platform })
  const files = pathsFor(directory, platform)
  const serverUrl = normalizedServerUrl(input.serverUrl)
  const apiKey = clean(input.apiKey)
  const apiSecret = clean(input.apiSecret)
  if (!apiKey || !apiSecret) throw new Error('local-voice-credentials-required')
  const secretStorage = await protectSecrets({ apiKey, apiSecret }, files, platform)
  const config = {
    schemaVersion: LOCAL_VOICE_CONFIG_SCHEMA_VERSION,
    serverUrl,
    secretStorage,
    savedAt: Date.now(),
  }
  await atomicOwnerOnlyWrite(files.config, `${JSON.stringify(config, null, 2)}\n`)
  return { config: { ...config, apiKey, apiSecret }, files }
}

export async function loadLocalVoiceConfig(options = {}) {
  const platform = options.platform ?? process.platform
  const directory = options.directory ?? defaultLocalVoiceConfigDirectory({ platform })
  const files = pathsFor(directory, platform)
  try {
    const stored = JSON.parse(await readFile(files.config, 'utf8'))
    if (stored?.schemaVersion !== LOCAL_VOICE_CONFIG_SCHEMA_VERSION) throw new Error('local-voice-config-version-mismatch')
    const serverUrl = normalizedServerUrl(stored.serverUrl)
    const secrets = await unprotectSecrets(files, platform, stored.secretStorage)
    const apiKey = clean(secrets.apiKey)
    const apiSecret = clean(secrets.apiSecret)
    if (!apiKey || !apiSecret) throw new Error('local-voice-secret-missing')
    return { found: true, config: { ...stored, serverUrl, apiKey, apiSecret }, files }
  } catch (error) {
    if (error?.code === 'ENOENT') return { found: false, config: null, files }
    throw error
  }
}

export function applyLocalVoiceConfigToEnvironment(config, env = process.env) {
  if (!config) return env
  if (!clean(env.STARS_LIVEKIT_URL)) env.STARS_LIVEKIT_URL = config.serverUrl
  if (!clean(env.STARS_LIVEKIT_API_KEY)) env.STARS_LIVEKIT_API_KEY = config.apiKey
  if (!clean(env.STARS_LIVEKIT_API_SECRET)) env.STARS_LIVEKIT_API_SECRET = config.apiSecret
  return env
}
