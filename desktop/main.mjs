import { readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  session,
  shell,
} from 'electron'
import updaterPackage from 'electron-updater'
import {
  compareVersions,
  installClientBundle,
  parseClientReleaseManifest,
  readActiveClientVersion,
} from './client-update.mjs'
import { createDesktopPluginPackageStore } from './plugin-package-store.mjs'

const { autoUpdater } = updaterPackage
const desktopDirectory = path.dirname(fileURLToPath(import.meta.url))
const releaseConfig = JSON.parse(readFileSync(path.join(desktopDirectory, 'release-config.json'), 'utf8'))
const appOrigin = 'app://astraltrace'
const appHost = 'astraltrace'
const smokeTest = process.env.ASTRALTRACE_DESKTOP_SMOKE_TEST === '1'

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
    codeCache: true,
  },
}])

let mainWindow = null
let launchInProgress = false
let activeClientRoot = null
let launcherState = {
  phase: 'starting',
  message: '正在连接星痕服务器…',
  detail: 'DM 与玩家通用 · 在线客户端',
  progress: 6,
  retriable: false,
}
let pluginStoreQueue = Promise.resolve()
let pluginPackageStore = null

function desktopPluginPackageStore() {
  pluginPackageStore ??= createDesktopPluginPackageStore(path.join(app.getPath('userData'), 'plugins'))
  return pluginPackageStore
}

function serializePluginStoreOperation(operation) {
  const task = pluginStoreQueue.catch(() => undefined).then(operation)
  pluginStoreQueue = task
  return task
}

function trustedDesktopIpc(event) {
  const senderUrl = event.senderFrame?.url ?? event.sender?.getURL?.() ?? ''
  return senderUrl.startsWith(`${appOrigin}/`)
}

function requireTrustedDesktopIpc(event) {
  if (!trustedDesktopIpc(event)) throw new Error('desktop-ipc-forbidden')
}

function serverOrigin() {
  const configured = String(process.env.ASTRALTRACE_SERVER_ORIGIN ?? releaseConfig.serverOrigin).trim()
  const parsed = new URL(configured)
  const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname)
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback && !app.isPackaged)) {
    throw new Error('desktop-server-origin-must-use-https')
  }
  return parsed.origin
}

function publishLauncherState(next) {
  launcherState = { ...launcherState, ...next }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:launcher-state', launcherState)
  }
}

function packagedClientRoot() {
  return path.join(app.getAppPath(), 'dist')
}

async function existingClientRoot() {
  const installed = await readActiveClientVersion(path.join(app.getPath('userData'), 'desktop-client'))
  return installed ?? {
    version: releaseConfig.clientVersion,
    root: packagedClientRoot(),
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12_000) {
  return net.fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
}

async function inspectOnlineServer() {
  const response = await fetchWithTimeout(`${serverOrigin()}/api/meta`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`server-unavailable-${response.status}`)
  const meta = await response.json()
  if (
    meta?.service !== 'dndstars-5e-shared' ||
    !Number.isInteger(meta.protocolVersion) ||
    !Number.isInteger(meta.minimumClientProtocol)
  ) throw new Error('server-meta-invalid')
  const clientProtocol = Number(releaseConfig.protocolVersion)
  if (meta.protocolVersion < clientProtocol || meta.minimumClientProtocol > clientProtocol) {
    throw new Error('client-protocol-incompatible')
  }
  return meta
}

async function fetchReleaseManifest() {
  const urls = [
    `${serverOrigin()}/api/desktop/releases/latest?platform=win32&arch=x64&channel=${encodeURIComponent(releaseConfig.channel)}`,
    releaseConfig.clientManifestUrl,
  ]
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!response.ok) continue
      const parsed = parseClientReleaseManifest(await response.json(), {
        channel: releaseConfig.channel,
        allowLoopbackHttp: !app.isPackaged,
      })
      if (parsed?.available) return parsed
    } catch {
      // The packaged fallback remains usable when no release has been published yet.
    }
  }
  return null
}

async function downloadClientPackage(manifest) {
  const response = await fetchWithTimeout(manifest.package.url, { cache: 'no-store' }, 120_000)
  if (!response.ok || !response.body) throw new Error(`client-download-failed-${response.status}`)
  const total = Number(response.headers.get('content-length')) || 0
  const reader = response.body.getReader()
  const chunks = []
  let received = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (!value) continue
    chunks.push(value)
    received += value.byteLength
    publishLauncherState({
      phase: 'downloading',
      message: `正在下载客户端 ${manifest.version}…`,
      detail: total > 0
        ? `${Math.round(received / 1024 / 1024)} MB / ${Math.round(total / 1024 / 1024)} MB`
        : `已下载 ${Math.round(received / 1024 / 1024)} MB`,
      progress: total > 0 ? 28 + Math.round((received / total) * 48) : 48,
    })
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
}

