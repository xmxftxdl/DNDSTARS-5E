import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Download,
  FileUp,
  Flag,
  Globe2,
  LockKeyhole,
  PackageCheck,
  Puzzle,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Wrench,
} from 'lucide-react'
import AccountAuthPanel from '../components/AccountAuthPanel'
import PageHeader from '../components/PageHeader'
import Dnd5eCustomPluginBuilder from '../components/rules/Dnd5eCustomPluginBuilder'
import {
  accountApiErrorMessage,
  AccountApiError,
  deleteAccountPluginVersion,
  downloadAccountPlugin,
  loadAccountProfile,
  loadAccountPlugins,
  uploadAccountPlugin,
  type AccountPluginLibrary,
  type AccountPluginVersion,
} from '../lib/accountApi'
import {
  getAccountSession,
  subscribeAccountSession,
} from '../lib/accountSession'
import { activateRoomPluginPackage } from '../lib/roomPluginActivation'
import { getRoomSession } from '../lib/roomSession'
import {
  getRoomRulesSnapshot,
  setRoomRulesSnapshot,
  subscribeRoomRules,
} from '../lib/roomRulesState'
import { dnd5ePluginCompatibilityReport } from '../rulesets/dnd5e/pluginCompatibility'
import {
  downloadPublicPlugin,
  loadPluginCatalog,
  loadPluginModerationQueue,
  moderatePluginVersion,
  publishAccountPluginVersion,
  reportPublicPlugin,
  type PluginCatalogEntry,
  type PluginCatalogVersion,
  type PluginModerationQueue,
} from '../lib/pluginCatalogApi'

