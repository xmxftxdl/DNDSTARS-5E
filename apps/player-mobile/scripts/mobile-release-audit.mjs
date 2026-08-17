import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(import.meta.dirname, '..')
const repositoryRoot = path.resolve(root, '..', '..')
const app = JSON.parse(await readFile(path.join(root, 'app.json'), 'utf8')).expo
const eas = JSON.parse(await readFile(path.join(root, 'eas.json'), 'utf8'))
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const errors = []

if (app.ios?.bundleIdentifier !== 'com.astraltrace.vtt.player') errors.push('缺少稳定的 iOS bundleIdentifier')
if (app.orientation !== 'landscape') errors.push('玩家端必须锁定横屏')
if (!app.updates?.url?.startsWith('https://u.expo.dev/')) errors.push('缺少 EAS Update URL')
if (!app.runtimeVersion) errors.push('缺少 runtimeVersion；原生更新可能加载不兼容 JS')
if (app.ios?.privacyManifests?.NSPrivacyTracking !== false) errors.push('Privacy Manifest 未明确关闭追踪')
if (!app.extra?.privacyPolicyUrl || !app.extra?.termsOfServiceUrl) errors.push('缺少隐私政策或服务条款 URL')
for (const dependency of ['expo-secure-store', 'expo-notifications', 'expo-updates']) {
  if (!pkg.dependencies?.[dependency]) errors.push(`缺少发布依赖 ${dependency}`)
}
const pluginNames = new Set((app.plugins ?? []).map((plugin) => Array.isArray(plugin) ? plugin[0] : plugin))
if (!pluginNames.has('expo-secure-store')) errors.push('SecureStore 原生插件未启用')
if (!pluginNames.has('expo-notifications')) errors.push('推送通知原生插件未启用')
const collectedTypes = new Set((app.ios?.privacyManifests?.NSPrivacyCollectedDataTypes ?? []).map((entry) => entry.NSPrivacyCollectedDataType))
for (const required of [
  'NSPrivacyCollectedDataTypeName', 'NSPrivacyCollectedDataTypeEmailAddress',
  'NSPrivacyCollectedDataTypePhoneNumber', 'NSPrivacyCollectedDataTypeUserID',
  'NSPrivacyCollectedDataTypeOtherUserContent', 'NSPrivacyCollectedDataTypeAudioData',
]) {
  if (!collectedTypes.has(required)) errors.push(`Privacy Manifest 缺少 ${required}`)
}
if (eas.build?.preview?.channel !== 'staging' || eas.build?.production?.channel !== 'production') {
  errors.push('staging / production 更新频道未隔离')
}

async function sourceFiles(directory) {
  const output = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('dist-')) continue
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) output.push(...await sourceFiles(fullPath))
    else if (/\.(?:ts|tsx|js|mjs|json)$/.test(entry.name)) output.push(fullPath)
  }
  return output
}

for (const filePath of await sourceFiles(root)) {
  const text = await readFile(filePath, 'utf8')
  if (/\bsk-(?:proj-)?[a-zA-Z0-9_-]{20,}\b/.test(text)) {
    errors.push(`发现疑似 API Key：${path.relative(root, filePath)}`)
  }
  if (/LIVEKIT_API_SECRET\s*[:=]\s*["'][^"']+["']/.test(text)) {
    errors.push(`发现硬编码 LiveKit Secret：${path.relative(root, filePath)}`)
  }
}

const sessionStore = await readFile(path.join(root, 'src', 'services', 'sessionStore.ts'), 'utf8')
if (!sessionStore.includes('AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY')) errors.push('账号与房间凭证未限制为本设备 SecureStore')
const mobileApi = await readFile(path.join(root, 'src', 'services', 'mobileApi.ts'), 'utf8')
if (!mobileApi.includes("method: 'DELETE'") || !mobileApi.includes('/accounts/me')) errors.push('App 内账号删除入口未接入')
const appRoutes = await readFile(path.join(repositoryRoot, 'src', 'App.tsx'), 'utf8')
if (!appRoutes.includes("'/privacy'") || !appRoutes.includes("'/terms'")) errors.push('公开隐私政策或服务条款路由缺失')

if (errors.length) {
  console.error(['Mobile release audit failed:', ...errors.map((error) => `- ${error}`)].join('\n'))
  process.exit(1)
}
console.log('Mobile release audit passed: credentials, privacy, update channels and bundle identity are ready.')
