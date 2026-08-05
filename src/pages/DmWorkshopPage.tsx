import { useRef, useState, useSyncExternalStore } from 'react'
import { AlertTriangle, BadgeDollarSign, CheckCircle2, PackageCheck, Upload } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Dnd5eLocalRulesAiImporter from '../components/dm/Dnd5eLocalRulesAiImporter'
import MarketplacePublicationDialog, {
  type MarketplacePublicationInput,
} from '../components/marketplace/MarketplacePublicationDialog'
import Dnd5eCustomPluginBuilder, {
  type Dnd5eWorkshopContentEditRequest,
} from '../components/rules/Dnd5eCustomPluginBuilder'
import { activateRoomPluginPackage } from '../lib/roomPluginActivation'
import {
  accountApiErrorMessage,
  AccountApiError,
  uploadAccountPlugin,
  type AccountPluginVersion,
} from '../lib/accountApi'
import { getAccountSession, subscribeAccountSession } from '../lib/accountSession'
import { publishAccountPluginVersion } from '../lib/pluginCatalogApi'
import { getRoomSession } from '../lib/roomSession'
import { setRoomRulesSnapshot } from '../lib/roomRulesState'
import { showAppConfirm } from '../lib/appDialog'
import {
  dnd5eRoomRuntimeProjectionBytesV2,
  type Dnd5eContentAutomationCoverageReportV2,
} from '../rulesets/dnd5e'

