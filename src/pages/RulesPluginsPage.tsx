import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Activity, AlertTriangle, CheckCircle2, Download, Plug, Puzzle, RefreshCw, Shield, ShieldCheck, Trash2, Upload } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import CampaignSafetyPanel from '../components/CampaignSafetyPanel'
import Dnd5eEffectDiagnosticsPanel from '../components/Dnd5eEffectDiagnosticsPanel'
import RoomManagementPanel from '../components/RoomManagementPanel'
import { SharedSyncDiagnosticsPanel } from '../components/SharedSyncStatus'
import Dnd5eCustomPluginBuilder from '../components/rules/Dnd5eCustomPluginBuilder'
import {
  activeDnd5eRulesPluginRequirements,
  compileDnd5eLocalContentCollection,
  dnd5eRoomRuntimeProjectionBytesV2,
  roomActiveDnd5eRulesPluginRequirements,
  type Dnd5eContentAutomationCoverageReportV2,
  type Dnd5eLocalContentCollectionAudit,
  type InstalledDnd5eRulesPlugin,
  type Dnd5eRulesPluginManifest,
} from '../rulesets/dnd5e'
import {
  deleteRoomPlugin,
  heartbeatRoom,
  loadRoomRules,
  roomApiErrorMessage,
} from '../lib/roomApi'
import { activateRoomPluginPackage } from '../lib/roomPluginActivation'
import { getRoomSession } from '../lib/roomSession'
import { synchronizeRoomPlugins } from '../lib/roomPluginSync'
import {
  getRoomRulesSnapshot,
  getRoomPluginSyncError,
  setRoomRulesSnapshot,
  subscribeRoomRules,
} from '../lib/roomRulesState'
import {
  DND5E_SRD_5_1_ATTRIBUTION,
  DND5E_SRD_5_1_LICENSE_URL,
  DND5E_SRD_5_1_SOURCE_URL,
  DND5E_SRD_5_1_TRANSLATION_NOTICE,
} from '../rulesets/dnd5e/srdContent'