const EMPTY_LIBRARY: AccountPluginLibrary = {
  plugins: [],
  limits: {
    maxVersions: 100,
    maxTotalBytes: 128 * 1024 * 1024,
    maxPackageBytes: 8 * 1024 * 1024,
  },
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

function formatDate(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function downloadBytes(bytes: ArrayBuffer, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function PluginCatalogBrowser({
  accountId,
  busy,
  onBusy,
  onError,
  onNotice,
  onSaved,
}: {
  accountId?: string
  busy: boolean
  onBusy: (key: string | null) => void
  onError: (message: string | null) => void
  onNotice: (message: string | null) => void
  onSaved: () => Promise<void>
}) {
  const [plugins, setPlugins] = useState<PluginCatalogEntry[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)

  const search = async () => {
    setLoading(true)
    try {
      setPlugins(await loadPluginCatalog({ query, category }))
      onError(null)
    } catch (cause) {
      onError(accountApiErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void search()
    // Initial public catalog load; later searches are explicitly submitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const downloadVersion = async (plugin: PluginCatalogEntry, version: PluginCatalogVersion) => {
    const key = `catalog:${plugin.id}@${version.version}`
    onBusy(key)
    onError(null)
    onNotice(null)
    try {
      const downloaded = await downloadPublicPlugin(plugin.id, version)
      if (accountId) {
        await uploadAccountPlugin({
          manifest: {
            id: plugin.id,
            name: plugin.name,
            version: version.version,
            apiVersion: 2,
            rulesetId: 'dnd5e-2014-srd-5.1',
            stateSchemaVersion: version.stateSchemaVersion,
            manifestSchemaVersion: version.manifestSchemaVersion,
            minimumGameProtocolVersion: version.minimumGameProtocolVersion,
            dependencies: version.dependencies,
            conflicts: version.conflicts,
            declaredCapabilities: version.declaredCapabilities,
            distributionPolicy: version.distributionPolicy,
            contentCategory: version.contentCategory,
            publisher: plugin.publisher.displayName,
            license: version.license,
            description: plugin.description,
          },
          integrity: version.integrity,
          fileName: downloaded.fileName,
          bytes: downloaded.bytes,
        })
        await onSaved()
        onNotice(`已将 ${plugin.name} v${version.version} 保存到账号插件库。`)
      } else {
        downloadBytes(downloaded.bytes, downloaded.fileName)
        onNotice(`已下载 ${plugin.name} v${version.version}；登录后可跨设备保存。`)
      }
    } catch (cause) {
      onError(accountApiErrorMessage(cause))
    } finally {
      onBusy(null)
    }
  }

  const report = async (plugin: PluginCatalogEntry, version: PluginCatalogVersion) => {
    if (!accountId) return onError('请登录后举报插件。')
    const details = window.prompt('请说明举报原因（安全、版权、误导或其他问题）：')?.trim()
    if (!details) return
    onBusy(`report:${plugin.id}`)
    try {
      await reportPublicPlugin({ pluginId: plugin.id, version: version.version, category: 'other', details })
      onNotice('举报已提交，审核人员可以在管理队列中查看。')
      onError(null)
    } catch (cause) {
      onError(accountApiErrorMessage(cause))
    } finally {
      onBusy(null)
    }
  }

  return (
    <section>
      <form
        className="mb-5 grid gap-2 rounded-2xl border border-white/8 bg-black/15 p-3 sm:grid-cols-[1fr_180px_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          void search()
        }}
      >
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-600" />
          <input
            aria-label="搜索插件"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、ID、发布者或标签"
            className="w-full rounded-xl border border-white/10 bg-void-900/80 py-2.5 pl-9 pr-3 text-sm text-slate-100"
          />
        </label>
        <select
          aria-label="插件分类"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-200"
        >
          <option value="">全部分类</option>
          <option value="rules">规则</option>
          <option value="subclasses">子职</option>
          <option value="spells">法术</option>
          <option value="items">物品</option>
          <option value="monsters">怪物</option>
          <option value="adventure">冒险</option>
          <option value="mixed">混合内容</option>
        </select>
        <button type="submit" disabled={loading} className="rounded-xl bg-arcane-500/15 px-4 py-2.5 text-sm font-semibold text-arcane-100">
          {loading ? '正在搜索…' : '搜索'}
        </button>
      </form>
      {loading ? (
        <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-400">
          <RefreshCw className="h-4 w-4 animate-spin" />正在读取公开目录…
        </div>
      ) : plugins.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center text-sm text-slate-500">
          暂时没有符合条件的已审核插件。
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {plugins.map((plugin) => {
            const latest = plugin.versions[0]
            if (!latest) return null
            return (
              <article key={plugin.id} className="rounded-2xl border border-white/8 bg-black/15 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-100">{plugin.name}</h2>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
                        v{latest.version}
                      </span>
                      <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200">
                        {plugin.contentCategory}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-600">{plugin.id}</p>
                  </div>
                  <Globe2 className="h-5 w-5 shrink-0 text-emerald-300" />
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{plugin.description || '发布者未填写说明。'}</p>
                <p className="mt-3 text-xs text-slate-500">
                  发布者：
                  <Link
                    to={`/app/extensions/publishers/${encodeURIComponent(plugin.publisher.accountId)}`}
                    className="text-arcane-300 hover:text-arcane-200"
                  >
                    {plugin.publisher.displayName}
                  </Link>
                  {' '}· 许可证：{latest.license}
                </p>
                {latest.changelog && <p className="mt-2 text-xs text-slate-600">更新：{latest.changelog}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void downloadVersion(plugin, latest)}
                    className="inline-flex items-center gap-2 rounded-xl bg-arcane-500/15 px-3 py-2 text-sm font-semibold text-arcane-100 disabled:opacity-50"
                  >
                    {accountId ? <Cloud className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                    {accountId ? '保存到我的插件' : '下载'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void report(plugin, latest)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/8 px-3 py-2 text-xs text-slate-500 disabled:opacity-50"
                  >
                    <Flag className="h-3.5 w-3.5" />举报
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function PluginModerationPanel({
  onError,
  onNotice,
}: {
  onError: (message: string | null) => void
  onNotice: (message: string | null) => void
}) {
  const [queue, setQueue] = useState<PluginModerationQueue>({ pending: [], reports: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      setQueue(await loadPluginModerationQueue())
      onError(null)
    } catch (cause) {
      onError(accountApiErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const decide = async (
    pluginId: string,
    version: string,
    action: 'approve' | 'reject' | 'suspend',
  ) => {
    const note = action === 'approve' ? '' : window.prompt('填写审核说明：')?.trim()
    if (action !== 'approve' && !note) return
    setBusy(`${pluginId}@${version}`)
    try {
      await moderatePluginVersion({ pluginId, version, action, note })
      onNotice(action === 'approve' ? '插件版本已通过审核。' : '审核决定已保存。')
      await refresh()
    } catch (cause) {
      onError(accountApiErrorMessage(cause))
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">正在读取审核队列…</div>
  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-3 font-semibold text-slate-100">待审核版本（{queue.pending.length}）</h2>
        <div className="space-y-3">
          {queue.pending.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-600">当前没有待审核版本。</p>}
          {queue.pending.map(({ plugin, version }) => (
            <article key={`${plugin.id}@${version.version}`} className="rounded-2xl border border-white/8 bg-black/15 p-4">
              <h3 className="font-semibold text-slate-100">{plugin.name} v{version.version}</h3>
              <p className="mt-1 text-xs text-slate-500">{plugin.id} · {plugin.publisher.displayName} · {version.license}</p>
              <p className="mt-3 text-sm text-slate-400">{version.changelog || '未填写更新说明。'}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" disabled={busy != null} onClick={() => void decide(plugin.id, version.version, 'approve')} className="rounded-xl bg-emerald-500/12 px-3 py-2 text-xs font-semibold text-emerald-100">通过</button>
                <button type="button" disabled={busy != null} onClick={() => void decide(plugin.id, version.version, 'reject')} className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200">拒绝</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-semibold text-slate-100">举报（{queue.reports.length}）</h2>
        <div className="space-y-2">
          {queue.reports.slice(0, 50).map((report) => (
            <article key={report.id} className="rounded-xl border border-white/8 bg-black/10 p-3 text-sm">
              <p className="font-mono text-xs text-slate-500">{report.pluginId}@{report.version} · {report.category}</p>
              <p className="mt-2 text-slate-300">{report.details}</p>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => void decide(report.pluginId, report.version, 'suspend')}
                className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-50"
              >
                暂停该版本
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function PluginsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const account = useSyncExternalStore(
    subscribeAccountSession,
    getAccountSession,
    getAccountSession,
  )
  const roomRules = useSyncExternalStore(
    subscribeRoomRules,
    getRoomRulesSnapshot,
    getRoomRulesSnapshot,
  )
  const [roomSession] = useState(() => getRoomSession())
  const [section, setSection] = useState<'library' | 'catalog' | 'create' | 'moderation'>('library')
  const [pluginAdmin, setPluginAdmin] = useState(false)
  const [library, setLibrary] = useState<AccountPluginLibrary>(EMPTY_LIBRARY)
  const [loading, setLoading] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const host = window.DNDSTARS_5E_RULES_PLUGINS

  const refresh = async () => {
    if (!account) {
      setLibrary(EMPTY_LIBRARY)
      return
    }
    setLoading(true)
    try {
      setLibrary(await loadAccountPlugins())
      setError(null)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Loading is intentionally keyed by an external account-session store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    // Account identity is the complete cache key for this cloud library.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.accountId])

  useEffect(() => {
    if (!account) return
    void loadAccountProfile().then((profile) => setPluginAdmin(profile.pluginAdmin === true)).catch(() => {
      setPluginAdmin(false)
    })
  }, [account])

  const saveFileToLibrary = async (file: File) => {
    if (!account) return setError('请先登录账号')
    if (!host) return setError('插件沙箱尚未初始化')
    setBusyKey('upload')
    setNotice(null)
    setError(null)
    try {
      const inspected = await host.inspectFile(file)
      const saved = await uploadAccountPlugin(inspected)
      await refresh()
      setNotice(`已将 ${saved.name} v${saved.version} 保存到账号插件库。`)
    } catch (cause) {
      setError(cause instanceof AccountApiError
        ? accountApiErrorMessage(cause)
        : cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusyKey(null)
    }
  }

  const saveLocalVersionToLibrary = async (pluginId: string) => {
    if (!host) return setError('插件沙箱尚未初始化')
    const installed = host.listInstalled().find((candidate) => candidate.id === pluginId)
    const manifest = host.listActive().find((candidate) => candidate.id === pluginId)
    if (!installed || !manifest) return setError('本机插件尚未通过沙箱激活，不能保存到云端。')
    setBusyKey(`${pluginId}:cloud`)
    setNotice(null)
    setError(null)
    try {
      const bytes = await host.readBytes(pluginId)
      const saved = await uploadAccountPlugin({
        manifest,
        integrity: installed.integrity,
        fileName: installed.source === 'file' ? installed.fileName : `${pluginId}.dndstars5e`,
        bytes,
      })
      await refresh()
      setNotice(`已将本机的 ${saved.name} v${saved.version} 保存到账号插件库。`)
    } catch (cause) {
      setError(cause instanceof AccountApiError
        ? accountApiErrorMessage(cause)
        : cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusyKey(null)
    }
  }

  const enableInRoom = async (plugin: AccountPluginVersion) => {
    if (!host) return setError('插件沙箱尚未初始化')
    if (!roomSession || roomSession.role !== 'dm') {
      return setError('请先以 DM 身份创建或进入房间，再启用账号插件。')
    }
    const key = `${plugin.id}@${plugin.version}:enable`
    setBusyKey(key)
    setNotice(null)
    setError(null)
    try {
      const downloaded = await downloadAccountPlugin(plugin)
      await host.installBytes({
        id: plugin.id,
        version: plugin.version,
        integrity: plugin.integrity,
        fileName: downloaded.fileName,
        bytes: downloaded.bytes,
      })
      const manifest = host.listActive().find((candidate) =>
        candidate.id === plugin.id && candidate.version === plugin.version)
      if (!manifest) throw new Error('插件已下载，但沙箱没有激活对应清单')
      const next = await activateRoomPluginPackage({
        session: roomSession,
        host,
        package: {
          bytes: downloaded.bytes,
          fileName: downloaded.fileName,
          integrity: plugin.integrity,
          manifest,
        },
      })
      setRoomRulesSnapshot(next)
      setNotice(`已将 ${plugin.name} v${plugin.version} 原子激活到房间；玩家端会自动下载。`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusyKey(null)
    }
  }

  const exportPlugin = async (plugin: AccountPluginVersion) => {
    const key = `${plugin.id}@${plugin.version}:download`
    setBusyKey(key)
    setNotice(null)
    setError(null)
    try {
      const downloaded = await downloadAccountPlugin(plugin)
      downloadBytes(downloaded.bytes, downloaded.fileName)
      setNotice(`已下载 ${plugin.name} v${plugin.version}。`)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setBusyKey(null)
    }
  }

  const removeVersion = async (plugin: AccountPluginVersion) => {
    const activeInRoom = roomRules?.requiredPlugins.some((candidate) =>
      candidate.id === plugin.id &&
      candidate.version === plugin.version &&
      candidate.integrity === plugin.integrity)
    const warning = activeInRoom
      ? '这个版本当前已在房间启用。删除账号库引用不会停止房间运行，但之后需要重新上传才能再次安装。仍要删除吗？'
      : `从账号插件库删除 ${plugin.name} v${plugin.version}？`
    if (!window.confirm(warning)) return
    const key = `${plugin.id}@${plugin.version}:delete`
    setBusyKey(key)
    setNotice(null)
    setError(null)
    try {
      await deleteAccountPluginVersion(plugin)
      await refresh()
      setNotice(`已从账号插件库移除 ${plugin.name} v${plugin.version}。`)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setBusyKey(null)
    }
  }

  const publishVersion = async (plugin: AccountPluginVersion) => {
    const changelog = window.prompt('填写本版本更新说明（可留空）：') ?? ''
    const tags = (window.prompt('填写搜索标签，用逗号分隔（可留空）：') ?? '')
      .split(',').map((tag) => tag.trim()).filter(Boolean)
    const key = `${plugin.id}@${plugin.version}:publish`
    setBusyKey(key)
    setNotice(null)
    setError(null)
    try {
      const result = await publishAccountPluginVersion(plugin, {
        visibility: 'public',
        changelog,
        tags,
      })
      setNotice(result.status === 'pending'
        ? `${plugin.name} v${plugin.version} 已提交审核；通过前不会出现在公开搜索中。`
        : `${plugin.name} v${plugin.version} 已发布到公开目录。`)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setBusyKey(null)
    }
  }

  const usedBytes = library.plugins.reduce((total, plugin) => total + plugin.sizeBytes, 0)
  const activePins = new Map((roomRules?.requiredPlugins ?? []).map((plugin) => [plugin.id, plugin]))
  const roomPluginMetadata = (roomRules?.requiredPlugins ?? []).map((pin) =>
    library.plugins.find((candidate) =>
      candidate.id === pin.id &&
      candidate.version === pin.version &&
      candidate.integrity === pin.integrity) ?? { id: pin.id, version: pin.version })
  const localPending = (host?.listInstalled() ?? []).flatMap((installed) => {
    const manifest = host?.listActive().find((candidate) => candidate.id === installed.id)
    if (!manifest || library.plugins.some((candidate) =>
      candidate.id === manifest.id &&
      candidate.version === manifest.version &&
      candidate.integrity === installed.integrity)) return []
    return [{ installed, manifest }]
  })

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="插件中心"
        description="在账号中保存规则包，再由 DM 将精确版本安全启用到房间。"
        actions={account ? (
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".dndstars5e,.mjs,.js,text/javascript,application/javascript"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file) void saveFileToLibrary(file)
                event.currentTarget.value = ''
              }}
            />
            <button
              type="button"
              disabled={busyKey != null || !host}
              onClick={() => fileRef.current?.click()}
              className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {busyKey === 'upload' ? '正在检查并上传…' : '上传插件'}
            </button>
          </div>
        ) : undefined}
      />

      {!roomSession && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-black/15 px-4 py-3 text-sm">
          <span className="text-slate-400">插件与账号绑定，不依赖某个房间。进入冒险后，DM 可把这里保存的精确版本启用到房间。</span>
        </div>
      )}

      {!account && notice && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}
        </div>
      )}
      {!account && error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {account && (
        <AccountAuthPanel
          account={account}
          onLoggedOut={() => {
            setLibrary(EMPTY_LIBRARY)
            setPluginAdmin(false)
            setNotice('已退出账号。')
            setError(null)
          }}
          onError={setError}
        />
      )}

      {!account ? (
        <div className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <section className="rounded-2xl border border-arcane-400/15 bg-arcane-500/[0.04] p-6">
              <Cloud className="h-9 w-9 text-arcane-300" />
              <h2 className="mt-4 text-xl font-bold text-slate-100">登录后使用云端插件库</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                插件将与账号绑定，不再依赖某个浏览器或某个房间。每个版本按 SHA-256 不可变保存，
                房间只锁定经过校验的精确版本。
              </p>
              <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                <div className="rounded-xl border border-white/8 bg-black/15 p-3"><LockKeyhole className="mb-2 h-4 w-4 text-emerald-300" />默认私有，不进入公共索引</div>
                <div className="rounded-xl border border-white/8 bg-black/15 p-3"><ShieldCheck className="mb-2 h-4 w-4 text-cyan-300" />下载后仍由 Worker 沙箱复核</div>
              </div>
            </section>
            <AccountAuthPanel
              account={account}
              onAuthenticated={() => void refresh()}
              onError={setError}
            />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">浏览公开插件</h2>
          <PluginCatalogBrowser
            busy={busyKey != null}
            onBusy={setBusyKey}
            onError={setError}
            onNotice={setNotice}
            onSaved={refresh}
          />
        </div>
      ) : (
        <>
          <nav className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-white/8 bg-black/15 p-2">
            {[
              { id: 'library' as const, label: '我的插件', icon: Puzzle },
              { id: 'catalog' as const, label: '公开目录', icon: Globe2 },
              { id: 'create' as const, label: '创建插件', icon: Wrench },
              ...(pluginAdmin ? [{ id: 'moderation' as const, label: '审核管理', icon: ShieldCheck }] : []),
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  section === id
                    ? 'bg-arcane-500/15 text-arcane-200 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          {notice && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </div>
          )}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {section === 'moderation' ? (
            <PluginModerationPanel onError={setError} onNotice={setNotice} />
          ) : section === 'catalog' ? (
            <PluginCatalogBrowser
              accountId={account.accountId}
              busy={busyKey != null}
              onBusy={setBusyKey}
              onError={setError}
              onNotice={setNotice}
              onSaved={refresh}
            />
          ) : section === 'create' ? (
            <Dnd5eCustomPluginBuilder
              defaultPublisher={account.username ?? account.displayName}
              busy={busyKey != null}
              onInstall={saveFileToLibrary}
              installLabel="保存到我的插件库"
            />
          ) : (
            <>
              <section className="mb-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <p className="text-xs text-slate-500">账号插件版本</p>
                  <p className="mt-2 text-2xl font-bold text-slate-100">{library.plugins.length}<span className="ml-1 text-sm font-normal text-slate-500">/ {library.limits.maxVersions}</span></p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <p className="text-xs text-slate-500">云端使用量</p>
                  <p className="mt-2 text-2xl font-bold text-slate-100">{formatBytes(usedBytes)}<span className="ml-1 text-sm font-normal text-slate-500">/ {formatBytes(library.limits.maxTotalBytes)}</span></p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <p className="text-xs text-slate-500">当前房间</p>
                  <p className="mt-2 truncate text-base font-bold text-slate-100">{roomSession?.roomName ?? '尚未进入房间'}</p>
                  <p className="mt-1 text-xs text-slate-500">{roomSession?.role === 'dm' ? '可管理房间启用版本' : roomSession ? '仅 DM 可以启用插件' : '账号插件可跨房间使用'}</p>
                </div>
              </section>

              {localPending.length > 0 && (
                <section className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.04] p-4">
                  <div className="flex items-start gap-3">
                    <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-cyan-100">发现本机尚未同步的插件</h2>
                      <p className="mt-1 text-xs leading-5 text-cyan-100/60">
                        旧版浏览器安装仍然有效；保存到账号后才能换设备使用。
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {localPending.map(({ installed, manifest }) => (
                          <button
                            key={`${manifest.id}@${manifest.version}`}
                            type="button"
                            disabled={busyKey != null}
                            onClick={() => void saveLocalVersionToLibrary(manifest.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/8 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50"
                          >
                            <Cloud className="h-3.5 w-3.5" />
                            {busyKey === `${manifest.id}:cloud`
                              ? '正在保存…'
                              : `${manifest.name} v${manifest.version}`}
                            <span className="sr-only">{installed.integrity}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {loading ? (
                <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-400">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  正在读取账号插件库…
                </div>
              ) : library.plugins.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 px-6 text-center">
                  <FileUp className="h-10 w-10 text-slate-600" />
                  <h2 className="mt-4 text-lg font-semibold text-slate-200">账号插件库为空</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    上传你有权使用的 `.dndstars5e` 文件，或者切换到“创建插件”使用声明式规则编辑器。
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {library.plugins.map((plugin) => {
                    const key = `${plugin.id}@${plugin.version}`
                    const roomPin = activePins.get(plugin.id)
                    const activeExact = roomPin?.version === plugin.version && roomPin.integrity === plugin.integrity
                    const activeOther = !!roomPin && !activeExact
                    const previous = activeOther
                      ? roomPluginMetadata.find((candidate) => candidate.id === plugin.id)
                      : undefined
                    const compatibility = dnd5ePluginCompatibilityReport({
                      candidate: plugin,
                      installed: roomPluginMetadata.filter((candidate) => candidate.id !== plugin.id),
                      previous,
                    })
                    return (
                      <article key={key} className="rounded-2xl border border-white/8 bg-black/15 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-semibold text-slate-100">{plugin.name}</h2>
                              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">v{plugin.version}</span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
                                <LockKeyhole className="h-3 w-3" /> 私有
                              </span>
                              {activeExact && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-arcane-500/15 px-2 py-0.5 text-[11px] font-semibold text-arcane-200">
                                  <PackageCheck className="h-3 w-3" /> 当前房间已启用
                                </span>
                              )}
                              {activeOther && (
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">房间使用其他版本</span>
                              )}
                            </div>
                            <p className="mt-1 break-all font-mono text-xs text-slate-500">{plugin.id}</p>
                            {plugin.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{plugin.description}</p>}
                            <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
                              <div><dt className="inline text-slate-600">发布者：</dt><dd className="inline">{plugin.publisher}</dd></div>
                              <div><dt className="inline text-slate-600">许可证：</dt><dd className="inline">{plugin.license}</dd></div>
                              <div><dt className="inline text-slate-600">状态版本：</dt><dd className="inline">v{plugin.stateSchemaVersion}</dd></div>
                              <div><dt className="inline text-slate-600">最低协议：</dt><dd className="inline">v{plugin.minimumGameProtocolVersion}</dd></div>
                              <div><dt className="inline text-slate-600">内容分类：</dt><dd className="inline">{plugin.contentCategory}</dd></div>
                              <div><dt className="inline text-slate-600">分发策略：</dt><dd className="inline">{plugin.distributionPolicy}</dd></div>
                              <div><dt className="inline text-slate-600">大小：</dt><dd className="inline">{formatBytes(plugin.sizeBytes)}</dd></div>
                              <div><dt className="inline text-slate-600">保存时间：</dt><dd className="inline">{formatDate(plugin.createdAt)}</dd></div>
                              <div><dt className="inline text-slate-600">规则集：</dt><dd className="inline">D&D 5e 2014 / SRD 5.1</dd></div>
                              <div className="sm:col-span-2"><dt className="inline text-slate-600">SHA-256：</dt><dd className="break-all font-mono text-[10px]">{plugin.integrity}</dd></div>
                            </dl>
                            {(plugin.dependencies.length > 0 || plugin.conflicts.length > 0 || plugin.declaredCapabilities.length > 0) && (
                              <div className="mt-3 space-y-1 text-xs text-slate-500">
                                {plugin.dependencies.length > 0 && (
                                  <p>依赖：{plugin.dependencies.map((dependency) =>
                                    `${dependency.id} ${dependency.versionRange}${dependency.optional ? '（可选）' : ''}`).join('、')}</p>
                                )}
                                {plugin.conflicts.length > 0 && <p>冲突：{plugin.conflicts.join('、')}</p>}
                                {plugin.declaredCapabilities.length > 0 && (
                                  <p>Headless capability：{plugin.declaredCapabilities.join('、')}</p>
                                )}
                              </div>
                            )}
                            {(compatibility.errors.length > 0 || compatibility.warnings.length > 0) && (
                              <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                                compatibility.compatible
                                  ? 'border-amber-400/15 bg-amber-500/5 text-amber-100'
                                  : 'border-rose-400/20 bg-rose-500/5 text-rose-100'
                              }`}>
                                {[...compatibility.errors, ...compatibility.warnings].map((issue) => (
                                  <p key={`${issue.code}:${issue.pluginId ?? issue.message}`}>• {issue.message}</p>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            {roomSession?.role === 'dm' && (
                              <button
                                type="button"
                                disabled={busyKey != null || activeExact || !compatibility.compatible}
                                onClick={() => void enableInRoom(plugin)}
                                className="inline-flex items-center gap-2 rounded-xl bg-arcane-500/15 px-3 py-2 text-sm font-semibold text-arcane-100 disabled:opacity-45"
                              >
                                <Users className="h-4 w-4" />
                                {busyKey === `${key}:enable`
                                  ? '正在激活…'
                                  : activeExact
                                    ? '房间已启用'
                                    : activeOther
                                      ? '回滚/切换到此版本'
                                      : '启用到房间'}
                              </button>
                            )}
                            {plugin.distributionPolicy === 'room-distributable' && (
                              <button
                                type="button"
                                disabled={busyKey != null}
                                onClick={() => void publishVersion(plugin)}
                                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-200 disabled:opacity-50"
                              >
                                <Globe2 className="h-4 w-4" />
                                {busyKey === `${key}:publish` ? '正在提交…' : '发布到目录'}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busyKey != null}
                              onClick={() => void exportPlugin(plugin)}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 disabled:opacity-50"
                            >
                              <Download className="h-4 w-4" />
                              下载
                            </button>
                            <button
                              type="button"
                              disabled={busyKey != null}
                              onClick={() => void removeVersion(plugin)}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/15 bg-rose-500/5 px-3 py-2 text-sm text-rose-200 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              删除
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