export default function DmWorkshopPage() {
  const { campaignId = 'local' } = useParams()
  const [roomSession] = useState(() => getRoomSession())
  const accountSession = useSyncExternalStore(subscribeAccountSession, getAccountSession, () => null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<Dnd5eContentAutomationCoverageReportV2 | null>(null)
  const [contentWorkshopImport, setContentWorkshopImport] = useState<Dnd5eWorkshopContentEditRequest | null>(null)
  const [publicationPlugin, setPublicationPlugin] = useState<AccountPluginVersion | null>(null)
  const packageInputRef = useRef<HTMLInputElement>(null)
  const host = window.DNDSTARS_5E_RULES_PLUGINS
  const activeRulesPath = `/campaign/${encodeURIComponent(campaignId)}/extensions`
  const draftStorageScope = roomSession?.roomId ?? campaignId
  const campaignAuthorityId = /^[A-HJ-NP-Z2-9]{12}$/.test(campaignId) ? campaignId : undefined

  const saveAndActivate = async (file: File, options: { skipConfirmation?: boolean } = {}) => {
    if (!host) throw new Error('规则插件 Host 尚未初始化，请刷新页面后重试。')
    if (busy) throw new Error('另一个规则包正在处理，请稍后重试。')
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      let inspected = await host.inspectFile(file)
      setCoverage(inspected.automationCoverage ?? null)
      const summary = inspected.contentSummary
      if (summary && !options.skipConfirmation) {
        const accepted = await showAppConfirm({
          title: `保存工坊扩展：${inspected.manifest.name} v${inspected.manifest.version}`,
          message: [
            `内容：种族 ${summary.races}、背景 ${summary.backgrounds}、特性 ${summary.features}、专长 ${summary.feats}、法术 ${summary.spells}、物品 ${summary.items}、职业 ${summary.classes}、子职 ${summary.subclasses}、怪物 ${summary.monsters}`,
            '保存后会立即启用，并出现在“规则与扩展”的当前激活清单。',
          ].join('\n'),
          confirmLabel: '保存并启用',
        })
        if (!accepted) return
      }

      if (roomSession?.role === 'dm') {
        const policy = inspected.manifest.distributionPolicy
        if (policy !== 'room-distributable' && policy !== 'room-ephemeral') {
          throw new Error('联网房间中的工坊扩展必须声明 room-distributable 或 room-ephemeral。')
        }
        if (policy === 'room-ephemeral') {
          const projected = dnd5eRoomRuntimeProjectionBytesV2(inspected.bytes)
          inspected = await host.inspectFile(new File(
            [new Uint8Array(projected)],
            inspected.fileName,
            { type: 'application/json' },
          ))
        }
        const next = await activateRoomPluginPackage({
          session: roomSession,
          host,
          package: inspected,
        })
        if (policy === 'room-ephemeral') {
          await host.installEphemeralBytes({
            id: inspected.manifest.id,
            version: inspected.manifest.version,
            fileName: inspected.fileName,
            integrity: inspected.integrity,
            bytes: inspected.bytes,
          })
        } else {
          await host.installBytes({
            id: inspected.manifest.id,
            version: inspected.manifest.version,
            fileName: inspected.fileName,
            integrity: inspected.integrity,
            bytes: inspected.bytes,
          })
        }
        setRoomRulesSnapshot(next)
        setNotice(`已保存并启用 ${inspected.manifest.name}；当前房间成员会按精确版本同步。`)
        return
      }

      if (inspected.manifest.distributionPolicy === 'room-ephemeral') {
        await host.installEphemeralBytes({
          id: inspected.manifest.id,
          version: inspected.manifest.version,
          fileName: inspected.fileName,
          integrity: inspected.integrity,
          bytes: inspected.bytes,
        })
        setNotice(`已在当前本地会话临时启用 ${inspected.manifest.name}；重新打开后需再次导入。`)
        return
      }
      await host.installBytes({
        id: inspected.manifest.id,
        version: inspected.manifest.version,
        fileName: inspected.fileName,
        integrity: inspected.integrity,
        bytes: inspected.bytes,
      })
      setNotice(`已在当前设备保存并启用 ${inspected.manifest.name}。`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      throw cause
    } finally {
      setBusy(false)
    }
  }

  const uploadWorkshopPlugin = async (file: File) => {
    if (!host) throw new Error('规则插件 Host 尚未初始化，请刷新页面后重试。')
    if (!accountSession) throw new Error('请先登录拥有该战役的账号，再上传插件中心。')
    const verifiedRoomDm = roomSession?.role === 'dm' && roomSession.accountId === accountSession.accountId
      ? roomSession
      : null
    if (!campaignAuthorityId && !verifiedRoomDm) {
      throw new Error('只有战役所有者账号或已绑定账号的当前房间 DM 可以从工坊上传插件。')
    }
    if (busy) throw new Error('另一个规则包正在处理，请稍后重试。')
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      const inspected = await host.inspectFile(file)
      setCoverage(inspected.automationCoverage ?? null)
      if (inspected.manifest.distributionPolicy !== 'room-distributable') {
        throw new AccountApiError(
          inspected.manifest.distributionPolicy === 'local-only'
            ? 'plugin-local-only'
            : 'plugin-ephemeral-room-only',
          409,
        )
      }
      const saved = await uploadAccountPlugin({
        ...inspected,
        authority: {
          kind: 'dm-workshop',
          ...(campaignAuthorityId ? { campaignId: campaignAuthorityId } : {}),
          ...(verifiedRoomDm ? {
            room: {
              roomId: verifiedRoomDm.roomId,
              memberId: verifiedRoomDm.memberId,
              roomToken: verifiedRoomDm.roomToken,
            },
          } : {}),
        },
      })
      setPublicationPlugin(saved)
      setNotice(`已将 ${saved.name} v${saved.version} 保存到账号插件库；请继续设置价格、权利声明与商品详情。`)
    } catch (cause) {
      setError(cause instanceof AccountApiError
        ? accountApiErrorMessage(cause)
        : cause instanceof Error ? cause.message : String(cause))
      throw cause
    } finally {
      setBusy(false)
    }
  }

  const publishWorkshopPlugin = async (
    plugin: AccountPluginVersion,
    input: MarketplacePublicationInput,
  ) => {
    setBusy(true)
    setError(null)
    try {
      const result = await publishAccountPluginVersion(plugin, input)
      setPublicationPlugin(null)
      setNotice(result.status === 'pending'
        ? `${plugin.name} v${plugin.version} 已提交插件中心审核；通过前不会公开显示。`
        : `${plugin.name} v${plugin.version} 已发布到插件中心。`)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
      throw cause
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl" data-testid="dm-custom-workshop-page">
      {publicationPlugin && (
        <MarketplacePublicationDialog
          plugin={publicationPlugin}
          busy={busy}
          onClose={() => setPublicationPlugin(null)}
          onSubmit={(input) => publishWorkshopPlugin(publicationPlugin, input)}
        />
      )}
      <PageHeader
        title="自定义工坊"
        description="可粘贴规则交给本地或自选 AI 转换，也可使用结构化编辑器创建内容；仅在 Host 校验和 DM 确认后启用。"
        actions={(
          <div className="flex flex-wrap gap-2">
            <input
              ref={packageInputRef}
              type="file"
              accept=".dndstars5e,.json,.mjs,.js,application/json,text/javascript,application/javascript"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void saveAndActivate(file, { skipConfirmation: true }).catch(() => undefined)
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => packageInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-arcane-500/15 px-4 py-2.5 text-sm font-semibold text-arcane-100 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />直接导入规则包
            </button>
            <Link
              to={activeRulesPath}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200"
            >
              <PackageCheck className="h-4 w-4" />查看当前激活内容
            </Link>
          </div>
        )}
      />

      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}
        </div>
      )}
      {coverage && (
        <div className="mb-4 rounded-xl border border-sky-400/20 bg-sky-500/[0.05] px-4 py-3 text-xs leading-5 text-sky-100/75">
          自动化覆盖：完整 {coverage.totals.full} · 部分 {coverage.totals.partial} ·
          手动 {coverage.totals.manual} · 仅资料 {coverage.totals.referenceOnly}
          <span className="ml-2">
            Activity：通用 {coverage.activityMigration.adapted} · 兼容回退 {coverage.activityMigration.legacyFallback} ·
            DM 裁定 {coverage.activityMigration.dmAdjudication}
          </span>
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.04] px-4 py-3 text-sm leading-6 text-emerald-50/90">
        <BadgeDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
        <div>
          <strong>工坊与插件中心已连接</strong>
          <p className="text-emerald-100/65">登录战役所有者账号后，可将 room-distributable 纯数据包保存到账号库，并继续定价和提交审核。local-only、room-ephemeral、PHB 原文或无分发权的官方美术不能上传市场。</p>
        </div>
      </div>

      <Dnd5eLocalRulesAiImporter
        key={`ai-draft:${draftStorageScope}`}
        busy={busy}
        draftStorageScope={draftStorageScope}
        onInstall={(file) => saveAndActivate(file, { skipConfirmation: true })}
        onEditContent={(request) => setContentWorkshopImport((current) => ({
          requestId: (current?.requestId ?? 0) + 1,
          ...request,
        }))}
      />

      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-100">结构化内容编辑器</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">适合逐条创建、校对和维护怪物、法术、特性及其他规则资源。</p>
      </div>
      <Dnd5eCustomPluginBuilder
        key={`builder-draft:${draftStorageScope}`}
        defaultPublisher={roomSession?.displayName}
        draftStorageScope={draftStorageScope}
        busy={busy}
        onInstall={saveAndActivate}
        onPublish={accountSession && (campaignAuthorityId || roomSession?.role === 'dm')
          ? uploadWorkshopPlugin
          : undefined}
        publishLabel="上传插件中心并定价"
        installLabel={roomSession?.role === 'dm'
          ? '保存并启用到当前房间'
          : '保存并在当前设备启用'}
        alwaysExpanded
        contentWorkshopImport={contentWorkshopImport}
        onContentWorkshopImportClose={() => setContentWorkshopImport(null)}
      />
    </div>
  )
}