export default function RulesPluginsPage({ view = 'settings' }: { view?: 'settings' | 'workshop' }) {
  const { campaignId } = useParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const collectionRef = useRef<HTMLInputElement>(null)
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
  const [automationCoverage, setAutomationCoverage] =
    useState<Dnd5eContentAutomationCoverageReportV2 | null>(null)
  const [collectionAudit, setCollectionAudit] =
    useState<Dnd5eLocalContentCollectionAudit | null>(null)
  const [settingsSection, setSettingsSection] = useState<'plugins' | 'room' | 'diagnostics'>('plugins')
  const installed = host?.listInstalled() ?? []
  const activeById = new Map((host?.listActive() ?? []).map((plugin) => [plugin.id, plugin]))
  const activeRequirements = activeDnd5eRulesPluginRequirements()

  const refresh = () => setRevision((value) => value + 1)
  void revision

  const reportLocalRules = async () => {
    if (!roomSession) return
    let next = await heartbeatRoom(roomSession, roomActiveDnd5eRulesPluginRequirements())
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
    return activateRoomPluginPackage({
      session: roomSession,
      host,
      package: input,
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
      const inspected = await host.inspectFile(file)
      setAutomationCoverage(inspected.automationCoverage ?? null)
      if (inspected.contentSummary) {
        const summary = inspected.contentSummary
        const coverage = inspected.automationCoverage
        const accepted = window.confirm([
          `安装内容包：${inspected.manifest.name} v${inspected.manifest.version}`,
          `来源：${inspected.provenance?.sourceTitle ?? inspected.manifest.publisher}`,
          `许可：${inspected.manifest.license}`,
          `分发策略：${inspected.manifest.distributionPolicy ?? '未声明'}`,
          `内容：种族 ${summary.races}、背景 ${summary.backgrounds}、特性 ${summary.features}、专长 ${summary.feats}、法术 ${summary.spells}、物品 ${summary.items}、子职 ${summary.subclasses}、怪物 ${summary.monsters}、图标 ${summary.imageAssets}`,
          ...(coverage ? [
            `自动化：完整 ${coverage.totals.full}、部分 ${coverage.totals.partial}、手动 ${coverage.totals.manual}、仅资料 ${coverage.totals.referenceOnly}`,
          ] : []),
        ].join('\n'))
        if (!accepted) return
      }
      if (roomSession?.role === 'dm') {
        if (!['room-distributable', 'room-ephemeral'].includes(
          inspected.manifest.distributionPolicy ?? '',
        )) {
          throw new Error('当前位于联网房间；内容包必须明确声明 room-distributable 或 room-ephemeral。')
        }
        if (inspected.manifest.distributionPolicy === 'room-ephemeral') {
          const runtimeBytes = dnd5eRoomRuntimeProjectionBytesV2(inspected.bytes)
          const runtimeFile = new File(
            [new Uint8Array(runtimeBytes)],
            inspected.fileName,
            { type: 'application/json' },
          )
          const runtime = await host.inspectFile(runtimeFile)
          const next = await activateRoomPlugin(runtime)
          await host.installEphemeralBytes({
            id: runtime.manifest.id,
            version: runtime.manifest.version,
            fileName: runtime.fileName,
            integrity: runtime.integrity,
            bytes: runtime.bytes,
          })
          refresh()
          setRoomRulesSnapshot(next)
          await reportLocalRules()
          setNotice(`已临时导入 ${runtime.manifest.id}；原始 JSON/CSV、提示词和规则正文未传输，关闭房间后需重新导入。`)
          return
        }
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
        if (inspected.manifest.distributionPolicy === 'room-ephemeral') {
          throw new Error('room-ephemeral 合集只能由 DM 在已连接的房间内临时导入。')
        }
        const descriptor = await host.installBytes({
          id: inspected.manifest.id,
          version: inspected.manifest.version,
          fileName: inspected.fileName,
          integrity: inspected.integrity,
          bytes: inspected.bytes,
        })
        refresh()
        await reportLocalRules()
        setNotice(inspected.manifest.distributionPolicy === 'local-only'
          ? `已仅在当前设备安装 ${descriptor.id}；不会上传到账号云库、房间或市场。`
          : `已安装 ${descriptor.id}。`)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const installLocalCollection = async (files: readonly File[]) => {
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      if (!roomSession || roomSession.role !== 'dm') {
        throw new Error('本地合集只能由 DM 导入当前房间')
      }
      const compiled = await compileDnd5eLocalContentCollection(files)
      setCollectionAudit(compiled.audit)
      if (!compiled.audit.complete) {
        const accepted = window.confirm([
          '本地合集缺口审计未通过，仍要临时导入吗？',
          `条目：${compiled.audit.totals.entries}`,
          `数量缺口：${compiled.audit.totals.countShortfall}`,
          `缺失稳定 ID：${compiled.audit.totals.missingIds}`,
          `缺失图片：${compiled.audit.totals.missingImages}`,
        ].join('\n'))
        if (!accepted) return
      }
      const file = new File(
        [new Uint8Array(compiled.bytes)],
        compiled.fileName,
        { type: 'application/json' },
      )
      await installFile(file)
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

  const downloadAutomationCoverage = () => {
    if (!automationCoverage) return
    const bytes = new TextEncoder().encode(`${JSON.stringify(automationCoverage, null, 2)}\n`)
    const blob = new Blob([bytes], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${automationCoverage.package.id}-${automationCoverage.package.version}-automation-coverage.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const downloadCollectionAudit = () => {
    if (!collectionAudit) return
    const bytes = new TextEncoder().encode(`${JSON.stringify(collectionAudit, null, 2)}\n`)
    const blob = new Blob([bytes], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${collectionAudit.package.id}-${collectionAudit.package.version}-collection-audit.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  if (view === 'workshop') return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="自定义工坊"
        description="创建当前战役可安装的怪物、子职、种族、背景、特性、法术、装备与规则内容。所有自动化能力仍由 Host 白名单和 DM 权威层校验。"
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.04] p-4">
          <p className="text-sm font-semibold text-amber-100">专长编辑器</p>
          <p className="mt-1 text-xs leading-5 text-amber-100/60">已接通等级、属性与种族前提、角色选择以及声明式 Headless 行动；资格和资源由 Host 复核。</p>
        </div>
        <div className="rounded-2xl border border-sky-400/15 bg-sky-500/[0.04] p-4">
          <p className="text-sm font-semibold text-sky-100">声明式职业 V1</p>
          <p className="mt-1 text-xs leading-5 text-sky-100/60">已支持职业底盘、1–20 级进度、熟练项、施法、兼职前提、升级选择与起始装备；不安全的战斗特性会显式降级。</p>
        </div>
      </div>
      <Dnd5eCustomPluginBuilder
        defaultPublisher={roomSession?.displayName}
        busy={busy}
        onInstall={installFile}
        installLabel="安装并启用到当前战役"
        alwaysExpanded
        categoryControl="select"
      />
      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </div>
      )}
      {automationCoverage && (
        <section className="mb-4 rounded-xl border border-sky-400/20 bg-sky-500/[0.05] px-4 py-3 text-sm text-sky-100">
          <p className="font-semibold">自动化兼容报告</p>
          <p className="mt-1 text-xs leading-5 text-sky-100/65">
            完整 {automationCoverage.totals.full} · 部分 {automationCoverage.totals.partial} ·
            手动 {automationCoverage.totals.manual} · 仅资料 {automationCoverage.totals.referenceOnly}。
          </p>
        </section>
      )}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="设置"
        description="管理规则插件、房间权限、战役备份与高级数据诊断。"
        actions={settingsSection === 'plugins' ? (
          <div className="flex flex-wrap gap-2">
            {roomSession?.role !== 'player' && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".dndstars5e,.json,.mjs,.js,application/json,text/javascript,application/javascript"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    if (file) {
                      setCollectionAudit(null)
                      void installFile(file)
                    }
                    event.currentTarget.value = ''
                  }}
                />
                {roomSession?.role === 'dm' && (
                  <input
                    ref={collectionRef}
                    type="file"
                    multiple
                    className="hidden"
                    {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                    onChange={(event) => {
                      const files = [...(event.currentTarget.files ?? [])]
                      if (files.length > 0) void installLocalCollection(files)
                      event.currentTarget.value = ''
                    }}
                  />
                )}
                <button
                  type="button"
                  disabled={busy || !host}
                  onClick={() => fileRef.current?.click()}
                  className="glow-arcane flex items-center gap-2 rounded-xl bg-gradient-to-br from-arcane-500 to-arcane-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {busy ? '正在处理…' : roomSession?.role === 'dm' ? '上传房间规则包' : '安装本地插件'}
                </button>
                {roomSession?.role === 'dm' && (
                  <button
                    type="button"
                    disabled={busy || !host}
                    onClick={() => collectionRef.current?.click()}
                    className="flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/8 px-4 py-2.5 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    导入房间临时合集
                  </button>
                )}
              </>
            )}
          </div>
        ) : undefined}
      />

      <nav className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-white/8 bg-black/15 p-2" aria-label="设置分类">
        {[
          { id: 'plugins' as const, label: '规则插件', icon: Puzzle },
          ...(roomSession?.role === 'player' ? [] : [
            { id: 'room' as const, label: '房间与恢复', icon: Shield },
            { id: 'diagnostics' as const, label: '高级诊断', icon: Activity },
          ]),
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSettingsSection(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              settingsSection === id
                ? 'bg-arcane-500/15 text-arcane-200 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {settingsSection === 'plugins' && <div className="contents">
      <section className="mb-5 flex flex-col gap-4 rounded-2xl border border-arcane-400/20 bg-arcane-500/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-100">账号插件中心已经开放</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            在独立页面跨设备保存、创建和管理插件版本；本页继续负责当前房间握手与高级诊断。
          </p>
        </div>
        <Link
          to={campaignId ? `/campaign/${encodeURIComponent(campaignId)}/extensions` : '/app/extensions'}
          className="shrink-0 rounded-xl bg-arcane-500/15 px-4 py-2.5 text-center text-sm font-semibold text-arcane-100 hover:bg-arcane-500/20"
        >
          打开插件中心
        </Link>
      </section>
      <section className="mb-5 rounded-2xl border border-white/8 bg-black/15 p-5">
        <h2 className="font-semibold text-slate-100">SRD 5.1 来源与许可</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{DND5E_SRD_5_1_TRANSLATION_NOTICE}</p>
        <p className="mt-3 text-xs leading-5 text-slate-500">{DND5E_SRD_5_1_ATTRIBUTION}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <a href={DND5E_SRD_5_1_SOURCE_URL} target="_blank" rel="noreferrer" className="text-violet-300 hover:text-violet-200">查看 SRD 5.1 来源</a>
          <a href={DND5E_SRD_5_1_LICENSE_URL} target="_blank" rel="noreferrer" className="text-violet-300 hover:text-violet-200">查看 CC BY 4.0 许可证</a>
        </div>
      </section>
      <section className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.04] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
          <div>
            <h2 className="font-semibold text-cyan-100">设备本地私有导入</h2>
            <p className="mt-1 text-sm leading-6 text-cyan-100/65">
              将清单的 <code>distributionPolicy</code> 设为 <code>local-only</code> 后，包字节只写入当前浏览器的
              IndexedDB。客户端与服务器都会拒绝账号云库、房间托管和市场发布；房间心跳也不会发送该包的
              ID、版本或 SHA-256；存在联网房间会话时也不会激活本地私有包。请勿在包外手动上传或分享原文、
              扫描页与官方美术。
            </p>
          </div>
        </div>
      </section>
      {roomSession?.role === 'dm' && (
        <section className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-500/[0.04] p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <h2 className="font-semibold text-amber-100">单房间临时 JSON/CSV 合集</h2>
              <p className="mt-1 text-sm leading-6 text-amber-100/65">
                选择含 <code>collection.json</code> 的本地目录后，浏览器会合并 JSON、CSV 和你提供的
                PNG/JPEG/WebP 图片。原始合集、AI 提示词和模型记录不会上传；发送给房间的 V2 运行包只保留名称、
                结构化结算字段和图片，长篇规则正文会被统一占位文本替换。包只驻留客户端内存并由当前房间临时托管，
                DM 关闭房间后服务端删除文件，下次开房必须重新选择合集。
              </p>
            </div>
          </div>
        </section>
      )}
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

      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </div>
      )}
      {automationCoverage && (
        <section className="mb-4 rounded-xl border border-sky-400/20 bg-sky-500/[0.05] px-4 py-3 text-sm text-sky-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">本地自动化覆盖报告</p>
              <p className="mt-1 text-xs leading-5 text-sky-100/65">
                完整 {automationCoverage.totals.full} · 部分 {automationCoverage.totals.partial} ·
                手动 {automationCoverage.totals.manual} · 仅资料 {automationCoverage.totals.referenceOnly}。
                报告仅含计数、稳定 ID 和平台兼容性说明，不含规则原文、内容名称或图片数据。
              </p>
            </div>
            <button
              type="button"
              onClick={downloadAutomationCoverage}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-300/20 bg-sky-400/8 px-3 py-2 text-xs font-semibold text-sky-100"
            >
              <Download className="h-4 w-4" />
              下载报告
            </button>
          </div>
        </section>
      )}
      {collectionAudit && (
        <section className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          collectionAudit.complete
            ? 'border-emerald-400/20 bg-emerald-500/[0.05] text-emerald-100'
            : 'border-amber-400/20 bg-amber-500/[0.05] text-amber-100'
        }`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">
                本地合集缺口审计：{collectionAudit.complete ? '完整' : '存在缺口'}
              </p>
              <p className="mt-1 text-xs leading-5 opacity-65">
                实际条目 {collectionAudit.totals.entries} ·
                预期条目 {collectionAudit.totals.expectedEntries} ·
                数量缺口 {collectionAudit.totals.countShortfall} ·
                缺失 ID {collectionAudit.totals.missingIds} ·
                缺失图片 {collectionAudit.totals.missingImages}。
                报告不含正文、内容名称、图片数据或 AI 提示词。
              </p>
            </div>
            <button
              type="button"
              onClick={downloadCollectionAudit}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-current/20 bg-black/10 px-3 py-2 text-xs font-semibold"
            >
              <Download className="h-4 w-4" />
              下载缺口报告
            </button>
          </div>
        </section>
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
              : '可在下方使用规则包工作室创建自己的内容，或上传你有权使用和分发的规则插件。核心包不会附带非 SRD 规则模板。'}
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
                        {plugin.source === 'file'
                          ? '本地文件'
                          : plugin.source === 'ephemeral'
                            ? '房间临时内存'
                            : '固定 URL'}
                      </span>
                      {active?.distributionPolicy === 'local-only' && (
                        <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">
                          仅此设备
                        </span>
                      )}
                      {active?.distributionPolicy === 'room-ephemeral' && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                          关闭房间即失效
                        </span>
                      )}
                    </div>
                    <p className="mt-1 break-all font-mono text-xs text-slate-500">{plugin.id}</p>
                    {active?.description && <p className="mt-3 text-sm leading-6 text-slate-400">{active.description}</p>}
                    <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
                      <div><dt className="inline text-slate-600">来源：</dt><dd className="inline">{
                        plugin.source === 'url' ? plugin.moduleUrl : plugin.fileName
                      }</dd></div>
                      <div><dt className="inline text-slate-600">许可：</dt><dd className="inline">{active?.license ?? '等待插件加载'}</dd></div>
                      <div className="sm:col-span-2"><dt className="inline text-slate-600">SHA-256：</dt><dd className="break-all font-mono text-[11px]">{plugin.integrity}</dd></div>
                    </dl>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {roomSession?.role !== 'player' && plugin.source !== 'ephemeral' && (
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
                    {roomSession?.role === 'dm' && !hosted && active?.distributionPolicy === 'room-distributable' && (
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
      </div>}

      {settingsSection === 'room' && roomSession?.role !== 'player' && (
        <section>
          <div className="rounded-2xl border border-white/8 bg-black/15 p-5">
            <h2 className="font-semibold text-slate-100">房间、安全与恢复</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              这些入口负责在线成员权限、DM 转让、战役导入导出与快照回滚，属于正式管理能力，仅在需要时使用。
            </p>
          </div>
          <RoomManagementPanel />
          <CampaignSafetyPanel />
        </section>
      )}

      {settingsSection === 'diagnostics' && roomSession?.role !== 'player' && (
        <section>
          <div className="rounded-2xl border border-white/8 bg-black/15 p-5">
            <h2 className="font-semibold text-slate-100">高级诊断</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              多人同步版本和 ActiveEffect 数据检查仍用于定位断线、冲突、旧存档迁移与状态投影错误；正常游戏时无需操作。
            </p>
          </div>
          <SharedSyncDiagnosticsPanel />
          <Dnd5eEffectDiagnosticsPanel />
        </section>
      )}
    </div>
  )
}
