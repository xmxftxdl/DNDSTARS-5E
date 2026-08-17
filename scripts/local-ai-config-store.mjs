import { execFileSync } from 'node:child_process'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { AI_MODEL_POLICY, AI_MODEL_POLICY_VERSION } from '../shared/ai-model-policy.mjs'

export const LOCAL_AI_CONFIG_SCHEMA_VERSION = 1

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function safeUrl(value, { optional = false, loopbackOnly = false } = {}) {
  const normalized = clean(value)
  if (!normalized && optional) return ''
  const url = new URL(normalized)
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(hostname)
  if (loopbackOnly && !loopback) throw new Error('local-ai-config-url-must-be-loopback')
  if ((!loopback && url.protocol !== 'https:') || (loopback && !['http:', 'https:'].includes(url.protocol))) {
    throw new Error('local-ai-config-url-must-use-https')
  }
  if (url.username || url.password) throw new Error('local-ai-config-url-must-not-contain-credentials')
  url.pathname = url.pathname.replace(/\/$/, '')
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export function defaultLocalAiConfigDirectory({
  platform = process.platform,
  env = process.env,
  home = os.homedir(),
} = {}) {
  if (clean(env.ASTRALTRACE_LOCAL_AI_CONFIG_DIR)) return path.resolve(env.ASTRALTRACE_LOCAL_AI_CONFIG_DIR)
  if (platform === 'win32') {
    return path.resolve(clean(env.LOCALAPPDATA) || clean(env.APPDATA) || home, 'StarsApp', 'local-ai')
  }
  return path.resolve(clean(env.XDG_CONFIG_HOME) || path.join(home, '.config'), 'astraltrace', 'local-ai')
}

function pathsFor(directory) {
  return {
    directory,
    config: path.join(directory, 'config.json'),
    secret: path.join(directory, process.platform === 'win32' ? 'secrets.dpapi' : 'secrets.enc.json'),
    key: path.join(directory, '.secrets.key'),
    usage: path.join(directory, 'usage.jsonl'),
    playerUsage: path.join(directory, 'player-usage.jsonl'),
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
    maxBuffer: 2 * 1024 * 1024,
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
  if (envelope?.algorithm !== 'aes-256-gcm') throw new Error('local-ai-secret-envelope-invalid')
  const key = await fallbackKey(files.key)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
  return JSON.parse(plaintext)
}

function normalizedConfig(input) {
  const apiUrl = safeUrl(input.apiUrl)
  const imageApiUrl = safeUrl(input.imageApiUrl || apiUrl)
  const ocrApiUrl = safeUrl(input.ocrApiUrl, { optional: true, loopbackOnly: true })
  const allowedOrigins = Array.isArray(input.allowedOrigins)
    ? [...new Set(input.allowedOrigins.map(clean).filter(Boolean))].slice(0, 20)
    : []
  return {
    apiUrl,
    imageApiUrl,
    ocrApiUrl,
    ocrEngineId: clean(input.ocrEngineId) || 'rapidocr',
    allowedOrigins,
  }
}

export async function saveLocalAiBridgeConfig(input, options = {}) {
  const platform = options.platform ?? process.platform
  const directory = options.directory ?? defaultLocalAiConfigDirectory({ platform })
  const files = pathsFor(directory)
  const publicConfig = normalizedConfig(input)
  const apiKey = clean(input.apiKey)
  const imageApiKey = clean(input.imageApiKey) || apiKey
  const ocrApiKey = clean(input.ocrApiKey)
  if (!apiKey || !imageApiKey) throw new Error('local-ai-api-key-required')
  const secretStorage = await protectSecrets({ apiKey, imageApiKey, ocrApiKey }, files, platform)
  const config = {
    schemaVersion: LOCAL_AI_CONFIG_SCHEMA_VERSION,
    modelPolicyVersion: AI_MODEL_POLICY_VERSION,
    models: AI_MODEL_POLICY,
    ...publicConfig,
    secretStorage,
    savedAt: Date.now(),
  }
  await atomicOwnerOnlyWrite(files.config, `${JSON.stringify(config, null, 2)}\n`)
  return { config, files }
}

export async function loadLocalAiBridgeConfig(options = {}) {
  const platform = options.platform ?? process.platform
  const directory = options.directory ?? defaultLocalAiConfigDirectory({ platform })
  const files = pathsFor(directory)
  try {
    const config = JSON.parse(await readFile(files.config, 'utf8'))
    if (config?.schemaVersion !== LOCAL_AI_CONFIG_SCHEMA_VERSION) throw new Error('local-ai-config-version-mismatch')
    const normalized = normalizedConfig(config)
    const secrets = await unprotectSecrets(files, platform, config.secretStorage)
    if (!clean(secrets.apiKey) || !clean(secrets.imageApiKey)) throw new Error('local-ai-config-secret-missing')
    return {
      found: true,
      config: {
        ...config,
        ...normalized,
        apiKey: clean(secrets.apiKey),
        imageApiKey: clean(secrets.imageApiKey),
        ocrApiKey: clean(secrets.ocrApiKey),
      },
      files,
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return { found: false, config: null, files }
    throw error
  }
}

export function localAiBridgeOptionsFromConfig(config, env = process.env) {
  const value = config ?? {}
  const environmentValue = (name, fallback = '') => clean(env[name]) || fallback
  const sharedApiUrl = environmentValue('ASTRALTRACE_MODEL_API_URL', value.apiUrl)
  const sharedApiKey = environmentValue('ASTRALTRACE_MODEL_API_KEY', value.apiKey)
  return {
    externalApiUrl: sharedApiUrl,
    externalApiKey: sharedApiKey,
    externalModelId: AI_MODEL_POLICY.generalModelId,
    externalModelDisplayName: 'GPT-5.6 Luna',
    externalExtractionApiUrl: sharedApiUrl,
    externalExtractionApiKey: sharedApiKey,
    externalExtractionModelId: AI_MODEL_POLICY.pdfExtractionModelId,
    externalExtractionModelDisplayName: 'GPT-5.6 Luna · PDF 分段提取',
    externalSynthesisApiUrl: sharedApiUrl,
    externalSynthesisApiKey: sharedApiKey,
    externalSynthesisModelId: AI_MODEL_POLICY.pdfSynthesisModelId,
    externalSynthesisModelDisplayName: 'GPT-5.6 Sol · PDF 全书综合',
    externalImageApiUrl: environmentValue('ASTRALTRACE_IMAGE_MODEL_API_URL', value.imageApiUrl || sharedApiUrl),
    externalImageApiKey: environmentValue('ASTRALTRACE_IMAGE_MODEL_API_KEY', value.imageApiKey || sharedApiKey),
    externalImageModelId: AI_MODEL_POLICY.imageModelId,
    externalImageDefaultQuality: AI_MODEL_POLICY.imageQuality,
    ocrApiUrl: environmentValue('ASTRALTRACE_OCR_API_URL', value.ocrApiUrl),
    ocrApiKey: environmentValue('ASTRALTRACE_OCR_API_KEY', value.ocrApiKey),
    ocrEngineId: environmentValue('ASTRALTRACE_OCR_ENGINE', value.ocrEngineId || 'rapidocr'),
    allowedOrigins: clean(env.ASTRALTRACE_LOCAL_AI_ORIGINS)
      ? env.ASTRALTRACE_LOCAL_AI_ORIGINS.split(',').map(clean).filter(Boolean)
      : value.allowedOrigins?.length ? value.allowedOrigins : undefined,
  }
}
