import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AlertTriangle, CheckCircle2, Download, Plug, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Dnd5eCustomPluginBuilder from '../components/rules/Dnd5eCustomPluginBuilder'
import {
  activeDnd5eRulesPluginRequirements,
  type InstalledDnd5eRulesPlugin,
  type Dnd5eRulesPluginManifest,
} from '../rulesets/dnd5e'
import {
  activateStagedRoomPlugin,
  deleteRoomPlugin,
  heartbeatRoom,
  loadRoomPluginMigrationState,
  loadRoomRules,
  roomApiErrorMessage,
  stageRoomPlugin,
} from '../lib/roomApi'
import { getRoomSession } from '../lib/roomSession'
import { synchronizeRoomPlugins } from '../lib/roomPluginSync'
import {
  getRoomRulesSnapshot,
  getRoomPluginSyncError,
  setRoomRulesSnapshot,
  subscribeRoomRules,
} from '../lib/roomRulesState'

export default function RulesPluginsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [roomSession] = useState(() => getRoomSession())
  const roomRules = useSyncExternalStore(
    subscribeRoomRules,
    getRoomRulesSnapshot,
    getRoomRulesSnapshot,
  )
  const roomPluginSyncError = useSyncExternalStore(
    subscribeRoomRules,
    getRoomPluginSyncError,
    getRoomPluginSyncError,
  )
  const host = window.DNDSTARS_5E_RULES_PLUGINS
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const installed = host?.listInstalled() ?? []
  const activeById = new Map((host?.listActive() ?? []).map((plugin) => [plugin.id, plugin]))
  const activeRequirements = activeDnd5eRulesPluginRequirements()

  const refresh = () => setRevision((value) => value + 1)
  void revision

  const reportLocalRules = async () => {
    if (!roomSession) return
    let next = await heartbeatRoom(roomSession, activeDnd5eRulesPluginRequirements())
    if (!next.member.ready) next = (await synchronizeRoomPlugins(roomSession, next)).rules
    setRoomRulesSnapshot(next)
  }

  const activateRoomPlugin = async (input: {
    bytes: ArrayBuffer
    fileName: string
    integrity: string
    manifest: Dnd5eRulesPluginManifest
  }) => {
    if (!roomSession || roomSession.role !== 'dm' || !host) {
      throw new Error('只有 DM 可以发布房间规则包')
    }
    const stateSchemaVersion = input.manifest.stateSchemaVersion ?? 1
    await stageRoomPlugin({
      session: roomSession,
      id: input.manifest.id,
      version: input.manifest.version,
      stateSchemaVersion,
      integrity: input.integrity,
      name: input.manifest.name,
      publisher: input.manifest.publisher,
      license: input.manifest.license,
      fileName: input.fileName,
      bytes: input.bytes,
    })
    const previous = await loadRoomPluginMigrationState(roomSession, input.manifest.id)
    let data = previous.data
    if (previous.hasState && stateSchemaVersion !== previous.stateSchemaVersion) {
      const migrated = await host.migrateState({
        bytes: input.bytes,
        fromVersion: previous.stateSchemaVersion,
        state: previous.data,
      })
      if (migrated.toVersion !== stateSchemaVersion) throw new Error('规则包状态迁移没有到达目标版本')
      data = migrated.state
    }
    return activateStagedRoomPlugin({
      session: roomSession,
      pluginId: input.manifest.id,
      expectedRulesRevision: previous.rulesRevision,
      expectedActive: previous.active,
      stagedVersion: input.manifest.version,
      stagedIntegrity: input.integrity,
      stateSchemaVersion,
      data,
    })
  }

  useEffect(() => {
    if (!roomSession) return
    let disposed = false
    void loadRoomRules(roomSession)
      .then((next) => {
        if (!disposed) setRoomRulesSnapshot(next)
      })
      .catch(() => {})
    return () => { disposed = true }
  }, [roomSession])

  const installFile = async (file: File) => {
    if (!host) return
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      if (roomSession?.role === 'dm') {
        const inspected = await host.inspectFile(file)
        const next = await activateRoomPlugin(inspected)
        await host.installBytes({
          id: inspected.manifest.id,
          version: inspected.manifest.version,
          fileName: inspected.fileName,
          integrity: inspected.integrity,
          bytes: inspected.bytes,
        })
        refresh()
        setRoomRulesSnapshot(next)
        await reportLocalRules()
        setNotice(`已原子激活 ${inspected.manifest.id}；房间玩家将自动下载并激活。`)
      } else {
        const descriptor = await host.installFile(file)
        refresh()
        await reportLocalRules()
        setNotice(`已安装 ${descriptor.id}。`)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (plugin: InstalledDnd5eRulesPlugin) => {
    if (!host || !window.confirm(`卸载规则插件 ${plugin.id}？角色存档中的命名空间 ID 会保留。`)) return
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      if (roomSession?.role === 'dm' && roomRules?.requiredPlugins.some((item) => item.id === plugin.id)) {
        setRoomRulesSnapshot(await deleteRoomPlugin(roomSession, plugin.id))
      }
      await host.remove(plugin.id)
      refresh()
      await reportLocalRules()
      setNotice(`已卸载 ${plugin.id}${roomSession?.role === 'dm' ? '，并已停止房间分发' : ''}。`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const publishInstalledPlugin = async (plugin: InstalledDnd5eRulesPlugin) => {
    if (!roomSession || roomSession.role !== 'dm' || !host) return
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      const manifest = host.listActive().find((candidate) => candidate.id === plugin.id)
      if (!manifest) throw new Error(`插件 ${plugin.id} 尚未激活`)
      const bytes = await host.readBytes(plugin.id)
      const next = await activateRoomPlugin({
        manifest,
        integrity: plugin.integrity,
        fileName: plugin.source === 'file' ? plugin.fileName : `${plugin.id}.dndstars5e`,
        bytes,
      })
      setRoomRulesSnapshot(next)
      await reportLocalRules()
      setNotice(`已原子发布 ${plugin.id}；房间玩家将自动下载并激活。`)
    } catch (reason) {
      setError(roomApiErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  const downloadInstalledPlugin = async (plugin: InstalledDnd5eRulesPlugin) => {
    if (!host) return
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      const bytes = await host.readBytes(plugin.id)
      const blob = new Blob([bytes], { type: 'text/javascript' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = plugin.source === 'file' ? plugin.fileName : `${plugin.id}.dndstars5e`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setNotice(`已导出 ${plugin.id}，以后可直接重新导入。`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="规则插件"
        description="安装或创建独立规则包，为人物卡和 DM Headless 结算注入种族、背景、特性、法术与装备。核心仍只包含 D&D 5e 2014／SRD 5.1。"
        actions={(
          <div className="flex flex-wrap gap-2">
            <a
              href="/plugin-templates/phb-2014-compat-template.dndstars5e"
              download
              className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-arcane-400/60 hover:text-white"
            >
              <Download className="h-4 w-4" />
              下载兼容模板
            </a>
            <a
              href="/plugin-templates/custom-equipment-pack-template.dndstars5e"
              download
              className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-400/60 hover:text-white"
            >
              <Download className="h-4 w-4" />
              下载装备模板
            </a>
            {roomSession?.role !== 'player' && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".dndstars5e,.mjs,.js,text/javascript,application/javascript"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    if (file) void installFile(file)
                    event.currentTarget.value = ''
                  }}
                />
                <button
                  type="button"
                  disabled={busy || !host}
                  onClick={() => fileRef.current?.click()}
                  className="glow-arcane flex items-center gap-2 rounded-xl bg-gradient-to-br from-arcane-500 to-arcane-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {busy ? '正在处理…' : roomSession?.role === 'dm' ? '上传房间规则包' : '安装本地插件'}
                </button>
              </>
            )}
          </div>
        )}
      />

      {roomSession && (
        <section
          data-testid="room-rules-status"
          className={`mb-5 rounded-2xl border p-5 ${
            roomRules?.member.ready
              ? 'border-emerald-400/20 bg-emerald-500/5'
              : 'border-amber-400/25 bg-amber-500/5'
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-5 w-5 ${roomRules?.member.ready ? 'text-emerald-300' : 'text-amber-300'}`} />
                <h2 className="font-semibold text-slate-100">房间规则包握手</h2>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  roomRules?.member.ready
                    ? 'bg-emerald-500/12 text-emerald-200'
                    : 'bg-amber-500/12 text-amber-100'
                }`}>
                  {roomRules?.member.ready ? '本机已就绪' : '版本不一致'}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                DM 上传的规则包由当前房间托管；玩家端会自动下载、复核 SHA-256 与清单版本后激活。文件不会进入公共索引或跨房间共享。
              </p>
              <div className="mt-3 space-y-2">
                {(roomRules?.requiredPlugins ?? []).length === 0 ? (
                  <p className="text-xs text-slate-500">本房间当前仅使用 SRD 5.1 核心包。</p>
                ) : roomRules?.requiredPlugins.map((plugin) => {
                  const local = activeRequirements.find((candidate) => candidate.id === plugin.id)
                  const metadata = roomRules.plugins?.find((candidate) => candidate.id === plugin.id)
                  const exact = local?.version === plugin.version && local.integrity === plugin.integrity &&
                    (local.stateSchemaVersion ?? 1) === plugin.stateSchemaVersion
                  return (
                    <div key={plugin.id} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-300">{metadata?.name ?? plugin.id}</span>
                        <span className="text-slate-500">v{plugin.version}</span>
                        <span className="text-slate-500">状态 v{plugin.stateSchemaVersion}</span>
                        <span className={exact ? 'text-emerald-300' : 'text-amber-300'}>{exact ? '匹配' : '缺失或版本错误'}</span>
                      </div>
                      {metadata && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          发布者：{metadata.publisher} · 许可证：{metadata.license}
                        </p>
                      )}
                      <p className="mt-1 break-all font-mono text-[10px] text-slate-600">{plugin.integrity}</p>
                    </div>
                  )
                })}
              </div>
              {roomPluginSyncError && (
                <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-200">
                  自动下载失败：{roomPluginSyncError}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void reportLocalRules().catch((reason) => setError(roomApiErrorMessage(reason)))}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                重新校验
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4 text-sm leading-6 text-emerald-100/80">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div>
            <p className="font-semibold text-emerald-100">Worker／WASM 规则沙箱已启用</p>
            <p className="mt-1 text-emerald-100/65">
              规则包不能访问 DOM、网络、localStorage、IndexedDB 或页面 Store，也不能直接修改战斗状态；
              它只能返回平台白名单内的 Headless capability 操作，再由 DM 权威层复核目标、距离与行动经济。
              SHA-256 和沙箱不代表内容授权，请仍只使用来源与许可证明确的文件。
            </p>
          </div>
        </div>
      </div>

      {roomSession?.role !== 'player' && (
        <Dnd5eCustomPluginBuilder
          defaultPublisher={roomSession?.displayName}
          busy={busy}
          onInstall={installFile}
        />
      )}

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

      {installed.length === 0 ? (
        <div className="glass flex min-h-64 flex-col items-center justify-center rounded-2xl px-6 text-center">
          <Plug className="h-10 w-10 text-slate-600" />
          <h2 className="mt-4 text-lg font-semibold text-slate-200">尚未安装规则插件</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            {roomSession?.role === 'player'
              ? '等待 DM 向房间上传规则包；上传后本页会自动下载、校验并激活。'
              : '先下载不含 PHB 文本的兼容模板。模板自带一个原创演示特性，可验证人物卡选择、地图目标和 DM Headless 同步链路。'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {installed.map((plugin) => {
            const active = activeById.get(plugin.id)
            const hosted = roomRules?.requiredPlugins.some((requirement) =>
              requirement.id === plugin.id &&
              requirement.version === active?.version &&
              requirement.integrity === plugin.integrity &&
              requirement.stateSchemaVersion === (active?.stateSchemaVersion ?? 1))
            return (
              <article key={plugin.id} className="glass rounded-2xl p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-100">{active?.name ?? plugin.id}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        active ? 'bg-emerald-500/12 text-emerald-200' : 'bg-rose-500/12 text-rose-200'
                      }`}>
                        {active ? `已启用 · v${active.version}` : '加载失败'}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
                        {plugin.source === 'file' ? '本地文件' : '固定 URL'}
                      </span>
                    </div>
                    <p className="mt-1 break-all font-mono text-xs text-slate-500">{plugin.id}</p>
                    {active?.description && <p className="mt-3 text-sm leading-6 text-slate-400">{active.description}</p>}
                    <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
                      <div><dt className="inline text-slate-600">来源：</dt><dd className="inline">{plugin.source === 'file' ? plugin.fileName : plugin.moduleUrl}</dd></div>
                      <div><dt className="inline text-slate-600">许可：</dt><dd className="inline">{active?.license ?? '等待插件加载'}</dd></div>
                      <div className="sm:col-span-2"><dt className="inline text-slate-600">SHA-256：</dt><dd className="break-all font-mono text-[11px]">{plugin.integrity}</dd></div>
                    </dl>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {roomSession?.role !== 'player' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void downloadInstalledPlugin(plugin)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" />
                        导出文件
                      </button>
                    )}
                    {roomSession?.role === 'dm' && !hosted && (
                      <button
                        type="button"
                        disabled={busy || !active}
                        onClick={() => void publishInstalledPlugin(plugin)}
                        className="rounded-xl bg-arcane-500/15 px-3 py-2 text-sm font-semibold text-arcane-100 disabled:opacity-50"
                      >
                        发布到房间
                      </button>
                    )}
                    {roomSession?.role !== 'player' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(plugin)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-rose-400/15 bg-rose-500/5 px-3 py-2 text-sm text-rose-200 transition hover:bg-rose-500/12 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        卸载
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
