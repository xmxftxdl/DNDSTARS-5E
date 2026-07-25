import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ALLOWED_ADVISORY = 'https://github.com/advisories/GHSA-qwww-vcr4-c8h2'
const ALLOWED_PACKAGES = new Set(['react-router', 'react-router-dom'])
const FORBIDDEN_ROUTER_APIS = [
  'createBrowserRouter',
  'createCallServer',
  'createRequestHandler',
  'HydratedRouter',
  'RouterProvider',
  'RSCHydratedRouter',
  'RSCStaticRouter',
  'routeRSCServerRequest',
]

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(fullPath)
    return /\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name) && statSync(fullPath).isFile()
      ? [fullPath]
      : []
  })
}

function fail(message) {
  console.error(`生产依赖审计失败：${message}`)
  process.exit(1)
}

const packageJson = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
if (packageJson.dependencies?.['react-router-dom'] !== '7.18.1') {
  fail('React Router 安全例外只允许精确版本 react-router-dom@7.18.1。')
}

for (const file of sourceFiles(path.join(ROOT, 'src'))) {
  const source = readFileSync(file, 'utf8')
  if (/from\s+['"]react-router['"]/.test(source)) {
    fail(`${path.relative(ROOT, file)} 直接导入了 react-router。`)
  }
  const forbidden = FORBIDDEN_ROUTER_APIS.find((name) => new RegExp(`\\b${name}\\b`).test(source))
  if (forbidden) {
    fail(`${path.relative(ROOT, file)} 使用了 ${forbidden}；RSC／Data Router 安全例外不再成立。`)
  }
}

const npmCli = process.env.npm_execpath
const npmCommand = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm')
const npmArguments = [...(npmCli ? [npmCli] : []), 'audit', '--omit=dev', '--json']
const audit = spawnSync(npmCommand, npmArguments, {
  cwd: ROOT,
  encoding: 'utf8',
  windowsHide: true,
})
if (audit.error) fail(`无法执行 npm audit：${audit.error.message}`)

let report
try {
  report = JSON.parse(audit.stdout || '{}')
} catch {
  fail(`npm audit 没有返回有效 JSON：${audit.stderr || '未知错误'}`)
}

const vulnerabilities = Object.entries(report.vulnerabilities ?? {})
if (vulnerabilities.length === 0) {
  console.log('生产依赖审计通过：没有已知漏洞。')
  process.exit(0)
}

for (const [packageName, vulnerability] of vulnerabilities) {
  if (!ALLOWED_PACKAGES.has(packageName)) {
    fail(`${packageName} 存在未批准的 ${vulnerability.severity ?? '未知级别'} 漏洞。`)
  }
  const via = Array.isArray(vulnerability.via) ? vulnerability.via : []
  if (packageName === 'react-router') {
    const advisories = via.filter((entry) => entry && typeof entry === 'object')
    if (
      advisories.length !== 1 ||
      advisories[0].url !== ALLOWED_ADVISORY ||
      advisories[0].title !== 'React Router: RSC Mode CSRF Bypass Allows Action Execution Before 400 Response'
    ) {
      fail('react-router 的公告集合已经变化，需要重新审查。')
    }
  } else if (!via.every((entry) => entry === 'react-router')) {
    fail('react-router-dom 出现了不属于已批准 RSC 公告的漏洞链。')
  }
}

console.warn(
  '生产依赖审计通过（受控例外）：当前 React Router 公告只影响未启用的 RSC Mode；' +
  '源码守卫已确认项目仅使用浏览器 SPA 路由。任何版本、公告或路由 API 变化都会使门禁失败。',
)