async function prepareClient() {
  publishLauncherState({
    phase: 'connecting',
    message: '正在连接星痕服务器…',
    detail: serverOrigin(),
    progress: 10,
    retriable: false,
  })
  const serverMeta = await inspectOnlineServer()
  publishLauncherState({
    phase: 'checking',
    message: '服务器已连接，正在检查客户端更新…',
    detail: `服务器版本 ${serverMeta.buildId}`,
    progress: 24,
  })

  const current = await existingClientRoot()
  const manifest = await fetchReleaseManifest()
  if (manifest) {
    if (compareVersions(releaseConfig.shellVersion, manifest.minimumShellVersion) < 0) {
      void checkForShellUpdate()
      throw new Error('desktop-shell-update-required')
    }
    if (manifest.protocolVersion !== Number(releaseConfig.protocolVersion)) {
      throw new Error('desktop-release-protocol-mismatch')
    }
    if (compareVersions(manifest.version, current.version) > 0) {
      const bytes = await downloadClientPackage(manifest)
      publishLauncherState({
        phase: 'installing',
        message: '正在校验并安装更新…',
        detail: `客户端 ${manifest.version}`,
        progress: 82,
      })
      const installed = await installClientBundle({
        archiveBytes: bytes,
        manifest,
        clientRoot: path.join(app.getPath('userData'), 'desktop-client'),
        releasePublicKeyPem: releaseConfig.releasePublicKeyPem,
      })
      return installed.root
    }
  }
  return current.root
}

function launchErrorMessage(error) {
  const code = error instanceof Error ? error.message : String(error)
  const messages = {
    'client-protocol-incompatible': '当前客户端与服务器版本不兼容，请更新桌面端。',
    'desktop-shell-update-required': '启动器版本过旧，正在检查完整客户端更新。',
    'desktop-release-protocol-mismatch': '最新客户端与当前服务器协议不匹配，请稍后重试。',
    'desktop-server-origin-must-use-https': '桌面端服务器地址必须使用 HTTPS。',
    'client-package-integrity-failed': '客户端更新包校验失败，已保留当前版本。',
    'client-package-signature-failed': '客户端更新包签名无效，已阻止安装。',
  }
  return messages[code] ?? '无法连接在线服务器或完成更新，请检查网络后重试。'
}

async function startGameClient() {
  if (launchInProgress) return
  launchInProgress = true
  try {
    activeClientRoot = await prepareClient()
    await stat(path.join(activeClientRoot, 'index.html'))
    publishLauncherState({
      phase: 'ready',
      message: '准备完成，正在进入星痕…',
      detail: '在线服务器已连接',
      progress: 100,
      retriable: false,
    })
    await mainWindow.loadURL(`${appOrigin}/app`)
    if (smokeTest) {
      const result = await mainWindow.webContents.executeJavaScript(`(async () => {
        const response = await fetch('/api/meta', { cache: 'no-store' })
        const meta = await response.json()
        const pluginBytes = new TextEncoder().encode('astral-trace-desktop-smoke-plugin')
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pluginBytes))
        let digestBinary = ''
        for (const byte of digest) digestBinary += String.fromCharCode(byte)
        const integrity = 'sha256-' + btoa(digestBinary)
        await window.astralTraceDesktop.pluginPackages.put({
          pluginId: 'astraltrace.smoke-test',
          version: '1.0.0',
          fileName: 'smoke-test.astralplugin',
          integrity,
          bytes: pluginBytes.buffer,
        })
        const storedPlugin = await window.astralTraceDesktop.pluginPackages.get('astraltrace.smoke-test', integrity)
        await window.astralTraceDesktop.pluginPackages.remove('astraltrace.smoke-test')
        return {
          pathname: window.location.pathname,
          rootMounted: Boolean(document.querySelector('#root')),
          serverService: meta.service,
          protocolVersion: meta.protocolVersion,
          pluginPackageRoundTrip: storedPlugin?.bytes?.byteLength === pluginBytes.byteLength,
        }
      })()`)
      console.log(`ASTRALTRACE_DESKTOP_SMOKE_OK ${JSON.stringify(result)}`)
      app.quit()
      return
    }
    void checkForShellUpdate()
  } catch (error) {
    console.error('[desktop launcher]', error)
    publishLauncherState({
      phase: 'error',
      message: launchErrorMessage(error),
      detail: '此客户端不支持离线或局域网房间',
      progress: 100,
      retriable: true,
    })
  } finally {
    launchInProgress = false
  }
}

async function proxyApiRequest(request, parsed) {
  const remote = new URL(`${parsed.pathname}${parsed.search}`, serverOrigin())
  const headers = new Headers(request.headers)
  for (const name of ['origin', 'referer', 'host', 'connection', 'content-length']) headers.delete(name)
  const method = request.method.toUpperCase()
  const body = ['GET', 'HEAD'].includes(method) ? undefined : Buffer.from(await request.arrayBuffer())
  return net.fetch(remote.href, {
    method,
    headers,
    body,
    redirect: 'follow',
  })
}

function contentTypeFor(filePath) {
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }
  return types[path.extname(filePath).toLowerCase()]
}

