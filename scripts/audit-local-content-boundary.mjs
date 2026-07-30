import { execFileSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const localRoot = path.join(root, 'local-content')
const distArgumentIndex = process.argv.indexOf('--dist')
const distRoot = path.resolve(
  root,
  distArgumentIndex >= 0 ? process.argv[distArgumentIndex + 1] ?? 'dist' : 'dist',
)
const forbiddenExampleDirectories = [
  'battle-master-local-collection',
  'eldritch-knight-local-collection',
  'totem-warrior-local-collection',
]

function fail(message) {
  console.error(`本地内容部署边界审计失败：${message}`)
  process.exit(1)
}

function filesBelow(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? filesBelow(fullPath) : [fullPath]
  })
}

function requiresIgnore(fileName, pattern) {
  const filePath = path.join(root, fileName)
  if (!existsSync(filePath)) fail(`缺少 ${fileName}`)
  const lines = readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
  if (!lines.includes(pattern)) fail(`${fileName} 必须明确包含 ${pattern}`)
}

requiresIgnore('.gitignore', 'local-content/')
requiresIgnore('.dockerignore', 'local-content')

for (const directory of forbiddenExampleDirectories) {
  if (existsSync(path.join(root, 'examples', directory))) {
    fail(`已填写的本地合集仍位于 examples/${directory}`)
  }
}

try {
  const tracked = execFileSync(
    'git',
    ['ls-files', '--', 'local-content'],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  ).trim()
  if (tracked) fail(`local-content 中存在被 Git 跟踪的文件：${tracked.split(/\r?\n/)[0]}`)
} catch (error) {
  if (error?.status === 1) throw error
}

const deployableSourceFiles = filesBelow(path.join(root, 'src')).filter((file) =>
  /\.(?:ts|tsx|js|jsx|json)$/.test(file) &&
  !/\.test\.[^.]+$/.test(file) &&
  !file.includes(`${path.sep}testFixtures${path.sep}`),
)
for (const file of deployableSourceFiles) {
  const source = readFileSync(file, 'utf8')
  if (/local-content[\\/]/.test(source)) {
    fail(`${path.relative(root, file)} 引用了 local-content`)
  }
}

const privateManifestIds = new Set()
for (const file of filesBelow(localRoot).filter((entry) => entry.endsWith('.json'))) {
  let value
  try {
    value = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    continue
  }
  const manifestId = value?.manifest?.id
  if (typeof manifestId === 'string' && manifestId.length >= 8) {
    privateManifestIds.add(manifestId)
  }
}

if (!existsSync(distRoot) || !statSync(distRoot).isDirectory()) {
  fail(`找不到生产构建目录：${path.relative(root, distRoot)}`)
}
for (const file of filesBelow(distRoot)) {
  if (!/\.(?:html|js|css|json|map|txt)$/.test(file)) continue
  const content = readFileSync(file, 'utf8')
  for (const manifestId of privateManifestIds) {
    if (content.includes(manifestId)) {
      fail(`生产产物 ${path.relative(root, file)} 包含本地 manifest id：${manifestId}`)
    }
  }
}

console.log(
  `本地内容部署边界审计通过：local-content 未被跟踪、引用或打入 ${path.relative(root, distRoot)}。`,
)