function desktopContentSecurityPolicy() {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "connect-src 'self' https: wss: http://127.0.0.1:* http://localhost:*",
  ].join('; ')
}

async function localFileResponse(filePath) {
  const response = await net.fetch(pathToFileURL(filePath).href)
  const headers = new Headers(response.headers)
  const contentType = contentTypeFor(filePath)
  if (contentType) headers.set('Content-Type', contentType)
  headers.set('Content-Security-Policy', desktopContentSecurityPolicy())
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'no-referrer')
  return new Response(response.body, { status: response.status, headers })
}

async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

async function handleAppProtocol(request) {
  const parsed = new URL(request.url)
  if (parsed.hostname !== appHost) return new Response('Not Found', { status: 404 })
  if (parsed.pathname === '/api' || parsed.pathname.startsWith('/api/')) {
    return proxyApiRequest(request, parsed)
  }

  let decodedPath
  try {
    decodedPath = decodeURIComponent(parsed.pathname)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }
  const launcherRequest = decodedPath === '/launcher' || decodedPath.startsWith('/launcher/')
  const relativePath = launcherRequest
    ? decodedPath.replace(/^\/launcher\/?/, '') || 'index.html'
    : decodedPath.replace(/^\/+/, '')
  if (relativePath.split('/').some((part) => part === '..')) return new Response('Forbidden', { status: 403 })

  const root = launcherRequest ? path.join(desktopDirectory, 'launcher') : activeClientRoot ?? packagedClientRoot()
  let filePath = path.join(root, ...relativePath.split('/'))
  if (!relativePath || !(await fileExists(filePath))) {
    if (!launcherRequest && decodedPath.startsWith('/assets/')) {
      return net.fetch(new URL(`${decodedPath}${parsed.search}`, serverOrigin()).href)
    }
    if (!launcherRequest && !path.extname(relativePath)) filePath = path.join(root, 'index.html')
  }
  if (!(await fileExists(filePath))) return new Response('Not Found', { status: 404 })
  return localFileResponse(filePath)
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    backgroundColor: '#06070f',
    title: '星痕 · Astral Trace',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(desktopDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })
  if (!smokeTest) mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url)
    if (target.protocol === 'app:' && target.hostname === appHost) return
    event.preventDefault()
    if (target.protocol === 'https:') void shell.openExternal(target.href)
  })
  mainWindow.on('closed', () => { mainWindow = null })
  void mainWindow.loadURL(`${appOrigin}/launcher/index.html`)
  mainWindow.webContents.once('did-finish-load', () => void startGameClient())
}

async function checkForShellUpdate() {
  if (!app.isPackaged) return
  try {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    await autoUpdater.checkForUpdates()
  } catch (error) {
    console.warn('[desktop shell update]', error)
  }
}

autoUpdater.on('update-downloaded', async () => {
  const response = await dialog.showMessageBox({
    type: 'info',
    title: '星痕更新已就绪',
    message: '启动器更新已下载，是否现在重启并安装？',
    buttons: ['现在重启', '退出时安装'],
    defaultId: 0,
    cancelId: 1,
  })
  if (response.response === 0) autoUpdater.quitAndInstall(false, true)
})

ipcMain.handle('desktop:get-launcher-state', () => launcherState)
ipcMain.handle('desktop:get-runtime-info', () => ({
  shellVersion: releaseConfig.shellVersion,
  clientVersion: releaseConfig.clientVersion,
  channel: releaseConfig.channel,
  platform: process.platform,
  arch: process.arch,
  packaged: app.isPackaged,
}))
ipcMain.handle('desktop:plugin-package:put', (event, input) => {
  requireTrustedDesktopIpc(event)
  return serializePluginStoreOperation(() => desktopPluginPackageStore().put({
    pluginId: input?.pluginId,
    version: input?.version,
    fileName: input?.fileName,
    integrity: input?.integrity,
    bytes: input?.bytes,
  }))
})
ipcMain.handle('desktop:plugin-package:get', (event, pluginId, integrity) => {
  requireTrustedDesktopIpc(event)
  return serializePluginStoreOperation(() => desktopPluginPackageStore().get(pluginId, integrity))
})
ipcMain.handle('desktop:plugin-package:remove', (event, pluginId) => {
  requireTrustedDesktopIpc(event)
  return serializePluginStoreOperation(() => desktopPluginPackageStore().remove(pluginId))
})
ipcMain.handle('desktop:plugin-package:list', (event) => {
  requireTrustedDesktopIpc(event)
  return serializePluginStoreOperation(() => desktopPluginPackageStore().list())
})
ipcMain.handle('desktop:retry-launch', async () => {
  if (launchInProgress) return launcherState
  publishLauncherState({ phase: 'retrying', message: '正在重新连接…', retriable: false, progress: 8 })
  await startGameClient()
  return launcherState
})

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    protocol.handle('app', handleAppProtocol)
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const pageUrl = webContents.getURL()
      const trustedPage = pageUrl.startsWith(`${appOrigin}/`)
      callback(trustedPage && ['media', 'notifications'].includes(permission))
    })
    createMainWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
